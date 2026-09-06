import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const appSource = await readFile(new URL("./app.js", import.meta.url), "utf8");
const pageSource = await readFile(new URL("../index.html", import.meta.url), "utf8");
const saveVariantSource = appSource.slice(appSource.indexOf("function saveVariant()"), appSource.indexOf("function download("));

test("app wiring keeps playback preview-only, bounded, and recoverable", () => {
  assert.match(appSource, /max: PLAYBACK_MAX_DEG/);
  assert.match(appSource, /previewQDeg/);
  assert.match(appSource, /function stopMotion\(\)/);
  assert.match(appSource, /state\.dirty = true/);
  assert.match(appSource, /legacy-export/);
  assert.doesNotMatch(appSource, /window\.prompt/);
  assert.match(appSource, /show-limitations.*show-limits-inline/);
  assert.match(pageSource, /id="show-limits-inline"/);
});

test("app labels residuals with their actual units", () => {
  assert.match(appSource, /Rotation residual .*matrix units/);
  assert.match(appSource, /position residual .*mm/);
  assert.doesNotMatch(appSource, /closureResidual/);
});

test("cancelling Save as variant after preview stop repaints the saved state", () => {
  assert.match(saveVariantSource, /const previewWasActive = state\.previewQDeg !== null/);
  assert.match(saveVariantSource, /stopMotion\(\); if \(previewWasActive\) renderAll\(\);/);
  assert.match(saveVariantSource, /openVariantModal\(\);/);
  assert.match(appSource, /variant-modal-cancel.*closeVariantModal/);
  assert.match(appSource, /variant-modal-save|variant-form.*saveVariantName/);
  assert.match(appSource, /event\.key === "Escape"[\s\S]*variant-modal[\s\S]*closeVariantModal/);
  assert.match(pageSource, /id="variant-name-input"/);
  assert.match(pageSource, /id="variant-modal-save"/);
  assert.match(pageSource, /id="variant-modal-cancel"/);
});
