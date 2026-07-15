#!/usr/bin/env node
/**
 * Mote build script — assembles mote.html from source files.
 *
 * Source: src/html/* (skeleton), src/js/* (JavaScript modules)
 * Output: mote.html (single-file, file:// compatible, no imports)
 *
 * JS files are concatenated in order with namespace wrappers where needed.
 */

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SRC = path.join(ROOT, 'src');
const OUT = path.join(ROOT, 'mote.html');

// ── HTML skeleton ──────────────────────────────────────────────
const css  = fs.readFileSync(path.join(SRC, 'html', 'style.css'), 'utf8');
const head = fs.readFileSync(path.join(SRC, 'html', 'head.html'), 'utf8');
const body = fs.readFileSync(path.join(SRC, 'html', 'body.html'), 'utf8');
const foot = fs.readFileSync(path.join(SRC, 'html', 'foot.html'), 'utf8');

// ── JS modules (ordered) ──────────────────────────────────────
// Each file is plain JS. The build wraps the whole thing in a Mote namespace.
const jsFiles = [
  'core/params.js',
  'core/color.js',
  'core/noise.js',
  'core/audio.js',
  'core/state.js',
  'engine/svg-parser.js',
  'engine/render-modes.js',
  'engine/effects.js',
  'engine/animator.js',
  'engine/rendering.js',
  'engine/post.js',
  'engine/nebula.js',
  'engine/frame.js',
  'ui/update.js',
  'ui/menu.js',
  'ui/tabs.js',
  'ui/init.js',
  'export/export.js',
  'boot.js',
];

let jsCode = '/** Mote — SVG-to-particle engine. Built ' + new Date().toISOString().slice(0,10) + ' */\n\n';

// Check if all module files exist — if not, fall back to monolithic main.js
const allModulesExist = jsFiles.every(f => fs.existsSync(path.join(SRC, 'js', f)));

if (allModulesExist) {
  for (const file of jsFiles) {
    const fp = path.join(SRC, 'js', file);
    const content = fs.readFileSync(fp, 'utf8').trim();
    if (content) {
      jsCode += '\n// ══ ' + file + ' ══\n' + content + '\n';
    }
  }
  console.log('  (' + jsFiles.length + ' JS modules)');
} else {
  // Monolithic fallback
  jsCode = fs.readFileSync(path.join(SRC, 'js', 'main.js'), 'utf8');
  const missing = jsFiles.filter(f => !fs.existsSync(path.join(SRC, 'js', f)));
  console.log('  (using main.js — ' + missing.length + ' modules not yet extracted)');
}

// ── Assemble ───────────────────────────────────────────────────
const html = head
  .replace('/* CSS */', '<style>\n' + css + '</style>')
  + '\n' + body
  + '\n<script>\n'
  + '/** Mote — SVG-to-particle engine. Built ' + new Date().toISOString().slice(0,10) + ' */\n'
  + '(function() {\n'
  + jsCode
  + '\n// ── Public API (accessible via window.Mote) ─────────────────\n'
  + 'window.Mote = {\n'
  + '  params: params,\n'
  + '  particles: particles,\n'
  + '  edgeParticles: edgeParticles,\n'
  + '  frame: frame,\n'
  + '  loadPreset: loadPreset,\n'
  + '  getPreset: getPreset,\n'
  + '  triggerAction: triggerAction,\n'
  + '  applyParams: applyParams,\n'
  + '  resetParticles: resetParticles,\n'
  + '  engine: {\n'
  + '    animEvaluate: typeof animEvaluate !== \"undefined\" ? animEvaluate : null,\n'
  + '    applyPostProcessing: typeof applyPostProcessing !== \"undefined\" ? applyPostProcessing : null,\n'
  + '    getFlameColor: typeof getFlameColor !== \"undefined\" ? getFlameColor : null,\n'
  + '    updateFlame: typeof updateFlame !== \"undefined\" ? updateFlame : null,\n'
  + '    updateLightning: typeof updateLightning !== \"undefined\" ? updateLightning : null,\n'
  + '    spawnChainLightning: typeof spawnChainLightning !== \"undefined\" ? spawnChainLightning : null,\n'
  + '    spawnGuidedBolt: typeof spawnGuidedBolt !== \"undefined\" ? spawnGuidedBolt : null,\n'
  + '    renderNebula: typeof renderNebula !== \"undefined\" ? renderNebula : null,\n'
  + '  },\n'
  + '  audio: typeof AudioReactivity !== \"undefined\" ? AudioReactivity : null,\n'
  + '  noise: typeof simplex !== \"undefined\" ? simplex : null,\n'
  + '};\n'
  + '})();\n'
  + '\n</script>\n'
  + foot + '\n';

fs.writeFileSync(OUT, html);
console.log('Built mote.html (' + (html.length / 1024).toFixed(1) + ' KB, ' + jsFiles.filter(f => fs.existsSync(path.join(SRC, 'js', f))).length + ' JS modules)');
