import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { digest, snapshotDigest } from "./canonical-json.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const contractDirectory = path.join(root, "contracts/v1");
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
for (const name of fs.readdirSync(contractDirectory).filter((name) => name.endsWith(".schema.json"))) {
  ajv.addSchema(JSON.parse(fs.readFileSync(path.join(contractDirectory, name), "utf8")));
}

export const artifactSchemas = Object.freeze({
  experience: "urn:forma:schema:v1:experience-contract",
  designSystemDelta: "urn:forma:schema:v1:design-system-delta",
  capabilityRequirements: "urn:forma:schema:v1:capability-requirements"
});

export function validateSchema(schemaId, value) {
  const validate = ajv.getSchema(schemaId);
  if (!validate) return `unknown schema "${schemaId}"`;
  return validate(value) ? null : ajv.errorsText(validate.errors, { separator: "\n" });
}

export function validateSnapshotEntryIds(snapshot) {
  const collections = [
    ["tokenDocuments", snapshot?.designSystem?.tokenDocuments, (entry) => entry?.id],
    ["components", snapshot?.designSystem?.components, (entry) => entry?.id],
    ["patterns", snapshot?.designSystem?.patterns, (entry) => entry?.id],
    ["sourceRefs", snapshot?.sourceRefs, (entry) => entry?.ref?.externalId]
  ];
  for (const [collection, entries, identity] of collections) {
    if (!Array.isArray(entries)) return `${collection} must be an array`;
    const seen = new Set();
    for (const entry of entries) {
      const id = identity(entry);
      if (typeof id !== "string" || id.length === 0) {
        return `${collection} entry has no addressable id`;
      }
      if (seen.has(id)) return `${collection} has duplicate id "${id}"`;
      seen.add(id);
    }
  }
  return null;
}

export function validateSnapshot(request, snapshot) {
  const requestError = validateSchema("urn:forma:schema:v1:design-request", request);
  if (requestError) return { ok: false, kind: "schema-invalid", detail: requestError };
  const schemaError = validateSchema("urn:forma:schema:v1:authoring-context-snapshot", snapshot);
  if (schemaError) return { ok: false, kind: "schema-invalid", detail: schemaError };
  const identityError = validateSnapshotEntryIds(snapshot);
  if (identityError) return { ok: false, kind: "schema-invalid", detail: identityError };
  const actual = snapshotDigest(snapshot);
  if (actual !== snapshot.snapshotDigest) {
    return mutationFailure(snapshot.snapshotDigest, actual, [], "snapshot-structure");
  }
  const allowed = [...(request.contextRefs ?? [])];
  if (request.existingDesignSystemRef) allowed.push(request.existingDesignSystemRef);
  const key = (ref) => JSON.stringify(ref);
  const allowedKeys = new Set(allowed.map(key));
  const represented = [
    ...snapshot.sourceRefs.map(({ ref }) => ref),
    ...(snapshot.designSystem.ref ? [snapshot.designSystem.ref] : [])
  ];
  if (represented.some((ref) => !allowedKeys.has(key(ref)))) {
    return { ok: false, kind: "provenance-invalid", detail: "snapshot contains a ref not selected by the Design Request" };
  }
  return null;
}

export function mutationFailure(expectedDigest, actualDigest, mutatedRefs, scope = "entries") {
  return { ok: false, kind: "source-mutation", detail: { expectedDigest, actualDigest, mutatedRefs, scope } };
}

export function compareSnapshots(before, after) {
  const expectedDigest = snapshotDigest(before);
  const actualDigest = snapshotDigest(after);
  if (expectedDigest === actualDigest) return null;
  const changed = [];
  const groups = ["tokenDocuments", "components", "patterns"];
  for (const group of groups) {
    const left = new Map(before.designSystem[group].map((entry) => [entry.id, digest(entry)]));
    const right = new Map(after.designSystem[group].map((entry) => [entry.id, digest(entry)]));
    for (const id of new Set([...left.keys(), ...right.keys()])) {
      if (left.get(id) !== right.get(id)) changed.push({ collection: group, id });
    }
  }
  const refKey = ({ ref }) => JSON.stringify(ref);
  const leftRefs = new Map(before.sourceRefs.map((entry) => [refKey(entry), digest(entry)]));
  const rightRefs = new Map(after.sourceRefs.map((entry) => [refKey(entry), digest(entry)]));
  for (const key of new Set([...leftRefs.keys(), ...rightRefs.keys()])) {
    if (leftRefs.get(key) !== rightRefs.get(key)) {
      const entry = before.sourceRefs.find((item) => refKey(item) === key) ??
        after.sourceRefs.find((item) => refKey(item) === key);
      changed.push({ collection: "sourceRefs", id: entry.ref.externalId });
    }
  }
  return mutationFailure(expectedDigest, actualDigest, changed, changed.length ? "entries" : "snapshot-structure");
}

