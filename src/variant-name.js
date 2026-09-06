export const MAX_VARIANT_NAME_LENGTH = 80;

export function validateVariantName(value) {
  const name = String(value ?? "").trim();
  if (!name) return { valid: false, error: "Enter a name for this variant." };
  if (name.length > MAX_VARIANT_NAME_LENGTH) return { valid: false, error: `Use ${MAX_VARIANT_NAME_LENGTH} characters or fewer.` };
  return { valid: true, name };
}
