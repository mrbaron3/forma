import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { digest, snapshotDigest } from "./canonical-json.js";
import {
  artifactSchemas, compareSnapshots, validateSchema, validateSnapshot, validateTrace
} from "./validation.js";

export const AUTHORING_FAILURE_KINDS = Object.freeze([
  "schema-invalid", "trace-broken", "provenance-invalid", "source-mutation",
  "ambiguous", "provider-unavailable"
]);

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const examples = path.join(root, "contracts/v1/examples");
const read = (name) => JSON.parse(fs.readFileSync(path.join(examples, name), "utf8"));
const templates = {
  experience: () => read("experience-contract.example.json"),
  designSystemDelta: () => read("design-system-delta.example.json"),
  capabilityRequirements: () => read("capability-requirements.example.json")
};
const inputSchemas = Object.freeze({
  experience: "urn:designflow:schema:v1:authoring-port#/$defs/authorExperienceInput",
  designSystemDelta:
    "urn:designflow:schema:v1:authoring-port#/$defs/authorDesignSystemDeltaInput",
  capabilityRequirements:
    "urn:designflow:schema:v1:authoring-port#/$defs/deriveCapabilitiesInput"
});
function failure(kind, detail) {
  if (!AUTHORING_FAILURE_KINDS.includes(kind)) throw new TypeError(`Unknown authoring failure kind: ${kind}`);
  return { ok: false, kind, detail };
}

function governanceMutation(decision, reason) {
  return failure("source-mutation", {
    policy: "design-system-governance",
    action: decision.action,
    targetId: decision.targetId,
    reason
  });
}

function ambiguity(request, invocationKey, target) {
  return {
    schemaVersion: "1.0", requestId: request.requestId, invocationKey, targetArtifact: target,
    ambiguities: [{ id: "ambiguity.required-outcome", question: "成功状態として必須の結果は何ですか？", blocks: true }]
  };
}

function governDelta(artifact, snapshot) {
  const base = new Map(snapshot.designSystem.tokenDocuments.flatMap((doc) => {
    const tokens = doc.value?.tokens ?? doc.value ?? {};
    return Object.entries(tokens).map(([tokenPath, value]) => [tokenPath, value]);
  }));
  for (const decision of artifact.decisions) {
    if (!decision.action) return failure("trace-broken", "every design-system change requires a governance action");
    if ((decision.action === "extend" || decision.action === "create") &&
      !decision.targetId.startsWith("feature.")) {
      return governanceMutation(decision, "feature-namespace-required");
    }
    if (decision.action !== "reuse" && base.has(decision.targetId)) {
      return governanceMutation(decision, "shared-token-redefinition");
    }
    if (decision.action !== "reuse" && [...base.values()].some((value) =>
      JSON.stringify(value) === JSON.stringify(decision.value))) {
      return governanceMutation(decision, "base-token-value-duplication");
    }
  }
  return null;
}

function applyFixture(target, artifact, fixture, request, snapshot) {
  switch (fixture) {
    case "valid": return null;
    case "provider-unavailable": return failure("provider-unavailable", "mock provider is unavailable");
    case "ambiguity-blocking": return failure("ambiguous", ambiguity(request, artifact.invocationKey, target));
    case "ambiguity-non-blocking":
      artifact.ambiguities = [{
        id: "ambiguity.success-threshold",
        question: "成功指標の閾値は何ですか？",
        blocks: false
      }];
      return null;
    case "invalid-schema-required":
      delete artifact.schemaVersion;
      return null;
    case "invalid-schema-type":
      artifact.requestId = 1;
      return null;
    case "invalid-trace-element-region":
      if (target === "experience") artifact.elements[0].regionId = "missing-region";
      return null;
    case "invalid-trace-element-task":
      if (target === "experience") artifact.elements[0].supportsTaskIds = ["missing-task"];
      return null;
    case "invalid-trace-capability":
      if (target === "capabilityRequirements") artifact.capabilities[0].sourceInteractionIds = ["missing-step"];
      return null;
    case "invalid-governance-target":
      if (target === "designSystemDelta") {
        artifact.decisions.find((decision) => decision.action === "extend").targetId =
          "component.repository-status-card";
      }
      return null;
    case "invalid-provenance-output":
      return null;
    case "invalid-mutation-token":
      snapshot.designSystem.tokenDocuments[0].digest = `sha256:${"f".repeat(64)}`;
      return null;
    case "invalid-mutation-component":
      snapshot.designSystem.components[0].digest = `sha256:${"f".repeat(64)}`;
      return null;
    case "invalid-mutation-pattern":
      snapshot.designSystem.patterns[0].digest = `sha256:${"f".repeat(64)}`;
      return null;
    case "invalid-mutation-source":
      snapshot.sourceRefs[0].digest = `sha256:${"f".repeat(64)}`;
      return null;
    default:
      return failure("schema-invalid", `unknown mock fixture "${fixture}"`);
  }
}

/**
 * Deterministic synchronous AuthoringBackend port.
 * Each operation accepts only its closed JSON contract. No repository,
 * database handle, mock fixture control, or undeclared artifact is accepted.
 */
export function createMockAuthoringBackend({ fixture = "valid" } = {}) {
  function author(target, input) {
    try {
      const inputError = validateSchema(inputSchemas[target], input);
      if (inputError) return failure("schema-invalid", inputError);
      const before = structuredClone(input.snapshot);
      const snapshotError = validateSnapshot(input.request, before);
      if (snapshotError) return snapshotError;
      // Fixtures model a source observed after invocation. Keep the caller-owned
      // snapshot immutable just as a real read-only port input must remain.
      const after = structuredClone(input.snapshot);
      const artifact = templates[target]();
      artifact.requestId = input.request.requestId;
      artifact.invocationKey = input.invocationKey;
      artifact.ambiguities = [];
      if (target === "designSystemDelta") {
        for (const decision of artifact.decisions) {
          if (decision.action !== "reuse") decision.targetId = `feature.${decision.targetId}`;
        }
      }
      const immediate = applyFixture(target, artifact, fixture, input.request, after);
      if (immediate) return immediate;
      const mutation = compareSnapshots(before, after);
      if (mutation) return mutation;
      const schemaError = validateSchema(artifactSchemas[target], artifact);
      if (schemaError) return failure("schema-invalid", schemaError);
      const related = target === "capabilityRequirements"
        ? { experience: input.experience }
        : {};
      const traceError = validateTrace(target, artifact, input.request, related);
      if (traceError) return failure("trace-broken", traceError);
      if (target === "designSystemDelta") {
        const governanceError = governDelta(artifact, before);
        if (governanceError) return governanceError;
      }
      return { ok: true, artifact: structuredClone(artifact) };
    } catch (error) {
      return failure("schema-invalid", error instanceof Error ? error.message : "invalid authoring input");
    }
  }
  return Object.freeze({
    authorExperience: (input) => author("experience", input),
    authorDesignSystemDelta: (input) => author("designSystemDelta", input),
    deriveCapabilities: (input) => author("capabilityRequirements", input),
    provenanceFor(artifact, snapshot, overrides = {}) {
      return {
        invocationKey: artifact.invocationKey,
        provider: "designflow-mock", toolOrModel: "deterministic-fixture",
        profileRevision: "contract-v1.0.0-rc.2",
        inputContextDigest: snapshotDigest(snapshot),
        instructionDigest: digest({ fixture }),
        outputDigest: fixture === "invalid-provenance-output"
          ? `sha256:${"f".repeat(64)}`
          : digest(artifact),
        ...overrides
      };
    }
  });
}
