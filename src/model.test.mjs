import test from "node:test";
import assert from "node:assert/strict";
import { EXAMPLE_PROJECT, MAX_IMPORT_BYTES, MODEL_VERSION, normalizeProject, parseProjectText, projectKey, serializeProject, validateProject } from "./model.js";
import { degreesToRadians, solveMechanism } from "./geometry.js";

test("45 degree example uses the accepted versioned parameter model", () => {
  assert.equal(validateProject(EXAMPLE_PROJECT).valid, true);
  assert.equal(EXAMPLE_PROJECT.version, MODEL_VERSION);
  assert.equal(EXAMPLE_PROJECT.Lmm, 60);
  assert.equal(EXAMPLE_PROJECT.branch, 1);
});

test("contract bounds reject bad alpha, length, branch, q, and non-finite values", () => {
  for (const bad of [
    { alphaRad: degreesToRadians(0) }, { alphaRad: degreesToRadians(90) }, { Lmm: 0 }, { Lmm: Number.NaN },
    { branch: 0 }, { branch: 2 }, { qRad: degreesToRadians(-1) }, { qRad: degreesToRadians(161) }, { qRad: Number.POSITIVE_INFINITY }
  ]) assert.equal(validateProject({ ...EXAMPLE_PROJECT, ...bad }).valid, false);
});

test("project export round trips exact alpha/L/branch/q source parameters", () => {
  const imported = parseProjectText(serializeProject(EXAMPLE_PROJECT));
  assert.deepEqual(imported, EXAMPLE_PROJECT);
  assert.equal(projectKey(imported), `${EXAMPLE_PROJECT.alphaRad}-${EXAMPLE_PROJECT.Lmm}-1-${EXAMPLE_PROJECT.qRad}`);
});

test("unsupported versions and malformed files fail before entering the app", () => {
  assert.throws(() => parseProjectText(JSON.stringify({ ...EXAMPLE_PROJECT, version: "origami-mechanism/99" })), /Unsupported project version/);
  assert.throws(() => parseProjectText("{nope"), /valid JSON/);
  assert.throws(() => parseProjectText("x".repeat(MAX_IMPORT_BYTES + 1)), /larger than 1 MB/);
  assert.throws(() => normalizeProject({ ...EXAMPLE_PROJECT, branch: 0 }), /Branch/);
});

test("legacy drafts are rejected with an unchanged recovery path", () => {
  const legacy = JSON.stringify({ format: "foldline-project", version: 1, width: 90, height: 64, hingeOffset: 12, angle: 38, creases: ["M", "V"] });
  assert.throws(() => parseProjectText(legacy), /legacy Foldline draft.*not converted.*Export the file unchanged/i);
  assert.throws(() => parseProjectText(JSON.stringify({ width: 90, height: 64, hingeOffset: 12, creases: ["M", "V"] })), /legacy Foldline draft.*not converted/i);
});

test("analytic 45 degree fixture closes, preserves edges, and derives M/V from measured hinges", () => {
  const solution = solveMechanism(EXAMPLE_PROJECT);
  assert.equal(solution.valid, true, solution.errors?.join("; "));
  assert.ok(solution.residuals.rotationResidual <= 1e-7);
  assert.ok(solution.residuals.positionResidual <= 1e-7 * EXAMPLE_PROJECT.Lmm);
  assert.ok(solution.residuals.edgeResidual <= 1e-7 * EXAMPLE_PROJECT.Lmm);
  assert.ok(solution.residuals.hingeResidual <= 1e-7 * EXAMPLE_PROJECT.Lmm);
  assert.deepEqual(solution.labels, ["mountain", "valley", "mountain", "mountain"]);
  assert.ok(Math.abs(solution.measuredDelta[1] - EXAMPLE_PROJECT.qRad) < 1e-7);
});
