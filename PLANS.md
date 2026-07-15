# Mote — Feature Plan

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

- [x] Crossfade: old particles fade out, new particles fade in
- [x] `transitionDuration` param (500–3000ms)
- [x] `transitionState` object in render loop

## Phase 2.7 — Drag Rotation + Starfield

**Goal:** Mouse/touch drag rotation, parallax starfield background.

- [x] Drag rotation: click-drag to rotate yaw/pitch, tap to toggle auto-rotation
- [x] Starfield: two-layer parallax stars that respond to rotation angle
- [x] `starfieldEnabled` toggle in editor UI, serialized in presets

## Phase 2.8 — Fire/Ice Thermal System

**Goal:** Cellular automata flame propagation with temperature-based rendering.

- [x] `flame` param on each particle (positive = fire, negative = ice)
- [x] Edge particle propagation: fire spreads to neighbors, ice cools them
- [x] Main particle propagation: random spread to nearby particles
- [x] Temperature-based rendering: fire = red→orange→yellow→white, ice = blue→white
- [x] Halo size/alpha varies with temperature
- [x] `=` key spawns ice, `\` key spawns fire at random edge particle
- [x] Toggle in editor UI, serialized in presets

## Phase 2.9 — Nebula Background + Glow Texture

**Goal:** Background gas cloud and per-particle glow texture.

- [ ] *(skipped — not in scope)*

## Phase 2.10 — Edge-to-Main Connection Lines

**Goal:** Lines from edge particles to nearby main particles.

- [x] Screen-space distance threshold (180px)
- [x] Up to 6 nearest main particles per edge particle
- [x] Alpha fades with distance
- [x] Toggle in editor UI, serialized in presets

## Phase 2.11 — Timeline / Auto-Preset Cycling

**Goal:** Automated preset cycling for CasparCG / kiosk.

- [x] "Timeline" tab in editor panel
- [x] Playlist format: `[{name, duration, transition}]`
- [x] Play/pause/stop controls
- [x] Auto-cycling in playback mode via timer

## Phase 2.12 — CasparCG & Kiosk Optimization

**Goal:** Production-ready for live event use.

- [x] Throttle via `?fps=30` parameter
- [x] `?hideOverlay` — suppress player text
- [x] PWA/standalone detection
- [x] Memory leak audit — cancel rAF on page hide
- [x] Verify CEF `file://` fetch behavior

## Phase 2.13 — CLI Tool

**Goal:** Generate presets from SVG files server-side.

- [x] Python CLI with `cairosvg` + `Pillow`
- [x] `mote preset --svg logo.svg --output preset.json`
- [x] `mote export --preset preset.json --output player.html`

## Phase 3.0 — Landing Page Effects Port

**Goal:** Port signature effects from ickna.com landing page into Mote.

- [x] Option C flame color spectrum (`getFlameColor`) — fire: red→orange→gold→white, ice: white→blue→violet→red
- [x] Chain lightning — neighbor-graph BFS propagation with zigzag bolt arcs
- [x] Guided bolt — greedy-walk pathfinding with branches and progressive draw
- [x] Lightning rendering — bolt arcs, edge particle flashes, guided paths with strobe
- [x] Keyboard wiring (`-` chain, `0` guided), `lightningEnabled` param
- [x] `lightning: 0` initialized on all particles + edge particles

## Phase 3.1 — Ickna Profile (1:1 Landing Page Pipeline)

**Goal:** Recreate landing page rendering exactly as a profile mode.

- [x] `frameIckna()` — exact landing page math (AM waves, lerp motion, applyRotYawPitch, depth fade, size calc)
- [x] Full rendering pipeline: clear→stars→trail→edgeLines→core→glowTex→tempTint→sparkles→edgeShimmer→lightning
- [x] `glowTex` pre-rendered radial gradient (drawImage, not canvas shadowBlur)
- [x] `sampleIckna()` — spacing=10, circular spawn, pow-weighted size, ±3px jitter
- [x] Edge particle coordinate fix — transform through SVG group matrix to logoCanvas space
- [x] Wave nodes transformed to logoCanvas space
- [x] Edge sparkle update (24% activation, 0.04 decay)

## Phase 3.2 — GUI Controls (Landing Page Parity)

**Goal:** Playback menu + editor effect buttons + smart UI.

- [x] Hamburger menu (☰) in playback mode — Ice/Fire/Lightning with toggle + rate slider
- [x] `triggerAction()`, `processButtons()`, auto-repeat system
- [x] `processButtons()` called from frame loop
- [x] 5-second rotation delay on startup (settle-in moment)
- [x] 3-second loading fallback timeout
- [x] Editor FX buttons (❄️ Ice, 🔥 Fire, ⚡ Bolt)
- [x] Drag rotation disabled when menu open

## Phase 3.3 — Unified Renderer

**Goal:** Merge frameIckna() and frame() into a single parametrized pipeline.

