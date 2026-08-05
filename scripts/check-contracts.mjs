import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDir, "..");
const contractDirectory = path.join(repositoryRoot, "contracts", "v1");
const exampleDirectory = path.join(contractDirectory, "examples");
const rc3Directory = path.join(repositoryRoot, "contracts", "contract-v1.0.0-rc.3");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function fail(message) {
  throw new Error(message);
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
}

function assertUnique(items, key, label) {
  const seen = new Set();
  for (const item of items) {
    const value = item[key];
    assert(!seen.has(value), `${label}: duplicate ${key} "${value}"`);
    seen.add(value);
  }
}

function assertRefs(values, allowed, label) {
  for (const value of values ?? []) {
    assert(allowed.has(value), `${label}: unknown reference "${value}"`);
  }
}

function canonicalJson(value) {
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "string"
  ) {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    assert(Number.isFinite(value), "canonical JSON: number must be finite");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (typeof value === "object") {
    return `{${Object.keys(value)
      .sort((left, right) => (left < right ? -1 : left > right ? 1 : 0))
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  }
  fail(`canonical JSON: unsupported value type "${typeof value}"`);
}

function sha256(bytes) {
  return `sha256:${crypto.createHash("sha256").update(bytes).digest("hex")}`;
}

function digestArtifact(filePath, mediaType) {
  const bytes = fs.readFileSync(filePath);
  if (mediaType === "application/json" || mediaType.endsWith("+json")) {
    return sha256(canonicalJson(JSON.parse(bytes.toString("utf8"))));
  }
  return sha256(bytes);
}

const schemaFiles = fs
  .readdirSync(contractDirectory)
  .filter((name) => name.endsWith(".schema.json"))
  .sort();

const schemas = schemaFiles.map((name) =>
  readJson(path.join(contractDirectory, name)),
);

const ajv = new Ajv2020({
  allErrors: true,
  strict: true,
});
addFormats(ajv);

for (const schema of schemas) {
  ajv.addSchema(schema);
}
for (const schema of schemas) {
  assert(
    ajv.getSchema(schema.$id),
    `${schema.$id}: active v1 strict compile failed`,
  );
}

const rc3Ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(rc3Ajv);
const rc3Schemas = fs.readdirSync(rc3Directory)
  .filter((name) => name.endsWith(".schema.json")).sort()
  .map((name) => readJson(path.join(rc3Directory, name)));
for (const schema of rc3Schemas) {
  assert(schema.$id.startsWith("urn:forma:schema:v1:"), `rc.3: invalid schema ID ${schema.$id}`);
  assert(!JSON.stringify(schema).includes("urn:designflow:schema"), `${schema.$id}: legacy reference`);
  rc3Ajv.addSchema(schema);
}
for (const schema of rc3Schemas) {
  assert(rc3Ajv.getSchema(schema.$id), `${schema.$id}: strict compile failed`);
}

const examples = {
  "design-request.example.json":
    "urn:forma:schema:v1:design-request",
  "experience-contract.example.json":
    "urn:forma:schema:v1:experience-contract",
  "design-system-delta.example.json":
    "urn:forma:schema:v1:design-system-delta",
  "capability-requirements.example.json":
    "urn:forma:schema:v1:capability-requirements",
  "design-bundle-manifest.example.json":
    "urn:forma:schema:v1:design-bundle-manifest",
  "human-design-decision.example.json":
    "urn:forma:schema:v1:human-design-decision",
  "authoring-context-snapshot.example.json":
    "urn:forma:schema:v1:authoring-context-snapshot",
  "authoring-ambiguity-report.example.json":
    "urn:forma:schema:v1:authoring-ambiguity-report",
};

const documents = {};
for (const [fileName, schemaId] of Object.entries(examples)) {
  const filePath = path.join(exampleDirectory, fileName);
  const document = readJson(filePath);
  const validate = ajv.getSchema(schemaId);
  assert(validate, `${fileName}: validator "${schemaId}" was not registered`);
  if (!validate(document)) {
    fail(
      `${fileName}: schema validation failed\n${ajv.errorsText(
        validate.errors,
        { separator: "\n" },
      )}`,
    );
  }
  documents[fileName] = document;
}

const designRequest = documents["design-request.example.json"];
const experienceContract = documents["experience-contract.example.json"];
const designSystemDelta = documents["design-system-delta.example.json"];
const capabilityRequirements =
  documents["capability-requirements.example.json"];
const bundleManifest = documents["design-bundle-manifest.example.json"];
const humanDecision = documents["human-design-decision.example.json"];
const authoringSnapshot =
  documents["authoring-context-snapshot.example.json"];

const requirementIds = new Set(
  designRequest.requirements.map((item) => item.id),
);
const pagePurposeIds = new Set(
  experienceContract.pagePurposes.map((item) => item.id),
);
const taskIds = new Set(experienceContract.tasks.map((item) => item.id));
const regionIds = new Set(experienceContract.regions.map((item) => item.id));
const elementIds = new Set(experienceContract.elements.map((item) => item.id));
const capabilityIds = new Set(
  capabilityRequirements.capabilities.map((item) => item.id),
);

assertUnique(designRequest.requirements, "id", "design request requirements");
assertUnique(
  experienceContract.pagePurposes,
  "id",
  "experience contract page purposes",
);
assertUnique(experienceContract.tasks, "id", "experience contract tasks");
assertUnique(experienceContract.flows, "id", "experience contract flows");
assertUnique(
  experienceContract.effortBudgets,
  "id",
  "experience contract effort budgets",
);
assertUnique(experienceContract.regions, "id", "experience contract regions");
assertUnique(
  experienceContract.elements,
  "id",
  "experience contract elements",
);
assertUnique(
  capabilityRequirements.capabilities,
  "id",
  "capability requirements",
);
assertUnique(
  designSystemDelta.decisions,
  "id",
  "design system decisions",
);
assertUnique(
  designSystemDelta.componentDeltas,
  "id",
  "design system component deltas",
);
assertUnique(
  designSystemDelta.patternDeltas,
  "id",
  "design system pattern deltas",
);

for (const purpose of experienceContract.pagePurposes) {
  assertRefs(
    purpose.sourceRequirementIds,
    requirementIds,
    `page purpose ${purpose.id}`,
  );
}

for (const task of experienceContract.tasks) {
  assertRefs([task.pagePurposeId], pagePurposeIds, `task ${task.id}`);
  assertRefs(task.sourceRequirementIds, requirementIds, `task ${task.id}`);
}

const tasksWithFlows = new Set();
const stepIds = new Set();
for (const flow of experienceContract.flows) {
  assertRefs([flow.taskId], taskIds, `flow ${flow.id}`);
  tasksWithFlows.add(flow.taskId);
  for (const step of flow.steps) {
    assert(!stepIds.has(step.id), `flow steps: duplicate id "${step.id}"`);
    stepIds.add(step.id);
    assertRefs(
      step.capabilityRequirementIds,
      capabilityIds,
      `flow step ${step.id}`,
    );
  }
}

const tasksWithEffortBudgets = new Set();
for (const budget of experienceContract.effortBudgets) {
  assertRefs([budget.taskId], taskIds, `effort budget ${budget.id}`);
  tasksWithEffortBudgets.add(budget.taskId);
}

for (const taskId of taskIds) {
  assert(tasksWithFlows.has(taskId), `task ${taskId}: no flow is defined`);
  assert(
    tasksWithEffortBudgets.has(taskId),
    `task ${taskId}: no effort budget is defined`,
  );
}

for (const region of experienceContract.regions) {
  assertRefs([region.pagePurposeId], pagePurposeIds, `region ${region.id}`);
  assertRefs(region.supportsTaskIds, taskIds, `region ${region.id}`);
}

for (const element of experienceContract.elements) {
  assertRefs([element.regionId], regionIds, `element ${element.id}`);
  assertRefs(
    element.supportsPurposeIds,
    pagePurposeIds,
    `element ${element.id}`,
  );
  assertRefs(element.supportsTaskIds, taskIds, `element ${element.id}`);
  assertRefs(
    element.sourceRequirementIds,
    requirementIds,
    `element ${element.id}`,
  );
}

for (const hierarchy of experienceContract.attentionHierarchies) {
  assertRefs(
    [hierarchy.pagePurposeId],
    pagePurposeIds,
    `hierarchy ${hierarchy.pagePurposeId}`,
  );
  for (const level of hierarchy.levels) {
    assertRefs(
      level.regionIds,
      regionIds,
      `hierarchy ${hierarchy.pagePurposeId} level ${level.level}`,
    );
    assertRefs(
      level.elementIds,
      elementIds,
      `hierarchy ${hierarchy.pagePurposeId} level ${level.level}`,
    );
  }
}

for (const decision of designSystemDelta.decisions) {
  assertRefs(
    decision.sourceRequirementIds,
    requirementIds,
    `design system decision ${decision.id}`,
  );
}
for (const componentDelta of designSystemDelta.componentDeltas) {
  assertRefs(
    componentDelta.sourceRequirementIds,
    requirementIds,
    `component delta ${componentDelta.id}`,
  );
}
for (const patternDelta of designSystemDelta.patternDeltas) {
  assertRefs(
    patternDelta.sourceRequirementIds,
    requirementIds,
    `pattern delta ${patternDelta.id}`,
  );
}

for (const capability of capabilityRequirements.capabilities) {
  assertRefs(
    capability.sourceRequirementIds,
    requirementIds,
    `capability ${capability.id}`,
  );
  assertRefs(
    capability.sourceInteractionIds,
    stepIds,
    `capability ${capability.id}`,
  );
}

for (const document of [
  experienceContract,
  designSystemDelta,
  capabilityRequirements,
  bundleManifest,
  humanDecision,
]) {
  assert(
    document.requestId === designRequest.requestId,
    `${document.$schema}: requestId differs from the design request`,
  );
}

for (const document of [
  experienceContract,
  designSystemDelta,
  capabilityRequirements,
  humanDecision,
]) {
  assert(
    document.revisionId === bundleManifest.revisionId,
    `${document.$schema}: revisionId differs from the bundle manifest`,
  );
}

assert(
  humanDecision.bundleDigest === bundleManifest.bundleDigest,
  "human decision: bundleDigest differs from the bundle manifest",
);

assert(
  bundleManifest.sourceDigest === sha256(canonicalJson(designRequest)),
  "bundle manifest: sourceDigest differs from canonical Design Request",
);

const snapshotDigestInput = { ...authoringSnapshot };
delete snapshotDigestInput.snapshotDigest;
assert(
  authoringSnapshot.snapshotDigest === sha256(canonicalJson(snapshotDigestInput)),
  "authoring context snapshot: snapshotDigest differs from canonical snapshot content",
);

const requestedContextRefs = new Set(
  [...designRequest.contextRefs, designRequest.existingDesignSystemRef]
    .filter(Boolean)
    .map((ref) => canonicalJson(ref)),
);
for (const ref of [
  ...authoringSnapshot.sourceRefs.map((entry) => entry.ref),
  authoringSnapshot.designSystem.ref,
].filter(Boolean)) {
  assert(
    requestedContextRefs.has(canonicalJson(ref)),
    "authoring context snapshot: ref is outside Design Request context",
  );
}

for (const [artifactId, artifact] of Object.entries(bundleManifest.artifacts)) {
  const artifactPath = path.resolve(repositoryRoot, artifact.path);
  assert(
    artifactPath.startsWith(`${repositoryRoot}${path.sep}`),
    `bundle artifact ${artifactId}: path escapes the repository`,
  );
  assert(
    fs.existsSync(artifactPath),
    `bundle artifact ${artifactId}: "${artifact.path}" does not exist`,
  );
  assert(
    artifact.digest === digestArtifact(artifactPath, artifact.mediaType),
    `bundle artifact ${artifactId}: digest does not match "${artifact.path}"`,
  );
}

for (const tokenDocument of designSystemDelta.tokenDocuments) {
  const tokenPath = path.resolve(repositoryRoot, tokenDocument.path);
  assert(
    tokenPath.startsWith(`${repositoryRoot}${path.sep}`),
    `token document: path escapes the repository`,
  );
  assert(
    fs.existsSync(tokenPath),
    `token document: "${tokenDocument.path}" does not exist`,
  );
  assert(
    tokenDocument.digest ===
      digestArtifact(tokenPath, "application/design-tokens+json"),
    `token document: digest does not match "${tokenDocument.path}"`,
  );
}

if (humanDecision.verdict === "approve") {
  assert(
    experienceContract.ambiguities.length === 0,
    "approved bundle: unresolved ambiguities remain",
  );
}

const digestInput = { ...bundleManifest };
delete digestInput.bundleDigest;
assert(
  bundleManifest.bundleDigest === sha256(canonicalJson(digestInput)),
  "bundle manifest: bundleDigest differs from canonical manifest content",
);

console.log(
  `Validated ${schemaFiles.length} schemas, ${Object.keys(examples).length} examples, and cross-document references.`,
);
