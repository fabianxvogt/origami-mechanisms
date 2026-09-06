import test from "node:test";
import assert from "node:assert/strict";
import { EXAMPLE_PROJECT } from "./model.js";
import { classifyCollision, solveMechanism } from "./geometry.js";
import { buildSvg } from "./svg.js";

test("SVG is derived from the analytic solution with mm units, layers, M/V, metadata, and scale bar", () => {
  const solution = solveMechanism(EXAMPLE_PROJECT); const collision = classifyCollision(solution); const svg = buildSvg(solution, EXAMPLE_PROJECT, collision);
  assert.match(svg, /width="[0-9.]+mm" height="[0-9.]+mm"/);
  assert.match(svg, /viewBox="0 0 [0-9.]+ [0-9.]+"/);
  for (const layer of ["boundary", "mountain", "valley", "labels"]) assert.match(svg, new RegExp(`id="${layer}"`));
  assert.match(svg, /format=origami-mechanism\/1/);
  assert.match(svg, /alpha=45\.000000deg/);
  assert.match(svg, /L=60\.000000mm/);
  assert.match(svg, /branch=1/);
  assert.match(svg, /10 mm/);
  assert.equal((svg.match(/<line /g) || []).length, solution.labels.filter((label) => label === "mountain" || label === "valley").length + 1);
  assert.equal((svg.match(/<line /g) || []).length, 5);
});
