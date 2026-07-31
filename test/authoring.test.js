import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  createMockAuthoringBackend, validateProvenance
} from "../src/authoring/index.js";

const read = (name) => JSON.parse(fs.readFileSync(new URL(`../contracts/v1/examples/${name}`, import.meta.url)));
const request = read("design-request.example.json");
const snapshot = read("authoring-context-snapshot.example.json");

test("three synchronous operations are deterministic and artifact-scoped", () => {
  const backend = createMockAuthoringBackend();
  for (const operation of ["authorExperience", "authorDesignSystemDelta", "deriveCapabilities"]) {
    const input = { request, snapshot: structuredClone(snapshot), invocationKey: `invocation.${operation}` };
    const first = backend[operation](input);
    const second = backend[operation]({ ...input, snapshot: structuredClone(snapshot) });
    assert.equal(first.ok, true);
    assert.deepEqual(first, second);
  }
});

test("closed failures never expose partial artifacts", () => {
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
  }
});

test("mutation reports only changed addressable entries", () => {
  const inputSnapshot = structuredClone(snapshot);
  const result = createMockAuthoringBackend().authorExperience({
    request, snapshot: inputSnapshot, invocationKey: "invocation.mutation",
    fixture: "invalid-mutation-component"
  });
  assert.deepEqual(result.detail.mutatedRefs, [{ collection: "components", id: "component.alert" }]);
  assert.deepEqual(inputSnapshot, snapshot);
});

test("source mutation is reported by addressable external id", () => {
  const result = createMockAuthoringBackend().authorExperience({
    request, snapshot: structuredClone(snapshot), invocationKey: "invocation.source-mutation",
    fixture: "invalid-mutation-source"
  });
  assert.deepEqual(result.detail.mutatedRefs, [
    { collection: "sourceRefs", id: "control-plane-requirements" }
  ]);
});

test("provenance validation permits non-authored manifest artifacts", () => {
  const artifacts = {
    experience: read("experience-contract.example.json"),
    designSystemDelta: read("design-system-delta.example.json"),
    capabilityRequirements: read("capability-requirements.example.json")
  };
  const manifest = read("design-bundle-manifest.example.json");
  assert.equal(validateProvenance(artifacts, manifest, snapshot), null);
});

test("provenance validation fails closed for malformed artifact values", () => {
  const manifest = read("design-bundle-manifest.example.json");
  assert.match(validateProvenance({ experience: null }, manifest, snapshot), /invocationKey/);
});
