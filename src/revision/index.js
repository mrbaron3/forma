import crypto from "node:crypto";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { canonicalJson } from "../authoring/canonical-json.js";

const clone = (value) => structuredClone(value);
const canonical = (value) => {
  assertWellFormedUnicode(value);
  return canonicalJson(value);
};
const equal = (left, right) => canonical(left) === canonical(right);
const hash = (value) => `sha256:${crypto.createHash("sha256").update(canonical(value)).digest("hex")}`;
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;
const SHA256 = /^sha256:[a-f0-9]{64}$/;
const PORTABLE_PATH = /^(?!\/)(?![A-Za-z]:)(?!.*[\\:])(?!.*\/\/)(?!.+\/$)(?!\.{1,2}(?:\/|$))(?!.+\/\.{1,2}(?:\/|$)).+$/;
const REVISION_STATUSES = new Set([
  "draft", "proposed", "approved", "changes-requested", "rejected", "superseded",
]);
const DECISION_VERDICTS = new Set(["approve", "request-changes", "reject"]);
const FEEDBACK_DISPOSITIONS = new Set(["applied", "deferred", "declined"]);
const STATUS_BY_VERDICT = {
  approve: "approved",
  "request-changes": "changes-requested",
  reject: "rejected",
};
const formatAjv = new Ajv2020({ strict: true });
addFormats(formatAjv);
const validateDateTimeFormat = formatAjv.compile({ type: "string", format: "date-time" });
const validateUriFormat = formatAjv.compile({ type: "string", format: "uri" });

export class RevisionIntegrityError extends Error {}

export function materialFingerprint(manifest) {
  const {
    schemaVersion,
    requestId,
    sourceDigest,
    designSystemBaseRevision,
    artifacts,
    authorInvocationRefs,
  } = manifest;
  return hash({
    schemaVersion,
    requestId,
    sourceDigest,
    designSystemBaseRevision,
    artifacts,
    authorInvocationRefs,
  });
}

export const computeMaterialFingerprint = materialFingerprint;

export function bundleDigest(manifest) {
  const value = clone(manifest);
  delete value.bundleDigest;
  return hash(value);
}

function codePointCompare(left, right) {
  const leftPoints = [...left];
  const rightPoints = [...right];
  for (let index = 0; index < Math.min(leftPoints.length, rightPoints.length); index += 1) {
    const difference = leftPoints[index].codePointAt(0) - rightPoints[index].codePointAt(0);
    if (difference !== 0) return difference;
  }
  return leftPoints.length - rightPoints.length;
}

function normalized(snapshot) {
  const result = clone(snapshot);
  result.revisions.sort((left, right) =>
    compareInstants(left.createdAt, right.createdAt) || codePointCompare(left.revisionId, right.revisionId));
  result.decisions.sort((left, right) =>
    compareInstants(left.decidedAt, right.decidedAt) || codePointCompare(left.decisionId, right.decisionId));
  return result;
}

export function serializeSnapshot(snapshot) {
  assertSnapshotIntegrity(snapshot);
  return canonical(normalized(snapshot));
}

export function restoreSnapshot(serialized) {
  try {
    const value = typeof serialized === "string" || serialized instanceof Uint8Array
      ? JSON.parse(Buffer.from(serialized).toString("utf8"))
      : clone(serialized);
    assertSnapshotIntegrity(value);
    return normalized(value);
  } catch (cause) {
    if (cause instanceof RevisionIntegrityError) throw cause;
    throw new RevisionIntegrityError(cause.message);
  }
}

export const canonicalSerialize = serializeSnapshot;
export const restore = restoreSnapshot;

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isIdentifier(value) {
  return typeof value === "string" && IDENTIFIER.test(value);
}

function isSha256(value) {
  return typeof value === "string" && SHA256.test(value);
}

function isDateTime(value) {
  return validateDateTimeFormat(value);
}

function compareInstants(left, right) {
  const leftInstant = parseRfc3339Instant(left);
  const rightInstant = parseRfc3339Instant(right);
  if (leftInstant.epochSecond < rightInstant.epochSecond) return -1;
  if (leftInstant.epochSecond > rightInstant.epochSecond) return 1;
  if (leftInstant.isLeapSecond !== rightInstant.isLeapSecond)
    return leftInstant.isLeapSecond ? -1 : 1;
  return compareFractionDigits(leftInstant.fraction, rightInstant.fraction);
}

