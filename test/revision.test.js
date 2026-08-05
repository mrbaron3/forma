import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import {
  RevisionIntegrityError,
  assertSnapshotIntegrity,
  bundleDigest,
  createEmptySnapshot,
  deriveApprovalValidity,
  materialFingerprint,
  restoreSnapshot,
  serializeSnapshot,
  transition,
} from "../src/revision/index.js";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const activeDirectory = path.join(repositoryRoot, "contracts", "v1");
const releaseDirectory = path.join(repositoryRoot, "contracts", "contract-v1.0.0-rc.3");
const fixtureDirectory = path.join(repositoryRoot, "test", "fixtures", "revision-contracts");
const manifestTemplate = readJson(path.join(activeDirectory, "examples", "design-bundle-manifest.example.json"));
const decisionTemplate = readJson(path.join(activeDirectory, "examples", "human-design-decision.example.json"));
const REQUEST_ID = "request.revision";
const CREATED_AT = "2026-08-03T00:00:00.000Z";
const SUCCESSOR_AT = "2026-08-03T00:02:00.000Z";
const DECIDED_AT = "2026-08-03T00:01:00.000Z";
const digest = (character) => `sha256:${character.repeat(64)}`;
const clone = (value) => structuredClone(value);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function makeManifest({
  requestId = REQUEST_ID,
  revisionId = "revision.1",
  previousRevisionId = null,
  sourceDigest = digest("1"),
  baseDigest = digest("2"),
  artifactDigest = digest("3"),
  invocationDigest = digest("4"),
  bundleId = `bundle.${revisionId}`,
  createdAt = CREATED_AT,
} = {}) {
  const manifest = clone(manifestTemplate);
  manifest.bundleId = bundleId;
  manifest.requestId = requestId;
  manifest.revisionId = revisionId;
  manifest.previousRevisionId = previousRevisionId;
  manifest.sourceDigest = sourceDigest;
  manifest.designSystemBaseRevision.digest = baseDigest;
  manifest.artifacts.experience.digest = artifactDigest;
  manifest.authorInvocationRefs[Object.keys(manifest.authorInvocationRefs)[0]].instructionDigest = invocationDigest;
  manifest.createdAt = createdAt;
  manifest.bundleDigest = bundleDigest(manifest);
  return manifest;
}

function makeDecision({
  decisionId = "decision.1",
  requestId = REQUEST_ID,
  revisionId = "revision.1",
  targetDigest,
  verdict = "approve",
  rationale = `${verdict} rationale`,
  decidedAt = DECIDED_AT,
} = {}) {
  return {
    ...clone(decisionTemplate),
    decisionId,
    requestId,
    revisionId,
    bundleDigest: targetDigest,
    verdict,
    rationale,
    decidedAt,
    supersedesDecisionId: null,
  };
}

function createCommand(manifest) {
  return {
    schemaVersion: "1.0",
    operation: "create-revision",
    requestId: manifest.requestId,
    revisionId: manifest.revisionId,
    manifest,
  };
}

function proposeCommand(revisionId = "revision.1") {
  return { schemaVersion: "1.0", operation: "propose", requestId: REQUEST_ID, revisionId };
}

function decideCommand(decision) {
  return {
    schemaVersion: "1.0",
    operation: "decide",
    requestId: REQUEST_ID,
    revisionId: decision.revisionId,
    decision,
  };
}

function successorCommand(predecessorRevisionId, manifest, feedbackDispositions = []) {
  return {
    schemaVersion: "1.0",
    operation: "create-successor",
    requestId: REQUEST_ID,
    predecessorRevisionId,
    revisionId: manifest.revisionId,
    manifest,
    feedbackDispositions,
  };
}

function feedbackFor(decision, disposition = "applied", note = null) {
  return {
    decisionId: decision.decisionId,
    sourceRevisionId: decision.revisionId,
    disposition,
    note,
  };
}

function apply(snapshot, command) {
  const result = transition(snapshot, command);
  assert.equal(result.ok, true, result.error?.message);
  return result;
}

function initialSnapshot(manifest = makeManifest()) {
  return apply(createEmptySnapshot(REQUEST_ID), createCommand(manifest)).nextSnapshot;
}

function decidedSnapshot(verdict = "approve", options = {}) {
  const manifest = makeManifest(options.manifest);
  let snapshot = initialSnapshot(manifest);
  snapshot = apply(snapshot, proposeCommand(manifest.revisionId)).nextSnapshot;
  const decision = makeDecision({
    verdict,
    revisionId: manifest.revisionId,
    targetDigest: manifest.bundleDigest,
    ...options.decision,
  });
  snapshot = apply(snapshot, decideCommand(decision)).nextSnapshot;
  return { decision, manifest, snapshot };
}

