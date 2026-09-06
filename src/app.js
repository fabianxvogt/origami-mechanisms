import { EXAMPLE_PROJECT, EXAMPLES, MODEL_VERSION, cloneProject, normalizeProject, parseProjectText, projectKey, serializeProject } from "./model.js";
import { classifyCollision, degreesToRadians, flatCoordinates, radiansToDegrees, sampledCollisionStatus, solveMechanism } from "./geometry.js";
import { PLAYBACK_MAX_DEG, createMotionLoop } from "./motion.js";
import { buildSvg } from "./svg.js";
import { validateVariantName } from "./variant-name.js";

const STORAGE_KEY = "foldline.mechanisms.v2";
const LEGACY_STORAGE_KEY = "foldline.variants.v1";
const state = { project: cloneProject(EXAMPLE_PROJECT), history: [], future: [], view: "3d", dirty: false, pendingAction: null, angleSnapshot: null, importSequence: 0, previewQDeg: null, sampleKey: null, sampleStatus: null, solution: null, currentCollision: null, storageNotice: null };
const $ = (id) => document.getElementById(id);
const controls = { alpha: $("alpha-input"), length: $("length-input"), q: $("q-slider") };

const motion = createMotionLoop({
  max: PLAYBACK_MAX_DEG,
  getAngle: () => Number(controls.q.value),
  setAngle: (angleDeg) => { state.previewQDeg = angleDeg; controls.q.value = angleDeg; $("q-readout").textContent = `${angleDeg.toFixed(0)}°`; renderGeometry(); renderValidation(); renderAngles(); },
  onPlayingChange: (playing) => { $("play-icon").textContent = playing ? "Ⅱ" : "▶"; $("play-motion").classList.toggle("is-playing", playing); }
});

function announce(message, tone = "neutral") { const region = $("toast-region"); region.innerHTML = `<div class="toast toast--${tone}">${escapeHtml(message)}</div>`; window.setTimeout(() => { region.innerHTML = ""; }, 3600); }
function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character])); }
function slugify(value) { return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "foldline-mechanism"; }

function readLocalVariants() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { variants: [], invalidCount: 0 };
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return { variants: [], invalidCount: 1 };
    const variants = []; let invalidCount = 0;
    for (const item of parsed) { try { variants.push(normalizeProject(item)); } catch { invalidCount += 1; } }
    return { variants, invalidCount };
  } catch { return { variants: [], invalidCount: 1 }; }
}

function readLegacyDrafts() { try { return localStorage.getItem(LEGACY_STORAGE_KEY); } catch { return null; } }

function writeLocalVariants(variants) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(variants)); state.storageNotice = null; return true; }
  catch { state.storageNotice = "This browser blocked or filled local storage. Export the project file to keep a portable copy."; announce(state.storageNotice, "error"); return false; }
}

function pushHistory() { state.history.push(cloneProject(state.project)); if (state.history.length > 30) state.history.shift(); state.future = []; }
function displayProject() { return state.previewQDeg === null ? state.project : { ...state.project, qRad: degreesToRadians(state.previewQDeg) }; }
function stopMotion() { motion.stop(); state.previewQDeg = null; controls.q.value = radiansToDegrees(state.project.qRad); }
function setProject(next, { remember = true, markDirty = true } = {}) { stopMotion(); state.angleSnapshot = null; if (remember) pushHistory(); state.project = cloneProject(next); state.dirty = markDirty; state.sampleKey = null; state.sampleStatus = null; renderAll(); }
function undo() { stopMotion(); state.angleSnapshot = null; const previous = state.history.pop(); if (!previous) return; state.future.push(cloneProject(state.project)); state.project = previous; state.dirty = true; state.sampleKey = null; state.sampleStatus = null; renderAll(); announce("Undid the last edit."); }
function redo() { stopMotion(); state.angleSnapshot = null; const next = state.future.pop(); if (!next) return; state.history.push(cloneProject(state.project)); state.project = next; state.dirty = true; state.sampleKey = null; state.sampleStatus = null; renderAll(); announce("Redid the edit."); }

