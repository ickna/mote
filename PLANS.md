# Mote — Feature Plan (Phase 2+)

SVG-to-particle engine. Canvas 2D, zero dependencies.

## Phase 2.0 — Foundation Fixes

**Goal:** Fix bugs and wire unused params before adding features.

- [ ] Fix `renderPathsDirect` — add `<rect>`, `<ellipse>`, `<polygon>`, `<polyline>`, `<line>` handlers
- [ ] Fix transform stacking — apply parent `g[transform]` after SVG-to-canvas scale, not before
- [ ] Wire `zDispersion` param — replace hardcoded `tz` formula in `sample()`
- [ ] Wire `sizeMin`/`sizeMax` params — replace hardcoded size in particle generation
- [ ] Remove `setInterval` crutch — self-healing `requestAnimationFrame` loop
- [ ] Wire `sizeMin`/`sizeMax` in `frame()` — read from params instead of `pt.size`

## Phase 2.1 — Rendering Modes

**Goal:** Multiple visual modes switchable in editor, serialized in presets.

- [ ] Create render mode registry (`dots`, `lines`, `triangles`, `glow`)
- [ ] Add `renderMode` param, dropdown in editor UI
- [ ] Lines mode: spatial-grid distance threshold, cap at 200 connections/frame
- [ ] Triangles mode: incremental Delaunay, cache edges, recompute every 30 frames
- [ ] Glow mode: pre-rendered radial gradient canvases, `drawImage` per particle
- [ ] Trails mode: semi-transparent overlay instead of `clearRect`

## Phase 2.2 — SVG Import Expansion

**Goal:** Handle all common SVG elements found in real-world SVGs.

- [ ] Single `renderElement(ctx, el)` dispatch for all element types
- [ ] `<rect>` with optional `rx`/`ry`
- [ ] `<ellipse>`
- [ ] `<polygon>` / `<polyline>` — parse `points` attribute
- [ ] `<line>`
- [ ] Handle `translate`, `rotate`, `scale`, `skewX`, `skewY` transforms (not just `matrix()`)

## Phase 2.3 — Color Palettes & Gradients

**Goal:** Beyond single-color particles.

- [ ] Dual-color mode (primary + secondary pickers)
- [ ] Color interpolation: z-depth, position, or phase-based
- [ ] Palette presets (array of hex colors)
- [ ] Per-particle gradient rendering (radial gradient tinted to particle color)

## Phase 2.4 — Preset Transitions

**Goal:** Smooth visual transitions when switching presets.

- [ ] Approach A: Spring interpolation — find nearest old particle, carry velocity to new target
- [ ] Approach B: Crossfade — old particles fade out, new particles fade in
- [ ] `transitionDuration` param (500–3000ms)
- [ ] `transitionState` object in render loop

## Phase 2.5 — Timeline / Auto-Preset Cycling

**Goal:** Automated preset cycling for CasparCG / kiosk.

- [ ] "Timeline" tab in editor panel
- [ ] Playlist format: `[{name, duration, transition}]`
- [ ] Play/pause/stop controls
- [ ] Auto-cycling in playback mode via `?mode=play&preset=playlist.json`

## Phase 2.6 — CasparCG & Kiosk Optimization

**Goal:** Production-ready for live event use.

- [ ] Throttle via `?fps=30` parameter
- [ ] `?hideOverlay` — suppress player text
- [ ] PWA/standalone detection
- [ ] Memory leak audit — cancel rAF on page hide
- [ ] Verify CEF `file://` fetch behavior

## Phase 2.7 — CLI Tool

**Goal:** Generate presets from SVG files server-side.

- [ ] Node.js CLI with `jsdom` + offscreen canvas
- [ ] Or Python CLI with `cairosvg` + `Pillow`
- [ ] `mote preset --svg logo.svg --output preset.json`
- [ ] `mote export --preset preset.json --output player.html`