const RFC3339_PARTS = /^(\d{4})-(\d{2})-(\d{2})[Tt\s](\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?([Zz]|([+-])(\d{2})(?::?(\d{2}))?)$/;

function parseRfc3339Instant(value) {
  if (!isDateTime(value)) throw new RevisionIntegrityError(`invalid RFC3339 instant ${value}`);
  const match = RFC3339_PARTS.exec(value);
  if (!match) throw new RevisionIntegrityError(`unsupported RFC3339 instant ${value}`);
  const year = BigInt(match[1]);
  const month = BigInt(match[2]);
  const day = BigInt(match[3]);
  const hour = BigInt(match[4]);
  const minute = BigInt(match[5]);
  const second = BigInt(match[6]);
  const isLeapSecond = second === 60n;
  const offsetSign = match[9] === "-" ? -1n : 1n;
  const offsetHour = BigInt(match[10] ?? 0);
  const offsetMinute = BigInt(match[11] ?? 0);
  const offsetSeconds = match[8].toLowerCase() === "z"
    ? 0n
    : offsetSign * (offsetHour * 3600n + offsetMinute * 60n);
  const civilSecond = daysFromCivil(year, month, day) * 86400n +
    hour * 3600n + minute * 60n + (isLeapSecond ? 59n : second);
  return {
    epochSecond: civilSecond - offsetSeconds + (isLeapSecond ? 1n : 0n),
    fraction: match[7] ?? "",
    isLeapSecond,
  };
}

function daysFromCivil(year, month, day) {
  const adjustedYear = year - (month <= 2n ? 1n : 0n);
  const era = floorDiv(adjustedYear, 400n);
  const yearOfEra = adjustedYear - era * 400n;
  const adjustedMonth = month + (month > 2n ? -3n : 9n);
  const dayOfYear = (153n * adjustedMonth + 2n) / 5n + day - 1n;
  const dayOfEra = yearOfEra * 365n + yearOfEra / 4n - yearOfEra / 100n + dayOfYear;
  return era * 146097n + dayOfEra - 719468n;
}

function floorDiv(dividend, divisor) {
  const quotient = dividend / divisor;
  return dividend < 0n && dividend % divisor !== 0n ? quotient - 1n : quotient;
}

function compareFractionDigits(left, right) {
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const leftDigit = index < left.length ? left.charCodeAt(index) : 48;
    const rightDigit = index < right.length ? right.charCodeAt(index) : 48;
    if (leftDigit < rightDigit) return -1;
    if (leftDigit > rightDigit) return 1;
  }
  return 0;
}

function assertWellFormedUnicode(value, seen = new WeakSet()) {
  if (typeof value === "string") {
    assertWellFormedString(value);
    return;
  }
  if (value === null || typeof value !== "object") return;
  if (seen.has(value)) throw new RevisionIntegrityError("cyclic canonical value");
  seen.add(value);
  if (Array.isArray(value)) {
    for (const item of value) assertWellFormedUnicode(item, seen);
  } else {
    for (const [key, item] of Object.entries(value)) {
      assertWellFormedString(key);
      assertWellFormedUnicode(item, seen);
    }
  }
  seen.delete(value);
}

function assertWellFormedString(value) {
  for (let index = 0; index < value.length; index += 1) {
    const unit = value.charCodeAt(index);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff))
        throw new RevisionIntegrityError("unpaired Unicode surrogate");
      index += 1;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) {
      throw new RevisionIntegrityError("unpaired Unicode surrogate");
    }
  }
}

function assertExactKeys(value, keys, label) {
  if (!isRecord(value)) throw new RevisionIntegrityError(`invalid ${label} shape`);
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (!equal(actual, expected)) throw new RevisionIntegrityError(`invalid ${label} shape`);
}

function assertUnique(items, key, label) {
  const values = new Set();
  for (const item of items) {
    if (!isRecord(item) || !isIdentifier(item[key]))
      throw new RevisionIntegrityError(`invalid ${label} ${key}`);
    if (values.has(item[key])) throw new RevisionIntegrityError(`duplicate ${label} ${key}`);
    values.add(item[key]);
  }
}

function assertFeedbackRef(feedback) {
  assertExactKeys(
    feedback,
    ["decisionId", "sourceRevisionId", "disposition", "note"],
    "feedback reference",
  );
  if (!isIdentifier(feedback.decisionId) || !isIdentifier(feedback.sourceRevisionId) ||
      !FEEDBACK_DISPOSITIONS.has(feedback.disposition) ||
      (feedback.disposition === "applied" && feedback.note !== null) ||
      (feedback.disposition !== "applied" &&
        !(typeof feedback.note === "string" && feedback.note.length > 0)))
    throw new RevisionIntegrityError(`invalid feedback ${feedback.decisionId ?? "unknown"}`);
}

