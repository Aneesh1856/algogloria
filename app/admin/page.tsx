"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import {
  collection,
  query,
  onSnapshot,
  doc,
  getDocs,
  deleteDoc,
  setDoc,
  updateDoc,
  where,
  writeBatch
} from "firebase/firestore";
import { GlassCard as Card } from "@/components/GlassCard";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { hashPassword } from "@/lib/authUtils";
import { migrateToExternal } from "@/lib/migrateToExternal";

interface Team {
  id: string;
  team_name: string;
  leader_id: string;
  members: string[];
  problem_statement_id: string | null;
  isLocked: boolean;
  competition_phase?: string;
  isExternalEligible?: boolean;
  isVerified?: boolean;
  scores?: {
    innovation: number;
    tech: number;
    pitch: number;
    total: number;
    judgeCount: number;
  };
  internal_scores_snapshot?: {
    avg_innovation: number;
    avg_tech: number;
    avg_pitch: number;
    avg_total: number;
    judge_count: number;
    archived_at: string;
  };
  promoted_at?: string;
}

interface Judge {
  enrollment_no: string;
  name?: string;
  firstName?: string;
  lastName?: string;
}

interface Problem {
  id: string;
  title: string;
  description?: string;
}

interface Evaluation {
  id: string;
  team_id: string;
  judge_id: string;
  round_id?: string;               // Optional for migration compatibility
  criteria_scores?: Record<string, number>; // New dynamic scores
  score_innovation?: number;       // Legacy field
  score_tech?: number;             // Legacy field
  score_pitch?: number;            // Legacy field
  total_score: number;
}

interface EvaluationRound {
  id: string;
  name: string;
  weight: number;
}

interface EvaluationCriterion {
  id: string;
  name: string;
  maxPoints: number;
}

interface EvaluationSettings {
  rounds: EvaluationRound[];
  criteria: EvaluationCriterion[];
}

interface PortalSettings {
  eventSchedule: string;
  zoneOperations: string;
  eventScheduleLabel: string;
  zoneOperationsLabel: string;
  targetDate: string;
  internalStatementsReleased?: boolean;
  externalStatementsReleased?: boolean;
  internalRegistrationsOpen?: boolean;
  externalRegistrationsOpen?: boolean;
}