function feedbackChainBeforeSecondSuccessor() {
  const first = decidedSnapshot("request-changes", {
    decision: { decisionId: "decision.b", decidedAt: DECIDED_AT },
  });
  const secondManifest = makeManifest({
    revisionId: "revision.2",
    previousRevisionId: "revision.1",
    sourceDigest: digest("5"),
    createdAt: SUCCESSOR_AT,
  });
  const firstFeedback = feedbackFor(first.decision, "applied", null);
  const firstSuccessor = apply(
    first.snapshot,
    successorCommand("revision.1", secondManifest, [firstFeedback]),
  );
  let snapshot = firstSuccessor.nextSnapshot;
  snapshot = apply(snapshot, proposeCommand("revision.2")).nextSnapshot;
  const secondDecision = makeDecision({
    decisionId: "decision.a",
    revisionId: "revision.2",
    targetDigest: secondManifest.bundleDigest,
    verdict: "request-changes",
    decidedAt: "2026-08-03T00:03:00.000Z",
  });
  snapshot = apply(snapshot, decideCommand(secondDecision)).nextSnapshot;
  return {
    firstDecision: first.decision,
    firstFeedback,
    firstSuccessor,
    secondDecision,
    snapshot,
  };
}

function expectNoWrite(snapshot, command, code) {
  const before = clone(snapshot);
  const result = transition(snapshot, command);
  assert.equal(result.ok, false);
  assert.equal(result.error.code, code);
  assert.deepEqual(snapshot, before);
  assert.equal("nextSnapshot" in result, false);
  assert.deepEqual(Object.keys(result.error).sort(), [
    "code", "decisionId", "message", "operation", "requestId", "revisionId", "schemaVersion",
  ].sort());
  return result;
}

function compileInventory(directory) {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  const schemas = fs.readdirSync(directory)
    .filter((name) => name.endsWith(".schema.json"))
    .sort()
    .map((name) => readJson(path.join(directory, name)));
  for (const schema of schemas) ajv.addSchema(schema);
  for (const schema of schemas) assert.ok(ajv.getSchema(schema.$id), `failed to compile ${schema.$id}`);
  return { ajv, schemas };
}

test("[PR-INTENT] active v1 and rc.3 deep-match all 16 Forma schemas and revision fixtures", () => {
  const revisionNames = [
    "design-revision-state",
    "approval-validity",
    "revision-state-command",
    "revision-state-snapshot",
    "revision-state-error",
  ];
  const active = compileInventory(activeDirectory);
  const release = compileInventory(releaseDirectory);
  assert.equal(active.schemas.length, 16);
  assert.equal(release.schemas.length, 16);
  for (const inventory of [active, release]) {
    for (const schema of inventory.schemas) {
      assert.match(schema.$id, /^urn:forma:schema:v1:/);
      assert.equal(JSON.stringify(schema).includes("urn:designflow:schema"), false);
    }
  }
  const releaseById = new Map(release.schemas.map((schema) => [schema.$id, schema]));
  for (const schema of active.schemas) {
    assert.deepEqual(releaseById.get(schema.$id), schema, `${schema.$id} differs in rc.3`);
  }
  for (const name of revisionNames) {
    const activeSchema = readJson(path.join(activeDirectory, `${name}.schema.json`));
    const releaseSchema = readJson(path.join(releaseDirectory, `${name}.schema.json`));
    assert.deepEqual(releaseSchema, activeSchema);
    for (const inventory of [active, release]) {
      const validate = inventory.ajv.getSchema(activeSchema.$id);
      const positive = readJson(path.join(fixtureDirectory, `${name}.valid.json`));
      const negative = readJson(path.join(fixtureDirectory, `${name}.invalid.json`));
      assert.equal(validate(positive), true, `${name} positive: ${inventory.ajv.errorsText(validate.errors)}`);
      assert.equal(validate(negative), false, `${name} negative fixture was accepted`);
    }
  }
});

test("[PR-INTENT] create-revision emits the manifest-free closed state record with deterministic timestamps", () => {
  const manifest = makeManifest();
  const result = apply(createEmptySnapshot(REQUEST_ID), createCommand(manifest));
  assert.deepEqual(result.result.revision, {
    schemaVersion: "1.0",
    requestId: REQUEST_ID,
    revisionId: "revision.1",
    previousRevisionId: null,
    status: "draft",
    materialFingerprint: materialFingerprint(manifest),
    bundleDigest: manifest.bundleDigest,
    feedbackRefs: [],
    createdAt: CREATED_AT,
    stateChangedAt: CREATED_AT,
  });
  assert.equal("manifest" in result.result.revision, false);
  assert.equal("state" in result.result.revision, false);
});