function assertDecisionShape(decision) {
  assertWellFormedUnicode(decision);
  assertExactKeys(
    decision,
    [
      "schemaVersion", "decisionId", "requestId", "revisionId", "bundleDigest", "verdict",
      "rationale", "decidedBy", "decidedAt", "supersedesDecisionId",
    ],
    "decision",
  );
  if (decision.schemaVersion !== "1.0" || !isIdentifier(decision.decisionId) ||
      !isIdentifier(decision.requestId) || !isIdentifier(decision.revisionId) ||
      !isSha256(decision.bundleDigest) || !DECISION_VERDICTS.has(decision.verdict) ||
      !(typeof decision.rationale === "string" && decision.rationale.length > 0) ||
      !isDateTime(decision.decidedAt) ||
      !(decision.supersedesDecisionId === null || isIdentifier(decision.supersedesDecisionId)))
    throw new RevisionIntegrityError(`invalid decision ${decision.decisionId ?? "unknown"}`);
  assertActor(decision.decidedBy);
}

function assertActor(actor) {
  if (!isRecord(actor)) throw new RevisionIntegrityError("invalid decision actor");
  const allowed = new Set(["provider", "subject", "displayName"]);
  if (Object.keys(actor).some((key) => !allowed.has(key)) ||
      !(typeof actor.provider === "string" && actor.provider.length > 0) ||
      !(typeof actor.subject === "string" && actor.subject.length > 0) ||
      (actor.displayName !== undefined && typeof actor.displayName !== "string"))
    throw new RevisionIntegrityError("invalid decision actor");
}

function assertRevisionShape(revision) {
  assertExactKeys(
    revision,
    [
      "schemaVersion", "requestId", "revisionId", "previousRevisionId", "status",
      "materialFingerprint", "bundleDigest", "feedbackRefs", "createdAt", "stateChangedAt",
    ],
    "revision",
  );
  if (revision.schemaVersion !== "1.0" || !isIdentifier(revision.requestId) ||
      !isIdentifier(revision.revisionId) ||
      !(revision.previousRevisionId === null || isIdentifier(revision.previousRevisionId)) ||
      !REVISION_STATUSES.has(revision.status) || !isSha256(revision.materialFingerprint) ||
      !isSha256(revision.bundleDigest) || !Array.isArray(revision.feedbackRefs) ||
      !isDateTime(revision.createdAt) || !isDateTime(revision.stateChangedAt))
    throw new RevisionIntegrityError(`invalid revision ${revision.revisionId ?? "unknown"}`);
  for (const feedback of revision.feedbackRefs) assertFeedbackRef(feedback);
  assertUnique(revision.feedbackRefs, "decisionId", "feedback");
}

function ancestorIds(revisions, revision) {
  const ancestors = new Set();
  let current = revision;
  while (current.previousRevisionId !== null) {
    if (ancestors.has(current.previousRevisionId)) throw new RevisionIntegrityError("cyclic lineage");
    ancestors.add(current.previousRevisionId);
    current = revisions.get(current.previousRevisionId);
    if (!current) throw new RevisionIntegrityError(`broken lineage ${revision.revisionId}`);
  }
  return ancestors;
}

