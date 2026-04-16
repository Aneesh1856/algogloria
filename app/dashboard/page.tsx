"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import { doc, getDoc, collection, query, where, getDocs, onSnapshot, updateDoc, arrayUnion, arrayRemove, setDoc, deleteDoc } from "firebase/firestore";
import Link from "next/link";
import { GlassCard as Card } from "@/components/GlassCard";
import { Button } from "@/components/Button";

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
}

interface TeamMember {
    enrollment_no: string;
    name: string;
    isInvited: boolean;
    isPasswordSet: boolean;
}

interface Problem {
    id: string;
    title: string;
    description: string;
}

export default function DashboardPage() {
    const router = useRouter();
    const { user, appUser, loading } = useAuth();

    const [team, setTeam] = useState<Team | null>(null);
    const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
    const [problem, setProblem] = useState<Problem | null>(null);
    const [fetching, setFetching] = useState(true);
    const [activeTab, setActiveTab] = useState("Team Details");
    const [newTeamName, setNewTeamName] = useState("");
    const [newMemberEnrollment, setNewMemberEnrollment] = useState("");
    const [updating, setUpdating] = useState(false);
    const [memberUpdating, setMemberUpdating] = useState(false);
    const [success, setSuccess] = useState("");
    const [error, setError] = useState("");

    useEffect(() => {
        if (loading) return;
        if (!user || !appUser) {
            router.push("/auth");
            return;
        }
        if (appUser.role === "admin") {
            router.push("/admin");
            return;
        }
        if (appUser.role === "evaluator") {
            router.push("/evaluator");
            return;
        }

        if (!appUser.team_id) {
            setFetching(false);
            return;
        }

        // Set up real-time listener for team data
        let unsubMembers: (() => void) | undefined;

        const unsubTeam = onSnapshot(doc(db, "teams", appUser.team_id), async (docSnap) => {
            if (docSnap.exists()) {
                const teamData = { id: docSnap.id, ...docSnap.data() } as Team;
                setTeam(teamData);
                setNewTeamName(teamData.team_name);

                // Fetch Members in real-time
                if (unsubMembers) unsubMembers();
                const membersQuery = query(collection(db, "users"), where("team_id", "==", teamData.id));
                unsubMembers = onSnapshot(membersQuery, (membersSnap) => {
                    const fetchedMembers = membersSnap.docs.map(d => {
                        const data = d.data();
                        return {
                            enrollment_no: data.enrollment_no,
                            name: data.firstName ? `${data.firstName} ${data.lastName}` : (data.name || "Not Set"),
                            isInvited: data.isInvited,
                            isPasswordSet: data.isPasswordSet
                        };
                    });
                    setTeamMembers(fetchedMembers);
                });

                // Fetch Problem Statement (One-time is okay as it's linked to team snapshot)
                if (teamData.problem_statement_id) {
                    const probDoc = await getDoc(doc(db, "problems", teamData.problem_statement_id));
                    if (probDoc.exists()) {
                        setProblem({ id: probDoc.id, ...probDoc.data() } as Problem);
                    }
                } else {
                    setProblem(null);
                }
            }
            setFetching(false);
        });

        return () => {
            unsubTeam();
            if (unsubMembers) unsubMembers();
        };
    }, [loading, user, appUser]);

    const handleUpdateTeamName = async () => {
        if (!team || !newTeamName.trim()) return;
        setUpdating(true);
        setSuccess("");
        setError("");
        try {
            const normalizedName = newTeamName.trim();
            
            // Check for uniqueness
            const teamQuery = query(collection(db, "teams"), where("team_name", "==", normalizedName));
            const teamSnap = await getDocs(teamQuery);
            
            // If any team found that isn't THIS team
            const isDuplicate = teamSnap.docs.some(d => d.id !== team.id);
            
            if (isDuplicate) {
                setError(`Designation "${normalizedName.toUpperCase()}" is already assigned to another sector.`);
                setUpdating(false);
                return;
            }

            await updateDoc(doc(db, "teams", team.id), { team_name: normalizedName });
            setSuccess("UPDATED");
            setTimeout(() => setSuccess(""), 2000);
        } catch (err: any) {
            setError("Failed to update team identity.");
        } finally {
            setUpdating(false);
        }
    };

    const handleAddMember = async () => {
        if (!team || !newMemberEnrollment.trim()) return;
        if (teamMembers.length >= 4) {
            setError("Team capacity at maximum threshold (4).");
            return;
        }
        setMemberUpdating(true);
        setError("");
        setSuccess("");
        try {
            const enrollId = newMemberEnrollment.trim().toUpperCase();

            // Check if user already in a team
            const userRef = doc(db, "users", enrollId);
            const userSnap = await getDoc(userRef);

            if (userSnap.exists() && userSnap.data().team_id) {
                setError(`Operative ${enrollId} is already assigned to a sector.`);
                setMemberUpdating(false);
                return;
            }

            // Update Team
            await updateDoc(doc(db, "teams", team.id), {
                members: arrayUnion(enrollId)
            });

            // Update or Create User
            if (userSnap.exists()) {
                await updateDoc(userRef, { team_id: team.id });
            } else {
                await setDoc(userRef, {
                    enrollment_no: enrollId,
                    team_id: team.id,
                    isInvited: true,
                    isPasswordSet: false,
                    role: "user"
                });
            }

            setNewMemberEnrollment("");
            setSuccess("Operative added to roster.");
        } catch (err: any) {
            setError("Failed to add personnel to roster.");
        } finally {
            setMemberUpdating(false);
        }
    };

    const handleRemoveMember = async (enrollId: string) => {
        if (!team || enrollId === team.leader_id) return;
        
        // Ensure at least 2 members (Leader + at least 1 other)
        if (team.members.length <= 1) {
            setError("Team must maintain at least 2 members (Leader + 1 operative).");
            return;
        }

        if (!confirm(`Confirm removal of Operative ${enrollId} from sector?`)) return;

        setMemberUpdating(true);
        setError("");
        setSuccess("");
        try {
            // Update Team Record
            await updateDoc(doc(db, "teams", team.id), {
                members: arrayRemove(enrollId)
            });

            // Target Removal: Totally delete the user record to allow re-entry/re-linking
            await deleteDoc(doc(db, "users", enrollId));

            setSuccess("Personnel removed from roster.");
        } catch (err: any) {
            setError("Failed to remove personnel.");
        } finally {
            setMemberUpdating(false);
        }
    };

    if (fetching || loading) return <div className="min-h-screen flex items-center justify-center bg-[#e0e0e0]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-4 border-[#002D62]"></div>
    </div>;
    if (!appUser) return null;

    // ── External Phase: Pending Approval Gate ──────────────────────────
    // For external teams (newly registered from other colleges) who have not yet been verified.
    const isExternalUser = (team?.competition_phase === "external") ||
        (appUser as any).competition_phase === "external";
    const isVerified = team?.isVerified;
    const isInHouseFinalist = team?.competition_phase === "internal" && team?.isExternalEligible;

    // Pending approval screen removed per user request
    const isLeader = team?.leader_id === appUser.enrollment_no;
    // isFinalized: team has at least one member (invite status is irrelevant for lock-in access)
    const isFinalized = teamMembers.length > 0;

    return (
        <div className="min-h-screen bg-[#e0e0e0] pb-20 w-full max-w-full overflow-hidden">
            <div className="max-w-6xl mx-auto pt-10 px-4 sm:px-6 w-full">

                {/* Breadcrumb */}
                <div className="mb-8">
                    <Link href="/dashboard" className="text-[#002D62] text-xs font-bold uppercase tracking-widest flex items-center hover:text-[#FFC300] transition-colors">
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" />
                        </svg>
                        Portal Home / <span className="text-[#333333] ml-2 font-normal">Team Dashboard</span>
                    </Link>
                </div>

                {/* Dynamic Header Section */}
                <Card className="!p-0 border-none mb-10">
                    <div className="bg-[#002D62] p-8 text-white flex justify-between items-center relative overflow-hidden">
                        <div className="flex items-center space-x-6 z-10">
                            <div className="bg-[#FFC300] w-1.5 h-16"></div>
                            <div>
                                <h2 className="text-2xl sm:text-4xl font-bold uppercase tracking-tight leading-none mb-2 break-words">{team?.team_name || "JOINING PHASE..."}</h2>
                                <div className="flex items-center flex-wrap gap-2 sm:gap-4">
                                    <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#FFC300]">Operational Sector: Amity Bengaluru Main Campus</span>
                                    {isExternalUser && isVerified && (
                                        <span className="px-3 py-1 bg-[#FFC300] text-[#002D62] text-[9px] font-black uppercase tracking-widest">
                                            ✓ Confirmed Finalist — External
                                        </span>
                                    )}
                                    {isInHouseFinalist && (
                                        <span className="px-3 py-1 bg-white text-[#002D62] text-[9px] font-black uppercase tracking-widest">
                                            ✓ Confirmed Finalist — In-House
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Stats Sub-row */}
                    <div className="bg-white p-0 grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-[#e9ecef]">
                        {[
                            { label: "Stability Index", value: isFinalized ? "SECURE" : "PENDING", color: isFinalized ? "text-green-600" : "text-amber-500" },
                            { label: "Team Members", value: `${teamMembers.length} / 4`, color: "text-[#002D62]" }
                        ].map((stat, i) => (
                            <div key={i} className="p-8 text-center flex flex-col justify-center">
                                <span className={`text-2xl font-bold uppercase tracking-tighter ${stat.color} leading-none mb-2`}>{stat.value}</span>
                                <span className="text-[10px] uppercase font-bold text-gray-400 tracking-widest">{stat.label}</span>
                            </div>
                        ))}
                    </div>
                </Card>

                {/* Tab Selection */}
                <div className="flex space-x-0 mb-10 overflow-x-auto scrollbar-hide border-b border-[#cccccc]">
                    {["Team Details", "Problem Statement", "Settings"].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-10 py-5 text-xs font-bold uppercase tracking-widest whitespace-nowrap flex-shrink-0 transition-all ${activeTab === tab
                                ? "bg-[#002D62] text-white"
                                : "text-[#666666] hover:bg-[#d0d0d0]"
                                }`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                {/* Content Area */}
                <div className="grid grid-cols-1 gap-10">
                    {activeTab === "Team Details" && (
                        <Card headerType="primary" headerText="Active Personnel Roster" className="!p-0 border-none">
                            {/* Mobile Card View - hidden on md and above */}
                            <div className="block md:hidden space-y-3 p-4 bg-[#f8f9fa]">
                                {teamMembers.map((member) => (
                                    <div key={member.enrollment_no} className="bg-white rounded-none p-4 shadow-sm border border-[#e9ecef]">
                                        <div className="flex justify-between items-center mb-3 pb-3 border-b border-[#e9ecef]">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-3 h-3 ${member.isInvited ? 'bg-amber-400' : 'bg-green-500'} shadow-sm`}></div>
                                                <span className="font-black text-[#002D62] text-xs uppercase tracking-wide">
                                                    {!member.isPasswordSet ? <span className="text-amber-500">PENDING PROFILE</span> : member.name}
                                                </span>
                                            </div>
                                            <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 ${member.enrollment_no === team?.leader_id ? "bg-amity-activeBg text-amity-activeText" : "bg-amity-inactiveBg text-amity-inactiveText"}`}>
                                                {member.enrollment_no === team?.leader_id ? "LEADER" : "MEMBER"}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="font-bold text-gray-400 uppercase tracking-widest text-[9px]">Registry ID</span>
                                            <span className="font-mono font-bold text-gray-600">{member.enrollment_no}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Desktop Table View - hidden below md */}
                            <div className="hidden md:block overflow-x-auto">
                                <table className="amity-table">
                                    <thead>
                                        <tr>
                                            <th className="w-20 text-center">Protocol</th>
                                            <th>Identification Name</th>
                                            <th>Registry ID</th>
                                            <th className="text-right">Access Level</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {teamMembers.map((member) => (
                                            <tr key={member.enrollment_no}>
                                                <td className="text-center">
                                                    <div className={`w-3 h-3 mx-auto ${member.isInvited ? 'bg-amber-400' : 'bg-green-500'} shadow-sm`}></div>
                                                </td>
                                                <td className="font-bold text-[#002D62] uppercase tracking-wide">
                                                    {!member.isPasswordSet ? (
                                                        <span className="text-amber-500 font-black">PENDING PROFILE</span>
                                                    ) : (
                                                        member.name
                                                    )}
                                                </td>
                                                <td className="font-mono text-gray-500 text-xs">
                                                    {member.enrollment_no}
                                                </td>
                                                <td className="text-right">
                                                    <span className={member.enrollment_no === team?.leader_id ? "badge-active" : "badge-inactive"}>
                                                        {member.enrollment_no === team?.leader_id ? "LEADER" : "MEMBER"}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="p-10 bg-[#f8f9fa] border-t border-[#e9ecef]">
                                <div className="bg-white border-2 border-dashed border-[#e0e0e0] p-8 text-center flex flex-col items-center">
                                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                                        {teamMembers.length >= 4 ? "TEAM CAPACITY AT MAXIMUM THRESHOLD" : `AVAILABLE SLOTS: ${4 - teamMembers.length}`}
                                    </p>
                                </div>
                            </div>
                        </Card>
                    )}

                    {activeTab === "Problem Statement" && (
                        <Card headerType="primary" headerText="Consolidated Problem Directive" className="border-none">
                            {problem ? (
                                <div className="space-y-6">
                                    <div>
                                        <h3 className="text-[10px] font-black text-[#FFC300] uppercase tracking-[0.3em] mb-2">Statement Identifier</h3>
                                        <p className="text-xl sm:text-2xl font-bold text-[#002D62] uppercase tracking-tight break-words">{problem.id}: {problem.title}</p>
                                    </div>
                                    <div className="w-full h-px bg-[#e9ecef]"></div>
                                    <div>
                                        <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] mb-3">Technical Description</h3>
                                        <p className="text-sm text-gray-600 leading-relaxed font-medium bg-[#f8f9fa] p-6 border-l-4 border-[#002D62]">
                                            {problem.description}
                                        </p>
                                    </div>
                                    <div className="flex items-center flex-wrap gap-4 pt-4">
                                        {team?.isLocked ? (
                                            <span className="px-4 py-1.5 bg-green-100 text-green-700 text-[10px] font-black uppercase tracking-widest rounded-full">Status: Locked & Verified</span>
                                        ) : (
                                            <span className="px-4 py-1.5 bg-amber-100 text-amber-700 text-[10px] font-black uppercase tracking-widest rounded-full">Status: Unlocked (Pending)</span>
                                        )}
                                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest italic">
                                            {team?.isLocked ? "Consolidated via Leader Authorization" : "Awaiting Final Administrative Lock"}
                                        </span>
                                    </div>

                                    {!team?.isLocked && isLeader && (
                                        <div className="mt-8 pt-8 border-t border-[#e9ecef] flex justify-center">
                                            <Button
                                                onClick={() => router.push("/dashboard/lockin")}
                                                className="!bg-[#FFC300] !text-[#002D62] hover:shadow-lg transition-all"
                                            >
                                                RE-ENTER SELECTION PORTAL
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="bg-[#f8f9fa] rounded-xl border-2 border-dashed border-[#e0e0e0] p-12 flex flex-col items-center justify-center text-center">
                                    <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-6">
                                        <svg className="w-8 h-8 text-[#FFC300]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                        </svg>
                                    </div>
                                    <h3 className="text-sm font-black text-[#002D62] uppercase tracking-[0.2em] mb-2">No Active Objective Selected</h3>
                                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.15em] max-w-xs leading-relaxed mb-8">
                                        Initiate Lock-In sequence to assign a problem statement for your team.
                                    </p>
                                    {isLeader && isFinalized && (
                                        <Button onClick={() => router.push("/dashboard/lockin")} className="!px-12">
                                            Enter Lock-In Portal
                                        </Button>
                                    )}
                                </div>
                            )}
                        </Card>
                    )}


                    {activeTab === "Settings" && (
                        <Card headerType="primary" headerText="System Configuration" className="border-none">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                                <div>
                                    <h3 className="text-xs font-black text-[#002D62] uppercase tracking-widest mb-6">Team Identity Management</h3>
                                    <div className="space-y-6 p-8 bg-[#f8f9fa] border border-[#e9ecef]">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Team Name</label>
                                        <input
                                            type="text"
                                            value={newTeamName}
                                            onChange={(e) => setNewTeamName(e.target.value)}
                                            disabled={!isLeader || updating}
                                            placeholder="Enter Designation..."
                                            className="w-full bg-white border-2 border-[#e0e0e0] p-4 text-sm font-bold text-[#002D62] focus:border-[#FFC300] outline-none transition-all"
                                        />
                                        {isLeader ? (
                                            <div className="w-full flex justify-center pt-8 border-t border-[#e9ecef]">
                                                <Button
                                                    onClick={handleUpdateTeamName}
                                                    disabled={updating || newTeamName === team?.team_name}
                                                    variant={success === "UPDATED" ? "success" : "secondary"}
                                                    className="!px-12 !py-4 shadow-xl"
                                                >
                                                    {updating ? "SYNCHRONIZING..." : (success === "UPDATED" ? "LOG SYNCHRONIZED" : "UPDATE LOG")}
                                                </Button>
                                            </div>
                                        ) : (
                                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest italic">Only the Team Leader can modify this designation.</p>
                                        )}
                                    </div>
                                </div>

                                <div>
                                    <h3 className="text-xs font-black text-[#002D62] uppercase tracking-widest mb-6">Personnel Roster Management</h3>
                                    <div className="space-y-6 p-8 bg-[#f8f9fa] border border-[#e9ecef]">
                                        {isLeader ? (
                                            <>
                                                <div className="space-y-4 mb-8">
                                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Authorized Participants List</label>
                                                    <div className="bg-white border-2 border-[#e0e0e0] divide-y divide-[#e9ecef]">
                                                        {teamMembers.map(m => (
                                                            <div key={m.enrollment_no} className="p-4 flex justify-between items-center group">
                                                                <div>
                                                                    <p className="text-xs font-bold text-[#002D62] uppercase">{m.name}</p>
                                                                    <p className="text-[10px] font-mono text-gray-400 mt-0.5">{m.enrollment_no}</p>
                                                                </div>
                                                                {m.enrollment_no !== team?.leader_id && (
                                                                    <button
                                                                        onClick={() => handleRemoveMember(m.enrollment_no)}
                                                                        disabled={memberUpdating}
                                                                        className="text-red-400 opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-600"
                                                                        title="Remove from Team"
                                                                    >
                                                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                                        </svg>
                                                                    </button>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>

                                                {teamMembers.length < 4 && (
                                                    <div className="space-y-4 pt-4 border-t border-[#e9ecef]">
                                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Enlist New Member (Enrollment ID)</label>
                                                        <div className="flex flex-col sm:flex-row gap-2 sm:space-x-2">
                                                            <input
                                                                type="text"
                                                                value={newMemberEnrollment}
                                                                onChange={(e) => setNewMemberEnrollment(e.target.value)}
                                                                disabled={memberUpdating}
                                                                placeholder="e.g. A00X..."
                                                                className="flex-1 bg-white border-2 border-[#e0e0e0] p-4 text-sm font-bold text-[#002D62] focus:border-[#FFC300] outline-none transition-all"
                                                            />
                                                            <Button
                                                                onClick={handleAddMember}
                                                                disabled={memberUpdating || !newMemberEnrollment.trim()}
                                                                className="!py-4"
                                                            >
                                                                {memberUpdating ? "..." : "Add"}
                                                            </Button>
                                                        </div>
                                                    </div>
                                                )}
                                            </>
                                        ) : (
                                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest italic">Only the Team Leader can manage Participants</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
}
