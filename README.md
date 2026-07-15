# Mote

SVG-to-particle engine. Canvas 2D, zero dependencies. Two modes: editor with live controls and playback for CasparCG / kiosk.

## Quick Start

**Editor mode** (default):
```
open mote.html
```

**Playback mode** (embedded ickna preset):
```
open mote.html?mode=play&preset=ickna
```

**Playback from JSON file** (must be same-origin):
```
open mote.html?mode=play&preset=presets/ickna.json
```

## CasparCG Integration

### Load in CasparCG HTML Producer

```
PLAY 1-10 HTML [path]/mote.html?mode=play&preset=presets/ickna.json
```

Or use a self-contained exported HTML (no server needed, works off `file://`). Export from the editor via the **Export HTML** button.

### CasparCG URL Parameters

| Parameter | Example | Description |
|-----------|---------|-------------|
| `?mode=play` | `?mode=play` | Enable playback mode (no editor UI) |
| `?preset=` | `?preset=presets/ickna.json` | Load preset from JSON file path |
| `?fps=` | `?fps=30` | Throttle frame rate for CEF rendering |
| `?hideOverlay` | `?hideOverlay` | Suppress preset name text overlay |
| `?bgcolor=` | `?bgcolor=#00ff00` | Background color override (chroma key green) |
| `?fullscreen=` | `?fullscreen=1` | Auto-enter fullscreen on load |
| `?ws=` | `?ws=8080` | Connect to WebSocket control server |
| `?audio=` | `?audio=mic` | Auto-initialize audio reactivity |

### Chroma Key Setup

For green-screen compositing in CasparCG, use the `?bgcolor=` parameter to match your chroma key color:

```
PLAY 1-10 HTML [path]/mote.html?mode=play&preset=ickna&bgcolor=#00ff00&hideOverlay
```

This sets the page background to green, and the canvas renders transparently over it. Key out the green in CasparCG for a clean composite.

### Fullscreen Kiosk

```
PLAY 1-10 HTML [path]/mote.html?mode=play&fullscreen=1
```

### Remote Control

Run the control server:
```bash
node control-server.js --port 8080
```

Load in browser with `?ws=8080`, then control from CasparCG AMCP or REST:
```bash
# Switch preset
curl -X POST http://localhost:8080/preset -d '{"name":"ickna"}'

# Change a parameter
curl -X POST http://localhost:8080/param -d '{"key":"scale","value":0.5}'

# Trigger an effect
curl -X POST http://localhost:8080/effect -d '{"type":"fire"}'
```

OSC support is available via the control server's optional `--osc-port` flag.

## Kiosk Mode

```bash
chromium --kiosk --noerrdialogs --disable-infobars mote.html?mode=play&preset=ickna
```

For touch-screen kiosks, `?mode=play` + `?hideOverlay` gives a clean fullscreen experience with drag-to-rotate and tap-to-toggle-auto-rotation.

## Project Structure

```
mote/
├── mote.html            # Single-file app (editor + player)
├── mote-cli.py          # CLI: preset generation + HTML export
├── control-server.js    # WebSocket relay for remote control
├── presets/
│   └── ickna.json       # Default preset
├── PLANS.md             # Feature roadmap
└── README.md
```

## CLI Usage

```bash
# Generate preset from SVG
python3 mote-cli.py preset --svg logo.svg --output preset.json

# Generate preset from image
python3 mote-cli.py preset --svg photo.png --image --output preset.json

# Export self-contained playback HTML
python3 mote-cli.py export --preset preset.json --output player.html
```

## Features

- **5 render modes**: ickna (full pipeline), dots, connected lines, triangles, glow field
- **3D rotation**: autonomous yaw/pitch with drag interaction
- **Effects**: edge shimmer, fire/ice thermal propagation, chain lightning, starfield, trails
- **Post-processing**: bloom, vignette, color grading (warm/cool/dramatic)
- **Parameter animation**: keyframe-based anim curves with easing
- **Audio reactivity**: microphone/audio element input drives wave, rotation, glow
- **Multi-layer**: composite multiple SVG/image layers with per-layer params
- **Image import**: load PNG/JPG and sample particles from raster data
- **Remote control**: WebSocket + REST + OSC for CasparCG/lighting console integration
- **Export**: self-contained playback HTML from editor or CLI
- **Timeline**: auto-cycling playlist for unattended playback

## Browser Support

Targets Chromium (CEF) for CasparCG. File:// protocol tested. Canvas 2D with filter API for bloom. WebSocket, AudioContext, and Fullscreen API with fallbacks.