export function assertSnapshotIntegrity(snapshot) {
  assertWellFormedUnicode(snapshot);
  assertExactKeys(snapshot, ["schemaVersion", "requestId", "revisions", "decisions"], "snapshot");
  if (snapshot.schemaVersion !== "1.0" || !isIdentifier(snapshot.requestId) ||
      !Array.isArray(snapshot.revisions) || !Array.isArray(snapshot.decisions))
    throw new RevisionIntegrityError("invalid snapshot shape");
  assertUnique(snapshot.revisions, "revisionId", "revision");
  assertUnique(snapshot.decisions, "decisionId", "decision");

  const revisions = new Map(snapshot.revisions.map((revision) => [revision.revisionId, revision]));
  const childByPredecessor = new Map();
  for (const revision of snapshot.revisions) {
    assertRevisionShape(revision);
    if (revision.requestId !== snapshot.requestId)
      throw new RevisionIntegrityError(`revision request mismatch ${revision.revisionId}`);
    if (revision.previousRevisionId !== null) {
      if (!revisions.has(revision.previousRevisionId))
        throw new RevisionIntegrityError(`broken lineage ${revision.revisionId}`);
      if (childByPredecessor.has(revision.previousRevisionId))
        throw new RevisionIntegrityError(`branched lineage ${revision.previousRevisionId}`);
      childByPredecessor.set(revision.previousRevisionId, revision.revisionId);
    }
    ancestorIds(revisions, revision);
  }
  const roots = snapshot.revisions.filter((revision) => revision.previousRevisionId === null);
  if (snapshot.revisions.length > 0 && roots.length !== 1)
    throw new RevisionIntegrityError("revision lineage must have one root");
  for (const revision of snapshot.revisions) {
    const hasChild = childByPredecessor.has(revision.revisionId);
    if (hasChild !== (revision.status === "superseded"))
      throw new RevisionIntegrityError(`inconsistent terminal state ${revision.revisionId}`);
  }

  const decisions = new Map();
  const decisionByRevision = new Map();
  for (const decision of snapshot.decisions) {
    assertDecisionShape(decision);
    const revision = revisions.get(decision.revisionId);
    if (!revision || decision.requestId !== snapshot.requestId ||
        decision.bundleDigest !== revision.bundleDigest)
      throw new RevisionIntegrityError(`invalid decision target ${decision.decisionId}`);
    if (decisionByRevision.has(decision.revisionId))
      throw new RevisionIntegrityError(`multiple decisions for revision ${decision.revisionId}`);
    decisionByRevision.set(decision.revisionId, decision);
    decisions.set(decision.decisionId, decision);
  }
  for (const revision of snapshot.revisions) {
    const decision = decisionByRevision.get(revision.revisionId);
    if (["draft", "proposed"].includes(revision.status) && decision)
      throw new RevisionIntegrityError(`unexpected decision for revision ${revision.revisionId}`);
    if (["approved", "changes-requested", "rejected"].includes(revision.status)) {
      const expectedStatus = decision && STATUS_BY_VERDICT[decision.verdict];
      if (expectedStatus !== revision.status)
        throw new RevisionIntegrityError(`decision status mismatch ${revision.revisionId}`);
    }
    if (["draft", "proposed"].includes(revision.status) &&
        revision.stateChangedAt !== revision.createdAt)
      throw new RevisionIntegrityError(`stateChangedAt mismatch ${revision.revisionId}`);
    if (["approved", "changes-requested", "rejected"].includes(revision.status) &&
        revision.stateChangedAt !== decision.decidedAt)
      throw new RevisionIntegrityError(`stateChangedAt mismatch ${revision.revisionId}`);
    if (revision.status === "superseded") {
      const child = revisions.get(childByPredecessor.get(revision.revisionId));
      if (!child || revision.stateChangedAt !== child.createdAt)
        throw new RevisionIntegrityError(`stateChangedAt mismatch ${revision.revisionId}`);
    }
  }

  const handledFeedback = new Set();
  for (const revision of snapshot.revisions) {
    const ancestors = ancestorIds(revisions, revision);
    let previousDecision = null;
    for (const feedback of revision.feedbackRefs) {
      const decision = decisions.get(feedback.decisionId);
      if (!decision || decision.verdict !== "request-changes" ||
          feedback.sourceRevisionId !== decision.revisionId ||
          !ancestors.has(feedback.sourceRevisionId) || handledFeedback.has(feedback.decisionId))
        throw new RevisionIntegrityError(`invalid feedback target ${feedback.decisionId}`);
      if (previousDecision && compareDecisions(previousDecision, decision) > 0)
        throw new RevisionIntegrityError(`invalid feedback order ${feedback.decisionId}`);
      previousDecision = decision;
      handledFeedback.add(feedback.decisionId);
    }
  }
  for (const decision of snapshot.decisions) {
    if (decision.verdict !== "request-changes") continue;
    const source = revisions.get(decision.revisionId);
    if (source.status !== "superseded") continue;
    const child = revisions.get(childByPredecessor.get(source.revisionId));
    const directReferences = child.feedbackRefs.filter((feedback) =>
      feedback.decisionId === decision.decisionId &&
      feedback.sourceRevisionId === source.revisionId);
    if (directReferences.length !== 1)
      throw new RevisionIntegrityError(`missing direct successor feedback ${decision.decisionId}`);
  }
  return true;
}

function compareDecisions(left, right) {
  return compareInstants(left.decidedAt, right.decidedAt) ||
    codePointCompare(left.decisionId, right.decisionId);
}

