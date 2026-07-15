# Mote — Parameter Reference

All parameters live in `DEFAULT_PARAMS` and are serialized in presets.  
Values flow through `animEvaluate()` then `frame()` each frame.

## Rotation
| Param | Type | Default | Used in frame() |
|-------|------|---------|-----------------|
| `yawSpeed` | number (0–2) | 0.5 | `Math.sin(t * 0.0003 * p.yawSpeed * 2)` — auto-yaw frequency |
| `pitchSpeed` | number (0–1) | 0.3 | Auto-pitch frequency + manual pitch scaling |
| `yawAmp` | number (0–1) | 0.262 | `* p.yawAmp` — amplitude of auto-yaw oscillation |
| `pitchAmp` | number (0–0.5) | 0.08 | Auto-pitch amplitude |
| `autoPitch` | boolean | false | Toggles sinusoidal pitch modulation |

## Particle Motion
| Param | Type | Default | Used in frame() |
|-------|------|---------|-----------------|
| `spacing` | number (4–30) | 10 | Particle density during `sampleIckna()` — triggers re-sample on change |
| `motionMode` | 'lerp' \| 'spring' | 'lerp' | Selects lerp or spring-damper motion model |
| `lerpSpeed` | number (0.02–0.2) | 0.08 | Lerp rate toward target. Boosted by spring in lerp mode |
| `spring` | number (0.01–0.2) | 0.05 | Spring constant. In lerp mode: boosts lerp speed. In spring mode: attraction strength |
| `damping` | number (0.5–0.98) | 0.88 | Velocity decay per frame (spring mode only) |
| `waveMode` | 'am' \| 'fixed' | 'am' | AM uses scaled sine waves. Fixed uses waveAmp+waveFreq directly |
| `waveAmp` | number (0–40) | 12 | Wave amplitude. Scales AM waves, direct amplitude in fixed mode |
| `waveFreq` | number (0–0.01) | 0.002 | Wave frequency (fixed mode only) |
| `zDispersion` | number (0–200) | 60 | Depth variation: `targetZ *= zDispersion / 60` |

## Appearance
| Param | Type | Default | Used in frame() |
|-------|------|---------|-----------------|
| `sizeMin` | number (0.5–8) | 1.5 | Min particle size during `sampleIckna()` |
| `sizeMax` | number (1–16) | 7.5 | Max particle size during `sampleIckna()` |
| `sizeScale` | number (0.1–3) | 0.48 | Global size multiplier in projection |
| `glowMode` | 'texture' \| 'shadow' \| 'off' | 'texture' | Glow rendering method |
| `glowBlur` | number (0–20) | 3 | Shadow blur radius or texture size scaling |
| `depthFadeMode` | 'ickna' \| 'linear' | 'ickna' | Depth fade formula |
| `depthFade` | number (0–1) | 0.6 | Fade strength. Scales both ickna and linear formulas |
| `color` | color | '#e03030' | Primary particle color |
| `colorSecondary` | color | '#7b2ff7' | Secondary color for gradients |
| `colorMode` | 'solid' \| 'gradient-z' \| 'gradient-position' \| 'gradient-random' | 'solid' | Color interpolation mode |
| `scale` | number (0.1–1.5) | 0.90 | Logo display scale |
| `renderMode` | 'ickna' \| 'dots' \| 'lines' \| 'triangles' \| 'glow' | 'ickna' | Rendering pipeline |

## Background & Effects
| Param | Type | Default | Used in frame() |
|-------|------|---------|-----------------|
| `starfieldEnabled` | boolean | true | Toggle parallax star background |
| `trailAlpha` | number (0–0.5) | 0.34 | Motion trail opacity |
| `flameEnabled` | boolean | false | Fire/ice thermal propagation |
| `lightningEnabled` | boolean | false | Chain + guided lightning |
| `edgeLineAlpha` | number (0–1) | 0.4 | Edge-to-main connection line opacity |
| `nebulaEnabled` | boolean | false | Simplex noise nebula background |

## Post-Processing
| Param | Type | Default | Used in frame() |
|-------|------|---------|-----------------|
| `bloom` | boolean | false | Half-res blur + additive composite |
| `bloomIntensity` | number (0–1) | 0.4 | Bloom strength |
| `vignette` | boolean | false | Radial gradient darkening overlay |
| `colorGrade` | 'none' \| 'warm' \| 'cool' \| 'dramatic' | 'none' | CSS filter color grade preset |

## Audio
| Param | Type | Default | Used in frame() |
|-------|------|---------|-----------------|
| `audioEnabled` | boolean | false | Enable FFT audio reactivity |
| `audioSource` | 'mic' \| 'element' | 'mic' | Audio input source |
| `audioImpact` | number (0–1) | 0.5 | Blend between base and audio-reactive values |

## Interaction
| Param | Type | Default | Used in frame() |
|-------|------|---------|-----------------|
| `dragEnabled` | boolean | false | Click-drag rotation (toggle) |

## Animation
| Param | Type | Default | Used in frame() |
|-------|------|---------|-----------------|
| `anim` | object | `{}` | Keyframe animations: `{ paramName: { keyframes: [[ms, val], ...], easing, loop } }` |

## Misc
| Param | Type | Default | Used in frame() |
|-------|------|---------|-----------------|
| `transitionDuration` | number (0–3000) | 800 | Crossfade duration in ms |
| `lineThreshold` | number (20–200) | 60 | Max connection distance for lines/triangles render modes |