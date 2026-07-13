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
    "yawAmp": 0.15,
    "pitchAmp": 0.08,
    "spacing": 20,
    "spring": 0.05,
    "damping": 0.88,
    "waveAmp": 12,
    "waveFreq": 0.002,
    "zDispersion": 60,
    "sizeMin": 1.5,
    "sizeMax": 7.5,
    "glowBlur": 3,
    "depthFade": 0.6,
    "color": "#e03030",
    "colorSecondary": "#7b2ff7",
    "colorMode": "solid",
    "scale": 0.80,
    "renderMode": "dots",
    "trails": False,
    "edgeShimmer": False,
    "starfield": False,
    "flameEnabled": False,
    "edgeLines": False,
    "transitionDuration": 800,
    "lineThreshold": 60
}


def svg_to_png(svg_path, output_width=1000):
    """Render SVG to PNG bytes using cairosvg."""
    if cairosvg is None:
        sys.exit("Error: cairosvg is required. Install: pip install cairosvg")

    with open(svg_path, 'rb') as f:
        svg_data = f.read()

    png_data = cairosvg.svg2png(
        bytestring=svg_data,
        output_width=output_width,
        output_height=int(output_width * 0.75)  # approximate 4:3
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
    """Generate a self-contained playback HTML from a preset JSON."""
    with open(preset_path, 'r') as f:
        preset = json.load(f)

    preset_json = json.dumps(preset, indent=2)

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<title>Mote — {preset.get('name', 'unnamed')}</title>
<style>
*,*::before,*::after{{box-sizing:border-box;margin:0;padding:0}}
html,body{{width:100%;height:100%;overflow:hidden;background:#06060e}}
canvas{{display:block;width:100%;height:100%}}
</style>
</head>
<body>
<canvas id="c"></canvas>
<script>
// Mote Playback — {preset.get('name', 'unnamed')}
const PRESET = {preset_json};
const FOCAL = 900;
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let W, H, DPR, logoCanvas, particles = [], animId;
function resize() {{
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth; H = window.innerHeight;
  canvas.width = W * DPR; canvas.height = H * DPR;
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}}
window.addEventListener('resize', resize); resize();

function rotateX(y, z, a) {{
  const c = Math.cos(a), s = Math.sin(a);
  return {{ y: y * c - z * s, z: y * s + z * c }};
}}
function rotateY(x, z, a) {{
  const c = Math.cos(a), s = Math.sin(a);
  return {{ x: x * c - z * s, z: x * s + z * c }};
}}

async function init() {{
  const p = PRESET.params;
  const svgStr = PRESET.svg;
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgStr, 'image/svg+xml');
  const svg = doc.querySelector('svg');
  let svgW = 400, svgH = 300;
  const vb = svg ? svg.getAttribute('viewBox') : null;
  if (vb) {{ const pts = vb.split(/[\\\\s,]+/).map(Number); svgW = pts[2] - pts[0]; svgH = pts[3] - pts[1]; }}
  else {{ svgW = parseInt(svg.getAttribute('width')) || 400; svgH = parseInt(svg.getAttribute('height')) || 300; }}
  const sampleSize = 1000;
  const aspect = svgW / svgH;
  const c = document.createElement('canvas');
  c.width = sampleSize; c.height = Math.round(sampleSize / aspect);
  const tctx = c.getContext('2d');
  const img = new Image();
  const blob = new Blob([svgStr], {{ type: 'image/svg+xml' }});
  const url = URL.createObjectURL(blob);
  img.onload = () => {{
    tctx.drawImage(img, 0, 0, c.width, c.height);
    URL.revokeObjectURL(url);
    logoCanvas = c;
    sampleParticles(p);
    loop();
  }};
  img.onerror = () => {{ URL.revokeObjectURL(url); fallbackRender(svgStr, c, tctx, p); }};
  img.src = url;
}}

function sampleParticles(p) {{
  const tw = logoCanvas.width, th = logoCanvas.height;
  const tctx = logoCanvas.getContext('2d');
  const spacing = p.spacing || 20;
  const zDisp = p.zDispersion || 60;
  const sizeMin = p.sizeMin || 1.5;
  const sizeMax = p.sizeMax || 7.5;
  const cols = Math.ceil(tw / spacing), rows = Math.ceil(th / spacing);
  particles = [];
  for (let gy = 0; gy < rows; gy++) {{
    for (let gx = 0; gx < cols; gx++) {{
      const px = gx * spacing + spacing / 2;
      const py = gy * spacing + spacing / 2;
      const pixel = tctx.getImageData(Math.round(px), Math.round(py), 1, 1).data;
      if (pixel[3] > 30) {{
        const nx = (px / tw) * 2 - 1, ny = (py / th) * 2 - 1;
        const tz = zDisp * Math.sin(nx * Math.PI * 0.8) * Math.cos(ny * Math.PI * 0.6)
                 + (zDisp / 2) * Math.sin(px * 0.03) * Math.cos(py * 0.04);
        particles.push({{
          tx: px, ty: py, tz: tz,
          x: px + (Math.random() - 0.5) * 300,
          y: py + (Math.random() - 0.5) * 300,
          z: tz + (Math.random() - 0.5) * 100,
          vx: 0, vy: 0, vz: 0,
          size: sizeMin + Math.random() * (sizeMax - sizeMin),
          phase: Math.random() * Math.PI * 2
        }});
      }}
    }}
  }}
}}

function loop() {{
  const t = performance.now();
  const p = PRESET.params;
  ctx.clearRect(0, 0, W, H);
  if (!particles.length || !logoCanvas) {{ animId = requestAnimationFrame(loop); return; }}
  const time = t * 0.00015;
  const yaw = Math.sin(time * p.yawSpeed) * (p.yawAmp || 0.15);
  const pitch = Math.sin(time * p.pitchSpeed * 0.7) * (p.pitchAmp || 0.08);
  const logoAspect = logoCanvas.width / logoCanvas.height;
  const sc = (p.scale || 0.80) * Math.min(W, H / logoAspect);
  let lw, lh, lx, ly;
  if (W / H > logoAspect) {{ lh = sc; lw = sc * logoAspect; lx = (W - lw) / 2; ly = (H - lh) / 2; }}
  else {{ lw = sc; lh = sc / logoAspect; lx = (W - lw) / 2; ly = (H - lh) / 2; }}
  const cx = lx + lw / 2, cy = ly + lh / 2;
  ctx.shadowColor = p.color; ctx.shadowBlur = p.glowBlur || 3;
  const projected = [];
  for (const pt of particles) {{
    const waveX = (p.waveAmp || 12) * Math.sin(t * (p.waveFreq || 0.002) + pt.phase + pt.ty * 0.01);
    const waveY = (p.waveAmp || 12) * 0.6 * Math.cos(t * (p.waveFreq || 0.002) * 1.2 + pt.phase * 0.7 + pt.tx * 0.008);
    const waveZ = (p.waveAmp || 12) * 1.5 * Math.sin(t * (p.waveFreq || 0.002) * 0.9 + pt.phase * 1.1 + pt.ty * 0.006);
    const ry = rotateY(pt.tx + waveX, pt.tz + waveZ, yaw);
    const r3d = rotateX(pt.ty + waveY, ry.z, pitch);
    const rtx = ry.x, rty = r3d.y, rtz = r3d.z;
    pt.vx = (pt.vx + (rtx - pt.x) * (p.spring || 0.05)) * (p.damping || 0.88);
    pt.vy = (pt.vy + (rty - pt.y) * (p.spring || 0.05)) * (p.damping || 0.88);
    pt.vz = (pt.vz + (rtz - pt.z) * (p.spring || 0.05)) * (p.damping || 0.88);
    pt.x += pt.vx; pt.y += pt.vy; pt.z += pt.vz;
    const zOff = pt.z + 200;
    const sc2 = FOCAL / (FOCAL + zOff);
    projected.push({{
      px: pt.x * sc2 + cx - lw / 2 * sc2,
      py: pt.y * sc2 + cy - lh / 2 * sc2,
      r: Math.max(pt.size * sc2 * 1.5, 0.3),
      z: zOff,
      a: p.depthFade ? Math.min(1, (zOff + 100) / 300) : 1
    }});
  }}
  projected.sort((a, b) => a.z - b.z);
  ctx.fillStyle = p.color;
  for (const pt of projected) {{
    ctx.globalAlpha = Math.max(0.15, Math.min(1, pt.a));
    ctx.beginPath(); ctx.arc(pt.px, pt.py, pt.r, 0, Math.PI * 2); ctx.fill();
  }}
  ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  animId = requestAnimationFrame(loop);
}}

init();
</script>
</body>
</html>"""

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