function commandContext(snapshot, command) {
  const requestId = isIdentifier(command?.requestId)
    ? command.requestId
    : isIdentifier(snapshot?.requestId) ? snapshot.requestId : "unknown-request";
  const operation = typeof command?.operation === "string" && command.operation.length > 0
    ? command.operation
    : "unknown";
  const revisionId = isIdentifier(command?.revisionId)
    ? command.revisionId
    : isIdentifier(command?.predecessorRevisionId)
      ? command.predecessorRevisionId
      : isIdentifier(command?.decision?.revisionId) ? command.decision.revisionId : null;
  const decisionId = isIdentifier(command?.decision?.decisionId) ? command.decision.decisionId : null;
  return { operation, requestId, revisionId, decisionId };
}

function failure(snapshot, command, code, message, overrides = {}) {
  const context = { ...commandContext(snapshot, command), ...overrides };
  return {
    ok: false,
    error: {
      schemaVersion: "1.0",
      code,
      operation: context.operation,
      requestId: context.requestId,
      revisionId: context.revisionId,
      decisionId: context.decisionId,
      message,
    },
  };
}

function assertResultIntegrity(snapshot, result) {
  if (!isRecord(result)) throw new RevisionIntegrityError("invalid transition result");
  if (result.revision && !snapshot.revisions.some((revision) => equal(revision, result.revision)))
    throw new RevisionIntegrityError("result revision is not in snapshot");
  if (result.decision && !snapshot.decisions.some((decision) => equal(decision, result.decision)))
    throw new RevisionIntegrityError("result decision is not in snapshot");
  if (result.authoringFeedback) {
    if (!Array.isArray(result.authoringFeedback))
      throw new RevisionIntegrityError("invalid authoring feedback result");
    for (const decision of result.authoringFeedback) {
      if (decision.verdict !== "request-changes" ||
          !snapshot.decisions.some((stored) => equal(stored, decision)))
        throw new RevisionIntegrityError("result feedback is not in snapshot");
    }
  }
}

function success(snapshot, result) {
  assertSnapshotIntegrity(snapshot);
  assertResultIntegrity(snapshot, result);
  return { ok: true, nextSnapshot: normalized(snapshot), result };
}

function assertCommandShape(command) {
  if (!isRecord(command) || command.schemaVersion !== "1.0" ||
      typeof command.operation !== "string" || !isIdentifier(command.requestId))
    throw new RevisionIntegrityError("invalid command shape");
  const keys = {
    "create-revision": ["schemaVersion", "operation", "requestId", "revisionId", "manifest"],
    propose: ["schemaVersion", "operation", "requestId", "revisionId"],
    decide: ["schemaVersion", "operation", "requestId", "revisionId", "decision"],
    "create-successor": [
      "schemaVersion", "operation", "requestId", "predecessorRevisionId", "revisionId",
      "manifest", "feedbackDispositions",
    ],
  }[command.operation];
  if (keys) {
    assertExactKeys(command, keys, "command");
    if (!isIdentifier(command.revisionId)) throw new RevisionIntegrityError("invalid command revisionId");
    if (command.operation === "create-successor" &&
        (!isIdentifier(command.predecessorRevisionId) || !Array.isArray(command.feedbackDispositions)))
      throw new RevisionIntegrityError("invalid successor command shape");
    if (["create-revision", "create-successor"].includes(command.operation) &&
        !isRecord(command.manifest))
      throw new RevisionIntegrityError("invalid command manifest");
    if (command.operation === "decide" && !isRecord(command.decision))
      throw new RevisionIntegrityError("invalid command decision");
  }
}

function assertManifest(command, expectedPreviousRevisionId) {
  const manifest = command.manifest;
  assertManifestShape(manifest);
  if (manifest.schemaVersion !== "1.0" ||
      manifest.requestId !== command.requestId || manifest.revisionId !== command.revisionId ||
      manifest.previousRevisionId !== expectedPreviousRevisionId || !isDateTime(manifest.createdAt) ||
      !isSha256(manifest.bundleDigest) || manifest.bundleDigest !== bundleDigest(manifest))
    throw new RevisionIntegrityError("manifest identity or digest mismatch");
}

