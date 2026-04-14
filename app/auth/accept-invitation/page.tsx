"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import { hashPassword } from "@/lib/authUtils";
import { doc, getDoc, updateDoc, deleteDoc, arrayRemove, getDocs, collection, query, where } from "firebase/firestore";
import { GlassCard as Card } from "@/components/GlassCard";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";

function InvitationForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const enrollmentId = searchParams.get("id");
    const { login } = useAuth();

    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(true);
    const [error, setError] = useState("");
    const [userData, setUserData] = useState<any>(null);

    // Form States
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [email, setEmail] = useState("");
    const [mobile, setMobile] = useState("");
    const [gender, setGender] = useState("Male");
    const [domain, setDomain] = useState("Engineering");
    const [course, setCourse] = useState("B.Tech/BE");
    const [specialization, setSpecialization] = useState("Computer Science and Engineering");
    const [password, setPassword] = useState("");

    useEffect(() => {
        if (!enrollmentId) {
            router.push("/auth");
            return;
        }

        const fetchInvitedUser = async () => {
            try {
                const userDoc = await getDoc(doc(db, "users", enrollmentId));
                if (userDoc.exists()) {
                    const data = userDoc.data();
                    if (!(data.isInvited || data.role === "evaluator") || data.isPasswordSet) {
                        router.push("/auth");
                        return;
                    }
                    setUserData(data);
                    setFirstName(data.firstName || "");
                    setLastName(data.lastName || "");
                } else {
                    router.push("/auth");
                }
            } catch (err) {
                setError("System link failure.");
            } finally {
                setFetching(false);
            }
        };

        fetchInvitedUser();
    }, [enrollmentId, router]);

    const handleAccept = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            const hashedPassword = await hashPassword(password);
            
            await updateDoc(doc(db, "users", enrollmentId!), {
                firstName,
                lastName,
                email,
                mobile,
                gender,
                domain,
                course,
                specialization,
                password_hash: hashedPassword,
                isPasswordSet: true,
                isInvited: false, // Now a full member
                activatedAt: new Date().toISOString()
            });

            await login(enrollmentId!);
            router.push("/dashboard");
        } catch (err: any) {
            setError("Synchronization failed: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDecline = async () => {
        if (!confirm("Are you sure you want to decline this invitation? You will be removed from the team.")) return;
        setLoading(true);
        try {
            // Remove from team's members array
            if (userData?.team_id) {
                await updateDoc(doc(db, "teams", userData.team_id), {
                    members: arrayRemove(enrollmentId)
                });
            }
            // Delete user doc
            await deleteDoc(doc(db, "users", enrollmentId!));
            router.push("/auth");
        } catch (err) {
            setError("System rejection failed.");
            setLoading(false);
        }
    };

    if (fetching) return (
        <div className="min-h-screen bg-[#e0e0e0] flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-[#002D62]"></div>
        </div>
    );

    return (
        <div className="min-h-[calc(100vh-80px)] bg-[#e0e0e0] flex flex-col items-center justify-center py-6 px-4 sm:p-6 w-full max-w-full overflow-hidden">
            <div className="w-full max-w-lg">
                <Card className="!p-0 border-none shadow-2xl">
                    <div className="bg-[#002D62] p-8 text-center relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-[#FFC300]"></div>
                        <h1 className="text-2xl font-bold text-white uppercase tracking-widest mb-1">
                            Account Activation
                        </h1>
                        <p className="text-[#FFC300] text-[10px] font-black uppercase tracking-widest">
                            Personnel Invitation Verified: {enrollmentId}
                        </p>
                    </div>

                    <div className="p-4 sm:p-6 md:p-10 bg-white">
                        {error && (
                            <div className="bg-[#f8d7da] border-l-4 border-[#721c24] text-[#721c24] p-4 mb-8 text-[10px] font-bold uppercase tracking-wider">
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleAccept} className="space-y-6">
                            {userData?.role !== "evaluator" && (
                                <>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <Input 
                                            label="First Name"
                                            placeholder="Enter First Name"
                                            value={firstName}
                                            onChange={e => setFirstName(e.target.value)}
                                            required
                                        />
                                        <Input 
                                            label="Last Name"
                                            placeholder="Enter Last Name"
                                            value={lastName}
                                            onChange={e => setLastName(e.target.value)}
                                            required
                                        />
                                    </div>

                                    <Input 
                                        label="Contact Email"
                                        type="email"
                                        placeholder="name@example.com"
                                        value={email}
                                        onChange={e => setEmail(e.target.value)}
                                        required
                                    />

                                    <Input 
                                        label="Mobile Number"
                                        placeholder="+91 XXXXX XXXXX"
                                        value={mobile}
                                        onChange={e => setMobile(e.target.value)}
                                        required
                                    />

                                    <div>
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 block">Gender Identification</label>
                                        <div className="flex flex-wrap gap-2">
                                            {["Female", "Male", "Other"].map(g => (
                                                <button
                                                    key={g}
                                                    type="button"
                                                    onClick={() => setGender(g)}
                                                    className={`px-4 py-2 rounded-md border text-[10px] font-black uppercase transition-all ${
                                                        gender === g 
                                                        ? "bg-[#002D62] border-[#002D62] text-white" 
                                                        : "bg-[#f8f9fa] border-[#e9ecef] text-gray-500 hover:border-[#FFC300]"
                                                    }`}
                                                >
                                                    {g}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Educational fields hidden for all members as per request #8 */}
                                </>
                            )}

                            {userData?.role === "evaluator" && (
                                <div className="p-6 bg-blue-50 border-l-4 border-blue-600 mb-6">
                                    <p className="text-xs font-bold text-[#002D62] uppercase tracking-wide mb-1">Authenticated Evaluator</p>
                                    <p className="text-sm font-black text-blue-800">{firstName} {lastName}</p>
                                </div>
                            )}

                            <Input 
                                label={userData?.role === "evaluator" ? "Set Security Password" : "Create Security Password"}
                                type="password"
                                placeholder="Min. 6 characters"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                required
                            />

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-6">
                                <Button 
                                    variant="outline"
                                    type="button"
                                    onClick={handleDecline}
                                    disabled={loading}
                                >
                                    Decline
                                </Button>
                                <Button 
                                    type="submit"
                                    disabled={loading}
                                >
                                    {loading ? "Activating..." : "Confirm & Enter"}
                                </Button>
                            </div>
                        </form>
                    </div>
                </Card>
            </div>
        </div>
    );
}

export default function AcceptInvitationPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-[#0d1117]"></div>}>
            <InvitationForm />
        </Suspense>
    );
}