export default function AdminPage() {
  const router = useRouter();
  const { user, appUser, loading, refreshUser } = useAuth();

  const [rawTeams, setRawTeams] = useState<Team[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [judges, setJudges] = useState<Judge[]>([]);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [rawEvaluations, setRawEvaluations] = useState<Evaluation[]>([]);
  const [activeTab, setActiveTab] = useState("teams");
  const [teamsFilter, setTeamsFilter] = useState<"all" | "inhouse" | "external">("all");
  const [fetching, setFetching] = useState(true);
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);

  // Form states
  const [newJudge, setNewJudge] = useState({ id: "", firstName: "", lastName: "" });
  const [newProblem, setNewProblem] = useState({ id: "", title: "", description: "" });
  const [resetUser, setResetUser] = useState({ id: "" });
  const [actionLoading, setActionLoading] = useState(false);
  const [portalSettings, setPortalSettings] = useState<PortalSettings>({
    eventSchedule: "Phase 01: April 16th\nFinals: April 17th",
    zoneOperations: "Amity Main Campus\nAuditorium Block",
    eventScheduleLabel: "Event Schedule",
    zoneOperationsLabel: "Zone Operations",
    targetDate: "2026-04-16T09:00:00",
    internalStatementsReleased: false,
    externalStatementsReleased: false,
    internalRegistrationsOpen: true,
    externalRegistrationsOpen: true,
  });
  const [evalSettings, setEvalSettings] = useState<EvaluationSettings>({
    rounds: [
      { id: "round1", name: "Preliminary Round", weight: 0.5 },
      { id: "finals", name: "Grand Finals", weight: 1.0 }
    ],
    criteria: [
      { id: "innovation", name: "Innovation", maxPoints: 10 },
      { id: "tech", name: "Technical Execution", maxPoints: 10 },
      { id: "pitch", name: "Presentation/Pitch", maxPoints: 10 }
    ]
  });
  const [adminPassUpdate, setAdminPassUpdate] = useState({ newPass: "", confirmPass: "" });
  const [is2FASetupMode, setIs2FASetupMode] = useState(false);
  const [twoFactorSecret, setTwoFactorSecret] = useState("");
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const [twoFactorToken, setTwoFactorToken] = useState("");

  useEffect(() => {
    if (!loading) {
      if (!user || appUser?.role !== "admin") {
        router.push("/auth");
        return;
      }
      
      const unsub = loadAdminData();
      return () => unsub();
    }
  }, [loading, user, appUser]);

  // Scoring Engine: Recalculate everything when raw data or settings change
  useEffect(() => {
    if (rawTeams.length === 0) {
      setTeams([]);
      return;
    }

    const processed = rawTeams.map(team => {
      const teamEvs = rawEvaluations.filter(ev => ev.team_id === team.id);
      
      if (teamEvs.length === 0) {
        return { ...team, scores: undefined };
      }

      // 1. Group evaluations by round for weighted total
      const roundsMap: Record<string, Evaluation[]> = {};
      teamEvs.forEach(ev => {
        const rId = ev.round_id || "legacy";
        if (!roundsMap[rId]) roundsMap[rId] = [];
        roundsMap[rId].push(ev);
      });

      let weightedTotal = 0;
      let roundsFound = 0;

      evalSettings.rounds.forEach(round => {
        const roundEvs = roundsMap[round.id] || [];
        if (roundEvs.length > 0) {
          const roundAvg = roundEvs.reduce((acc, ev) => acc + ev.total_score, 0) / roundEvs.length;
          weightedTotal += roundAvg * round.weight;
          roundsFound++;
        }
      });

      // Fallback for legacy data if no rounds match or if weightedTotal is still 0
      if (roundsFound === 0 && roundsMap["legacy"]) {
        weightedTotal = roundsMap["legacy"].reduce((acc, ev) => acc + ev.total_score, 0) / roundsMap["legacy"].length;
      }

      // 2. Aggregate scores per criterion for leaderboard
      const criteriaAvgs: Record<string, number> = {};
      evalSettings.criteria.forEach(cri => {
        let totalVal = 0;
        let count = 0;
        
        teamEvs.forEach(ev => {
          if (ev.criteria_scores && ev.criteria_scores[cri.id] !== undefined) {
             totalVal += ev.criteria_scores[cri.id];
             count++;
          } else if (cri.id === "innovation" && ev.score_innovation !== undefined) {
             totalVal += ev.score_innovation;
             count++;
          } else if (cri.id === "tech" && ev.score_tech !== undefined) {
             totalVal += ev.score_tech;
             count++;
          } else if (cri.id === "pitch" && ev.score_pitch !== undefined) {
             totalVal += ev.score_pitch;
             count++;
          }
        });
        
        criteriaAvgs[cri.id] = count > 0 ? totalVal / count : 0;
      });

      return {
        ...team,
        scores: {
          innovation: criteriaAvgs["innovation"] || 0,
          tech: criteriaAvgs["tech"] || 0,
          pitch: criteriaAvgs["pitch"] || 0,
          total: weightedTotal,
          judgeCount: teamEvs.length
        }
      };
    });

    setTeams(processed);
  }, [rawTeams, rawEvaluations, evalSettings]);

  const loadAdminData = () => {
    setFetching(true);

    const unsubscribeTeams = onSnapshot(query(collection(db, "teams")), (snapshot) => {
      setRawTeams(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Team)));
    });

    const unsubscribeEvs = onSnapshot(collection(db, "evaluations"), (snapshot) => {
       setRawEvaluations(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Evaluation)));
    });

    // Real-time listener for evaluation settings
    const unsubscribeEvalSettings = onSnapshot(doc(db, "settings", "evaluation"), (docSnap) => {
      if (docSnap.exists()) {
        setEvalSettings(docSnap.data() as EvaluationSettings);
      }
    });

    // Real-time listener for judges
    const unsubscribeJudges = onSnapshot(query(collection(db, "users"), where("role", "==", "evaluator")), (snapshot) => {
      setJudges(snapshot.docs.map(d => d.data() as Judge));
    });

    // Real-time listener for problems
    const unsubscribeProblems = onSnapshot(query(collection(db, "problems")), (snapshot) => {
      setProblems(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Problem)));
    });

    setFetching(false);
    const unsubscribeSettings = onSnapshot(doc(db, "settings", "portal"), (docSnap) => {
      if (docSnap.exists()) {
        setPortalSettings(docSnap.data() as PortalSettings);
      }
    });

    return () => {
      unsubscribeTeams();
      unsubscribeJudges();
      unsubscribeProblems();
      unsubscribeSettings();
      unsubscribeEvalSettings();
    };
  };

  const addJudgeAccount = async () => {
    if (!newJudge.id || !newJudge.firstName) return;
    setActionLoading(true);
    try {
      await setDoc(doc(db, "users", newJudge.id.toUpperCase()), {
        enrollment_no: newJudge.id.toUpperCase(),
        firstName: newJudge.firstName,
        lastName: newJudge.lastName,
        role: "evaluator",
        isInvited: true,
        isPasswordSet: false
      });
      setNewJudge({ id: "", firstName: "", lastName: "" });
    } catch (err) { console.error(err); }
    setActionLoading(false);
  };

  const deleteJudge = async (id: string) => {
    if (!confirm("Are you sure?")) return;
    await deleteDoc(doc(db, "users", id));
  };

  const updatePortalSettings = async () => {
    setActionLoading(true);
    try {
      await setDoc(doc(db, "settings", "portal"), portalSettings);
      alert("Portal configuration synchronized successfully.");
    } catch (err) {
      console.error(err);
      alert("Failed to update portal settings.");
    }
    setActionLoading(false);
  };

  const handleDeleteTeam = async (team: Team) => {
    if (!confirm(`DANGER: This will permanently delete team "${team.team_name.toUpperCase()}" and all ${team.members.length} registered members, and all associated evaluations. Proceed?`)) return;

    setActionLoading(true);
    try {
      const batch = writeBatch(db);

      // 1. Target all users associated with this team_id and delete them
      const membersQuery = query(collection(db, "users"), where("team_id", "==", team.id));
      const membersSnap = await getDocs(membersQuery);
      membersSnap.docs.forEach(d => batch.delete(d.ref));

      // 2. Target all evaluations associated with this team_id and delete them
      const evaluationsQuery = query(collection(db, "evaluations"), where("team_id", "==", team.id));
      const evaluationsSnap = await getDocs(evaluationsQuery);
      evaluationsSnap.docs.forEach(d => batch.delete(d.ref));

      // 3. Target the team document and delete it
      batch.delete(doc(db, "teams", team.id));

      // 4. Execute atomic transaction
      await batch.commit();
    } catch (err) {
      console.error("Cascade deletion failure:", err);
      alert("System Error: Failed to purge team data nodes.");
    } finally {
      setActionLoading(false);
    }
  };

  const registerProblem = async () => {
    if (!newProblem.id || !newProblem.title) return;
    setActionLoading(true);
    try {
      await setDoc(doc(db, "problems", newProblem.id.toUpperCase()), {
        title: newProblem.title,
        description: newProblem.description
      });
      setNewProblem({ id: "", title: "", description: "" });
    } catch (err) { console.error(err); }
    setActionLoading(false);
  };

  const deleteProblem = async (id: string) => {
    if (!confirm("Are you sure?")) return;
    setActionLoading(true);
    try {
      await deleteDoc(doc(db, "problems", id));
    } catch (err) {
      console.error("Error deleting problem:", err);
    } finally {
      setActionLoading(false);
    }
  };

  const deleteEvaluation = async (evaluationId: string) => {
    if (!confirm("Are you sure you want to delete this evaluation record?")) return;
    setActionLoading(true);
    try {
      await deleteDoc(doc(db, "evaluations", evaluationId));
    } catch (err) {
      console.error("Error deleting evaluation:", err);
    } finally {
      setActionLoading(false);
    }
  };

  const clearAllScores = async () => {
    if (!confirm("This will permanently delete all evaluations. Proceed?")) return;
    setActionLoading(true);
    try {
      const snap = await getDocs(collection(db, "evaluations"));
      const batch = writeBatch(db);
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
    } catch (err) { console.error(err); }
    setActionLoading(false);
  };

  const cleanupOrphanedScores = async () => {
    if (!confirm("This will delete evaluation records that do not have a corresponding team. Proceed?")) return;
    setActionLoading(true);
    try {
      const allEvaluationsSnap = await getDocs(collection(db, "evaluations"));
      const allTeamsSnap = await getDocs(collection(db, "teams"));
      const existingTeamIds = new Set(allTeamsSnap.docs.map(d => d.id));

      const batch = writeBatch(db);
      let orphanedCount = 0;

      allEvaluationsSnap.docs.forEach(docSnapshot => {
        const evaluation = docSnapshot.data() as Evaluation;
        if (!existingTeamIds.has(evaluation.team_id)) {
          batch.delete(docSnapshot.ref);
          orphanedCount++;
        }
      });

      if (orphanedCount > 0) {
        await batch.commit();
        alert(`Successfully purged ${orphanedCount} orphaned evaluation records.`);
      } else {
        alert("No orphaned evaluation records found.");
      }
    } catch (err) {
      console.error("Error cleaning up orphaned scores:", err);
      alert("Failed to clean up orphaned scores. Check console for details.");
    } finally {
      setActionLoading(false);
    }
  };

  const toggleLock = async (teamId: string, currentState: boolean) => {
    setActionLoading(true);
    try {
      await updateDoc(doc(db, "teams", teamId), { isLocked: !currentState });
    } catch (err) { console.error(err); }
    setActionLoading(false);
  };

  const toggleVerify = async (teamId: string, currentState: boolean) => {
    setActionLoading(true);
    try {
      await updateDoc(doc(db, "teams", teamId), { isVerified: !currentState });
    } catch (err) { console.error(err); }
    setActionLoading(false);
  };

  const resetUserPassword = async () => {
    if (!resetUser.id.trim()) {
      return alert("Please enter the Target ID");
    }
    const normalizedId = resetUser.id.trim().toUpperCase();
    if (!confirm(`Are you sure you want to flag ${normalizedId} for a password reset? The user will be required to set a new password on their next login.`)) return;

    setActionLoading(true);
    try {
      await updateDoc(doc(db, "users", normalizedId), {
        isPasswordSet: false,
        isInvited: true
      });
      alert(`User ${normalizedId} has been successfully flagged for password reset.`);
      setResetUser({ id: "" });
    } catch (err: any) {
      console.error(err);
      alert("Failed to flag user. The ID may not exist. " + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const promoteToExternal = async (teamId: string) => {
    if (!confirm("Promote this In-House to the External Phase?")) return;
    setActionLoading(true);
    try {
      await migrateToExternal(teamId);
    } catch (err) {
      console.error("Failed to promote team:", err);
      alert("Failed to promote team to external phase.");
    } finally {
      setActionLoading(false);
    }
  };

  const forceLockAll = async () => {
    if (!confirm("Force lock selection for all teams?")) return;
    setActionLoading(true);
    try {
      const snap = await getDocs(collection(db, "teams"));
      const batch = writeBatch(db);
      snap.docs.forEach(d => batch.update(d.ref, { isLocked: true }));
      await batch.commit();
    } catch (err) { console.error(err); }
    setActionLoading(false);
  };

  const handleAdminPasswordChange = async () => {
    if (!adminPassUpdate.newPass || !adminPassUpdate.confirmPass) return;
    if (adminPassUpdate.newPass !== adminPassUpdate.confirmPass) {
      alert("Passwords do not match.");
      return;
    }
    if (adminPassUpdate.newPass.length < 6) {
      alert("Password must be at least 6 characters.");
      return;
    }
    if (!appUser?.enrollment_no) return;

    setActionLoading(true);
    try {
      const hashed = await hashPassword(adminPassUpdate.newPass);
      await updateDoc(doc(db, "users", appUser.enrollment_no), {
        password_hash: hashed,
        isPasswordSet: true
      });
      alert("Admin credentials updated successfully. Please use the new password for your next login.");
      setAdminPassUpdate({ newPass: "", confirmPass: "" });
    } catch (err) {
      console.error(err);
      alert("Failed to update security credentials.");
    } finally {
      setActionLoading(false);
    }
  };

  const start2FASetup = async () => {
    const OTPAuth = await import("otpauth");
    const qrcode = await import("qrcode");
    
    // Generate new random secret
    const secret = new OTPAuth.Secret({ size: 20 });
    const user = appUser?.enrollment_no || "Admin";
    
    const totp = new OTPAuth.TOTP({
      issuer: "AiGloria Hackathon",
      label: user,
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: secret
    });
    
    const url = await qrcode.toDataURL(totp.toString());
    setTwoFactorSecret(secret.base32);
    setQrCodeUrl(url);
    setIs2FASetupMode(true);
  };

  const verifyAndEnable2FA = async () => {
    const OTPAuth = await import("otpauth");
    
    const totp = new OTPAuth.TOTP({
      issuer: "AiGloria Hackathon",
      label: appUser?.enrollment_no || "Admin",
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(twoFactorSecret)
    });
    
    const delta = totp.validate({ token: twoFactorToken, window: 1 });
    
    if (delta !== null) {
      setActionLoading(true);
      try {
        await updateDoc(doc(db, "users", appUser!.enrollment_no), {
          twoFactorSecret: twoFactorSecret,
          twoFactorEnabled: true
        });
        alert("2FA Enabled Successfully!");
        setIs2FASetupMode(false);
        setTwoFactorToken("");
        refreshUser(); 
      } catch (err) {
        alert("Failed to save 2FA settings.");
      } finally {
        setActionLoading(false);
      }
    } else {
      alert("Invalid code. Please try again.");
    }
  };

  const disable2FA = async () => {
    if (!confirm("Are you sure you want to disable 2FA? This will reduce your account security.")) return;
    setActionLoading(true);
    try {
      await updateDoc(doc(db, "users", appUser!.enrollment_no), {
        twoFactorEnabled: false,
        twoFactorSecret: ""
      });
      alert("2FA Disabled.");
      refreshUser();
    } catch (err) {
      alert("Failed to disable 2FA.");
    } finally {
      setActionLoading(false);
    }
  };

  // ── CSV Utilities ───────────────────────────────────────────────
  const toCsv = (headers: string[], rows: (string | number | null | undefined)[][]): string => {
    const escape = (v: string | number | null | undefined) =>
      `"${String(v ?? "").replace(/"/g, '""')}"`;
    return [headers.map(escape).join(","), ...rows.map(r => r.map(escape).join(","))].join("\n");
  };

  const downloadCsv = (filename: string, csv: string) => {
    const blob = new Blob(["\uFEFF" + csv, ""], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const [exportLoading, setExportLoading] = useState(false);

  const getProblemTitle = (id: string | null) =>
    problems.find(p => p.id === id)?.title || id || "Not Selected";

  const exportTeams = (phase: "internal" | "external" | "all") => {
    const filtered = phase === "all"
      ? teams
      : teams.filter(t => phase === "external"
          ? t.competition_phase === "external"
          : t.competition_phase !== "external");
    const headers = ["Team ID", "Team Name", "Leader ID", "Members", "Problem Statement", "Is Locked", "Phase", "Avg Innovation", "Avg Tech", "Avg Pitch", "Avg Total", "Evaluations Done"];
    const rows = filtered.map(t => [
      t.id,
      t.team_name,
      t.leader_id,
      t.members.join(" | "),
      getProblemTitle(t.problem_statement_id),
      t.isLocked ? "Yes" : "No",
      t.competition_phase === "external" ? "External" : "Internal",
      t.scores?.innovation.toFixed(2) ?? "0.00",
      t.scores?.tech.toFixed(2) ?? "0.00",
      t.scores?.pitch.toFixed(2) ?? "0.00",
      t.scores?.total.toFixed(2) ?? "0.00",
      t.scores?.judgeCount ?? 0,
    ]);
    const label = phase === "all" ? "all_teams" : phase === "external" ? "teams_external" : "teams_internal";
    downloadCsv(`AlgoGLORiA_${label}_${new Date().toISOString().split("T")[0]}.csv`, toCsv(headers, rows));
  };

  const exportMembers = async () => {
    setExportLoading(true);
    try {
      const snap = await getDocs(query(collection(db, "users"), where("role", "==", "student")));
      const headers = ["Enrollment No", "First Name", "Last Name", "Email", "Mobile", "Gender", "Team ID", "Team Name", "Problem Statement", "Phase", "Domain", "Course", "Specialization", "College", "City"];
      const teamMap = new Map(teams.map(t => [t.id, t]));
      const rows = snap.docs.map(d => {
        const u = d.data();
        const team = u.team_id ? teamMap.get(u.team_id) : null;
        return [
          u.enrollment_no, u.firstName, u.lastName, u.email, u.mobile, u.gender,
          u.team_id ?? "", team?.team_name ?? "",
          team ? getProblemTitle(team.problem_statement_id) : "",
          u.competition_phase === "external" ? "External" : "Internal",
          u.domain ?? "", u.course ?? "", u.specialization ?? "",
          u.college_name ?? "", u.city ?? ""
        ];
      });
      downloadCsv(`AlgoGLORiA_members_${new Date().toISOString().split("T")[0]}.csv`, toCsv(headers, rows));
    } finally { setExportLoading(false); }
  };

  const exportEvaluations = () => {
    // Dynamic headers for evaluations export
    const headers = ["Evaluation ID", "Team ID", "Team Name", "Judge ID", "Judge Name", "Round"];
    evalSettings.criteria.forEach(c => headers.push(c.name));
    headers.push("Total Score");

    const rows = rawEvaluations.map(ev => {
      const team = teams.find(t => t.id === ev.team_id);
      const judge = judges.find(j => j.enrollment_no === ev.judge_id);
      const round = evalSettings.rounds.find(r => r.id === ev.round_id);
      
      const row = [
        ev.id,
        ev.team_id,
        team?.team_name || "Unknown",
        ev.judge_id,
        judge?.name || judge?.firstName || "Unknown",
        round?.name || ev.round_id || "Legacy"
      ];

      evalSettings.criteria.forEach(cri => {
        row.push(ev.criteria_scores?.[cri.id]?.toString() || "0");
      });
      
      row.push(ev.total_score.toString());
      return row;
    });
    downloadCsv(`AlgoGLORiA_Evaluations_${new Date().toISOString().split("T")[0]}.csv`, toCsv(headers, rows));
  };

  const exportLeaderboard = (phase?: "internal" | "external") => {
    const filtered = phase === "internal" ? teams.filter(t => t.competition_phase !== "external")
      : phase === "external" ? teams.filter(t => t.competition_phase === "external")
      : teams;
    const sorted = [...filtered].filter(t => t.scores && t.scores.total > 0).sort((a, b) => (b.scores?.total ?? 0) - (a.scores?.total ?? 0));
    
    // Dynamic headers based on rounds
    const headers = ["Rank", "Team ID", "Team Name", "Leader ID", "Problem Statement", "Phase", "Judge Count"];
    evalSettings.rounds.forEach(r => headers.push(`${r.name} Avg`));
    headers.push("WEIGHTED TOTAL");

    const rows = sorted.map((t, i) => {
      const row = [
        i + 1, t.id, t.team_name, t.leader_id,
        getProblemTitle(t.problem_statement_id),
        t.competition_phase === "external" ? "External" : "Internal",
        t.scores!.judgeCount
      ];
      evalSettings.rounds.forEach(round => {
        const roundEvs = rawEvaluations.filter(ev => ev.team_id === t.id && ev.round_id === round.id);
        const avg = roundEvs.length > 0 ? roundEvs.reduce((acc, ev) => acc + ev.total_score, 0) / roundEvs.length : 0;
        row.push(avg.toFixed(2));
      });
      row.push(t.scores!.total.toFixed(2));
      return row;
    });

    const label = phase ? `leaderboard_${phase}` : "leaderboard_all";
    downloadCsv(`AlgoGLORiA_${label}_${new Date().toISOString().split("T")[0]}.csv`, toCsv(headers, rows));
  };

  const exportAll = async () => {
    setExportLoading(true);
    try {
      exportTeams("internal");
      await new Promise(r => setTimeout(r, 400));
      exportTeams("external");
      await new Promise(r => setTimeout(r, 400));
      await exportMembers();
      await new Promise(r => setTimeout(r, 400));
      exportEvaluations();
      await new Promise(r => setTimeout(r, 400));
      exportLeaderboard();
    } finally { setExportLoading(false); }
  };

  // Legacy alias kept for any remaining references
  const exportData = exportAll;



  const updateEvalSettings = async (settings: EvaluationSettings) => {
    try {
      await setDoc(doc(db, "settings", "evaluation"), settings);
    } catch (err) {
      console.error("Failed to update evaluation settings:", err);
    }
  };

  const broadcastFinalResults = () => {
    alert("Results finalized and broadcasted to participant portals.");
    // In a real app, this would set a 'results_visible' flag in Firestore
  };

  if (loading || fetching) return <div className="min-h-screen bg-[#e0e0e0] flex items-center justify-center">
    <div className="animate-spin rounded-full h-8 w-8 border-b-4 border-[#002D62]"></div>
  </div>;

  return (
    <div className="min-h-screen bg-[#e0e0e0] pb-20 w-full max-w-full overflow-hidden">
      <div className="max-w-[1600px] mx-auto pt-10 px-4 sm:px-8 w-full">

        {/* Admin Master Header */}
        <Card className="!p-0 border-none mb-10 overflow-hidden shadow-amity">
          <div className="bg-[#002D62] p-6 md:p-10 text-white flex flex-col md:flex-row gap-6 md:gap-0 justify-between items-start md:items-center relative">
            <div className="z-10 flex items-center space-x-4 md:space-x-8 w-full md:w-auto">
              <div className="bg-[#FFC300] p-3 md:p-4 shadow-xl flex-shrink-0">
                <svg className="w-10 h-10 text-[#002D62]" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <h2 className="text-3xl sm:text-5xl font-bold uppercase tracking-tighter leading-none break-words">Admin Control Center</h2>
              </div>
            </div>
            <div className="flex flex-wrap gap-4 w-full md:w-auto z-10">
              <div className="bg-white/5 p-6 border-l-4 border-[#FFC300] min-w-[200px]">
                <span className="block text-[10px] font-bold text-gray-300 uppercase tracking-widest mb-1">Active Nodes</span>
                <span className="text-3xl font-bold text-white leading-none">{teams.length}</span>
              </div>
              <div className="bg-white/5 p-6 border-l-4 border-green-500 min-w-[200px]">
                <span className="block text-[10px] font-bold text-gray-300 uppercase tracking-widest mb-1">Sync Status</span>
                <span className="text-3xl font-bold text-white leading-none">LIVE</span>
              </div>
            </div>
          </div>

          {/* Admin Nav Tabs */}
          <div className="bg-white border-b border-[#e9ecef] flex px-4 sm:px-10 overflow-x-auto scrollbar-hide">
            {["teams", "leaderboard", "evaluations", "evaluation", "system", "portal", "security", "export"].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-12 py-6 text-xs font-bold uppercase tracking-widest whitespace-nowrap flex-shrink-0 transition-all border-b-4 ${activeTab === tab
                  ? "border-[#002D62] text-[#002D62] bg-[#f8f9fa]"
                  : "border-transparent text-gray-400 hover:text-[#002D62] hover:bg-gray-50"
                  }`}
              >
                {tab === "evaluation" ? "Architect" : tab}
              </button>
            ))}
          </div>
        </Card>

        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
          <div className="bg-blue-50 p-6 border-l-4 border-blue-600 shadow-sm flex flex-col justify-center">
            <p className="text-[10px] font-bold text-blue-600 uppercase mb-1">Total Teams</p>
            <h3 className="text-3xl font-bold text-[#002D62]">{teams.length}</h3>
          </div>
          <div className="bg-indigo-50 p-6 border-l-4 border-indigo-600 shadow-sm flex flex-col justify-center">
            <p className="text-[10px] font-bold text-indigo-600 uppercase mb-1">Total Students</p>
            <h3 className="text-3xl font-bold text-[#002D62]">{teams.reduce((acc, t) => acc + t.members.length, 0)}</h3>
          </div>
          <div className="bg-green-50 p-6 border-l-4 border-green-600 shadow-sm flex flex-col justify-center">
            <p className="text-[10px] font-bold text-green-600 uppercase mb-1">Problem Locked</p>
            <h3 className="text-3xl font-bold text-[#002D62]">{teams.filter(t => t.isLocked).length}</h3>
          </div>
          <div className="bg-amber-50 p-6 border-l-4 border-amber-500 shadow-sm flex flex-col justify-center">
            <p className="text-[10px] font-bold text-amber-500 uppercase mb-1">Evaluators</p>
            <h3 className="text-3xl font-bold text-[#002D62]">{judges.length}</h3>
          </div>
        </div>

        {/* Console content layout grid */}
        <div className="mt-10">

          {activeTab === "teams" && (
            <div className="grid grid-cols-12 gap-10">
              <div className="col-span-12 lg:col-span-8 space-y-10">
                <Card headerType="primary" headerText="Team Management Registry" className="!p-0 border-none">

                  {/* Filter Sub-Tabs */}
                  <div className="bg-white border-b border-[#e9ecef] flex overflow-x-auto scrollbar-hide">
                    {([
                      { key: "all", label: "All Teams" },
                      { key: "inhouse", label: "In-House" },
                      { key: "external", label: "External Registrants" },
                    ] as const).map((f) => (
                      <button
                        key={f.key}
                        onClick={() => setTeamsFilter(f.key)}
                        className={`px-8 py-4 text-[10px] font-black uppercase tracking-widest whitespace-nowrap flex-shrink-0 transition-all border-b-4 ${teamsFilter === f.key
                          ? "border-[#FFC300] text-[#002D62] bg-[#fffbea]"
                          : "border-transparent text-gray-400 hover:text-[#002D62] hover:bg-gray-50"
                          }`}
                      >
                        {f.label}
                        <span className="ml-2 px-2 py-0.5 bg-[#e9ecef] text-[#666] text-[9px] font-black">
                          {f.key === "all"
                            ? teams.length
                            : f.key === "inhouse"
                              // In-House = teams that are NOT external (includes legacy teams with no competition_phase)
                              ? teams.filter(t => t.competition_phase !== "external").length
                              : teams.filter(t => t.competition_phase === "external").length}
                        </span>
                      </button>
                    ))}
                  </div>

                  {/* Mobile Card View - hidden on md and above */}
                  <div className="block md:hidden space-y-4 p-4 bg-[#f8f9fa] min-h-[400px]">
                    {teams
                      .filter(team => {
                        if (teamsFilter === "inhouse") return team.competition_phase !== "external";
                        if (teamsFilter === "external") return team.competition_phase === "external";
                        return true;
                      })
                      .length === 0 ? (
                      <div className="py-20 text-center text-xs font-bold text-gray-400 uppercase tracking-[0.2em]">No teams found in this category.</div>
                    ) : (
                      teams
                        .filter(team => {
                          if (teamsFilter === "inhouse") return team.competition_phase !== "external";
                          if (teamsFilter === "external") return team.competition_phase === "external";
                          return true;
                        })
                        .map((team) => {
                          const problem = problems.find(p => p.id === team.problem_statement_id);
                          const isExternal = team.competition_phase === "external";
                          const isInternalTeam = !isExternal;
                          return (
                            <div key={team.id} className="bg-white rounded-none p-4 shadow-sm border border-[#e9ecef]">
                              <div className="flex justify-between items-start mb-3 border-b border-[#e9ecef] pb-3">
                                <div>
                                  <div className="flex items-center gap-2 flex-wrap mb-1">
                                    <span className="font-bold text-[#002D62] uppercase tracking-wide text-sm">{team.team_name}</span>
                                    {isExternal && <span className="px-2 py-0.5 bg-[#FFC300] text-[#002D62] text-[9px] font-black uppercase tracking-widest leading-none">External</span>}
                                    {isInternalTeam && <span className="px-2 py-0.5 bg-[#002D62] text-white text-[9px] font-black uppercase tracking-widest leading-none">In-House</span>}
                                  </div>
                                  <p className="text-[10px] text-gray-400 font-bold uppercase">LEADER: <span className="font-mono">{team.leader_id}</span></p>
                                </div>
                                <button onClick={() => toggleLock(team.id, team.isLocked)} disabled={actionLoading} className={`${team.isLocked ? "bg-amity-activeBg text-amity-activeText" : "bg-amity-inactiveBg text-amity-inactiveText"} px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest`}>
                                  {team.isLocked ? "LOCKED" : "OPEN"}
                                </button>
                              </div>
                              <div className="grid grid-cols-2 gap-3 text-xs mb-3 border-b border-[#e9ecef] pb-3">
                                <div>
                                  <span className="block text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">Assigned Problem</span>
                                  <span className={`block font-black uppercase text-[10px] leading-tight ${problem ? "text-blue-600" : "text-gray-300 italic"}`}>{problem ? problem.id : "NONE"}</span>
                                </div>
                                <div className="text-right">
                                  <span className="block text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">Avg Score</span>
                                  <span className="block font-black text-[#002D62] text-lg leading-none">{team.scores?.total ? team.scores.total.toFixed(1) : "0.0"}</span>
                                </div>
                              </div>
                              <div className="flex items-center justify-end gap-2">
                                {isInternalTeam && (
                                  <button onClick={() => promoteToExternal(team.id)} disabled={actionLoading} className="px-3 py-2 bg-[#FFC300] hover:bg-[#e6b200] text-[#002D62] text-[9px] font-black uppercase tracking-widest transition-all disabled:opacity-40">
                                    Promote to External
                                  </button>
                                )}
                                <button onClick={() => handleDeleteTeam(team)} disabled={actionLoading} className="text-gray-300 hover:text-red-500 p-2">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                </button>
                              </div>
                            </div>
                          );
                        })
                    )}
                  </div>

                  {/* Desktop Table View - hidden below md */}
                  <div className="hidden md:block overflow-x-auto min-h-[400px]">
                    <table className="amity-table">
                      <thead>
                        <tr className="border-b-4 border-[#FFC300]">
                          <th className="px-10">Team Information</th>
                          <th>Selected Scenario</th>
                          <th className="text-center">Protocol Status</th>
                          <th className="text-center">AVG Score</th>
                          <th className="px-10 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {teams
                          .filter(team => {
                            // In-House filter: any team that is NOT external (includes legacy teams with no phase)
                            if (teamsFilter === "inhouse") return team.competition_phase !== "external";
                            if (teamsFilter === "external") return team.competition_phase === "external";
                            return true;
                          })
                          .length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-20 text-center text-xs font-bold text-gray-400 uppercase tracking-[0.2em]">No teams found in this category.</td>
                          </tr>
                        ) : (
                          teams
                            .filter(team => {
                              if (teamsFilter === "inhouse") return team.competition_phase !== "external";
                              if (teamsFilter === "external") return team.competition_phase === "external";
                              return true;
                            })
                            .map((team) => {
                              const problem = problems.find(p => p.id === team.problem_statement_id);
                              const isExternal = team.competition_phase === "external";
                              // Internal = explicitly "internal" OR has no competition_phase (legacy internal teams)
                              const isInternalTeam = !isExternal;
                              return (
                                <tr key={team.id} className="border-b border-[#e9ecef]">
                                  <td className="px-10 py-6">
                                    <div className="flex items-center gap-3 mb-1 flex-wrap">
                                      <p className="font-bold text-[#002D62] uppercase tracking-wide">{team.team_name}</p>
                                      {isExternal && (
                                        <span className="px-2 py-0.5 bg-[#FFC300] text-[#002D62] text-[9px] font-black uppercase tracking-widest leading-none">
                                          External
                                        </span>
                                      )}
                                      {isInternalTeam && (
                                        <span className="px-2 py-0.5 bg-[#002D62] text-white text-[9px] font-black uppercase tracking-widest leading-none">
                                          In-House
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[10px] text-gray-400 font-bold uppercase mt-1">LEADER: {team.leader_id}</p>
                                  </td>
                                  <td className="py-6">
                                    <p className={`text-[10px] font-black uppercase tracking-tight ${problem ? "text-blue-600" : "text-gray-300 italic"}`}>
                                      {problem ? problem.title : "NOT SELECTED"}
                                    </p>
                                    {problem && <p className="text-[8px] text-gray-400 font-bold mt-0.5">{problem.id}</p>}
                                  </td>
                                  <td className="py-6 text-center">
                                    <div className="flex flex-col items-center gap-2">
                                      <button
                                        onClick={() => toggleLock(team.id, team.isLocked)}
                                        disabled={actionLoading}
                                        className={`${team.isLocked ? "badge-active" : "badge-inactive"} cursor-pointer hover:opacity-80 transition-all border-none`}
                                      >
                                        {team.isLocked ? "LOCKED" : "OPEN"}
                                      </button>
                                      {isExternal && (
                                        <button
                                          onClick={() => toggleVerify(team.id, !!team.isVerified)}
                                          disabled={actionLoading}
                                          className={`text-[9px] font-black px-2 py-0.5 rounded shadow-sm border-none cursor-pointer transition-all ${
                                            team.isVerified
                                              ? "bg-green-100 text-green-700 hover:bg-green-200"
                                              : "bg-red-100 text-red-700 hover:bg-red-200"
                                          }`}
                                          title={team.isVerified ? "Verified: Access Granted" : "Unverified: Access Denied"}
                                        >
                                          {team.isVerified ? "VERIFIED" : "VERIFY"}
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                  <td className="py-6 text-center">
                                    <div className="flex flex-col items-center gap-1">
                                      <span className="font-bold text-xl text-[#002D62]">
                                        {team.scores?.total ? team.scores.total.toFixed(1) : "0.0"}
                                      </span>
                                      {isExternal && team.internal_scores_snapshot && (
                                        <span
                                          title={`Inhouse avg: Innovation ${team.internal_scores_snapshot.avg_innovation} | Tech ${team.internal_scores_snapshot.avg_tech} | Pitch ${team.internal_scores_snapshot.avg_pitch}`}
                                          className="px-2 py-0.5 bg-blue-50 text-blue-600 border border-blue-200 text-[8px] font-black uppercase tracking-widest whitespace-nowrap"
                                        >
                                          Internal: {team.internal_scores_snapshot.avg_total.toFixed(1)}
                                        </span>
                                      )}
                                      {isExternal && !team.internal_scores_snapshot && (
                                        <span className="text-[8px] text-gray-300 font-bold uppercase tracking-widest">No internal score</span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-10 py-6 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                      {/* Promote button: visible for ALL internal/legacy teams not yet in external phase */}
                                      {isInternalTeam && (
                                        <button
                                          onClick={() => promoteToExternal(team.id)}
                                          disabled={actionLoading}
                                          className="px-3 py-1.5 bg-[#FFC300] hover:bg-[#e6b200] text-[#002D62] text-[9px] font-black uppercase tracking-widest transition-all disabled:opacity-40"
                                        >
                                          Promote to External
                                        </button>
                                      )}
                                      <button
                                        onClick={() => handleDeleteTeam(team)}
                                        disabled={actionLoading}
                                        className="text-gray-300 hover:text-red-500 transition-colors p-2 disabled:opacity-30"
                                      >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })
                        )}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>
              <div className="col-span-12 lg:col-span-4">
                <Card headerType="primary" headerText="PROBLEM STATEMENTS" className="!p-0 border-none bg-white">
                  <div className="p-0 max-h-[500px] overflow-y-auto">
                    <div className="divide-y divide-[#e9ecef]">
                      {problems.map(p => (
                        <div key={p.id} className="p-6 flex justify-between items-center hover:bg-gray-50 transition-colors">
                          <div>
                            <p className="text-xs font-black text-[#002D62] uppercase leading-tight mb-1">{p.title}</p>
                            <p className="text-[10px] text-[#FFC300] font-bold tracking-widest mb-1">{p.id}</p>
                            {p.description && (
                              <p className="text-[9px] text-gray-500 line-clamp-2 leading-tight lowercase first-letter:uppercase">{p.description}</p>
                            )}
                          </div>
                          <button onClick={() => deleteProblem(p.id)} className="text-gray-300 hover:text-red-500 p-2"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="p-6 bg-[#f8f9fa] border-t border-[#e9ecef] space-y-3">
                    <Input placeholder="PROBLEM STATEMENT ID" value={newProblem.id} onChange={e => setNewProblem({ ...newProblem, id: e.target.value })} className="!p-3 !text-xs bg-white" />
                    <Input placeholder="PROBLEM STATEMENT TITLE" value={newProblem.title} onChange={e => setNewProblem({ ...newProblem, title: e.target.value })} className="!p-3 !text-xs bg-white" />
                    <textarea 
                      placeholder="BRIEF DESCRIPTION" 
                      value={newProblem.description} 
                      onChange={e => setNewProblem({ ...newProblem, description: e.target.value })}
                      className="w-full bg-white border border-[#e9ecef] p-3 text-xs font-bold text-[#002D62] h-24 focus:border-[#FFC300] outline-none transition-all uppercase leading-relaxed placeholder:text-gray-300"
                    />
                    <Button fullWidth onClick={registerProblem} disabled={actionLoading}>Register Objective</Button>
                  </div>
                </Card>
              </div>
            </div>
          )}

          {activeTab === "leaderboard" && (
            <Card headerType="primary" headerText="Field Performance Rankings" className="!p-0 border-none">
              <div className="block md:hidden space-y-4 p-4 bg-[#f8f9fa]">
                {[...teams].sort((a, b) => (b.scores?.total || 0) - (a.scores?.total || 0)).map((t, i) => (
                  <div key={t.id} className="bg-white rounded-none p-4 shadow-sm border border-[#e9ecef]">
                    <div className="flex justify-between items-start mb-3 border-b border-[#e9ecef] pb-3">
                      <div className="flex items-center gap-3">
                        <span className={`w-6 h-6 flex items-center justify-center rounded-sm font-black text-xs ${i < 3 ? 'bg-[#FFC300] text-[#002D62]' : 'bg-[#002D62] text-white'}`}>
                          {i + 1}
                        </span>
                        <div>
                          <p className="font-bold text-[#002D62] uppercase tracking-wide text-sm">{t.team_name}</p>
                          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{t.problem_statement_id || "NOT ASSIGNED"}</p>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-center mb-3">
                      <div><span className="block text-[9px] font-bold text-gray-400 uppercase">Inn</span><span className="font-mono font-bold text-gray-600 text-xs">{t.scores?.innovation.toFixed(1) || "0.0"}</span></div>
                      <div><span className="block text-[9px] font-bold text-gray-400 uppercase">Tech</span><span className="font-mono font-bold text-gray-600 text-xs">{t.scores?.tech.toFixed(1) || "0.0"}</span></div>
                      <div><span className="block text-[9px] font-bold text-gray-400 uppercase">Pitch</span><span className="font-mono font-bold text-gray-600 text-xs">{t.scores?.pitch.toFixed(1) || "0.0"}</span></div>
                      <div><span className="block text-[9px] font-bold text-[#002D62] uppercase">Avg</span><span className="font-mono font-black text-[#002D62] text-xs">{t.scores?.total.toFixed(1) || "0.0"}</span></div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="hidden md:block overflow-x-auto">
                <table className="amity-table">
                  <thead>
                    <tr className="border-b-4 border-[#FFC300]">
                      <th className="px-10 w-20">Rank</th>
                      <th>Team Identity</th>
                      <th className="text-center">Innovation</th>
                      <th className="text-center">Tech</th>
                      <th className="text-center">Pitch</th>
                      <th className="text-center">Avg. Aggregate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...teams].sort((a, b) => (b.scores?.total || 0) - (a.scores?.total || 0)).map((t, i) => (
                      <tr key={t.id} className="border-b border-[#e9ecef] hover:bg-gray-50">
                        <td className="px-10 py-6 text-center">
                          <span className={`w-8 h-8 flex items-center justify-center rounded-sm font-black text-sm ${i < 3 ? 'bg-[#FFC300] text-[#002D62]' : 'bg-[#002D62] text-white'}`}>
                            {i + 1}
                          </span>
                        </td>
                        <td className="py-6">
                          <p className="font-bold text-[#002D62] uppercase">{t.team_name}</p>
                          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{t.problem_statement_id || "NOT ASSIGNED"}</p>
                        </td>
                        <td className="text-center font-mono font-bold text-gray-600">{t.scores?.innovation.toFixed(1) || "0.0"}</td>
                        <td className="text-center font-mono font-bold text-gray-600">{t.scores?.tech.toFixed(1) || "0.0"}</td>
                        <td className="text-center font-mono font-bold text-gray-600">{t.scores?.pitch.toFixed(1) || "0.0"}</td>
                        <td className="text-center">
                          <span className="text-2xl font-black text-[#002D62] italic">
                            {t.scores?.total.toFixed(1) || "0.0"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {activeTab === "evaluations" && (
            <Card headerType="primary" headerText="Field Evaluation Master Ledger" className="!p-0 border-none">
              <div className="block md:hidden space-y-4 p-4 bg-[#f8f9fa] min-h-[400px]">
                {teams.filter(t => (t.scores?.judgeCount || 0) > 0).length === 0 ? (
                  <div className="py-20 text-center font-bold text-gray-400 uppercase tracking-widest text-xs">System Idle: No evaluation logs synced to active teams.</div>
                ) : (
                  teams.filter(t => (t.scores?.judgeCount || 0) > 0).map((t) => (
                    <div key={t.id} className="bg-white rounded-none p-4 shadow-sm border border-[#e9ecef] flex flex-col gap-3">
                      <div className="flex justify-between items-start border-b border-[#e9ecef] pb-3">
                        <div className="flex items-center gap-3">
                          <span className="bg-[#002D62] text-white px-2 py-1 text-[9px] font-black uppercase tracking-widest leading-none">
                            {t.id.substring(t.id.length - 4)}
                          </span>
                          <div>
                            <p className="font-bold text-[#002D62] uppercase leading-none text-sm">{t.team_name}</p>
                            <p className="text-[9px] text-gray-400 font-bold mt-1 uppercase tracking-tighter">{t.problem_statement_id || "None"}</p>
                          </div>
                        </div>
                        <span className="text-[9px] font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-full">{t.scores?.judgeCount} JUDGES</span>
                      </div>
                      <div className="flex justify-between items-center border-b border-[#e9ecef] pb-3 px-4">
                        <div className="flex gap-4 overflow-x-auto py-1">
                          {evalSettings.rounds.map(round => {
                            const teamEvs = rawEvaluations.filter(ev => ev.team_id === t.id && ev.round_id === round.id);
                            if (teamEvs.length === 0) return null;
                            const avg = teamEvs.reduce((acc, ev) => acc + ev.total_score, 0) / teamEvs.length;
                            return (
                              <div key={round.id} className="text-center min-w-[60px]">
                                <span className="block text-[7px] font-bold text-gray-400 uppercase truncate max-w-[60px]">{round.name}</span>
                                <span className="font-mono font-bold text-gray-500 text-[10px]">{avg.toFixed(1)}</span>
                              </div>
                            );
                          })}
                        </div>
                        <div className="text-right">
                          <span className="block text-[7px] font-bold text-gray-400 uppercase">WEIGHTED TOTAL</span>
                          <span className="text-sm font-black text-[#002D62] italic">{t.scores?.total.toFixed(1)}</span>
                        </div>
                      </div>
                      <button onClick={() => setExpandedTeamId(expandedTeamId === t.id ? null : t.id)} className="w-full text-center text-[10px] font-black uppercase tracking-widest text-[#002D62] py-2 bg-gray-50">
                        {expandedTeamId === t.id ? "Close Detail" : "Expand Detail"}
                      </button>
                      {expandedTeamId === t.id && (
                        <div className="mt-2 space-y-3">
                          {rawEvaluations.filter(ev => ev.team_id === t.id).map(ev => {
                            const judge = judges.find(j => j.enrollment_no === ev.judge_id);
                            const round = evalSettings.rounds.find(r => r.id === ev.round_id);
                            return (
                              <div key={ev.id} className="bg-gray-50 p-3 flex justify-between items-center text-xs border border-[#e9ecef]">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-[8px] font-black bg-[#002D62] text-white px-1.5 py-0.5 uppercase tracking-tighter">
                                      {round?.name || ev.round_id || "LEGACY"}
                                    </span>
                                    <p className="font-bold text-[#002D62] uppercase">{judge?.name || judge?.firstName || ev.judge_id}</p>
                                  </div>
                                  <div className="flex flex-wrap gap-x-3 gap-y-1">
                                    {ev.criteria_scores ? Object.entries(ev.criteria_scores).map(([cid, score]) => (
                                      <span key={cid} className="text-[8px] text-gray-400 font-bold uppercase tracking-tight">
                                        {cid}: <span className="text-gray-600">{score}</span>
                                      </span>
                                    )) : (
                                      <p className="text-[9px] text-gray-400">INN: {ev.score_innovation} | TECH: {ev.score_tech} | PITCH: {ev.score_pitch}</p>
                                    )}
                                  </div>
                                </div>
                                <div className="text-right flex items-center gap-3 ml-4">
                                  <span className="font-black text-[#FFC300] text-lg">{ev.total_score}</span>
                                  <button onClick={(e) => { e.stopPropagation(); deleteEvaluation(ev.id); }} className="text-gray-300 hover:text-red-500">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
              <div className="hidden md:block overflow-x-auto min-h-[600px]">
                <table className="amity-table">
                  <thead>
                    <tr className="border-b-4 border-[#FFC300]">
                      <th className="px-10 w-24">Nodes</th>
                      <th className="px-10">Team Identity</th>
                      <th className="text-center">Judge Count</th>
                      {evalSettings.rounds.map(round => (
                        <th key={round.id} className="text-center">{round.name} (Avg)</th>
                      ))}
                      <th className="text-center">Weighted Score</th>
                      <th className="text-right px-10">Expand Detail</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teams.filter(t => (t.scores?.judgeCount || 0) > 0).length === 0 ? (
                      <tr><td colSpan={evalSettings.rounds.length + 5} className="py-20 text-center font-bold text-gray-400 uppercase tracking-widest">System Idle: No evaluation logs synced to active teams.</td></tr>
                    ) : (
                      teams.filter(t => (t.scores?.judgeCount || 0) > 0).map((t) => (
                        <React.Fragment key={t.id}>
                          <tr
                            onClick={() => setExpandedTeamId(expandedTeamId === t.id ? null : t.id)}
                            className={`border-b border-[#e9ecef] cursor-pointer hover:bg-[#f8f9fa] transition-all ${expandedTeamId === t.id ? 'bg-[#f0f2f5]' : ''}`}
                          >
                            <td className="px-10 py-6">
                              <span className="bg-[#002D62] text-white px-3 py-1 text-[10px] font-black uppercase tracking-widest">
                                {t.id.substring(t.id.length - 4)}
                              </span>
                            </td>
                            <td className="px-10 py-6">
                              <p className="font-bold text-[#002D62] uppercase leading-none">{t.team_name}</p>
                              <p className="text-[8px] text-gray-400 font-bold mt-1 uppercase tracking-tighter">{t.problem_statement_id || "No Scenario Selected"}</p>
                            </td>
                            <td className="text-center py-6">
                              <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-full">{t.scores?.judgeCount} JUDGES</span>
                            </td>
                            {evalSettings.rounds.map(round => {
                              const roundEvs = rawEvaluations.filter(ev => ev.team_id === t.id && ev.round_id === round.id);
                              const avg = roundEvs.length > 0 ? roundEvs.reduce((acc, ev) => acc + ev.total_score, 0) / roundEvs.length : 0;
                              return (
                                <td key={round.id} className="text-center font-mono font-bold text-gray-500">
                                  {avg > 0 ? avg.toFixed(1) : "-"}
                                </td>
                              );
                            })}
                            <td className="text-center">
                              <span className="text-2xl font-black text-[#002D62] italic">
                                {t.scores?.total.toFixed(1)}
                              </span>
                            </td>
                            <td className="text-right px-10">
                              <svg className={`w-5 h-5 text-gray-300 transition-transform duration-300 ${expandedTeamId === t.id ? 'rotate-180 text-[#FFC300]' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                              </svg>
                            </td>
                          </tr>

                          {/* Expanded Detail View */}
                          {expandedTeamId === t.id && (
                            <tr className="bg-white">
                              <td colSpan={evalSettings.rounds.length + 5} className="p-0 border-b-2 border-[#FFC300]">
                                <div className="p-10 bg-gray-50/50 space-y-6">
                                  <div className="flex items-center space-x-3 mb-4">
                                    <div className="w-[4px] h-6 bg-[#FFC300]"></div>
                                    <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-[#002D62]">Individual Evaluator Breakdown for {t.team_name}</h4>
                                  </div>

                                  <div className="grid grid-cols-1 gap-4">
                                    {rawEvaluations.filter(ev => ev.team_id === t.id).map(ev => {
                                      const judge = judges.find(j => j.enrollment_no === ev.judge_id);
                                      return (
                                        <div key={ev.id} className="bg-white border border-[#e9ecef] p-6 flex justify-between items-center group hover:border-[#FFC300] transition-all shadow-sm">
                                          <div className="flex items-center space-x-6">
                                            <div className="text-center border-r border-[#e9ecef] pr-6">
                                              <p className="text-[9px] font-black text-gray-300 uppercase leading-none mb-1">EVALUATOR</p>
                                              <p className="text-xs font-black text-[#002D62] uppercase leading-none truncate max-w-[150px]">
                                                {judge?.name || judge?.firstName || ev.judge_id}
                                              </p>
                                            </div>
                                            <div className="flex space-x-8">
                                              {ev.criteria_scores ? Object.entries(ev.criteria_scores).map(([cid, score]) => {
                                                const criterion = evalSettings.criteria.find(c => c.id === cid);
                                                return (
                                                  <div key={cid} className="text-center px-4">
                                                    <p className="text-[8px] font-black text-gray-300 uppercase mb-1 truncate max-w-[80px]">
                                                      {criterion?.name || cid}
                                                    </p>
                                                    <p className="text-lg font-bold text-gray-600 leading-none">{score}</p>
                                                  </div>
                                                );
                                              }) : (
                                                <div className="flex space-x-8">
                                                   <div className="text-center">
                                                    <p className="text-[8px] font-black text-gray-300 uppercase mb-1">Innovation</p>
                                                    <p className="text-lg font-bold text-gray-600 leading-none">{ev.score_innovation}</p>
                                                  </div>
                                                  <div className="text-center">
                                                    <p className="text-[8px] font-black text-gray-300 uppercase mb-1">Tech</p>
                                                    <p className="text-lg font-bold text-gray-600 leading-none">{ev.score_tech}</p>
                                                  </div>
                                                  <div className="text-center">
                                                    <p className="text-[8px] font-black text-gray-300 uppercase mb-1">Pitch</p>
                                                    <p className="text-lg font-bold text-gray-600 leading-none">{ev.score_pitch}</p>
                                                  </div>
                                                </div>
                                              )}
                                            </div>
                                          </div>

                                          <div className="flex items-center space-x-10">
                                            <div className="text-center px-8 border-l border-[#e9ecef]">
                                              <p className="text-[9px] font-black text-gray-300 uppercase mb-1">Judge Score</p>
                                              <p className="text-2xl font-black text-[#FFC300] leading-none">{ev.total_score}</p>
                                            </div>
                                            <button
                                              onClick={(e) => { e.stopPropagation(); deleteEvaluation(ev.id); }}
                                              className="text-gray-200 hover:text-red-500 transition-colors p-2"
                                            >
                                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                            </button>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {activeTab === "system" && (
            <div className="grid grid-cols-12 gap-10">
              <div className="col-span-12 lg:col-span-4 space-y-10">
                <Card headerType="primary" headerText="System Protocol Controls" className="!p-0 border-none">
                  <div className="p-8 grid grid-cols-1 sm:grid-cols-2 gap-6">
                      {/* Visibility Toggles Retired per User Request */}

                    <button onClick={clearAllScores} className="flex flex-col items-center justify-center p-8 bg-red-50 hover:bg-red-100 transition-all border-b-4 border-transparent hover:border-red-600 group">
                      <svg className="w-8 h-8 text-red-400 mb-4 group-hover:scale-110 transition-transform" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                      <span className="text-[9px] font-black uppercase text-red-600 tracking-widest text-center">Clear Score Matrix</span>
                    </button>
                    <button onClick={forceLockAll} className="flex flex-col items-center justify-center p-8 bg-[#f8f9fa] hover:bg-[#FFC300]/10 transition-all border-b-4 border-transparent hover:border-[#FFC300] group">
                      <svg className="w-8 h-8 text-[#002D62] mb-4 group-hover:scale-110 transition-transform" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg>
                      <span className="text-[9px] font-black uppercase text-[#002D62] tracking-widest text-center">Global Lockdown</span>
                    </button>
                    <button onClick={cleanupOrphanedScores} className="flex flex-col items-center justify-center p-8 bg-amber-50 hover:bg-amber-100 transition-all border-b-4 border-transparent hover:border-amber-500 group">
                      <svg className="w-8 h-8 text-amber-600 mb-4 group-hover:scale-110 transition-transform" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                      <span className="text-[9px] font-black uppercase text-amber-700 tracking-widest text-center">Purge Orphaned Scores</span>
                    </button>
                  </div>
                </Card>

                <Card headerType="primary" headerText="User Credential Override" className="!p-0 border-none">
                  <div className="p-8">
                    <p className="text-[10px] font-bold text-gray-400 mb-6 uppercase tracking-widest leading-relaxed">
                      Flag a user for password reset. They will be prompted to set a new password on their next login.
                    </p>
                    <div className="space-y-4">
                      <Input label="Target ID (Enrollment No / Email)" placeholder="e.g. A81234xxxxxx or abc@gmail.com" value={resetUser.id} onChange={(e) => setResetUser({ ...resetUser, id: e.target.value })} className="!p-4" />
                      <Button fullWidth onClick={resetUserPassword} disabled={actionLoading} className="!py-4 shadow-lg !bg-amber-500 hover:!bg-amber-600 !text-[#002D62]">Flag for Password Reset</Button>
                    </div>
                  </div>
                </Card>
              </div>
              <div className="col-span-12 lg:col-span-8">
                <Card headerType="primary" headerText="Evaluator Provisioning" className="!p-0 border-none">
                  <div className="p-8">
                    <div className="space-y-4 mb-10">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Input label="Login ID" placeholder="J001" value={newJudge.id} onChange={e => setNewJudge({ ...newJudge, id: e.target.value })} className="!p-4" />
                        <Input label="First Name" placeholder="Dr. Rohan" value={newJudge.firstName} onChange={e => setNewJudge({ ...newJudge, firstName: e.target.value })} className="!p-4" />
                      </div>
                      <Input label="Family Name" placeholder="Sharma" value={newJudge.lastName} onChange={e => setNewJudge({ ...newJudge, lastName: e.target.value })} className="!p-4" />
                      <Button fullWidth onClick={addJudgeAccount} disabled={actionLoading} className="!py-4 shadow-lg">Initialize Account</Button>
                    </div>

                    <div className="border-t border-[#e9ecef] pt-10">
                      <p className="text-xs font-black text-[#002D62] uppercase tracking-[0.2em] mb-6">Active Evaluator Log</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {judges.map(j => (
                          <div key={j.enrollment_no} className="flex justify-between items-center p-4 bg-white border border-[#e9ecef] hover:border-[#FFC300] transition-all">
                            <div className="flex items-center space-x-3">
                              <div className="w-10 h-10 bg-[#002D62] text-white flex items-center justify-center font-black text-sm">{(j.firstName?.[0] || 'J')}</div>
                              <div>
                                <p className="text-xs font-black text-[#002D62] uppercase leading-none">
                                  {j.firstName && j.lastName ? `${j.firstName} ${j.lastName}` : (j.name || j.enrollment_no)}
                                </p>
                                <p className="text-[10px] text-[#FFC300] font-bold mt-1 tracking-widest">{j.enrollment_no}</p>
                              </div>
                            </div>
                            <button onClick={() => deleteJudge(j.enrollment_no)} className="text-gray-300 hover:text-red-500 transition-colors"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          )}

          {activeTab === "evaluation" && (
            <div className="grid grid-cols-12 gap-10">
              <div className="col-span-12 lg:col-span-6 space-y-10">
                <Card headerType="primary" headerText="Evaluation Rounds Registry" className="!p-0 border-none bg-white">
                  <div className="p-8 space-y-6">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                      Define competition stages and their contribution to the final score.
                    </p>
                    <div className="space-y-4">
                      {evalSettings.rounds.map((round) => (
                        <div key={round.id} className="flex items-center gap-4 p-4 bg-gray-50 border border-[#e9ecef]">
                          <div className="flex-1">
                            <p className="text-xs font-black text-[#002D62] uppercase">{round.name}</p>
                            <p className="text-[10px] text-[#FFC300] font-bold tracking-widest">ID: {round.id}</p>
                          </div>
                          <div className="w-24">
                            <label className="text-[8px] font-black text-gray-400 uppercase block mb-1">Weight (multiplier)</label>
                            <input
                              type="number"
                              step="0.1"
                              value={round.weight}
                              onChange={(e) => {
                                const newRounds = evalSettings.rounds.map(r => r.id === round.id ? { ...r, weight: parseFloat(e.target.value) || 0 } : r);
                                updateEvalSettings({ ...evalSettings, rounds: newRounds });
                              }}
                              className="w-full bg-white border border-[#e9ecef] p-2 text-xs font-bold text-[#002D62]"
                            />
                          </div>
                          <button
                            onClick={() => {
                              const newRounds = evalSettings.rounds.filter(r => r.id !== round.id);
                              updateEvalSettings({ ...evalSettings, rounds: newRounds });
                            }}
                            className="text-gray-300 hover:text-red-500 transition-colors"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="pt-6 border-t border-[#e9ecef] grid grid-cols-2 gap-4">
                      <Input placeholder="ROUND NAME (E.G. FINALS)" id="new-round-name" className="!p-3 !text-xs" />
                      <div className="flex gap-2">
                        <Input placeholder="WT (1.0)" id="new-round-weight" type="number" step="0.1" className="!p-3 !text-xs w-20" />
                        <Button
                          fullWidth
                          onClick={() => {
                            const name = (document.getElementById("new-round-name") as HTMLInputElement).value;
                            const weight = parseFloat((document.getElementById("new-round-weight") as HTMLInputElement).value) || 1.0;
                            if (!name) return;
                            const id = name.toLowerCase().replace(/\s+/g, "_");
                            updateEvalSettings({ ...evalSettings, rounds: [...evalSettings.rounds, { id, name, weight }] });
                            (document.getElementById("new-round-name") as HTMLInputElement).value = "";
                          }}
                        >
                          ADD ROUND
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>

              <div className="col-span-12 lg:col-span-6 space-y-10">
                <Card headerType="primary" headerText="Scoring Parameters Blueprint" className="!p-0 border-none bg-white">
                  <div className="p-8 space-y-6">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                      Configure dynamic evaluation criteria and their respective point values.
                    </p>
                    <div className="space-y-4">
                      {evalSettings.criteria.map((cri) => (
                        <div key={cri.id} className="flex items-center gap-4 p-4 bg-gray-50 border border-[#e9ecef]">
                          <div className="flex-1">
                            <p className="text-xs font-black text-[#002D62] uppercase">{cri.name}</p>
                            <p className="text-[10px] text-[#FFC300] font-bold tracking-widest">ID: {cri.id}</p>
                          </div>
                          <div className="w-24">
                            <label className="text-[8px] font-black text-gray-400 uppercase block mb-1">Max Points</label>
                            <input
                              type="number"
                              value={cri.maxPoints}
                              onChange={(e) => {
                                const newCri = evalSettings.criteria.map(c => c.id === cri.id ? { ...c, maxPoints: parseInt(e.target.value) || 0 } : c);
                                updateEvalSettings({ ...evalSettings, criteria: newCri });
                              }}
                              className="w-full bg-white border border-[#e9ecef] p-2 text-xs font-bold text-[#002D62]"
                            />
                          </div>
                          <button
                            onClick={() => {
                              const newCri = evalSettings.criteria.filter(c => c.id !== cri.id);
                              updateEvalSettings({ ...evalSettings, criteria: newCri });
                            }}
                            className="text-gray-300 hover:text-red-500 transition-colors"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="pt-6 border-t border-[#e9ecef] grid grid-cols-2 gap-4">
                      <Input placeholder="CRITERION NAME" id="new-cri-name" className="!p-3 !text-xs" />
                      <div className="flex gap-2">
                        <Input placeholder="MAX" id="new-cri-max" type="number" className="!p-3 !text-xs w-20" />
                        <Button
                          fullWidth
                          onClick={() => {
                            const name = (document.getElementById("new-cri-name") as HTMLInputElement).value;
                            const max = parseInt((document.getElementById("new-cri-max") as HTMLInputElement).value) || 10;
                            if (!name) return;
                            const id = name.toLowerCase().replace(/\s+/g, "_");
                            updateEvalSettings({ ...evalSettings, criteria: [...evalSettings.criteria, { id, name, maxPoints: max }] });
                            (document.getElementById("new-cri-name") as HTMLInputElement).value = "";
                          }}
                        >
                          ADD PARAMETER
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          )}
          {activeTab === "portal" && (
            <div className="flex justify-center">
              <div className="w-full max-w-5xl">
                <Card headerType="primary" headerText="Landing Page Configuration" className="!p-0 border-none bg-white">
                  <div className="p-10 space-y-8">
                    <div className="grid grid-cols-1 gap-8 text-center">
                      <div>
                        <label className="text-xs font-black text-[#002D62] uppercase tracking-widest mb-3 block">Countdown Target Time</label>
                        <p className="text-[10px] text-gray-400 uppercase mb-4 italic mx-auto">Specify the exact moment the timer hits zero (April 16th, 9:00 AM recommended).</p>
                        <Input
                          type="datetime-local"
                          value={portalSettings.targetDate}
                          onChange={e => setPortalSettings({ ...portalSettings, targetDate: e.target.value })}
                          className="!p-6 !text-lg !bg-gray-50 border-2 focus:border-[#002D62]"
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                          <div className="flex flex-col items-center space-y-2">
                            <div className="flex items-center space-x-2">
                              <div className="w-2 h-2 bg-[#FFC300]"></div>
                              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Section Title</label>
                            </div>
                            <Input
                              value={portalSettings.eventScheduleLabel}
                              onChange={e => setPortalSettings({ ...portalSettings, eventScheduleLabel: e.target.value })}
                              className="!p-2 !text-center !text-xs font-black text-[#002D62] uppercase tracking-widest border-2 focus:border-[#002D62]"
                              placeholder="EVENT SCHEDULE"
                            />
                          </div>
                          <textarea
                            value={portalSettings.eventSchedule}
                            onChange={e => setPortalSettings({ ...portalSettings, eventSchedule: e.target.value })}
                            className="w-full bg-gray-50 border-2 border-[#e9ecef] p-6 text-xs font-bold text-[#002D62] h-48 focus:border-[#002D62] outline-none transition-all uppercase leading-relaxed"
                            placeholder="PHASE 01: APRIL 16TH\nFINALS: APRIL 17TH"
                          />
                        </div>

                        <div className="space-y-4">
                          <div className="flex flex-col items-center space-y-2">
                            <div className="flex items-center space-x-2">
                              <div className="w-2 h-2 bg-[#FFC300]"></div>
                              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Section Title</label>
                            </div>
                            <Input
                              value={portalSettings.zoneOperationsLabel}
                              onChange={e => setPortalSettings({ ...portalSettings, zoneOperationsLabel: e.target.value })}
                              className="!p-2 !text-center !text-xs font-black text-[#002D62] uppercase tracking-widest border-2 focus:border-[#002D62]"
                              placeholder="ZONE OPERATIONS"
                            />
                          </div>
                          <textarea
                            value={portalSettings.zoneOperations}
                            onChange={e => setPortalSettings({ ...portalSettings, zoneOperations: e.target.value })}
                            className="w-full bg-gray-50 border-2 border-[#e9ecef] p-6 text-xs font-bold text-[#002D62] h-48 focus:border-[#002D62] outline-none transition-all uppercase leading-relaxed"
                            placeholder="AMITY MAIN CAMPUS\nAUDITORIUM BLOCK"
                          />
                        </div>

                      </div>
                    </div>

                    <div className="pt-8 border-t border-[#e9ecef] grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="bg-white p-6 border border-[#e9ecef] flex items-center justify-between">
                        <div>
                          <p className="text-[10px] font-black text-[#002D62] uppercase tracking-widest mb-1">In-House Scenario Release</p>
                          <p className="text-[9px] text-gray-400 font-bold uppercase tracking-tighter">Control visibility for internal teams</p>
                        </div>
                        <button
                          onClick={() => setPortalSettings({ ...portalSettings, internalStatementsReleased: !portalSettings.internalStatementsReleased })}
                          className={`px-6 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${portalSettings.internalStatementsReleased ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-400'}`}
                        >
                          {portalSettings.internalStatementsReleased ? 'RELEASED' : 'STAGED'}
                        </button>
                      </div>

                      <div className="bg-white p-6 border border-[#e9ecef] flex items-center justify-between">
                        <div>
                          <p className="text-[10px] font-black text-[#002D62] uppercase tracking-widest mb-1">External Scenario Release</p>
                          <p className="text-[9px] text-gray-400 font-bold uppercase tracking-tighter">Control visibility for external teams</p>
                        </div>
                        <button
                          onClick={() => setPortalSettings({ ...portalSettings, externalStatementsReleased: !portalSettings.externalStatementsReleased })}
                          className={`px-6 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${portalSettings.externalStatementsReleased ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-400'}`}
                        >
                          {portalSettings.externalStatementsReleased ? 'RELEASED' : 'STAGED'}
                        </button>
                      </div>

                      <div className="bg-white p-6 border border-[#e9ecef] flex items-center justify-between">
                        <div>
                          <p className="text-[10px] font-black text-[#002D62] uppercase tracking-widest mb-1">Internal Registrations</p>
                          <p className="text-[9px] text-gray-400 font-bold uppercase tracking-tighter">Allow Amity students to register</p>
                        </div>
                        <button
                          onClick={() => setPortalSettings({ ...portalSettings, internalRegistrationsOpen: !portalSettings.internalRegistrationsOpen })}
                          className={`px-6 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${portalSettings.internalRegistrationsOpen ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}
                        >
                          {portalSettings.internalRegistrationsOpen ? 'OPEN' : 'CLOSED'}
                        </button>
                      </div>

                      <div className="bg-white p-6 border border-[#e9ecef] flex items-center justify-between">
                        <div>
                          <p className="text-[10px] font-black text-[#002D62] uppercase tracking-widest mb-1">External Registrations</p>
                          <p className="text-[9px] text-gray-400 font-bold uppercase tracking-tighter">Allow other college students to register</p>
                        </div>
                        <button
                          onClick={() => setPortalSettings({ ...portalSettings, externalRegistrationsOpen: !portalSettings.externalRegistrationsOpen })}
                          className={`px-6 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${portalSettings.externalRegistrationsOpen ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}
                        >
                          {portalSettings.externalRegistrationsOpen ? 'OPEN' : 'CLOSED'}
                        </button>
                      </div>
                    </div>

                    <div className="pt-6 border-t border-[#e9ecef] flex justify-center">
                      <Button
                        onClick={updatePortalSettings}
                        disabled={actionLoading}
                        className="!py-6 !px-16 !text-lg shadow-amity"
                      >
                        {actionLoading ? "SYNCHRONIZING..." : "SYNCHRONIZE LANDING PAGE"}
                      </Button>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          )}
          {activeTab === "security" && (
            <div className="flex justify-center">
              <div className="w-full max-w-2xl">
                <Card headerType="primary" headerText="Security & Access Protocol" className="!p-0 border-none bg-white">
                  <div className="p-10 space-y-10">
                    <div>
                      <h4 className="text-sm font-black text-[#002D62] uppercase tracking-widest mb-4">Update Administrative Credentials</h4>
                      <p className="text-[10px] text-gray-400 uppercase tracking-widest leading-relaxed mb-8">
                        Ensure your access key is rotated periodically for maximum security. Use a complex alphanumeric string.
                      </p>
                      
                      <div className="space-y-6">
                        <Input 
                          label="NEW ACCESS KEY (PASSWORD)" 
                          type="password" 
                          placeholder="••••••••" 
                          value={adminPassUpdate.newPass}
                          onChange={e => setAdminPassUpdate({...adminPassUpdate, newPass: e.target.value})}
                        />
                        <Input 
                          label="CONFIRM ACCESS KEY" 
                          type="password" 
                          placeholder="••••••••" 
                          value={adminPassUpdate.confirmPass}
                          onChange={e => setAdminPassUpdate({...adminPassUpdate, confirmPass: e.target.value})}
                        />
                        <div className="pt-4">
                          <Button 
                            fullWidth 
                            onClick={handleAdminPasswordChange} 
                            disabled={actionLoading}
                            className="shadow-lg"
                          >
                            {actionLoading ? "Synchronizing..." : "Update Credentials"}
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="pt-10 border-t border-[#e9ecef]">
                      <h4 className="text-sm font-black text-[#002D62] uppercase tracking-widest mb-4">Multi-Factor Authentication (2FA)</h4>
                      
                      {!appUser?.twoFactorEnabled && !is2FASetupMode && (
                        <div className="bg-amber-50 border border-amber-100 p-6 rounded-md">
                          <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest mb-2">Security Recommendation</p>
                          <p className="text-xs text-amber-600 mb-4 leading-relaxed">Two-factor authentication adds an extra layer of security to your account. To log in, you'll need to provide a 6-digit code from your authenticator app.</p>
                          <Button onClick={start2FASetup} disabled={actionLoading} className="!bg-amber-500 hover:!bg-amber-600 !text-white !py-3 !px-8">Setup 2FA</Button>
                        </div>
                      )}

                      {is2FASetupMode && (
                        <div className="bg-gray-50 border border-gray-200 p-6 rounded-md space-y-6">
                          <div className="flex flex-col md:flex-row items-center gap-8">
                            {qrCodeUrl && (
                              <div className="p-4 bg-white border-2 border-gray-100 rounded-lg shrink-0">
                                <img src={qrCodeUrl} alt="2FA QR Code" className="w-40 h-40" />
                              </div>
                            )}
                            <div className="space-y-4">
                              <p className="text-xs font-bold text-[#002D62] uppercase tracking-widest">1. Scan this code</p>
                              <p className="text-[10px] text-gray-400 leading-relaxed italic uppercase">Open your authenticator app (Google Authenticator, Authy, etc.) and scan the QR code above or enter the secret manually: <br/><span className="font-mono font-black text-[#002D62] mt-1 block select-all">{twoFactorSecret}</span></p>
                            </div>
                          </div>
                          
                          <div className="pt-4 border-t border-gray-200">
                            <p className="text-xs font-bold text-[#002D62] uppercase tracking-widest mb-4">2. Verify setup</p>
                            <div className="flex gap-4">
                              <Input 
                                placeholder="ENTER 6-DIGIT CODE" 
                                value={twoFactorToken}
                                onChange={e => setTwoFactorToken(e.target.value)}
                                className="!p-4 !text-center !font-mono !text-lg !tracking-[0.5em]"
                                maxLength={6}
                              />
                              <Button onClick={verifyAndEnable2FA} disabled={actionLoading} className="!px-10">Activate</Button>
                            </div>
                            <button onClick={() => setIs2FASetupMode(false)} className="text-[10px] font-black text-gray-400 hover:text-red-500 uppercase tracking-widest mt-4">Cancel Setup</button>
                          </div>
                        </div>
                      )}

                      {appUser?.twoFactorEnabled && (
                        <div className="bg-green-50 border border-green-100 p-6 rounded-md flex justify-between items-center">
                          <div>
                            <p className="text-[10px] font-black text-green-600 uppercase tracking-widest mb-1">Status: Active</p>
                            <p className="text-xs font-bold text-green-800 uppercase leading-none">2FA Protection is Enabled</p>
                          </div>
                          <button onClick={disable2FA} disabled={actionLoading} className="text-[10px] font-black text-red-400 hover:text-red-600 uppercase tracking-widest transition-all">Disable 2FA</button>
                        </div>
                      )}
                    </div>

                    <div className="pt-10 border-t border-[#e9ecef]">
                      <h4 className="text-sm font-black text-[#002D62] uppercase tracking-widest mb-4">Platform Hardening Status</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="p-4 bg-green-50 border-l-4 border-green-500">
                          <p className="text-[10px] font-black text-green-600 uppercase mb-1">Pass-key Encryption</p>
                          <p className="text-xs font-bold text-green-800">SHA-256 ACTIVE</p>
                        </div>
                        <div className="p-4 bg-blue-50 border-l-4 border-blue-500">
                          <p className="text-[10px] font-black text-blue-600 uppercase mb-1">Access Control</p>
                          <p className="text-xs font-bold text-blue-800">FIRESTORE RULES ACTIVE</p>
                        </div>
                        {appUser?.twoFactorEnabled && (
                          <div className="p-4 bg-amber-50 border-l-4 border-amber-500 sm:col-span-2">
                             <p className="text-[10px] font-black text-amber-600 uppercase mb-1">Identity Protocol</p>
                             <p className="text-xs font-bold text-amber-800">MULTI-FACTOR AUTH (TOTP) ACTIVE</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          )}
          {activeTab === "export" && (
            <div className="space-y-10">
              <Card className="!p-0 border-none overflow-hidden">
                <div className="bg-[#002D62] p-6 md:p-10 text-white">
                  <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#FFC300] mb-2">Data Registry</p>
                  <h2 className="text-2xl md:text-4xl font-black uppercase tracking-tight">Export Center</h2>
                  <p className="text-gray-400 text-sm mt-2">Download live Firestore data as structured CSV files. All files are named with today's date.</p>
                </div>

                <div className="p-6 md:p-10 space-y-10">

                  {/* Master Export */}
                  <div className="bg-[#002D62] p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#FFC300] mb-1">Full Data Dump</p>
                      <p className="text-white text-lg font-black uppercase">Export Everything</p>
                      <p className="text-gray-400 text-xs mt-1">Downloads all 5 CSV files in sequence: Internal Teams, External Teams, All Members, Raw Evaluations, Leaderboard.</p>
                    </div>
                    <button
                      onClick={exportAll}
                      disabled={exportLoading}
                      className="shrink-0 bg-[#FFC300] text-[#002D62] font-black uppercase tracking-widest text-xs px-10 py-4 hover:bg-white transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                      {exportLoading ? "Exporting..." : "Download All CSVs"}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                    {/* Teams */}
                    <div className="border-t-4 border-t-[#002D62] bg-white p-8 space-y-4">
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-[#FFC300]">Teams Registry</p>
                        <h3 className="text-sm font-black uppercase text-[#002D62]">Team Data</h3>
                        <p className="text-xs text-gray-400 mt-1">Name, Leader, Members, Problem Statement, Scores, Phase, Lock Status.</p>
                      </div>
                      <div className="flex flex-col gap-2">
                        <button onClick={() => exportTeams("internal")} className="w-full py-3 px-4 bg-blue-50 text-blue-700 border border-blue-200 text-xs font-black uppercase tracking-widest hover:bg-blue-700 hover:text-white transition-colors text-left">
                          ↓ Internal Teams (Amity)
                        </button>
                        <button onClick={() => exportTeams("external")} className="w-full py-3 px-4 bg-orange-50 text-orange-700 border border-orange-200 text-xs font-black uppercase tracking-widest hover:bg-orange-700 hover:text-white transition-colors text-left">
                          ↓ External Teams (Other Colleges)
                        </button>
                        <button onClick={() => exportTeams("all")} className="w-full py-3 px-4 bg-gray-50 text-gray-700 border border-gray-200 text-xs font-black uppercase tracking-widest hover:bg-gray-700 hover:text-white transition-colors text-left">
                          ↓ All Teams Combined
                        </button>
                      </div>
                    </div>

                    {/* Members */}
                    <div className="border-t-4 border-t-[#FFC300] bg-white p-8 space-y-4">
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-[#002D62]">Participants Registry</p>
                        <h3 className="text-sm font-black uppercase text-[#002D62]">Member Profiles</h3>
                        <p className="text-xs text-gray-400 mt-1">Full name, enrollment, email, mobile, gender, team, domain, course, specialization, college, city.</p>
                      </div>
                      <button
                        onClick={exportMembers}
                        disabled={exportLoading}
                        className="w-full py-3 px-4 bg-amber-50 text-amber-700 border border-amber-200 text-xs font-black uppercase tracking-widest hover:bg-amber-700 hover:text-white transition-colors text-left disabled:opacity-50"
                      >
                        {exportLoading ? "Fetching..." : "↓ All Member Profiles"}
                      </button>
                    </div>

                    {/* Evaluations */}
                    <div className="border-t-4 border-t-green-500 bg-white p-8 space-y-4">
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-green-600">Evaluation Records</p>
                        <h3 className="text-sm font-black uppercase text-[#002D62]">Raw Scores</h3>
                        <p className="text-xs text-gray-400 mt-1">Every score entry: team, judge ID, innovation, tech, pitch, and total per evaluation.</p>
                      </div>
                      <button onClick={exportEvaluations} className="w-full py-3 px-4 bg-green-50 text-green-700 border border-green-200 text-xs font-black uppercase tracking-widest hover:bg-green-700 hover:text-white transition-colors text-left">
                        ↓ Raw Evaluation Data
                      </button>
                    </div>

                    {/* Leaderboard */}
                    <div className="border-t-4 border-t-purple-500 bg-white p-8 space-y-4">
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-purple-600">Aggregated Rankings</p>
                        <h3 className="text-sm font-black uppercase text-[#002D62]">Leaderboard</h3>
                        <p className="text-xs text-gray-400 mt-1">Average scores per team, ranked by total. Separate exports for internal and external.</p>
                      </div>
                      <div className="flex flex-col gap-2">
                        <button onClick={() => exportLeaderboard()} className="w-full py-3 px-4 bg-purple-50 text-purple-700 border border-purple-200 text-xs font-black uppercase tracking-widest hover:bg-purple-700 hover:text-white transition-colors text-left">
                          ↓ Full Leaderboard
                        </button>
                        <button onClick={() => exportLeaderboard("internal")} className="w-full py-3 px-4 bg-blue-50 text-blue-700 border border-blue-200 text-xs font-black uppercase tracking-widest hover:bg-blue-700 hover:text-white transition-colors text-left">
                          ↓ Internal Leaderboard
                        </button>
                        <button onClick={() => exportLeaderboard("external")} className="w-full py-3 px-4 bg-orange-50 text-orange-700 border border-orange-200 text-xs font-black uppercase tracking-widest hover:bg-orange-700 hover:text-white transition-colors text-left">
                          ↓ External Leaderboard
                        </button>
                      </div>
                    </div>

                  </div>

                  {/* Info note */}
                  <div className="border border-[#FFC300]/40 bg-[#fffbea] p-6 flex gap-4">
                    <svg className="w-5 h-5 text-[#FFC300] shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
                    <p className="text-xs text-gray-600 leading-relaxed">
                      All exports are generated from <strong>live Firestore data</strong>. Files open correctly in Microsoft Excel, Google Sheets, and LibreOffice Calc. UTF-8 BOM is included for proper character encoding.
                    </p>
                  </div>

                </div>
              </Card>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
