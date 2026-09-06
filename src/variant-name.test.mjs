import test from "node:test";
import assert from "node:assert/strict";
import { MAX_VARIANT_NAME_LENGTH, validateVariantName } from "./variant-name.js";

test("variant names trim valid input and preserve the bounded length", () => {
  const result = validateVariantName("  Branch plus / 90°  ");
  assert.deepEqual(result, { valid: true, name: "Branch plus / 90°" });
  assert.equal(validateVariantName("x".repeat(MAX_VARIANT_NAME_LENGTH)).valid, true);
});

test("blank and overlong variant names stay unsaved with useful errors", () => {
  assert.match(validateVariantName("   ").error, /Enter a name/);
  assert.match(validateVariantName("x".repeat(MAX_VARIANT_NAME_LENGTH + 1)).error, /80 characters or fewer/);
});
