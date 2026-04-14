"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GlassCard as Card } from "@/components/GlassCard";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import { hashPassword } from "@/lib/authUtils";
import { doc, getDoc } from "firebase/firestore";

export default function AuthPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState(1); // 1: ID, 2: Password, 3: 2FA
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [tempUserDoc, setTempUserDoc] = useState<any>(null);

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");

  const handleNext = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const normalizedId = identifier.trim().toUpperCase();
    if (!normalizedId) return;

    setLoading(true);
    try {
      const userDoc = await getDoc(doc(db, "users", normalizedId));

      if (userDoc.exists()) {
        const userData = userDoc.data();

        // Check if user is invited or an unactivated judge
        if ((userData.isInvited || userData.role === "evaluator") && !userData.isPasswordSet) {
          router.push(`/auth/accept-invitation?id=${normalizedId}`);
          return;
        }

        // If password is set, proceed to step 2
        if (userData.isPasswordSet) {
          setStep(2);
        } else {
          setError("Account is awaiting activation. Please consult system administrator.");
        }
      } else {
        setError("User identification not found in system.");
      }
    } catch (err: any) {
      setError("System verification failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const normalizedId = identifier.trim().toUpperCase();
      const userDoc = await getDoc(doc(db, "users", normalizedId));

      if (userDoc.exists()) {
        const userData = userDoc.data();
        const hashedPassword = await hashPassword(password);

        if (userData.password_hash === hashedPassword) {
          if (userData.twoFactorEnabled) {
            setTempUserDoc(userData);
            setStep(3);
            setLoading(false);
            return;
          }

          await login(normalizedId);

          // Automatic redirection based on Firestore role
          if (userData.role === "admin") router.push("/admin");
          else if (userData.role === "evaluator") router.push("/evaluator");
          else router.push("/dashboard");

        } else {
          setError("Invalid security credentials.");
        }
      } else {
        setError("User identification not found in system.");
      }
    } catch (err: any) {
      setError("Login failed. Check server connectivity.");
    } finally {
      setLoading(false);
    }
  };

  const handle2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const OTPAuth = await import("otpauth");
      const normalizedId = identifier.trim().toUpperCase();
      
      const totp = new OTPAuth.TOTP({
        issuer: "AiGloria Hackathon",
        label: normalizedId,
        algorithm: "SHA1",
        digits: 6,
        period: 30,
        secret: OTPAuth.Secret.fromBase32(tempUserDoc.twoFactorSecret)
      });
      
      const delta = totp.validate({ token: twoFactorCode, window: 1 });

      if (delta !== null) {
        await login(normalizedId);
        if (tempUserDoc.role === "admin") router.push("/admin");
        else if (tempUserDoc.role === "evaluator") router.push("/evaluator");
        else router.push("/dashboard");
      } else {
        setError("Invalid security code.");
        setTwoFactorCode("");
      }
    } catch (err: any) {
      setError("Multi-factor verification failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-80px)] flex flex-col items-center justify-center py-6 px-4 sm:p-6 w-full max-w-full overflow-hidden bg-[#e0e0e0]">
      <div className="w-full max-w-lg">

        <Card className="!p-0">
          <div className="p-4 sm:p-6 md:p-10">
            {error && (
              <div className="bg-[#f8d7da] border-l-4 border-[#721c24] text-[#721c24] p-4 mb-8 text-xs font-bold uppercase tracking-wider">
                {error}
              </div>
            )}

            {step === 1 ? (
              <form onSubmit={handleNext} className="space-y-6">
                <Input
                  label="LOGIN ID"
                  placeholder="E.G. ADM001 OR 21001 OR abc@gmail.com"
                  value={identifier}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setIdentifier(e.target.value)}
                  disabled={loading}
                  required
                  icon={
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                    </svg>
                  }
                />
                <div className="pt-4">
                  <Button type="submit" fullWidth disabled={loading}>
                    {loading ? "Verifying..." : "Continue"}
                  </Button>
                </div>
              </form>
            ) : step === 2 ? (
              <form onSubmit={handleLogin} className="space-y-6">
                <div className="mb-6 pb-6 border-b border-[#e9ecef]">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Authenticated ID</p>
                  <p className="text-xl font-bold text-[#002D62] tracking-tight truncate">{identifier.toUpperCase()}</p>
                  <button
                    type="button"
                    onClick={() => { setStep(1); setPassword(""); }}
                    className="text-[10px] font-black text-amber-500 uppercase tracking-widest hover:text-[#002D62] transition-colors mt-2"
                  >
                    Use different ID
                  </button>
                </div>

                <Input
                  label="PASSWORD"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                  disabled={loading}
                  autoFocus
                  required
                  icon={
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                    </svg>
                  }
                />

                <div className="pt-4">
                  <Button type="submit" fullWidth disabled={loading}>
                    {loading ? "Verifying..." : "Initialize Session"}
                  </Button>
                </div>
              </form>
            ) : (
              <form onSubmit={handle2FA} className="space-y-6">
                <div className="mb-6 pb-6 border-b border-[#e9ecef]">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Identity Protocol</p>
                  <p className="text-xl font-bold text-[#002D62] tracking-tight truncate">MULTI-FACTOR CHALLENGE</p>
                  <p className="text-[10px] text-gray-400 mt-2 leading-relaxed uppercase">Enter the 6-digit code from your authenticator app to authorize this session.</p>
                </div>

                <Input
                  label="6-DIGIT SECURITY CODE"
                  placeholder="000 000"
                  value={twoFactorCode}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTwoFactorCode(e.target.value)}
                  disabled={loading}
                  autoFocus
                  required
                  className="!text-center !text-2xl !tracking-[0.5em] !font-mono"
                  maxLength={6}
                />

                <div className="pt-4">
                  <Button type="submit" fullWidth disabled={loading}>
                    {loading ? "Authorizing..." : "Verify & Enter"}
                  </Button>
                  <button
                    type="button"
                    onClick={() => { setStep(2); setTwoFactorCode(""); }}
                    className="w-full text-[10px] font-black text-gray-400 uppercase tracking-widest hover:text-[#002D62] transition-colors mt-6"
                  >
                    Back to Password
                  </button>
                </div>
              </form>
            )}

            <div className="mt-10 text-center pt-8 border-t border-[#e9ecef]">
              <button
                onClick={() => router.push("/auth/register")}
                className="mt-2 text-[#002D62] hover:text-[#FFC300] text-[10px] font-black uppercase tracking-widest transition-colors"
              >
                New Team Registration
              </button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
