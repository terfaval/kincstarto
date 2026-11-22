/** P07: deterministic, read-only next-step plan from existing server-evaluated gates.
 * This helper NEVER approves, publishes or infers professional validation.
 */
import type { PublicationGate } from "./practice-publication";

export type WorkflowPublication = {
  status?: "none" | "published" | "revoked";
  releaseId?: string | null;
  publiclyAccessible?: boolean;
};
export type WorkflowStep = { code: string; label: string };
export type WorkflowPlan = {
  phase: "loading" | "blocked" | "manual_review" | "storage_unavailable" | "ready_to_publish" | "published" | "stale_release";
  label: string;
  actions: WorkflowStep[];
  canRequestPublication: boolean;
};

export function planPracticeWorkflow(input: {
  gate: Pick<PublicationGate, "eligible" | "blockers"> | null;
  receiptCurrent: boolean;
  publication: WorkflowPublication | null;
}): WorkflowPlan {
  const { gate, receiptCurrent, publication } = input;
  if (!gate) return {
    phase: "loading", label: "A friss szerveroldali ellenőrzés még nem érhető el.",
    actions: [{ code: "REFRESH", label: "Frissítsd a projekt állapotát, mielőtt döntést hozol." }], canRequestPublication: false,
  };
  if (!gate.eligible || gate.blockers.length) return {
    phase: "blocked", label: "A gyakorlás jelenleg nem publikálható.",
    actions: gate.blockers.length ? gate.blockers.map((b) => ({ code: b.code, label: b.label })) :
      [{ code: "RECHECK", label: "A szerveroldali publikálási kapu még nem teljesült." }], canRequestPublication: false,
  };
  if (!receiptCurrent) return {
    phase: "manual_review", label: "A szerkezeti feltételek teljesülnek, a kézi jóváhagyás még hiányzik vagy elavult.",
    actions: [{ code: "SIGNOFF", label: "Végezd el a szöveg-, mozgás- és útvonalellenőrzést; a három nyilatkozatot külön rögzítsd." }],
    canRequestPublication: false,
  };
  if (!publication || !publication.status) return {
    phase: "storage_unavailable", label: "A kiadástároló állapota még nem igazolt.",
    actions: [{ code: "PUBLICATION_REFRESH", label: "Ellenőrizd újra a kiadási állapotot; ne próbálj meg automatikusan publikálni." }],
    canRequestPublication: false,
  };
  if (publication.status === "published") {
    return publication.publiclyAccessible === true ? {
      phase: "published", label: "Az aktuális kiadás elérhető a publikus katalógusban.",
      actions: [{ code: "MANUAL_PLAYBACK", label: "Próbáld végig a publikus részletezőt és lejátszót, mobilon is." }],
      canRequestPublication: true,
    } : {
      phase: "stale_release", label: "A kiadás aktívnak látszik, de a publikus ellenőrzés nem engedi lejátszani.",
      actions: [{ code: "REVALIDATE", label: "Ellenőrizd az élő pózkönyvtárat, majd friss jóváhagyás után hozz létre új kiadást." }],
      canRequestPublication: true,
    };
  }
  return {
    phase: "ready_to_publish", label: "A kiadás kézi kezdeményezésre előkészíthető.",
    actions: [{ code: "EXPLICIT_PUBLISH", label: "A publikálási gombbal, külön megerősítés után aktiválható; automatikus kiadás nincs." }],
    canRequestPublication: true,
  };
}

export function createWorkflowReport(input: {
  draftId: string;
  practiceId: string;
  version: string;
  scriptSha256: string;
  librarySha256: string;
  gate: Pick<PublicationGate, "eligible" | "blockers" | "requiredPoseCount">;
  receiptCurrent: boolean;
  publication: WorkflowPublication;
  createdAt: string;
}) {
  const plan = planPracticeWorkflow(input);
  return {
    format: "yasuragi.workflow-report.v1" as const,
    createdAt: input.createdAt,
    draftId: input.draftId,
    practiceId: input.practiceId,
    version: input.version,
    scriptSha256: input.scriptSha256,
    librarySha256: input.librarySha256,
    requiredPoseCount: input.gate.requiredPoseCount,
    gateEligible: input.gate.eligible,
    receiptCurrent: input.receiptCurrent,
    publicationStatus: input.publication.status ?? "unknown",
    publiclyAccessible: input.publication.publiclyAccessible === true,
    phase: plan.phase,
    actions: plan.actions,
    // Advisory only: publication API always re-reads and validates the live state.
    advisoryOnly: true as const,
  };
}
