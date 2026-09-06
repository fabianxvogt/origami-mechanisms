import test from "node:test";
import assert from "node:assert/strict";
import { EXAMPLES } from "./model.js";
import { distance, flatCoordinates, radiansToDegrees, sampledCollisionStatus, solveMechanism } from "./geometry.js";

test("all authored fixtures match the contract's flat radial and hinge topology", () => {
  for (const project of EXAMPLES) {
    const flat = flatCoordinates(project); const solution = solveMechanism(project);
    assert.equal(solution.valid, true, solution.errors?.join("; "));
    assert.ok(solution.residuals.rotationResidual <= 1e-7);
    assert.ok(solution.residuals.positionResidual <= 1e-7 * project.Lmm);
    flat.E.forEach((endpoint) => assert.ok(Math.abs(distance(flat.O, endpoint) - project.Lmm) <= 1e-7 * project.Lmm));
    assert.equal(solution.faces.length, 4);
    assert.equal(solution.hingeAxes.length, 4);
    assert.equal(solution.measuredDelta.length, 4);
    assert.equal(solution.labels.filter((label) => label !== "flat").length, project.qRad === 0 ? 0 : 4);
  }
});

test("authored collision classification is sampled, explicit, and clear", () => {
  for (const project of EXAMPLES) {
    const sampled = sampledCollisionStatus(project);
    assert.equal(sampled.status, "clear on sampled states");
    assert.equal(sampled.sampledStates, 322);
  }
});

test("near-limit warning is distinct from hard invalid q", () => {
  const nearLimit = solveMechanism({ ...EXAMPLES[0], qRad: Math.PI * 155 / 180 });
  const hardInvalid = solveMechanism({ ...EXAMPLES[0], qRad: Math.PI });
  assert.equal(nearLimit.valid, true);
  assert.match(nearLimit.warning, /above 150/);
  assert.equal(hardInvalid.valid, false);
  assert.match(hardInvalid.errors[0], /160/);
  assert.ok(radiansToDegrees(nearLimit.measuredDelta[1]) > 150);
});

test("closure gates keep rotation units separate from position millimetres", () => {
  const solution = solveMechanism(EXAMPLES[0]);
  assert.equal(typeof solution.residuals.rotationResidual, "number");
  assert.equal(typeof solution.residuals.positionResidual, "number");
  assert.equal("closureResidual" in solution.residuals, false);
  assert.ok(solution.residuals.rotationResidual <= 1e-7);
  assert.ok(solution.residuals.positionResidual <= 1e-7 * EXAMPLES[0].Lmm);
});
