import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  createMockAuthoringBackend, validateProvenance, validateSchema
} from "../src/authoring/index.js";

const read = (name) => JSON.parse(fs.readFileSync(new URL(`../contracts/v1/examples/${name}`, import.meta.url)));
const request = read("design-request.example.json");
const snapshot = read("authoring-context-snapshot.example.json");
const failureSchema = "urn:designflow:schema:v1:authoring-port#/$defs/failure";

test("[PR-INTENT] three synchronous operations are deterministic and artifact-scoped", () => {
  const backend = createMockAuthoringBackend();
  const operations = {
    authorExperience: "authorExperienceResult",
    authorDesignSystemDelta: "authorDesignSystemDeltaResult",
    deriveCapabilities: "deriveCapabilitiesResult"
  };
  for (const [operation, resultDefinition] of Object.entries(operations)) {
    const input = { request, snapshot: structuredClone(snapshot), invocationKey: `invocation.${operation}` };
    const first = backend[operation](input);
    const second = backend[operation]({ ...input, snapshot: structuredClone(snapshot) });
    assert.equal(first.ok, true);
    assert.deepEqual(first, second);
    assert.equal(
      validateSchema(`urn:designflow:schema:v1:authoring-port#/$defs/${resultDefinition}`, first),
      null
    );
  }
});

test("[PR-INTENT] closed failures never expose partial artifacts and match their kind-specific detail", () => {
  const backend = createMockAuthoringBackend();
  const cases = [
    ["invalid-schema-required", "schema-invalid"],
    ["invalid-trace-element-region", "trace-broken"],
    ["invalid-provenance-output", "provenance-invalid"],
    ["invalid-mutation-token", "source-mutation"],
    ["ambiguity-blocking", "ambiguous"],
    ["provider-unavailable", "provider-unavailable"]
  ];
  for (const [fixture, kind] of cases) {
    const result = backend.authorExperience({
      request, snapshot: structuredClone(snapshot), invocationKey: `invocation.${fixture}`, fixture
    });
    assert.equal(result.ok, false);
    assert.equal(result.kind, kind);
    assert.equal("artifact" in result, false);
    assert.equal(validateSchema(failureSchema, result), null);
  }
});

test("[PR-INTENT] failure kinds reject mismatched or incomplete detail payloads", () => {
  const invalid = [
    { ok: false, kind: "schema-invalid", detail: null },
    { ok: false, kind: "ambiguous", detail: "not an ambiguity report" },
    { ok: false, kind: "source-mutation", detail: "not a mutation report" },
    { ok: false, kind: "provider-unavailable", detail: { message: "wrong shape" } }
  ];
  for (const failure of invalid) {
    assert.notEqual(validateSchema(failureSchema, failure), null);
  }
});

test("[PR-INTENT] mutation reports only changed addressable entries", () => {
  const inputSnapshot = structuredClone(snapshot);
  const result = createMockAuthoringBackend().authorExperience({
    request, snapshot: inputSnapshot, invocationKey: "invocation.mutation",
    fixture: "invalid-mutation-component"
  });
  assert.deepEqual(result.detail.mutatedRefs, [{ collection: "components", id: "component.alert" }]);
  assert.deepEqual(inputSnapshot, snapshot);
});

test("[PR-INTENT] source mutation is reported by addressable external id", () => {
  const result = createMockAuthoringBackend().authorExperience({
    request, snapshot: structuredClone(snapshot), invocationKey: "invocation.source-mutation",
    fixture: "invalid-mutation-source"
  });
  assert.deepEqual(result.detail.mutatedRefs, [
    { collection: "sourceRefs", id: "control-plane-requirements" }
  ]);
});

test("[PR-INTENT] design-system governance mutation returns a closed structured report", () => {
  const result = createMockAuthoringBackend().authorDesignSystemDelta({
    request,
    snapshot: structuredClone(snapshot),
    invocationKey: "invocation.governance-mutation",
    fixture: "invalid-governance-target"
  });
  assert.deepEqual(result, {
    ok: false,
    kind: "source-mutation",
    detail: {
      policy: "design-system-governance",
      action: "extend",
      targetId: "component.repository-status-card",
      reason: "feature-namespace-required"
    }
  });
  assert.equal(validateSchema(failureSchema, result), null);
});

test("[PR-INTENT] provenance validation permits non-authored manifest artifacts", () => {
  const artifacts = {
    experience: read("experience-contract.example.json"),
    designSystemDelta: read("design-system-delta.example.json"),
    capabilityRequirements: read("capability-requirements.example.json")
  };
  const manifest = read("design-bundle-manifest.example.json");
  assert.equal(validateProvenance(artifacts, manifest, snapshot), null);
});

test("[PR-INTENT] provenance validation fails closed for malformed artifact values", () => {
  const manifest = read("design-bundle-manifest.example.json");
  assert.match(validateProvenance({ experience: null }, manifest, snapshot), /invocationKey/);
});

test("[PR-INTENT] provenance rejects a tampered snapshot with matching forged digest fields", () => {
  const artifacts = {
    experience: read("experience-contract.example.json"),
    designSystemDelta: read("design-system-delta.example.json"),
    capabilityRequirements: read("capability-requirements.example.json")
  };
  const manifest = structuredClone(read("design-bundle-manifest.example.json"));
  const tampered = structuredClone(snapshot);
  tampered.sourceRefs[0].digest = `sha256:${"f".repeat(64)}`;
  tampered.snapshotDigest = `sha256:${"e".repeat(64)}`;
  for (const record of manifest.authorInvocationRefs) {
    record.inputContextDigest = tampered.snapshotDigest;
  }
  const generatedRecord = createMockAuthoringBackend()
    .provenanceFor(artifacts.experience, tampered);

  assert.match(
    validateProvenance(artifacts, manifest, tampered),
    /snapshot digest mismatch/
  );
  assert.notEqual(generatedRecord.inputContextDigest, tampered.snapshotDigest);
});
