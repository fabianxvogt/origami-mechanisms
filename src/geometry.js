export const GEOMETRY_VERSION = "origami-mechanism/1";
export const GEOMETRY_TOLERANCE = 1e-7;
export const COLLISION_EPSILON = 1e-7;
export const PARAM_LIMITS = Object.freeze({
  alphaDeg: { min: 25, max: 65 },
  Lmm: { min: 30, max: 120 },
  qDeg: { min: 0, max: 160 }
});

const rad = (degrees) => degrees * Math.PI / 180;
const deg = (radians) => radians * 180 / Math.PI;

export const vec = (x = 0, y = 0, z = 0) => [x, y, z];
export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const norm = (a) => Math.sqrt(dot(a, a));
export const distance = (a, b) => norm(sub(a, b));
export const normalize = (a) => { const length = norm(a); return length > 0 ? scale(a, 1 / length) : [NaN, NaN, NaN]; };

export const identity = () => [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
export const matrixVector = (m, a) => [dot(m[0], a), dot(m[1], a), dot(m[2], a)];
export const matrixMultiply = (a, b) => a.map((row) => b[0].map((_, column) => row.reduce((sum, value, index) => sum + value * b[index][column], 0)));
export const matrixResidual = (a, b) => Math.max(...a.flatMap((row, rowIndex) => row.map((value, column) => Math.abs(value - b[rowIndex][column]))));

export function rotation(axis, theta) {
  const [x, y, z] = normalize(axis);
  const c = Math.cos(theta); const s = Math.sin(theta); const t = 1 - c;
  return [[t * x * x + c, t * x * y - s * z, t * x * z + s * y], [t * x * y + s * z, t * y * y + c, t * y * z - s * x], [t * x * z - s * y, t * y * z + s * x, t * z * z + c]];
}

export function validateParameters({ alphaRad, Lmm, branch, qRad } = {}) {
  const errors = [];
  const alphaDeg = deg(Number(alphaRad)); const qDeg = deg(Number(qRad));
  if (!Number.isFinite(alphaRad) || alphaDeg < PARAM_LIMITS.alphaDeg.min || alphaDeg > PARAM_LIMITS.alphaDeg.max) errors.push("α must be between 25° and 65°.");
  if (!Number.isFinite(Lmm) || Lmm < PARAM_LIMITS.Lmm.min || Lmm > PARAM_LIMITS.Lmm.max) errors.push("L must be between 30 and 120 mm.");
  if (branch !== 1 && branch !== -1) errors.push("Branch must be +1 or −1.");
  if (!Number.isFinite(qRad) || qDeg < PARAM_LIMITS.qDeg.min || qDeg > PARAM_LIMITS.qDeg.max) errors.push("q must be between 0° and 160°.");
  if (Number.isFinite(qRad) && !Number.isFinite(Math.tan(qRad / 2))) errors.push("q is too close to the mathematical flat-fold limit.");
  return { valid: errors.length === 0, errors, alphaDeg, qDeg };
}

export function flatCoordinates({ alphaRad, Lmm }) {
  const phi = [0, alphaRad, 2 * alphaRad, Math.PI + alphaRad];
  const O = vec(0, 0, 0);
  const E = phi.map((angle) => vec(Lmm * Math.cos(angle), Lmm * Math.sin(angle), 0));
  const faces = [[O, E[0], E[1]], [O, E[1], E[2]], [O, E[2], E[3]], [O, E[3], E[0]]];
  return { O, E, phi, faces };
}

export function foldAngles({ alphaRad, branch, qRad }) {
  if (qRad === 0) return [0, 0, 0, 0];
  const D = 2 * Math.atan(-Math.tan(branch * qRad / 2) / Math.cos(alphaRad));
  return [D, branch * qRad, D, -branch * qRad];
}

function transformFace(matrix, face) { return face.map((point) => matrixVector(matrix, point)); }
function faceNormal(face) { return normalize(cross(sub(face[1], face[0]), sub(face[2], face[0]))); }
function maxEdgeResidual(flatFace, worldFace) {
  return Math.max(...[[0, 1], [1, 2], [2, 0]].map(([a, b]) => Math.abs(distance(flatFace[a], flatFace[b]) - distance(worldFace[a], worldFace[b]))));
}

function hingeResiduals(faces) {
  return [
    distance(faces[3][2], faces[0][1]),
    distance(faces[0][2], faces[1][1]),
    distance(faces[1][2], faces[2][1]),
    distance(faces[2][2], faces[3][1])
  ];
}

function signedDihedral(axis, previousNormal, nextNormal) {
  return Math.atan2(dot(axis, cross(previousNormal, nextNormal)), dot(previousNormal, nextNormal));
}

export function solveMechanism(parameters) {
  const check = validateParameters(parameters);
  if (!check.valid) return { valid: false, stage: "invalid parameters", errors: check.errors, parameters };
  const { alphaRad, Lmm, branch, qRad } = parameters;
  const flat = flatCoordinates(parameters);
  const delta = foldAngles(parameters);
  const axes = flat.E.map((endpoint) => normalize(sub(endpoint, flat.O)));
  const transforms = [identity()];
  for (const index of [1, 2, 3]) {
    const axisWorld = matrixVector(transforms[index - 1], axes[index]);
    transforms.push(matrixMultiply(rotation(axisWorld, delta[index]), transforms[index - 1]));
  }
  const closeAxis = matrixVector(transforms[3], axes[0]);
  const closeTransform = matrixMultiply(rotation(closeAxis, delta[0]), transforms[3]);
  const faces = transforms.map((transform, index) => transformFace(transform, flat.faces[index]));
  const normals = faces.map(faceNormal);
  const hingeAxes = [closeAxis, axes[1], matrixVector(transforms[1], axes[2]), matrixVector(transforms[2], axes[3])];
  const orderedNormals = [[normals[3], normals[0]], [normals[0], normals[1]], [normals[1], normals[2]], [normals[2], normals[3]]];
  const measuredDelta = hingeAxes.map((axis, index) => signedDihedral(axis, orderedNormals[index][0], orderedNormals[index][1]));
  const edgeResidual = Math.max(...faces.map((face, index) => maxEdgeResidual(flat.faces[index], face)));
  const hingeResidual = Math.max(...hingeResiduals(faces));
  const rotationResidual = matrixResidual(closeTransform, identity());
  const positionResidual = distance(matrixVector(transforms[3], flat.E[0]), flat.E[0]);
  const dihedralResidual = Math.max(...measuredDelta.map((value, index) => Math.abs(value - delta[index])));
  const tolerance = GEOMETRY_TOLERANCE * Math.max(Lmm, 1);
  const errors = [];
  if (rotationResidual > GEOMETRY_TOLERANCE) errors.push(`Rotation closure residual ${rotationResidual.toExponential(2)} matrix units exceeds ${GEOMETRY_TOLERANCE.toExponential(2)}.`);
  if (positionResidual > tolerance) errors.push(`Position closure residual ${positionResidual.toExponential(2)} mm exceeds ${tolerance.toExponential(2)} mm.`);
  if (edgeResidual > tolerance) errors.push(`Rigid edge residual ${edgeResidual.toExponential(2)} mm exceeds tolerance.`);
  if (hingeResidual > tolerance) errors.push(`Hinge endpoint residual ${hingeResidual.toExponential(2)} mm exceeds tolerance.`);
  if (dihedralResidual > 1e-7) errors.push(`Signed hinge residual ${dihedralResidual.toExponential(2)} rad exceeds tolerance.`);
  const labels = measuredDelta.map((value) => Math.abs(value) <= 1e-9 ? "flat" : value > 0 ? "valley" : "mountain");
  return { valid: errors.length === 0, stage: errors.length === 0 ? "valid" : "invalid closure", errors, parameters: { alphaRad, Lmm, branch, qRad }, flat, faces, transforms, closeTransform, delta, measuredDelta, labels, normals, hingeAxes, residuals: { rotationResidual, positionResidual, edgeResidual, hingeResidual, dihedralResidual }, warning: check.qDeg > 150 ? "q is above 150°; the half-angle model is sensitive near its limit." : null };
}

function dominantProjection(normal) {
  const absolute = normal.map(Math.abs); const largest = absolute.indexOf(Math.max(...absolute));
  return largest === 0 ? [1, 2] : largest === 1 ? [0, 2] : [0, 1];
}
function project2(point, axes) { return [point[axes[0]], point[axes[1]]]; }
function nearOrigin2(point) { return Math.hypot(point[0], point[1]) <= COLLISION_EPSILON; }
function orient2(a, b, c) { return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]); }
function within2(a, b, c, epsilon = COLLISION_EPSILON) { return Math.abs(orient2(a, b, c)) <= epsilon && c[0] >= Math.min(a[0], b[0]) - epsilon && c[0] <= Math.max(a[0], b[0]) + epsilon && c[1] >= Math.min(a[1], b[1]) - epsilon && c[1] <= Math.max(a[1], b[1]) + epsilon; }
function strictInside2(point, triangle) { const signs = triangle.map((vertex, index) => orient2(vertex, triangle[(index + 1) % 3], point)); return signs.every((value) => value > COLLISION_EPSILON) || signs.every((value) => value < -COLLISION_EPSILON); }
function properCross2(a, b, c, d) { const abC = orient2(a, b, c); const abD = orient2(a, b, d); const cdA = orient2(c, d, a); const cdB = orient2(c, d, b); return ((abC > COLLISION_EPSILON && abD < -COLLISION_EPSILON) || (abC < -COLLISION_EPSILON && abD > COLLISION_EPSILON)) && ((cdA > COLLISION_EPSILON && cdB < -COLLISION_EPSILON) || (cdA < -COLLISION_EPSILON && cdB > COLLISION_EPSILON)); }