function openReplaceModal(action) { state.pendingAction = action; $("confirm-modal").hidden = false; $("modal-confirm").focus(); }
function closeModal() { $("confirm-modal").hidden = true; state.pendingAction = null; }
function confirmReplace() { const action = state.pendingAction; closeModal(); if (action) action(); }
function openVariantModal() { const library = readLocalVariants(); const input = $("variant-name-input"); input.value = state.project.name || `Variant ${library.variants.length + 1}`; input.removeAttribute("aria-invalid"); $("variant-name-error").hidden = true; $("variant-name-error").textContent = ""; $("variant-modal").hidden = false; input.focus(); input.select(); }
function closeVariantModal() { $("variant-modal").hidden = true; $("variant-name-input").removeAttribute("aria-invalid"); $("variant-name-error").hidden = true; $("variant-name-error").textContent = ""; $("save-variant").focus(); }
function saveVariantName() { const input = $("variant-name-input"); const result = validateVariantName(input.value); if (!result.valid) { $("variant-name-error").textContent = result.error; $("variant-name-error").hidden = false; input.setAttribute("aria-invalid", "true"); input.focus(); return; } const library = readLocalVariants(); const saved = { ...cloneProject(state.project), name: result.name, savedAt: new Date().toISOString() }; const existingIndex = library.variants.findIndex((item) => projectKey(item) === projectKey(saved)); if (existingIndex >= 0) library.variants.splice(existingIndex, 1); library.variants.unshift(saved); closeVariantModal(); if (writeLocalVariants(library.variants)) { state.project = saved; state.dirty = false; renderAll(); announce("Variant saved on this device.", "success"); } }

function syncControls() {
  controls.alpha.value = radiansToDegrees(state.project.alphaRad).toFixed(3).replace(/\.000$/, "");
  controls.length.value = state.project.Lmm;
  controls.q.value = radiansToDegrees(state.project.qRad).toFixed(3).replace(/\.000$/, "");
  $("q-readout").textContent = `${radiansToDegrees(state.project.qRad).toFixed(0)}°`;
  document.querySelectorAll("input[name=branch]").forEach((input) => { input.checked = Number(input.value) === state.project.branch; });
  const matching = EXAMPLES.findIndex((example) => projectKey(example) === projectKey(state.project));
  $("example-select").value = matching >= 0 ? String(matching) : "custom";
}

function parameterKey() { return [state.project.alphaRad, state.project.Lmm, state.project.branch].join("|"); }
function readInputs() {
  const branch = Number(document.querySelector("input[name=branch]:checked")?.value);
  setProject({ ...state.project, alphaRad: degreesToRadians(Number(controls.alpha.value)), Lmm: Number(controls.length.value), branch, qRad: degreesToRadians(Number(controls.q.value)) });
}

function updateSvgText(solution, collision) {
  $("mechanism-title").textContent = solution?.valid ? `Single-vertex mechanism at ${radiansToDegrees(displayProject().qRad).toFixed(0)} degrees` : "Invalid mechanism state";
  $("mechanism-desc").textContent = solution?.valid ? `Four rigid triangular panels. Collision result: ${collision.status}.` : solution?.errors?.[0] || "Parameters are outside the accepted contract bounds.";
  $("svg-status").textContent = solution?.valid ? collision.status.toUpperCase() : "INVALID STATE";
}

