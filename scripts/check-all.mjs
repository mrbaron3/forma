import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "..");
const testDirectory = path.join(repositoryRoot, "test");
const testFiles = fs
  .readdirSync(testDirectory)
  .filter((name) => name.endsWith(".test.js"))
  .sort()
  .map((name) => path.join(testDirectory, name));

if (testFiles.length === 0) {
  throw new Error("no API test files were found");
}

function runNode(args) {
  const result = spawnSync(process.execPath, args, {
    cwd: repositoryRoot,
    env: process.env,
    stdio: "inherit",
    shell: false,
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

runNode([path.join(scriptDirectory, "check-contracts.mjs")]);
runNode(["--test", ...testFiles]);
