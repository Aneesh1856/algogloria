"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import { doc, getDoc, collection, getDocs, updateDoc, serverTimestamp, onSnapshot } from "firebase/firestore";
import { getServerTime } from "./actions";
import { GlassCard as Card } from "@/components/GlassCard";
import { Button } from "@/components/Button";
import Link from "next/link";

interface Problem {
  id: string;
  title: string;
  description: string;
}

interface Team {
  id: string;
  team_name: string;
  leader_id: string;
  problem_statement_id: string | null;
  isLocked: boolean;
  competition_phase?: string;
  isExternalEligible?: boolean;
  isVerified?: boolean;
  members: string[];
}

export default function LockinPage() {
  const router = useRouter();
  const { user, appUser, loading } = useAuth();
  
  const [team, setTeam] = useState<Team | null>(null);
  const [problems, setProblems] = useState<Problem[]>([]);
  
  const [selectedPsId, setSelectedPsId] = useState("");
  const [verifyId, setVerifyId] = useState("");
  
  const [isLive, setIsLive] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [portalSettings, setPortalSettings] = useState({
    internalStatementsReleased: false,
    externalStatementsReleased: false
  });

  const LOCKIN_START_TIME = new Date("2026-04-16T10:00:00+05:30").getTime();

  useEffect(() => {
    if (loading) return;
    if (!user || !appUser) {
      router.push("/auth");
      return;
    }
    if (appUser.role === "admin") router.push("/admin");
    else if (appUser.role === "evaluator") router.push("/evaluator");
    else {
      initProblems();
      
      const unsubSettings = onSnapshot(doc(db, "settings", "portal"), (snap) => {
        if (snap.exists()) {
          setPortalSettings(snap.data() as any);
        }
      });
      
      if (appUser.team_id) {
        const unsub = onSnapshot(doc(db, "teams", appUser.team_id), (docSnap) => {
          if (docSnap.exists()) {
            const tData = { id: docSnap.id, ...docSnap.data() } as Team;

            // Guard: only block external teams that haven't been verified yet.
            // ALL internal teams (with or without competition_phase set) can access lock-in.
            const isUnverifiedExternal =
              tData.competition_phase === "external" && !tData.isVerified;
            if (isUnverifiedExternal) {
              router.push("/dashboard");
              return;
            }

            setTeam(tData);
            if (tData.problem_statement_id && !selectedPsId) {
              setSelectedPsId(tData.problem_statement_id);
              setVerifyId(tData.problem_statement_id);
            }
          }
          setFetching(false);
        });
        return () => unsub();
      }
    }
  }, [loading, user, appUser]);

  const initProblems = async () => {
    try {
      const psSnap = await getDocs(collection(db, "problems"));
      const psList = psSnap.docs.map((d: any) => ({
        id: d.id,
        title: d.data().title,
        description: d.data().description,
      })) as Problem[];
      setProblems(psList);
      


      const serverTimeInfo = await getServerTime();
      if (serverTimeInfo >= LOCKIN_START_TIME) {
        setIsLive(true);
      } else {
        setIsLive(true); 
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleFinalConsolidation = async () => {
    setError("");
    if (!team) return setError("No team found.");
    if (appUser?.enrollment_no !== team.leader_id) return setError("Only the leader can lock the problem statement.");
    if (!selectedPsId) return setError("Select a problem statement first.");
    if (verifyId.trim().toUpperCase() !== selectedPsId.toUpperCase()) return setError("Verification ID does not match the selected ID.");

    if ((team.members || []).length < 1) {
      return setError("Team formation Protocol Failure: Minimum of 2 members required (1 Leader + at least 1 Member) to authorize consolidation. Please enlist an operative in the dashboard.");
    }

    setSubmitting(true);
    try {
      const teamRef = doc(db, "teams", team.id);
      await updateDoc(teamRef, {
        problem_statement_id: selectedPsId,
        isLocked: true,
        locked_at: serverTimestamp()
      });
      setTeam({ ...team, isLocked: true, problem_statement_id: selectedPsId });
    } catch (err: any) {
      setError("Failed to lock choices. " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (fetching || loading) return <div className="min-h-screen bg-[#f4f7f6] flex items-center justify-center">
     <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1a365d]"></div>
  </div>;

  if (!team) return <div className="min-h-screen bg-[#f4f7f6] p-12 text-center font-bold text-[#1a365d]">
    <Card className="max-w-md mx-auto">
        <p>You must create a team first before accessing the lock-in portal.</p>
        <Link href="/dashboard" className="text-[#f5a623] hover:underline mt-4 block">Return to Dashboard</Link>
    </Card>
  </div>;

  const isLeader = appUser?.enrollment_no === team.leader_id;
  const isFormReadOnly = team.isLocked || !isLeader;

  return (
    <div className="min-h-screen bg-[#f4f7f6] pb-12 w-full max-w-full overflow-hidden">
      <div className="max-w-4xl mx-auto pt-8 px-4 sm:px-6 w-full">
        
        {/* Breadcrumb */}
        <div className="mb-6">
             <Link href="/dashboard" className="text-[#1a365d] text-xs font-bold flex items-center hover:underline uppercase tracking-widest">
                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to Dashboard / <span className="text-gray-400 ml-1">Lock-In Portal</span>
             </Link>
        </div>

        {/* Main Card */}
        <div className="bg-[#1a365d] rounded-t-lg p-4 sm:p-8 text-white shadow-md relative overflow-hidden">
            <div className="relative z-10">
                <div className="flex items-center space-x-3 mb-2">
                    <div className="bg-[#f5a623] p-1.5 rounded-sm">
                        <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                        </svg>
                    </div>
                    <h2 className="text-xl sm:text-2xl font-black uppercase tracking-[0.2em] break-words">Problem Statement Lock-In</h2>
                </div>
                <p className="text-xs text-blue-200 uppercase tracking-widest font-bold opacity-80">
                    {team.isLocked ? "Submission Finalized" : "Selections Live - Final Consolidation Required"}
                </p>
            </div>
            {/* Background pattern */}
            <div className="absolute right-0 top-0 h-full w-1/3 opacity-10 pointer-events-none">
                 <svg className="h-full w-full" fill="currentColor" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <polygon points="0,0 100,0 100,100" />
                 </svg>
            </div>
        </div>

        <div className="bg-white border-x border-b border-gray-100 p-4 sm:p-8 shadow-sm">
            
            {error && (
                <div className="mb-8 p-4 bg-red-50 border-l-4 border-red-500 flex items-center space-x-3">
                    <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    <p className="text-xs font-bold text-red-700 uppercase tracking-wider">{error}</p>
                </div>
            )}

            <div className="space-y-10">
                {/* PS Select — gated by admin visibility toggle based on team phase */}
                <div>
                    <label className="text-[#1a365d] text-xs font-black uppercase tracking-widest mb-3 block">
                        Problem Statement Selection
                    </label>

                    {((team?.competition_phase === "external" && !portalSettings.externalStatementsReleased) || 
                       (team?.competition_phase !== "external" && !portalSettings.internalStatementsReleased)) ? (
                      <div className="flex flex-col items-center justify-center py-12 px-6 bg-[#f4f7f6] border-2 border-dashed border-[#1a365d]/20 rounded-md text-center gap-4">
                        <div className="bg-[#1a365d] p-3 rounded-full">
                          <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-sm font-black text-[#1a365d] uppercase tracking-widest">Problem Statements Not Released Yet</p>
                          <p className="text-xs text-gray-400 mt-1">The organising committee will release problem statements at a specific time. Please check back later.</p>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="relative">
                            <select
                                disabled={isFormReadOnly}
                                value={selectedPsId}
                                onChange={(e) => setSelectedPsId(e.target.value)}
                                className="w-full bg-[#f8fafb] border-2 border-gray-100 rounded-md py-4 px-6 text-sm font-bold text-[#1a365d] focus:border-[#f5a623] focus:ring-0 appearance-none transition-all outline-none"
                            >
                                <option disabled value="">SELECT FROM AVAILABLE STATEMENTS...</option>
                                {problems.map((ps) => (
                                    <option key={ps.id} value={ps.id}>
                                        {ps.id}: {ps.title}
                                    </option>
                                ))}
                            </select>
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </div>
                        </div>
                        {selectedPsId && (
                             <div className="mt-4 p-4 bg-gray-50 rounded-md border border-gray-100">
                                 <p className="text-[10px] uppercase font-black text-gray-400 tracking-widest mb-1">Brief Description</p>
                                 <p className="text-xs text-gray-600 leading-relaxed italic">
                                    {problems.find(p => p.id === selectedPsId)?.description}
                                 </p>
                             </div>
                        )}
                      </>
                    )}
                </div>

                {/* Verification */}
                <div>
                     <label className="text-[#1a365d] text-xs font-black uppercase tracking-widest mb-3 block">
                        Confirm Selection (Type ID)
                    </label>
                    <input 
                        type="text"
                        disabled={isFormReadOnly}
                        value={verifyId}
                        onChange={(e) => setVerifyId(e.target.value)}
                        placeholder="TYPE PS ID HERE..."
                        className="w-full bg-[#f8fafb] border-2 border-gray-100 rounded-md py-4 px-6 text-base font-black text-[#1a365d] text-center tracking-[0.3em] focus:border-[#f5a623] focus:ring-0 transition-all outline-none placeholder:text-gray-200"
                    />
                </div>

                {/* Warning / Status */}
                {team.isLocked ? (
                    <div className="bg-[#f0f9ff] border border-blue-100 p-6 rounded-md text-center">
                         <div className="bg-blue-500 w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-3 shadow-[0_0_15px_rgba(59,130,246,0.3)]">
                            <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                         </div>
                         <h3 className="text-sm font-black text-[#1a365d] uppercase tracking-widest">Selection Finalized</h3>
                         <p className="text-[10px] text-gray-500 mt-1 uppercase tracking-wider">Your choice has been securely locked into the system.</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        <div className="bg-[#fff4f4] border border-red-100 p-4 flex items-start space-x-3 rounded-md">
                            <div className="bg-red-500 p-1 rounded-full flex-shrink-0 mt-0.5">
                                 <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1-1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                 </svg>
                            </div>
                            <div>
                                <h4 className="text-[10px] font-black text-red-700 uppercase tracking-widest">Permanent Action Warning</h4>
                                <p className="text-[10px] text-red-600/70 mt-1 leading-relaxed">
                                    Final consolidation will lock your choice permanently. You will not be able to modify your problem statement after this point.
                                </p>
                            </div>
                        </div>

                        {isLeader ? (
                             <Button 
                                onClick={handleFinalConsolidation}
                                disabled={submitting}
                                fullWidth
                             >
                                {submitting ? "Processing..." : "Final Consolidation"}
                             </Button>
                        ) : (
                            <div className="text-center p-4 bg-gray-50 rounded-md border border-dashed border-gray-200">
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">Waiting for Team Leader to consolidate</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>

        <div className="mt-8 text-center">
             <Link href="/dashboard" className="text-gray-400 text-[10px] font-black uppercase tracking-[0.3em] hover:text-[#1a365d] transition-colors">
                &larr; Return to Team Dashboard
             </Link>
        </div>
      </div>
    </div>
  );
}
