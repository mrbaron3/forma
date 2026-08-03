import crypto from "node:crypto";
import { canonicalJson } from "../authoring/canonical-json.js";

const clone = (value) => structuredClone(value);
const hash = (value) => `sha256:${crypto.createHash("sha256").update(canonicalJson(value)).digest("hex")}`;
const equal = (a, b) => canonicalJson(a) === canonicalJson(b);

export function materialFingerprint(manifest) {
  const { schemaVersion, requestId, sourceDigest, designSystemBaseRevision,
    artifacts, authorInvocationRefs } = manifest;
  return hash({ schemaVersion, requestId, sourceDigest, designSystemBaseRevision,
    artifacts, authorInvocationRefs });
}

export const computeMaterialFingerprint = materialFingerprint;

export function bundleDigest(manifest) {
  const value = clone(manifest);
  delete value.bundleDigest;
  return hash(value);
}

function normalized(snapshot) {
  const result = clone(snapshot);
  result.revisions.sort((a, b) => a.createdAt.localeCompare(b.createdAt) ||
    codePointCompare(a.revisionId, b.revisionId));
  result.decisions.sort((a, b) => a.decidedAt.localeCompare(b.decidedAt) ||
    codePointCompare(a.decisionId, b.decisionId));
  const decidedAt = new Map(result.decisions.map((item) => [item.decisionId, item.decidedAt]));
  result.feedbackDispositions.sort((a, b) =>
    (decidedAt.get(a.decisionId) ?? "").localeCompare(decidedAt.get(b.decisionId) ?? "") ||
    codePointCompare(a.decisionId, b.decisionId));
  return result;
}

function codePointCompare(a, b) {
  const aa = [...a], bb = [...b];
  for (let i = 0; i < Math.min(aa.length, bb.length); i++) {
    const difference = aa[i].codePointAt(0) - bb[i].codePointAt(0);
    if (difference) return difference;
  }
  return aa.length - bb.length;
}

export function serializeSnapshot(snapshot) {
  assertSnapshotIntegrity(snapshot);
  return canonicalJson(normalized(snapshot));
}

export function restoreSnapshot(serialized) {
  const value = typeof serialized === "string" || serialized instanceof Uint8Array
    ? JSON.parse(Buffer.from(serialized).toString("utf8")) : clone(serialized);
  assertSnapshotIntegrity(value);
  return normalized(value);
}

export const canonicalSerialize = serializeSnapshot;
export const restore = restoreSnapshot;

export function assertSnapshotIntegrity(snapshot) {
  if (!snapshot || snapshot.schemaVersion !== "1.0" || !Array.isArray(snapshot.revisions) ||
      !Array.isArray(snapshot.decisions) || !Array.isArray(snapshot.feedbackDispositions))
    throw new RevisionIntegrityError("invalid snapshot shape");
  unique(snapshot.revisions, "revisionId");
  unique(snapshot.decisions, "decisionId");
  unique(snapshot.feedbackDispositions, "decisionId");
  const revisions = new Map(snapshot.revisions.map((r) => [r.revisionId, r]));
  for (const revision of snapshot.revisions) {
    if (revision.requestId !== snapshot.requestId || revision.manifest.requestId !== snapshot.requestId ||
        revision.manifest.revisionId !== revision.revisionId ||
        revision.manifest.previousRevisionId !== revision.previousRevisionId ||
        revision.materialFingerprint !== materialFingerprint(revision.manifest) ||
        revision.manifest.bundleDigest !== bundleDigest(revision.manifest))
      throw new RevisionIntegrityError(`inconsistent revision ${revision.revisionId}`);
    if (revision.previousRevisionId !== null && !revisions.has(revision.previousRevisionId))
      throw new RevisionIntegrityError(`broken lineage ${revision.revisionId}`);
    const visited = new Set([revision.revisionId]);
    let ancestor = revision;
    while (ancestor.previousRevisionId !== null) {
      if (visited.has(ancestor.previousRevisionId)) throw new RevisionIntegrityError("cyclic lineage");
      visited.add(ancestor.previousRevisionId);
      ancestor = revisions.get(ancestor.previousRevisionId);
    }
  }
  for (const decision of snapshot.decisions) {
    const revision = revisions.get(decision.revisionId);
    if (!revision || decision.requestId !== snapshot.requestId ||
        decision.bundleDigest !== revision.manifest.bundleDigest)
      throw new RevisionIntegrityError(`invalid decision ${decision.decisionId}`);
  }
  for (const disposition of snapshot.feedbackDispositions) {
    if (!snapshot.decisions.some((d) => d.decisionId === disposition.decisionId && d.verdict === "request-changes"))
      throw new RevisionIntegrityError(`invalid feedback ${disposition.decisionId}`);
  }
  return true;
}