test("[PR-INTENT] propose and every exhaustive human verdict follow the allowed lifecycle with deterministic stateChangedAt", () => {
  for (const [verdict, status] of [
    ["approve", "approved"],
    ["request-changes", "changes-requested"],
    ["reject", "rejected"],
  ]) {
    const manifest = makeManifest();
    let snapshot = initialSnapshot(manifest);
    snapshot = apply(snapshot, proposeCommand()).nextSnapshot;
    assert.equal(snapshot.revisions[0].status, "proposed");
    assert.equal(snapshot.revisions[0].stateChangedAt, CREATED_AT);
    const decision = makeDecision({ verdict, targetDigest: manifest.bundleDigest });
    snapshot = apply(snapshot, decideCommand(decision)).nextSnapshot;
    assert.equal(snapshot.revisions[0].status, status);
    assert.equal(snapshot.revisions[0].stateChangedAt, DECIDED_AT);
    expectNoWrite(
      snapshot,
      decideCommand(makeDecision({
        decisionId: "decision.2",
        verdict,
        targetDigest: manifest.bundleDigest,
      })),
      "invalid-transition",
    );
  }
});

test("[PR-INTENT] every non-terminal state creates a successor and superseded remains terminal", () => {
  for (const status of ["draft", "proposed", "approved", "changes-requested", "rejected"]) {
    const manifest = makeManifest();
    let snapshot = initialSnapshot(manifest);
    let decision;
    if (status !== "draft") snapshot = apply(snapshot, proposeCommand()).nextSnapshot;
    if (["approved", "changes-requested", "rejected"].includes(status)) {
      const verdict = {
        approved: "approve",
        "changes-requested": "request-changes",
        rejected: "reject",
      }[status];
      decision = makeDecision({ verdict, targetDigest: manifest.bundleDigest });
      snapshot = apply(snapshot, decideCommand(decision)).nextSnapshot;
    }
    const successorManifest = makeManifest({
      revisionId: "revision.2",
      previousRevisionId: "revision.1",
      sourceDigest: digest("5"),
      createdAt: SUCCESSOR_AT,
    });
    const feedback = status === "changes-requested" ? [feedbackFor(decision)] : [];
    snapshot = apply(
      snapshot,
      successorCommand("revision.1", successorManifest, feedback),
    ).nextSnapshot;
    const predecessor = snapshot.revisions.find((revision) => revision.revisionId === "revision.1");
    const successor = snapshot.revisions.find((revision) => revision.revisionId === "revision.2");
    assert.equal(predecessor.status, "superseded");
    assert.equal(predecessor.stateChangedAt, SUCCESSOR_AT);
    assert.equal(successor.status, "draft");
    assert.equal(successor.stateChangedAt, SUCCESSOR_AT);
    assert.deepEqual(successor.feedbackRefs, feedback);

    const forbiddenManifest = makeManifest({
      revisionId: "revision.3",
      previousRevisionId: "revision.1",
      sourceDigest: digest("6"),
      createdAt: "2026-08-03T00:03:00.000Z",
    });
    expectNoWrite(
      snapshot,
      successorCommand("revision.1", forbiddenManifest),
      "invalid-transition",
    );
  }
});

test("[PR-INTENT] revision and decision IDs replay exact commands and conflict on different canonical input", () => {
  const manifest = makeManifest();
  const create = createCommand(manifest);
  let snapshot = apply(createEmptySnapshot(REQUEST_ID), create).nextSnapshot;
  snapshot = apply(snapshot, proposeCommand()).nextSnapshot;
  assert.deepEqual(apply(snapshot, proposeCommand()).nextSnapshot, snapshot);
  assert.deepEqual(apply(snapshot, create).nextSnapshot, snapshot);
  expectNoWrite(
    snapshot,
    createCommand(makeManifest({ sourceDigest: digest("7") })),
    "conflict",
  );

  const decision = makeDecision({ verdict: "request-changes", targetDigest: manifest.bundleDigest });
  snapshot = apply(snapshot, decideCommand(decision)).nextSnapshot;
  assert.deepEqual(apply(snapshot, decideCommand(decision)).nextSnapshot, snapshot);
  expectNoWrite(
    snapshot,
    decideCommand({ ...decision, rationale: "same ID, different canonical input" }),
    "conflict",
  );

  const successorManifest = makeManifest({
    revisionId: "revision.2",
    previousRevisionId: "revision.1",
    sourceDigest: digest("8"),
    createdAt: SUCCESSOR_AT,
  });
  const successor = successorCommand("revision.1", successorManifest, [feedbackFor(decision)]);
  snapshot = apply(snapshot, successor).nextSnapshot;
  assert.deepEqual(apply(snapshot, successor).nextSnapshot, snapshot);
  expectNoWrite(
    snapshot,
    successorCommand("revision.1", makeManifest({
      revisionId: "revision.2",
      previousRevisionId: "revision.1",
      sourceDigest: digest("9"),
      createdAt: SUCCESSOR_AT,
    }), [feedbackFor(decision)]),
    "conflict",
  );
});

