"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { GlassCard as Card } from "@/components/GlassCard";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import { hashPassword } from "@/lib/authUtils";
import { doc, getDoc, collection, writeBatch, onSnapshot } from "firebase/firestore";

type Step = 1 | 2 | 3;

export default function RegisterPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [participantType, setParticipantType] = useState<"internal" | "external">("internal");
  const [portalSettings, setPortalSettings] = useState<any>(null);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "settings", "portal"), (docSnap) => {
      if (docSnap.exists()) {
        setPortalSettings(docSnap.data());
      }
    });
    return () => unsub();
  }, []);

  // Form States
  const [enrollmentNo, setEnrollmentNo] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [gender, setGender] = useState("");
  const [domain, setDomain] = useState("Engineering");
  const [course, setCourse] = useState("B.Tech/BE");
  const [specialization, setSpecialization] = useState("Computer Science and Engineering");
  const [yearOfStudy, setYearOfStudy] = useState("1st Year");
  const [collegeName, setCollegeName] = useState("");
  const [city, setCity] = useState("");

  const [teamName, setTeamName] = useState("");
  const [members, setMembers] = useState<string[]>([""]);

  // Payment gate for external participants
  const [hasPaid, setHasPaid] = useState(false);
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [paymentId, setPaymentId] = useState("");

  const handlePayment = useCallback(async () => {
    setPaymentProcessing(true);
    setError("");
    try {
      // Load Razorpay script dynamically
      const scriptLoaded = await new Promise<boolean>((resolve) => {
        if ((window as any).Razorpay) { resolve(true); return; }
        const script = document.createElement("script");
        script.src = "https://checkout.razorpay.com/v1/checkout.js";
        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);
        document.body.appendChild(script);
      });

      if (!scriptLoaded) {
        setError("Failed to load payment gateway. Please check your internet connection and try again.");
        setPaymentProcessing(false);
        return;
      }

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "rzp_test_placeholder",
        amount: 50000, // ₹500 in paise
        currency: "INR",
        name: "AlgoGLORiA Hackathon",
        description: "External Team Registration Fee",
        image: "/logo.png",
        handler: function (response: any) {
          setHasPaid(true);
          setPaymentId(response.razorpay_payment_id || "PAY_" + Date.now());
          setPaymentProcessing(false);
        },
        prefill: {
          name: `${firstName} ${lastName}`,
          email: enrollmentNo.includes("@") ? enrollmentNo : "",
          contact: mobile,
        },
        theme: {
          color: "#1a365d",
        },
        modal: {
          ondismiss: function () {
            setPaymentProcessing(false);
          },
        },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.on("payment.failed", function (response: any) {
        setError("Payment failed: " + (response.error?.description || "Unknown error"));
        setPaymentProcessing(false);
      });
      rzp.open();
    } catch (err: any) {
      setError("Payment error: " + err.message);
      setPaymentProcessing(false);
    }
  }, [firstName, lastName, enrollmentNo, mobile]);

  const handleStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check if registration is open
    if (participantType === "internal" && portalSettings?.internalRegistrationsOpen === false) {
      setError("Internal registrations are currently closed.");
      return;
    }
    if (participantType === "external" && portalSettings?.externalRegistrationsOpen === false) {
      setError("External registrations are currently closed.");
      return;
    }

    setError("");
    setLoading(true);
    try {
      const normalized = enrollmentNo.trim().toUpperCase();
      const userDoc = await getDoc(doc(db, "users", normalized));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        if (userData.isPasswordSet) {
          setError("An account with this enrollment number already exists. Please login.");
          setLoading(false);
          return;
        }
      }
      setStep(2);
    } catch (err) {
      setError("Error validating enrollment number.");
    } finally {
      setLoading(false);
    }
  };

  const handleStep2 = (e: React.FormEvent) => {
    e.preventDefault();
    if (!gender) return setError("Please select your gender.");
    if (participantType === "external" && (!collegeName.trim() || !city.trim())) {
      return setError("Please fill in your college and city details.");
    }
    setStep(3);
  };

  const submitRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const normalizedEnrollment = enrollmentNo.trim().toUpperCase();
      const hashedPassword = await hashPassword(password);

      const batch = writeBatch(db);
      const validMembers = members.filter(m => m.trim()).map(m => m.trim().toUpperCase());

      if (validMembers.length < 1) {
        setError("Team formation protocol requires a minimum of 2 members (Leader + at least 1 Member). Please invite an operative.");
        setLoading(false);
        return;
      }

      const newTeamRef = doc(collection(db, "teams"));

      const teamPayload: any = {
        team_name: teamName,
        leader_id: normalizedEnrollment,
        members: validMembers,
        problem_statement_id: null,
        isLocked: false,
      };

      if (participantType === "external") {
        teamPayload.competition_phase = "external";
        teamPayload.isExternalEligible = true;
        teamPayload.isVerified = true;
        teamPayload.paymentId = paymentId;
        teamPayload.paymentAmount = 500;
      }

      batch.set(newTeamRef, teamPayload);

      const userPayload: any = {
        enrollment_no: normalizedEnrollment,
        firstName,
        lastName,
        email: participantType === "external" ? normalizedEnrollment.toLowerCase() : email,
        mobile,
        gender,
        team_id: newTeamRef.id,
        role: "student",
        password_hash: hashedPassword,
        isPasswordSet: true,
        isInvited: false,
        domain,
        course,
        specialization,
        yearOfStudy,
      };

      if (participantType === "external") {
        userPayload.college_name = collegeName;
        userPayload.city = city;
        userPayload.competition_phase = "external";
      }

      batch.set(doc(db, "users", normalizedEnrollment), userPayload);

      for (const memberNo of validMembers) {
        batch.set(doc(db, "users", memberNo), {
          enrollment_no: memberNo,
          role: "student",
          team_id: newTeamRef.id,
          isPasswordSet: false,
          isInvited: true,
          ...(participantType === "external" ? { competition_phase: "external" } : {})
        });
      }

      await batch.commit();
      await login(normalizedEnrollment);
      router.push("/dashboard");

    } catch (err: any) {
      setError("Registration failed: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] flex flex-col items-center justify-center py-6 px-4 sm:p-6 bg-[#f4f7f6] w-full max-w-full overflow-hidden">
      <div className="w-full max-w-lg">
        {/* Stepper Header */}
        <div className="flex items-center justify-between mb-8 px-4">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-all ${s <= step ? "bg-[#1a365d] text-white" : "bg-gray-200 text-gray-400"
                }`}>
                {s}
              </div>
              <span className={`text-[10px] mt-1 font-bold uppercase tracking-widest ${s <= step ? "text-[#1a365d]" : "text-gray-400"
                }`}>
                {s === 1 ? "Auth" : s === 2 ? "Profile" : "Team"}
              </span>
            </div>
          ))}
          <div className="absolute w-[200px] h-[2px] bg-gray-200 -z-10 left-1/2 -translate-x-1/2 top-[120px]"></div>
        </div>

        <Card className="shadow-xl">
          <div className="text-center mb-6">
            <h2 className="text-xl font-bold text-[#1a365d] uppercase tracking-wide">
              {step === 1 && "Start Your Journey"}
              {step === 2 && "Personal Information"}
              {step === 3 && "Team Setup"}
            </h2>
            <p className="text-xs text-gray-500 mt-1 mb-3">
              Fill out the details below to register your team.
            </p>
            <a
              href="/AlgoGLORiA_Registration_Guide.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center w-full sm:w-auto mt-3 sm:mt-0 bg-[#fffbea] px-3 py-1.5 min-h-[44px] rounded-full text-[#002D62] border border-[#FFC300] text-[10px] font-black uppercase tracking-widest hover:bg-[#FFC300] hover:text-[#002D62] transition-colors"
            >
              <svg className="w-3 h-3 mr-1.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              Registration Guide
            </a>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-md mb-4 text-xs font-bold leading-relaxed">
              {error}
            </div>
          )}

          {step === 1 && (
            <form onSubmit={handleStep1} className="space-y-4">

              {/* Participant Type Selector */}
              <div className="mb-6">
                <label className="text-[#1a365d] text-sm font-bold tracking-tight mb-3 block text-center border-b pb-2">Participant Type</label>
                <div className="flex bg-gray-100 rounded-lg p-1">
                  <button
                    type="button"
                    onClick={() => {
                       setParticipantType("internal");
                       setError("");
                    }}
                    className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-md transition-all ${participantType === "internal" ? "bg-[#1a365d] text-white shadow" : "text-gray-500 hover:text-[#1a365d]"
                      }`}
                  >
                    Amity Student
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                       setParticipantType("external");
                       setError("");
                    }}
                    className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-md transition-all ${participantType === "external" ? "bg-[#f5a623] text-[#1a365d] shadow" : "text-gray-500 hover:text-[#f5a623]"
                      }`}
                  >
                    Other College
                  </button>
                </div>
              </div>

              {((participantType === "internal" && portalSettings?.internalRegistrationsOpen === false) ||
                (participantType === "external" && portalSettings?.externalRegistrationsOpen === false)) ? (
                <div className="bg-red-50 border border-red-200 text-red-600 p-6 rounded-md text-center">
                  <p className="font-bold text-lg mb-2">Registrations Closed 🔒</p>
                  <p className="text-sm">
                    {participantType === "internal" 
                      ? "Registration for Amity students is not open at this time." 
                      : "Registration for external participants is not open at this time."}
                  </p>
                  <div className="mt-4">
                    <Button variant="outline" type="button" onClick={() => router.push("/")}>Return Home</Button>
                  </div>
                </div>
              ) : (
                <>
                  <Input
                    label={participantType === "internal" ? "Enrollment Number" : "Email Address"}
                placeholder={participantType === "internal" ? "e.g. A81234xxxxxx" : "e.g. abc@gmail.com"}
                value={enrollmentNo}
                onChange={(e) => setEnrollmentNo(e.target.value)}
                required
              />
              <Input
                label="Create Password"
                type="password"
                placeholder="Min. 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <div className="pt-4 flex flex-col sm:flex-row gap-3">
                <Button variant="outline" type="button" onClick={() => router.push("/auth")} fullWidth>Back</Button>
                <Button type="submit" fullWidth disabled={loading}>Next</Button>
              </div>
              </>
            )}
            </form>
          )}

          {step === 2 && (
            <form onSubmit={handleStep2} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input label="First Name" placeholder="John" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
                <Input label="Last Name" placeholder="Doe" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
              </div>

              {participantType === "external" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input label="College / University" placeholder="e.g. IIT Delhi" value={collegeName} onChange={(e) => setCollegeName(e.target.value)} required />
                  <Input label="City" placeholder="e.g. New Delhi" value={city} onChange={(e) => setCity(e.target.value)} required />
                </div>
              )}

              {participantType === "internal" && (
                <div className="space-y-4">
                  <Input label="Email" type="email" placeholder="john.doe@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input label="Academic Domain" placeholder="e.g. Engineering" value={domain} onChange={(e) => setDomain(e.target.value)} required />
                <Input label="Selected Course" placeholder="e.g. B.Tech/BE" value={course} onChange={(e) => setCourse(e.target.value)} required />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input label="Specialization" placeholder="e.g. CSE, AI&ML, Data Science" value={specialization} onChange={(e) => setSpecialization(e.target.value)} required />
                <div>
                  <label className="text-[#1a365d] text-sm font-bold tracking-tight mb-2 block font-outfit uppercase">Year of Study</label>
                  <select
                    value={yearOfStudy}
                    onChange={(e) => setYearOfStudy(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-md py-3 px-4 text-sm font-bold text-[#1a365d] focus:border-[#f5a623] outline-none appearance-none"
                  >
                    <option value="1st Year">1st Year</option>
                    <option value="2nd Year">2nd Year</option>
                    <option value="3rd Year">3rd Year</option>
                    <option value="4th Year">4th Year</option>
                    <option value="Post Graduate">Post Graduate</option>
                  </select>
                </div>
              </div>

              <Input label="Mobile" placeholder="+91 XXXXX XXXXX" value={mobile} onChange={(e) => setMobile(e.target.value)} required />

              <div>
                <label className="text-[#1a365d] text-sm font-bold tracking-tight mb-2 block">Gender</label>
                <div className="flex flex-wrap gap-2">
                  {["Female", "Male", "Other"].map(g => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setGender(g)}
                      className={`px-4 py-2 rounded-md border text-xs font-bold transition-all ${gender === g ? "bg-[#1a365d] border-[#1a365d] text-white" : "border-gray-200 text-gray-500 hover:border-[#f5a623]"
                        }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-4 flex flex-col sm:flex-row gap-3">
                <Button variant="outline" type="button" onClick={() => setStep(1)} fullWidth>Back</Button>
                <Button type="submit" fullWidth>Next</Button>
              </div>
            </form>
          )}

          {step === 3 && (
            <form onSubmit={submitRegistration} className="space-y-4">
              <Input label="Team Name" placeholder="The Hackers" value={teamName} onChange={(e) => setTeamName(e.target.value)} required />

              <div>
                <label className="text-[#1a365d] text-sm font-bold tracking-tight mb-2 block">Invite Members (0-3)</label>
                {members.map((m, idx) => (
                  <div key={idx} className="mb-2">
                    <Input
                      placeholder={participantType === "internal" ? `Member ${idx + 1} Enrollment No.` : `Member ${idx + 1} Email Address`}
                      value={m}
                      onChange={(e) => {
                        const newM = [...members];
                        newM[idx] = e.target.value;
                        setMembers(newM);
                      }}
                    />
                  </div>
                ))}
                {members.length < 3 && (
                  <button
                    type="button"
                    onClick={() => setMembers([...members, ""])}
                    className="text-[#f5a623] text-xs font-bold hover:underline"
                  >
                    + Add member
                  </button>
                )}
              </div>

              {/* Payment Gate — External participants only */}
              {participantType === "external" && (
                <div className="mt-2 rounded-xl border-2 overflow-hidden" style={{ borderColor: hasPaid ? '#22c55e' : '#e5e7eb' }}>
                  {/* Header */}
                  <div className="px-4 py-3 flex items-center justify-between" style={{ background: hasPaid ? 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)' : 'linear-gradient(135deg, #1a365d 0%, #2d4a7a 100%)' }}>
                    <div className="flex items-center gap-2">
                      {hasPaid ? (
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      ) : (
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                      )}
                      <span className="text-white text-xs font-black uppercase tracking-widest">
                        {hasPaid ? "Payment Complete" : "Registration Fee"}
                      </span>
                    </div>
                    {hasPaid && (
                      <span className="text-white/80 text-[10px] font-mono">{paymentId}</span>
                    )}
                  </div>

                  {/* Body */}
                  <div className="p-4 bg-white">
                    {hasPaid ? (
                      <div className="text-center py-2">
                        <div className="inline-flex items-center gap-2 bg-green-50 border border-green-200 rounded-full px-4 py-2">
                          <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                          <span className="text-green-700 text-xs font-bold">₹500 paid successfully</span>
                        </div>
                        <p className="text-gray-400 text-[10px] mt-2">You can now complete your registration</p>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between mb-3 pb-3 border-b border-dashed border-gray-200">
                          <span className="text-gray-500 text-xs">Team Registration Fee</span>
                          <span className="text-[#1a365d] text-sm font-black">₹1000.00</span>
                        </div>
                        <div className="flex items-center justify-between mb-4">
                          <span className="text-gray-500 text-xs">Covers entire team (up to 4 members)</span>
                          <span className="text-gray-400 text-[10px] uppercase tracking-wider">One-time</span>
                        </div>
                        <button
                          type="button"
                          onClick={handlePayment}
                          disabled={paymentProcessing}
                          className="w-full py-3 rounded-lg text-white text-xs font-black uppercase tracking-widest transition-all hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
                          style={{ background: 'linear-gradient(135deg, #f5a623 0%, #e09400 100%)' }}
                        >
                          {paymentProcessing ? (
                            <span className="flex items-center justify-center gap-2">
                              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                              Processing...
                            </span>
                          ) : (
                            <span className="flex items-center justify-center gap-2">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                              Pay ₹500 Registration Fee
                            </span>
                          )}
                        </button>
                        <p className="text-center text-gray-400 text-[10px] mt-2 flex items-center justify-center gap-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                          Secured by Razorpay
                        </p>
                      </>
                    )}
                  </div>
                </div>
              )}

              <div className="pt-4 flex flex-col sm:flex-row gap-3">
                <Button variant="outline" type="button" onClick={() => setStep(2)} fullWidth disabled={loading}>Back</Button>
                <Button type="submit" fullWidth disabled={loading || (participantType === "external" && !hasPaid)}>
                  {loading ? "Registering..." : "Finish Registration"}
                </Button>
              </div>

              {/* Hint when payment not done */}
              {participantType === "external" && !hasPaid && (
                <p className="text-center text-amber-600 text-[10px] font-bold animate-pulse">
                  ⚠ Please complete the payment above to enable registration
                </p>
              )}
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}