export function validateTrace(target, artifact, request, related = {}) {
  const requirementIds = new Set(request.requirements.map((item) => item.id));
  const refsExist = (values, set) => (values ?? []).every((value) => set.has(value));
  if (target === "experience") {
    const purposeIds = new Set(artifact.pagePurposes.map((x) => x.id));
    const taskIds = new Set(artifact.tasks.map((x) => x.id));
    const regionIds = new Set(artifact.regions.map((x) => x.id));
    const elementIds = new Set(artifact.elements.map((x) => x.id));
    if (artifact.pagePurposes.some((x) =>
      !refsExist(x.sourceRequirementIds, requirementIds))) {
      return "page purpose requirement trace is broken";
    }
    if (artifact.tasks.some((x) => !purposeIds.has(x.pagePurposeId) ||
      !refsExist(x.sourceRequirementIds, requirementIds))) {
      return "task purpose or requirement trace is broken";
    }
    if (artifact.flows.some((x) => !taskIds.has(x.taskId))) return "flow task trace is broken";
    if (artifact.effortBudgets.some((x) => !taskIds.has(x.taskId))) {
      return "effort budget task trace is broken";
    }
    if (artifact.regions.some((x) => !purposeIds.has(x.pagePurposeId) ||
      !refsExist(x.supportsTaskIds, taskIds))) return "region purpose or task trace is broken";
    if (artifact.elements.some((x) => !regionIds.has(x.regionId))) {
      return "element region trace is broken";
    }
    if (artifact.elements.some((x) => !x.supportsTaskIds?.length ||
      !refsExist(x.supportsTaskIds, taskIds))) return "element task trace is broken";
    if (artifact.elements.some((x) =>
      !refsExist(x.supportsPurposeIds, purposeIds) ||
      !refsExist(x.sourceRequirementIds, requirementIds))) {
      return "element purpose or requirement trace is broken";
    }
    if (artifact.attentionHierarchies.some((x) => !purposeIds.has(x.pagePurposeId) ||
      x.levels.some((level) => !refsExist(level.regionIds, regionIds) ||
        !refsExist(level.elementIds, elementIds)))) return "attention hierarchy trace is broken";
  }
  if (target === "capabilityRequirements") {
    const stepIds = new Set((related.experience?.flows ?? []).flatMap((flow) => flow.steps.map((step) => step.id)));
    if (artifact.capabilities.some((x) => !refsExist(x.sourceRequirementIds, requirementIds) ||
      (stepIds.size && !refsExist(x.sourceInteractionIds, stepIds)))) return "capability trace is broken";
  }
  return null;
}

export function validateProvenance(artifacts, manifest, snapshot) {
  const snapshotSchemaError = validateSchema(
    "urn:forma:schema:v1:authoring-context-snapshot",
    snapshot
  );
  if (snapshotSchemaError) {
    return `authoring context snapshot is invalid: ${snapshotSchemaError}`;
  }
  const actualSnapshotDigest = snapshotDigest(snapshot);
  if (actualSnapshotDigest !== snapshot.snapshotDigest) {
    return "authoring context snapshot digest mismatch";
  }
  const records = manifest?.authorInvocationRefs;
  if (!records || typeof records !== "object" || Array.isArray(records) ||
    Object.keys(records).length === 0) return "manifest has no authorInvocationRefs";
  if (!artifacts || typeof artifacts !== "object" || Array.isArray(artifacts)) {
    return "artifacts must be an object";
  }
  const keys = Object.keys(records);
  const artifactEntries = Object.entries(artifacts);
  if (artifactEntries.some(([, artifact]) =>
    !artifact || typeof artifact !== "object" || Array.isArray(artifact) ||
    typeof artifact.invocationKey !== "string")) {
    return "artifact has no invocationKey";
  }
  const artifactKeys = artifactEntries.map(([, artifact]) => artifact.invocationKey);
  if (new Set(artifactKeys).size !== artifactKeys.length) return "artifact invocationKey is not unique";
  if (keys.length !== artifactKeys.length ||
    keys.some((key) => !artifactKeys.includes(key)) ||
    artifactKeys.some((key) => !keys.includes(key))) return "authorInvocationRefs do not exactly match artifacts";
  if (!manifest.artifacts || typeof manifest.artifacts !== "object" ||
    artifactEntries.some(([name]) => !manifest.artifacts[name])) {
    return "manifest has no entry for an authored artifact";
  }
  for (const record of Object.values(records)) {
    if (validateSchema("urn:forma:schema:v1:author-invocation", record)) return "author invocation record is invalid";
    if (record.orchestrator === record.provider) return "orchestrator must be omitted when it is the provider";
  }
  for (const [name, artifact] of artifactEntries) {
    const record = records[artifact.invocationKey];
    if (!record) return `provenance mismatch for ${name}`;
    if (record.inputContextDigest !== actualSnapshotDigest ||
      record.outputDigest !== digest(artifact)) return `provenance digest mismatch for ${name}`;
    if (manifest.artifacts?.[name]?.digest !== record.outputDigest) return `manifest artifact digest mismatch for ${name}`;
  }
  return null;
}
