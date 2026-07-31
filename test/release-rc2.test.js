import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const releaseRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../contracts/contract-v1.0.0-rc.2"
);
const digest = `sha256:${"a".repeat(64)}`;
const releaseInventory = [
  [
    "author-invocation.schema.json",
    "urn:designflow:schema:contract-v1.0.0-rc.2:author-invocation"
  ],
  [
    "authoring-ambiguity-report.schema.json",
    "urn:designflow:schema:contract-v1.0.0-rc.2:authoring-ambiguity-report"
  ],
  [
    "authoring-context-snapshot.schema.json",
    "urn:designflow:schema:contract-v1.0.0-rc.2:authoring-context-snapshot"
  ],
  [
    "common.schema.json",
    "urn:designflow:schema:contract-v1.0.0-rc.2:common"
  ],
  [
    "design-bundle-manifest.schema.json",
    "urn:designflow:schema:contract-v1.0.0-rc.2:design-bundle-manifest"
  ]
];

function releaseValidators() {
  const files = fs.readdirSync(releaseRoot)
    .filter((name) => name.endsWith(".schema.json"))
    .sort();
  assert.deepEqual(files, releaseInventory.map(([name]) => name));
  const schemas = files.map((name) =>
    JSON.parse(fs.readFileSync(path.join(releaseRoot, name), "utf8")));
  assert.deepEqual(schemas.map((schema) => schema.$id), releaseInventory.map(([, id]) => id));
  const refs = [];
  const visit = (value) => {
    if (Array.isArray(value)) {
      for (const entry of value) visit(entry);
      return;
    }
    if (!value || typeof value !== "object") return;
    if (typeof value.$ref === "string") refs.push(value.$ref);
    for (const entry of Object.values(value)) visit(entry);
  };
  for (const schema of schemas) visit(schema);
  assert.equal(
    refs.every((ref) =>
      ref.startsWith("#") ||
      ref.startsWith("urn:designflow:schema:contract-v1.0.0-rc.2:")),
    true
  );

  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  for (const schema of schemas) ajv.addSchema(schema);
  for (const schema of schemas) {
    assert.equal(typeof ajv.getSchema(schema.$id), "function");
  }
  return (schemaId, value) => {
    const validate = ajv.getSchema(schemaId);
    assert.equal(typeof validate, "function");
    return validate(value);
  };
}

test("[PR-INTENT] rc.2 loads locally and closes every published document", () => {
  const validate = releaseValidators();
  const invocation = {
    invocationKey: "invocation.release",
    provider: "designflow-mock",
    toolOrModel: "deterministic-fixture",
    profileRevision: "contract-v1.0.0-rc.2",
    inputContextDigest: digest,
    instructionDigest: digest,
    outputDigest: digest
  };
  const ambiguity = {
    schemaVersion: "1.0",
    requestId: "request.release",
    invocationKey: invocation.invocationKey,
    targetArtifact: "experience",
    ambiguities: [{
      id: "ambiguity.required-outcome",
      question: "What outcome is required?",
      blocks: true
    }]
  };
  const snapshot = {
    schemaVersion: "1.0",
    snapshotId: "snapshot.release",
    snapshotDigest: digest,
    designSystem: {
      ref: null,
      tokenDocuments: [],
      components: [],
      patterns: []
    },
    sourceRefs: [],
    capturedAt: "2026-07-31T00:00:00.000Z"
  };
  const artifact = {
    path: "artifacts/example.json",
    digest,
    mediaType: "application/json",
    schemaRef: "urn:designflow:schema:v1:experience-contract"
  };
  const manifest = {
    schemaVersion: "1.0",
    bundleId: "bundle.release",
    requestId: "request.release",
    revisionId: "revision.release",
    previousRevisionId: null,
    sourceDigest: digest,
    designSystemBaseRevision: null,
    artifacts: {
      experience: artifact,
      designSystemDelta: artifact,
      capabilityRequirements: artifact,
      preview: artifact
    },
    authorInvocationRefs: [invocation],
    bundleDigest: digest,
    createdAt: "2026-07-31T00:00:00.000Z"
  };
  const documents = [
    ["urn:designflow:schema:contract-v1.0.0-rc.2:author-invocation", invocation],
    ["urn:designflow:schema:contract-v1.0.0-rc.2:authoring-ambiguity-report", ambiguity],
    ["urn:designflow:schema:contract-v1.0.0-rc.2:authoring-context-snapshot", snapshot],
    ["urn:designflow:schema:contract-v1.0.0-rc.2:design-bundle-manifest", manifest]
  ];
  for (const [schemaId, document] of documents) {
    assert.equal(validate(schemaId, document), true);
    assert.equal(validate(schemaId, { ...document, unexpected: true }), false);
  }

  assert.equal(validate(
    "urn:designflow:schema:contract-v1.0.0-rc.2:authoring-ambiguity-report",
    {
      ...ambiguity,
      ambiguities: ambiguity.ambiguities.map((item) => ({ ...item, blocks: false }))
    }
  ), false);
  assert.equal(validate(
    "urn:designflow:schema:contract-v1.0.0-rc.2:design-bundle-manifest",
    {
      ...manifest,
      artifacts: {
        ...manifest.artifacts,
        experience: { ...artifact, unexpected: true }
      }
    }
  ), false);
  for (const path of [
    "..",
    "dir/..",
    "../secret",
    "..\\secret",
    "dir\\..\\secret",
    "C:\\secret",
    "C:/secret",
    "\\\\server\\share",
    "/etc/passwd"
  ]) {
    assert.equal(validate(
      "urn:designflow:schema:contract-v1.0.0-rc.2:design-bundle-manifest",
      {
        ...manifest,
        artifacts: {
          ...manifest.artifacts,
          experience: { ...artifact, path }
        }
      }
    ), false, path);
  }
});