function unique(items, key) {
  const values = new Set();
  for (const item of items) {
    if (values.has(item[key])) throw new RevisionIntegrityError(`duplicate ${key}`);
    values.add(item[key]);
  }
}

export class RevisionIntegrityError extends Error {}

const error = (code, message, details = {}) => ({ ok: false, error: {
  schemaVersion: "1.0", code, message, details
} });
const success = (snapshot, result) => ({ ok: true, nextSnapshot: normalized(snapshot), result });

export function deriveApprovalValidity(snapshot, revisionId, explicitDecision) {
  const revision = snapshot.revisions.find((item) => item.revisionId === revisionId);
  const approvals = snapshot.decisions.filter((item) => item.verdict === "approve" && item.revisionId === revisionId);
  const decision = explicitDecision ?? approvals.sort((a, b) => b.decidedAt.localeCompare(a.decidedAt) || codePointCompare(b.decisionId, a.decisionId))[0];
  if (!decision) return { status: "missing" };
  let reason;
  if (decision.requestId !== revision?.requestId) reason = "request-mismatch";
  else if (decision.revisionId !== revision?.revisionId) reason = "revision-mismatch";
  else if (decision.bundleDigest !== revision?.manifest.bundleDigest) reason = "bundle-mismatch";
  else if (revision?.state === "superseded") reason = "revision-superseded";
  return reason ? { status: "stale", decisionId: decision.decisionId, reason }
    : { status: "valid", decisionId: decision.decisionId };
}

export const approvalValidity = deriveApprovalValidity;

export function transition(snapshot, command) {
  const input = clone(snapshot);
  try { assertSnapshotIntegrity(input); }
  catch (cause) { return error("integrity-error", cause.message); }
  if (command.requestId !== input.requestId)
    return error("not-found", `request ${command.requestId} was not found`);
  try {
    switch (command.type) {
      case "create-revision": return createRevision(input, command);
      case "propose-revision": return setProposed(input, command);
      case "decide-revision": return decide(input, command);
      case "create-successor": return successor(input, command);
      default: return error("invalid-transition", `unknown command ${command.type}`);
    }
  } catch (cause) {
    return error("integrity-error", cause.message);
  }
}

function revisionFrom(command, state = "draft") {
  const manifest = clone(command.manifest);
  if (manifest.revisionId !== command.revisionId) throw new RevisionIntegrityError("manifest revisionId mismatch");
  if (manifest.bundleDigest !== bundleDigest(manifest)) throw new RevisionIntegrityError("bundle digest mismatch");
  return { schemaVersion: "1.0", revisionId: command.revisionId,
    requestId: command.requestId, previousRevisionId: manifest.previousRevisionId,
    state, manifest, materialFingerprint: materialFingerprint(manifest), createdAt: command.createdAt };
}

function createRevision(snapshot, command) {
  const found = snapshot.revisions.find((r) => r.revisionId === command.revisionId);
  const candidate = revisionFrom(command);
  if (found) return sameRevisionInput(found, candidate) ? success(snapshot, { revision: clone(found) }) : error("conflict", "revisionId already exists");
  if (snapshot.revisions.length || candidate.previousRevisionId !== null)
    return error("invalid-transition", "initial revision requires an empty snapshot and null predecessor");
  snapshot.revisions.push(candidate);
  return success(snapshot, { revision: clone(candidate) });
}

function sameRevisionInput(existing, candidate) {
  const left = clone(existing), right = clone(candidate);
  delete left.state; delete right.state;
  return equal(left, right);
}

function setProposed(snapshot, command) {
  const revision = snapshot.revisions.find((r) => r.revisionId === command.revisionId);
  if (!revision) return error("not-found", "revision was not found");
  if (revision.state === "proposed") return success(snapshot, { revision: clone(revision) });
  if (revision.state !== "draft") return error("invalid-transition", "only draft may be proposed");
  revision.state = "proposed";
  return success(snapshot, { revision: clone(revision) });
}

