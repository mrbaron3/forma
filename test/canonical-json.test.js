import assert from "node:assert/strict";
import test from "node:test";
import * as authoring from "../src/authoring/index.js";

test("canonical JSON normalizes scalar negative zero to zero", () => {
  assert.equal(authoring.canonicalJson(-0), "0");
  assert.equal(authoring.canonicalJson(0), "0");
});

test("digest gives scalar negative zero and zero the same deterministic identity", () => {
  const negativeZeroDigest = authoring.digest(-0);
  const zeroDigest = authoring.digest(0);

  assert.equal(negativeZeroDigest, zeroDigest);
  assert.match(negativeZeroDigest, /^sha256:[0-9a-f]{64}$/);
  assert.equal(authoring.digest(-0), negativeZeroDigest);
  assert.equal(authoring.digest(0), zeroDigest);
});

test("canonical JSON and digest normalize negative zero in dense arrays", () => {
  const negativeZero = [1, -0, 2];
  const zero = [1, 0, 2];

  assert.equal(authoring.canonicalJson(negativeZero), authoring.canonicalJson(zero));
  assert.equal(authoring.digest(negativeZero), authoring.digest(zero));
});

test("canonical JSON and digest normalize negative zero in plain objects", () => {
  const negativeZero = { before: 1, value: -0, after: 2 };
  const zero = { before: 1, value: 0, after: 2 };

  assert.equal(authoring.canonicalJson(negativeZero), authoring.canonicalJson(zero));
  assert.equal(authoring.digest(negativeZero), authoring.digest(zero));
});