- [x] New params: motionMode, lerpSpeed, waveMode, autoPitch, sizeScale, glowMode, depthFadeMode, trailAlpha, starfieldEnabled, edgeLineAlpha
- [x] Removed: profile, trails(bool), edgeShimmer(bool), edgeLines(bool), starfield(bool)
- [x] Single `frame()` function — ickna look is default, all aspects parametrized
- [x] `renderMode: 'ickna'` uses full pipeline; dots/lines/triangles/glow use old dispatch
- [x] Preset migration in `applyParams()` for backwards compat
- [x] Speed interpolation (yawSpd/pitchSpd persistent variables)

## Phase 3.4 — Export Convergence

**Goal:** Editor-exported HTML and CLI-exported HTML use the same unified engine as the editor's playback mode.

- [x] `triggerAction()` now sets `flameEnabled`/`lightningEnabled`
- [x] `downloadBlob()` — fixed `revokeObjectURL` argument (Blob→URL string)
- [x] "Depth Fade" duplicate label renamed to "DF Amount"
- [x] Removed dead `MoteSVG.sample()` (~40 lines)
- [x] Preset migration: old param names converted to new schema
- [x] CLI DEFAULT_PARAMS dict updated to unified schema
- [x] Exported playback HTML (`exportPlaybackHTML()`) — rewrite with unified engine
- [x] CLI `mote export` player — rewrite with unified engine
- [x] ickna.json preset — migrate to unified param schema

## Phase 3.5 — Parameter Animation / Keyframes

**Goal:** Parameter values can be animated over time — scale ramps up, rotation speeds vary, colors shift — using keyframe curves embedded in presets.

- [x] `anim` key in preset JSON: `{ "anim": { "scale": { "keyframes": [[0, 0.3], [3000, 1.0]], "loop": true } } }`
- [x] `Animator` module: linear lerp between keyframes, configurable easing
- [x] `runtimeParams` object shadows `params` during render loop
- [x] Animation tab in editor: keyframe editor with timeline
- [x] Serialize `anim` block into `getPreset()`
- [x] Export playback HTML — include Animator in embedded engine

## Phase 3.6 — Remote Control API

**Goal:** CasparCG/automation control via WebSocket or OSC. Switch presets, adjust params, trigger effects.

- [x] `?ws=8080` param — connect to WebSocket server
- [x] Control message protocol: `{cmd: "preset"|"param"|"effect"|"play"|"stop", ...}`
- [x] OSC message parsing for lighting console integration
- [x] `control-server.js` — standalone Node.js relay (zero dependencies)
- [x] Graceful degradation: no server = normal playback
- [x] Connection indicator (green/red dot), auto-reconnect

## Phase 3.7 — Post-Processing / Bloom

**Goal:** GPU-based bloom, color grading, and vignette for broadcast-ready polish.

- [ ] Offscreen renderCanvas at 0.5× for performance
- [x] Bloom: additive blend with blur filter
- [x] Vignette: radial gradient overlay
- [x] Color grade presets
- [x] `bloom`, `vignette`, `colorGrade` params serialized in presets
- [x] CLI/Export: include post-processing engine

## Phase 3.8 — Audio Reactivity

**Goal:** Particles pulse, rotate, and color-shift in response to microphone/audio input.

- [x] `AudioReactivity` class with AnalyserNode
- [x] Bass/mid/treble extraction from FFT bins
- [x] `audioEnabled` toggle, `audioSource` selector, `audioImpact` slider
- [x] Param modulation: waveAmp × bass, yawSpeed × mid, glowBlur × treble
- [x] Beat detection for one-shot bursts (edge sparkle flash)
- [x] `?audio=mic` / `?audio=source.mp3` URL params
- [x] Audio meter visualization in editor panel

## Phase 3.9 — Multi-Layer / Composite Presets

**Goal:** Overlay multiple SVGs/images as separate particle layers, each with its own params.

- [x] `layers` array in preset format
- [x] Backwards compat: single-layer presets auto-convert to `layers: [{...}]`
- [x] Engine renders layers in z-order, each with own rotation/params
- [x] Editor layer management: add/remove/reorder, select active layer (JSON-based)
- [ ] Layer-aware transitions

## Phase 3.10 — Image Source

**Goal:** Load JPEG/PNG images in addition to SVGs. Sample particles from image alpha or luminance.

- [ ] File input accepting `.png`, `.jpg`, `.jpeg`
- [ ] `sourceType: 'svg' | 'image'` in preset, store image as base64 data URI
- [ ] CLI `--image` flag for preset generation from raster images
- [ ] Luminance threshold for opaque images

## Phase 3.11 — CasparCG Producer Integrations

**Goal:** Deeper CasparCG integration: multi-window, chroma key, template deployment.

- [ ] `?windowId=N` — multi-monitor positioning
- [ ] `?fullscreen=true` — force fullscreen API
- [ ] `?bgcolor=#000` — background color override for chroma key
- [ ] Document CasparCG workflow in README