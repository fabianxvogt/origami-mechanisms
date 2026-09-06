# Geometry contract gate

Root accepted the scoped analytic contract on 2026-09-06. This app implements one single-vertex Miura cell, not a global Miura tessellation or arbitrary origami synthesis.

Source parameters are α in `[25°, 65°]`, L in `[30, 120] mm`, branch `±1`, and q in `[0°, 160°]`; radians are used internally. Flat rays are `[0, α, 2α, π+α]` with radius L. The solver uses the ordered Rodrigues hinge sequence from the contract, gates rotation closure at `1e-7` matrix units and position closure at `1e-7 × L` mm, checks edge/hinge residuals, and derives M/V labels from measured ordered face normals.

The SVG uses the same flat coordinates with explicit mm width/height and viewBox values. It contains `boundary`, `mountain`, `valley`, and `labels` layers, exact source metadata, and a 10 mm scale bar.

Collision status is deliberately limited to deterministic zero-thickness sampling: 161 q values for each branch, plus the current scrubbed state when needed. A sampled clear result is not a proof of continuous collision freedom or physical clearance. The UI also calls out thickness, crease radius, scoring damage, friction, gravity, hand interference, browser behavior, and human paper folding as unverified.

Pinned contract artifact hashes are recorded in the private root decision; this repository keeps only the concise model boundary and its implementation tests. Three representative paper folds and browser/device checks remain open before any full-v1 or physical-readiness claim.

The ordinary source publication is separate from the private Foldline Site package. Site version 1 is saved but undeployed while browser verification remains pending. Public source publication does not change the accepted geometry, residual gates, sampled-collision scope, or physical-fold limitations.
