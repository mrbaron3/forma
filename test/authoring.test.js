import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  createMockAuthoringBackend, snapshotDigest, validateProvenance, validateSchema
} from "../src/authoring/index.js";

const read = (name) => JSON.parse(fs.readFileSync(new URL(`../contracts/v1/examples/${name}`, import.meta.url)));
const request = read("design-request.example.json");
const snapshot = read("authoring-context-snapshot.example.json");
const experience = read("experience-contract.example.json");
const failureSchema = "urn:designflow:schema:v1:authoring-port#/$defs/failure";
const fixtureDirectory = new URL("./fixtures/", import.meta.url);

function valueAtPath(value, dottedPath) {
  return dottedPath.split(".").reduce((current, segment) => current?.[segment], value);
}

function authoredProvenance(backend = createMockAuthoringBackend()) {
  const result = backend.authorExperience({
    request,
    snapshot: structuredClone(snapshot),
    invocationKey: "invocation.provenance"
  });
  assert.equal(result.ok, true);
  const artifacts = { experience: result.artifact };
  const record = backend.provenanceFor(result.artifact, snapshot);
  const manifest = {
    authorInvocationRefs: {
      [result.artifact.invocationKey]: record
    },
    artifacts: {
      experience: { digest: record.outputDigest }
    }
  };
  return { artifacts, manifest };
}

