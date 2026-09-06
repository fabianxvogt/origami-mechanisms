# Foldline — Origami Mechanisms

Foldline is a browser-first explorer for one constrained folding family: a single-vertex Miura cell. It helps a maker tune α, L, branch, and q, inspect normal-derived mountain/valley assignments, scrub the rigid-hinge motion, save variants, reopen them, and export the same flat coordinates as an SVG in millimetres.

## Honest status

The accepted analytic scope is one Euclidean degree-4 vertex with sector tuple `(α, α, π−α, π−α)`, α 25–65°, L 30–120 mm, branch ±1, and q 0–160°. The 3D panels, hinge angles, and SVG all derive from the same source coordinates. Rotation closure is gated at `1e-7` matrix units and position closure at `1e-7 × L` mm; collision status is sampled over 322 zero-thickness states across both branches. No continuous-collision, thick-paper, device, human-fold, or full-v1 release claim is made.

## Use locally

```sh
npm test
npm run build
python3 -m http.server 48112 -d .
```

Open `http://localhost:48112`. The app uses no network calls, account, or external assets. Saved variants stay in local browser storage; project JSON and SVG exports are downloadable.

## Workflow covered

- Load an example, edit α/L/branch/q, scrub or play a preview capped at 160°, and see explicit invalid-state messages.
- Undo/redo edits, with Escape/Cancel/Undo recovery around draft replacement.
- Save variants locally through an accessible in-app name field with explicit Save/Cancel controls, reopen them, and export/import versioned JSON with a 1 MB size check, malformed-file handling, unsupported-version handling, legacy-draft recovery, and blocked-storage fallback. Playback is preview-only and never dirties the saved q; a manual q edit does.
- Export a contract-derived SVG with boundary/mountain/valley/labels layers, metadata, mm units, and a 10 mm scale bar; inspect a separate folded reference view plus three-step assembly guidance.

## Evidence limits

The geometry, model, SVG, motion-loop, app-wiring, and production DOM-wiring tests cover contract bounds, separate rotation/position closure gates, rigid edge/hinge residuals, sampled collision classification, versioned round trips, SVG layers/metadata, timer cleanup, preview-only motion ownership, preview-cancel repaint, recovery-safe imports, and actual indexed SVG IDs through render and Save completion. The c241 browser evidence also confirms four nonzero 3D creases at q=77°/+1 and q=101°/−1, readable labels, populated-library empty-state hiding, and bounded 390px controls. These checks do not prove continuous collision freedom, thick-paper behavior, physical hinge clearance, successful paper folds, device behavior, human readability, performance, or full-v1 acceptance.

## Release status

The bounded public product source is `c241d1d8937e552e5ae07f66ad63757f9fac33d5`; its reviewed ordinary source/docs are published on `fabianxvogt/origami-mechanisms` main. Foldline Site version 4 is publicly deployed at https://foldline-origami-mechanisms.fabian523417.chatgpt.site. Core Save/button/Enter/reload/Reopen/project/SVG/import/error-retention evidence and the c241 display browser gate passed. This remains a bounded preview: sampled zero-thickness collision status is the only collision evidence, and no physical-fold, continuous-collision, device, human, performance, or full-v1 claim is made.