function decide(snapshot, command) {
  const decision = clone(command.decision);
  const found = snapshot.decisions.find((d) => d.decisionId === decision.decisionId);
  if (found) return equal(found, decision) ? success(snapshot, { decision: clone(found) }) : error("conflict", "decisionId already exists");
  const revision = snapshot.revisions.find((r) => r.revisionId === decision.revisionId);
  if (!revision) return error("not-found", "decision target was not found");
  if (decision.requestId !== snapshot.requestId || decision.bundleDigest !== revision.manifest.bundleDigest)
    return error("integrity-error", "decision target mismatch");
  if (revision.state !== "proposed") return error("invalid-transition", "only proposed revision may be decided");
  revision.state = { approve: "approved", "request-changes": "changes-requested", reject: "rejected" }[decision.verdict];
  snapshot.decisions.push(decision);
  return success(snapshot, { revision: clone(revision), decision: clone(decision) });
}

function successor(snapshot, command) {
  const predecessor = snapshot.revisions.find((r) => r.revisionId === command.predecessorRevisionId);
  if (!predecessor) return error("not-found", "predecessor was not found");
  const found = snapshot.revisions.find((r) => r.revisionId === command.revisionId);
  const candidate = revisionFrom(command);
  if (candidate.previousRevisionId !== predecessor.revisionId) return error("integrity-error", "manifest predecessor mismatch");
  if (found) {
    const recorded = snapshot.feedbackDispositions.filter((item) => item.revisionId === found.revisionId)
      .map(({ revisionId: _revisionId, ...item }) => item);
    return sameRevisionInput(found, candidate) && predecessor.state === "superseded" &&
      equal(recorded, command.feedbackDispositions ?? [])
      ? success(snapshot, { revision: clone(found) }) : error("conflict", "revisionId already exists");
  }
  if (predecessor.state === "superseded") return error("invalid-transition", "superseded is terminal");
  if (candidate.materialFingerprint === predecessor.materialFingerprint)
    return error("conflict", "successor has no material change");
  const expected = unresolvedFeedback(snapshot, predecessor.revisionId);
  const supplied = command.feedbackDispositions ?? [];
  if (!equal(expected.map((d) => d.decisionId), supplied.map((d) => d.decisionId)))
    return error("conflict", "feedback dispositions do not cover unresolved ancestor feedback");
  for (const item of supplied) {
    if (!['applied','deferred','declined'].includes(item.disposition) ||
        (item.disposition !== 'applied' && !(typeof item.note === 'string' && item.note.length)))
      return error("integrity-error", "invalid feedback disposition");
    snapshot.feedbackDispositions.push({ ...clone(item), revisionId: candidate.revisionId });
  }
  predecessor.state = "superseded";
  snapshot.revisions.push(candidate);
  return success(snapshot, { revision: clone(candidate), authoringFeedback: supplied.filter((x) => x.disposition === "applied").map((x) => expected.find((d) => d.decisionId === x.decisionId)) });
}

function unresolvedFeedback(snapshot, predecessorId) {
  const ancestors = new Set();
  let current = snapshot.revisions.find((r) => r.revisionId === predecessorId);
  while (current) { ancestors.add(current.revisionId); current = snapshot.revisions.find((r) => r.revisionId === current.previousRevisionId); }
  const resolved = new Set(snapshot.feedbackDispositions.map((d) => d.decisionId));
  return snapshot.decisions.filter((d) => d.verdict === "request-changes" && ancestors.has(d.revisionId) &&
    !resolved.has(d.decisionId) && deriveDecisionValidity(snapshot, d)).sort((a,b) => a.decidedAt.localeCompare(b.decidedAt) || codePointCompare(a.decisionId,b.decisionId));
}

function deriveDecisionValidity(snapshot, decision) {
  const revision = snapshot.revisions.find((r) => r.revisionId === decision.revisionId);
  return revision && decision.requestId === revision.requestId && decision.bundleDigest === revision.manifest.bundleDigest;
}

export function createEmptySnapshot(requestId) {
  return { schemaVersion: "1.0", requestId, revisions: [], decisions: [], feedbackDispositions: [] };
}