test("[PR-INTENT] three synchronous operations are deterministic and artifact-scoped", () => {
  const backend = createMockAuthoringBackend();
  const operations = {
    authorExperience: ["authorExperienceInput", "authorExperienceResult"],
    authorDesignSystemDelta: ["authorDesignSystemDeltaInput", "authorDesignSystemDeltaResult"],
    deriveCapabilities: ["deriveCapabilitiesInput", "deriveCapabilitiesResult"]
  };
  for (const [operation, [inputDefinition, resultDefinition]] of Object.entries(operations)) {
    const input = {
      request,
      snapshot: structuredClone(snapshot),
      invocationKey: `invocation.${operation}`,
      ...(operation === "deriveCapabilities" ? { experience } : {})
    };
    assert.equal(
      validateSchema(`urn:designflow:schema:v1:authoring-port#/$defs/${inputDefinition}`, input),
      null
    );
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

test("[PR-INTENT] every file-backed mock fixture reproduces one declared outcome", () => {
  const names = fs.readdirSync(fixtureDirectory)
    .filter((name) => name.endsWith(".json"))
    .sort();
  assert.ok(names.length > 0);
  for (const name of names) {
    const fixture = JSON.parse(fs.readFileSync(new URL(name, fixtureDirectory), "utf8"));
    assert.equal(fixture.fixture, name.replace(/\.json$/, ""), name);
    const backend = createMockAuthoringBackend({ fixture: fixture.fixture });
    let result;
    if (fixture.operation === "validateProvenance") {
      const { artifacts, manifest } = authoredProvenance(backend);
      const error = validateProvenance(artifacts, manifest, snapshot);
      result = error === null
        ? { ok: true }
        : { ok: false, kind: "provenance-invalid", detail: error };
    } else {
      const input = {
        request,
        snapshot: structuredClone(snapshot),
        invocationKey: `invocation.fixture.${fixture.fixture}`,
        ...(fixture.operation === "deriveCapabilities" ? { experience } : {})
      };
      result = backend[fixture.operation](input);
    }
    assert.equal(result.ok, fixture.ok, name);
    if (!fixture.ok) assert.equal(result.kind, fixture.expectedKind, name);
    assert.ok(fixture.expectedEvidence, `${name}: expectedEvidence is required`);
    assert.deepEqual(
      valueAtPath(result, fixture.expectedEvidence.path),
      fixture.expectedEvidence.value,
      name
    );
  }
});

test("[PR-INTENT] closed failures never expose partial artifacts and match their kind-specific detail", () => {
  const cases = [
    ["invalid-schema-required", "schema-invalid"],
    ["invalid-trace-element-region", "trace-broken"],
    ["invalid-mutation-token", "source-mutation"],
    ["ambiguity-blocking", "ambiguous"],
    ["provider-unavailable", "provider-unavailable"]
  ];
  for (const [fixture, kind] of cases) {
    const result = createMockAuthoringBackend({ fixture }).authorExperience({
      request, snapshot: structuredClone(snapshot), invocationKey: `invocation.${fixture}`
    });
    assert.equal(result.ok, false);
    assert.equal(result.kind, kind);
    assert.equal("artifact" in result, false);
    assert.equal(validateSchema(failureSchema, result), null);
  }
});

test("[PR-INTENT] success results reject blocking artifact ambiguities", () => {
  const backend = createMockAuthoringBackend();
  const cases = [
    [
      "authorExperience",
      "authorExperienceResult",
      { request, snapshot, invocationKey: "invocation.blocking.experience" }
    ],
    [
      "authorDesignSystemDelta",
      "authorDesignSystemDeltaResult",
      { request, snapshot, invocationKey: "invocation.blocking.delta" }
    ],
    [
      "deriveCapabilities",
      "deriveCapabilitiesResult",
      { request, snapshot, invocationKey: "invocation.blocking.capabilities", experience }
    ]
  ];
  for (const [operation, resultDefinition, input] of cases) {
    const result = backend[operation]({
      ...input,
      snapshot: structuredClone(input.snapshot)
    });
    assert.equal(result.ok, true);
    result.artifact.ambiguities = [{
      id: "ambiguity.blocking",
      question: "Required outcome?",
      blocks: true
    }];
    assert.notEqual(validateSchema(
      `urn:designflow:schema:v1:authoring-port#/$defs/${resultDefinition}`,
      result
    ), null);
  }
});

test("[PR-INTENT] failure kinds reject mismatched or incomplete detail payloads", () => {
  const invalid = [
    { ok: false, kind: "schema-invalid", detail: null },
    {
      ok: false,
      kind: "ambiguous",
      detail: {
        schemaVersion: "1.0",
        requestId: request.requestId,
        invocationKey: "invocation.non-blocking",
        targetArtifact: "experience",
        ambiguities: [{
          id: "ambiguity.non-blocking",
          question: "Optional preference?",
          blocks: false
        }]
      }
    },
    { ok: false, kind: "source-mutation", detail: "not a mutation report" },
    { ok: false, kind: "provider-unavailable", detail: { message: "wrong shape" } }
  ];
  for (const failure of invalid) {
    assert.notEqual(validateSchema(failureSchema, failure), null);
  }
});

test("[PR-INTENT] mutation reports only changed addressable entries", () => {
  const inputSnapshot = structuredClone(snapshot);
  const result = createMockAuthoringBackend({ fixture: "invalid-mutation-component" })
    .authorExperience({
    request, snapshot: inputSnapshot, invocationKey: "invocation.mutation",
  });
  assert.deepEqual(result.detail.mutatedRefs, [{ collection: "components", id: "component.alert" }]);
  assert.deepEqual(inputSnapshot, snapshot);
});

test("[PR-INTENT] source mutation is reported by addressable external id", () => {
  const result = createMockAuthoringBackend({ fixture: "invalid-mutation-source" })
    .authorExperience({
    request, snapshot: structuredClone(snapshot), invocationKey: "invocation.source-mutation",
  });
  assert.deepEqual(result.detail.mutatedRefs, [
    { collection: "sourceRefs", id: "control-plane-requirements" }
  ]);
});

test("[PR-INTENT] design-system governance mutation returns a closed structured report", () => {
  const result = createMockAuthoringBackend({ fixture: "invalid-governance-target" })
    .authorDesignSystemDelta({
    request,
    snapshot: structuredClone(snapshot),
    invocationKey: "invocation.governance-mutation"
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

test("[PR-INTENT] deriveCapabilities rejects an input without its contracted experience", () => {
  const result = createMockAuthoringBackend().deriveCapabilities({
    request,
    snapshot: structuredClone(snapshot),
    invocationKey: "invocation.missing-experience"
  });
  assert.equal(result.ok, false);
  assert.equal(result.kind, "schema-invalid");
});

test("[PR-INTENT] deriveCapabilities rejects an Experience from another Design Request", () => {
  const unrelatedExperience = structuredClone(experience);
  unrelatedExperience.requestId = "request.unrelated";
  assert.equal(
    validateSchema("urn:designflow:schema:v1:experience-contract", unrelatedExperience),
    null
  );
  const result = createMockAuthoringBackend().deriveCapabilities({
    request,
    snapshot: structuredClone(snapshot),
    invocationKey: "invocation.unrelated-experience",
    experience: unrelatedExperience
  });
  assert.deepEqual(result, {
    ok: false,
    kind: "trace-broken",
    detail: "experience requestId does not match the Design Request"
  });
  assert.equal(validateSchema(failureSchema, result), null);
});

test("[PR-INTENT] every operation rejects a malformed Design Request without an artifact", () => {
  const malformedRequest = structuredClone(request);
  delete malformedRequest.requestId;
  const cases = [
    ["authorExperience", {}],
    ["authorDesignSystemDelta", {}],
    ["deriveCapabilities", { experience }]
  ];
  for (const [operation, dependency] of cases) {
    const result = createMockAuthoringBackend()[operation]({
      request: malformedRequest,
      snapshot: structuredClone(snapshot),
      invocationKey: `invocation.invalid-request.${operation}`,
      ...dependency
    });
    assert.equal(result.ok, false);
    assert.equal(result.kind, "schema-invalid");
    assert.equal("artifact" in result, false);
    assert.equal(validateSchema(failureSchema, result), null);
  }
});

test("[PR-INTENT] snapshot entry identities are unique in every addressable collection", () => {
  const collections = ["tokenDocuments", "components", "patterns", "sourceRefs"];
  for (const collection of collections) {
    const duplicated = structuredClone(snapshot);
    if (collection === "sourceRefs") {
      const duplicate = structuredClone(duplicated.sourceRefs[0]);
      duplicate.digest = `sha256:${"f".repeat(64)}`;
      duplicated.sourceRefs.push(duplicate);
    } else {
      const duplicate = structuredClone(duplicated.designSystem[collection][0]);
      duplicate.digest = `sha256:${"f".repeat(64)}`;
      duplicated.designSystem[collection].push(duplicate);
    }
    duplicated.snapshotDigest = snapshotDigest(duplicated);
    const result = createMockAuthoringBackend().authorExperience({
      request,
      snapshot: duplicated,
      invocationKey: `invocation.duplicate.${collection}`
    });
    assert.equal(result.ok, false, collection);
    assert.equal(result.kind, "schema-invalid", collection);
    assert.match(result.detail, new RegExp(`${collection} has duplicate id`), collection);
  }
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

test("[PR-INTENT] provenance recomputes input and output digests instead of trusting records", () => {
  const valid = authoredProvenance();
  assert.equal(validateProvenance(valid.artifacts, valid.manifest, snapshot), null);
  const invocationKey = valid.artifacts.experience.invocationKey;

  const inputMismatch = structuredClone(valid.manifest);
  inputMismatch.authorInvocationRefs[invocationKey].inputContextDigest =
    `sha256:${"e".repeat(64)}`;
  assert.match(
    validateProvenance(valid.artifacts, inputMismatch, snapshot),
    /provenance digest mismatch/
  );

  const outputMismatch = structuredClone(valid.manifest);
  outputMismatch.authorInvocationRefs[invocationKey].outputDigest =
    `sha256:${"f".repeat(64)}`;
  outputMismatch.artifacts.experience.digest =
    outputMismatch.authorInvocationRefs[invocationKey].outputDigest;
  assert.match(
    validateProvenance(valid.artifacts, outputMismatch, snapshot),
    /provenance digest mismatch/
  );
});

test("[PR-INTENT] manifest schema requires a non-empty invocation-keyed provenance map", () => {
  const schemaId = "urn:designflow:schema:v1:design-bundle-manifest";
  const manifest = read("design-bundle-manifest.example.json");
  assert.equal(validateSchema(schemaId, manifest), null);
  const [invocationKey, record] = Object.entries(manifest.authorInvocationRefs)[0];
  const invalid = [
    [],
    {},
    [record],
    { "invalid key": record },
    { [invocationKey]: { ...record, invocationKey } }
  ];
  for (const authorInvocationRefs of invalid) {
    assert.notEqual(
      validateSchema(schemaId, { ...manifest, authorInvocationRefs }),
      null
    );
  }
});

test("[PR-INTENT] provenance requires an exact record-to-artifact set", () => {
  const valid = authoredProvenance();
  const missingRecord = structuredClone(valid.manifest);
  missingRecord.authorInvocationRefs = {};

  const extraRecord = structuredClone(valid.manifest);
  extraRecord.authorInvocationRefs["invocation.extra"] =
    structuredClone(Object.values(extraRecord.authorInvocationRefs)[0]);

  const duplicateArtifacts = structuredClone(valid.artifacts);
  duplicateArtifacts.experienceCopy = structuredClone(duplicateArtifacts.experience);
  const duplicateArtifactManifest = structuredClone(valid.manifest);
  duplicateArtifactManifest.artifacts.experienceCopy =
    structuredClone(duplicateArtifactManifest.artifacts.experience);

  const cases = [
    [valid.artifacts, missingRecord],
    [valid.artifacts, extraRecord],
    [duplicateArtifacts, duplicateArtifactManifest]
  ];
  for (const [artifacts, manifest] of cases) {
    assert.notEqual(validateProvenance(artifacts, manifest, snapshot), null);
  }
});

test("[PR-INTENT] bundle paths are normalized portable relatives", () => {
  const schemaId = "urn:designflow:schema:v1:common#/$defs/artifactRef";
  const artifactRef = {
    path: "artifacts/example.json",
    digest: `sha256:${"a".repeat(64)}`,
    mediaType: "application/json",
    schemaRef: "urn:designflow:schema:v1:experience-contract"
  };
  for (const path of [
    "artifact.json",
    "dir/file.json",
    "dir.name/file-name_1.json"
  ]) {
    assert.equal(validateSchema(schemaId, { ...artifactRef, path }), null, path);
    const delta = read("design-system-delta.example.json");
    delta.tokenDocuments[0].path = path;
    assert.equal(
      validateSchema("urn:designflow:schema:v1:design-system-delta", delta),
      null,
      path
    );
  }

  const invalidPaths = [
    "..",
    "dir/..",
    "../secret",
    "..\\secret",
    "dir\\..\\secret",
    "C:\\secret",
    "C:/secret",
    "\\\\server\\share",
    "/etc/passwd",
    "./artifact.json",
    "dir/./artifact.json",
    "dir//artifact.json",
    "dir/",
    "dir:name/artifact.json",
    "dir/artifact:name.json"
  ];
  for (const path of invalidPaths) {
    assert.notEqual(validateSchema(schemaId, { ...artifactRef, path }), null, path);
    const delta = read("design-system-delta.example.json");
    delta.tokenDocuments[0].path = path;
    assert.notEqual(
      validateSchema("urn:designflow:schema:v1:design-system-delta", delta),
      null,
      path
    );
  }
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
  for (const record of Object.values(manifest.authorInvocationRefs)) {
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