function makeProjector(points, projectPoint) {
  const projected = points.map(projectPoint); const xs = projected.map((point) => point[0]); const ys = projected.map((point) => point[1]);
  const minX = Math.min(...xs); const maxX = Math.max(...xs); const minY = Math.min(...ys); const maxY = Math.max(...ys);
  const scale = Math.min(520 / Math.max(maxX - minX, 1), 310 / Math.max(maxY - minY, 1)); const centerX = (minX + maxX) / 2; const centerY = (minY + maxY) / 2;
  return (point) => { const [x, y] = projectPoint(point); return [320 + (x - centerX) * scale, 220 - (y - centerY) * scale]; };
}
function setPoints(element, points) { element.setAttribute("points", points.map((point) => point.map((value) => value.toFixed(2)).join(",")).join(" ")); }
function setLine(element, a, b) { element.setAttribute("x1", a[0].toFixed(2)); element.setAttribute("y1", a[1].toFixed(2)); element.setAttribute("x2", b[0].toFixed(2)); element.setAttribute("y2", b[1].toFixed(2)); }
function setText(element, point, text) { element.setAttribute("x", point[0].toFixed(2)); element.setAttribute("y", point[1].toFixed(2)); element.textContent = text; }

function updateFlatArt(solution) {
  const flat = flatCoordinates(state.project); const project = makeProjector([...flat.E, flat.O], (point) => [point[0], point[1]]); const points = flat.E.map(project);
  setPoints($("flat-boundary"), points); setLine($("flat-scale-bar"), project([0, 0, 0]), project([10, 0, 0])); $("flat-mountain").innerHTML = ""; $("flat-valley").innerHTML = "";
  flat.E.forEach((endpoint, index) => { const screen = project(endpoint); const label = solution.labels[index] || "flat"; const group = label === "mountain" ? $("flat-mountain") : label === "valley" ? $("flat-valley") : $("flat-mountain"); const line = document.createElementNS("http://www.w3.org/2000/svg", "line"); setLine(line, project(flat.O), screen); line.setAttribute("stroke", label === "flat" ? "#8e8a83" : "currentColor"); group.appendChild(line); setText($(`flat-label-${index + 1}`), [screen[0] + 5, screen[1] - 5], `${index + 1} / ${label === "flat" ? "flat" : label === "mountain" ? "M" : "V"}`); });
  const center = project(flat.O); setText($("flat-origin"), [center[0] + 6, center[1] - 6], "O");
  $("flat-meta").textContent = `α=${radiansToDegrees(state.project.alphaRad).toFixed(3)}° · L=${state.project.Lmm.toFixed(1)} mm · branch=${state.project.branch > 0 ? "+1" : "−1"}`;
}

function updateMechanismArt(solution) {
  const projectedPoints = solution.faces.flat(); const project3d = makeProjector(projectedPoints, (point) => [point[0] + point[2] * 0.68, point[1] - point[2] * 0.82]);
  solution.faces.forEach((face, index) => setPoints($(`panel-${index + 1}`), face.map(project3d)));
  const hingePoints = solution.faces.map((face) => [face[0], face[1]]);
  hingePoints.forEach((pair, index) => setLine($(`hinge-${index + 1}`), project3d(pair[0]), project3d(pair[1])));
  const labelOffsets = [[-12, -8], [12, 8], [-12, -8], [12, 8]];
  solution.faces.forEach((face, index) => { const centroid = face.reduce((sum, point) => [sum[0] + point[0] / 3, sum[1] + point[1] / 3, sum[2] + point[2] / 3], [0, 0, 0]); const [offsetX, offsetY] = labelOffsets[index]; const position = project3d(centroid); setText($(`panel-label-${index + 1}`), [position[0] + offsetX, position[1] + offsetY], `F${index + 1}`); });
  $("mechanism-meta").textContent = `q=${radiansToDegrees(displayProject().qRad).toFixed(1)}° · branch=${state.project.branch > 0 ? "+1" : "−1"} · rot=${solution.residuals.rotationResidual.toExponential(1)} · pos=${solution.residuals.positionResidual.toExponential(1)} mm`;
}