function coplanarTriangleCollision(a, b, normal) {
  const axes = dominantProjection(normal); const aa = a.map((point) => project2(point, axes)); const bb = b.map((point) => project2(point, axes));
  for (let i = 0; i < 3; i += 1) for (let j = 0; j < 3; j += 1) {
    if (properCross2(aa[i], aa[(i + 1) % 3], bb[j], bb[(j + 1) % 3])) return "contact/overlap detected";
    if ((!nearOrigin2(bb[j]) && within2(aa[i], aa[(i + 1) % 3], bb[j])) || (!nearOrigin2(aa[i]) && within2(bb[j], bb[(j + 1) % 3], aa[i]))) return "uncertain at tolerance";
  }
  if (aa.some((point) => strictInside2(point, bb)) || bb.some((point) => strictInside2(point, aa))) return "contact/overlap detected";
  return "clear";
}

function segmentTriangleHit(start, end, triangle) {
  const direction = sub(end, start); const edge1 = sub(triangle[1], triangle[0]); const edge2 = sub(triangle[2], triangle[0]); const h = cross(direction, edge2); const determinant = dot(edge1, h);
  if (Math.abs(determinant) <= COLLISION_EPSILON) return null;
  const inverse = 1 / determinant; const s = sub(start, triangle[0]); const u = inverse * dot(s, h); if (u < -COLLISION_EPSILON || u > 1 + COLLISION_EPSILON) return null;
  const q = cross(s, edge1); const v = inverse * dot(direction, q); if (v < -COLLISION_EPSILON || u + v > 1 + COLLISION_EPSILON) return null;
  const t = inverse * dot(edge2, q); if (t < -COLLISION_EPSILON || t > 1 + COLLISION_EPSILON) return null;
  return { point: add(start, scale(direction, t)), boundary: u <= COLLISION_EPSILON || v <= COLLISION_EPSILON || u + v >= 1 - COLLISION_EPSILON };
}

