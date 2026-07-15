#!/usr/bin/env python3
"""Mote CLI — generate presets from SVG files, export playback HTML.

Usage:
  python3 mote-cli.py preset --svg logo.svg --output preset.json
  python3 mote-cli.py preset --svg logo.svg --params '{"color":"#e03030"}' --output preset.json
  python3 mote-cli.py export --preset preset.json --output player.html
"""

import argparse
import json
import os
import sys
import math
import base64

try:
    import cairosvg
except ImportError:
    cairosvg = None

try:
    from PIL import Image
except ImportError:
    Image = None


DEFAULT_PARAMS = {
    "yawSpeed": 0.5,
    "pitchSpeed": 0.3,
    "yawAmp": 0.262,
    "pitchAmp": 0.08,
    "autoPitch": False,
    "spacing": 10,
    "motionMode": "lerp",
    "lerpSpeed": 0.08,
    "spring": 0.05,
    "damping": 0.88,
    "waveMode": "am",
    "waveAmp": 12,
    "waveFreq": 0.002,
    "zDispersion": 60,
    "sizeMin": 1.5,
    "sizeMax": 7.5,
    "sizeScale": 0.48,
    "glowMode": "texture",
    "glowBlur": 3,
    "depthFadeMode": "ickna",
    "depthFade": 0.6,
    "color": "#e03030",
    "colorSecondary": "#7b2ff7",
    "colorMode": "solid",
    "scale": 0.90,
    "renderMode": "ickna",
    "starfieldEnabled": True,
    "trailAlpha": 0.34,
    "flameEnabled": False,
    "lightningEnabled": False,
    "edgeLineAlpha": 0.1,
    "transitionDuration": 800,
    "lineThreshold": 60
}


def svg_to_png(svg_path, output_width=1000):
    """Render SVG to PNG bytes using cairosvg."""
    if cairosvg is None:
        sys.exit("Error: cairosvg is required. Install: pip install cairosvg")

    with open(svg_path, 'rb') as f:
        svg_data = f.read()

    # Parse viewBox to get aspect ratio
    import re
    vb_match = re.search(rb'viewBox=["\']([\d\s.,]+)["\']', svg_data)
    if vb_match:
        parts = vb_match.group(1).split()
        svg_w = float(parts[2])
        svg_h = float(parts[3])
        output_height = int(output_width * svg_h / svg_w)
    else:
        output_height = int(output_width * 0.75)  # fallback 4:3

    png_data = cairosvg.svg2png(
        bytestring=svg_data,
        output_width=output_width,
        output_height=output_height
    )
    return png_data


def sample_particles(png_data, spacing, params):
    """Sample particles from PNG pixel data."""
    if Image is None:
        sys.exit("Error: Pillow is required. Install: pip install Pillow")

    img = Image.open(io.BytesIO(png_data)).convert('RGBA')
    w, h = img.size
    pixels = img.load()

    particles = []
    z_disp = params.get('zDispersion', 60)
    size_min = params.get('sizeMin', 1.5)
    size_max = params.get('sizeMax', 7.5)
    scatter = 300
    z_spread = 100

    cols = math.ceil(w / spacing)
    rows = math.ceil(h / spacing)

    for gy in range(rows):
        for gx in range(cols):
            px = min(int(gx * spacing + spacing / 2), w - 1)
            py = min(int(gy * spacing + spacing / 2), h - 1)
            r, g, b, a = pixels[px, py]
            if a > 30:
                nx = (px / w) * 2 - 1
                ny = (py / h) * 2 - 1
                tz = z_disp * math.sin(nx * math.pi * 0.8) * math.cos(ny * math.pi * 0.6) \
                     + (z_disp / 2) * math.sin(px * 0.03) * math.cos(py * 0.04)
                particles.append({
                    "tx": px, "ty": py, "tz": round(tz, 2),
                    "size": round(size_min + random.random() * (size_max - size_min), 2),
                    "phase": round(random.random() * math.pi * 2, 4)
                })

    return particles


def generate_preset(svg_path, output_path, params_override=None):
    """Generate a Mote preset JSON file from an SVG."""
    params = dict(DEFAULT_PARAMS)
    if params_override:
        params.update(params_override)

    svg_name = os.path.splitext(os.path.basename(svg_path))[0]

    with open(svg_path, 'r') as f:
        svg_content = f.read()

    preset = {
        "name": svg_name,
        "version": 1,
        "svg": svg_content,
        "params": params
    }

    with open(output_path, 'w') as f:
        json.dump(preset, f, indent=2)

    print(f"Preset saved to {output_path}")
    print(f"  Name: {svg_name}")
    print(f"  SVG: {os.path.getsize(svg_path)} bytes")
    print(f"  Params: {len(params)} parameters")


