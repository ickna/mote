# Mote — Feature Plan (Phase 2+)

SVG-to-particle engine. Canvas 2D, zero dependencies.

## Phase 2.0 — Foundation Fixes

**Goal:** Fix bugs and wire unused params before adding features.

- [x] Fix `renderPathsDirect` — add `<rect>`, `<ellipse>`, `<polygon>`, `<polyline>`, `<line>` handlers
- [x] Fix transform stacking — apply parent `g[transform]` after SVG-to-canvas scale, not before
- [x] Wire `zDispersion` param — replace hardcoded `tz` formula in `sample()`
- [x] Wire `sizeMin`/`sizeMax` params — replace hardcoded size in particle generation
- [x] Remove `setInterval` crutch — self-healing `requestAnimationFrame` loop
- [x] Wire `sizeMin`/`sizeMax` in `frame()` — read from params instead of `pt.size`

## Phase 2.1 — Rendering Modes

**Goal:** Multiple visual modes switchable in editor, serialized in presets.

- [x] Create render mode registry (`dots`, `lines`, `triangles`, `glow`)
- [x] Add `renderMode` param, dropdown in editor UI
- [x] Lines mode: spatial-grid distance threshold, cap at 200 connections/frame
- [x] Triangles mode: nearest-neighbor triangulation, cache edges, recompute every 500ms
- [x] Glow mode: pre-rendered radial gradient canvases, `drawImage` per particle
- [x] Trails mode: semi-transparent overlay instead of `clearRect`

## Phase 2.2 — SVG Import Expansion

**Goal:** Handle all common SVG elements found in real-world SVGs.

- [x] Single `renderElement(ctx, el)` dispatch for all element types
- [x] `<rect>` with optional `rx`/`ry`
- [x] `<ellipse>`
- [x] `<polygon>` / `<polyline>` — parse `points` attribute
- [x] `<line>`
- [x] Handle `translate`, `rotate`, `scale`, `skewX`, `skewY` transforms (not just `matrix()`)

## Phase 2.3 — Color Palettes & Gradients

**Goal:** Beyond single-color particles.

- [x] Dual-color mode (primary + secondary pickers)
- [x] Color interpolation: z-depth, position, or phase-based
- [x] Palette presets (array of hex colors)
- [x] Per-particle gradient rendering (radial gradient tinted to particle color)

## Phase 2.4 — Engine Polish (from landing page audit)

**Goal:** Shape-aware depth, breathing particles, convergence fade, wave cycling, keyboard controls.

- [x] Edge-distance depth: compute edge particles from SVG, store `edgeDist` per particle, use animated sine wave for tz (interior bulges, edges flat)
- [x] Convergence fade-in: `convergeAlpha` based on distance from target position — smooth initial settling
- [x] Size pulse: `sizePulse = 1.4 + 0.4 * sin(t * freq + phase)` — particles breathe
- [x] Wave origin cycling: cycle through logo geometry nodes for wave origin
- [x] Keyboard controls: arrow keys for manual rotation, `/` to toggle auto-yaw

## Phase 2.5 — Edge Shimmer

**Goal:** Edge particles with sparkle/shine along the logo outline.

- [x] Edge particle sampling: detect outline pixels from SVG, store as separate layer
- [x] Sparkle system: random flare probability, bright white dot + glow
- [x] Edge-to-main connection lines (optional layer)
- [x] Toggle in editor UI, serialized in presets

## Phase 2.6 — Preset Transitions

**Goal:** Smooth visual transitions when switching presets.

- [x] Approach A: Spring interpolation — find nearest old particle, carry velocity to new target
- [x] Approach B: Crossfade — old particles fade out, new particles fade in
- [x] `transitionDuration` param (500–3000ms)
- [x] `transitionState` object in render loop

## Phase 2.7 — Timeline / Auto-Preset Cycling

**Goal:** Automated preset cycling for CasparCG / kiosk.

- [ ] "Timeline" tab in editor panel
- [ ] Playlist format: `[{name, duration, transition}]`
- [ ] Play/pause/stop controls
- [ ] Auto-cycling in playback mode via `?mode=play&preset=playlist.json`

## Phase 2.8 — CasparCG & Kiosk Optimization

**Goal:** Production-ready for live event use.

- [ ] Throttle via `?fps=30` parameter
- [ ] `?hideOverlay` — suppress player text
- [ ] PWA/standalone detection
- [ ] Memory leak audit — cancel rAF on page hide
- [ ] Verify CEF `file://` fetch behavior

## Phase 2.9 — CLI Tool

**Goal:** Generate presets from SVG files server-side.

- [ ] Node.js CLI with `jsdom` + offscreen canvas
- [ ] Or Python CLI with `cairosvg` + `Pillow`
- [ ] `mote preset --svg logo.svg --output preset.json`
- [ ] `mote export --preset preset.json --output player.html`