function updateLayerVisibility() {
  const flat = state.view === "flat"; const visible3d = state.view !== "flat";
  $("flat-art").style.display = flat && state.solution?.valid ? "block" : "none"; $("mechanism-art").style.display = visible3d && state.solution?.valid ? "block" : "none"; $("invalid-art").style.display = state.solution?.valid ? "none" : "block";
  document.querySelectorAll(".stage-tab").forEach((tab) => { const active = tab.dataset.view === state.view; tab.classList.toggle("is-active", active); tab.setAttribute("aria-selected", String(active)); });
  $("canvas-state").textContent = state.view === "flat" ? "flat source pattern" : state.view === "reference" ? "3D reference" : "live 3D mechanism";
  $("stage-caption-title").textContent = state.view === "flat" ? "Flat crease pattern" : state.view === "reference" ? "Reference folded view" : "Rigid-hinge 3D view";
  $("stage-caption-copy").textContent = state.view === "flat" ? "The four center rays and outer boundary are the source of truth for SVG export." : "The panels are derived from the same vertices and oriented hinge rotations; collision claims are sampled only.";
}

function renderGeometry() {
  const viewProject = displayProject(); const solution = solveMechanism(viewProject); state.solution = solution;
  if (!solution.valid) { state.currentCollision = { status: solution.stage === "invalid closure" ? "invalid closure; collision not classified" : "invalid parameters" }; updateSvgText(solution, state.currentCollision); updateLayerVisibility(); return; }
  const key = parameterKey(); if (key !== state.sampleKey) { state.sampleStatus = sampledCollisionStatus(state.project); state.sampleKey = key; }
  const current = classifyCollision(solution); state.currentCollision = current.status === "clear on sampled states" && state.sampleStatus?.status !== "clear on sampled states" ? state.sampleStatus : current;
  updateFlatArt(solution); updateMechanismArt(solution); updateSvgText(solution, state.currentCollision); updateLayerVisibility();
}

function renderAngles() {
  const list = $("fold-angle-list"); list.innerHTML = "";
  if (!state.solution?.valid) { list.innerHTML = `<div class="angle-row angle-row--invalid">No signed hinges until parameters and closure are valid.</div>`; return; }
  state.solution.measuredDelta.forEach((angle, index) => { const label = state.solution.labels[index]; const sign = angle > 0 ? "+" : angle < 0 ? "−" : "±"; const row = document.createElement("div"); row.className = "angle-row"; row.innerHTML = `<span>c${index + 1}</span><strong>${sign}${Math.abs(radiansToDegrees(angle)).toFixed(1)}°</strong><em class="angle-${label}">${label}</em>`; list.appendChild(row); });
}

function renderValidation() {
  const card = $("validation-card"); const title = $("validation-title"); const copy = $("validation-copy"); const collision = $("collision-status"); const detail = $("collision-detail");
  if (!state.solution?.valid) { card.dataset.state = "invalid"; $("validation-symbol").textContent = "!"; title.textContent = state.solution?.stage === "invalid closure" ? "Closure failed" : "Parameters need attention"; copy.textContent = state.solution?.errors?.[0] || "Enter α, L, branch, and q within the accepted bounds."; collision.textContent = state.currentCollision?.status || "invalid parameters"; detail.textContent = "Collision is not classified until the analytic state closes."; return; }
  card.dataset.state = state.currentCollision?.status === "clear on sampled states" ? "valid" : "warning"; $("validation-symbol").textContent = state.currentCollision?.status === "clear on sampled states" ? "✓" : "!"; title.textContent = state.solution.warning || "Analytic state is valid"; copy.textContent = `Rotation residual ${state.solution.residuals.rotationResidual.toExponential(1)} matrix units; position residual ${state.solution.residuals.positionResidual.toExponential(1)} mm.`;
  collision.textContent = state.currentCollision?.status || "clear on sampled states"; detail.textContent = state.currentCollision?.facePair ? `First flagged pair: ${state.currentCollision.facePair} at q=${state.currentCollision.qDeg ?? radiansToDegrees(displayProject().qRad).toFixed(1)}°. ` : `Deterministic sample grid: ${state.sampleStatus?.sampledStates || 322} states across both branches. `; detail.textContent += "Zero-thickness sampled check only; not continuous or physical clearance.";
}