test("[PR-INTENT] command identity, embedded records, and closed error context fail without writes", () => {
  const manifest = makeManifest();
  let proposed = initialSnapshot(manifest);
  proposed = apply(proposed, proposeCommand()).nextSnapshot;
  const baseDecision = makeDecision({ targetDigest: manifest.bundleDigest });

  const cases = [
    [{ ...proposeCommand(), requestId: "request.other" }, "not-found"],
    [proposeCommand("revision.missing"), "not-found"],
    [{ schemaVersion: "1.0", operation: "unknown-operation", requestId: REQUEST_ID }, "invalid-transition"],
    [{ ...createCommand(makeManifest({ requestId: "request.other" })), requestId: REQUEST_ID }, "integrity-error"],
    [{ ...createCommand(manifest), revisionId: "revision.other" }, "integrity-error"],
    [{ ...createCommand(manifest), manifest: { ...manifest, bundleDigest: digest("0") } }, "integrity-error"],
    [{ ...decideCommand(baseDecision), revisionId: "revision.other" }, "integrity-error"],
    [decideCommand({ ...baseDecision, requestId: "request.other" }), "integrity-error"],
    [decideCommand({ ...baseDecision, revisionId: "revision.missing" }), "not-found"],
    [decideCommand({ ...baseDecision, bundleDigest: digest("0") }), "integrity-error"],
    [decideCommand({ ...baseDecision, verdict: "silently-accept" }), "integrity-error"],
    [decideCommand({ ...baseDecision, decidedBy: {} }), "integrity-error"],
    [decideCommand({
      ...baseDecision,
      decidedBy: { ...baseDecision.decidedBy, internalRole: "admin" },
    }), "integrity-error"],
  ];
  for (const [command, code] of cases) expectNoWrite(proposed, command, code);

  const incompleteManifest = clone(manifest);
  delete incompleteManifest.artifacts.preview;
  incompleteManifest.bundleDigest = bundleDigest(incompleteManifest);
  expectNoWrite(
    createEmptySnapshot(REQUEST_ID),
    createCommand(incompleteManifest),
    "integrity-error",
  );
  const invalidDateManifest = clone(manifest);
  invalidDateManifest.createdAt = "2026-02-31T00:00:00Z";
  invalidDateManifest.bundleDigest = bundleDigest(invalidDateManifest);
  expectNoWrite(
    createEmptySnapshot(REQUEST_ID),
    createCommand(invalidDateManifest),
    "integrity-error",
  );
  const invalidUriManifest = clone(manifest);
  invalidUriManifest.designSystemBaseRevision.uri = "a:b c";
  invalidUriManifest.bundleDigest = bundleDigest(invalidUriManifest);
  expectNoWrite(
    createEmptySnapshot(REQUEST_ID),
    createCommand(invalidUriManifest),
    "integrity-error",
  );

  const decisionError = expectNoWrite(
    proposed,
    decideCommand({ ...baseDecision, bundleDigest: digest("0") }),
    "integrity-error",
  ).error;
  assert.equal(decisionError.operation, "decide");
  assert.equal(decisionError.requestId, REQUEST_ID);
  assert.equal(decisionError.revisionId, "revision.1");
  assert.equal(decisionError.decisionId, "decision.1");
  const { ajv } = compileInventory(activeDirectory);
  assert.equal(ajv.getSchema("urn:forma:schema:v1:revision-state-error")(decisionError), true);
});

test("[PR-INTENT] canonical revision boundaries reject unpaired Unicode in values and object keys", () => {
  const manifest = makeManifest();
  let snapshot = initialSnapshot(manifest);
  snapshot = apply(snapshot, proposeCommand()).nextSnapshot;
  expectNoWrite(
    snapshot,
    decideCommand(makeDecision({
      targetDigest: manifest.bundleDigest,
      rationale: "invalid-\ud800-rationale",
    })),
    "integrity-error",
  );

  const malformedValue = clone(manifest);
  malformedValue.bundleId = "bundle.\ud800";
  assert.throws(() => bundleDigest(malformedValue), RevisionIntegrityError);
  const malformedKey = clone(manifest);
  malformedKey.authorInvocationRefs["\ud800"] = clone(
    malformedKey.authorInvocationRefs[Object.keys(malformedKey.authorInvocationRefs)[0]],
  );
  assert.throws(() => bundleDigest(malformedKey), RevisionIntegrityError);

  const malformedSnapshot = decidedSnapshot("approve").snapshot;
  malformedSnapshot.decisions[0].rationale = "invalid-\ud800-rationale";
  assert.throws(() => restoreSnapshot(malformedSnapshot), RevisionIntegrityError);
  assert.throws(() => restoreSnapshot(JSON.stringify(malformedSnapshot)), RevisionIntegrityError);

  const feedbackSnapshot = feedbackChainBeforeSecondSuccessor().firstSuccessor.nextSnapshot;
  feedbackSnapshot.revisions[1].feedbackRefs[0].disposition = "deferred";
  feedbackSnapshot.revisions[1].feedbackRefs[0].note = "invalid-\udfff-note";
  assert.throws(() => restoreSnapshot(feedbackSnapshot), RevisionIntegrityError);
});

