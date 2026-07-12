# Mote

SVG-to-particle engine. Canvas 2D, zero dependencies. Two modes: editor with live controls and playback for CasparCG / kiosk.

## Usage

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

Load in HTML producer:
```
HTML <path>/mote.html?mode=play&preset=ickna
```

Or export a self-contained playback HTML from the editor (Export HTML button) — no server needed, works off `file://`.

## Kiosk Mode

```
chromium --kiosk --noerrdialogs --disable-infobars mote.html?mode=play&preset=ickna
```

## Project Structure

```
mote/
├── mote.html            # Single-file app (editor + player)
├── presets/
│   └── ickna.json       # Default preset
└── README.md
```

## Preset Format

Export as `.json` from the editor, or author manually:

```json
{
  "name": "my-shape",
  "version": 1,
  "svg": "<svg>...</svg>",
  "params": {
    "yawSpeed": 0.5,
    "pitchSpeed": 0.3,
    "spacing": 20,
    "spring": 0.05,
    "damping": 0.88,
    "waveAmp": 12,
    "waveFreq": 0.002,
    "sizeMin": 1.5,
    "sizeMax": 7.5,
    "glowBlur": 3,
    "depthFade": 0.6,
    "color": "#e03030",
    "scale": 0.80
  }
}
```

## SVG Import

Drag-and-drop or click to browse. Supports `<path>`, `<circle>`, `<rect>`, `<ellipse>`, `<polygon>`, `<polyline>` with `viewBox` and `matrix()` transforms.