function renderVariants() {
  const list = $("variant-list"); const empty = $("empty-library"); const feedback = $("library-feedback"); const library = readLocalVariants(); const legacyRaw = readLegacyDrafts(); list.querySelectorAll(".variant-row").forEach((row) => row.remove()); empty.hidden = library.variants.length > 0;
  const messages = []; if (state.storageNotice) messages.push(escapeHtml(state.storageNotice)); if (library.invalidCount) messages.push(`${library.invalidCount} current-format saved variant${library.invalidCount === 1 ? " is" : "s are"} unreadable. Your current draft is safe; export it before clearing local storage.`); if (legacyRaw) messages.push("Older draft data is still stored but not converted. Keep it as recovery data, or export it unchanged before starting a new accepted mechanism project."); feedback.hidden = messages.length === 0; feedback.innerHTML = messages.join("<br />"); if (legacyRaw) { const recovery = document.createElement("button"); recovery.className = "small-button small-button--ghost legacy-export"; recovery.type = "button"; recovery.textContent = "Export old draft recovery"; recovery.addEventListener("click", () => { download("foldline-legacy-draft-recovery.json", legacyRaw, "application/json"); announce("Old draft data exported unchanged for recovery.", "success"); }); feedback.appendChild(document.createTextNode(" ")); feedback.appendChild(recovery); }
  library.variants.forEach((variant, index) => { const row = document.createElement("article"); row.className = "variant-row"; row.innerHTML = `<div class="variant-thumb" aria-hidden="true"><span></span><span></span><span></span><span></span></div><div class="variant-info"><strong>${escapeHtml(variant.name)}</strong><span>α ${radiansToDegrees(variant.alphaRad).toFixed(1)}° <i>·</i> L ${variant.Lmm} mm <i>·</i> q ${radiansToDegrees(variant.qRad).toFixed(0)}° <i>·</i> branch ${variant.branch > 0 ? "+1" : "−1"}</span></div><button class="small-button small-button--ghost variant-open" type="button" data-index="${index}">Reopen</button>`; list.appendChild(row); });
  list.querySelectorAll(".variant-open").forEach((button) => button.addEventListener("click", () => { const variant = readLocalVariants().variants[Number(button.dataset.index)]; if (!variant) return; const reopen = () => { setProject(variant, { markDirty: false }); announce("Variant reopened for editing.", "success"); }; state.dirty ? openReplaceModal(reopen) : reopen(); }));
}

function renderAll() { syncControls(); renderGeometry(); renderValidation(); renderAngles(); renderVariants(); $("version-label").textContent = state.previewQDeg !== null ? "preview only" : state.dirty ? "unsaved draft" : MODEL_VERSION; $("undo-button").disabled = state.history.length === 0; $("redo-button").disabled = state.future.length === 0; }

function loadExample() { const index = Number($("example-select").value); const example = EXAMPLES[index]; if (!example) return; const load = () => { setProject(cloneProject(example), { markDirty: false }); announce("Authored example loaded. Scrub q from flat to folded.", "success"); }; state.dirty ? openReplaceModal(load) : load(); }
function saveVariant() { if (!state.solution?.valid) { announce("Fix the invalid state before saving a variant.", "error"); return; } const previewWasActive = state.previewQDeg !== null; stopMotion(); if (previewWasActive) renderAll(); openVariantModal(); }

function download(name, content, type) { const link = document.createElement("a"); const url = URL.createObjectURL(new Blob([content], { type })); link.href = url; link.download = name; document.body.appendChild(link); link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); }
function exportProject() { if (state.previewQDeg !== null) { stopMotion(); renderAll(); } download(`${slugify(state.project.name)}.origami.json`, serializeProject({ ...state.project, savedAt: new Date().toISOString() }), "application/json"); announce("Versioned mechanism project exported.", "success"); }

function exportSvg() {
  if (state.previewQDeg !== null) { stopMotion(); renderAll(); }
  if (!state.solution?.valid) { announce("Fix the invalid state before exporting SVG.", "error"); return; }
  const svg = buildSvg(state.solution, state.project, state.currentCollision);
  download(`${slugify(state.project.name)}.svg`, svg, "image/svg+xml"); announce("Contract-derived SVG exported with mm dimensions and a 10 mm scale bar.", "success");
}