test("[PR-INTENT] corrupted IDs, request scope, lineage, records, decisions, and feedback fail restore", () => {
  const first = decidedSnapshot("approve");
  const successorManifest = makeManifest({
    revisionId: "revision.2",
    previousRevisionId: "revision.1",
    sourceDigest: digest("5"),
    createdAt: SUCCESSOR_AT,
  });
  const valid = apply(
    first.snapshot,
    successorCommand("revision.1", successorManifest),
  ).nextSnapshot;
  const invalid = [];

  const extraField = clone(valid);
  extraField.revisions[0].manifest = first.manifest;
  invalid.push(extraField);
  const duplicate = clone(valid);
  duplicate.revisions.push(clone(duplicate.revisions[1]));
  invalid.push(duplicate);
  const requestMismatch = clone(valid);
  requestMismatch.revisions[0].requestId = "request.other";
  invalid.push(requestMismatch);
  const broken = clone(valid);
  broken.revisions[1].previousRevisionId = "revision.missing";
  invalid.push(broken);
  const cyclic = clone(valid);
  cyclic.revisions[0].previousRevisionId = "revision.2";
  invalid.push(cyclic);
  const invalidDecision = clone(valid);
  invalidDecision.decisions[0].bundleDigest = digest("0");
  invalid.push(invalidDecision);
  const topLevelFeedback = clone(valid);
  topLevelFeedback.feedbackDispositions = [];
  invalid.push(topLevelFeedback);
  const wrongVerdict = decidedSnapshot("approve").snapshot;
  wrongVerdict.revisions[0].status = "changes-requested";
  invalid.push(wrongVerdict);
  const duplicateDecision = decidedSnapshot("approve").snapshot;
  duplicateDecision.decisions.push({
    ...clone(duplicateDecision.decisions[0]),
    decisionId: "decision.2",
  });
  invalid.push(duplicateDecision);
  const decisionOnDraft = initialSnapshot();
  decisionOnDraft.decisions.push(makeDecision({
    targetDigest: decisionOnDraft.revisions[0].bundleDigest,
  }));
  invalid.push(decisionOnDraft);
  const draftTime = initialSnapshot();
  draftTime.revisions[0].stateChangedAt = "2026-08-03T00:00:01.000Z";
  invalid.push(draftTime);
  const proposedTime = apply(initialSnapshot(), proposeCommand()).nextSnapshot;
  proposedTime.revisions[0].stateChangedAt = "2026-08-03T00:00:01.000Z";
  invalid.push(proposedTime);
  const decidedTime = decidedSnapshot("reject").snapshot;
  decidedTime.revisions[0].stateChangedAt = CREATED_AT;
  invalid.push(decidedTime);
  const supersededTime = clone(valid);
  supersededTime.revisions[0].stateChangedAt = "2026-08-03T00:02:00+00:00";
  invalid.push(supersededTime);

  for (const snapshot of invalid) {
    assert.throws(() => assertSnapshotIntegrity(snapshot), RevisionIntegrityError);
    assert.throws(() => restoreSnapshot(snapshot), RevisionIntegrityError);
    expectNoWrite(snapshot, proposeCommand("revision.2"), "integrity-error");
  }
  assert.throws(() => restoreSnapshot("{"), RevisionIntegrityError);
});