export function triangleCollision(a, b) {
  const normalA = cross(sub(a[1], a[0]), sub(a[2], a[0])); const normalB = cross(sub(b[1], b[0]), sub(b[2], b[0]));
  if (norm(cross(normalA, normalB)) <= COLLISION_EPSILON) return coplanarTriangleCollision(a, b, normalize(normalA));
  for (const [source, target] of [[a, b], [b, a]]) for (let i = 0; i < 3; i += 1) {
    const hit = segmentTriangleHit(source[i], source[(i + 1) % 3], target);
    if (!hit) continue;
    if (norm(hit.point) <= COLLISION_EPSILON) continue;
    return hit.boundary ? "uncertain at tolerance" : "contact/overlap detected";
  }
  return "clear";
}

export function classifyCollision(solution) {
  if (!solution?.valid) return { status: "invalid closure; collision not classified" };
  const pairs = [[0, 2], [1, 3]];
  for (const [a, b] of pairs) {
    const status = triangleCollision(solution.faces[a], solution.faces[b]);
    if (status !== "clear") return { status, facePair: `F${a + 1}/F${b + 1}` };
  }
  return { status: "clear on sampled states" };
}

export function sampledCollisionStatus(parameters) {
  let uncertain = null;
  let sampledStates = 0;
  for (const branch of [-1, 1]) for (let index = 0; index <= 160; index += 1) {
    const solution = solveMechanism({ ...parameters, branch, qRad: rad(index) });
    sampledStates += 1;
    if (!solution.valid) return { status: "invalid closure; collision not classified", sampledStates, branch, qDeg: index };
    const state = classifyCollision(solution);
    if (state.status === "contact/overlap detected") return { ...state, sampledStates, branch, qDeg: index };
    if (state.status === "uncertain at tolerance" && !uncertain) uncertain = { ...state, sampledStates, branch, qDeg: index };
  }
  return uncertain ? uncertain : { status: "clear on sampled states", sampledStates };
}

export const degreesToRadians = rad;
export const radiansToDegrees = deg;