function assertManifestShape(manifest) {
  assertWellFormedUnicode(manifest);
  assertExactKeys(
    manifest,
    [
      "schemaVersion", "bundleId", "requestId", "revisionId", "previousRevisionId", "sourceDigest",
      "designSystemBaseRevision", "artifacts", "authorInvocationRefs", "bundleDigest", "createdAt",
    ],
    "manifest",
  );
  if (manifest.schemaVersion !== "1.0" || !isIdentifier(manifest.bundleId) ||
      !isIdentifier(manifest.requestId) || !isIdentifier(manifest.revisionId) ||
      !(manifest.previousRevisionId === null || isIdentifier(manifest.previousRevisionId)) ||
      !isSha256(manifest.sourceDigest) || !isSha256(manifest.bundleDigest) ||
      !isDateTime(manifest.createdAt))
    throw new RevisionIntegrityError("invalid manifest shape");
  assertExternalRef(manifest.designSystemBaseRevision);
  assertArtifacts(manifest.artifacts);
  assertAuthorInvocations(manifest.authorInvocationRefs);
}

function assertExternalRef(reference) {
  if (reference === null) return;
  if (!isRecord(reference)) throw new RevisionIntegrityError("invalid design system base revision");
  const allowed = new Set(["provider", "externalId", "uri", "revision", "digest"]);
  if (Object.keys(reference).some((key) => !allowed.has(key)) ||
      !(typeof reference.provider === "string" && reference.provider.length > 0) ||
      !(typeof reference.externalId === "string" && reference.externalId.length > 0) ||
      (reference.uri !== undefined && !isUri(reference.uri)) ||
      (reference.revision !== undefined &&
        !(typeof reference.revision === "string" && reference.revision.length > 0)) ||
      (reference.digest !== undefined && !isSha256(reference.digest)))
    throw new RevisionIntegrityError("invalid design system base revision");
}

function isUri(value) {
  return validateUriFormat(value);
}

function assertArtifacts(artifacts) {
  if (!isRecord(artifacts)) throw new RevisionIntegrityError("invalid manifest artifacts");
  const required = ["experience", "designSystemDelta", "capabilityRequirements", "preview"];
  const allowed = new Set([...required, "designTokens"]);
  if (required.some((key) => !(key in artifacts)) ||
      Object.keys(artifacts).some((key) => !allowed.has(key)))
    throw new RevisionIntegrityError("invalid manifest artifacts");
  for (const artifact of Object.values(artifacts)) {
    assertExactKeys(artifact, ["path", "digest", "mediaType", "schemaRef"], "artifact reference");
    if (!(typeof artifact.path === "string" && PORTABLE_PATH.test(artifact.path)) ||
        !isSha256(artifact.digest) ||
        !(typeof artifact.mediaType === "string" && artifact.mediaType.length > 0) ||
        !(typeof artifact.schemaRef === "string" && artifact.schemaRef.length > 0))
      throw new RevisionIntegrityError("invalid artifact reference");
  }
}

function assertAuthorInvocations(invocations) {
  if (!isRecord(invocations) || Object.keys(invocations).length === 0)
    throw new RevisionIntegrityError("invalid author invocation references");
  for (const [key, invocation] of Object.entries(invocations)) {
    if (!isIdentifier(key)) throw new RevisionIntegrityError("invalid author invocation key");
    if (!isRecord(invocation)) throw new RevisionIntegrityError("invalid author invocation");
    const required = [
      "provider", "toolOrModel", "profileRevision", "inputContextDigest", "instructionDigest", "outputDigest",
    ];
    const allowed = new Set([...required, "orchestrator"]);
    if (required.some((field) => !(field in invocation)) ||
        Object.keys(invocation).some((field) => !allowed.has(field)) ||
        ["provider", "toolOrModel", "profileRevision"].some((field) =>
          !(typeof invocation[field] === "string" && invocation[field].length > 0)) ||
        (invocation.orchestrator !== undefined &&
          !(typeof invocation.orchestrator === "string" && invocation.orchestrator.length > 0)) ||
        ["inputContextDigest", "instructionDigest", "outputDigest"].some((field) =>
          !isSha256(invocation[field])))
      throw new RevisionIntegrityError("invalid author invocation");
  }
}

function revisionFromManifest(command, previousRevisionId, feedbackRefs = []) {
  assertManifest(command, previousRevisionId);
  return {
    schemaVersion: "1.0",
    requestId: command.requestId,
    revisionId: command.revisionId,
    previousRevisionId,
    status: "draft",
    materialFingerprint: materialFingerprint(command.manifest),
    bundleDigest: command.manifest.bundleDigest,
    feedbackRefs: clone(feedbackRefs),
    createdAt: command.manifest.createdAt,
    stateChangedAt: command.manifest.createdAt,
  };
}