test("[PR-INTENT] approval validity returns every required closed field and stale precedence", () => {
  const manifest = makeManifest();
  const missing = deriveApprovalValidity(initialSnapshot(manifest), "revision.1");
  assert.deepEqual(missing, {
    schemaVersion: "1.0",
    requestId: REQUEST_ID,
    revisionId: "revision.1",
    bundleDigest: manifest.bundleDigest,
    status: "missing",
    reason: null,
    decisionId: null,
  });

  const approved = decidedSnapshot("approve");
  assert.deepEqual(deriveApprovalValidity(approved.snapshot, "revision.1"), {
    schemaVersion: "1.0",
    requestId: REQUEST_ID,
    revisionId: "revision.1",
    bundleDigest: approved.manifest.bundleDigest,
    status: "valid",
    reason: null,
    decisionId: approved.decision.decisionId,
  });
  for (const [decision, reason] of [
    [{ ...approved.decision, requestId: "request.other" }, "request-mismatch"],
    [{ ...approved.decision, revisionId: "revision.other" }, "revision-mismatch"],
    [{ ...approved.decision, bundleDigest: digest("0") }, "bundle-mismatch"],
  ]) {
    assert.equal(
      deriveApprovalValidity(approved.snapshot, "revision.1", decision).reason,
      reason,
    );
  }

  const successorManifest = makeManifest({
    revisionId: "revision.2",
    previousRevisionId: "revision.1",
    sourceDigest: digest("5"),
    createdAt: SUCCESSOR_AT,
  });
  const superseded = apply(
    approved.snapshot,
    successorCommand("revision.1", successorManifest),
  ).nextSnapshot;
  const stale = deriveApprovalValidity(superseded, "revision.1");
  assert.equal(stale.status, "stale");
  assert.equal(stale.reason, "revision-superseded");
  assert.equal(superseded.decisions.some((item) => item.decisionId === approved.decision.decisionId), true);
  assert.equal(deriveApprovalValidity(superseded, "revision.1", {
    ...approved.decision,
    requestId: "request.other",
    revisionId: "revision.other",
    bundleDigest: digest("0"),
  }).reason, "request-mismatch");

  const { ajv } = compileInventory(activeDirectory);
  const validate = ajv.getSchema("urn:forma:schema:v1:approval-validity");
  for (const value of [missing, stale, deriveApprovalValidity(approved.snapshot, "revision.1")])
    assert.equal(validate(value), true, ajv.errorsText(validate.errors));
});

test("[PR-INTENT] material fingerprint includes only authored material and non-material successors conflict", () => {
  const original = makeManifest();
  const operationalOnly = makeManifest({
    revisionId: "revision.2",
    previousRevisionId: "revision.1",
    bundleId: "bundle.operational",
    createdAt: SUCCESSOR_AT,
  });
  assert.equal(materialFingerprint(original), materialFingerprint(operationalOnly));
  for (const changed of [
    makeManifest({ requestId: "request.other" }),
    makeManifest({ sourceDigest: digest("5") }),
    makeManifest({ baseDigest: digest("6") }),
    makeManifest({ artifactDigest: digest("7") }),
    makeManifest({ invocationDigest: digest("8") }),
  ]) assert.notEqual(materialFingerprint(original), materialFingerprint(changed));

  assert.equal(bundleDigest(original), bundleDigest({ ...original, bundleDigest: digest("0") }));
  assert.notEqual(bundleDigest(original), bundleDigest(operationalOnly));
  expectNoWrite(
    initialSnapshot(original),
    successorCommand("revision.1", operationalOnly),
    "conflict",
  );
});

test("[PR-INTENT] request-changes feedback is canonically ordered, audited once, and only applied rationale reaches authoring", () => {
  const pending = feedbackChainBeforeSecondSuccessor();

  const successorManifest = makeManifest({
    revisionId: "revision.3",
    previousRevisionId: "revision.2",
    sourceDigest: digest("6"),
    createdAt: "2026-08-03T00:04:00.000Z",
  });
  const deferred = feedbackFor(pending.secondDecision, "deferred", "Apply after the next source revision");
  const result = apply(
    pending.snapshot,
    successorCommand("revision.2", successorManifest, [deferred]),
  );
  const successor = result.nextSnapshot.revisions.find((revision) => revision.revisionId === "revision.3");
  assert.deepEqual(
    result.nextSnapshot.revisions.find((revision) => revision.revisionId === "revision.2").feedbackRefs,
    [pending.firstFeedback],
  );
  assert.deepEqual(successor.feedbackRefs, [deferred]);
  assert.deepEqual(pending.firstSuccessor.result.authoringFeedback, [pending.firstDecision]);
  assert.deepEqual(result.result.authoringFeedback, []);
  assert.equal(result.nextSnapshot.decisions.length, 2);

  const invalidApplied = clone(result.nextSnapshot);
  invalidApplied.revisions[1].feedbackRefs[0].note = "must be null";
  assert.throws(() => assertSnapshotIntegrity(invalidApplied), RevisionIntegrityError);

  const missing = clone(result.nextSnapshot);
  missing.revisions[1].feedbackRefs = [];
  assert.throws(() => assertSnapshotIntegrity(missing), RevisionIntegrityError);

  const delayed = clone(result.nextSnapshot);
  delayed.revisions[1].feedbackRefs = [];
  delayed.revisions[2].feedbackRefs = [pending.firstFeedback, deferred];
  assert.throws(() => assertSnapshotIntegrity(delayed), RevisionIntegrityError);

  const duplicateHandling = clone(result.nextSnapshot);
  duplicateHandling.revisions[2].feedbackRefs = [pending.firstFeedback, deferred];
  assert.throws(() => assertSnapshotIntegrity(duplicateHandling), RevisionIntegrityError);
});

