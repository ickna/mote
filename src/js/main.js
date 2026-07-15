// ═══════════════════════════════════════════════════════════════
// Mote — SVG-to-particle engine
// ═══════════════════════════════════════════════════════════════

// ── Embedded ickna logo SVG ───────────────────────────────────
const ICKNA_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4000 3000">
  <g transform="matrix(20.207,0,0,20.207,292.003,-186.173)">
    <path d="M136.86,63.78 C126,63.78 117.2,72.59 117.19,83.45 L117.19,96.45 C117.19,107.31 108.39,116.11 97.53,116.11 L84.53,116.11 C73.67,116.1 64.86,124.9 64.85,135.76 C64.84,146.62 73.64,155.43 84.5,155.44 L136.85,155.44 C147.71,155.44 156.51,146.63 156.52,135.77 L156.52,83.44 C156.52,72.58 147.72,63.78 136.86,63.78 Z"/>
    <path d="M84.53,11.44 L32.19,11.44 C21.33,11.44 12.53,20.25 12.52,31.11 L12.52,83.44 C12.52,94.3 21.32,103.11 32.19,103.11 C43.06,103.11 51.86,94.31 51.86,83.44 L51.86,70.44 C51.86,59.58 60.66,50.78 71.52,50.78 L84.52,50.78 C95.38,50.78 104.19,41.98 104.19,31.11 C104.19,20.24 95.39,11.44 84.53,11.44 Z"/>
    <circle cx="84.53" cy="83.44" r="19.67"/>
    <circle cx="32.19" cy="135.78" r="19.67"/>
    <circle cx="136.86" cy="31.11" r="19.67"/>
  </g>
