import { db } from "@/lib/firebase";
import { doc, updateDoc, getDoc, getDocs, collection, query, where, writeBatch, setDoc } from "firebase/firestore";

/**
 * Migrates an internal finalist team to the External Phase.
 *
 * What it does:
 * 1. Reads all live evaluation records for this team from `evaluations`.
 * 2. Archives each one into `evaluations_internal/{teamId}/records/{evalId}`
 *    so the inhouse scores are permanently preserved.
 * 3. Saves a snapshot of the averaged inhouse scores on the team document
 *    (field: `internal_scores_snapshot`) for quick dashboard reference.
 * 4. Deletes the live evaluation records from `evaluations` — external
 *    judges will now start scoring from zero.
 * 5. Updates the team document: competition_phase → "external".
 */
export async function migrateToExternal(teamId: string): Promise<void> {
  const teamRef = doc(db, "teams", teamId);
  const teamSnap = await getDoc(teamRef);

  if (!teamSnap.exists()) {
    throw new Error(`Team ${teamId} does not exist in Firestore.`);
  }

  // ── Step 1: Fetch all live evaluations for this team ─────────────
  const evQuery = query(collection(db, "evaluations"), where("team_id", "==", teamId));
  const evSnap = await getDocs(evQuery);
  const liveEvaluations = evSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];

  // ── Step 2: Build average snapshot ───────────────────────────────
  let snapshot: Record<string, any> | null = null;
  if (liveEvaluations.length > 0) {
    const sum = liveEvaluations.reduce(
      (acc, ev) => ({
        innovation: acc.innovation + (ev.score_innovation ?? 0),
        tech: acc.tech + (ev.score_tech ?? 0),
        pitch: acc.pitch + (ev.score_pitch ?? 0),
        total: acc.total + (ev.total_score ?? 0),
      }),
      { innovation: 0, tech: 0, pitch: 0, total: 0 }
    );
    const n = liveEvaluations.length;
    snapshot = {
      avg_innovation: parseFloat((sum.innovation / n).toFixed(2)),
      avg_tech: parseFloat((sum.tech / n).toFixed(2)),
      avg_pitch: parseFloat((sum.pitch / n).toFixed(2)),
      avg_total: parseFloat((sum.total / n).toFixed(2)),
      judge_count: n,
      archived_at: new Date().toISOString(),
      raw_evaluations: liveEvaluations,   // full records for audit trail
    };
  }

  // ── Step 3: Batch archive + delete ───────────────────────────────
  const batch = writeBatch(db);

  // Archive each evaluation record individually
  for (const ev of liveEvaluations) {
    const archiveRef = doc(db, "evaluations_internal", `${teamId}_${ev.id}`);
    batch.set(archiveRef, {
      ...ev,
      archived_at: new Date().toISOString(),
      original_doc_id: ev.id,
    });
  }

  // Delete live evaluation records so external phase starts at zero
  evSnap.docs.forEach(d => batch.delete(d.ref));

  // Update team document: promote phase + attach inhouse snapshot
  const teamUpdate: Record<string, any> = {
    competition_phase: "external",
    isExternalEligible: true,
    promoted_at: new Date().toISOString(),
    isLocked: false,              // Reset to Open — team must re-select problem statement
    problem_statement_id: null,   // Clear previous selection for the external phase
    isVerified: true,             // Promoted internal finalists are automatically verified
  };
  if (snapshot) {
    teamUpdate.internal_scores_snapshot = snapshot;
  }
  batch.update(teamRef, teamUpdate);

  await batch.commit();

  console.log(
    `[migrateToExternal] Team ${teamId} promoted. Archived ${liveEvaluations.length} internal evaluation(s).`
  );
}