function importProject(file) { if (!file) return; const request = ++state.importSequence; if (file.size > 1024 * 1024) { announce("Import stopped: choose a project file under 1 MB.", "error"); return; } const reader = new FileReader(); reader.onload = () => { if (request !== state.importSequence) return; try { const project = parseProjectText(reader.result); const replace = () => { setProject(project, { markDirty: false }); announce("Mechanism project imported and revalidated.", "success"); }; state.dirty ? openReplaceModal(replace) : replace(); } catch (error) { announce(`Import stopped: ${error.message}`, "error"); } }; reader.onerror = () => { if (request === state.importSequence) announce("Import stopped: the file could not be read.", "error"); }; reader.readAsText(file); }

function toggleMotion() { if (motion.isPlaying()) { stopMotion(); renderAll(); return; } state.angleSnapshot = null; state.previewQDeg = radiansToDegrees(state.project.qRad); controls.q.value = state.previewQDeg; motion.start(); renderAll(); }
function showLimits() { $("validation-card").scrollIntoView({ behavior: "smooth", block: "center" }); $("validation-card").classList.add("flash"); window.setTimeout(() => $("validation-card").classList.remove("flash"), 1200); }

function bindEvents() {
  $("load-example").addEventListener("click", loadExample); $("example-select").addEventListener("change", loadExample); $("save-variant").addEventListener("click", saveVariant); $("export-project").addEventListener("click", exportProject); $("export-svg").addEventListener("click", exportSvg); $("import-project").addEventListener("click", () => $("import-input").click()); $("import-input").addEventListener("change", (event) => { importProject(event.target.files[0]); event.target.value = ""; });
  $("undo-button").addEventListener("click", undo); $("redo-button").addEventListener("click", redo); [controls.alpha, controls.length].forEach((control) => control.addEventListener("change", readInputs)); document.querySelectorAll("input[name=branch]").forEach((input) => input.addEventListener("change", readInputs));
  controls.q.addEventListener("pointerdown", () => { state.angleSnapshot = cloneProject(state.project); }); controls.q.addEventListener("focus", () => { state.angleSnapshot ||= cloneProject(state.project); }); controls.q.addEventListener("input", () => { const qDeg = Number(controls.q.value); stopMotion(); state.project.qRad = degreesToRadians(qDeg); state.dirty = true; $("q-readout").textContent = `${qDeg.toFixed(0)}°`; renderGeometry(); renderValidation(); renderAngles(); }); controls.q.addEventListener("change", () => { if (state.angleSnapshot) { state.history.push(state.angleSnapshot); state.future = []; state.angleSnapshot = null; } renderAll(); });
  $("reset-motion").addEventListener("click", () => setProject({ ...state.project, qRad: 0 })); $("play-motion").addEventListener("click", toggleMotion); ["show-limitations", "show-limits-inline"].forEach((id) => $(id)?.addEventListener("click", showLimits));
  document.querySelectorAll(".stage-tab").forEach((tab) => tab.addEventListener("click", () => { state.view = tab.dataset.view; updateLayerVisibility(); }));
  $("modal-close").addEventListener("click", closeModal); $("modal-cancel").addEventListener("click", closeModal); $("modal-confirm").addEventListener("click", confirmReplace); $("variant-form").addEventListener("submit", (event) => { event.preventDefault(); saveVariantName(); }); $("variant-modal-close").addEventListener("click", closeVariantModal); $("variant-modal-cancel").addEventListener("click", closeVariantModal); document.addEventListener("keydown", (event) => { if (event.key === "Escape" && !$("confirm-modal").hidden) { closeModal(); return; } if (event.key === "Escape" && !$("variant-modal").hidden) { closeVariantModal(); return; } if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") { event.preventDefault(); event.shiftKey ? redo() : undo(); } });
}

bindEvents(); renderAll();