test("[PR-INTENT] canonical snapshot orders RFC3339-equivalent instants by ID and restores direct feedback", () => {
  const firstManifest = makeManifest({ createdAt: "2026-08-03T09:00:00+09:00" });
  let snapshot = initialSnapshot(firstManifest);
  snapshot = apply(snapshot, proposeCommand()).nextSnapshot;
  const firstDecision = makeDecision({
    decisionId: "decision.b",
    targetDigest: firstManifest.bundleDigest,
    verdict: "request-changes",
    decidedAt: "2026-08-03T09:00:00+09:00",
  });
  snapshot = apply(snapshot, decideCommand(firstDecision)).nextSnapshot;
  const secondManifest = makeManifest({
    revisionId: "revision.2",
    previousRevisionId: "revision.1",
    sourceDigest: digest("5"),
    createdAt: "2026-08-03T00:00:00.000Z",
  });
  snapshot = apply(snapshot, successorCommand("revision.1", secondManifest, [
    feedbackFor(firstDecision, "applied", null),
  ])).nextSnapshot;
  snapshot = apply(snapshot, proposeCommand("revision.2")).nextSnapshot;
  const secondDecision = makeDecision({
    decisionId: "decision.a",
    revisionId: "revision.2",
    targetDigest: secondManifest.bundleDigest,
    verdict: "request-changes",
    decidedAt: "2026-08-03T00:00:00Z",
  });
  snapshot = apply(snapshot, decideCommand(secondDecision)).nextSnapshot;
  const thirdManifest = makeManifest({
    revisionId: "revision.3",
    previousRevisionId: "revision.2",
    sourceDigest: digest("6"),
    createdAt: "2026-08-03T00:01:00.000Z",
  });
  snapshot = apply(snapshot, successorCommand("revision.2", thirdManifest, [
    feedbackFor(secondDecision, "declined", "Conflicts with the source requirement"),
  ])).nextSnapshot;
  const shuffled = clone(snapshot);
  shuffled.revisions.reverse();
  shuffled.decisions.reverse();
  const serialized = serializeSnapshot(shuffled);
  const restored = restoreSnapshot(serialized);
  assert.equal(serialized, serializeSnapshot(snapshot));
  assert.deepEqual(restored.revisions.map((item) => item.revisionId), [
    "revision.1", "revision.2", "revision.3",
  ]);
  assert.deepEqual(restored.decisions.map((item) => item.decisionId), ["decision.a", "decision.b"]);
  assert.deepEqual(restored.revisions[1].feedbackRefs, snapshot.revisions[1].feedbackRefs);
  assert.deepEqual(restored.revisions[2].feedbackRefs, snapshot.revisions[2].feedbackRefs);
  assert.equal(restored.revisions.some((revision) => "manifest" in revision), false);
  assert.equal("feedbackDispositions" in restored, false);
  assert.deepEqual(restoreSnapshot(new TextEncoder().encode(serialized)), restored);
});