function sameRevisionCreation(existing, candidate) {
  const immutableKeys = [
    "schemaVersion", "requestId", "revisionId", "previousRevisionId", "materialFingerprint",
    "bundleDigest", "feedbackRefs", "createdAt",
  ];
  return immutableKeys.every((key) => equal(existing[key], candidate[key]));
}

function createRevision(snapshot, command) {
  let candidate;
  try { candidate = revisionFromManifest(command, null); }
  catch (cause) { return failure(snapshot, command, "integrity-error", cause.message); }
  const existing = snapshot.revisions.find((revision) => revision.revisionId === command.revisionId);
  if (existing) {
    return sameRevisionCreation(existing, candidate)
      ? success(snapshot, { revision: clone(existing) })
      : failure(snapshot, command, "conflict", "revisionId already exists");
  }
  if (snapshot.revisions.length !== 0)
    return failure(snapshot, command, "invalid-transition", "initial revision requires an empty snapshot");
  snapshot.revisions.push(candidate);
  return success(snapshot, { revision: clone(candidate) });
}

function propose(snapshot, command) {
  const revision = snapshot.revisions.find((item) => item.revisionId === command.revisionId);
  if (!revision) return failure(snapshot, command, "not-found", "revision was not found");
  if (revision.status === "proposed") return success(snapshot, { revision: clone(revision) });
  if (revision.status !== "draft")
    return failure(snapshot, command, "invalid-transition", "only draft revisions may be proposed");
  revision.status = "proposed";
  return success(snapshot, { revision: clone(revision) });
}

function decide(snapshot, command) {
  try { assertDecisionShape(command.decision); }
  catch (cause) { return failure(snapshot, command, "integrity-error", cause.message); }
  const decision = clone(command.decision);
  if (decision.requestId !== command.requestId || decision.revisionId !== command.revisionId)
    return failure(snapshot, command, "integrity-error", "decision command identity mismatch");
  const existing = snapshot.decisions.find((item) => item.decisionId === decision.decisionId);
  if (existing) {
    if (!equal(existing, decision))
      return failure(snapshot, command, "conflict", "decisionId already exists");
    const revision = snapshot.revisions.find((item) => item.revisionId === decision.revisionId);
    return success(snapshot, { revision: clone(revision), decision: clone(existing) });
  }
  const revision = snapshot.revisions.find((item) => item.revisionId === decision.revisionId);
  if (!revision) return failure(snapshot, command, "not-found", "decision target was not found");
  if (decision.bundleDigest !== revision.bundleDigest)
    return failure(snapshot, command, "integrity-error", "decision bundle digest mismatch");
  if (revision.status !== "proposed")
    return failure(snapshot, command, "invalid-transition", "only proposed revisions may be decided");
  revision.status = STATUS_BY_VERDICT[decision.verdict];
  revision.stateChangedAt = decision.decidedAt;
  snapshot.decisions.push(decision);
  return success(snapshot, { revision: clone(revision), decision: clone(decision) });
}

function unresolvedFeedback(snapshot, predecessorRevisionId) {
  const revisions = new Map(snapshot.revisions.map((revision) => [revision.revisionId, revision]));
  const ancestors = new Set([predecessorRevisionId]);
  let current = revisions.get(predecessorRevisionId);
  while (current?.previousRevisionId !== null) {
    ancestors.add(current.previousRevisionId);
    current = revisions.get(current.previousRevisionId);
  }
  const handled = new Set(snapshot.revisions.flatMap((revision) =>
    revision.feedbackRefs.map((feedback) => feedback.decisionId)));
  return snapshot.decisions
    .filter((decision) =>
      decision.verdict === "request-changes" && ancestors.has(decision.revisionId) &&
      !handled.has(decision.decisionId))
    .sort(compareDecisions);
}

