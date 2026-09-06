import { GEOMETRY_VERSION, PARAM_LIMITS, degreesToRadians, validateParameters } from "./geometry.js";

export const MODEL_VERSION = GEOMETRY_VERSION;
export const MAX_IMPORT_BYTES = 1024 * 1024;
export const LEGACY_DRAFT_FORMAT = "foldline-project";
export const LEGACY_DRAFT_MESSAGE = "This is a legacy Foldline draft from the old width/height/hinge model. It is not converted because that geometry was not contract-aligned. Export the file unchanged for recovery, then start a new accepted mechanism project.";

export const EXAMPLE_PROJECT = Object.freeze({ version: MODEL_VERSION, name: "45° hinge / branch +", alphaRad: degreesToRadians(45), Lmm: 60, branch: 1, qRad: degreesToRadians(90), savedAt: null });
export const EXAMPLES = Object.freeze([
  EXAMPLE_PROJECT,
  Object.freeze({ version: MODEL_VERSION, name: "25° compact / branch +", alphaRad: degreesToRadians(25), Lmm: 30, branch: 1, qRad: degreesToRadians(60), savedAt: null }),
  Object.freeze({ version: MODEL_VERSION, name: "65° wide / branch −", alphaRad: degreesToRadians(65), Lmm: 120, branch: -1, qRad: degreesToRadians(150), savedAt: null })
]);

export function cloneProject(project) { return { ...project }; }

export function validateProject(project) {
  const errors = [];
  if (!project || project.version !== MODEL_VERSION) errors.push(`Unsupported project version. Expected ${MODEL_VERSION}.`);
  const geometry = validateParameters(project || {});
  errors.push(...geometry.errors);
  return { valid: errors.length === 0, errors, geometry };
}

export function normalizeProject(input) {
  const candidate = {
    version: input?.version,
    name: typeof input?.name === "string" && input.name.trim() ? input.name.trim().slice(0, 80) : "Imported mechanism",
    alphaRad: Number(input?.alphaRad),
    Lmm: Number(input?.Lmm),
    branch: Number(input?.branch),
    qRad: Number(input?.qRad),
    savedAt: typeof input?.savedAt === "string" ? input.savedAt : null
  };
  const result = validateProject(candidate);
  if (!result.valid) throw new Error(result.errors[0]);
  return candidate;
}

export function serializeProject(project) { return JSON.stringify({ format: MODEL_VERSION, ...cloneProject(project) }, null, 2); }

export function parseProjectText(text) {
  if (typeof text !== "string") throw new Error("Project data must be text.");
  if (new TextEncoder().encode(text).byteLength > MAX_IMPORT_BYTES) throw new Error("This project file is larger than 1 MB.");
  let parsed;
  try { parsed = JSON.parse(text); } catch { throw new Error("The file is not valid JSON."); }
  const isObject = parsed !== null && typeof parsed === "object";
  if (isObject && (parsed.format === LEGACY_DRAFT_FORMAT || ["width", "height", "hingeOffset", "creases"].some((key) => key in parsed))) throw new Error(LEGACY_DRAFT_MESSAGE);
  if (parsed?.format && parsed.format !== MODEL_VERSION) throw new Error(`Unsupported project version. Expected ${MODEL_VERSION}. This file was not changed.`);
  return normalizeProject(parsed);
}

export function projectKey(project) { return [project.alphaRad, project.Lmm, project.branch, project.qRad].join("-"); }

export { PARAM_LIMITS };
