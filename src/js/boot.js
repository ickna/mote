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