function createSuccessor(snapshot, command) {
  for (const feedback of command.feedbackDispositions ?? []) {
    try { assertFeedbackRef(feedback); }
    catch (cause) { return failure(snapshot, command, "integrity-error", cause.message); }
  }
  let candidate;
  try {
    candidate = revisionFromManifest(
      command,
      command.predecessorRevisionId,
      command.feedbackDispositions,
    );
  } catch (cause) {
    return failure(snapshot, command, "integrity-error", cause.message);
  }
  const predecessor = snapshot.revisions.find((revision) =>
    revision.revisionId === command.predecessorRevisionId);
  if (!predecessor) {
    return failure(snapshot, command, "not-found", "predecessor was not found", {
      revisionId: command.predecessorRevisionId,
    });
  }
  const existing = snapshot.revisions.find((revision) => revision.revisionId === command.revisionId);
  if (existing) {
    if (!sameRevisionCreation(existing, candidate) || predecessor.status !== "superseded")
      return failure(snapshot, command, "conflict", "revisionId already exists");
    const authoringFeedback = appliedFeedback(snapshot, existing.feedbackRefs);
    return success(snapshot, { revision: clone(existing), authoringFeedback });
  }
  if (predecessor.status === "superseded")
    return failure(snapshot, command, "invalid-transition", "superseded is terminal");
  if (candidate.materialFingerprint === predecessor.materialFingerprint)
    return failure(snapshot, command, "conflict", "successor has no material change");

  const expected = unresolvedFeedback(snapshot, predecessor.revisionId);
  const supplied = command.feedbackDispositions;
  if (!Array.isArray(supplied) || supplied.length !== expected.length ||
      supplied.some((feedback, index) =>
        feedback.decisionId !== expected[index].decisionId ||
        feedback.sourceRevisionId !== expected[index].revisionId))
    return failure(
      snapshot,
      command,
      "conflict",
      "feedback dispositions do not cover unresolved ancestor feedback in canonical order",
    );

  predecessor.status = "superseded";
  predecessor.stateChangedAt = command.manifest.createdAt;
  snapshot.revisions.push(candidate);
  return success(snapshot, {
    revision: clone(candidate),
    authoringFeedback: appliedFeedback(snapshot, candidate.feedbackRefs),
  });
}

function appliedFeedback(snapshot, feedbackRefs) {
  return feedbackRefs
    .filter((feedback) => feedback.disposition === "applied")
    .map((feedback) => clone(snapshot.decisions.find((decision) =>
      decision.decisionId === feedback.decisionId)));
}

export function transition(snapshot, command) {
  let input;
  try {
    input = clone(snapshot);
    assertSnapshotIntegrity(input);
  } catch (cause) {
    return failure(snapshot, command, "integrity-error", cause.message);
  }
  try { assertCommandShape(command); }
  catch (cause) { return failure(input, command, "integrity-error", cause.message); }
  if (command.requestId !== input.requestId)
    return failure(input, command, "not-found", `request ${command.requestId} was not found`);
  try {
    switch (command.operation) {
      case "create-revision": return createRevision(input, command);
      case "propose": return propose(input, command);
      case "decide": return decide(input, command);
      case "create-successor": return createSuccessor(input, command);
      default: return failure(input, command, "invalid-transition", `unknown operation ${command.operation}`);
    }
  } catch (cause) {
    return failure(input, command, "integrity-error", cause.message);
  }
}

export function deriveApprovalValidity(snapshot, revisionId, explicitDecision) {
  assertSnapshotIntegrity(snapshot);
  const revision = snapshot.revisions.find((item) => item.revisionId === revisionId);
  if (!revision) throw new RevisionIntegrityError(`revision ${revisionId} was not found`);
  if (explicitDecision !== undefined) assertDecisionShape(explicitDecision);
  const decision = explicitDecision ?? snapshot.decisions.find((item) =>
    item.verdict === "approve" && item.revisionId === revisionId);
  const base = {
    schemaVersion: "1.0",
    requestId: revision.requestId,
    revisionId: revision.revisionId,
    bundleDigest: revision.bundleDigest,
  };
  if (!decision || decision.verdict !== "approve") {
    return { ...base, status: "missing", reason: null, decisionId: null };
  }
  let reason = null;
  if (decision.requestId !== revision.requestId) reason = "request-mismatch";
  else if (decision.revisionId !== revision.revisionId) reason = "revision-mismatch";
  else if (decision.bundleDigest !== revision.bundleDigest) reason = "bundle-mismatch";
  else if (revision.status === "superseded") reason = "revision-superseded";
  return reason
    ? { ...base, status: "stale", reason, decisionId: decision.decisionId }
    : { ...base, status: "valid", reason: null, decisionId: decision.decisionId };
}

export const approvalValidity = deriveApprovalValidity;

export function createEmptySnapshot(requestId) {
  if (!isIdentifier(requestId)) throw new RevisionIntegrityError("invalid requestId");
  return { schemaVersion: "1.0", requestId, revisions: [], decisions: [] };
}