def export_playback(preset_path, output_path):
    """Generate a self-contained playback HTML from a preset JSON using the full unified engine."""
    with open(preset_path, 'r') as f:
        preset = json.load(f)

    preset_json = json.dumps(preset, indent=2)
    preset_name = preset.get('name', 'mote-playback')

    html = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<title>Mote — __PRESET_NAME__</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html,body{width:100%;height:100%;overflow:hidden;background:#06060e}
canvas{display:block;width:100%;height:100%}
#loading{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;z-index:100;background:#06060e;transition:opacity .6s ease;pointer-events:none}
#loading.hidden{opacity:0}
#loading .dot{width:6px;height:6px;margin:0 4px;border-radius:50%;background:#e03030;animation:loadPulse 1.2s ease-in-out infinite}
#loading .dot:nth-child(2){animation-delay:.2s}
#loading .dot:nth-child(3){animation-delay:.4s}
@keyframes loadPulse{0%,100%{opacity:.2;transform:scale(1)}50%{opacity:1;transform:scale(1.5)}}
#pmenu{position:fixed;bottom:12px;left:12px;z-index:60;font-family:'Inter',system-ui,sans-serif}
#pmenu-btn{width:54px;height:54px;border:none;background:rgba(255,255,255,.06);color:rgba(255,255,255,.35);border-radius:12px;font-size:28px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .3s;backdrop-filter:blur(4px)}
#pmenu-btn:hover,#pmenu-btn:active{background:rgba(255,255,255,.12);color:rgba(255,255,255,.7)}
#pmenu-items{display:none;flex-direction:column;gap:6px;margin-top:6px;padding:12px;background:rgba(6,6,14,.85);border:1px solid rgba(255,255,255,.08);border-radius:14px;backdrop-filter:blur(8px);min-width:260px}
#pmenu-items.open{display:flex}
.pmenu-row{display:flex;align-items:center;gap:10px;padding:6px 8px;border-radius:8px;cursor:pointer;transition:all .2s}
.pmenu-row:hover{background:rgba(255,255,255,.04)}
.pmenu-label{color:rgba(255,255,255,.7);font-size:18px;font-weight:500;flex:1;cursor:pointer;user-select:none;padding:6px 0}
.pmenu-toggle{position:relative;width:42px;height:24px;flex-shrink:0;cursor:pointer}
.pmenu-toggle input{opacity:0;width:0;height:0}
.pmenu-toggle span{position:absolute;inset:0;background:rgba(255,255,255,.12);border-radius:12px;transition:all .3s}
.pmenu-toggle span::before{content:'';position:absolute;width:18px;height:18px;left:3px;top:3px;background:rgba(255,255,255,.35);border-radius:50%;transition:all .3s}
.pmenu-toggle input:checked+span{background:rgba(224,48,48,.5)}
.pmenu-toggle input:checked+span::before{left:21px;background:#fff}
.rate-slider{width:80px;height:5px;flex-shrink:0;-webkit-appearance:none;appearance:none;background:rgba(255,255,255,.15);border-radius:3px;outline:none;cursor:pointer}
.rate-slider::-webkit-slider-thumb{-webkit-appearance:none;width:14px;height:14px;border-radius:50%;background:rgba(255,255,255,.5);cursor:pointer}
</style>
</head>
<body>
<canvas id="c"></canvas>
<div id="loading"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>
<div id="pmenu">
  <button id="pmenu-btn">☰</button>
  <div id="pmenu-items">
    <div class="pmenu-row" data-action="ice">
      <span class="pmenu-label">❄️ Ice</span>
      <label class="pmenu-toggle"><input type="checkbox"><span></span></label>
      <input type="range" class="rate-slider" min="1" max="30" value="15">
    </div>
    <div class="pmenu-row" data-action="fire">
      <span class="pmenu-label">🔥 Fire</span>
      <label class="pmenu-toggle"><input type="checkbox"><span></span></label>
      <input type="range" class="rate-slider" min="1" max="30" value="15">
    </div>
    <div class="pmenu-row" data-action="lightning">
      <span class="pmenu-label">⚡ Lightning</span>
      <label class="pmenu-toggle"><input type="checkbox"><span></span></label>
      <input type="range" class="rate-slider" min="1" max="30" value="15">
    </div>
  </div>
</div>
<script>
const PRESET = __PRESET_JSON__;
const FOCAL = 900;
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let W, H, DPR, logoCanvas, particles = [], edgeParticles = [], waveNodes = [], animId;
let yawAngle = 0, pitchAngle = 0, yawSpd = 0, pitchSpd = 0;
let yRotEnabled = false;
const keys = {};
let lightningQueue = [], lightningBolts = [], lightningPaths = [];
let animStartTime = 0;

// White glow texture — tinted at draw time via source-atop
const glowTex = (() => {
  const s = 48;
  const c = document.createElement('canvas');
  c.width = s * 2; c.height = s * 2;
  const t = c.getContext('2d');
  const g = t.createRadialGradient(s, s, 0, s, s, s);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.2, 'rgba(255,255,255,0.7)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.2)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  t.fillStyle = g; t.fillRect(0, 0, s * 2, s * 2);
  return c;
})();

let stars = [];
function initStars() {
  const list = [];
  for (let layer = 0; layer < 2; layer++) {
    const count = 156 + layer * 78, depth = 0.3 + layer * 0.4;
    for (let i = 0; i < count; i++) list.push({ x: Math.random()*W, y: Math.random()*H, r: 0.3+Math.random()*(1.2-layer*0.4), a: 0.15+Math.random()*(0.55-layer*0.15), depth });
  }
  stars = list;
}
function drawStars() {
  ctx.fillStyle = '#ffffff';
  for (const s of stars) {
    const sx = (s.x + yawAngle*80*s.depth + W) % W, sy = (s.y + pitchAngle*60*s.depth + H) % H;
    ctx.globalAlpha = s.a; ctx.beginPath(); ctx.arc(sx, sy, s.r, 0, Math.PI*2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth; H = window.innerHeight;
  canvas.width = W*DPR; canvas.height = H*DPR;
  canvas.style.width = W+'px'; canvas.style.height = H+'px';
  ctx.setTransform(DPR,0,0,DPR,0,0); initStars();
}
window.addEventListener('resize', resize); resize();

// ── Color helpers ────────────────────────────────────────────
function hexToRgb(hex) {
  return { r: parseInt(hex.slice(1, 3), 16), g: parseInt(hex.slice(3, 5), 16), b: parseInt(hex.slice(5, 7), 16) };
}
function lerpRgb(rgb1, rgb2, t) {
  const t2 = Math.max(0, Math.min(1, t));
  return 'rgb(' + Math.round(rgb1.r + (rgb2.r - rgb1.r) * t2) + ',' + Math.round(rgb1.g + (rgb2.g - rgb1.g) * t2) + ',' + Math.round(rgb1.b + (rgb2.b - rgb1.b) * t2) + ')';
}
function getParticleColor(pt, p, rgb1, rgb2) {
  if (p.colorMode === 'solid' || !rgb2) return p.color;
  let t;
  switch (p.colorMode) {
    case 'gradient-z': t = (pt.z + 100) / 400; break;
    case 'gradient-position': t = ((pt.px + pt.py) / 800 + 0.5) % 1; break;
    case 'gradient-random': t = (pt.phase / (Math.PI * 2)); break;
    default: return p.color;
  }
  return lerpRgb(rgb1, rgb2, t);
}

// ── Animator ──────────────────────────────────────────────────
function lerpColor(c1, c2, tVal) {
  var r1 = parseInt(c1.slice(1, 3), 16), g1 = parseInt(c1.slice(3, 5), 16), b1 = parseInt(c1.slice(5, 7), 16);
  var r2 = parseInt(c2.slice(1, 3), 16), g2 = parseInt(c2.slice(3, 5), 16), b2 = parseInt(c2.slice(5, 7), 16);
  var rt = Math.round(r1 + (r2 - r1) * tVal), gt = Math.round(g1 + (g2 - g1) * tVal), bt = Math.round(b1 + (b2 - b1) * tVal);
  return '#' + rt.toString(16).padStart(2, '0') + gt.toString(16).padStart(2, '0') + bt.toString(16).padStart(2, '0');
}
function applyEasing(t, easing) {
  switch (easing) {
    case 'ease-in': return t * t;
    case 'ease-out': return 1 - (1 - t) * (1 - t);
    case 'ease-in-out': return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    default: return t;
  }
}
function animEvaluate(baseParams, animDef, elapsed) {
  if (!animDef || !Object.keys(animDef).length) return baseParams;
  var rp = {}, key;
  for (key in baseParams) rp[key] = baseParams[key];
  for (key in animDef) {
    var a = animDef[key];
    if (!a.keyframes || a.keyframes.length < 2) continue;
    var last = a.keyframes[a.keyframes.length - 1][0];
    var et = a.loop ? elapsed % last : Math.min(elapsed, last);
    var i = 0;
    while (i < a.keyframes.length - 1 && a.keyframes[i + 1][0] < et) i++;
    var t0 = a.keyframes[i][0], v0 = a.keyframes[i][1];
    var t1 = a.keyframes[i + 1][0], v1 = a.keyframes[i + 1][1];
    var raw = t1 > t0 ? Math.max(0, Math.min(1, (et - t0) / (t1 - t0))) : 0;
    var tVal = applyEasing(raw, a.easing || 'linear');
    if (typeof v0 === 'string' && v0[0] === '#') {
      rp[key] = lerpColor(v0, v1, tVal);
    } else {
      rp[key] = v0 + (v1 - v0) * tVal;
    }
  }
  return rp;
}

// ── Render Modes ─────────────────────────────────────────────
const RENDER_MODES = {
  dots: {
    name: 'Dots',
    draw(ctx, projected, p) {
      const rgb1 = hexToRgb(p.color);
      const rgb2 = p.colorSecondary && p.colorMode !== 'solid' ? hexToRgb(p.colorSecondary) : null;
      for (const pt of projected) {
        const c = getParticleColor(pt, p, rgb1, rgb2);
        ctx.fillStyle = c;
        ctx.shadowColor = c;
        ctx.shadowBlur = p.glowBlur;
        ctx.globalAlpha = Math.max(0.15, Math.min(1, pt.alpha));
        ctx.beginPath(); ctx.arc(pt.px, pt.py, pt.r, 0, Math.PI * 2); ctx.fill();
      }
    }
  },
  lines: {
    name: 'Connected Lines',
    draw(ctx, projected, p) {
      const threshold = p.lineThreshold || 60;
      const rgb1 = hexToRgb(p.color);
      const rgb2 = p.colorSecondary && p.colorMode !== 'solid' ? hexToRgb(p.colorSecondary) : null;
      const cellSize = threshold;
      const grid = new Map();
      for (let i = 0; i < projected.length; i++) {
        const pt = projected[i];
        const cx = Math.floor(pt.px / cellSize), cy = Math.floor(pt.py / cellSize);
        const key = cx + ',' + cy;
        if (!grid.has(key)) grid.set(key, []);
        grid.get(key).push(i);
      }
      // Draw dots
      ctx.shadowBlur = p.glowBlur;
      for (const pt of projected) {
        const c = getParticleColor(pt, p, rgb1, rgb2);
        ctx.fillStyle = c; ctx.shadowColor = c;
        ctx.globalAlpha = Math.max(0.15, Math.min(1, pt.alpha));
        ctx.beginPath(); ctx.arc(pt.px, pt.py, pt.r * 0.6, 0, Math.PI * 2); ctx.fill();
      }
      // Draw connections
      ctx.shadowBlur = 0; ctx.lineWidth = 0.5;
      let drawn = 0; const maxLines = 200; const seen = new Set();
      for (let i = 0; i < projected.length && drawn < maxLines; i++) {
        const a = projected[i];
        const cx = Math.floor(a.px / cellSize), cy = Math.floor(a.py / cellSize);
        for (let dx = -1; dx <= 1 && drawn < maxLines; dx++) {
          for (let dy = -1; dy <= 1 && drawn < maxLines; dy++) {
            const key = (cx + dx) + ',' + (cy + dy);
            const neighbors = grid.get(key);
            if (!neighbors) continue;
            for (const j of neighbors) {
              if (j <= i) continue;
              const edgeKey = i < j ? i + '-' + j : j + '-' + i;
              if (seen.has(edgeKey)) continue;
              seen.add(edgeKey);
              const b = projected[j];
              const dx2 = a.px - b.px, dy2 = a.py - b.py;
              const dist = Math.sqrt(dx2 * dx2 + dy2 * dy2);
              if (dist <= threshold) {
                const lineAlpha = Math.min(a.alpha, b.alpha) * 0.4;
                const midPt = { px: (a.px + b.px) / 2, py: (a.py + b.py) / 2, z: (a.z + b.z) / 2, phase: (a.phase + b.phase) / 2 };
                ctx.strokeStyle = getParticleColor(midPt, p, rgb1, rgb2);
                ctx.globalAlpha = lineAlpha;
                ctx.beginPath(); ctx.moveTo(a.px, a.py); ctx.lineTo(b.px, b.py); ctx.stroke();
                drawn++;
              }
            }
          }
        }
      }
    }
  },
  triangles: {
    name: 'Triangles',
    _lastFrame: 0, _edgeCache: null, _cacheKey: '',
    draw(ctx, projected, p, t) {
      const frameNum = Math.floor(t / 500);
      const cacheKey = frameNum + ':' + projected.length + ':' + (p.lineThreshold || 60);
      const rgb1 = hexToRgb(p.color);
      const rgb2 = p.colorSecondary && p.colorMode !== 'solid' ? hexToRgb(p.colorSecondary) : null;
      let edges;
      if (this._cacheKey === cacheKey && this._edgeCache) { edges = this._edgeCache; }
      else { edges = this._triangulate(projected, p.lineThreshold || 80); this._edgeCache = edges; this._cacheKey = cacheKey; }
      // Draw dots
      ctx.shadowBlur = p.glowBlur;
      for (const pt of projected) {
        const c = getParticleColor(pt, p, rgb1, rgb2);
        ctx.fillStyle = c; ctx.shadowColor = c;
        ctx.globalAlpha = Math.max(0.15, Math.min(1, pt.alpha));
        ctx.beginPath(); ctx.arc(pt.px, pt.py, pt.r * 0.5, 0, Math.PI * 2); ctx.fill();
      }
      // Draw mesh edges
      ctx.shadowBlur = 0; ctx.lineWidth = 0.5;
      for (let k = 0; k < edges.length; k += 2) {
        const i = edges[k], j = edges[k + 1];
        const a = projected[i], b = projected[j];
        const lineAlpha = Math.min(a.alpha, b.alpha) * 0.3;
        const midPt = { px: (a.px + b.px) / 2, py: (a.py + b.py) / 2, z: (a.z + b.z) / 2, phase: (a.phase + b.phase) / 2 };
        ctx.strokeStyle = getParticleColor(midPt, p, rgb1, rgb2);
        ctx.globalAlpha = lineAlpha;
        ctx.beginPath(); ctx.moveTo(a.px, a.py); ctx.lineTo(b.px, b.py); ctx.stroke();
      }
    },
    _triangulate(pts, maxDist) {
      const edges = []; const maxPerPoint = 2; const totalEdges = Math.min(pts.length * maxPerPoint, 600);
      let count = 0;
      for (let i = 0; i < pts.length && count < totalEdges; i++) {
        const a = pts[i]; const dists = [];
        for (let j = 0; j < pts.length; j++) {
          if (j === i) continue;
          const b = pts[j]; const dx = a.px - b.px, dy = a.py - b.py;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d <= maxDist) dists.push({ j, d });
        }
        dists.sort((a, b) => a.d - b.d);
        for (let k = 0; k < Math.min(maxPerPoint, dists.length) && count < totalEdges; k++) {
          edges.push(i, dists[k].j); count++;
        }
      }
      return edges;
    }
  },
  glow: {
    name: 'Glow Field',
    _cache: null,
    draw(ctx, projected, p) {
      if (!this._cache) {
        this._cache = {};
        const sizes = [2, 4, 8, 16, 32];
        for (const size of sizes) {
          const c = document.createElement('canvas');
          c.width = size * 2; c.height = size * 2;
          const t = c.getContext('2d');
          const grad = t.createRadialGradient(size, size, 0, size, size, size);
          grad.addColorStop(0, 'rgba(255,255,255,1)');
          grad.addColorStop(0.1, 'rgba(255,255,255,0.8)');
          grad.addColorStop(0.4, 'rgba(255,255,255,0.3)');
          grad.addColorStop(1, 'rgba(255,255,255,0)');
          t.fillStyle = grad; t.fillRect(0, 0, size * 2, size * 2);
          this._cache[size] = c;
        }
      }
      const rgb1 = hexToRgb(p.color);
      const rgb2 = p.colorSecondary && p.colorMode !== 'solid' ? hexToRgb(p.colorSecondary) : null;
      ctx.shadowBlur = 0; ctx.globalCompositeOperation = 'lighter';
      for (const pt of projected) {
        const size = Math.round(pt.r * 2); if (size < 1) continue;
        const snap = size <= 4 ? 4 : size <= 8 ? 8 : size <= 16 ? 16 : 32;
        const tex = this._cache[snap]; if (!tex) continue;
        const c = getParticleColor(pt, p, rgb1, rgb2);
        ctx.fillStyle = c;
        ctx.globalAlpha = Math.max(0.05, Math.min(0.4, pt.alpha));
        ctx.beginPath(); ctx.arc(pt.px, pt.py, pt.r * 0.3, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = Math.max(0.05, Math.min(0.4, pt.alpha));
        ctx.drawImage(tex, pt.px - snap, pt.py - snap, snap * 2, snap * 2);
      }
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    }
  }
};

// ── Rotation ─────────────────────────────────────────────────
function applyRotYawPitch(v, yaw, pitch) {
  const cosY = Math.cos(yaw), sinY = Math.sin(yaw);
  const cosP = Math.cos(pitch), sinP = Math.sin(pitch);
  const rx = v.x * cosY - v.z * sinY;
  const ry = v.y;
  const rz = v.x * sinY + v.z * cosY;
  return { x: rx, y: ry * cosP - rz * sinP, z: ry * sinP + rz * cosP };
}

// ── Flame color ──────────────────────────────────────────────
function getFlameColor(f) {
  let r, g, b;
  if (f < 0) {
    const t = Math.min(1, -f / 2);
    if (t < 0.25) { const s = t / 0.25; r = 224+(160-224)*s; g = 48+(72-48)*s; b = 48+(96-48)*s; }
    else if (t < 0.5) { const s = (t-0.25)/0.25; r = 160+(80-160)*s; g = 72+(144-72)*s; b = 96+(255-96)*s; }
    else if (t < 0.75) { const s = (t-0.5)/0.25; r = 80+(216-80)*s; g = 144+(232-144)*s; b = 255; }
    else { const s = (t-0.75)/0.25; r = 216+(255-216)*s; g = 232+(255-232)*s; b = 255; }
  } else {
    if (f < 0.2) { r = 224; g = 48; b = 48; }
    else if (f < 0.5) { const s = (f-0.2)/0.3; r = 224+(255-224)*s; g = 48+(128-48)*s; b = 48+(0-48)*s; }
    else if (f < 1.0) { const s = (f-0.5)/0.5; r = 255; g = 128+(184-128)*s; b = 0; }
    else if (f < 1.5) { const s = (f-1.0)/0.5; r = 255; g = 184+(248-184)*s; b = 0+(192-0)*s; }
    else { const s = (f-1.5)/0.5; r = 255; g = 248+(255-248)*s; b = 192+(255-192)*s; }
  }
  return { r: Math.round(r), g: Math.round(g), b: Math.round(b) };
}

function drawFlameHalo(ctx, px, py, r, flame, ss) {
  if (Math.abs(flame) <= 0.01) return;
  const f = flame, absF = Math.abs(f);
  const c = getFlameColor(f);
  let haloSize, haloAlpha;
  if (f < 0) {
    const t = Math.min(1, -f / 2);
    haloSize = Math.max(r * (5 - t * 3), 2) * (ss || 1);
    haloAlpha = Math.min(0.5, (1 - t) * 0.5);
  } else {
    haloSize = Math.max(r * (4 + absF * 0.5), 4) * (ss || 1);
    haloAlpha = Math.min(1, absF * 0.5);
  }
  ctx.globalAlpha = haloAlpha;
  ctx.fillStyle = 'rgb(' + c.r + ',' + c.g + ',' + c.b + ')';
  ctx.beginPath(); ctx.arc(px, py, haloSize, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = Math.min(1, absF * 0.8);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(px, py, haloSize * 0.3, 0, Math.PI * 2); ctx.fill();
}

// ── Sparkle system ───────────────────────────────────────────
function updateSparkles() {
  for (const pt of particles) {
    if (pt.sparkle <= 0) { if (Math.random() < 0.0002) pt.sparkle = 0.6 + Math.random() * 0.4; }
    else { pt.sparkle -= 0.02; if (pt.sparkle < 0) pt.sparkle = 0; }
  }
}

// ── Flame propagation ────────────────────────────────────────
function updateFlame() {
  if (!PRESET.params.flameEnabled) return;
  for (const ep of edgeParticles) {
    if (ep.flame < 0) {
      for (const ni of ep.neighbors) { const n = edgeParticles[ni]; if (n.flame > ep.flame) n.flame += (ep.flame - n.flame) * 0.08; }
      for (const mi of ep.mainNeighbors) { const mp = particles[mi]; if (mp && mp.flame > ep.flame) mp.flame += (ep.flame - mp.flame) * 0.06; }
      ep.flame += 0.004; if (ep.flame > 0) ep.flame = 0;
    }
  }
  for (const mp of particles) {
    if (mp.flame < 0) {
      if (Math.random() < 0.05) { for (let t = 0; t < 10; t++) { const r = Math.floor(Math.random() * particles.length); const nmp = particles[r]; if (nmp && nmp.flame > mp.flame && nmp !== mp) { const dx = mp.tx - nmp.tx, dy = mp.ty - nmp.ty; if (dx * dx + dy * dy < 3600) { nmp.flame += (mp.flame - nmp.flame) * 0.5; break; } } } }
      mp.flame += 0.003; if (mp.flame > 0) mp.flame = 0;
    }
  }
  for (const ep of edgeParticles) {
    if (ep.flame > 0) {
      if (ep.flame > 1.2) { for (const ni of ep.neighbors) { const n = edgeParticles[ni]; if (n.flame < 0.1 && ep.flame > 1.0) n.flame = 1.8; } for (const mi of ep.mainNeighbors) { const mp = particles[mi]; if (mp && mp.flame < 0.1) mp.flame = 1.5; } }
      ep.flame -= 0.008; if (ep.flame < 0) ep.flame = 0;
    }
  }
  for (const mp of particles) {
    if (mp.flame > 0) {
      if (mp.flame > 1.2 && Math.random() < 0.1) { for (let t = 0; t < 20; t++) { const r = Math.floor(Math.random() * particles.length); const nmp = particles[r]; if (nmp && nmp.flame < 0.1 && nmp !== mp) { const dx = mp.tx - nmp.tx, dy = mp.ty - nmp.ty; if (dx * dx + dy * dy < 3600) { nmp.flame = 1.3; break; } } } }
      mp.flame -= 0.006; if (mp.flame < 0) mp.flame = 0;
    }
  }
}

// ── Lightning system ─────────────────────────────────────────
function spawnChainLightning() {
  if (!edgeParticles.length) return;
  const idx = Math.floor(Math.random() * edgeParticles.length);
  edgeParticles[idx].lightning = 1.0;
  lightningQueue.push({ idx, type: 'edge', parentIdx: null, parentType: null, delay: 0, hop: 0 });
}

function spawnGuidedBolt() {
  if (!particles.length) return;
  const startType = Math.random() < 0.3 ? 'edge' : 'main';
  const endType = Math.random() < 0.3 ? 'edge' : 'main';
  const startPool = startType === 'edge' ? edgeParticles : particles;
  const endPool = endType === 'edge' ? edgeParticles : particles;
  if (startPool.length < 2 || endPool.length < 2) return;
  let si = Math.floor(Math.random() * startPool.length), ei = Math.floor(Math.random() * endPool.length);
  let tries = 0; while (ei === si && tries < 10) { ei = Math.floor(Math.random() * endPool.length); tries++; }
  const sp = startPool[si], ep = endPool[ei]; if (!sp || !ep) return;
  const dx0 = ep.tx - sp.tx, dy0 = ep.ty - sp.ty; if (Math.sqrt(dx0 * dx0 + dy0 * dy0) < 100) return;
  const path = [{ tx: sp.tx, ty: sp.ty }]; let cx = sp.tx, cy = sp.ty, stuck = 0;
  while (stuck < 50 && path.length < 80) {
    const tdx = ep.tx - cx, tdy = ep.ty - cy, tdist = Math.sqrt(tdx * tdx + tdy * tdy);
    if (tdist < 30) { path.push({ tx: ep.tx, ty: ep.ty }); break; }
    let best = null, bestDist = tdist;
    for (let t = 0; t < Math.min(60, particles.length); t++) {
      const r = Math.floor(Math.random() * particles.length); const mp = particles[r]; if (!mp) continue;
      const d2 = Math.sqrt((mp.tx-cx)**2+(mp.ty-cy)**2);
      if (d2 >= 10 && d2 <= 30) { const d3 = Math.sqrt((ep.tx-mp.tx)**2+(ep.ty-mp.ty)**2); if (d3 < bestDist) { bestDist = d3; best = mp; } }
    }
    if (best) { path.push({ tx: best.tx, ty: best.ty }); cx = best.tx; cy = best.ty; stuck = 0; } else stuck++;
  }
  if (path.length < 3) return;
  for (const p of path) { for (const mp of particles) { const dx = mp.tx - p.tx, dy = mp.ty - p.ty; if (dx * dx + dy * dy < 100) { if (mp.flame < 0.6) mp.flame = 0.6; break; } } }
  if (startType === 'edge') { edgeParticles[si].lightning = 1.0; lightningQueue.push({ idx: si, type: 'edge', parentIdx: null, parentType: null, delay: 0, hop: 0 }); }
  const branches = []; let bc = 0;
  for (let s = 1; s < path.length-1 && bc < 4; s++) {
    if (Math.random() < 0.1) { const branch = [{ tx: path[s].tx, ty: path[s].ty }]; let bx = path[s].tx, by = path[s].ty;
      for (let bi = 0; bi < 3+Math.floor(Math.random()*6); bi++) { let best = null, bd = Infinity;
        for (let t = 0; t < Math.min(80, particles.length); t++) { const r = Math.floor(Math.random()*particles.length); const mp = particles[r]; if (!mp) continue; const d2 = Math.sqrt((mp.tx-bx)**2+(mp.ty-by)**2); if (d2 >= 10 && d2 <= 30 && d2 < bd) { bd = d2; best = mp; } } if (best) { branch.push({ tx: best.tx, ty: best.ty }); bx = best.tx; by = best.ty; } else break; }
      if (branch.length >= 2) { branches.push(branch); bc++; }
    }
  }
  lightningPaths.push({ path, branches, progress: 0, life: 1.0, strikes: 0 });
}

function updateLightning() {
  for (let qi = 0; qi < lightningQueue.length; qi++) {
    const item = lightningQueue[qi]; item.delay--; if (item.delay > 0) continue;
    let target = item.type === 'edge' ? edgeParticles[item.idx] : particles[item.idx];
    if (!target) { lightningQueue.splice(qi,1); qi--; continue; }
    target.lightning = 1.0; if (item.type === 'main' && target.flame < 0.6) target.flame = 0.6;
    const nextHop = item.hop + 1; if (nextHop > 8) { lightningQueue.splice(qi,1); qi--; continue; }
    if (item.parentIdx !== null) { let pp = null;
      if (item.parentType === 'edge' && edgeParticles[item.parentIdx]) pp = { tx: edgeParticles[item.parentIdx].tx, ty: edgeParticles[item.parentIdx].ty };
      else if (item.parentType === 'main' && particles[item.parentIdx]) pp = { tx: particles[item.parentIdx].tx, ty: particles[item.parentIdx].ty };
      if (pp) lightningBolts.push({ x1: pp.tx, y1: pp.ty, x2: target.tx, y2: target.ty, life: 1.0 });
    }
    let enq = 0, maxCh = 1+Math.floor(Math.random()*2);
    if (item.type === 'edge') {
      for (const ni of target.neighbors) { if (enq >= maxCh) break; if (edgeParticles[ni] && edgeParticles[ni].lightning < 0.1) { lightningQueue.push({ idx: ni, type: 'edge', parentIdx: item.idx, parentType: 'edge', delay: Math.floor(Math.random()*2), hop: nextHop }); enq++; } }
      enq = 0; maxCh = 1+Math.floor(Math.random()*2); const sh = [...target.mainNeighbors].sort(() => Math.random()-0.5);
      for (const mi of sh) { if (enq >= maxCh) break; if (particles[mi] && particles[mi].lightning < 0.1) { lightningQueue.push({ idx: mi, type: 'main', parentIdx: item.idx, parentType: 'edge', delay: Math.floor(Math.random()*2), hop: nextHop }); enq++; } }
    } else {
      if (Math.random() < 0.5) { const r2 = 400+Math.random()*1600; for (let t = 0; t < 25; t++) { const r = Math.floor(Math.random()*particles.length); const nmp = particles[r]; if (nmp && nmp.lightning < 0.1 && nmp !== target) { const dx = target.tx-nmp.tx, dy = target.ty-nmp.ty; if (dx*dx+dy*dy < r2) { lightningQueue.push({ idx: r, type: 'main', parentIdx: item.idx, parentType: 'main', delay: Math.floor(Math.random()*2), hop: nextHop }); if (Math.random() > 0.4) break; } } } }
      if (Math.random() < 0.25) { const ei = Math.floor(Math.random()*edgeParticles.length); const nep = edgeParticles[ei]; if (nep && nep.lightning < 0.1) { const dx = target.tx-nep.tx, dy = target.ty-nep.ty; if (dx*dx+dy*dy > 2500 && dx*dx+dy*dy < 10000) lightningQueue.push({ idx: ei, type: 'edge', parentIdx: item.idx, parentType: 'main', delay: Math.floor(Math.random()*2), hop: nextHop }); } }
    }
    lightningQueue.splice(qi,1); qi--;
  }
  for (const ep of edgeParticles) { if (ep.lightning > 0) { ep.lightning -= 0.08; if (ep.lightning < 0) ep.lightning = 0; } }
  for (const mp of particles) { if (mp.lightning > 0) { mp.lightning -= 0.08; if (mp.lightning < 0) mp.lightning = 0; } }
  for (let bi = lightningBolts.length-1; bi >= 0; bi--) { lightningBolts[bi].life -= 0.12; if (lightningBolts[bi].life <= 0) lightningBolts.splice(bi,1); }
  for (let pi = lightningPaths.length-1; pi >= 0; pi--) { const lp = lightningPaths[pi]; lp.progress += 0.32; if (lp.progress >= 1) { if (lp.strikes < 2 && Math.random() < 0.1) { lp.progress = 0; lp.strikes++; } else lp.life -= 0.15; } if (lp.life <= 0) lightningPaths.splice(pi,1); }
}

// ── Wave origin ──────────────────────────────────────────────
function getWaveOrigin(t) {
  if (!waveNodes.length) return { x: 0, y: 0 };
  const cycle = (t * 0.00008) % waveNodes.length; const idx = Math.floor(cycle); const frac = cycle - idx;
  const a = waveNodes[idx], b = waveNodes[(idx+1) % waveNodes.length];
  return { x: a.x + (b.x - a.x) * frac, y: a.y + (b.y - a.y) * frac };
}

// ── Playback hamburger menu ─────────────────────────────────
const pmenuButtons = {}, pmenuAutoRepeat = {}, pmenuRepeatRates = {};
let pmenuButtonTimer = 0;

function triggerAction(action) {
  if (action === 'ice') { const idx = Math.floor(Math.random()*edgeParticles.length); if (edgeParticles[idx]) { edgeParticles[idx].flame = -2.0; PRESET.params.flameEnabled = true; } }
  else if (action === 'fire') { const idx = Math.floor(Math.random()*edgeParticles.length); if (edgeParticles[idx]) { edgeParticles[idx].flame = 2.0; PRESET.params.flameEnabled = true; } }
  else if (action === 'lightning') { PRESET.params.lightningEnabled = true; spawnGuidedBolt(); }
}

function processButtons() {
  pmenuButtonTimer++;
  for (const key in pmenuButtons) { if (pmenuButtons[key] && pmenuButtonTimer % Math.max(2, Math.floor((31-pmenuRepeatRates[key])/2)) === 0) triggerAction(key); }
  for (const key in pmenuAutoRepeat) { if (pmenuAutoRepeat[key] && !pmenuButtons[key] && pmenuButtonTimer % Math.max(2, Math.floor((31-pmenuRepeatRates[key])/2)) === 0) triggerAction(key); }
}

function initPlaybackMenu() {
  document.getElementById('pmenu-btn').addEventListener('click', () => document.getElementById('pmenu-items').classList.toggle('open'));
  document.querySelectorAll('.pmenu-row').forEach(row => {
    const action = row.dataset.action; pmenuAutoRepeat[action] = false; pmenuRepeatRates[action] = 15;
    row.querySelector('.pmenu-label').addEventListener('click', () => triggerAction(action));
    row.querySelector('.pmenu-label').addEventListener('touchstart', (e) => { e.preventDefault(); triggerAction(action); }, { passive: true });
    const start = () => { pmenuButtons[action] = true; triggerAction(action); };
    const end = () => { pmenuButtons[action] = false; };
    row.addEventListener('mousedown', start); row.addEventListener('mouseup', end); row.addEventListener('mouseleave', end);
    row.addEventListener('touchstart', start, { passive: true }); row.addEventListener('touchend', end, { passive: true });
    row.querySelector('.pmenu-toggle input').addEventListener('change', e => { pmenuAutoRepeat[action] = e.target.checked; });
    row.querySelector('.rate-slider').addEventListener('input', e => { pmenuRepeatRates[action] = parseInt(e.target.value); });
  });
}

// ── Particle sampling ────────────────────────────────────────
function sampleParticles() {
  const tw = logoCanvas.width, th = logoCanvas.height, tctx = logoCanvas.getContext('2d');
  const list = [];
  for (let gy = 0; gy < Math.ceil(th/10); gy++) { for (let gx = 0; gx < Math.ceil(tw/10); gx++) {
    const px = gx*10+5, py = gy*10+5;
    if (tctx.getImageData(Math.round(px), Math.round(py), 1, 1).data[3] > 30) {
      list.push({ tx: px+(Math.random()-0.5)*6, ty: py+(Math.random()-0.5)*6, tz: 0, edgeDist: 0, flame: 0, lightning: 0, sparkle: 0,
        x: Math.cos(Math.random()*Math.PI*2)*(500+Math.random()*1500), y: Math.sin(Math.random()*Math.PI*2)*(500+Math.random()*1500), z: (Math.random()-0.5)*50,
        size: 1.5+Math.pow(Math.random(),2)*5.5, phase: Math.random()*Math.PI*2 });
    }
  } }
  return list;
}

// ── Init ─────────────────────────────────────────────────────
async function init() {
  const p = PRESET.params, svgStr = PRESET.svg;
  const parser = new DOMParser(), doc = parser.parseFromString(svgStr, 'image/svg+xml');
  const svg = doc.querySelector('svg');
  let svgW = 400, svgH = 300; const vb = svg ? svg.getAttribute('viewBox') : null;
  if (vb) { const pts = vb.split(/[\\s,]+/).map(Number); svgW = pts[2]-pts[0]; svgH = pts[3]-pts[1]; }
  else { svgW = parseInt(svg.getAttribute('width'))||400; svgH = parseInt(svg.getAttribute('height'))||300; }
  const aspect = svgW/svgH, ss = 1000;
  const c = document.createElement('canvas'); c.width = ss; c.height = Math.round(ss/aspect);
  const tctx = c.getContext('2d');
  const img = new Image(), blob = new Blob([svgStr], { type: 'image/svg+xml' }), url = URL.createObjectURL(blob);
  img.onload = () => { tctx.drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); logoCanvas = c; particles = sampleParticles(); computeEdgeDist(svgStr, svgW, svgH, doc); startLoop(); };
  img.onerror = () => { URL.revokeObjectURL(url); logoCanvas = c; particles = sampleParticles(); computeEdgeDist(svgStr, svgW, svgH, doc); startLoop(); };
  img.src = url;
}

function computeEdgeDist(svgStr, svgW, svgH, doc) {
  let tm = [1,0,0,1,0,0];
  for (const g of doc.querySelectorAll('g')) {
    const t = g.getAttribute('transform'); if (!t) continue;
    const m = t.match(/matrix\\(\\s*([-\\d.e]+)\\s*,\\s*([-\\d.e]+)\\s*,\\s*([-\\d.e]+)\\s*,\\s*([-\\d.e]+)\\s*,\\s*([-\\d.e]+)\\s*,\\s*([-\\d.e]+)\\s*\\)/);
    if (m) { const a = [parseFloat(m[1]),parseFloat(m[2]),parseFloat(m[3]),parseFloat(m[4]),parseFloat(m[5]),parseFloat(m[6])];
      const t0=tm[0],t1=tm[1],t2=tm[2],t3=tm[3],t4=tm[4],t5=tm[5];
      tm = [a[0]*t0+a[2]*t1, a[1]*t0+a[3]*t1, a[0]*t2+a[2]*t3, a[1]*t2+a[3]*t3, a[0]*t4+a[2]*t5+a[4], a[1]*t4+a[3]*t5+a[5]];
    }
  }
  const ls = logoCanvas.width / svgW;
  const tp = (x, y) => ({ x: (tm[0]*x+tm[2]*y+tm[4])*ls, y: (tm[1]*x+tm[3]*y+tm[5])*ls });
  const paths = Array.from(doc.querySelectorAll('path')).map(p => p.getAttribute('d')).filter(Boolean).map(d => new Path2D(d));
  const circles = Array.from(doc.querySelectorAll('circle')).map(c => ({ cx: parseFloat(c.getAttribute('cx'))||0, cy: parseFloat(c.getAttribute('cy'))||0, r: parseFloat(c.getAttribute('r'))||0 }));
  const tmpC = document.createElement('canvas').getContext('2d');
  const inside = (x, y) => { for (const c of circles) { const dx = x-c.cx, dy = y-c.cy; if (dx*dx+dy*dy <= c.r*c.r) return true; } for (const p of paths) { if (tmpC.isPointInPath(p, x, y, 'evenodd')) return true; } return false; };
  let rMinX = Infinity, rMaxX = -Infinity, rMinY = Infinity, rMaxY = -Infinity;
  for (const c of circles) { rMinX = Math.min(rMinX, c.cx-c.r); rMaxX = Math.max(rMaxX, c.cx+c.r); rMinY = Math.min(rMinY, c.cy-c.r); rMaxY = Math.max(rMaxY, c.cy+c.r); }
  rMinX -= 10; rMaxX += 10; rMinY -= 10; rMaxY += 10;
  const es = 5, edgeList = [];
  for (let gy = 1; gy < Math.ceil((rMaxY-rMinY)/es)-1; gy++) { for (let gx = 1; gx < Math.ceil((rMaxX-rMinX)/es)-1; gx++) {
    const px = rMinX+gx*es, py = rMinY+gy*es;
    if (inside(px, py) && (!inside(px-es, py) || !inside(px+es, py) || !inside(px, py-es) || !inside(px, py+es))) { const tp2 = tp(px, py); edgeList.push({ tx: tp2.x, ty: tp2.y }); }
  } }
  edgeParticles = edgeList.map(ep => ({ tx: ep.tx, ty: ep.ty, tz: 0, sparkle: 0, flame: 0, lightning: 0, phase: Math.random()*Math.PI*2, neighbors: [], mainNeighbors: [] }));
  for (let i = 0; i < edgeParticles.length; i++) for (let j = i+1; j < edgeParticles.length; j++) { const dx = edgeParticles[i].tx-edgeParticles[j].tx, dy = edgeParticles[i].ty-edgeParticles[j].ty; if (dx*dx+dy*dy < 2500) { edgeParticles[i].neighbors.push(j); edgeParticles[j].neighbors.push(i); } }
  for (const pt of particles) { pt.flame = 0; pt.lightning = 0; }
  for (const ep of edgeParticles) { for (let mi = 0; mi < particles.length; mi++) { const dx = ep.tx-particles[mi].tx, dy = ep.ty-particles[mi].ty; if (dx*dx+dy*dy < 1600) ep.mainNeighbors.push(mi); } }
  for (const pt of particles) { let md = Infinity; for (const ep of edgeParticles) { const dx = pt.tx-ep.tx, dy = pt.ty-ep.ty; const d = dx*dx+dy*dy; if (d < md) md = d; } pt.edgeDist = Math.sqrt(md); }
  waveNodes = circles.map(c => { const tp2 = tp(c.cx, c.cy); return { x: tp2.x, y: tp2.y }; });
}

// ═══════════════════════════════════════════════════════════════
// Unified Frame — single rendering pipeline
// ═══════════════════════════════════════════════════════════════
function frame(t) {
  try {
    if (!particles.length || !logoCanvas) { animId = requestAnimationFrame(frame); return; }
    const p = animEvaluate(PRESET.params, PRESET.params.anim, t - animStartTime);
    const LOGO_COLOR = p.color || '#e03030';

    // Logo bounds
    const logoAspect = logoCanvas.width / logoCanvas.height;
    const sc = p.scale * Math.min(W, H / logoAspect);
    let lw, lh;
    if (W / H > logoAspect) { lh = sc; lw = sc * logoAspect; }
    else { lw = sc; lh = sc / logoAspect; }
    const lx = (W - lw) / 2, ly = (H - lh) / 2;
    const cx = lx + lw / 2, cy = ly + lh / 2;
    const baseS = lw / logoCanvas.width;
    const lcx = logoCanvas.width / 2, lcy = logoCanvas.height / 2;

    // Rotation with speed interpolation
    const ROT_SPEED = 0.025;
    const targetYawSpeed = (keys['ArrowLeft'] ? -1 : keys['ArrowRight'] ? 1 : 0) * ROT_SPEED;
    const targetPitchSpeed = (keys['ArrowUp'] ? -1 : keys['ArrowDown'] ? 1 : 0) * ROT_SPEED;
    yawSpd += (targetYawSpeed - yawSpd) * 0.15;
    pitchSpd += (targetPitchSpeed - pitchSpd) * 0.15;
    yawAngle += yawSpd;
    pitchAngle += pitchSpd;
    const autoYawOffset = yRotEnabled ? Math.sin(t * 0.0003 * p.yawSpeed * 2) * p.yawAmp : 0;
    const effectiveYaw = yawAngle + autoYawOffset;
    const pitch = p.autoPitch ? pitchAngle + Math.sin(t * 0.00015 * p.pitchSpeed * 0.7) * p.pitchAmp * 0.5 : pitchAngle;

    // Process held menu buttons
    processButtons();

    // Updates
    updateSparkles();
    updateFlame();
    updateLightning();

    // ── Step 1: Clear ──
    ctx.clearRect(0, 0, W, H);

    // ── Step 2: Starfield ──
    if (p.starfieldEnabled && stars.length) drawStars();

    // ── Step 3: Trail overlay ──
    if (p.trailAlpha > 0) {
      ctx.fillStyle = 'rgba(6,6,14,' + p.trailAlpha + ')';
      ctx.fillRect(0, 0, W, H);
    }

    // ── Step 4: Compute & project ──
    const projected = [];
    const waveOrigin = getWaveOrigin(t);
    const isIcknaRender = p.renderMode === 'ickna';

    for (const pt of particles) {
      // Wave motion
      let waveX, waveY, waveZ;
      if (p.waveMode === 'am') {
        waveX = (3 + 2 * Math.sin(t * 0.0006 + pt.phase)) * Math.sin(t * 0.002 + pt.phase + pt.ty * 0.01);
        waveY = (3 + 2 * Math.sin(t * 0.0008 + pt.phase * 1.3)) * Math.cos(t * 0.0025 + pt.phase * 0.7 + pt.tx * 0.008);
        waveZ = 0;
      } else {
        waveX = p.waveAmp * Math.sin(t * p.waveFreq + pt.phase + pt.ty * 0.01);
        waveY = p.waveAmp * 0.6 * Math.cos(t * p.waveFreq * 1.2 + pt.phase * 0.7 + pt.tx * 0.008);
        waveZ = p.waveAmp * 1.5 * Math.sin(t * p.waveFreq * 0.9 + pt.phase * 1.1 + pt.ty * 0.006);
      }

      const targetX = pt.tx + waveX;
      const targetY = pt.ty + waveY;
      const depthSign = Math.sin(t * 0.0003 + pt.tx * 0.01 + pt.ty * 0.01);
      const targetZ = depthSign * Math.min(35, (pt.edgeDist || 0) * 0.8) * (p.zDispersion / 60) + waveZ;

      // Rotation
      const rotated = applyRotYawPitch({x: targetX - lcx, y: targetY - lcy, z: targetZ}, effectiveYaw, pitch);
      const rtx = rotated.x + lcx, rty = rotated.y + lcy, rtz = rotated.z;

      // Motion (lerp or spring)
      if (p.motionMode === 'lerp') {
        pt.x += (rtx - pt.x) * p.lerpSpeed;
        pt.y += (rty - pt.y) * p.lerpSpeed;
        pt.z += (rtz - pt.z) * p.lerpSpeed;
      } else {
        pt.vx = (pt.vx + (rtx - pt.x) * p.spring) * p.damping;
        pt.vy = (pt.vy + (rty - pt.y) * p.spring) * p.damping;
        pt.vz = (pt.vz + (rtz - pt.z) * p.spring) * p.damping;
        pt.x += pt.vx; pt.y += pt.vy; pt.z += pt.vz;
      }

      const zOffset = pt.z + 200;
      const ps = FOCAL / (FOCAL + zOffset);
      const screenX = (pt.x - lcx) * ps * baseS + cx;
      const screenY = (pt.y - lcy) * ps * baseS + cy;

      // Depth fade
      let depthFade;
      if (p.depthFadeMode === 'ickna') {
        depthFade = 0.5 + 0.5 * Math.max(0.625, 1 - (zOffset - 100) / 250);
      } else {
        depthFade = p.depthFade ? Math.min(1, (zOffset + 100) / 300) : 1;
      }

      const sizePulse = 1.4 + 0.4 * Math.sin(t * 0.002 + pt.phase);
      const screenSize = Math.max(pt.size * ps * baseS * sizePulse * p.sizeScale, 0.3);

      const convergeDist = Math.sqrt((pt.x - pt.tx) ** 2 + (pt.y - pt.ty) ** 2 + (pt.z - pt.tz) ** 2);
      const convergeAlpha = Math.min(1, Math.max(0.02, 1 - convergeDist / 2000));

      const wdx = pt.tx - waveOrigin.x, wdy = pt.ty - waveOrigin.y;
      const waveMod = 0.6 + 0.4 * Math.max(0, Math.cos(Math.sqrt(wdx * wdx + wdy * wdy) * 0.02 - t * 0.002));

      const sparkleMod = 1 + (pt.sparkle || 0) * 3;
      const finalAlpha = Math.max(0.15, Math.min(1, depthFade * waveMod)) * convergeAlpha;
      const finalSize = screenSize * sparkleMod;

      projected.push({ px: screenX, py: screenY, r: finalSize, z: zOffset, alpha: finalAlpha, pt: pt });
    }

    projected.sort((a, b) => a.z - b.z);

    // ── Step 5: Core rendering ──
    if (isIcknaRender) {
      // Edge-to-main connection lines
      if (p.edgeLineAlpha > 0 && edgeParticles.length) {
        ctx.lineWidth = 2.0;
        const lineThreshold = 180;
        const getEdgeColor = (flame) => {
          if (Math.abs(flame) > 0.01) { const c = getFlameColor(flame); return { r: c.r, g: c.g, b: c.b }; }
          return { r: 224, g: 48, b: 48 };
        };
        const edgeScreen = [];
        for (const ep of edgeParticles) {
          const rotated = applyRotYawPitch({x: ep.tx - lcx, y: ep.ty - lcy, z: ep.tz}, effectiveYaw, pitch);
          const zOffset = rotated.z + 200;
          const ps = FOCAL / (FOCAL + zOffset);
          edgeScreen.push({ sx: rotated.x * ps * baseS + cx, sy: rotated.y * ps * baseS + cy, color: getEdgeColor(ep.flame) });
        }
        for (let ei = 0; ei < edgeScreen.length; ei++) {
          const es = edgeScreen[ei];
          if (es.sx < -10 || es.sx > W + 10 || es.sy < -10 || es.sy > H + 10) continue;
          const mainNeighbors = [];
          for (const pp of projected) {
            const dx = es.sx - pp.px, dy = es.sy - pp.py;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < lineThreshold) mainNeighbors.push({ x: pp.px, y: pp.py, dist, color: getEdgeColor(pp.pt ? pp.pt.flame : 0) });
          }
          mainNeighbors.sort((a, b) => a.dist - b.dist);
          const mainLimit = Math.min(6, mainNeighbors.length);
          for (let k = 0; k < mainLimit; k++) {
            const n = mainNeighbors[k];
            const avgR = (es.color.r + n.color.r) >> 1;
            const avgG = (es.color.g + n.color.g) >> 1;
            const avgB = (es.color.b + n.color.b) >> 1;
            ctx.globalAlpha = (1 - n.dist / lineThreshold) * p.edgeLineAlpha;
            ctx.strokeStyle = 'rgb(' + avgR + ',' + avgG + ',' + avgB + ')';
            ctx.beginPath(); ctx.moveTo(es.sx, es.sy); ctx.lineTo(n.x, n.y); ctx.stroke();
          }
        }
      }

      // Core particles (skip cold)
      for (const pp of projected) {
        if (pp.pt && pp.pt.flame < -0.01) continue;
        ctx.globalAlpha = Math.max(0.3, Math.min(1, pp.alpha));
        ctx.fillStyle = LOGO_COLOR;
        ctx.beginPath(); ctx.arc(pp.px, pp.py, Math.max(pp.r, 0.5), 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Glow halos via glowTex
      if (p.glowMode === 'texture') {
        for (const pp of projected) {
          const glowSize = Math.max(pp.r * 6, 6);
          const tempScale = (pp.pt && pp.pt.flame < 0) ? Math.max(0.15, 1 + pp.pt.flame * 0.425) : 1;
          const adjGlowSize = glowSize * tempScale;
          ctx.globalAlpha = Math.max(0.2, Math.min(0.7, pp.alpha * 0.6));
          ctx.drawImage(glowTex, pp.px - adjGlowSize, pp.py - adjGlowSize, adjGlowSize * 2, adjGlowSize * 2);

          // Tint glow with flame temperature color or base color
          if (pp.pt && Math.abs(pp.pt.flame) > 0.01) {
            const c = getFlameColor(pp.pt.flame);
            ctx.globalCompositeOperation = 'source-atop';
            ctx.globalAlpha = 0.5;
            ctx.fillStyle = 'rgb(' + c.r + ',' + c.g + ',' + c.b + ')';
            ctx.beginPath(); ctx.arc(pp.px, pp.py, adjGlowSize, 0, Math.PI * 2); ctx.fill();
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = 1;
          } else {
            ctx.globalCompositeOperation = 'source-atop';
            ctx.globalAlpha = 0.5;
            ctx.fillStyle = LOGO_COLOR;
            ctx.beginPath(); ctx.arc(pp.px, pp.py, adjGlowSize, 0, Math.PI * 2); ctx.fill();
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = 1;
          }

          // Core color override for temperature
          if (pp.pt && Math.abs(pp.pt.flame) > 0.01) {
            const c = getFlameColor(pp.pt.flame);
            const coreScale = pp.pt.flame < 0 ? tempScale : 1;
            ctx.globalAlpha = Math.max(0.3, Math.min(1, pp.alpha));
            ctx.fillStyle = 'rgb(' + c.r + ',' + c.g + ',' + c.b + ')';
            ctx.beginPath(); ctx.arc(pp.px, pp.py, Math.max(pp.r * coreScale, 0.5), 0, Math.PI * 2); ctx.fill();
            ctx.globalAlpha = 1;
          }

          // Main-particle sparkles
          if (pp.pt && pp.pt.sparkle > 0.1) {
            ctx.globalAlpha = pp.pt.sparkle * 0.9;
            ctx.fillStyle = '#ffffff';
            ctx.beginPath(); ctx.arc(pp.px, pp.py, pp.r * 0.8, 0, Math.PI * 2); ctx.fill();
          }
        }
        ctx.globalAlpha = 1;
      } else if (p.glowMode === 'shadow') {
        ctx.shadowColor = p.color;
        ctx.shadowBlur = p.glowBlur;
        for (const pp of projected) {
          ctx.globalAlpha = Math.max(0.15, Math.min(1, pp.alpha));
          ctx.fillStyle = LOGO_COLOR;
          ctx.beginPath(); ctx.arc(pp.px, pp.py, Math.max(pp.r, 0.5), 0, Math.PI * 2); ctx.fill();
        }
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
        if (p.flameEnabled) {
          for (const pp of projected) {
            if (pp.pt && Math.abs(pp.pt.flame) > 0.01) drawFlameHalo(ctx, pp.px, pp.py, pp.r, pp.pt.flame, 1);
          }
        }
      }

      // Edge shimmer
      for (const ep of edgeParticles) {
        if (ep.sparkle <= 0) {
          if (Math.random() < 0.24) ep.sparkle = 0.5 + Math.random() * 0.5;
        } else {
          ep.sparkle -= 0.04;
          if (ep.sparkle < 0) ep.sparkle = 0;
        }
      }
      for (const ep of edgeParticles) {
        if (ep.sparkle <= 0.02) continue;
        const rotated = applyRotYawPitch({x: ep.tx - lcx, y: ep.ty - lcy, z: ep.tz}, effectiveYaw, pitch);
        const zOffset = rotated.z + 200;
        const ps = FOCAL / (FOCAL + zOffset);
        const sx = rotated.x * ps * baseS + cx;
        const sy = rotated.y * ps * baseS + cy;
        if (sx < -10 || sx > W + 10 || sy < -10 || sy > H + 10) continue;
        const ss = Math.min(1, Math.min(W, H) / 700);
        ctx.globalAlpha = 0.23;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(sx, sy, 1.5 * ss, 0, Math.PI * 2); ctx.fill();
        if (ep.sparkle > 0.02) {
          const size = ep.sparkle * 1.4 * ss;
          ctx.globalAlpha = ep.sparkle * 0.35;
          ctx.drawImage(glowTex, sx - size * 4, sy - size * 4, size * 8, size * 8);
          ctx.globalAlpha = ep.sparkle * 0.9;
          ctx.fillStyle = '#ffffff';
          ctx.beginPath(); ctx.arc(sx, sy, size, 0, Math.PI * 2); ctx.fill();
        }
        if (Math.abs(ep.flame) > 0.01) {
          const c = getFlameColor(ep.flame);
          ctx.globalAlpha = 0.9;
          ctx.fillStyle = 'rgb(' + c.r + ',' + c.g + ',' + c.b + ')';
          ctx.beginPath(); ctx.arc(sx, sy, 1.5 * baseS, 0, Math.PI * 2); ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    } else {
      // Non-ickna render modes (dots/lines/triangles/glow)
      const mode = RENDER_MODES[p.renderMode] || RENDER_MODES.dots;
      mode.draw(ctx, projected, p, t);
      // Flame halos for non-ickna modes
      if (p.flameEnabled) {
        for (const pp of projected) {
          if (pp.pt && Math.abs(pp.pt.flame) > 0.01) drawFlameHalo(ctx, pp.px, pp.py, pp.r, pp.pt.flame, 1);
        }
      }
    }

    // ── Step 6: Lightning ──
    if (lightningBolts.length || lightningPaths.length || edgeParticles.some(e => e.lightning > 0.01)) {
      ctx.shadowBlur = 0;
      const viewScale = Math.min(1, Math.min(W, H) / 800);

      // Chain lightning bolt arcs
      for (const bolt of lightningBolts) {
        const p1 = applyRotYawPitch({x: bolt.x1 - lcx, y: bolt.y1 - lcy, z: 0}, effectiveYaw, pitch);
        const p2 = applyRotYawPitch({x: bolt.x2 - lcx, y: bolt.y2 - lcy, z: 0}, effectiveYaw, pitch);
        const zOff1 = p1.z + 200, zOff2 = p2.z + 200;
        const ps1 = FOCAL / (FOCAL + zOff1), ps2 = FOCAL / (FOCAL + zOff2);
        const sx1 = p1.x * ps1 * baseS + cx, sy1 = p1.y * ps1 * baseS + cy;
        const sx2 = p2.x * ps2 * baseS + cx, sy2 = p2.y * ps2 * baseS + cy;
        const dist = Math.sqrt((sx2 - sx1) ** 2 + (sy2 - sy1) ** 2);
        const segments = Math.max(10, Math.floor(dist / 6));
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = (3 + Math.random() * 2) * viewScale;
        ctx.globalAlpha = bolt.life * 0.7;
        ctx.beginPath(); ctx.moveTo(sx1, sy1);
        const jitterAmp = (5 + Math.random() * 8) * viewScale;
        for (let s = 1; s < segments; s++) {
          const tt = s / segments;
          const bx = sx1 + (sx2 - sx1) * tt;
          const by = sy1 + (sy2 - sy1) * tt;
          ctx.lineTo(bx + (Math.random() - 0.5) * jitterAmp * (1 - tt * 0.3), by + (Math.random() - 0.5) * jitterAmp * 0.7 * (1 - tt * 0.3));
        }
        ctx.lineTo(sx2, sy2); ctx.stroke();
        ctx.lineWidth = 1.5 * viewScale;
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.stroke();
      }

      // Lightning flash on edge particles
      for (const ep of edgeParticles) {
        if (ep.lightning > 0.01) {
          const rotated = applyRotYawPitch({x: ep.tx - lcx, y: ep.ty - lcy, z: 0}, effectiveYaw, pitch);
          const zOff = rotated.z + 200;
          const ps = FOCAL / (FOCAL + zOff);
          const sx = rotated.x * ps * baseS + cx;
          const sy = rotated.y * ps * baseS + cy;
          ctx.globalAlpha = ep.lightning * 0.5;
          ctx.fillStyle = '#ffffff';
          ctx.beginPath(); ctx.arc(sx, sy, 4, 0, Math.PI * 2); ctx.fill();
        }
      }

      // Guided lightning paths
      function drawLightningPath(pts, progress) {
        if (!pts || pts.length < 2) return;
        const totalSegs = pts.length - 1;
        const visibleSegs = Math.floor(totalSegs * Math.min(1, progress));
        if (visibleSegs < 1) return;
        ctx.beginPath();
        for (let s = 0; s < visibleSegs; s++) {
          const p1 = pts[s], p2 = pts[s + 1];
          const r1 = applyRotYawPitch({x: p1.tx - lcx, y: p1.ty - lcy, z: 0}, effectiveYaw, pitch);
          const r2 = applyRotYawPitch({x: p2.tx - lcx, y: p2.ty - lcy, z: 0}, effectiveYaw, pitch);
          const z1 = r1.z + 200, z2 = r2.z + 200;
          const ps1 = FOCAL / (FOCAL + z1), ps2 = FOCAL / (FOCAL + z2);
          const sx1 = r1.x * ps1 * baseS + cx, sy1 = r1.y * ps1 * baseS + cy;
          const sx2 = r2.x * ps2 * baseS + cx, sy2 = r2.y * ps2 * baseS + cy;
          const segDist = Math.sqrt((sx2 - sx1) ** 2 + (sy2 - sy1) ** 2);
          const subSegs = Math.max(3, Math.floor(segDist / 8));
          if (s === 0) ctx.moveTo(sx1, sy1);
          for (let ss = 1; ss <= subSegs; ss++) {
            const tt = ss / subSegs;
            const bx = sx1 + (sx2 - sx1) * tt;
            const by = sy1 + (sy2 - sy1) * tt;
            ctx.lineTo(bx + (Math.random() - 0.5) * 6 * viewScale, by + (Math.random() - 0.5) * 6 * viewScale * 0.7);
          }
        }
        ctx.stroke();
      }

      for (const lp of lightningPaths) {
        const strobe = lp.progress < 1 ? (0.7 + Math.random() * 0.3) : 1;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = (3 + Math.random() * 2) * viewScale;
        ctx.globalAlpha = lp.life * 0.7 * strobe;
        drawLightningPath(lp.path, lp.progress);
        const branchProgress = Math.max(0, lp.progress - 0.15);
        for (const branch of lp.branches) drawLightningPath(branch, branchProgress);
        ctx.lineWidth = 1.5 * viewScale;
        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.globalAlpha = lp.life * 0.5;
        drawLightningPath(lp.path, lp.progress);
        for (const branch of lp.branches) drawLightningPath(branch, branchProgress);
      }
      ctx.globalAlpha = 1;
    }

    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  } catch (e) {
    console.error('Mote frame error:', e);
  }
  animId = requestAnimationFrame(frame);
}

function startLoop() { document.getElementById('loading').classList.add('hidden'); setTimeout(() => document.getElementById('loading').classList.add('hidden'), 3000); initPlaybackMenu(); setTimeout(() => { yRotEnabled = true; }, 5000); animStartTime = performance.now(); frame(animStartTime); }

// ── Keyboard controls ────────────────────────────────────────
document.addEventListener('keydown', e => { keys[e.key] = true; if (e.key === '/') yRotEnabled = !yRotEnabled; if (e.key === '=' || e.key === '+') { const idx = Math.floor(Math.random()*edgeParticles.length); if (edgeParticles[idx]) { edgeParticles[idx].flame = -2.0; PRESET.params.flameEnabled = true; } } if (e.key === '\\\\' || e.key === '|') { const idx = Math.floor(Math.random()*edgeParticles.length); if (edgeParticles[idx]) { edgeParticles[idx].flame = 2.0; PRESET.params.flameEnabled = true; } } if (e.key === '-' || e.key === '_') { PRESET.params.lightningEnabled = true; spawnChainLightning(); } if (e.key === '0' || e.key === ')') { PRESET.params.lightningEnabled = true; spawnGuidedBolt(); } });
document.addEventListener('keyup', e => { keys[e.key] = false; });

// ── Drag rotation ────────────────────────────────────────────
let dragState = { active: false, startX: 0, startY: 0, moved: false };
const DRAG_SENSITIVITY = 0.008;
function onPointerDown(e) { if (document.getElementById('pmenu-items').classList.contains('open')) return; const p = e.touches ? e.touches[0]||e.changedTouches[0] : e; dragState.active = true; dragState.startX = p.clientX; dragState.startY = p.clientY; dragState.moved = false; }
function onPointerMove(e) { if (!dragState.active || document.getElementById('pmenu-items').classList.contains('open')) return; const p = e.touches ? e.touches[0]||e.changedTouches[0] : e; const dx = p.clientX-dragState.startX, dy = p.clientY-dragState.startY; if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragState.moved = true; yawAngle += dx*DRAG_SENSITIVITY; pitchAngle += dy*DRAG_SENSITIVITY; dragState.startX = p.clientX; dragState.startY = p.clientY; }
function onPointerUp(e) { if (dragState.active && !dragState.moved) yRotEnabled = !yRotEnabled; dragState.active = false; }
window.addEventListener('mousedown', onPointerDown); window.addEventListener('mousemove', onPointerMove); window.addEventListener('mouseup', onPointerUp);
window.addEventListener('touchstart', onPointerDown, { passive: true }); window.addEventListener('touchmove', onPointerMove, { passive: true }); window.addEventListener('touchend', onPointerUp, { passive: true });

// ── Visibility handler ───────────────────────────────────────
document.addEventListener('visibilitychange', () => { if (document.hidden && animId) { cancelAnimationFrame(animId); animId = null; } else if (!document.hidden && !animId) frame(performance.now()); });

init();
</script>
</body>
</html>"""
    html = html.replace('__PRESET_NAME__', preset_name.replace('"', '&quot;'))
    html = html.replace('__PRESET_JSON__', preset_json)

    with open(output_path, 'w') as f:
        f.write(html)

    print(f"Playback HTML saved to {output_path}")
    size_kb = os.path.getsize(output_path) / 1024
    print(f"  Size: {size_kb:.1f} KB")


def main():
    parser = argparse.ArgumentParser(
        description="Mote CLI — Generate presets and playback HTML from SVG files",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    sub = parser.add_subparsers(dest='command', required=True)

    # preset command
    preset_p = sub.add_parser('preset', help='Generate a preset JSON from an SVG file')
    preset_p.add_argument('--svg', required=True, help='Path to SVG file')
    preset_p.add_argument('--output', '-o', default='preset.json', help='Output JSON file path')
    preset_p.add_argument('--params', '-p', default=None, help='JSON string of params to override')

    # export command
    export_p = sub.add_parser('export', help='Export a self-contained playback HTML from a preset')
    export_p.add_argument('--preset', required=True, help='Path to preset JSON file')
    export_p.add_argument('--output', '-o', default='player.html', help='Output HTML file path')

    args = parser.parse_args()

    if args.command == 'preset':
        params_override = None
        if args.params:
            params_override = json.loads(args.params)
        generate_preset(args.svg, args.output, params_override)

    elif args.command == 'export':
        export_playback(args.preset, args.output)


if __name__ == '__main__':
    import io
    import random
    main()