</svg>`;

// ── Default Parameters ────────────────────────────────────────
const DEFAULT_PARAMS = {
  // Rotation
  yawSpeed: 0.5,
  pitchSpeed: 0.3,
  yawAmp: 0.262,
  pitchAmp: 0.08,
  autoPitch: false,
  // Particle motion
  spacing: 10,
  motionMode: 'lerp',
  lerpSpeed: 0.08,
  spring: 0.05,
  damping: 0.88,
  // Waves
  waveMode: 'am',
  waveAmp: 12,
  waveFreq: 0.002,
  zDispersion: 60,
  // Appearance
  sizeMin: 1.5,
  sizeMax: 7.5,
  sizeScale: 0.48,
  glowMode: 'texture',
  glowBlur: 3,
  depthFadeMode: 'ickna',
  depthFade: 0.6,
  color: '#e03030',
  colorSecondary: '#7b2ff7',
  colorMode: 'solid',
  scale: 0.90,
  renderMode: 'ickna',
  // Background & trail
  starfieldEnabled: true,
  trailAlpha: 0.34,
  // Effects
  flameEnabled: false,
  lightningEnabled: false,
  edgeLineAlpha: 0.4,
  // Misc
  transitionDuration: 800,
  lineThreshold: 60,
  // Animation
  anim: {},
  // Post-processing
  bloom: false,
  bloomIntensity: 0.4,
  vignette: false,
  colorGrade: 'none',
  // Audio reactivity
  audioEnabled: false,
  audioSource: 'mic',
  audioImpact: 0.5,
  // Interaction
  dragEnabled: false,
  // Nebula
  nebulaEnabled: false
};

// ═══════════════════════════════════════════════════════════════
// Color Helpers
// ═══════════════════════════════════════════════════════════════

const PALETTES = {
  custom: { name: 'Custom', colors: ['#e03030', '#7b2ff7'] },
  fire: { name: 'Fire', colors: ['#e03030', '#ff6b35', '#f7c59f'] },
  ocean: { name: 'Ocean', colors: ['#00d4ff', '#0077b6', '#023e8a'] },
  aurora: { name: 'Aurora', colors: ['#00ff87', '#60efff', '#7b2ff7'] },
  sunset: { name: 'Sunset', colors: ['#ff6b35', '#e03030', '#7b2ff7'] },
  neon: { name: 'Neon', colors: ['#ff00ff', '#00ffff', '#ffff00'] },
  monochrome: { name: 'Monochrome', colors: ['#e03030', '#901818', '#400808'] }
};

function hexToRgb(hex) {
  return { r: parseInt(hex.slice(1, 3), 16), g: parseInt(hex.slice(3, 5), 16), b: parseInt(hex.slice(5, 7), 16) };
}

function lerpRgb(rgb1, rgb2, t) {
  const t2 = Math.max(0, Math.min(1, t));
  return `rgb(${Math.round(rgb1.r + (rgb2.r - rgb1.r) * t2)},${Math.round(rgb1.g + (rgb2.g - rgb1.g) * t2)},${Math.round(rgb1.b + (rgb2.b - rgb1.b) * t2)})`;
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

// ═══════════════════════════════════════════════════════════════
// Animator — keyframe-based param animation
// ═══════════════════════════════════════════════════════════════

let animStartTime = 0;

function lerpColor(c1, c2, tVal) {
  const r1 = parseInt(c1.slice(1, 3), 16), g1 = parseInt(c1.slice(3, 5), 16), b1 = parseInt(c1.slice(5, 7), 16);
  const r2 = parseInt(c2.slice(1, 3), 16), g2 = parseInt(c2.slice(3, 5), 16), b2 = parseInt(c2.slice(5, 7), 16);
  const rt = Math.round(r1 + (r2 - r1) * tVal), gt = Math.round(g1 + (g2 - g1) * tVal), bt = Math.round(b1 + (b2 - b1) * tVal);
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
  const rp = { ...baseParams };
  for (const key in animDef) {
    const a = animDef[key];
    if (!a.keyframes || a.keyframes.length < 2) continue;
    const last = a.keyframes[a.keyframes.length - 1][0];
    let et = a.loop ? elapsed % last : Math.min(elapsed, last);
    let i = 0;
    while (i < a.keyframes.length - 1 && a.keyframes[i + 1][0] < et) i++;
    const t0 = a.keyframes[i][0], v0 = a.keyframes[i][1];
    const t1 = a.keyframes[i + 1][0], v1 = a.keyframes[i + 1][1];
    const raw = t1 > t0 ? Math.max(0, Math.min(1, (et - t0) / (t1 - t0))) : 0;
    const tVal = applyEasing(raw, a.easing || 'linear');
    if (typeof v0 === 'string' && v0[0] === '#') {
      rp[key] = lerpColor(v0, v1, tVal);
    } else {
      rp[key] = v0 + (v1 - v0) * tVal;
    }
  }
  return rp;
}

// ── State ─────────────────────────────────────────────────────
let params = { ...DEFAULT_PARAMS };
let sourceType = 'svg';   // 'svg' or 'image'
let particles = [];
let presetName = 'ickna';
let currentSVG = ICKNA_SVG;
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let W, H, DPR;
let logoCanvas = null;
let animId = null;
let engineReady = false;
let waveNodes = []; // extracted from SVG circles
let yawAngle = 0, pitchAngle = 0;
let yawSpd = 0, pitchSpd = 0;
let yRotEnabled = true;
const keys = {};
let edgeParticles = []; // edge particles for shimmer effect
let layers = [];           // multi-layer: [{name, svg, params, logoCanvas, particles, edgeParticles, waveNodes}]
let transition = null; // { startTime, duration, oldParticles, oldEdgeParticles }
let stars = [];
let lightningQueue = [];   // { idx, type:'edge'|'main', parentIdx, parentType, delay, hop }
let lightningBolts = [];   // { x1, y1, x2, y2, life }
let lightningPaths = [];   // { path, branches, progress, life, strikes }
let dragState = { active: false, startX: 0, startY: 0, moved: false };
const DRAG_SENSITIVITY = 0.008;
let playlist = [];
let playlistIndex = 0;
let playlistTimer = 0;
let isPlaylistPlaying = false;
let frameCount = 0;        // frame counter for throttling

// ── URL mode ──────────────────────────────────────────────────
const urlParams = new URLSearchParams(window.location.search);
const isPlayMode = urlParams.get('mode') === 'play';
const presetParam = urlParams.get('preset') || '';
const fpsLimit = parseInt(urlParams.get('fps')) || 0;
const hideOverlay = urlParams.has('hideOverlay');
const wsPort = parseInt(urlParams.get('ws')) || 0;
let wsConnection = null;
let wsConnected = false;
let lastFrameTime = 0;
const audioParam = urlParams.get('audio') || '';
const bgColor = urlParams.get('bgcolor') || '';
const fullscreenParam = urlParams.get('fullscreen') || '';

// ── Audio Reactivity ──────────────────────────────────────────
const AudioReactivity = {
  ctx: null,
  analyser: null,
  source: null,
  stream: null,
  bass: 0, mid: 0, treble: 0, energy: 0,
  bassPeak: false, lastBassPeak: 0,
  fftSize: 256,
  initialized: false,

  async init(sourceType) {
    if (this.initialized) return true;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      // Resume suspended context (browser autoplay policy)
      if (this.ctx.state === 'suspended') await this.ctx.resume();
    } catch (e) { console.warn('[mote] AudioContext failed:', e.message); return false; }

    try {
      if (sourceType === 'mic') {
        this.stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        this.source = this.ctx.createMediaStreamSource(this.stream);
      } else {
        // sourceType is an audio file URL or element selector
        const el = document.querySelector(sourceType) || document.getElementById(sourceType);
        if (!el) {
          const audio = new Audio();
          audio.src = sourceType;
          audio.loop = true;
          audio.crossOrigin = 'anonymous';
          document.body.appendChild(audio);
          this.source = this.ctx.createMediaElementSource(audio);
          audio.play().catch(() => {});
        } else {
          this.source = this.ctx.createMediaElementSource(el);
        }
      }
    } catch (e) {
      console.warn('[mote] audio source failed:', e.message);
      return false;
    }

    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = this.fftSize;
    this.source.connect(this.analyser);
    // Only connect to speakers for element sources, not mic (prevents feedback)
    if (sourceType !== 'mic') this.analyser.connect(this.ctx.destination);
    this.initialized = true;
    return true;
  },

  update() {
    if (!this.initialized || !this.analyser) return;
    const len = this.analyser.frequencyBinCount;
    const data = new Uint8Array(len);
    this.analyser.getByteFrequencyData(data);

    // Frequency bands (approximate with 256 fftSize, 44100 sample rate)
    // bin width = 44100/256 ≈ 172 Hz per bin
    // bass: bins 0-2  (0-516 Hz)
    // mid:  bins 3-11 (516-2067 Hz)
    // treble: bins 12-63 (2067-11025 Hz)
    let bass = 0, mid = 0, treble = 0, total = 0;
    for (let i = 0; i < 3 && i < len; i++) bass += data[i];
    for (let i = 3; i < 12 && i < len; i++) mid += data[i];
    for (let i = 12; i < len; i++) treble += data[i];
    bass /= 3 * 255;
    mid /= 9 * 255;
    treble /= (len - 12) * 255;
    for (let i = 0; i < len; i++) total += data[i];
    this.bass = bass;
    this.mid = mid;
    this.treble = treble;
    this.energy = total / (len * 255);

    // Beat detection: bass spike above threshold
    const now = performance.now();
    if (bass > 0.6 && now - this.lastBassPeak > 200) {
      this.bassPeak = true;
      this.lastBassPeak = now;
    } else {
      this.bassPeak = false;
    }
  },

  suspend() {
    if (this.ctx && this.ctx.state === 'running') this.ctx.suspend();
  },

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  },

  stop() {
    if (this.stream) this.stream.getTracks().forEach(t => t.stop());
    if (this.ctx) this.ctx.close();
    this.initialized = false;
  }
};

// ── Simplex Noise ─────────────────────────────────────────────
// SimplexNoise moved to core/noise.js


// ── Canvas resize ─────────────────────────────────────────────
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = W * DPR;
  canvas.height = H * DPR;
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
window.addEventListener('resize', resize);
resize();

// ═══════════════════════════════════════════════════════════════
// SVG Parser
// ═══════════════════════════════════════════════════════════════

const MoteSVG = {
  renderToCanvas(svgString, sampleSize) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgString, 'image/svg+xml');
    const svg = doc.querySelector('svg');
    if (!svg) return null;

    // Get viewBox
    let vb = svg.getAttribute('viewBox');
    let svgW, svgH;
    if (vb) {
      const parts = vb.split(/[\s,]+/).map(Number);
      svgW = parts[2] - parts[0];
      svgH = parts[3] - parts[1];
    } else {
      svgW = parseInt(svg.getAttribute('width')) || 400;
      svgH = parseInt(svg.getAttribute('height')) || 300;
    }

    const aspect = svgW / svgH;
    const c = document.createElement('canvas');
    c.width = sampleSize;
    c.height = Math.round(sampleSize / aspect);
    const tctx = c.getContext('2d');

    // Render SVG to canvas
    const img = new Image();
    const blob = new Blob([svgString], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);

    return new Promise((resolve) => {
      img.onload = () => {
        tctx.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        resolve({ canvas: c, width: c.width, height: c.height });
      };
      img.onerror = () => {
        // Fallback: try rendering paths directly
        URL.revokeObjectURL(url);
        resolve(this.renderPathsDirect(svgString, sampleSize, svgW, svgH));
      };
      img.src = url;
    });
  },

  renderPathsDirect(svgString, sampleSize, svgW, svgH) {
    // Fallback rendering — handles all SVG element types via Path2D/Canvas2D
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgString, 'image/svg+xml');
    const aspect = svgW / svgH;
    const cw = sampleSize;
    const ch = Math.round(sampleSize / aspect);
    const c = document.createElement('canvas');
    c.width = cw;
    c.height = ch;
    const tctx = c.getContext('2d');
    const s = cw / svgW;

    tctx.fillStyle = '#fff';
    tctx.strokeStyle = '#fff';
    tctx.lineWidth = 2;

    // Collect all drawable elements in document order (preserves z-order)
    const elements = doc.querySelectorAll('path, circle, rect, ellipse, polygon, polyline, line');

    for (const el of elements) {
      tctx.save();
      // Scale to SVG coordinate space first, then apply parent transforms
      tctx.scale(s, s);
      let parent = el.parentElement;
      while (parent && parent.tagName === 'g') {
        const t = parent.getAttribute('transform');
        if (t) this.applyTransform(tctx, t);
        parent = parent.parentElement;
      }
      this.drawElement(tctx, el);
      tctx.restore();
    }

    return { canvas: c, width: cw, height: ch };
  },

  drawElement(ctx, el) {
    const tag = el.tagName.toLowerCase();
    const fill = el.getAttribute('fill');
    const stroke = el.getAttribute('stroke');
    const strokeWidth = parseFloat(el.getAttribute('stroke-width')) || 1;
    const useStroke = fill === 'none' || fill === 'transparent' || tag === 'line';
    const useFill = !useStroke && stroke !== 'none';

    if (useStroke) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = Math.max(strokeWidth, 1);
    }

    switch (tag) {
      case 'path': {
        const d = el.getAttribute('d');
        if (!d) break;
        const p = new Path2D(d);
        if (useFill) ctx.fill(p);
        if (useStroke) ctx.stroke(p);
        break;
      }
      case 'circle': {
        const cx = parseFloat(el.getAttribute('cx')) || 0;
        const cy = parseFloat(el.getAttribute('cy')) || 0;
        const r = parseFloat(el.getAttribute('r')) || 0;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        if (useFill) ctx.fill();
        if (useStroke) ctx.stroke();
        break;
      }
      case 'rect': {
        const x = parseFloat(el.getAttribute('x')) || 0;
        const y = parseFloat(el.getAttribute('y')) || 0;
        const w = parseFloat(el.getAttribute('width'));
        const h = parseFloat(el.getAttribute('height'));
        if (!w || !h) break;
        const rx = parseFloat(el.getAttribute('rx')) || 0;
        const ry = parseFloat(el.getAttribute('ry')) || rx;
        ctx.beginPath();
        if (rx || ry) {
          ctx.roundRect(x, y, w, h, Math.min(rx, w / 2), Math.min(ry, h / 2));
        } else {
          ctx.rect(x, y, w, h);
        }
        if (useFill) ctx.fill();
        if (useStroke) ctx.stroke();
        break;
      }
      case 'ellipse': {
        const cx = parseFloat(el.getAttribute('cx')) || 0;
        const cy = parseFloat(el.getAttribute('cy')) || 0;
        const rx = parseFloat(el.getAttribute('rx')) || 0;
        const ry = parseFloat(el.getAttribute('ry')) || 0;
        if (!rx || !ry) break;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        if (useFill) ctx.fill();
        if (useStroke) ctx.stroke();
        break;
      }
      case 'polygon':
      case 'polyline': {
        const pts = el.getAttribute('points');
        if (!pts) break;
        const coords = pts.trim().split(/[,\s]+/).map(Number);
        ctx.beginPath();
        for (let i = 0; i < coords.length - 1; i += 2) {
          if (i === 0) ctx.moveTo(coords[i], coords[i + 1]);
          else ctx.lineTo(coords[i], coords[i + 1]);
        }
        if (tag === 'polygon') ctx.closePath();
        if (useFill) ctx.fill();
        if (useStroke) ctx.stroke();
        break;
      }
      case 'line': {
        const x1 = parseFloat(el.getAttribute('x1')) || 0;
        const y1 = parseFloat(el.getAttribute('y1')) || 0;
        const x2 = parseFloat(el.getAttribute('x2')) || 0;
        const y2 = parseFloat(el.getAttribute('y2')) || 0;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        break;
      }
    }
  },

  applyTransform(ctx, transformStr) {
    // Parse combined transforms: "translate(10,20) scale(2) rotate(45)"
    const re = /(\w+)\s*\(([^)]*)\)/g;
    let match;
    while ((match = re.exec(transformStr)) !== null) {
      const fn = match[1];
      const args = match[2].split(/[,\s]+/).map(Number).filter(n => !isNaN(n));
      switch (fn) {
        case 'matrix':
          if (args.length >= 6) ctx.transform(args[0], args[1], args[2], args[3], args[4], args[5]);
          break;
        case 'translate':
          ctx.translate(args[0] || 0, args[1] || 0);
          break;
        case 'rotate': {
          const angle = (args[0] || 0) * Math.PI / 180;
          if (args.length >= 3) {
            ctx.translate(args[1], args[2]);
            ctx.rotate(angle);
            ctx.translate(-args[1], -args[2]);
          } else {
            ctx.rotate(angle);
          }
          break;
        }
        case 'scale':
          ctx.scale(args[0] || 1, args[1] || args[0] || 1);
          break;
        case 'skewX':
          ctx.transform(1, 0, Math.tan((args[0] || 0) * Math.PI / 180), 1, 0, 0);
          break;
        case 'skewY':
          ctx.transform(1, Math.tan((args[0] || 0) * Math.PI / 180), 0, 1, 0, 0);
          break;
      }
    }
  },

  countShapes(svgString) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgString, 'image/svg+xml');
    return {
      paths: doc.querySelectorAll('path').length,
      circles: doc.querySelectorAll('circle').length,
      total: doc.querySelectorAll('path, circle, rect, ellipse, polygon, polyline').length
    };
  },

  getInfo(svgString) {
    const info = this.countShapes(svgString);
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgString, 'image/svg+xml');
    const svg = doc.querySelector('svg');
    const vb = svg ? svg.getAttribute('viewBox') : 'none';
    return `${info.paths} paths, ${info.circles} circles · viewBox: ${vb}`;
  }
};

// ═══════════════════════════════════════════════════════════════
// Engine
// ═══════════════════════════════════════════════════════════════

const FOCAL = 900;

// Pre-rendered glow texture (white, tinted at draw time)
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
  t.fillStyle = g;
  t.fillRect(0, 0, s * 2, s * 2);
  return c;
})();

function rotateX(y, z, angle) {
  const c = Math.cos(angle), s = Math.sin(angle);
  return { y: y * c - z * s, z: y * s + z * c };
}

function rotateY(x, z, angle) {
  const c = Math.cos(angle), s = Math.sin(angle);
  return { x: x * c - z * s, z: x * s + z * c };
}

// Combined Y then X rotation (landing page style)
function applyRotYawPitch(v, yaw, pitch) {
  const cosY = Math.cos(yaw), sinY = Math.sin(yaw);
  const cosP = Math.cos(pitch), sinP = Math.sin(pitch);
  const rx = v.x * cosY - v.z * sinY;
  const ry = v.y;
  const rz = v.x * sinY + v.z * cosY;
  return { x: rx, y: ry * cosP - rz * sinP, z: ry * sinP + rz * cosP };
}

// Sparkle system for main particles
function updateSparkles() {
  for (const pt of particles) {
    if (pt.sparkle <= 0) {
      if (Math.random() < 0.0002) pt.sparkle = 0.6 + Math.random() * 0.4;
    } else {
      pt.sparkle -= 0.02;
      if (pt.sparkle < 0) pt.sparkle = 0;
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// Render Modes
// ═══════════════════════════════════════════════════════════════

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
        ctx.beginPath();
        ctx.arc(pt.px, pt.py, pt.r, 0, Math.PI * 2);
        ctx.fill();
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
        const cx = Math.floor(pt.px / cellSize);
        const cy = Math.floor(pt.py / cellSize);
        const key = cx + ',' + cy;
        if (!grid.has(key)) grid.set(key, []);
        grid.get(key).push(i);
      }

      // Draw dots first
      ctx.shadowBlur = p.glowBlur;
      for (const pt of projected) {
        const c = getParticleColor(pt, p, rgb1, rgb2);
        ctx.fillStyle = c;
        ctx.shadowColor = c;
        ctx.globalAlpha = Math.max(0.15, Math.min(1, pt.alpha));
        ctx.beginPath();
        ctx.arc(pt.px, pt.py, pt.r * 0.6, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw connections
      ctx.shadowBlur = 0;
      ctx.lineWidth = 0.5;
      let drawn = 0;
      const maxLines = 200;
      const seen = new Set();

      for (let i = 0; i < projected.length && drawn < maxLines; i++) {
        const a = projected[i];
        const cx = Math.floor(a.px / cellSize);
        const cy = Math.floor(a.py / cellSize);
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
                ctx.beginPath();
                ctx.moveTo(a.px, a.py);
                ctx.lineTo(b.px, b.py);
                ctx.stroke();
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
    _lastFrame: 0,
    _edgeCache: null,
    _cacheKey: '',
    draw(ctx, projected, p, t) {
      const frameNum = Math.floor(t / 500); // recompute every ~500ms
      const cacheKey = frameNum + ':' + projected.length + ':' + (p.lineThreshold || 60);
      const rgb1 = hexToRgb(p.color);
      const rgb2 = p.colorSecondary && p.colorMode !== 'solid' ? hexToRgb(p.colorSecondary) : null;

      let edges;
      if (this._cacheKey === cacheKey && this._edgeCache) {
        edges = this._edgeCache;
      } else {
        edges = this._triangulate(projected, p.lineThreshold || 80);
        this._edgeCache = edges;
        this._cacheKey = cacheKey;
      }

      // Draw dots
      ctx.shadowBlur = p.glowBlur;
      for (const pt of projected) {
        const c = getParticleColor(pt, p, rgb1, rgb2);
        ctx.fillStyle = c;
        ctx.shadowColor = c;
        ctx.globalAlpha = Math.max(0.15, Math.min(1, pt.alpha));
        ctx.beginPath();
        ctx.arc(pt.px, pt.py, pt.r * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw mesh edges
      ctx.shadowBlur = 0;
      ctx.lineWidth = 0.5;
      for (let k = 0; k < edges.length; k += 2) {
        const i = edges[k], j = edges[k + 1];
        const a = projected[i], b = projected[j];
        const lineAlpha = Math.min(a.alpha, b.alpha) * 0.3;
        const midPt = { px: (a.px + b.px) / 2, py: (a.py + b.py) / 2, z: (a.z + b.z) / 2, phase: (a.phase + b.phase) / 2 };
        ctx.strokeStyle = getParticleColor(midPt, p, rgb1, rgb2);
        ctx.globalAlpha = lineAlpha;
        ctx.beginPath();
        ctx.moveTo(a.px, a.py);
        ctx.lineTo(b.px, b.py);
        ctx.stroke();
      }
    },

    _triangulate(pts, maxDist) {
      // Simple nearest-neighbor triangulation: connect each point to its 2 nearest neighbors within maxDist
      const edges = [];
      const maxPerPoint = 2;
      const totalEdges = Math.min(pts.length * maxPerPoint, 600);
      let count = 0;

      for (let i = 0; i < pts.length && count < totalEdges; i++) {
        const a = pts[i];
        const dists = [];
        for (let j = 0; j < pts.length; j++) {
          if (j === i) continue;
          const b = pts[j];
          const dx = a.px - b.px, dy = a.py - b.py;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d <= maxDist) dists.push({ j, d });
        }
        dists.sort((a, b) => a.d - b.d);
        for (let k = 0; k < Math.min(maxPerPoint, dists.length) && count < totalEdges; k++) {
          edges.push(i, dists[k].j);
          count++;
        }
      }
      return edges;
    }
  },

  glow: {
    name: 'Glow Field',
    _cache: null,
    draw(ctx, projected, p) {
      // Pre-render gradient canvases at different sizes
      if (!this._cache) {
        this._cache = {};
        const sizes = [2, 4, 8, 16, 32];
        for (const size of sizes) {
          const c = document.createElement('canvas');
          c.width = size * 2;
          c.height = size * 2;
          const t = c.getContext('2d');
          const grad = t.createRadialGradient(size, size, 0, size, size, size);
          grad.addColorStop(0, 'rgba(255,255,255,1)');
          grad.addColorStop(0.1, 'rgba(255,255,255,0.8)');
          grad.addColorStop(0.4, 'rgba(255,255,255,0.3)');
          grad.addColorStop(1, 'rgba(255,255,255,0)');
          t.fillStyle = grad;
          t.fillRect(0, 0, size * 2, size * 2);
          this._cache[size] = c;
        }
      }

      const rgb1 = hexToRgb(p.color);
      const rgb2 = p.colorSecondary && p.colorMode !== 'solid' ? hexToRgb(p.colorSecondary) : null;
      ctx.shadowBlur = 0;
      ctx.globalCompositeOperation = 'lighter';

      for (const pt of projected) {
        const size = Math.round(pt.r * 2);
        if (size < 1) continue;
        const snap = size <= 4 ? 4 : size <= 8 ? 8 : size <= 16 ? 16 : 32;
        const tex = this._cache[snap];
        if (!tex) continue;
        const c = getParticleColor(pt, p, rgb1, rgb2);
        // Draw a small colored dot, then additive blend the glow texture
        ctx.fillStyle = c;
        ctx.globalAlpha = Math.max(0.05, Math.min(0.4, pt.alpha));
        ctx.beginPath();
        ctx.arc(pt.px, pt.py, pt.r * 0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = Math.max(0.05, Math.min(0.4, pt.alpha));
        ctx.drawImage(tex, pt.px - snap, pt.py - snap, snap * 2, snap * 2);
      }

      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }
  }
};

function initStars() {
  const list = [];
  for (let layer = 0; layer < 2; layer++) {
    const count = 156 + layer * 78;
    const depth = 0.3 + layer * 0.4;
    for (let i = 0; i < count; i++) {
      list.push({
        x: Math.random() * W,
        y: Math.random() * H,
        r: 0.3 + Math.random() * (1.2 - layer * 0.4),
        a: 0.15 + Math.random() * (0.55 - layer * 0.15),
        depth: depth
      });
    }
  }
  stars = list;
}

function updateFlame() {
  if (!params.flameEnabled) return;
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
      if (ep.flame > 1.2) {
        for (const ni of ep.neighbors) { const n = edgeParticles[ni]; if (n.flame < 0.1 && ep.flame > 1.0) n.flame = 1.8; }
        for (const mi of ep.mainNeighbors) { const mp = particles[mi]; if (mp && mp.flame < 0.1) mp.flame = 1.5; }
      }
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

// Option C blackbody spectrum — fire: red→orange→gold→white, ice: white→blue→violet→red
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

// ── Lightning system ──────────────────────────────────────────
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
  let si = Math.floor(Math.random() * startPool.length);
  let ei = Math.floor(Math.random() * endPool.length);
  let tries = 0;
  while (ei === si && tries < 10) { ei = Math.floor(Math.random() * endPool.length); tries++; }
  const sp = startPool[si], ep = endPool[ei];
  if (!sp || !ep) return;
  const dx0 = ep.tx - sp.tx, dy0 = ep.ty - sp.ty;
  if (Math.sqrt(dx0 * dx0 + dy0 * dy0) < 100) return;

  // Greedy walk from start toward target
  const path = [{ tx: sp.tx, ty: sp.ty }];
  let cx = sp.tx, cy = sp.ty;
  const stepMin = 10, stepMax = 30;
  let stuck = 0;
  while (stuck < 50 && path.length < 80) {
    const tdx = ep.tx - cx, tdy = ep.ty - cy;
    const tdist = Math.sqrt(tdx * tdx + tdy * tdy);
    if (tdist < stepMax) { path.push({ tx: ep.tx, ty: ep.ty }); break; }
    let best = null, bestDist = tdist;
    const searchCount = Math.min(60, particles.length);
    for (let t = 0; t < searchCount; t++) {
      const r = Math.floor(Math.random() * particles.length);
      const mp = particles[r];
      if (!mp) continue;
      const dx2 = mp.tx - cx, dy2 = mp.ty - cy;
      const d2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
      if (d2 >= stepMin && d2 <= stepMax) {
        const dx3 = ep.tx - mp.tx, dy3 = ep.ty - mp.ty;
        const d3 = Math.sqrt(dx3 * dx3 + dy3 * dy3);
        if (d3 < bestDist) { bestDist = d3; best = mp; }
      }
    }
    for (const ep2 of edgeParticles) {
      const dx2 = ep2.tx - cx, dy2 = ep2.ty - cy;
      const d2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
      if (d2 >= stepMin && d2 <= stepMax) {
        const dx3 = ep.tx - ep2.tx, dy3 = ep.ty - ep2.ty;
        const d3 = Math.sqrt(dx3 * dx3 + dy3 * dy3);
        if (d3 < bestDist) { bestDist = d3; best = ep2; }
      }
    }
    if (best) { path.push({ tx: best.tx, ty: best.ty }); cx = best.tx; cy = best.ty; stuck = 0; }
    else { stuck++; }
  }
  if (path.length < 3) return;

  // Heat particles along the path
  for (const p of path) {
    for (const mp of particles) {
      const dx = mp.tx - p.tx, dy = mp.ty - p.ty;
      if (dx * dx + dy * dy < 100) { if (mp.flame < 0.6) mp.flame = 0.6; break; }
    }
  }

  // Trigger chain lightning from the start
  if (startType === 'edge') {
    edgeParticles[si].lightning = 1.0;
    lightningQueue.push({ idx: si, type: 'edge', parentIdx: null, parentType: null, delay: 0, hop: 0 });
  } else {
    for (const ep of edgeParticles) {
      const dx = sp.tx - ep.tx, dy = sp.ty - ep.ty;
      if (dx * dx + dy * dy < 5000) {
        ep.lightning = 1.0;
        lightningQueue.push({ idx: edgeParticles.indexOf(ep), type: 'edge', parentIdx: null, parentType: null, delay: 0, hop: 0 });
        break;
      }
    }
  }

  // Build branches
  const branches = [];
  const maxBranches = 4;
  let branchCount = 0;
  for (let s = 1; s < path.length - 1 && branchCount < maxBranches; s++) {
    if (Math.random() < 0.1) {
      const branch = [{ tx: path[s].tx, ty: path[s].ty }];
      let bcx = path[s].tx, bcy = path[s].ty;
      const bLen = 3 + Math.floor(Math.random() * 6);
      for (let bi = 0; bi < bLen; bi++) {
        let best = null, bestDist = Infinity;
        const bSearch = Math.min(80, particles.length);
        for (let t = 0; t < bSearch; t++) {
          const r = Math.floor(Math.random() * particles.length);
          const mp = particles[r];
          if (!mp) continue;
          const dx2 = mp.tx - bcx, dy2 = mp.ty - bcy;
          const d2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
          if (d2 >= 10 && d2 <= 30) {
            const tdx = path[s+1].tx - path[s].tx, tdy = path[s+1].ty - path[s].ty;
            const mdx = mp.tx - path[s].tx, mdy = mp.ty - path[s].ty;
            const dot = tdx * mdx + tdy * mdy;
            if (dot < 0 || Math.random() < 0.2) {
              if (d2 < bestDist) { bestDist = d2; best = mp; }
            }
          }
        }
        if (best) { branch.push({ tx: best.tx, ty: best.ty }); bcx = best.tx; bcy = best.ty; }
        else break;
      }
      if (branch.length >= 2) { branches.push(branch); branchCount++; }
    }
  }
  lightningPaths.push({ path, branches, progress: 0, life: 1.0, strikes: 0 });
}

function updateLightning() {
  // Process lightning queue — chain propagation
  for (let qi = 0; qi < lightningQueue.length; qi++) {
    const item = lightningQueue[qi];
    item.delay--;
    if (item.delay > 0) continue;

    let target = null;
    if (item.type === 'edge') target = edgeParticles[item.idx];
    else target = particles[item.idx];
    if (!target) { lightningQueue.splice(qi, 1); qi--; continue; }

    target.lightning = 1.0;
    if (item.type === 'main' && target.flame < 0.6) target.flame = 0.6;

    const nextHop = item.hop + 1;
    if (nextHop > 8) { lightningQueue.splice(qi, 1); qi--; continue; }

    // Record bolt arc from parent to child
    if (item.parentIdx !== null) {
      let parentPos = null;
      if (item.parentType === 'edge' && edgeParticles[item.parentIdx]) {
        parentPos = { tx: edgeParticles[item.parentIdx].tx, ty: edgeParticles[item.parentIdx].ty };
      } else if (item.parentType === 'main' && particles[item.parentIdx]) {
        parentPos = { tx: particles[item.parentIdx].tx, ty: particles[item.parentIdx].ty };
      }
      if (parentPos) {
        lightningBolts.push({ x1: parentPos.tx, y1: parentPos.ty, x2: target.tx, y2: target.ty, life: 1.0 });
      }
    }

    // Enqueue neighbors
    let enqueued = 0;
    let maxChildren = 1 + Math.floor(Math.random() * 2);
    if (item.type === 'edge') {
      for (const ni of target.neighbors) {
        if (enqueued >= maxChildren) break;
        if (edgeParticles[ni] && edgeParticles[ni].lightning < 0.1) {
          lightningQueue.push({ idx: ni, type: 'edge', parentIdx: item.idx, parentType: 'edge', delay: Math.floor(Math.random() * 2), hop: nextHop });
          enqueued++;
        }
      }
      enqueued = 0;
      maxChildren = 1 + Math.floor(Math.random() * 2);
      const shuffled = [...target.mainNeighbors].sort(() => Math.random() - 0.5);
      for (const mi of shuffled) {
        if (enqueued >= maxChildren) break;
        if (particles[mi] && particles[mi].lightning < 0.1) {
          lightningQueue.push({ idx: mi, type: 'main', parentIdx: item.idx, parentType: 'edge', delay: Math.floor(Math.random() * 2), hop: nextHop });
          enqueued++;
        }
      }
    } else {
      // Main particle: jump to nearby main or distant edge
      if (Math.random() < 0.5) {
        const radius2 = 400 + Math.random() * 1600;
        for (let t = 0; t < 25; t++) {
          const r = Math.floor(Math.random() * particles.length);
          const nmp = particles[r];
          if (nmp && nmp.lightning < 0.1 && nmp !== target) {
            const dx = target.tx - nmp.tx, dy = target.ty - nmp.ty;
            if (dx * dx + dy * dy < radius2) {
              lightningQueue.push({ idx: r, type: 'main', parentIdx: item.idx, parentType: 'main', delay: Math.floor(Math.random() * 2), hop: nextHop });
              if (Math.random() > 0.4) break;
            }
          }
        }
      }
      if (Math.random() < 0.25) {
        const ei = Math.floor(Math.random() * edgeParticles.length);
        const nep = edgeParticles[ei];
        if (nep && nep.lightning < 0.1) {
          const dx = target.tx - nep.tx, dy = target.ty - nep.ty;
          if (dx * dx + dy * dy > 2500 && dx * dx + dy * dy < 10000) {
            lightningQueue.push({ idx: ei, type: 'edge', parentIdx: item.idx, parentType: 'main', delay: Math.floor(Math.random() * 2), hop: nextHop });
          }
        }
      }
    }
    lightningQueue.splice(qi, 1);
    qi--;
  }

  // Decay lightning flashes
  for (const ep of edgeParticles) {
    if (ep.lightning > 0) { ep.lightning -= 0.08; if (ep.lightning < 0) ep.lightning = 0; }
  }
  for (const mp of particles) {
    if (mp.lightning > 0) { mp.lightning -= 0.08; if (mp.lightning < 0) mp.lightning = 0; }
  }

  // Decay bolt arcs
  for (let bi = lightningBolts.length - 1; bi >= 0; bi--) {
    lightningBolts[bi].life -= 0.12;
    if (lightningBolts[bi].life <= 0) lightningBolts.splice(bi, 1);
  }

  // Update guided lightning paths
  for (let pi = lightningPaths.length - 1; pi >= 0; pi--) {
    const lp = lightningPaths[pi];
    lp.progress += 0.32;
    if (lp.progress >= 1) {
      if (lp.strikes < 2 && Math.random() < 0.1) { lp.progress = 0; lp.strikes++; }
      else { lp.life -= 0.15; }
    }
    if (lp.life <= 0) lightningPaths.splice(pi, 1);
  }
}

// Decay-only variant — runs on off-frames when full update is throttled
function updateLightningDecay() {
  for (const ep of edgeParticles) {
    if (ep.lightning > 0) { ep.lightning -= 0.08; if (ep.lightning < 0) ep.lightning = 0; }
  }
  for (const mp of particles) {
    if (mp.lightning > 0) { mp.lightning -= 0.08; if (mp.lightning < 0) mp.lightning = 0; }
  }
  for (let bi = lightningBolts.length - 1; bi >= 0; bi--) {
    lightningBolts[bi].life -= 0.12;
    if (lightningBolts[bi].life <= 0) lightningBolts.splice(bi, 1);
  }
  for (let pi = lightningPaths.length - 1; pi >= 0; pi--) {
    const lp = lightningPaths[pi];
    lp.progress += 0.32;
    if (lp.progress >= 1) {
      if (lp.strikes < 2 && Math.random() < 0.1) { lp.progress = 0; lp.strikes++; }
      else { lp.life -= 0.15; }
    }
    if (lp.life <= 0) lightningPaths.splice(pi, 1);
  }
}

function drawStars() {
  ctx.fillStyle = '#ffffff';
  for (const s of stars) {
    const ox = yawAngle * 80 * s.depth;
    const oy = pitchAngle * 60 * s.depth;
    const sx = (s.x + ox + W) % W;
    const sy = (s.y + oy + H) % H;
    ctx.globalAlpha = s.a;
    ctx.beginPath();
    ctx.arc(sx, sy, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// ═══════════════════════════════════════════════════════════════
// Unified Frame — single rendering pipeline
// ═══════════════════════════════════════════════════════════════

let ppCache = null;
let nebulaCache = null;

// ── Nebula rendering (simplex noise masked to SVG shape) ──────
function renderNebula() {
  if (!logoCanvas) return;
  const tw = logoCanvas.width, th = logoCanvas.height;
  if (nebulaCache && nebulaCache.width === tw && nebulaCache.height === th) return;

  // Create blurred gas cloud from the logo
  const gas = document.createElement('canvas');
  gas.width = tw; gas.height = th;
  const gctx = gas.getContext('2d');
  gctx.filter = 'blur(12px)';
  gctx.drawImage(logoCanvas, 0, 0);
  gctx.filter = 'blur(8px)';
  gctx.globalAlpha = 0.6;
  gctx.drawImage(logoCanvas, 0, 0);
  gctx.filter = 'none';
  gctx.globalAlpha = 1;

  // Noise texture
  const noiseTex = document.createElement('canvas');
  noiseTex.width = tw; noiseTex.height = th;
  const nctx = noiseTex.getContext('2d');
  const imageData = nctx.createImageData(tw, th);
  const cell = Math.max(20, Math.floor(tw / 8));
  for (let y = 0; y < th; y++) {
    for (let x = 0; x < tw; x++) {
      const n = simplex.noise(x / cell, y / cell);
      const val = Math.max(0, Math.min(255, Math.round((n + 1) * 0.5 * 255)));
      const idx = (y * tw + x) * 4;
      imageData.data[idx] = val;
      imageData.data[idx+1] = val;
      imageData.data[idx+2] = val;
      imageData.data[idx+3] = 200;
    }
  }
  nctx.putImageData(imageData, 0, 0);

  // Composite: noise masked to gas cloud
  const combined = document.createElement('canvas');
  combined.width = tw; combined.height = th;
  const cctx = combined.getContext('2d');
  cctx.drawImage(noiseTex, 0, 0);
  cctx.globalCompositeOperation = 'destination-in';
  cctx.drawImage(gas, 0, 0);
  cctx.globalCompositeOperation = 'source-over';
  cctx.globalAlpha = 0.35;
  cctx.drawImage(gas, 0, 0);
  cctx.globalAlpha = 1;

  nebulaCache = combined;
}

function applyPostProcessing(p) {
  // Bloom: half-res blur + additive composite
  if (p.bloom && p.bloomIntensity > 0 && typeof ctx.filter !== 'undefined') {
    const hw = Math.ceil(W / 2), hh = Math.ceil(H / 2);
    if (!ppCache || ppCache.width !== hw || ppCache.height !== hh) {
      ppCache = document.createElement('canvas');
      ppCache.width = hw;
      ppCache.height = hh;
    }
    const pc = ppCache.getContext('2d');
    pc.clearRect(0, 0, hw, hh);
    pc.drawImage(canvas, 0, 0, W, H, 0, 0, hw, hh);
    pc.filter = 'blur(' + Math.round(4 + p.bloomIntensity * 10) + 'px)';
    pc.globalCompositeOperation = 'source-over';
    pc.drawImage(ppCache, 0, 0);
    pc.filter = 'none';
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = p.bloomIntensity * 0.6;
    ctx.drawImage(ppCache, 0, 0, hw, hh, 0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }

  // Vignette: radial gradient overlay
  if (p.vignette) {
    const cx = W / 2, cy = H / 2, r = Math.max(W, H) * 0.75;
    const grad = ctx.createRadialGradient(cx, cy, r * 0.3, cx, cy, r);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }

  // Color grade: CSS filter on canvas element (reset each frame)
  if (p.colorGrade && p.colorGrade !== 'none') {
    switch (p.colorGrade) {
      case 'warm': canvas.style.filter = 'brightness(1.05) saturate(1.2) sepia(0.15)'; break;
      case 'cool': canvas.style.filter = 'brightness(1.05) saturate(0.8) hue-rotate(-15deg)'; break;
      case 'dramatic': canvas.style.filter = 'brightness(1.1) contrast(1.2) saturate(1.3)'; break;
      default: canvas.style.filter = '';
    }
  } else {
    canvas.style.filter = '';
  }
}

function frame(t) {
  try {
    if (!particles.length || !logoCanvas) { animId = requestAnimationFrame(frame); return; }
    const p = animEvaluate(params, params.anim, t - animStartTime);

    // Reset CSS filter from previous frame's color grade
    canvas.style.filter = '';

    // Audio reactivity modulation
    if (p.audioEnabled && AudioReactivity.initialized) {
      AudioReactivity.update();
      const ai = p.audioImpact;
      p.waveAmp *= 1 + AudioReactivity.bass * ai * 2;
      p.yawSpeed *= 1 + AudioReactivity.mid * ai;
      p.glowBlur *= 1 + AudioReactivity.treble * ai * 3;
      p.sizeScale *= 1 + AudioReactivity.energy * ai * 0.5;
      if (AudioReactivity.bassPeak && ai > 0.3) {
        const idx = Math.floor(Math.random() * edgeParticles.length);
        if (edgeParticles[idx]) edgeParticles[idx].sparkle = 1.0;
      }
      // Update audio meter
      const mb = document.getElementById('audio-meter-bass');
      const mm = document.getElementById('audio-meter-mid');
      const mt = document.getElementById('audio-meter-treble');
      if (mb) mb.style.height = (4 + AudioReactivity.bass * 20) + 'px';
      if (mm) mm.style.height = (4 + AudioReactivity.mid * 20) + 'px';
      if (mt) mt.style.height = (4 + AudioReactivity.treble * 20) + 'px';
    }

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

    // Rotation with speed interpolation (landing page style)
    const ROT_SPEED = 0.025;
    const targetYawSpeed = (keys['ArrowLeft'] ? -1 : keys['ArrowRight'] ? 1 : 0) * ROT_SPEED;
    const targetPitchSpeed = (keys['ArrowUp'] ? -1 : keys['ArrowDown'] ? 1 : 0) * ROT_SPEED;
    yawSpd += (targetYawSpeed - yawSpd) * 0.15;
    pitchSpd += (targetPitchSpeed - pitchSpd) * 0.15;
    yawAngle += yawSpd;
    pitchAngle += pitchSpd;
    const autoYawOffset = yRotEnabled ? Math.sin(t * 0.0003 * p.yawSpeed * 2) * p.yawAmp : 0;
    const effectiveYaw = yawAngle + autoYawOffset;
    const pitch = p.autoPitch ? pitchAngle + Math.sin(t * 0.00015 * p.pitchSpeed * 0.7) * p.pitchAmp * 0.5 : pitchAngle * (0.5 + p.pitchSpeed);

    // Process held menu buttons (auto-repeat)
    processButtons();

    // Throttled updates: expensive subsystems run every N frames
    frameCount++;
    const every2 = frameCount % 2 === 0;
    const every3 = frameCount % 3 === 0;
    updateSparkles();                         // cheap, always run
    if (every2) { updateFlame(); updateLightning(); }  // expensive neighbor/queue ops
    else { updateLightningDecay(); }                    // cheap: just decay, no queue

    // ── Step 1: Clear ──
    ctx.clearRect(0, 0, W, H);

    // ── Step 1.5: Nebula background ──
    if (p.nebulaEnabled) {
      renderNebula();
      if (nebulaCache) {
        // Render nebula texture centered and scaled to logo bounds
        const naspect = nebulaCache.width / nebulaCache.height;
        let nw, nh;
        if (W / H > naspect) { nh = Math.min(H * 0.9, sc); nw = nh * naspect; }
        else { nw = Math.min(W * 0.9, sc); nh = nw / naspect; }
        const nx = (W - nw) / 2, ny = (H - nh) / 2;
        ctx.globalAlpha = 0.3;
        ctx.drawImage(nebulaCache, nx, ny, nw, nh);
        ctx.globalAlpha = 1;
      }
    }

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
    const LOGO_COLOR = p.color || '#e03030';

    for (const pt of particles) {
      // Wave motion
      let waveX, waveY, waveZ;
      if (p.waveMode === 'am') {
        const waScale = p.waveAmp / 12; // default waveAmp=12 gives 1x scale
        waveX = waScale * (3 + 2 * Math.sin(t * 0.0006 + pt.phase)) * Math.sin(t * 0.002 + pt.phase + pt.ty * 0.01);
        waveY = waScale * (3 + 2 * Math.sin(t * 0.0008 + pt.phase * 1.3)) * Math.cos(t * 0.0025 + pt.phase * 0.7 + pt.tx * 0.008);
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

      // Rotation (unified: always applyRotYawPitch)
      const rotated = applyRotYawPitch({x: targetX - lcx, y: targetY - lcy, z: targetZ}, effectiveYaw, pitch);
      const rtx = rotated.x + lcx, rty = rotated.y + lcy, rtz = rotated.z;

      // Motion (unified: lerp or spring)
      if (p.motionMode === 'lerp') {
        const ls = p.lerpSpeed * (1 + p.spring * 8); // spring boosts lerp speed
        pt.x += (rtx - pt.x) * ls;
        pt.y += (rty - pt.y) * ls;
        pt.z += (rtz - pt.z) * ls;
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
        depthFade = (0.5 + 0.5 * Math.max(0.625, 1 - (zOffset - 100) / 250)) * (0.3 + p.depthFade * 0.7);
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
      // Edge-to-main connection lines (spatial grid optimization)
      if (p.edgeLineAlpha > 0 && edgeParticles.length) {
        ctx.lineWidth = 2.0;
        const lineThreshold = 180;
        const cellSize = lineThreshold;
        const grid = new Map();

        // Build spatial grid of projected particles
        for (let i = 0; i < projected.length; i++) {
          const pp = projected[i];
          const cx = Math.floor(pp.px / cellSize), cy = Math.floor(pp.py / cellSize);
          const key = cx + ',' + cy;
          if (!grid.has(key)) grid.set(key, []);
          grid.get(key).push(i);
        }

        // Query grid for each edge particle (only check adjacent cells)
        for (const ep of edgeParticles) {
          const rotated = applyRotYawPitch({x: ep.tx - lcx, y: ep.ty - lcy, z: ep.tz}, effectiveYaw, pitch);
          const zOffset = rotated.z + 200;
          const ps = FOCAL / (FOCAL + zOffset);
          const esx = rotated.x * ps * baseS + cx;
          const esy = rotated.y * ps * baseS + cy;
          if (esx < -10 || esx > W + 10 || esy < -10 || esy > H + 10) continue;

          const ecx = Math.floor(esx / cellSize), ecy = Math.floor(esy / cellSize);
          const neighbors = [];
          const lineThreshold2 = lineThreshold * lineThreshold;

          // Check 9 adjacent cells
          for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
              const cell = grid.get((ecx + dx) + ',' + (ecy + dy));
              if (!cell) continue;
              for (const pi of cell) {
                const pp = projected[pi];
                const distX = esx - pp.px, distY = esy - pp.py;
                const dist2 = distX * distX + distY * distY;
                if (dist2 < lineThreshold2) {
                  neighbors.push({ x: pp.px, y: pp.py, dist: Math.sqrt(dist2), color: pp.pt ? (Math.abs(pp.pt.flame) > 0.01 ? getFlameColor(pp.pt.flame) : { r: 224, g: 48, b: 48 }) : { r: 224, g: 48, b: 48 } });
                }
              }
            }
          }

          neighbors.sort(function(a, b) { return a.dist - b.dist; });
          const eColor = Math.abs(ep.flame) > 0.01 ? getFlameColor(ep.flame) : { r: 224, g: 48, b: 48 };
          const mainLimit = Math.min(3, neighbors.length);
          for (let k = 0; k < mainLimit; k++) {
            const n = neighbors[k];
            ctx.globalAlpha = (1 - n.dist / lineThreshold) * p.edgeLineAlpha;
            ctx.strokeStyle = 'rgb(' + ((eColor.r + n.color.r) >> 1) + ',' + ((eColor.g + n.color.g) >> 1) + ',' + ((eColor.b + n.color.b) >> 1) + ')';
            ctx.beginPath();
            ctx.moveTo(esx, esy);
            ctx.lineTo(n.x, n.y);
            ctx.stroke();
          }
        }
      }

      // Core particles (skip cold)
      for (const pp of projected) {
        if (pp.pt && pp.pt.flame < -0.01) continue;
        ctx.globalAlpha = Math.max(0.3, Math.min(1, pp.alpha));
        ctx.fillStyle = LOGO_COLOR;
        ctx.beginPath();
        ctx.arc(pp.px, pp.py, Math.max(pp.r, 0.5), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Glow halos via glowTex
      if (p.glowMode === 'texture') {
        for (const pp of projected) {
          const glowSize = Math.max(pp.r * 6, 6) * (0.5 + p.glowBlur / 6);
          const tempScale = (pp.pt && pp.pt.flame < 0) ? Math.max(0.15, 1 + pp.pt.flame * 0.425) : 1;
          const adjGlowSize = glowSize * tempScale;
          ctx.globalAlpha = Math.max(0.2, Math.min(0.7, pp.alpha * 0.6));
          ctx.drawImage(glowTex, pp.px - adjGlowSize, pp.py - adjGlowSize, adjGlowSize * 2, adjGlowSize * 2);

          // Tint glow with particle color (or flame temperature color)
          if (pp.pt && Math.abs(pp.pt.flame) > 0.01) {
            const c = getFlameColor(pp.pt.flame);
            ctx.globalCompositeOperation = 'source-atop';
            ctx.globalAlpha = 0.5;
            ctx.fillStyle = 'rgb(' + c.r + ',' + c.g + ',' + c.b + ')';
            ctx.beginPath();
            ctx.arc(pp.px, pp.py, adjGlowSize, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = 1;
          } else {
            // Tint with base particle color
            ctx.globalCompositeOperation = 'source-atop';
            ctx.globalAlpha = 0.5;
            ctx.fillStyle = LOGO_COLOR;
            ctx.beginPath();
            ctx.arc(pp.px, pp.py, adjGlowSize, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = 1;
          }

          // Core color override for temperature
          if (pp.pt && Math.abs(pp.pt.flame) > 0.01) {
            const c = getFlameColor(pp.pt.flame);
            const coreScale = pp.pt.flame < 0 ? tempScale : 1;
            ctx.globalAlpha = Math.max(0.3, Math.min(1, pp.alpha));
            ctx.fillStyle = 'rgb(' + c.r + ',' + c.g + ',' + c.b + ')';
            ctx.beginPath();
            ctx.arc(pp.px, pp.py, Math.max(pp.r * coreScale, 0.5), 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
          }

          // Main-particle sparkles
          if (pp.pt && pp.pt.sparkle > 0.1) {
            ctx.globalAlpha = pp.pt.sparkle * 0.9;
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(pp.px, pp.py, pp.r * 0.8, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.globalAlpha = 1;
      } else if (p.glowMode === 'shadow') {
        ctx.shadowColor = p.color;
        ctx.shadowBlur = p.glowBlur;
        for (const pp of projected) {
          ctx.globalAlpha = Math.max(0.15, Math.min(1, pp.alpha));
          ctx.fillStyle = LOGO_COLOR;
          ctx.beginPath();
          ctx.arc(pp.px, pp.py, Math.max(pp.r, 0.5), 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
        // Flame halos for shadow mode
        if (p.flameEnabled) {
          for (const pp of projected) {
            if (pp.pt && Math.abs(pp.pt.flame) > 0.01) drawFlameHalo(ctx, pp.px, pp.py, pp.r, pp.pt.flame, 1);
          }
        }
      }

      // Edge shimmer (always on) — update sparkles then render
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
        ctx.beginPath();
        ctx.arc(sx, sy, 1.5 * ss, 0, Math.PI * 2);
        ctx.fill();
        if (ep.sparkle > 0.02) {
          const size = ep.sparkle * 1.4 * ss;
          ctx.globalAlpha = ep.sparkle * 0.35;
          ctx.drawImage(glowTex, sx - size * 4, sy - size * 4, size * 8, size * 8);
          ctx.globalAlpha = ep.sparkle * 0.9;
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(sx, sy, size, 0, Math.PI * 2);
          ctx.fill();
        }
        if (Math.abs(ep.flame) > 0.01) {
          const c = getFlameColor(ep.flame);
          ctx.globalAlpha = 0.9;
          ctx.fillStyle = 'rgb(' + c.r + ',' + c.g + ',' + c.b + ')';
          ctx.beginPath();
          ctx.arc(sx, sy, 1.5 * baseS, 0, Math.PI * 2);
          ctx.fill();
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

    // ── Step 5.5: Additional layers ──
    for (let li = 0; li < layers.length; li++) {
      const layer = layers[li];
      if (!layer.particles || !layer.logoCanvas) continue;
      const lp = layer.params;
      const lLOGO_COLOR = lp.color || '#e03030';

      // Project layer particles
      const lProj = [];
      for (const pt of layer.particles) {
        // Simple projection with same rotation
        const wx = (3 + 2 * Math.sin(t * 0.0006 + pt.phase)) * Math.sin(t * 0.002 + pt.phase + pt.ty * 0.01);
        const wy = (3 + 2 * Math.sin(t * 0.0008 + pt.phase * 1.3)) * Math.cos(t * 0.0025 + pt.phase * 0.7 + pt.tx * 0.008);
        const tx = pt.tx + wx, ty = pt.ty + wy, tz = 0;

        const rotated = applyRotYawPitch({x: tx - lcx, y: ty - lcy, z: tz}, effectiveYaw, pitch);
        const zOff = rotated.z + 200;
        const ps = FOCAL / (FOCAL + zOff);
        const sx = rotated.x * ps * baseS + cx;
        const sy = rotated.y * ps * baseS + cy;

        const sizePulse = 1.4 + 0.4 * Math.sin(t * 0.002 + pt.phase);
        const ss = Math.max(pt.size * ps * baseS * sizePulse * (lp.sizeScale || 0.48), 0.3);
        const df = 0.5 + 0.5 * Math.max(0.625, 1 - (zOff - 100) / 250);

        lProj.push({ px: sx, py: sy, r: ss, z: zOff, alpha: df });
      }
      lProj.sort(function(a, b) { return a.z - b.z; });

      // Render layer particles
      for (const pp of lProj) {
        ctx.globalAlpha = Math.max(0.3, Math.min(1, pp.alpha));
        ctx.fillStyle = lLOGO_COLOR;
        ctx.beginPath();
        ctx.arc(pp.px, pp.py, Math.max(pp.r, 0.5), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
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
        ctx.beginPath();
        ctx.moveTo(sx1, sy1);
        const jitterAmp = (5 + Math.random() * 8) * viewScale;
        for (let s = 1; s < segments; s++) {
          const tt = s / segments;
          const bx = sx1 + (sx2 - sx1) * tt;
          const by = sy1 + (sy2 - sy1) * tt;
          const jitter = (Math.random() - 0.5) * jitterAmp * (1 - tt * 0.3);
          ctx.lineTo(bx + jitter, by + jitter * 0.7);
        }
        ctx.lineTo(sx2, sy2);
        ctx.stroke();
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
            const jitter = (Math.random() - 0.5) * 6 * viewScale;
            ctx.lineTo(bx + jitter, by + jitter * 0.7);
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

    // ── Step 7: Preset transition (crossfade) ──
    if (transition) {
      const elapsed = t - transition.startTime;
      const progress = Math.min(1, elapsed / transition.duration);
      if (progress < 1 && transition.oldParticles.length) {
        const fadeAlpha = 1 - progress;
        const oldP = p;
        const oldProjected = [];
        for (const pt of transition.oldParticles) {
          let owaveX, owaveY, owaveZ;
          if (oldP.waveMode === 'am') {
            owaveX = (3 + 2 * Math.sin(t * 0.0006 + pt.phase)) * Math.sin(t * 0.002 + pt.phase + pt.ty * 0.01);
            owaveY = (3 + 2 * Math.sin(t * 0.0008 + pt.phase * 1.3)) * Math.cos(t * 0.0025 + pt.phase * 0.7 + pt.tx * 0.008);
            owaveZ = 0;
          } else {
            owaveX = oldP.waveAmp * Math.sin(t * oldP.waveFreq + pt.phase + pt.ty * 0.01);
            owaveY = oldP.waveAmp * 0.6 * Math.cos(t * oldP.waveFreq * 1.2 + pt.phase * 0.7 + pt.tx * 0.008);
            owaveZ = oldP.waveAmp * 1.5 * Math.sin(t * oldP.waveFreq * 0.9 + pt.phase * 1.1 + pt.ty * 0.006);
          }
          const otargetX = pt.tx + owaveX, otargetY = pt.ty + owaveY;
          const otargetZ = pt.tz + owaveZ;
          const ory = applyRotYawPitch({x: otargetX - lcx, y: otargetY - lcy, z: otargetZ}, effectiveYaw, pitch);
          if (oldP.motionMode === 'lerp') {
            pt.x += (ory.x + lcx - pt.x) * oldP.lerpSpeed;
            pt.y += (ory.y + lcy - pt.y) * oldP.lerpSpeed;
            pt.z += (ory.z - pt.z) * oldP.lerpSpeed;
          } else {
            pt.vx = (pt.vx + (ory.x + lcx - pt.x) * oldP.spring) * oldP.damping;
            pt.vy = (pt.vy + (ory.y + lcy - pt.y) * oldP.spring) * oldP.damping;
            pt.vz = (pt.vz + (ory.z - pt.z) * oldP.spring) * oldP.damping;
            pt.x += pt.vx; pt.y += pt.vy; pt.z += pt.vz;
          }
          const zOff = pt.z + 200;
          const sc2 = FOCAL / (FOCAL + zOff);
          oldProjected.push({
            px: (pt.x - lcx) * sc2 * baseS + cx,
            py: (pt.y - lcy) * sc2 * baseS + cy,
            r: Math.max(pt.size * sc2 * baseS * 1.5, 0.3),
            z: zOff,
            alpha: Math.max(0.15, Math.min(1, oldP.depthFadeMode === 'ickna' ? (0.5 + 0.5 * Math.max(0.625, 1 - (zOff - 100) / 250)) : (oldP.depthFade ? Math.min(1, (zOff + 100) / 300) : 1))) * fadeAlpha
          });
        }
        oldProjected.sort((a, b) => a.z - b.z);
        ctx.globalAlpha = 1;
        for (const op of oldProjected) {
          ctx.globalAlpha = Math.max(0.15, Math.min(1, op.alpha));
          ctx.fillStyle = LOGO_COLOR;
          ctx.beginPath();
          ctx.arc(op.px, op.py, Math.max(op.r, 0.5), 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
      if (progress >= 1) transition = null;
    }

    // ── Step 8: Playlist timer ──
    if (isPlaylistPlaying && playlist.length > 1 && !transition) {
      const elapsed = t - playlistTimer;
      const item = playlist[playlistIndex];
      if (item && elapsed >= (item.duration || 8) * 1000) {
        playlistIndex = (playlistIndex + 1) % playlist.length;
        playlistTimer = t;
        const next = playlist[playlistIndex];
        if (next) loadPreset(next);
      }
    }

    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    applyPostProcessing(p);
  } catch (e) {
    console.error('Mote frame error:', e);
  }
  animId = requestAnimationFrame(frame);
}

// ═══════════════════════════════════════════════════════════════
// Bootstrap
// ═══════════════════════════════════════════════════════════════

async function loadSVG(svgString, keepParticles) {
  currentSVG = svgString;
  nebulaCache = null;  // invalidate nebula cache on SVG change

  // Detect image data URIs
  if (svgString.startsWith('data:image/')) {
    sourceType = 'image';
    const img = new Image();
    return new Promise(function(resolve) {
      img.onload = function() {
        const sampleSize = 1000;
        const aspect = img.width / img.height;
        const c = document.createElement('canvas');
        c.width = sampleSize;
        c.height = Math.round(sampleSize / aspect);
        const tctx = c.getContext('2d');
        tctx.drawImage(img, 0, 0, c.width, c.height);
        logoCanvas = c;
        particles = sampleIckna(c);
        edgeParticles = [];
        waveNodes = [];
        engineReady = true;
        const infoEl = document.getElementById('svg-info');
        if (infoEl) infoEl.textContent = img.width + '×' + img.height + ' · ' + particles.length + ' particles';
        resolve();
      };
      img.src = svgString;
    });
  }

  sourceType = 'svg';
  const sampleSize = 1000;
  const result = await MoteSVG.renderToCanvas(svgString, sampleSize);
  if (!result) { console.error('SVG render failed'); return; }
  logoCanvas = result.canvas;
  particles = sampleIckna(result.canvas);
  // Compute edge distance for each particle
  computeEdgeDist(svgString);
  engineReady = true;

  // Update SVG info
  const infoEl = document.getElementById('svg-info');
  if (infoEl) infoEl.textContent = MoteSVG.getInfo(svgString) + ' · ' + particles.length + ' particles';
}

function computeEdgeDist(svgString) {
  // Parse SVG paths and find edge particles
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgString, 'image/svg+xml');
  const svg = doc.querySelector('svg');
  let svgW = 400, svgH = 300;
  const vb = svg ? svg.getAttribute('viewBox') : null;
  if (vb) { const pts = vb.split(/[,\s]+/).map(Number); svgW = pts[2] - pts[0]; svgH = pts[3] - pts[1]; }
  else { svgW = parseInt(svg.getAttribute('width')) || 400; svgH = parseInt(svg.getAttribute('height')) || 300; }

  // Extract transform matrix from <g> elements (applied to raw path/circle coords)
  // Collect all <g> transforms in document order
  const gElements = Array.from(doc.querySelectorAll('g'));
  let transformMatrix = [1, 0, 0, 1, 0, 0]; // identity
  for (const g of gElements) {
    const t = g.getAttribute('transform');
    if (t) {
      const match = t.match(/matrix\(\s*([-\d.e]+)\s*,\s*([-\d.e]+)\s*,\s*([-\d.e]+)\s*,\s*([-\d.e]+)\s*,\s*([-\d.e]+)\s*,\s*([-\d.e]+)\s*\)/);
      if (match) {
        const m = [parseFloat(match[1]), parseFloat(match[2]), parseFloat(match[3]), parseFloat(match[4]), parseFloat(match[5]), parseFloat(match[6])];
        // Compose: transformMatrix = m × transformMatrix
        const t0 = transformMatrix[0], t1 = transformMatrix[1], t2 = transformMatrix[2], t3 = transformMatrix[3], t4 = transformMatrix[4], t5 = transformMatrix[5];
        transformMatrix = [
          m[0]*t0 + m[2]*t1, m[1]*t0 + m[3]*t1,
          m[0]*t2 + m[2]*t3, m[1]*t2 + m[3]*t3,
          m[0]*t4 + m[2]*t5 + m[4], m[1]*t4 + m[3]*t5 + m[5]
        ];
      }
    }
  }
  // Transform raw SVG coords to viewBox coords, then scale to logoCanvas coords
  const logoScale = logoCanvas.width / svgW;
  const transformPoint = (x, y) => ({
    x: (transformMatrix[0]*x + transformMatrix[2]*y + transformMatrix[4]) * logoScale,
    y: (transformMatrix[1]*x + transformMatrix[3]*y + transformMatrix[5]) * logoScale
  });

  // Collect all paths and circles for isPointInPath (raw SVG coords)
  const paths = Array.from(doc.querySelectorAll('path')).map(p => p.getAttribute('d')).filter(Boolean).map(d => new Path2D(d));
  const circles = Array.from(doc.querySelectorAll('circle')).map(c => ({
    cx: parseFloat(c.getAttribute('cx')) || 0,
    cy: parseFloat(c.getAttribute('cy')) || 0,
    r: parseFloat(c.getAttribute('r')) || 0
  }));

  const tmpCanvas = document.createElement('canvas');
  const tmpCtx = tmpCanvas.getContext('2d');

  const inside = (x, y) => {
    for (const c of circles) { const dx = x - c.cx, dy = y - c.cy; if (dx * dx + dy * dy <= c.r * c.r) return true; }
    for (const p of paths) { if (tmpCtx.isPointInPath(p, x, y, 'evenodd')) return true; }
    return false;
  };

  // Sample edge grid in raw SVG coordinate space
  const edgeSpacing = 5;
  const edgeList = [];
  // Find bounding range of raw coords from circles + path approximations
  let rawMinX = Infinity, rawMaxX = -Infinity, rawMinY = Infinity, rawMaxY = -Infinity;
  for (const c of circles) {
    rawMinX = Math.min(rawMinX, c.cx - c.r); rawMaxX = Math.max(rawMaxX, c.cx + c.r);
    rawMinY = Math.min(rawMinY, c.cy - c.r); rawMaxY = Math.max(rawMaxY, c.cy + c.r);
  }
  // Expand slightly for paths
  rawMinX -= 10; rawMaxX += 10; rawMinY -= 10; rawMaxY += 10;
  
  const ec = Math.ceil((rawMaxX - rawMinX) / edgeSpacing);
  const er = Math.ceil((rawMaxY - rawMinY) / edgeSpacing);
  for (let gy = 1; gy < er - 1; gy++) {
    for (let gx = 1; gx < ec - 1; gx++) {
      const px = rawMinX + gx * edgeSpacing, py = rawMinY + gy * edgeSpacing;
      if (inside(px, py)) {
        if (!inside(px - edgeSpacing, py) || !inside(px + edgeSpacing, py) ||
            !inside(px, py - edgeSpacing) || !inside(px, py + edgeSpacing)) {
          // Transform to logoCanvas coordinate space
          const tp = transformPoint(px, py);
          edgeList.push({ tx: tp.x, ty: tp.y, rawTx: px, rawTy: py });
        }
      }
    }
  }

  // Store edge particles globally (for shimmer) and compute edge distance for each particle
  const logoW = logoCanvas.width, logoH = logoCanvas.height;
  const sx = logoW / svgW, sy = logoH / svgH;
  edgeParticles = edgeList.map(ep => ({
    tx: ep.tx, ty: ep.ty, tz: 0, sparkle: 0, flame: 0, lightning: 0, phase: Math.random() * Math.PI * 2, neighbors: [], mainNeighbors: []
  }));

  // Pre-compute edge particle neighbors for flame propagation
  const neighborDist = 50;
  for (let i = 0; i < edgeParticles.length; i++) {
    const a = edgeParticles[i];
    for (let j = i + 1; j < edgeParticles.length; j++) {
      const b = edgeParticles[j];
      const dx = a.tx - b.tx, dy = a.ty - b.ty;
      if (dx * dx + dy * dy < neighborDist * neighborDist) {
        a.neighbors.push(j); b.neighbors.push(i);
      }
    }
  }

  // Initialize flame on main particles
  for (const pt of particles) { pt.flame = 0; pt.lightning = 0; }

  // Pre-compute edge-to-main particle neighbors
  const fireSpreadDist = 40;
  for (const ep of edgeParticles) {
    for (let mi = 0; mi < particles.length; mi++) {
      const mp = particles[mi];
      const dx = ep.tx - mp.tx, dy = ep.ty - mp.ty;
      if (dx * dx + dy * dy < fireSpreadDist * fireSpreadDist) {
        ep.mainNeighbors.push(mi);
      }
    }
  }

  // Compute edge distance for each main particle (both in logoCanvas space now)
  for (const pt of particles) {
    let minDist = Infinity;
    for (const ep of edgeParticles) {
      const dx = pt.tx - ep.tx, dy = pt.ty - ep.ty;
      const d = dx * dx + dy * dy;
      if (d < minDist) minDist = d;
    }
    pt.edgeDist = Math.sqrt(minDist);
  }

  // Extract wave nodes from SVG circles (transform to logoCanvas space)
  waveNodes = circles.map(c => {
    const tp = transformPoint(c.cx, c.cy);
    return { x: tp.x, y: tp.y };
  });
}

function getWaveOrigin(t) {
  if (!waveNodes.length) return { x: 0, y: 0 };
  const cycle = (t * 0.00008) % waveNodes.length;
  const idx = Math.floor(cycle);
  const frac = cycle - idx;
  const a = waveNodes[idx];
  const b = waveNodes[(idx + 1) % waveNodes.length];
  return { x: a.x + (b.x - a.x) * frac, y: a.y + (b.y - a.y) * frac };
}

function sampleIckna(canvas) {
  const tw = canvas.width, th = canvas.height;
  const tctx = canvas.getContext('2d');
  const spacing = params.spacing || 10;
  const cols = Math.ceil(tw / spacing);
  const rows = Math.ceil(th / spacing);
  const list = [];
  const szMin = params.sizeMin || 1.5;
  const szMax = params.sizeMax || 7.5;
  for (let gy = 0; gy < rows; gy++) {
    for (let gx = 0; gx < cols; gx++) {
      const px = gx * spacing + spacing / 2;
      const py = gy * spacing + spacing / 2;
      const pixel = tctx.getImageData(Math.round(px), Math.round(py), 1, 1).data;
      if (pixel[3] > 30) {
        list.push({
          tx: px + (Math.random() - 0.5) * 6,
          ty: py + (Math.random() - 0.5) * 6,
          tz: 0,
          edgeDist: 0,
          flame: 0,
          lightning: 0,
          sparkle: 0,
          x: Math.cos(Math.random() * Math.PI * 2) * (500 + Math.random() * 1500),
          y: Math.sin(Math.random() * Math.PI * 2) * (500 + Math.random() * 1500),
          z: (Math.random() - 0.5) * 50,
          size: szMin + Math.pow(Math.random(), 2) * (szMax - szMin),
          phase: Math.random() * Math.PI * 2
        });
      }
    }
  }
  return list;
}

function resetParticles() {
  if (!logoCanvas) return;
  particles = sampleIckna(logoCanvas);
  computeEdgeDist(currentSVG);
}

function applyParams(newParams) {
  // Migrate old param names to new unified schema
  const migrated = { ...newParams };
  if ('trails' in migrated) { if (migrated.trails && !('trailAlpha' in migrated)) migrated.trailAlpha = 0.15; delete migrated.trails; }
  if ('edgeShimmer' in migrated) { delete migrated.edgeShimmer; } // always on now
  if ('starfield' in migrated) { if (!('starfieldEnabled' in migrated)) migrated.starfieldEnabled = migrated.starfield; delete migrated.starfield; }
  if ('edgeLines' in migrated) { if (migrated.edgeLines && !('edgeLineAlpha' in migrated)) migrated.edgeLineAlpha = 0.4; delete migrated.edgeLines; }
  if ('profile' in migrated) { delete migrated.profile; } // unified pipeline, no dispatch
  Object.assign(params, migrated);
  updateUI();
}

function getPreset() {
  const preset = {
    name: presetName,
    version: 2,
    svg: currentSVG,
    params: { ...params },
    anim: JSON.parse(JSON.stringify(params.anim || {}))
  };
  if (layers.length > 0) {
    preset.layers = layers.map(function(l) {
      return { name: l.name, svg: l.svg, params: l.params };
    });
  }
  return preset;
}

function loadPreset(preset) {
  // Save current state for transition
  if (engineReady && particles.length > 0) {
    transition = {
      startTime: performance.now(),
      duration: params.transitionDuration || 800,
      oldParticles: particles.map(pt => ({ ...pt })),
      oldEdgeParticles: edgeParticles.map(ep => ({ ...ep }))
    };
  }
  presetName = preset.name || 'unnamed';
  applyParams(preset.params || DEFAULT_PARAMS);
  if (preset.anim) params.anim = JSON.parse(JSON.stringify(preset.anim));
  animStartTime = performance.now();

  // Multi-layer: load each layer's SVG
  if (preset.layers && preset.layers.length > 0) {
    layers = preset.layers.map(function(l) {
      return { name: l.name || 'layer', svg: l.svg, params: { ...DEFAULT_PARAMS, ...(l.params || {}) }, logoCanvas: null, particles: null, edgeParticles: null, waveNodes: null };
    });
    // Load each layer asynchronously
    layers.forEach(function(layer) {
      loadLayer(layer);
    });
  } else {
    layers = [];
  }

  loadSVG(preset.svg || ICKNA_SVG);
  if (isPlayMode) {
    document.getElementById('player-preset-name').textContent = presetName;
  }
}

async function loadLayer(layer) {
  const result = await MoteSVG.renderToCanvas(layer.svg, 1000);
  if (!result) return;
  layer.logoCanvas = result.canvas;
  layer.particles = sampleIckna(result.canvas);
  // Each layer gets its own edge particles for shimmer
  const parser = new DOMParser();
  const doc = parser.parseFromString(layer.svg, 'image/svg+xml');
  const svg = doc.querySelector('svg');
  let svgW = 400, svgH = 300;
  if (svg) {
    const vb = svg.getAttribute('viewBox');
    if (vb) { const pts = vb.split(/[\\s,]+/).map(Number); svgW = pts[2]-pts[0]; svgH = pts[3]-pts[1]; }
    else { svgW = parseInt(svg.getAttribute('width'))||400; svgH = parseInt(svg.getAttribute('height'))||300; }
  }
  layer.edgeParticles = [];
  layer.waveNodes = [];
}

// ═══════════════════════════════════════════════════════════════
// Editor UI
// ═══════════════════════════════════════════════════════════════

const paramBindings = [
  { id: 'yawSpeed', el: 'p-yawSpeed', val: 'v-yawSpeed', min: 0, max: 2, step: 0.01 },
  { id: 'pitchSpeed', el: 'p-pitchSpeed', val: 'v-pitchSpeed', min: 0, max: 1, step: 0.01 },
  { id: 'yawAmp', el: 'p-yawAmp', val: 'v-yawAmp', min: 0, max: 0.5, step: 0.005 },
  { id: 'pitchAmp', el: 'p-pitchAmp', val: 'v-pitchAmp', min: 0, max: 0.5, step: 0.01 },
  { id: 'spacing', el: 'p-spacing', val: 'v-spacing', min: 4, max: 30, step: 1 },
  { id: 'spring', el: 'p-spring', val: 'v-spring', min: 0.01, max: 0.2, step: 0.005 },
  { id: 'damping', el: 'p-damping', val: 'v-damping', min: 0.5, max: 0.98, step: 0.01 },
  { id: 'lerpSpeed', el: 'p-lerpSpeed', val: 'v-lerpSpeed', min: 0.02, max: 0.2, step: 0.005 },
  { id: 'waveAmp', el: 'p-waveAmp', val: 'v-waveAmp', min: 0, max: 40, step: 1 },
  { id: 'waveFreq', el: 'p-waveFreq', val: 'v-waveFreq', min: 0, max: 0.01, step: 0.0001 },
  { id: 'zDispersion', el: 'p-zDispersion', val: 'v-zDispersion', min: 0, max: 200, step: 1 },
  { id: 'sizeMin', el: 'p-sizeMin', val: 'v-sizeMin', min: 0.5, max: 8, step: 0.5 },
  { id: 'sizeMax', el: 'p-sizeMax', val: 'v-sizeMax', min: 1, max: 16, step: 0.5 },
  { id: 'sizeScale', el: 'p-sizeScale', val: 'v-sizeScale', min: 0.1, max: 3, step: 0.02 },
  { id: 'glowBlur', el: 'p-glowBlur', val: 'v-glowBlur', min: 0, max: 20, step: 1 },
  { id: 'depthFade', el: 'p-depthFade', val: 'v-depthFade', min: 0, max: 1, step: 0.05 },
  { id: 'scale', el: 'p-scale', val: 'v-scale', min: 0.1, max: 1.5, step: 0.05 },
  { id: 'trailAlpha', el: 'p-trailAlpha', val: 'v-trailAlpha', min: 0, max: 0.5, step: 0.01 },
  { id: 'edgeLineAlpha', el: 'p-edgeLineAlpha', val: 'v-edgeLineAlpha', min: 0, max: 1, step: 0.02 },
  { id: 'lineThreshold', el: 'p-lineThreshold', val: 'v-lineThreshold', min: 20, max: 200, step: 2 },
  { id: 'transitionDuration', el: 'p-transitionDuration', val: 'v-transitionDuration', min: 0, max: 3000, step: 100 }
];

function initUI() {
  if (isPlayMode) return;

  document.body.classList.remove('mode-play');

  // Init sliders
  for (const b of paramBindings) {
    const input = document.getElementById(b.el);
    const display = document.getElementById(b.val);
    if (!input) continue;
    input.min = b.min;
    input.max = b.max;
    input.step = b.step;
    input.value = params[b.id];
    display.textContent = formatVal(params[b.id], b.step);
    input.addEventListener('input', () => {
      const val = parseFloat(input.value);
      params[b.id] = val;
      display.textContent = formatVal(val, b.step);
      if (b.id === 'spacing') resetParticles();
    });
  }

  // Color picker
  const colorInput = document.getElementById('p-color');
  const colorVal = document.getElementById('v-color');
  if (colorInput) {
    colorInput.value = params.color;
    colorVal.textContent = params.color;
    colorInput.addEventListener('input', () => {
      params.color = colorInput.value;
      colorVal.textContent = colorInput.value;
    });
  }

  // Render mode select
  const modeSelect = document.getElementById('p-renderMode');
  if (modeSelect) {
    modeSelect.value = params.renderMode;
    updateLineThresholdVisibility(params.renderMode);
    modeSelect.addEventListener('change', () => {
      params.renderMode = modeSelect.value;
      updateLineThresholdVisibility(params.renderMode);
    });
  }

  // Selects for unified params
  const bindSelect = (id, paramKey) => {
    const el = document.getElementById(id);
    if (el) {
      el.value = params[paramKey];
      el.addEventListener('change', () => { params[paramKey] = el.value; updateConditionalUI(); });
    }
  };
  bindSelect('p-glowMode', 'glowMode');
  bindSelect('p-depthFadeMode', 'depthFadeMode');
  bindSelect('p-motionMode', 'motionMode');
  bindSelect('p-waveMode', 'waveMode');

  // Auto Pitch checkbox
  const autoPitchCheck = document.getElementById('p-autoPitch');
  const autoPitchLabel = document.getElementById('v-autoPitch');
  if (autoPitchCheck) {
    autoPitchCheck.checked = params.autoPitch;
    autoPitchLabel.textContent = params.autoPitch ? 'On' : 'Off';
    autoPitchCheck.addEventListener('change', () => {
      params.autoPitch = autoPitchCheck.checked;
      autoPitchLabel.textContent = autoPitchCheck.checked ? 'On' : 'Off';
      updateConditionalUI();
    });
  }

  // Starfield checkbox
  const starfieldCheck = document.getElementById('p-starfieldEnabled');
  const starfieldLabel = document.getElementById('v-starfieldEnabled');
  if (starfieldCheck) {
    starfieldCheck.checked = params.starfieldEnabled;
    starfieldLabel.textContent = params.starfieldEnabled ? 'On' : 'Off';
    starfieldCheck.addEventListener('change', () => {
      params.starfieldEnabled = starfieldCheck.checked;
      starfieldLabel.textContent = starfieldCheck.checked ? 'On' : 'Off';
      if (starfieldCheck.checked) initStars();
    });
  }

  // Flame FX checkbox
  const flameCheck = document.getElementById('p-flameEnabled');
  const flameLabel = document.getElementById('v-flameEnabled');
  if (flameCheck) {
    flameCheck.checked = params.flameEnabled;
    flameLabel.textContent = params.flameEnabled ? 'On' : 'Off';
    flameCheck.addEventListener('change', () => {
      params.flameEnabled = flameCheck.checked;
      flameLabel.textContent = flameCheck.checked ? 'On' : 'Off';
    });
  }

  // Lightning checkbox
  const lightningCheck = document.getElementById('p-lightningEnabled');
  const lightningLabel = document.getElementById('v-lightningEnabled');
  if (lightningCheck) {
    lightningCheck.checked = params.lightningEnabled;
    lightningLabel.textContent = params.lightningEnabled ? 'On' : 'Off';
    lightningCheck.addEventListener('change', () => {
      params.lightningEnabled = lightningCheck.checked;
      lightningLabel.textContent = lightningCheck.checked ? 'On' : 'Off';
    });
  }

  // Post-processing controls
  const cbPP = (id, key) => {
    const c = document.getElementById('p-' + id);
    const l = document.getElementById('v-' + id);
    if (c) {
      c.checked = params[key];
      if (l) l.textContent = params[key] ? 'On' : 'Off';
      c.addEventListener('change', () => {
        params[key] = c.checked;
        if (l) l.textContent = c.checked ? 'On' : 'Off';
      });
    }
  };
  cbPP('bloom', 'bloom');
  cbPP('vignette', 'vignette');

  const bloomSlider = document.getElementById('p-bloomIntensity');
  if (bloomSlider) {
    bloomSlider.value = params.bloomIntensity;
    document.getElementById('v-bloomIntensity').textContent = formatVal(params.bloomIntensity, 0.05);
    bloomSlider.addEventListener('input', () => {
      params.bloomIntensity = parseFloat(bloomSlider.value);
      document.getElementById('v-bloomIntensity').textContent = formatVal(params.bloomIntensity, 0.05);
    });
  }

  const gradeSelect = document.getElementById('p-colorGrade');
  if (gradeSelect) {
    gradeSelect.value = params.colorGrade;
    gradeSelect.addEventListener('change', () => {
      params.colorGrade = gradeSelect.value;
    });
  }

  // Audio reactivity controls
  const audioCheck = document.getElementById('p-audioEnabled');
  const audioLabel = document.getElementById('v-audioEnabled');
  if (audioCheck) {
    audioCheck.checked = params.audioEnabled;
    audioLabel.textContent = params.audioEnabled ? 'On' : 'Off';
    audioCheck.addEventListener('change', async () => {
      params.audioEnabled = audioCheck.checked;
      audioLabel.textContent = audioCheck.checked ? 'On' : 'Off';
      if (audioCheck.checked) {
        const ok = await AudioReactivity.init(params.audioSource);
        if (!ok) {
          params.audioEnabled = false;
          audioCheck.checked = false;
          audioLabel.textContent = 'Off';
          alert('Audio init failed. Mic requires HTTPS or localhost.\nTry "Audio Element" source with an audio file instead.');
        }
      } else {
        AudioReactivity.suspend();
      }
    });
  }

  const audioSourceSelect = document.getElementById('p-audioSource');
  if (audioSourceSelect) {
    audioSourceSelect.value = params.audioSource;
    audioSourceSelect.addEventListener('change', () => {
      params.audioSource = audioSourceSelect.value;
    });
  }

  const audioImpactSlider = document.getElementById('p-audioImpact');
  if (audioImpactSlider) {
    audioImpactSlider.value = params.audioImpact;
    document.getElementById('v-audioImpact').textContent = formatVal(params.audioImpact, 0.05);
    audioImpactSlider.addEventListener('input', () => {
      params.audioImpact = parseFloat(audioImpactSlider.value);
      document.getElementById('v-audioImpact').textContent = formatVal(params.audioImpact, 0.05);
    });
  }

  // Drag rotation toggle
  const dragCheck = document.getElementById('p-dragEnabled');
  const dragLabel = document.getElementById('v-dragEnabled');
  if (dragCheck) {
    dragCheck.checked = params.dragEnabled;
    dragLabel.textContent = params.dragEnabled ? 'On' : 'Off';
    dragCheck.addEventListener('change', () => {
      params.dragEnabled = dragCheck.checked;
      dragLabel.textContent = dragCheck.checked ? 'On' : 'Off';
      if (window.setDragEnabled) window.setDragEnabled(dragCheck.checked);
    });
  }

  // Nebula toggle
  const nebulaCheck = document.getElementById('p-nebulaEnabled');
  const nebulaLabelN = document.getElementById('v-nebulaEnabled');
  if (nebulaCheck) {
    nebulaCheck.checked = params.nebulaEnabled;
    nebulaLabelN.textContent = params.nebulaEnabled ? 'On' : 'Off';
    nebulaCheck.addEventListener('change', () => {
      params.nebulaEnabled = nebulaCheck.checked;
      nebulaLabelN.textContent = nebulaCheck.checked ? 'On' : 'Off';
    });
  }

  // Color mode select
  const colorModeSelect = document.getElementById('p-colorMode');
  if (colorModeSelect) {
    colorModeSelect.value = params.colorMode;
    updateSecondaryColorVisibility(params.colorMode);
    colorModeSelect.addEventListener('change', () => {
      params.colorMode = colorModeSelect.value;
      updateSecondaryColorVisibility(params.colorMode);
    });
  }

  // Secondary color picker
  const color2Input = document.getElementById('p-colorSecondary');
  const color2Val = document.getElementById('v-colorSecondary');
  if (color2Input) {
    color2Input.value = params.colorSecondary;
    color2Val.textContent = params.colorSecondary;
    color2Input.addEventListener('input', () => {
      params.colorSecondary = color2Input.value;
      color2Val.textContent = color2Input.value;
    });
  }

  // Palette select
  const paletteSelect = document.getElementById('p-palette');
  if (paletteSelect) {
    paletteSelect.value = 'custom';
    paletteSelect.addEventListener('change', () => {
      const pal = PALETTES[paletteSelect.value];
      if (pal && pal.colors.length >= 2) {
        params.color = pal.colors[0];
        params.colorSecondary = pal.colors[1] || pal.colors[0];
        document.getElementById('p-color').value = params.color;
        document.getElementById('v-color').textContent = params.color;
        document.getElementById('p-colorSecondary').value = params.colorSecondary;
        document.getElementById('v-colorSecondary').textContent = params.colorSecondary;
        paletteSelect.value = 'custom'; // reset to custom after applying
      }
    });
  }

  // Tab switching
  document.querySelectorAll('.panel-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.panel-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.panel-tab-content').forEach(c => c.style.display = 'none');
      tab.classList.add('active');
      const content = document.querySelector(`.panel-tab-content[data-tab="${tab.dataset.tab}"]`);
      if (content) content.style.display = '';
    });
  });

  // SVG drop zone
  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('svg-file-input');
  if (dropZone && fileInput) {
    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
      const file = e.dataTransfer.files[0];
      if (file && file.name.endsWith('.svg')) handleSVGFile(file);
    });
    fileInput.addEventListener('change', () => {
      if (fileInput.files[0]) handleSVGFile(fileInput.files[0]);
    });
  }

  // Reset to ickna
  document.getElementById('btn-load-ickna')?.addEventListener('click', () => {
    loadSVG(ICKNA_SVG);
    document.getElementById('svg-filename').style.display = 'none';
    document.querySelector('.drop-zone p').style.display = '';
  });

  // Reset particles
  document.getElementById('btn-reset-particles')?.addEventListener('click', resetParticles);

  // Reset defaults
  document.getElementById('btn-reset-defaults')?.addEventListener('click', () => {
    applyParams(DEFAULT_PARAMS);
    resetParticles();
  });

  // Save preset
  document.getElementById('btn-save-preset')?.addEventListener('click', () => {
    const name = prompt('Preset name:', presetName);
    if (!name) return;
    presetName = name;
    const preset = getPreset();
    savePresetToLocal(preset);
    renderPresetList();
  });

  // Export preset
  document.getElementById('btn-export-preset')?.addEventListener('click', () => {
    const preset = getPreset();
    const blob = new Blob([JSON.stringify(preset, null, 2)], { type: 'application/json' });
    downloadBlob(blob, `${preset.name || 'mote-preset'}.json`);
  });

  // Import preset
  document.getElementById('btn-import-preset')?.addEventListener('click', () => {
    document.getElementById('preset-file-input').click();
  });
  document.getElementById('preset-file-input')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const preset = JSON.parse(reader.result);
        loadPreset(preset);
        renderPresetList();
      } catch (err) {
        alert('Invalid preset file');
      }
    };
    reader.readAsText(file);
  });

  // Export HTML
  document.getElementById('btn-export-html')?.addEventListener('click', exportPlaybackHTML);

  // Panel collapse
  const panel = document.getElementById('editor-panel');
  const toggle = document.getElementById('panel-toggle');
  toggle?.addEventListener('click', () => {
    panel.classList.toggle('collapsed');
    toggle.textContent = panel.classList.contains('collapsed') ? '▶' : '◀';
  });

  // Render preset list
  renderPresetList();

  // Timeline controls
  document.getElementById('btn-playlist-add')?.addEventListener('click', () => {
    const preset = getPreset();
    playlist.push({ name: preset.name, duration: 8, svg: preset.svg, params: { ...preset.params } });
    renderPlaylist();
  });
  document.getElementById('btn-playlist-play')?.addEventListener('click', () => {
    if (playlist.length > 1) {
      isPlaylistPlaying = true;
      playlistTimer = performance.now();
    }
  });
  document.getElementById('btn-playlist-pause')?.addEventListener('click', () => {
    isPlaylistPlaying = false;
  });
  document.getElementById('btn-playlist-stop')?.addEventListener('click', () => {
    isPlaylistPlaying = false;
    playlistIndex = 0;
  });
  document.getElementById('btn-playlist-clear')?.addEventListener('click', () => {
    playlist = [];
    playlistIndex = 0;
    isPlaylistPlaying = false;
    renderPlaylist();
  });
  renderPlaylist();
  updateConditionalUI();

  // Animation tab
  const animParamSelect = document.getElementById('anim-param-select');
  if (animParamSelect) {
    // Populate param list from paramBindings + color
    for (const b of paramBindings) {
      const opt = document.createElement('option');
      opt.value = b.id;
      opt.textContent = b.id.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
      animParamSelect.appendChild(opt);
    }
    ['color', 'colorSecondary'].forEach(id => {
      const opt = document.createElement('option');
      opt.value = id;
      opt.textContent = id === 'color' ? 'Primary Color' : 'Secondary Color';
      animParamSelect.appendChild(opt);
    });

    animParamSelect.addEventListener('change', () => {
      const key = animParamSelect.value;
      if (!key) {
        document.getElementById('anim-editor').style.display = 'none';
        return;
      }
      document.getElementById('anim-editor').style.display = 'block';
      document.getElementById('anim-editor-title').textContent = 'Keyframes: ' + animParamSelect.selectedOptions[0].textContent;
      if (!params.anim[key]) params.anim[key] = { keyframes: [], easing: 'linear', loop: false };
      const a = params.anim[key];
      document.getElementById('anim-easing').value = a.easing || 'linear';
      document.getElementById('anim-loop').checked = a.loop || false;
      renderAnimKeyframes();
    });

    document.getElementById('btn-anim-add')?.addEventListener('click', () => {
      const key = animParamSelect.value;
      if (!key) return;
      if (!params.anim[key]) params.anim[key] = { keyframes: [], easing: 'linear', loop: false };
      const a = params.anim[key];
      const currentTime = performance.now() - animStartTime;
      const val = key === 'color' || key === 'colorSecondary' ? params[key] : (params[key] || 0);
      a.keyframes.push([Math.round(currentTime), val]);
      a.keyframes.sort((a, b) => a[0] - b[0]);
      renderAnimKeyframes();
    });

    document.getElementById('btn-anim-clear')?.addEventListener('click', () => {
      const key = animParamSelect.value;
      if (!key) return;
      if (params.anim[key]) { params.anim[key].keyframes = []; renderAnimKeyframes(); }
    });

    document.getElementById('anim-easing')?.addEventListener('change', () => {
      const key = animParamSelect.value;
      if (!key || !params.anim[key]) return;
      params.anim[key].easing = document.getElementById('anim-easing').value;
    });

    document.getElementById('anim-loop')?.addEventListener('change', () => {
      const key = animParamSelect.value;
      if (!key || !params.anim[key]) return;
      params.anim[key].loop = document.getElementById('anim-loop').checked;
    });
  }
}

function renderAnimKeyframes() {
  const key = document.getElementById('anim-param-select')?.value;
  if (!key || !params.anim[key]) return;
  const a = params.anim[key];
  const container = document.getElementById('anim-keyframes');
  if (!container) return;
  container.innerHTML = '';
  if (!a.keyframes.length) {
    container.innerHTML = '<div style="opacity:.3;font-size:11px;padding:4px 0">No keyframes</div>';
    return;
  }
  const isColor = key === 'color' || key === 'colorSecondary';
  a.keyframes.forEach((kf, i) => {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:6px;padding:4px 6px;margin-bottom:3px;border:1px solid var(--border);border-radius:4px;font-size:11px';
    const timeLabel = document.createElement('span');
    timeLabel.textContent = (kf[0] / 1000).toFixed(1) + 's';
    timeLabel.style.cssText = 'flex:0 0 48px;opacity:.5;font-variant-numeric:tabular-nums';
    const valInput = document.createElement(isColor ? 'input' : 'input');
    if (isColor) {
      valInput.type = 'color';
      valInput.value = kf[1];
      valInput.style.cssText = 'width:28px;height:22px;border:1px solid var(--border);border-radius:3px;padding:0;cursor:pointer;background:none';
      valInput.addEventListener('input', () => { a.keyframes[i][1] = valInput.value; });
    } else {
      valInput.type = 'number';
      valInput.value = kf[1];
      valInput.step = 'any';
      valInput.style.cssText = 'flex:1;background:var(--bg);color:var(--fg);border:1px solid var(--border);border-radius:3px;padding:2px 6px;font-size:11px;font-family:inherit;width:60px';
      valInput.addEventListener('input', () => { a.keyframes[i][1] = parseFloat(valInput.value) || 0; });
    }
    const delBtn = document.createElement('button');
    delBtn.textContent = '✕';
    delBtn.style.cssText = 'background:none;border:none;color:var(--fg);opacity:.3;cursor:pointer;font-size:12px;padding:2px 4px';
    delBtn.addEventListener('click', () => { a.keyframes.splice(i, 1); renderAnimKeyframes(); });
    row.appendChild(timeLabel);
    row.appendChild(valInput);
    row.appendChild(delBtn);
    container.appendChild(row);
  });
}

function formatVal(val, step) {
  if (step < 0.01) return val.toFixed(4);
  if (step < 0.1) return val.toFixed(2);
  if (step < 1) return val.toFixed(1);
  return Math.round(val).toString();
}

function updateSecondaryColorVisibility(mode) {
  const row = document.querySelector('.color-secondary-row');
  if (row) row.style.display = (mode !== 'solid') ? '' : 'none';
}

function updateLineThresholdVisibility(mode) {
  const row = document.querySelector('.line-threshold-row');
  if (row) row.style.display = (mode === 'lines' || mode === 'triangles') ? '' : 'none';
}


// Conditional UI: gray out sliders that have no effect in current mode
function updateConditionalUI() {
  // Sliders are always enabled — conditional disabling was confusing.
  // Some params only affect specific modes (e.g., spring in spring mode),
  // but graying them out made users think features were broken.
}

function updateUI() {
  for (const b of paramBindings) {
    const input = document.getElementById(b.el);
    const display = document.getElementById(b.val);
    if (input) { input.value = params[b.id]; display.textContent = formatVal(params[b.id], b.step); }
  }
  const colorInput = document.getElementById('p-color');
  const colorVal = document.getElementById('v-color');
  if (colorInput) { colorInput.value = params.color; colorVal.textContent = params.color; }
  // Selects
  const selectIds = ['p-renderMode','p-glowMode','p-depthFadeMode','p-motionMode','p-waveMode','p-colorMode'];
  const selectKeys = ['renderMode','glowMode','depthFadeMode','motionMode','waveMode','colorMode'];
  for (let i = 0; i < selectIds.length; i++) {
    const el = document.getElementById(selectIds[i]);
    if (el) el.value = params[selectKeys[i]];
  }
  // Checkboxes
  const cb = (id, key) => { const c = document.getElementById(id); const l = document.getElementById(id.replace('p-','v-')); if (c) { c.checked = params[key]; if (l) l.textContent = params[key] ? 'On' : 'Off'; } };
  cb('p-autoPitch', 'autoPitch');
  cb('p-starfieldEnabled', 'starfieldEnabled');
  cb('p-flameEnabled', 'flameEnabled');
  cb('p-lightningEnabled', 'lightningEnabled');
  // Post-processing
  cb('p-bloom', 'bloom');
  cb('p-vignette', 'vignette');
  const bloomSlider = document.getElementById('p-bloomIntensity');
  if (bloomSlider) { bloomSlider.value = params.bloomIntensity; document.getElementById('v-bloomIntensity').textContent = formatVal(params.bloomIntensity, 0.05); }
  const gradeSelect = document.getElementById('p-colorGrade');
  if (gradeSelect) gradeSelect.value = params.colorGrade;
  // Audio
  cb('p-audioEnabled', 'audioEnabled');
  // Drag
  cb('p-dragEnabled', 'dragEnabled');
  cb('p-nebulaEnabled', 'nebulaEnabled');
  const audioSourceSelect = document.getElementById('p-audioSource');
  if (audioSourceSelect) audioSourceSelect.value = params.audioSource;
  const audioImpactSlider = document.getElementById('p-audioImpact');
  if (audioImpactSlider) { audioImpactSlider.value = params.audioImpact; document.getElementById('v-audioImpact').textContent = formatVal(params.audioImpact, 0.05); }
  const color2Input = document.getElementById('p-colorSecondary');
  const color2Val = document.getElementById('v-colorSecondary');
  if (color2Input) { color2Input.value = params.colorSecondary; color2Val.textContent = params.colorSecondary; }
  updateSecondaryColorVisibility(params.colorMode);
  updateLineThresholdVisibility(params.renderMode);
  updateConditionalUI();
}

function handleSVGFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  if (ext === 'png' || ext === 'jpg' || ext === 'jpeg') {
    handleImageFile(file);
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    sourceType = 'svg';
    loadSVG(reader.result);
    const fnEl = document.getElementById('svg-filename');
    fnEl.textContent = file.name;
    fnEl.style.display = '';
    document.querySelector('.drop-zone p').style.display = 'none';
  };
  reader.readAsText(file);
}

function handleImageFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    sourceType = 'image';
    const dataUrl = reader.result;
    const img = new Image();
    img.onload = () => {
      // Render image to offscreen canvas, sample particles
      const sampleSize = 1000;
      const aspect = img.width / img.height;
      const c = document.createElement('canvas');
      c.width = sampleSize;
      c.height = Math.round(sampleSize / aspect);
      const tctx = c.getContext('2d');
      tctx.drawImage(img, 0, 0, c.width, c.height);

      logoCanvas = c;
      particles = sampleIckna(c);
      // No edge particles for raster images
      edgeParticles = [];
      waveNodes = [];
      engineReady = true;
      currentSVG = dataUrl;

      const fnEl = document.getElementById('svg-filename');
      fnEl.textContent = file.name;
      fnEl.style.display = '';
      document.querySelector('.drop-zone p').style.display = 'none';

      const infoEl = document.getElementById('svg-info');
      if (infoEl) infoEl.textContent = img.width + '×' + img.height + ' · ' + particles.length + ' particles';
    };
    img.src = dataUrl;
  };
  reader.readAsDataURL(file);
}

// ── Local storage presets ─────────────────────────────────────
function savePresetToLocal(preset) {
  const presets = getLocalPresets();
  presets[preset.name] = preset;
  try {
    localStorage.setItem('mote-presets', JSON.stringify(presets));
  } catch(e) {}
}

function getLocalPresets() {
  try {
    return JSON.parse(localStorage.getItem('mote-presets') || '{}');
  } catch(e) { return {}; }
}

function deleteLocalPreset(name) {
  const presets = getLocalPresets();
  delete presets[name];
  try {
    localStorage.setItem('mote-presets', JSON.stringify(presets));
  } catch(e) {}
  renderPresetList();
}

function renderPresetList() {
  const list = document.getElementById('preset-list');
  if (!list) return;
  const presets = getLocalPresets();
  list.innerHTML = '';
  const names = Object.keys(presets);
  if (!names.length) {
    list.innerHTML = '<div style="opacity:.3;font-size:11px;padding:8px 0">No saved presets</div>';
    return;
  }
  for (const name of names) {
    const item = document.createElement('div');
    item.className = 'preset-item' + (name === presetName ? ' active' : '');
    item.innerHTML = `
      <span class="name">${name}</span>
      <span class="actions">
        <button title="Load" data-load="${name}">▶</button>
        <button title="Delete" data-del="${name}">✕</button>
      </span>
    `;
    item.querySelector('[data-load]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      loadPreset(presets[name]);
    });
    item.querySelector('[data-del]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm(`Delete preset "${name}"?`)) deleteLocalPreset(name);
    });
    list.appendChild(item);
  }
}

function renderPlaylist() {
  const list = document.getElementById('playlist-list');
  if (!list) return;
  list.innerHTML = '';
  if (!playlist.length) {
    list.innerHTML = '<div style="opacity:.3;font-size:11px;padding:8px 0">No items in playlist. Add presets from the Presets tab or click + Add Current.</div>';
    return;
  }
  for (let i = 0; i < playlist.length; i++) {
    const item = document.createElement('div');
    item.className = 'preset-item' + (i === playlistIndex ? ' active' : '');
    item.innerHTML = `
      <span class="name">${i + 1}. ${playlist[i].name || 'unnamed'} (${playlist[i].duration || 8}s)</span>
      <span class="actions">
        <button title="Remove" data-remove="${i}">✕</button>
      </span>
    `;
    item.querySelector('[data-remove]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      playlist.splice(i, 1);
      if (playlistIndex >= playlist.length) playlistIndex = 0;
      renderPlaylist();
    });
    list.appendChild(item);
  }
}

// ── Download helper ───────────────────────────────────────────
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ── Export playback HTML ──────────────────────────────────────
function exportPlaybackHTML() {
  const preset = getPreset();
  const SCRIPT_CLOSE = '</scr' + 'ipt>';
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<title>Mote — ${preset.name}</title>
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
const PRESET = ${JSON.stringify(preset, null, 2)};
const FOCAL = 900;
const LOGO_COLOR = PRESET.params.color || '#e03030';
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let W, H, DPR, logoCanvas, particles = [], edgeParticles = [], waveNodes = [], animId;
let yawAngle = 0, pitchAngle = 0, yawSpd = 0, pitchSpd = 0;
let yRotEnabled = false;
let animStartTime = 0;
const keys = {};
let lightningQueue = [], lightningBolts = [], lightningPaths = [];
let ppCache = null;

// White glow texture (tinted at draw time)
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
  t.fillStyle = g;
  t.fillRect(0, 0, s * 2, s * 2);
  return c;
})();

// Color helpers -- rewritten without template literals for export compat
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

// -- Animator system (backtick-safe, no template literals) --
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
  var rp = {};
  for (var key in baseParams) { if (baseParams.hasOwnProperty(key)) rp[key] = baseParams[key]; }
  for (var key in animDef) {
    if (!animDef.hasOwnProperty(key)) continue;
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

let stars = [];
function initStars() {
  const list = [];
  for (let layer = 0; layer < 2; layer++) {
    const count = 156 + layer * 78;
    const depth = 0.3 + layer * 0.4;
    for (let i = 0; i < count; i++) {
      list.push({ x: Math.random() * W, y: Math.random() * H, r: 0.3 + Math.random() * (1.2 - layer * 0.4), a: 0.15 + Math.random() * (0.55 - layer * 0.15), depth: depth });
    }
  }
  stars = list;
}
function drawStars() {
  ctx.fillStyle = '#ffffff';
  for (const s of stars) {
    const ox = yawAngle * 80 * s.depth;
    const oy = pitchAngle * 60 * s.depth;
    const sx = (s.x + ox + W) % W;
    const sy = (s.y + oy + H) % H;
    ctx.globalAlpha = s.a;
    ctx.beginPath();
    ctx.arc(sx, sy, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// ── Post-Processing ──────────────────────────────────────────
function applyPostProcessing(p) {
  // Bloom: half-res blur + additive composite
  if (p.bloom && p.bloomIntensity > 0 && typeof ctx.filter !== 'undefined') {
    var hw = Math.ceil(W / 2), hh = Math.ceil(H / 2);
    if (!ppCache || ppCache.width !== hw || ppCache.height !== hh) {
      ppCache = document.createElement('canvas');
      ppCache.width = hw;
      ppCache.height = hh;
    }
    var pc = ppCache.getContext('2d');
    pc.clearRect(0, 0, hw, hh);
    pc.drawImage(canvas, 0, 0, W, H, 0, 0, hw, hh);
    pc.filter = 'blur(' + Math.round(4 + p.bloomIntensity * 10) + 'px)';
    pc.globalCompositeOperation = 'source-over';
    pc.drawImage(ppCache, 0, 0);
    pc.filter = 'none';
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = p.bloomIntensity * 0.6;
    ctx.drawImage(ppCache, 0, 0, hw, hh, 0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }

  // Vignette: radial gradient overlay
  if (p.vignette) {
    var cx = W / 2, cy = H / 2, r = Math.max(W, H) * 0.75;
    var grad = ctx.createRadialGradient(cx, cy, r * 0.3, cx, cy, r);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }

  // Color grade: CSS filter on canvas element (reset each frame)
  if (p.colorGrade && p.colorGrade !== 'none') {
    switch (p.colorGrade) {
      case 'warm': canvas.style.filter = 'brightness(1.05) saturate(1.2) sepia(0.15)'; break;
      case 'cool': canvas.style.filter = 'brightness(1.05) saturate(0.8) hue-rotate(-15deg)'; break;
      case 'dramatic': canvas.style.filter = 'brightness(1.1) contrast(1.2) saturate(1.3)'; break;
      default: canvas.style.filter = '';
    }
  } else {
    canvas.style.filter = '';
  }
}

function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = W * DPR;
  canvas.height = H * DPR;
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  initStars();
}
window.addEventListener('resize', resize);
resize();

function applyRotYawPitch(v, yaw, pitch) {
  const cosY = Math.cos(yaw), sinY = Math.sin(yaw);
  const cosP = Math.cos(pitch), sinP = Math.sin(pitch);
  const rx = v.x * cosY - v.z * sinY;
  const ry = v.y;
  const rz = v.x * sinY + v.z * cosY;
  return { x: rx, y: ry * cosP - rz * sinP, z: ry * sinP + rz * cosP };
}

// -- Flame color: fire-ice spectrum --
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

function drawFlameHalo(ctx2, px, py, r, flame, ss) {
  if (Math.abs(flame) <= 0.01) return;
  const absF = Math.abs(flame);
  const c = getFlameColor(flame);
  let haloSize, haloAlpha;
  if (flame < 0) {
    const t = Math.min(1, -flame / 2);
    haloSize = Math.max(r * (5 - t * 3), 2) * (ss || 1);
    haloAlpha = Math.min(0.5, (1 - t) * 0.5);
  } else {
    haloSize = Math.max(r * (4 + absF * 0.5), 4) * (ss || 1);
    haloAlpha = Math.min(1, absF * 0.5);
  }
  ctx2.globalAlpha = haloAlpha;
  ctx2.fillStyle = 'rgb(' + c.r + ',' + c.g + ',' + c.b + ')';
  ctx2.beginPath();
  ctx2.arc(px, py, haloSize, 0, Math.PI * 2);
  ctx2.fill();
  ctx2.globalAlpha = Math.min(1, absF * 0.8);
  ctx2.fillStyle = '#ffffff';
  ctx2.beginPath();
  ctx2.arc(px, py, haloSize * 0.3, 0, Math.PI * 2);
  ctx2.fill();
}

function updateSparkles() {
  for (const pt of particles) {
    if (pt.sparkle <= 0) { if (Math.random() < 0.0002) pt.sparkle = 0.6 + Math.random() * 0.4; }
    else { pt.sparkle -= 0.02; if (pt.sparkle < 0) pt.sparkle = 0; }
  }
}

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
      if (ep.flame > 1.2) {
        for (const ni of ep.neighbors) { const n = edgeParticles[ni]; if (n.flame < 0.1 && ep.flame > 1.0) n.flame = 1.8; }
        for (const mi of ep.mainNeighbors) { const mp = particles[mi]; if (mp && mp.flame < 0.1) mp.flame = 1.5; }
      }
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
  let si = Math.floor(Math.random() * startPool.length);
  let ei = Math.floor(Math.random() * endPool.length);
  let tries = 0;
  while (ei === si && tries < 10) { ei = Math.floor(Math.random() * endPool.length); tries++; }
  const sp = startPool[si], ep = endPool[ei];
  if (!sp || !ep) return;
  const dx0 = ep.tx - sp.tx, dy0 = ep.ty - sp.ty;
  if (Math.sqrt(dx0 * dx0 + dy0 * dy0) < 100) return;
  const path = [{ tx: sp.tx, ty: sp.ty }];
  let cx = sp.tx, cy = sp.ty;
  const stepMin = 10, stepMax = 30;
  let stuck = 0;
  while (stuck < 50 && path.length < 80) {
    const tdx = ep.tx - cx, tdy = ep.ty - cy;
    const tdist = Math.sqrt(tdx * tdx + tdy * tdy);
    if (tdist < stepMax) { path.push({ tx: ep.tx, ty: ep.ty }); break; }
    let best = null, bestDist = tdist;
    const searchCount = Math.min(60, particles.length);
    for (let t = 0; t < searchCount; t++) {
      const r = Math.floor(Math.random() * particles.length);
      const mp = particles[r];
      if (!mp) continue;
      const dx2 = mp.tx - cx, dy2 = mp.ty - cy;
      const d2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
      if (d2 >= stepMin && d2 <= stepMax) {
        const dx3 = ep.tx - mp.tx, dy3 = ep.ty - mp.ty;
        const d3 = Math.sqrt(dx3 * dx3 + dy3 * dy3);
        if (d3 < bestDist) { bestDist = d3; best = mp; }
      }
    }
    for (const ep2 of edgeParticles) {
      const dx2 = ep2.tx - cx, dy2 = ep2.ty - cy;
      const d2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
      if (d2 >= stepMin && d2 <= stepMax) {
        const dx3 = ep.tx - ep2.tx, dy3 = ep.ty - ep2.ty;
        const d3 = Math.sqrt(dx3 * dx3 + dy3 * dy3);
        if (d3 < bestDist) { bestDist = d3; best = ep2; }
      }
    }
    if (best) { path.push({ tx: best.tx, ty: best.ty }); cx = best.tx; cy = best.ty; stuck = 0; }
    else { stuck++; }
  }
  if (path.length < 3) return;
  for (const p of path) {
    for (const mp of particles) {
      const dx = mp.tx - p.tx, dy = mp.ty - p.ty;
      if (dx * dx + dy * dy < 100) { if (mp.flame < 0.6) mp.flame = 0.6; break; }
    }
  }
  if (startType === 'edge') {
    edgeParticles[si].lightning = 1.0;
    lightningQueue.push({ idx: si, type: 'edge', parentIdx: null, parentType: null, delay: 0, hop: 0 });
  } else {
    for (const ep of edgeParticles) {
      const dx = sp.tx - ep.tx, dy = sp.ty - ep.ty;
      if (dx * dx + dy * dy < 5000) {
        ep.lightning = 1.0;
        lightningQueue.push({ idx: edgeParticles.indexOf(ep), type: 'edge', parentIdx: null, parentType: null, delay: 0, hop: 0 });
        break;
      }
    }
  }
  const branches = [];
  const maxBranches = 4;
  let branchCount = 0;
  for (let s = 1; s < path.length - 1 && branchCount < maxBranches; s++) {
    if (Math.random() < 0.1) {
      const branch = [{ tx: path[s].tx, ty: path[s].ty }];
      let bcx = path[s].tx, bcy = path[s].ty;
      const bLen = 3 + Math.floor(Math.random() * 6);
      for (let bi = 0; bi < bLen; bi++) {
        let best = null, bestDist = Infinity;
        const bSearch = Math.min(80, particles.length);
        for (let t = 0; t < bSearch; t++) {
          const r = Math.floor(Math.random() * particles.length);
          const mp = particles[r];
          if (!mp) continue;
          const dx2 = mp.tx - bcx, dy2 = mp.ty - bcy;
          const d2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
          if (d2 >= 10 && d2 <= 30) {
            const tdx = path[s+1].tx - path[s].tx, tdy = path[s+1].ty - path[s].ty;
            const mdx = mp.tx - path[s].tx, mdy = mp.ty - path[s].ty;
            const dot = tdx * mdx + tdy * mdy;
            if (dot < 0 || Math.random() < 0.2) {
              if (d2 < bestDist) { bestDist = d2; best = mp; }
            }
          }
        }
        if (best) { branch.push({ tx: best.tx, ty: best.ty }); bcx = best.tx; bcy = best.ty; }
        else break;
      }
      if (branch.length >= 2) { branches.push(branch); branchCount++; }
    }
  }
  lightningPaths.push({ path, branches, progress: 0, life: 1.0, strikes: 0 });
}

function updateLightning() {
  for (let qi = 0; qi < lightningQueue.length; qi++) {
    const item = lightningQueue[qi];
    item.delay--;
    if (item.delay > 0) continue;
    let target = null;
    if (item.type === 'edge') target = edgeParticles[item.idx];
    else target = particles[item.idx];
    if (!target) { lightningQueue.splice(qi, 1); qi--; continue; }
    target.lightning = 1.0;
    if (item.type === 'main' && target.flame < 0.6) target.flame = 0.6;
    const nextHop = item.hop + 1;
    if (nextHop > 8) { lightningQueue.splice(qi, 1); qi--; continue; }
    if (item.parentIdx !== null) {
      let parentPos = null;
      if (item.parentType === 'edge' && edgeParticles[item.parentIdx]) {
        parentPos = { tx: edgeParticles[item.parentIdx].tx, ty: edgeParticles[item.parentIdx].ty };
      } else if (item.parentType === 'main' && particles[item.parentIdx]) {
        parentPos = { tx: particles[item.parentIdx].tx, ty: particles[item.parentIdx].ty };
      }
      if (parentPos) {
        lightningBolts.push({ x1: parentPos.tx, y1: parentPos.ty, x2: target.tx, y2: target.ty, life: 1.0 });
      }
    }
    let enqueued = 0;
    let maxChildren = 1 + Math.floor(Math.random() * 2);
    if (item.type === 'edge') {
      for (const ni of target.neighbors) {
        if (enqueued >= maxChildren) break;
        if (edgeParticles[ni] && edgeParticles[ni].lightning < 0.1) {
          lightningQueue.push({ idx: ni, type: 'edge', parentIdx: item.idx, parentType: 'edge', delay: Math.floor(Math.random() * 2), hop: nextHop });
          enqueued++;
        }
      }
      enqueued = 0;
      maxChildren = 1 + Math.floor(Math.random() * 2);
      const shuffled = [...target.mainNeighbors].sort(() => Math.random() - 0.5);
      for (const mi of shuffled) {
        if (enqueued >= maxChildren) break;
        if (particles[mi] && particles[mi].lightning < 0.1) {
          lightningQueue.push({ idx: mi, type: 'main', parentIdx: item.idx, parentType: 'edge', delay: Math.floor(Math.random() * 2), hop: nextHop });
          enqueued++;
        }
      }
    } else {
      if (Math.random() < 0.5) {
        const radius2 = 400 + Math.random() * 1600;
        for (let t = 0; t < 25; t++) {
          const r = Math.floor(Math.random() * particles.length);
          const nmp = particles[r];
          if (nmp && nmp.lightning < 0.1 && nmp !== target) {
            const dx = target.tx - nmp.tx, dy = target.ty - nmp.ty;
            if (dx * dx + dy * dy < radius2) {
              lightningQueue.push({ idx: r, type: 'main', parentIdx: item.idx, parentType: 'main', delay: Math.floor(Math.random() * 2), hop: nextHop });
              if (Math.random() > 0.4) break;
            }
          }
        }
      }
      if (Math.random() < 0.25) {
        const ei = Math.floor(Math.random() * edgeParticles.length);
        const nep = edgeParticles[ei];
        if (nep && nep.lightning < 0.1) {
          const dx = target.tx - nep.tx, dy = target.ty - nep.ty;
          if (dx * dx + dy * dy > 2500 && dx * dx + dy * dy < 10000) {
            lightningQueue.push({ idx: ei, type: 'edge', parentIdx: item.idx, parentType: 'main', delay: Math.floor(Math.random() * 2), hop: nextHop });
          }
        }
      }
    }
    lightningQueue.splice(qi, 1);
    qi--;
  }
  for (const ep of edgeParticles) {
    if (ep.lightning > 0) { ep.lightning -= 0.08; if (ep.lightning < 0) ep.lightning = 0; }
  }
  for (const mp of particles) {
    if (mp.lightning > 0) { mp.lightning -= 0.08; if (mp.lightning < 0) mp.lightning = 0; }
  }
  for (let bi = lightningBolts.length - 1; bi >= 0; bi--) {
    lightningBolts[bi].life -= 0.12;
    if (lightningBolts[bi].life <= 0) lightningBolts.splice(bi, 1);
  }
  for (let pi = lightningPaths.length - 1; pi >= 0; pi--) {
    const lp = lightningPaths[pi];
    lp.progress += 0.32;
    if (lp.progress >= 1) {
      if (lp.strikes < 2 && Math.random() < 0.1) { lp.progress = 0; lp.strikes++; }
      else { lp.life -= 0.15; }
    }
    if (lp.life <= 0) lightningPaths.splice(pi, 1);
  }
}

function getWaveOrigin(t) {
  if (!waveNodes.length) return { x: 0, y: 0 };
  const cycle = (t * 0.00008) % waveNodes.length;
  const idx = Math.floor(cycle);
  const frac = cycle - idx;
  const a = waveNodes[idx];
  const b = waveNodes[(idx + 1) % waveNodes.length];
  return { x: a.x + (b.x - a.x) * frac, y: a.y + (b.y - a.y) * frac };
}

// ── RENDER MODES ─────────────────────────────────────────────
const RENDER_MODES = {
  dots: {
    name: 'Dots',
    draw(ctx2, projected, pr) {
      const rgb1 = hexToRgb(pr.color);
      const rgb2 = pr.colorSecondary && pr.colorMode !== 'solid' ? hexToRgb(pr.colorSecondary) : null;
      ctx2.shadowBlur = pr.glowBlur;
      for (const pt of projected) {
        const c = getParticleColor(pt, pr, rgb1, rgb2);
        ctx2.fillStyle = c;
        ctx2.shadowColor = c;
        ctx2.globalAlpha = Math.max(0.15, Math.min(1, pt.alpha));
        ctx2.beginPath();
        ctx2.arc(pt.px, pt.py, pt.r, 0, Math.PI * 2);
        ctx2.fill();
      }
    }
  },

  lines: {
    name: 'Connected Lines',
    draw(ctx2, projected, pr) {
      const threshold = pr.lineThreshold || 60;
      const rgb1 = hexToRgb(pr.color);
      const rgb2 = pr.colorSecondary && pr.colorMode !== 'solid' ? hexToRgb(pr.colorSecondary) : null;
      const cellSize = threshold;
      const grid = new Map();
      for (let i = 0; i < projected.length; i++) {
        const pt = projected[i];
        const gx = Math.floor(pt.px / cellSize);
        const gy = Math.floor(pt.py / cellSize);
        const key = gx + ',' + gy;
        if (!grid.has(key)) grid.set(key, []);
        grid.get(key).push(i);
      }
      ctx2.shadowBlur = pr.glowBlur;
      for (const pt of projected) {
        const c = getParticleColor(pt, pr, rgb1, rgb2);
        ctx2.fillStyle = c;
        ctx2.shadowColor = c;
        ctx2.globalAlpha = Math.max(0.15, Math.min(1, pt.alpha));
        ctx2.beginPath();
        ctx2.arc(pt.px, pt.py, pt.r * 0.6, 0, Math.PI * 2);
        ctx2.fill();
      }
      ctx2.shadowBlur = 0;
      ctx2.lineWidth = 0.5;
      let drawn = 0;
      const maxLines = 200;
      const seen = new Set();
      for (let i = 0; i < projected.length && drawn < maxLines; i++) {
        const a = projected[i];
        const gx = Math.floor(a.px / cellSize);
        const gy = Math.floor(a.py / cellSize);
        for (let dx = -1; dx <= 1 && drawn < maxLines; dx++) {
          for (let dy = -1; dy <= 1 && drawn < maxLines; dy++) {
            const key = (gx + dx) + ',' + (gy + dy);
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
                ctx2.strokeStyle = getParticleColor(midPt, pr, rgb1, rgb2);
                ctx2.globalAlpha = lineAlpha;
                ctx2.beginPath();
                ctx2.moveTo(a.px, a.py);
                ctx2.lineTo(b.px, b.py);
                ctx2.stroke();
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
    _edgeCache: null,
    _cacheKey: '',
    draw(ctx2, projected, pr, t2) {
      const frameNum = Math.floor(t2 / 500);
      const cacheKey = frameNum + ':' + projected.length + ':' + (pr.lineThreshold || 60);
      const rgb1 = hexToRgb(pr.color);
      const rgb2 = pr.colorSecondary && pr.colorMode !== 'solid' ? hexToRgb(pr.colorSecondary) : null;
      let edges;
      if (this._cacheKey === cacheKey && this._edgeCache) {
        edges = this._edgeCache;
      } else {
        edges = this._triangulate(projected, pr.lineThreshold || 80);
        this._edgeCache = edges;
        this._cacheKey = cacheKey;
      }
      ctx2.shadowBlur = pr.glowBlur;
      for (const pt of projected) {
        const c = getParticleColor(pt, pr, rgb1, rgb2);
        ctx2.fillStyle = c;
        ctx2.shadowColor = c;
        ctx2.globalAlpha = Math.max(0.15, Math.min(1, pt.alpha));
        ctx2.beginPath();
        ctx2.arc(pt.px, pt.py, pt.r * 0.5, 0, Math.PI * 2);
        ctx2.fill();
      }
      ctx2.shadowBlur = 0;
      ctx2.lineWidth = 0.5;
      for (let k = 0; k < edges.length; k += 2) {
        const i = edges[k], j = edges[k + 1];
        const a = projected[i], b = projected[j];
        const lineAlpha = Math.min(a.alpha, b.alpha) * 0.3;
        const midPt = { px: (a.px + b.px) / 2, py: (a.py + b.py) / 2, z: (a.z + b.z) / 2, phase: (a.phase + b.phase) / 2 };
        ctx2.strokeStyle = getParticleColor(midPt, pr, rgb1, rgb2);
        ctx2.globalAlpha = lineAlpha;
        ctx2.beginPath();
        ctx2.moveTo(a.px, a.py);
        ctx2.lineTo(b.px, b.py);
        ctx2.stroke();
      }
    },
    _triangulate(pts, maxDist) {
      const edges = [];
      const maxPerPoint = 2;
      const totalEdges = Math.min(pts.length * maxPerPoint, 600);
      let count = 0;
      for (let i = 0; i < pts.length && count < totalEdges; i++) {
        const a = pts[i];
        const dists = [];
        for (let j = 0; j < pts.length; j++) {
          if (j === i) continue;
          const b = pts[j];
          const dx = a.px - b.px, dy = a.py - b.py;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d <= maxDist) dists.push({ j: j, d: d });
        }
        dists.sort((x, y) => x.d - y.d);
        for (let k = 0; k < Math.min(maxPerPoint, dists.length) && count < totalEdges; k++) {
          edges.push(i, dists[k].j);
          count++;
        }
      }
      return edges;
    }
  },

  glow: {
    name: 'Glow Field',
    _cache: null,
    draw(ctx2, projected, pr) {
      if (!this._cache) {
        this._cache = {};
        const sizes = [2, 4, 8, 16, 32];
        for (const size of sizes) {
          const c = document.createElement('canvas');
          c.width = size * 2;
          c.height = size * 2;
          const t = c.getContext('2d');
          const grad = t.createRadialGradient(size, size, 0, size, size, size);
          grad.addColorStop(0, 'rgba(255,255,255,1)');
          grad.addColorStop(0.1, 'rgba(255,255,255,0.8)');
          grad.addColorStop(0.4, 'rgba(255,255,255,0.3)');
          grad.addColorStop(1, 'rgba(255,255,255,0)');
          t.fillStyle = grad;
          t.fillRect(0, 0, size * 2, size * 2);
          this._cache[size] = c;
        }
      }
      const rgb1 = hexToRgb(pr.color);
      const rgb2 = pr.colorSecondary && pr.colorMode !== 'solid' ? hexToRgb(pr.colorSecondary) : null;
      ctx2.shadowBlur = 0;
      ctx2.globalCompositeOperation = 'lighter';
      for (const pt of projected) {
        const size = Math.round(pt.r * 2);
        if (size < 1) continue;
        const snap = size <= 4 ? 4 : size <= 8 ? 8 : size <= 16 ? 16 : 32;
        const tex = this._cache[snap];
        if (!tex) continue;
        const c = getParticleColor(pt, pr, rgb1, rgb2);
        ctx2.fillStyle = c;
        ctx2.globalAlpha = Math.max(0.05, Math.min(0.4, pt.alpha));
        ctx2.beginPath();
        ctx2.arc(pt.px, pt.py, pt.r * 0.3, 0, Math.PI * 2);
        ctx2.fill();
        ctx2.globalAlpha = Math.max(0.05, Math.min(0.4, pt.alpha));
        ctx2.drawImage(tex, pt.px - snap, pt.py - snap, snap * 2, snap * 2);
      }
      ctx2.globalCompositeOperation = 'source-over';
      ctx2.globalAlpha = 1;
    }
  }
};

// ── Playback menu ──────────────────────────────────────────
const pmenuButtons = {}, pmenuAutoRepeat = {}, pmenuRepeatRates = {};
let pmenuButtonTimer = 0;

function triggerAction(action) {
  if (action === 'ice') { const idx = Math.floor(Math.random() * edgeParticles.length); if (edgeParticles[idx]) { edgeParticles[idx].flame = -2.0; PRESET.params.flameEnabled = true; } }
  else if (action === 'fire') { const idx = Math.floor(Math.random() * edgeParticles.length); if (edgeParticles[idx]) { edgeParticles[idx].flame = 2.0; PRESET.params.flameEnabled = true; } }
  else if (action === 'lightning') { PRESET.params.lightningEnabled = true; spawnGuidedBolt(); }
}

function processButtons() {
  pmenuButtonTimer++;
  for (const key in pmenuButtons) { if (pmenuButtons[key] && pmenuButtonTimer % Math.max(2, Math.floor((31 - pmenuRepeatRates[key]) / 2)) === 0) triggerAction(key); }
  for (const key in pmenuAutoRepeat) { if (pmenuAutoRepeat[key] && !pmenuButtons[key] && pmenuButtonTimer % Math.max(2, Math.floor((31 - pmenuRepeatRates[key]) / 2)) === 0) triggerAction(key); }
}

function initPlaybackMenu() {
  document.getElementById('pmenu-btn').addEventListener('click', function() { document.getElementById('pmenu-items').classList.toggle('open'); });
  document.querySelectorAll('.pmenu-row').forEach(function(row) {
    const action = row.dataset.action;
    pmenuAutoRepeat[action] = false;
    pmenuRepeatRates[action] = 15;
    row.querySelector('.pmenu-label').addEventListener('click', function() { triggerAction(action); });
    const start = function() { pmenuButtons[action] = true; triggerAction(action); };
    const end = function() { pmenuButtons[action] = false; };
    row.addEventListener('mousedown', start); row.addEventListener('mouseup', end); row.addEventListener('mouseleave', end);
    row.addEventListener('touchstart', start, { passive: true }); row.addEventListener('touchend', end, { passive: true });
    row.querySelector('.pmenu-toggle input').addEventListener('change', function(e) { pmenuAutoRepeat[action] = e.target.checked; });
    row.querySelector('.rate-slider').addEventListener('input', function(e) { pmenuRepeatRates[action] = parseInt(e.target.value); });
  });
}

// ── Particle sampling ──────────────────────────────────────
function sampleParticles() {
  const tw = logoCanvas.width, th = logoCanvas.height;
  const tctx = logoCanvas.getContext('2d');
  const spacing = PRESET.params.spacing || 10;
  const cols = Math.ceil(tw / spacing);
  const rows = Math.ceil(th / spacing);
  const list = [];
  const szMin = PRESET.params.sizeMin || 1.5;
  const szMax = PRESET.params.sizeMax || 7.5;
  for (let gy = 0; gy < rows; gy++) {
    for (let gx = 0; gx < cols; gx++) {
      const px = gx * spacing + spacing / 2;
      const py = gy * spacing + spacing / 2;
      const pixel = tctx.getImageData(Math.round(px), Math.round(py), 1, 1).data;
      if (pixel[3] > 30) {
        list.push({
          tx: px + (Math.random() - 0.5) * 6,
          ty: py + (Math.random() - 0.5) * 6,
          tz: 0,
          edgeDist: 0,
          flame: 0,
          lightning: 0,
          sparkle: 0,
          x: Math.cos(Math.random() * Math.PI * 2) * (500 + Math.random() * 1500),
          y: Math.sin(Math.random() * Math.PI * 2) * (500 + Math.random() * 1500),
          z: (Math.random() - 0.5) * 50,
          size: szMin + Math.pow(Math.random(), 2) * (szMax - szMin),
          phase: Math.random() * Math.PI * 2
        });
      }
    }
  }
  return list;
}

// ── Edge distance computation ──────────────────────────────
function computeEdgeDist(svgStr, svgW, svgH, doc) {
  // Extract transform matrix from <g> elements
  let tm = [1, 0, 0, 1, 0, 0];
  for (const g of doc.querySelectorAll('g')) {
    const t = g.getAttribute('transform');
    if (!t) continue;
    const m = t.match(/matrix\\(\\s*([-\\d.e]+)\\s*,\\s*([-\\d.e]+)\\s*,\\s*([-\\d.e]+)\\s*,\\s*([-\\d.e]+)\\s*,\\s*([-\\d.e]+)\\s*,\\s*([-\\d.e]+)\\s*\\)/);
    if (m) {
      const a = [parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3]), parseFloat(m[4]), parseFloat(m[5]), parseFloat(m[6])];
      const t0 = tm[0], t1 = tm[1], t2 = tm[2], t3 = tm[3], t4 = tm[4], t5 = tm[5];
      tm = [a[0]*t0 + a[2]*t1, a[1]*t0 + a[3]*t1, a[0]*t2 + a[2]*t3, a[1]*t2 + a[3]*t3, a[0]*t4 + a[2]*t5 + a[4], a[1]*t4 + a[3]*t5 + a[5]];
    }
  }
  const logoScale = logoCanvas.width / svgW;
  const tp = function(x, y) { return { x: (tm[0]*x + tm[2]*y + tm[4]) * logoScale, y: (tm[1]*x + tm[3]*y + tm[5]) * logoScale }; };
  const paths = Array.from(doc.querySelectorAll('path')).map(function(p) { return p.getAttribute('d'); }).filter(Boolean).map(function(d) { return new Path2D(d); });
  const circles = Array.from(doc.querySelectorAll('circle')).map(function(c) { return { cx: parseFloat(c.getAttribute('cx')) || 0, cy: parseFloat(c.getAttribute('cy')) || 0, r: parseFloat(c.getAttribute('r')) || 0 }; });
  const tmpCanvas = document.createElement('canvas');
  const tmpCtx = tmpCanvas.getContext('2d');
  const inside = function(x, y) {
    for (const c of circles) { const dx = x - c.cx, dy = y - c.cy; if (dx * dx + dy * dy <= c.r * c.r) return true; }
    for (const p of paths) { if (tmpCtx.isPointInPath(p, x, y, 'evenodd')) return true; }
    return false;
  };
  let rawMinX = Infinity, rawMaxX = -Infinity, rawMinY = Infinity, rawMaxY = -Infinity;
  for (const c of circles) { rawMinX = Math.min(rawMinX, c.cx - c.r); rawMaxX = Math.max(rawMaxX, c.cx + c.r); rawMinY = Math.min(rawMinY, c.cy - c.r); rawMaxY = Math.max(rawMaxY, c.cy + c.r); }
  rawMinX -= 10; rawMaxX += 10; rawMinY -= 10; rawMaxY += 10;
  const edgeSpacing = 5;
  const ec = Math.ceil((rawMaxX - rawMinX) / edgeSpacing);
  const er = Math.ceil((rawMaxY - rawMinY) / edgeSpacing);
  const edgeList = [];
  for (let gy = 1; gy < er - 1; gy++) {
    for (let gx = 1; gx < ec - 1; gx++) {
      const px = rawMinX + gx * edgeSpacing, py = rawMinY + gy * edgeSpacing;
      if (inside(px, py)) {
        if (!inside(px - edgeSpacing, py) || !inside(px + edgeSpacing, py) || !inside(px, py - edgeSpacing) || !inside(px, py + edgeSpacing)) {
          const tpp = tp(px, py);
          edgeList.push({ tx: tpp.x, ty: tpp.y });
        }
      }
    }
  }
  edgeParticles = edgeList.map(function(ep) { return { tx: ep.tx, ty: ep.ty, tz: 0, sparkle: 0, flame: 0, lightning: 0, phase: Math.random() * Math.PI * 2, neighbors: [], mainNeighbors: [] }; });
  const neighborDist = 50;
  for (let i = 0; i < edgeParticles.length; i++) {
    for (let j = i + 1; j < edgeParticles.length; j++) {
      const dx = edgeParticles[i].tx - edgeParticles[j].tx, dy = edgeParticles[i].ty - edgeParticles[j].ty;
      if (dx * dx + dy * dy < neighborDist * neighborDist) { edgeParticles[i].neighbors.push(j); edgeParticles[j].neighbors.push(i); }
    }
  }
  for (const pt of particles) { pt.flame = 0; pt.lightning = 0; }
  const fireSpreadDist = 40;
  for (const ep of edgeParticles) {
    for (let mi = 0; mi < particles.length; mi++) {
      const dx = ep.tx - particles[mi].tx, dy = ep.ty - particles[mi].ty;
      if (dx * dx + dy * dy < fireSpreadDist * fireSpreadDist) { ep.mainNeighbors.push(mi); }
    }
  }
  for (const pt of particles) {
    let minDist = Infinity;
    for (const ep of edgeParticles) { const dx = pt.tx - ep.tx, dy = pt.ty - ep.ty; const d = dx * dx + dy * dy; if (d < minDist) minDist = d; }
    pt.edgeDist = Math.sqrt(minDist);
  }
  waveNodes = circles.map(function(c) { const tpp = tp(c.cx, c.cy); return { x: tpp.x, y: tpp.y }; });
}

// ── Init ──────────────────────────────────────────────────────
async function init() {
  const p = PRESET.params, svgStr = PRESET.svg;
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgStr, 'image/svg+xml');
  const svg = doc.querySelector('svg');
  let svgW = 400, svgH = 300;
  const vb = svg ? svg.getAttribute('viewBox') : null;
  if (vb) { const pts = vb.split(/[,\\s]+/).map(Number); svgW = pts[2] - pts[0]; svgH = pts[3] - pts[1]; }
  else { svgW = parseInt(svg.getAttribute('width')) || 400; svgH = parseInt(svg.getAttribute('height')) || 300; }
  const aspect = svgW / svgH;
  const ss = 1000;
  const c = document.createElement('canvas');
  c.width = ss; c.height = Math.round(ss / aspect);
  const tctx = c.getContext('2d');
  const img = new Image();
  const blob = new Blob([svgStr], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  img.onload = function() {
    tctx.drawImage(img, 0, 0, c.width, c.height);
    URL.revokeObjectURL(url);
    logoCanvas = c;
    particles = sampleParticles();
    computeEdgeDist(svgStr, svgW, svgH, doc);
    startLoop();
  };
  img.onerror = function() {
    URL.revokeObjectURL(url);
    logoCanvas = c;
    particles = sampleParticles();
    computeEdgeDist(svgStr, svgW, svgH, doc);
    startLoop();
  };
  img.src = url;
}

// ── Unified Frame ─────────────────────────────────────────────
function frame(t) {
  try {
    if (!particles.length || !logoCanvas) { animId = requestAnimationFrame(frame); return; }
    const p = animEvaluate(PRESET.params, PRESET.params.anim, t - animStartTime);
    canvas.style.filter = '';

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
    const pitch = p.autoPitch ? pitchAngle + Math.sin(t * 0.00015 * p.pitchSpeed * 0.7) * p.pitchAmp * 0.5 : pitchAngle * (0.5 + p.pitchSpeed);

    // Process held menu buttons
    processButtons();

    // Updates
    updateSparkles();
    updateFlame();
    updateLightning();

    // Step 1: Clear
    ctx.clearRect(0, 0, W, H);

    // Step 2: Starfield
    if (p.starfieldEnabled && stars.length) drawStars();

    // Step 3: Trail
    if (p.trailAlpha > 0) {
      ctx.fillStyle = 'rgba(6,6,14,' + p.trailAlpha + ')';
      ctx.fillRect(0, 0, W, H);
    }

    // Step 4: Compute & project
    const projected = [];
    const waveOrigin = getWaveOrigin(t);
    const isIcknaRender = p.renderMode === 'ickna';

    for (const pt of particles) {
      let waveX, waveY, waveZ;
      if (p.waveMode === 'am') {
        const waScale = p.waveAmp / 12; // default waveAmp=12 gives 1x scale
        waveX = waScale * (3 + 2 * Math.sin(t * 0.0006 + pt.phase)) * Math.sin(t * 0.002 + pt.phase + pt.ty * 0.01);
        waveY = waScale * (3 + 2 * Math.sin(t * 0.0008 + pt.phase * 1.3)) * Math.cos(t * 0.0025 + pt.phase * 0.7 + pt.tx * 0.008);
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
      const rotated = applyRotYawPitch({x: targetX - lcx, y: targetY - lcy, z: targetZ}, effectiveYaw, pitch);
      const rtx = rotated.x + lcx, rty = rotated.y + lcy, rtz = rotated.z;

      if (p.motionMode === 'lerp') {
        const ls = p.lerpSpeed * (1 + p.spring * 8); // spring boosts lerp speed
        pt.x += (rtx - pt.x) * ls;
        pt.y += (rty - pt.y) * ls;
        pt.z += (rtz - pt.z) * ls;
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

      let depthFade;
      if (p.depthFadeMode === 'ickna') {
        depthFade = (0.5 + 0.5 * Math.max(0.625, 1 - (zOffset - 100) / 250)) * (0.3 + p.depthFade * 0.7);
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

    projected.sort(function(a, b) { return a.z - b.z; });

    // Step 5: Core rendering
    if (isIcknaRender) {
      // Edge-to-main connection lines
      if (p.edgeLineAlpha > 0 && edgeParticles.length) {
        ctx.lineWidth = 2.0;
        const lineThreshold = 180;
        const getColor = function(flame) {
          if (Math.abs(flame) > 0.01) { const c = getFlameColor(flame); return { r: c.r, g: c.g, b: c.b }; }
          return { r: 224, g: 48, b: 48 };
        };
        const edgeScreen = [];
        for (const ep of edgeParticles) {
          const rotated = applyRotYawPitch({x: ep.tx - lcx, y: ep.ty - lcy, z: ep.tz}, effectiveYaw, pitch);
          const zOffset2 = rotated.z + 200;
          const ps2 = FOCAL / (FOCAL + zOffset2);
          edgeScreen.push({ sx: rotated.x * ps2 * baseS + cx, sy: rotated.y * ps2 * baseS + cy, color: getColor(ep.flame) });
        }
        for (let ei = 0; ei < edgeScreen.length; ei++) {
          const es = edgeScreen[ei];
          if (es.sx < -10 || es.sx > W + 10 || es.sy < -10 || es.sy > H + 10) continue;
          const mainNeighbors = [];
          for (const pp of projected) {
            const dx = es.sx - pp.px, dy = es.sy - pp.py;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < lineThreshold) mainNeighbors.push({ x: pp.px, y: pp.py, dist: dist, color: getColor(pp.pt ? pp.pt.flame : 0) });
          }
          mainNeighbors.sort(function(a, b) { return a.dist - b.dist; });
          const mainLimit = Math.min(6, mainNeighbors.length);
          for (let k = 0; k < mainLimit; k++) {
            const n = mainNeighbors[k];
            const avgR = (es.color.r + n.color.r) >> 1;
            const avgG = (es.color.g + n.color.g) >> 1;
            const avgB = (es.color.b + n.color.b) >> 1;
            ctx.globalAlpha = (1 - n.dist / lineThreshold) * p.edgeLineAlpha;
            ctx.strokeStyle = 'rgb(' + avgR + ',' + avgG + ',' + avgB + ')';
            ctx.beginPath();
            ctx.moveTo(es.sx, es.sy);
            ctx.lineTo(n.x, n.y);
            ctx.stroke();
          }
        }
      }

      // Core particles (skip cold)
      for (const pp of projected) {
        if (pp.pt && pp.pt.flame < -0.01) continue;
        ctx.globalAlpha = Math.max(0.3, Math.min(1, pp.alpha));
        ctx.fillStyle = LOGO_COLOR;
        ctx.beginPath();
        ctx.arc(pp.px, pp.py, Math.max(pp.r, 0.5), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Glow halos via glowTex
      if (p.glowMode === 'texture') {
        for (const pp of projected) {
          const glowSize = Math.max(pp.r * 6, 6) * (0.5 + p.glowBlur / 6);
          const tempScale = (pp.pt && pp.pt.flame < 0) ? Math.max(0.15, 1 + pp.pt.flame * 0.425) : 1;
          const adjGlowSize = glowSize * tempScale;
          ctx.globalAlpha = Math.max(0.2, Math.min(0.7, pp.alpha * 0.6));
          ctx.drawImage(glowTex, pp.px - adjGlowSize, pp.py - adjGlowSize, adjGlowSize * 2, adjGlowSize * 2);

          // Tint glow with flame color or base color
          if (pp.pt && Math.abs(pp.pt.flame) > 0.01) {
            const c = getFlameColor(pp.pt.flame);
            ctx.globalCompositeOperation = 'source-atop';
            ctx.globalAlpha = 0.5;
            ctx.fillStyle = 'rgb(' + c.r + ',' + c.g + ',' + c.b + ')';
            ctx.beginPath();
            ctx.arc(pp.px, pp.py, adjGlowSize, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = 1;
          } else {
            ctx.globalCompositeOperation = 'source-atop';
            ctx.globalAlpha = 0.5;
            ctx.fillStyle = LOGO_COLOR;
            ctx.beginPath();
            ctx.arc(pp.px, pp.py, adjGlowSize, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = 1;
          }

          // Core color override for temperature
          if (pp.pt && Math.abs(pp.pt.flame) > 0.01) {
            const c = getFlameColor(pp.pt.flame);
            const coreScale = pp.pt.flame < 0 ? tempScale : 1;
            ctx.globalAlpha = Math.max(0.3, Math.min(1, pp.alpha));
            ctx.fillStyle = 'rgb(' + c.r + ',' + c.g + ',' + c.b + ')';
            ctx.beginPath();
            ctx.arc(pp.px, pp.py, Math.max(pp.r * coreScale, 0.5), 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
          }

          // Main-particle sparkles
          if (pp.pt && pp.pt.sparkle > 0.1) {
            ctx.globalAlpha = pp.pt.sparkle * 0.9;
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(pp.px, pp.py, pp.r * 0.8, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.globalAlpha = 1;
      } else if (p.glowMode === 'shadow') {
        ctx.shadowColor = p.color;
        ctx.shadowBlur = p.glowBlur;
        for (const pp of projected) {
          ctx.globalAlpha = Math.max(0.15, Math.min(1, pp.alpha));
          ctx.fillStyle = LOGO_COLOR;
          ctx.beginPath();
          ctx.arc(pp.px, pp.py, Math.max(pp.r, 0.5), 0, Math.PI * 2);
          ctx.fill();
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
        if (ep.sparkle <= 0) { if (Math.random() < 0.24) ep.sparkle = 0.5 + Math.random() * 0.5; }
        else { ep.sparkle -= 0.04; if (ep.sparkle < 0) ep.sparkle = 0; }
      }
      for (const ep of edgeParticles) {
        if (ep.sparkle <= 0.02) continue;
        const rotated = applyRotYawPitch({x: ep.tx - lcx, y: ep.ty - lcy, z: ep.tz}, effectiveYaw, pitch);
        const zOffset2 = rotated.z + 200;
        const ps2 = FOCAL / (FOCAL + zOffset2);
        const sx = rotated.x * ps2 * baseS + cx;
        const sy = rotated.y * ps2 * baseS + cy;
        if (sx < -10 || sx > W + 10 || sy < -10 || sy > H + 10) continue;
        const ss = Math.min(1, Math.min(W, H) / 700);
        ctx.globalAlpha = 0.23;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(sx, sy, 1.5 * ss, 0, Math.PI * 2);
        ctx.fill();
        if (ep.sparkle > 0.02) {
          const sz = ep.sparkle * 1.4 * ss;
          ctx.globalAlpha = ep.sparkle * 0.35;
          ctx.drawImage(glowTex, sx - sz * 4, sy - sz * 4, sz * 8, sz * 8);
          ctx.globalAlpha = ep.sparkle * 0.9;
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(sx, sy, sz, 0, Math.PI * 2);
          ctx.fill();
        }
        if (Math.abs(ep.flame) > 0.01) {
          const c = getFlameColor(ep.flame);
          ctx.globalAlpha = 0.9;
          ctx.fillStyle = 'rgb(' + c.r + ',' + c.g + ',' + c.b + ')';
          ctx.beginPath();
          ctx.arc(sx, sy, 1.5 * baseS, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    } else {
      // Non-ickna render modes
      const mode = RENDER_MODES[p.renderMode] || RENDER_MODES.dots;
      mode.draw(ctx, projected, p, t);
      if (p.flameEnabled) {
        for (const pp of projected) {
          if (pp.pt && Math.abs(pp.pt.flame) > 0.01) drawFlameHalo(ctx, pp.px, pp.py, pp.r, pp.pt.flame, 1);
        }
      }
    }

    // Step 6: Lightning
    if (lightningBolts.length || lightningPaths.length) {
      ctx.shadowBlur = 0;
      const viewScale = Math.min(1, Math.min(W, H) / 800);

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
        ctx.beginPath();
        ctx.moveTo(sx1, sy1);
        const jitterAmp = (5 + Math.random() * 8) * viewScale;
        for (let s = 1; s < segments; s++) {
          const tt = s / segments;
          const bx = sx1 + (sx2 - sx1) * tt;
          const by = sy1 + (sy2 - sy1) * tt;
          const jitter = (Math.random() - 0.5) * jitterAmp * (1 - tt * 0.3);
          ctx.lineTo(bx + jitter, by + jitter * 0.7);
        }
        ctx.lineTo(sx2, sy2);
        ctx.stroke();
        ctx.lineWidth = 1.5 * viewScale;
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.stroke();
      }

      for (const ep of edgeParticles) {
        if (ep.lightning > 0.01) {
          const rotated = applyRotYawPitch({x: ep.tx - lcx, y: ep.ty - lcy, z: 0}, effectiveYaw, pitch);
          const zOff = rotated.z + 200;
          const ps = FOCAL / (FOCAL + zOff);
          const sx = rotated.x * ps * baseS + cx;
          const sy = rotated.y * ps * baseS + cy;
          ctx.globalAlpha = ep.lightning * 0.5;
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(sx, sy, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      function drawLightningPath2(pts, progress) {
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
            const jitter = (Math.random() - 0.5) * 6 * viewScale;
            ctx.lineTo(bx + jitter, by + jitter * 0.7);
          }
        }
        ctx.stroke();
      }

      for (const lp of lightningPaths) {
        const strobe = lp.progress < 1 ? (0.7 + Math.random() * 0.3) : 1;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = (3 + Math.random() * 2) * viewScale;
        ctx.globalAlpha = lp.life * 0.7 * strobe;
        drawLightningPath2(lp.path, lp.progress);
        const branchProgress = Math.max(0, lp.progress - 0.15);
        for (const branch of lp.branches) drawLightningPath2(branch, branchProgress);
        ctx.lineWidth = 1.5 * viewScale;
        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.globalAlpha = lp.life * 0.5;
        drawLightningPath2(lp.path, lp.progress);
        for (const branch of lp.branches) drawLightningPath2(branch, branchProgress);
      }
      ctx.globalAlpha = 1;
    }

    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    applyPostProcessing(p);
  } catch (e) {
    console.error('Mote frame error:', e);
  }
  animId = requestAnimationFrame(frame);
}

function startLoop() {
  document.getElementById('loading').classList.add('hidden');
  setTimeout(function() { document.getElementById('loading').classList.add('hidden'); }, 3000);
  initPlaybackMenu();
  setTimeout(function() { yRotEnabled = true; }, 5000);
  animStartTime = performance.now();
  frame(animStartTime);
}

// ── Keyboard ───────────────────────────────────────────────
document.addEventListener('keydown', function(e) {
  keys[e.key] = true;
  if (e.key === '/') yRotEnabled = !yRotEnabled;
  if (e.key === '=' || e.key === '+') { const idx = Math.floor(Math.random() * edgeParticles.length); if (edgeParticles[idx]) { edgeParticles[idx].flame = -2.0; PRESET.params.flameEnabled = true; } }
    if (e.key === '\\\\' || e.key === '|') { const idx = Math.floor(Math.random() * edgeParticles.length); if (edgeParticles[idx]) { edgeParticles[idx].flame = 2.0; PRESET.params.flameEnabled = true; } }
    if (e.key === '-' || e.key === '_') { PRESET.params.lightningEnabled = true; spawnChainLightning(); }
    if (e.key === '0' || e.key === ')') { PRESET.params.lightningEnabled = true; spawnGuidedBolt(); }
  });
  document.addEventListener('keyup', function(e) { keys[e.key] = false; });

// ── Drag ───────────────────────────────────────────────────
let dragState = { active: false, startX: 0, startY: 0, moved: false };
const DRAG_SENSITIVITY = 0.008;
function onPointerDown(e) {
  if (document.getElementById('pmenu-items').classList.contains('open')) return;
  const p = e.touches ? (e.touches[0] || e.changedTouches[0]) : e;
  dragState.active = true; dragState.startX = p.clientX; dragState.startY = p.clientY; dragState.moved = false;
}
function onPointerMove(e) {
  if (!dragState.active || document.getElementById('pmenu-items').classList.contains('open')) return;
  const p = e.touches ? (e.touches[0] || e.changedTouches[0]) : e;
  const dx = p.clientX - dragState.startX, dy = p.clientY - dragState.startY;
  if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragState.moved = true;
  yawAngle += dx * DRAG_SENSITIVITY; pitchAngle += dy * DRAG_SENSITIVITY;
  dragState.startX = p.clientX; dragState.startY = p.clientY;
}
function onPointerUp() {
  if (dragState.active && !dragState.moved) yRotEnabled = !yRotEnabled;
  dragState.active = false;
}
window.addEventListener('mousedown', onPointerDown);
window.addEventListener('mousemove', onPointerMove);
window.addEventListener('mouseup', onPointerUp);
window.addEventListener('touchstart', onPointerDown, { passive: true });
window.addEventListener('touchmove', onPointerMove, { passive: true });
window.addEventListener('touchend', onPointerUp, { passive: true });

// ── Visibility ────────────────────────────────────────────
document.addEventListener('visibilitychange', function() {
  if (document.hidden && animId) { cancelAnimationFrame(animId); animId = null; }
  else if (!document.hidden && !animId) frame(performance.now());
});

init();
${SCRIPT_CLOSE}
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html' });
  downloadBlob(blob, `${preset.name || 'mote-playback'}.html`);
}


// ═══════════════════════════════════════════════════════════════
// Boot
// ═══════════════════════════════════════════════════════════════
// Playback menu + auto-repeat system (landing page parity)
// ═══════════════════════════════════════════════════════════════

const pmenuButtons = {};
const pmenuAutoRepeat = {};
const pmenuRepeatRates = {};
let pmenuButtonTimer = 0;

function triggerAction(action) {
  if (action === 'ice') {
    const idx = Math.floor(Math.random() * edgeParticles.length);
    if (edgeParticles[idx]) { edgeParticles[idx].flame = -2.0; params.flameEnabled = true; }
  } else if (action === 'fire') {
    const idx = Math.floor(Math.random() * edgeParticles.length);
    if (edgeParticles[idx]) { edgeParticles[idx].flame = 2.0; params.flameEnabled = true; }
  } else if (action === 'lightning') {
    params.lightningEnabled = true;
    spawnGuidedBolt();
  }
}

function processButtons() {
  pmenuButtonTimer++;
  for (const key in pmenuButtons) {
    if (pmenuButtons[key] && pmenuButtonTimer % Math.max(2, Math.floor((31 - pmenuRepeatRates[key]) / 2)) === 0) {
      triggerAction(key);
    }
  }
  for (const key in pmenuAutoRepeat) {
    if (pmenuAutoRepeat[key] && !pmenuButtons[key] && pmenuButtonTimer % Math.max(2, Math.floor((31 - pmenuRepeatRates[key]) / 2)) === 0) {
      triggerAction(key);
    }
  }
}

function initPlaybackMenu() {
  const btn = document.getElementById('pmenu-btn');
  const items = document.getElementById('pmenu-items');
  if (!btn || !items) return;
  btn.addEventListener('click', () => items.classList.toggle('open'));

  document.querySelectorAll('.pmenu-row').forEach(row => {
    const action = row.dataset.action;
    pmenuAutoRepeat[action] = false;
    pmenuRepeatRates[action] = 15;

    row.querySelector('.pmenu-label').addEventListener('click', () => triggerAction(action));
    row.querySelector('.pmenu-label').addEventListener('touchstart', (e) => { e.preventDefault(); triggerAction(action); }, { passive: true });

    const start = () => { pmenuButtons[action] = true; triggerAction(action); };
    const end = () => { pmenuButtons[action] = false; };
    row.addEventListener('mousedown', start);
    row.addEventListener('mouseup', end);
    row.addEventListener('mouseleave', end);
    row.addEventListener('touchstart', start, { passive: true });
    row.addEventListener('touchend', end, { passive: true });

    row.querySelector('.pmenu-toggle input').addEventListener('change', (e) => {
      pmenuAutoRepeat[action] = e.target.checked;
    });
    row.querySelector('.rate-slider').addEventListener('input', (e) => {
      pmenuRepeatRates[action] = parseInt(e.target.value);
    });
  });
}

// ═══════════════════════════════════════════════════════════════
// Boot
// ═══════════════════════════════════════════════════════════════

async function boot() {
  if (isPlayMode) {
    document.body.classList.add('mode-play');
    document.getElementById('player-overlay').style.display = 'block';

    // Try to load preset
    if (presetParam && presetParam !== 'ickna') {
      try {
        const resp = await fetch(presetParam);
        const preset = await resp.json();
        loadPreset(preset);
      } catch (e) {
        console.warn('Failed to load preset, falling back to ickna');
        loadPreset({ name: 'ickna', version: 1, svg: ICKNA_SVG, params: DEFAULT_PARAMS });
      }
    } else {
      loadPreset({ name: 'ickna', version: 1, svg: ICKNA_SVG, params: DEFAULT_PARAMS });
    }
  } else {
    // Editor mode
    initUI();
    loadSVG(ICKNA_SVG);
  }

  // ── WebSocket remote control ──────────────────────────────────
  if (wsPort > 0) {
    const indicator = document.getElementById('ws-indicator');
    function connectWS() {
      const url = 'ws://localhost:' + wsPort;
      wsConnection = new WebSocket(url);
      wsConnection.onopen = function() {
        wsConnected = true;
        if (indicator) indicator.className = 'connected';
        console.log('[mote] ws connected to ' + url);
      };
      wsConnection.onclose = function() {
        wsConnected = false;
        if (indicator) indicator.className = 'error';
        console.log('[mote] ws disconnected, retrying in 3s...');
        setTimeout(connectWS, 3000);
      };
      wsConnection.onerror = function() {
        if (indicator) indicator.className = 'error';
      };
      wsConnection.onmessage = function(event) {
        try {
          const msg = JSON.parse(event.data);
          handleWSCommand(msg);
        } catch (e) {}
      };
    }

    function handleWSCommand(msg) {
      switch (msg.cmd) {
        case 'preset':
          if (msg.preset) {
            loadPreset(msg.preset);
          } else if (msg.name) {
            // Try loading from localStorage presets, fall back to loading by name
            const presets = getLocalPresets();
            if (presets[msg.name]) {
              loadPreset({ name: msg.name, svg: presets[msg.name].svg, params: presets[msg.name].params });
            } else {
              console.warn('[mote] unknown preset:', msg.name);
            }
          }
          break;
        case 'param':
          if (msg.key && msg.value !== undefined) {
            params[msg.key] = msg.value;
            updateUI();
          }
          break;
        case 'effect':
          triggerAction(msg.type);
          break;
        case 'play':
          if (playlist.length > 0) {
            playlistIndex = Math.min(msg.index || 0, playlist.length - 1);
            isPlaylistPlaying = true;
            playlistTimer = performance.now();
            const item = playlist[playlistIndex];
            if (item) loadPreset(item);
          }
          break;
        case 'stop':
          isPlaylistPlaying = false;
          break;
      }
    }

    connectWS();
  }

  // Auto-init audio if ?audio= param is set
  if (audioParam) {
    params.audioEnabled = true;
    params.audioSource = audioParam === 'mic' ? 'mic' : 'element';
    AudioReactivity.init(params.audioSource).catch(function() {
      params.audioEnabled = false;
    });
  }

    // Start self-healing render loop
  function loop(now) {
    // FPS throttle
    if (fpsLimit > 0) {
      const minInterval = 1000 / fpsLimit;
      if (now - lastFrameTime < minInterval) { animId = requestAnimationFrame(loop); return; }
      lastFrameTime = now;
    }
    try { frame(performance.now()); }
    catch (e) { console.error('Mote loop error:', e); }
  }
  animStartTime = performance.now();
  loop(0);

  // Hide player overlay when requested
  if (hideOverlay) {
    const overlay = document.getElementById('player-overlay');
    if (overlay) overlay.style.display = 'none';
  }

  // Chroma key background override (?bgcolor=#00ff00)
  if (bgColor) {
    document.body.style.background = bgColor;
  }

  // Fullscreen (?fullscreen=1 or ?fullscreen=true)
  if (fullscreenParam === '1' || fullscreenParam === 'true') {
    const el = document.documentElement;
    if (el.requestFullscreen) { el.requestFullscreen().catch(function() {}); }
    else if (el.webkitRequestFullscreen) { el.webkitRequestFullscreen(); }
    else if (el.msRequestFullscreen) { el.msRequestFullscreen(); }
  }

  // PWA standalone detection
  if (window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches) {
    document.body.classList.add('pwa-mode');
  }

  // Cancel animation on page hide (memory/performance)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && animId) {
      cancelAnimationFrame(animId);
      animId = null;
    } else if (!document.hidden && !animId) {
      loop(performance.now());
    }
  });

  // Init starfield
  initStars();

  // Init playback hamburger menu
  initPlaybackMenu();

  // Delayed auto-rotation start (landing page: 5s settle-in)
  yRotEnabled = false;
  setTimeout(() => { yRotEnabled = true; }, 5000);

  // Editor FX buttons
  document.getElementById('btn-fx-ice')?.addEventListener('click', () => {
    const idx = Math.floor(Math.random() * edgeParticles.length);
    if (edgeParticles[idx]) { edgeParticles[idx].flame = -2.0; params.flameEnabled = true; }
  });
  document.getElementById('btn-fx-fire')?.addEventListener('click', () => {
    const idx = Math.floor(Math.random() * edgeParticles.length);
    if (edgeParticles[idx]) { edgeParticles[idx].flame = 2.0; params.flameEnabled = true; }
  });
  document.getElementById('btn-fx-lightning')?.addEventListener('click', () => {
    params.lightningEnabled = true;
    spawnGuidedBolt();
  });

  window.addEventListener('resize', () => {
    if (params.starfieldEnabled) initStars();
  });

  // Drag rotation
  function onPointerDown(e) {
    if (document.getElementById('pmenu-items')?.classList.contains('open')) return;
    const p = e.touches ? e.touches[0] || e.changedTouches[0] : e;
    dragState.active = true;
    dragState.startX = p.clientX;
    dragState.startY = p.clientY;
    dragState.moved = false;
  }
  function onPointerMove(e) {
    if (!dragState.active) return;
    if (document.getElementById('pmenu-items')?.classList.contains('open')) return;
    const p = e.touches ? e.touches[0] || e.changedTouches[0] : e;
    const dx = p.clientX - dragState.startX;
    const dy = p.clientY - dragState.startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragState.moved = true;
    yawAngle += dx * DRAG_SENSITIVITY;
    pitchAngle += dy * DRAG_SENSITIVITY;
    dragState.startX = p.clientX;
    dragState.startY = p.clientY;
  }
  function onPointerUp(e) {
    if (dragState.active && !dragState.moved) {
      yRotEnabled = !yRotEnabled;
    }
    dragState.active = false;
  }
  let dragListenersActive = false;
  window.setDragEnabled = function(on) {
    if (on && !dragListenersActive) {
      window.addEventListener('mousedown', onPointerDown);
      window.addEventListener('mousemove', onPointerMove);
      window.addEventListener('mouseup', onPointerUp);
      window.addEventListener('touchstart', onPointerDown, { passive: true });
      window.addEventListener('touchmove', onPointerMove, { passive: true });
      window.addEventListener('touchend', onPointerUp, { passive: true });
      dragListenersActive = true;
    } else if (!on && dragListenersActive) {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('mouseup', onPointerUp);
      window.removeEventListener('touchstart', onPointerDown);
      window.removeEventListener('touchmove', onPointerMove);
      window.removeEventListener('touchend', onPointerUp);
      dragListenersActive = false;
    }
  };
  if (params.dragEnabled) setDragEnabled(true);

  // Keyboard controls
  document.addEventListener('keydown', e => { keys[e.key] = true; if (e.key === '/') yRotEnabled = !yRotEnabled; if (e.key === '=' || e.key === '+') { const idx = Math.floor(Math.random() * edgeParticles.length); if (edgeParticles[idx]) { edgeParticles[idx].flame = -2.0; params.flameEnabled = true; } } if (e.key === '\\' || e.key === '|') { const idx = Math.floor(Math.random() * edgeParticles.length); if (edgeParticles[idx]) { edgeParticles[idx].flame = 2.0; params.flameEnabled = true; } } if (e.key === '-' || e.key === '_') { params.lightningEnabled = true; spawnChainLightning(); } if (e.key === '0' || e.key === ')') { params.lightningEnabled = true; spawnGuidedBolt(); } });
  document.addEventListener('keyup', e => { keys[e.key] = false; });

  // Hide loading (500ms default, 3s fallback for ickna profile with heavy particle count)
  setTimeout(() => document.getElementById('loading').classList.add('hidden'), 500);
  setTimeout(() => document.getElementById('loading').classList.add('hidden'), 3000);
}

boot();