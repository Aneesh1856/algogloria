"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import { collection, query, where, getDocs, doc, setDoc } from "firebase/firestore";
import { GlassCard as Card } from "@/components/GlassCard";
import { Button } from "@/components/Button";

interface Team {
  id: string;
  team_name: string;
  leader_id: string;
  problem_statement_id: string | null;
  isLocked: boolean;
}

interface Evaluation {
  team_id: string;
  judge_id: string;
  round_id: string;
  criteria_scores: Record<string, number>;
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

export default function EvaluatorPage() {
  const router = useRouter();
  const { user, appUser, loading } = useAuth();

  const [teams, setTeams] = useState<Team[]>([]);
  const [evaluations, setEvaluations] = useState<Record<string, Evaluation>>({});
  const [problems, setProblems] = useState<Record<string, string>>({});
  const [evalSettings, setEvalSettings] = useState<EvaluationSettings>({
    rounds: [],
    criteria: []
  });
  const [selectedRoundId, setSelectedRoundId] = useState<string>("");
  const [fetching, setFetching] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [syncedTeamId, setSyncedTeamId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!loading) {
      if (!user || appUser?.role !== "evaluator") {
        router.push("/auth");
        return;
      }
      loadEvaluatorData();
    }
  }, [loading, user, appUser]);

  const loadEvaluatorData = async () => {
    if (!appUser) return;
    setFetching(true);
    try {
      const psSnap = await getDocs(collection(db, "problems"));
      const psMap: Record<string, string> = {};
      psSnap.docs.forEach(d => {
        psMap[d.id] = d.data().title;
      });
      setProblems(psMap);

      const teamsQuery = query(collection(db, "teams"), where("isLocked", "==", true));
      const teamsSnap = await getDocs(teamsQuery);
      const teamsList = teamsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Team));
      setTeams(teamsList);

      const settingsSnap = await getDocs(collection(db, "settings"));
      const evalSettingsDoc = settingsSnap.docs.find(d => d.id === "evaluation");
      if (evalSettingsDoc) {
        const sData = evalSettingsDoc.data() as EvaluationSettings;
        setEvalSettings(sData);
        if (sData.rounds.length > 0 && !selectedRoundId) {
          setSelectedRoundId(sData.rounds[0].id);
        }
      }

      const evQuery = query(collection(db, "evaluations"), where("judge_id", "==", appUser.enrollment_no));
      const evSnap = await getDocs(evQuery);
      const evMap: Record<string, Evaluation> = {};
      evSnap.docs.forEach(d => {
        const data = d.data() as Evaluation;
        // Map evaluations for the current team so we can find them across rounds if needed,
        // but for the UI we'll primarily care about the selected round's evaluations.
        if (selectedRoundId && data.round_id === selectedRoundId) {
          evMap[data.team_id] = data;
        } else if (!selectedRoundId && data.round_id) {
           // Fallback to first available round if none selected
           evMap[data.team_id] = data;
        }
      });
      setEvaluations(evMap);

    } catch (err: any) {
      console.error(err);
    } finally {
      setFetching(false);
    }
  };

  // Re-load evaluations when round changes
  useEffect(() => {
    if (appUser) {
      loadEvaluationsForRound();
    }
  }, [selectedRoundId]);

  const loadEvaluationsForRound = async () => {
    if (!appUser || !selectedRoundId) return;
    try {
      const evQuery = query(
        collection(db, "evaluations"), 
        where("judge_id", "==", appUser.enrollment_no),
        where("round_id", "==", selectedRoundId)
      );
      const evSnap = await getDocs(evQuery);
      const evMap: Record<string, Evaluation> = {};
      evSnap.docs.forEach(d => {
        evMap[d.data().team_id] = d.data() as Evaluation;
      });
      setEvaluations(evMap);
    } catch (err) { console.error(err); }
  };

  const handleScoreChange = (teamId: string, criterionId: string, value: string) => {
    const criterion = evalSettings.criteria.find(c => c.id === criterionId);
    if (!criterion) return;

    const numericValue = Math.min(criterion.maxPoints, Math.max(0, parseInt(value) || 0));

    setEvaluations(prev => {
      const existing = prev[teamId] || {
        team_id: teamId,
        judge_id: appUser!.enrollment_no,
        round_id: selectedRoundId,
        criteria_scores: {},
        total_score: 0
      };

      const newScores = { ...(existing.criteria_scores || {}), [criterionId]: numericValue };
      const newTotal = Object.values(newScores).reduce((a, b) => a + b, 0);

      return { 
        ...prev, 
        [teamId]: { 
          ...existing, 
          criteria_scores: newScores, 
          total_score: newTotal 
        } 
      };
    });
  };

  const saveEvaluation = async (teamId: string) => {
    const evaluation = evaluations[teamId];
    if (!evaluation) return;

    setSaving(teamId);
    try {
      const evId = `${teamId}_${appUser?.enrollment_no}_${selectedRoundId}`;
      await setDoc(doc(db, "evaluations", evId), evaluation);
      setSyncedTeamId(teamId);
      setTimeout(() => setSyncedTeamId(null), 2000);
    } catch (err: any) {
      console.error(err);
    } finally {
      setSaving(null);
    }
  };

  const filteredTeams = teams.filter(team => 
    team.team_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    team.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading || fetching) return <div className="min-h-screen bg-[#e0e0e0] flex items-center justify-center">
    <div className="animate-spin rounded-full h-8 w-8 border-b-4 border-[#002D62]"></div>
  </div>;

  return (
    <div className="min-h-screen bg-[#e0e0e0] pb-20 w-full max-w-full overflow-hidden">
      <div className="max-w-7xl mx-auto pt-10 px-4 sm:px-6 w-full">

        {/* Header Console */}
        <Card className="!p-0 border-none mb-10 overflow-hidden">
          <div className="bg-[#002D62] p-12 text-white flex flex-col items-center justify-center relative min-h-[200px] text-center">
            <div className="z-10">
              <h2 className="text-3xl sm:text-5xl font-bold uppercase tracking-tighter leading-none mb-6 break-words">Evaluation Master Console</h2>
            </div>
          </div>

          {/* Filter & Round Bar */}
          <div className="bg-white px-4 sm:px-10 py-6 border-b border-[#e9ecef] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 sm:gap-0">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 w-full sm:w-auto">
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Active Round</label>
                <div className="relative group">
                  <select 
                    value={selectedRoundId}
                    onChange={(e) => setSelectedRoundId(e.target.value)}
                    className="bg-[#f8f9fa] border-2 border-[#e9ecef] pl-6 pr-12 py-3 text-xs font-bold text-[#002D62] outline-none focus:border-[#FFC300] transition-all uppercase tracking-widest min-w-[300px] cursor-pointer appearance-none shadow-sm group-hover:bg-white"
                  >
                    <option value="" disabled>CHOOSE ROUND...</option>
                    {evalSettings.rounds.map(r => (
                      <option key={r.id} value={r.id}>{r.name} (WT: {r.weight})</option>
                    ))}
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-[#002D62] transition-transform group-hover:translate-y-[-40%]">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
                {evalSettings.rounds.length === 0 && !fetching && (
                  <p className="text-[10px] font-bold text-red-500 mt-2 uppercase animate-pulse">
                    ⚠ Warning: No evaluation rounds defined in architect.
                  </p>
                )}
              </div>
            </div>
            <div className="w-full sm:w-auto self-end sm:self-center">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2 sm:text-right">Filtering</label>
              <input 
                placeholder="SEARCH NODE ID..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-[#f2f4f6] border-2 border-[#e9ecef] px-4 py-3 text-[10px] font-bold text-[#002D62] outline-none focus:border-[#FFC300] transition-all uppercase tracking-widest w-full sm:w-64" 
              />
            </div>
          </div>
        </Card>

        <div className="mt-10">
          <Card headerType="primary" headerText="Field Evaluation Matrix" className="!p-0 border-none">
            <div className="block md:hidden space-y-4 p-4 bg-[#f8f9fa] min-h-[400px]">
              {filteredTeams.length === 0 ? (
                <div className="py-20 text-center text-xs font-bold text-gray-400 uppercase tracking-widest">
                  {searchQuery ? "No matching nodes found for search criteria." : "System Standby: No nodes currently available for processing."}
                </div>
              ) : (
                filteredTeams.map((team) => {
                  const ev = evaluations[team.id] || { criteria_scores: {}, total_score: 0 };
                  const maxPossible = evalSettings.criteria.reduce((a, b) => a + b.maxPoints, 0);
                  return (
                    <div key={team.id} className="bg-white rounded-none p-4 shadow-sm border border-[#e9ecef] flex flex-col gap-4">
                      <div className="border-b border-[#e9ecef] pb-3">
                        <p className="text-sm font-bold text-[#002D62] uppercase tracking-wide">{team.team_name}</p>
                        <p className="text-[10px] text-gray-400 font-bold uppercase mt-1 tracking-tighter">
                          ID: {team.id.substring(0, 8)} | {team.problem_statement_id ? (problems[team.problem_statement_id] || "STMT REGISTERED") : "NO STMT"}
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        {evalSettings.criteria.map(cri => (
                          <div key={cri.id} className="flex flex-col border border-[#e9ecef] p-2 bg-gray-50 text-center">
                            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1 truncate">{cri.name}</label>
                            <input 
                              type="number" 
                              min="0" 
                              max={cri.maxPoints} 
                              value={ev.criteria_scores?.[cri.id] || 0} 
                              onChange={(e) => handleScoreChange(team.id, cri.id, e.target.value)} 
                              className="w-full text-center bg-white border border-[#e9ecef] text-xs font-bold text-[#333333] outline-none py-1 focus:border-[#FFC300]" 
                            />
                          </div>
                        ))}
                      </div>
                      <div className="flex flex-col items-center">
                        <div className="flex items-center justify-between w-full mb-1">
                          <span className="text-[9px] font-bold text-gray-400 uppercase">Aggregate Score</span>
                          <span className="text-xl font-bold text-[#002D62] italic leading-none">{ev.total_score}</span>
                        </div>
                        <div className="w-full h-1 bg-gray-100 overflow-hidden">
                          <div className="h-full bg-[#FFC300] transition-all duration-500" style={{ width: `${(ev.total_score / (maxPossible || 1)) * 100}%` }}></div>
                        </div>
                      </div>
                      <Button onClick={() => saveEvaluation(team.id)} disabled={saving === team.id || !selectedRoundId} variant={syncedTeamId === team.id ? "success" : evaluations[team.id] ? "secondary" : "primary"} className="w-full !py-3 !text-[10px]">
                        {!selectedRoundId ? "SELECT ROUND" : saving === team.id ? "SYNCING..." : syncedTeamId === team.id ? "LOG SYNCHRONIZED" : evaluations[team.id] ? "UPDATE LOG" : "COMMIT LOG"}
                      </Button>
                    </div>
                  );
                })
              )}
            </div>
            <div className="hidden md:block overflow-x-auto">
              <table className="amity-table">
                <thead>
                  <tr className="border-b-4 border-[#FFC300]">
                    <th className="px-10">Target Node</th>
                    {evalSettings.criteria.map(cri => (
                      <th key={cri.id} className="text-center">{cri.name} ({cri.maxPoints})</th>
                    ))}
                    <th className="text-center">Aggregate</th>
                    <th className="px-10 text-center">Synchronization</th>
                  </tr>
                </thead>
                <tbody>
                   {filteredTeams.length === 0 ? (
                    <tr>
                      <td colSpan={evalSettings.criteria.length + 3} className="px-10 py-20 text-center text-xs font-bold text-gray-400 uppercase tracking-widest">
                        {searchQuery ? "No matching nodes found for search criteria." : "System Standby: No nodes currently available for processing."}
                      </td>
                    </tr>
                  ) : (
                    filteredTeams.map((team) => {
                      const ev = evaluations[team.id] || { criteria_scores: {}, total_score: 0 };
                      const maxPossible = evalSettings.criteria.reduce((a, b) => a + b.maxPoints, 0);
                      return (
                        <tr key={team.id} className="border-b border-[#e9ecef]">
                          <td className="px-10 py-8">
                            <p className="text-sm font-bold text-[#002D62] uppercase tracking-wide">{team.team_name}</p>
                            <p className="text-[10px] text-gray-400 font-bold uppercase mt-1 tracking-tighter">
                              ID: {team.id.substring(0, 8)} | {team.problem_statement_id ? (problems[team.problem_statement_id] || "STMT REGISTERED") : "NO STMT"}
                            </p>
                          </td>
                          {evalSettings.criteria.map(cri => (
                            <td key={cri.id} className="py-8 text-center">
                              <input
                                type="number"
                                min="0" max={cri.maxPoints}
                                value={ev.criteria_scores?.[cri.id] || 0}
                                onChange={(e) => handleScoreChange(team.id, cri.id, e.target.value)}
                                className="w-16 h-12 text-center bg-white border-2 border-[#e9ecef] text-sm font-bold text-[#333333] outline-none focus:border-[#FFC300] transition-all"
                              />
                            </td>
                          ))}
                          <td className="py-8 text-center">
                            <div className="flex flex-col items-center">
                              <span className="text-xl font-bold text-[#002D62] italic leading-none mb-2">{ev.total_score}</span>
                              <div className="w-16 h-1.5 bg-gray-100 overflow-hidden">
                                <div
                                  className="h-full bg-[#FFC300] transition-all duration-500"
                                  style={{ width: `${(ev.total_score / (maxPossible || 1)) * 100}%` }}
                                ></div>
                              </div>
                            </div>
                          </td>
                          <td className="px-10 py-8 text-center">
                            <div className="flex justify-center">
                              <Button
                                onClick={() => saveEvaluation(team.id)}
                                disabled={saving === team.id || !selectedRoundId}
                                variant={syncedTeamId === team.id ? "success" : evaluations[team.id] ? "secondary" : "primary"}
                                className="!px-6 !py-3 !text-[10px]"
                              >
                                {!selectedRoundId ? "SELECT ROUND" : saving === team.id ? "SYNCING..." : syncedTeamId === team.id ? "LOG SYNCHRONIZED" : evaluations[team.id] ? "UPDATE LOG" : "COMMIT LOG"}
                              </Button>
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
      </div>
    </div>
  );
}