test("[PR-INTENT] canonical ordering preserves arbitrary fractions and places leap seconds before the UTC boundary", () => {
  const firstManifest = makeManifest({
    revisionId: "revision.z-fraction",
    createdAt: "2016-12-31T23:59:59.0001Z",
  });
  let snapshot = apply(
    createEmptySnapshot(REQUEST_ID),
    createCommand(firstManifest),
  ).nextSnapshot;
  snapshot = apply(snapshot, proposeCommand("revision.z-fraction")).nextSnapshot;
  const firstDecision = makeDecision({
    decisionId: "decision.z-fraction",
    revisionId: "revision.z-fraction",
    targetDigest: firstManifest.bundleDigest,
    verdict: "request-changes",
    decidedAt: "2016-12-31T23:59:59.0001Z",
  });
  snapshot = apply(snapshot, decideCommand(firstDecision)).nextSnapshot;

  const secondManifest = makeManifest({
    revisionId: "revision.a-fraction",
    previousRevisionId: "revision.z-fraction",
    sourceDigest: digest("5"),
    createdAt: "2016-12-31T23:59:59.0002Z",
  });
  snapshot = apply(snapshot, successorCommand("revision.z-fraction", secondManifest, [
    feedbackFor(firstDecision),
  ])).nextSnapshot;
  snapshot = apply(snapshot, proposeCommand("revision.a-fraction")).nextSnapshot;
  const secondDecision = makeDecision({
    decisionId: "decision.a-fraction",
    revisionId: "revision.a-fraction",
    targetDigest: secondManifest.bundleDigest,
    verdict: "request-changes",
    decidedAt: "2016-12-31T23:59:59.0002Z",
  });
  snapshot = apply(snapshot, decideCommand(secondDecision)).nextSnapshot;

  const leapManifest = makeManifest({
    revisionId: "revision.z-leap",
    previousRevisionId: "revision.a-fraction",
    sourceDigest: digest("6"),
    createdAt: "2017-01-01T00:59:60+01:00",
  });
  snapshot = apply(snapshot, successorCommand("revision.a-fraction", leapManifest, [
    feedbackFor(secondDecision),
  ])).nextSnapshot;
  snapshot = apply(snapshot, proposeCommand("revision.z-leap")).nextSnapshot;
  const leapDecision = makeDecision({
    decisionId: "decision.z-leap",
    revisionId: "revision.z-leap",
    targetDigest: leapManifest.bundleDigest,
    verdict: "request-changes",
    decidedAt: "2017-01-01T00:59:60+01:00",
  });
  snapshot = apply(snapshot, decideCommand(leapDecision)).nextSnapshot;

  const normalManifest = makeManifest({
    revisionId: "revision.a-normal",
    previousRevisionId: "revision.z-leap",
    sourceDigest: digest("7"),
    createdAt: "2017-01-01T00:00:00.000Z",
  });
  snapshot = apply(snapshot, successorCommand("revision.z-leap", normalManifest, [
    feedbackFor(leapDecision),
  ])).nextSnapshot;
  snapshot = apply(snapshot, proposeCommand("revision.a-normal")).nextSnapshot;
  const normalDecision = makeDecision({
    decisionId: "decision.a-normal",
    revisionId: "revision.a-normal",
    targetDigest: normalManifest.bundleDigest,
    verdict: "request-changes",
    decidedAt: "2017-01-01T00:00:00.000Z",
  });
  snapshot = apply(snapshot, decideCommand(normalDecision)).nextSnapshot;

  const shuffled = clone(snapshot);
  shuffled.revisions.reverse();
  shuffled.decisions.reverse();
  const restored = restoreSnapshot(serializeSnapshot(shuffled));
  assert.deepEqual(restored.revisions.map((revision) => revision.revisionId), [
    "revision.z-fraction",
    "revision.a-fraction",
    "revision.z-leap",
    "revision.a-normal",
  ]);
  assert.deepEqual(restored.decisions.map((decision) => decision.decisionId), [
    "decision.z-fraction",
    "decision.a-fraction",
    "decision.z-leap",
    "decision.a-normal",
  ]);
  assert.deepEqual(restored.revisions.slice(1).map((revision) =>
    revision.feedbackRefs[0].decisionId), [
    "decision.z-fraction",
    "decision.a-fraction",
    "decision.z-leap",
  ]);
});

test("[PR-INTENT] generated states, commands, snapshots, approvals, and errors conform to both published inventories", () => {
  const manifest = makeManifest();
  const created = apply(createEmptySnapshot(REQUEST_ID), createCommand(manifest));
  const proposed = apply(created.nextSnapshot, proposeCommand());
  const decision = makeDecision({ targetDigest: manifest.bundleDigest });
  const decided = apply(proposed.nextSnapshot, decideCommand(decision));
  const successorManifest = makeManifest({
    revisionId: "revision.2",
    previousRevisionId: "revision.1",
    sourceDigest: digest("5"),
    createdAt: SUCCESSOR_AT,
  });
  const successor = successorCommand("revision.1", successorManifest);
  const error = expectNoWrite(decided.nextSnapshot, proposeCommand(), "invalid-transition").error;
  const values = {
    "design-revision-state": created.result.revision,
    "approval-validity": deriveApprovalValidity(decided.nextSnapshot, "revision.1"),
    "revision-state-snapshot": decided.nextSnapshot,
    "revision-state-error": error,
  };
  const commands = [createCommand(manifest), proposeCommand(), decideCommand(decision), successor];
  for (const directory of [activeDirectory, releaseDirectory]) {
    const { ajv } = compileInventory(directory);
    for (const [name, value] of Object.entries(values)) {
      const validate = ajv.getSchema(`urn:forma:schema:v1:${name}`);
      assert.equal(validate(value), true, `${name}: ${ajv.errorsText(validate.errors)}`);
    }
    const validateCommand = ajv.getSchema("urn:forma:schema:v1:revision-state-command");
    for (const command of commands)
      assert.equal(validateCommand(command), true, ajv.errorsText(validateCommand.errors));
  }
});
