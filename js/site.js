/* Site script. No libraries, no storage, no console output. The only request that sends anything is the pilot form's POST,
   and only when the site config gives it an endpoint (the 360 views load their own picture, nothing else). Motion happens
   only on load (the hero wipe, once) or when the visitor acts. Nothing is driven by scroll position: the phone CTA bar and
   the carousel dots are instant state changes. */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const root = document.documentElement;
  root.classList.add('js');
  const mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const RM = () => mqReduce.matches;
  if (RM()) root.classList.add('rm');
  const hasIO = 'IntersectionObserver' in window;

  /* ---- small-screen menu ---- */
  const head = $('#site-head');
  const menuBtn = $('#menu-btn');
  const menu = $('#menu');
  if (menuBtn && menu) {
    const setMenu = open => {
      menuBtn.setAttribute('aria-expanded', String(open));
      menu.hidden = !open;
      if (head) head.classList.toggle('menu-open', open);
    };
    menuBtn.addEventListener('click', () => setMenu(menuBtn.getAttribute('aria-expanded') !== 'true'));
    menu.addEventListener('click', e => { if (e.target.closest('a')) setMenu(false); });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !menu.hidden) { setMenu(false); menuBtn.focus(); }
    });
    window.matchMedia('(min-width: 768px)').addEventListener('change', e => { if (e.matches) setMenu(false); });
  }

  /* ---- drawing -> render compare (clip-path). The hero wipes once on load (2 s), then drags; the small one in the
     Architects tab rests at half. Labels ride inside the slider; the hero's "Drag to compare" hint fades after a drag. ---- */
  const compare = (cmp, opts) => {
    const handle = $('.cmp-handle', cmp);
    if (!handle) return;
    let x = 100, raf = 0, dragging = false, started = false, pend = null;
    const set = v => {
      x = Math.max(0, Math.min(100, v));
      cmp.style.setProperty('--x', x.toFixed(2) + '%');
      const n = Math.round(x);
      handle.setAttribute('aria-valuenow', String(n));
      handle.setAttribute('aria-valuetext', n >= 100 ? 'All drawing' : n <= 0 ? 'All render' : n + ' percent drawing, ' + (100 - n) + ' percent render');
      cmp.classList.toggle('no-s', x < 13);
      cmp.classList.toggle('no-r', x > 87);
    };
    const stop = () => { if (raf) cancelAnimationFrame(raf); raf = 0; };
    const touched = () => { stop(); started = true; cmp.classList.add('dragged'); };
    const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    const wipe = () => {
      if (RM()) { set(opts.rest()); return; }
      const from = 100, to = opts.rest(), dur = 2000;
      let t0 = 0;
      const step = ts => {
        if (!t0) t0 = ts;
        const k = Math.min(1, (ts - t0) / dur);
        set(from + (to - from) * ease(k));
        raf = k < 1 ? requestAnimationFrame(step) : 0;
      };
      raf = requestAnimationFrame(step);
    };
    if (opts.auto) {
      set(RM() ? opts.rest() : 100);
      const go = () => { if (!started) { started = true; wipe(); } };
      const layers = $$('.lay img', cmp);
      Promise.all(layers.map(i => (i.decode ? i.decode().catch(() => {}) : Promise.resolve()))).then(() => setTimeout(go, 200));
      setTimeout(go, 2400);
    } else {
      set(opts.rest());
      started = true;
    }
    const fromEvent = e => {
      const r = cmp.getBoundingClientRect();
      return ((e.clientX - r.left) / r.width) * 100;
    };
    // mouse and pen: press anywhere to set the split, then drag. Touch: a finger on the image takes the slider only once it
    // moves sideways, so scrolling the page past it never jumps the split (the handle itself takes it at once).
    const grab = e => {
      touched(); dragging = true;
      try { cmp.setPointerCapture(e.pointerId); } catch (_) { /* older engines */ }
    };
    cmp.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      if (e.pointerType === 'touch' && !e.target.closest('.cmp-handle')) { pend = { x: e.clientX, y: e.clientY }; return; }
      grab(e);
      set(fromEvent(e));
      handle.focus({ preventScroll: true, focusVisible: false });
      e.preventDefault();
    });
    cmp.addEventListener('pointermove', e => {
      if (pend) {
        const dx = e.clientX - pend.x, dy = e.clientY - pend.y;
        if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy)) return;
        pend = null; grab(e);
      }
      if (dragging) set(fromEvent(e));
    });
    const end = () => { dragging = false; pend = null; };
    cmp.addEventListener('pointerup', end);
    cmp.addEventListener('pointercancel', end);
    cmp.addEventListener('lostpointercapture', end);
    handle.addEventListener('keydown', e => {
      const k = e.key;
      let v = null;
      if (k === 'ArrowLeft' || k === 'ArrowDown') v = x - 2;
      else if (k === 'ArrowRight' || k === 'ArrowUp') v = x + 2;
      else if (k === 'PageDown') v = x - 10;
      else if (k === 'PageUp') v = x + 10;
      else if (k === 'Home') v = 0;
      else if (k === 'End') v = 100;
      if (v !== null) { e.preventDefault(); touched(); set(v); }
    });
  };
  const hero = $('#compare');
  if (hero) {
    compare(hero, {
      auto: true,
      // resting split, set in IMAGE coordinates (left of every dimension label, so none straddles the divide), mapped to the box.
      // r5-publish: on phones the 1:1 frame rests at 38 % (the drawing side holds the mill and the start of the diamond
      // window; the 3.0 m storey dimension sits at 65 %, on the render)
      rest: () => {
        const fr = $('.clip-r .frame', hero);
        const b = hero.getBoundingClientRect();
        const f = fr ? fr.getBoundingClientRect() : b;
        // r6-qa (rulings addendum): desktop rests at 55 % of the box (60 % from 768 to 1099 px, where the copy column is
        // relatively wider)
        const k = window.matchMedia('(max-width: 767px)').matches ? 0.38 : window.matchMedia('(max-width: 1099px)').matches ? 0.35 : 0.30;
        return b.width ? Math.max(20, Math.min(80, ((f.left - b.left + k * f.width) / b.width) * 100)) : 50;
      },
    });
  }
  $$('.cmp-mini').forEach(c => compare(c, { auto: false, rest: () => 50 }));

  /* ---- living images: muted loops, loaded when near the screen, each with its own pause button ---- */
  // r5: every looping video gets the same pause button, also one added later without it (a copy of the first button)
  const btnTpl = $('.lv-btn');
  $$('video.lv, video[loop]').forEach(v => {
    if (v.closest('dialog')) return;
    const box = v.closest('.lv-box') || v.parentElement;
    box.classList.add('lv-box');
    if (!$('.lv-btn', box) && btnTpl) {
      const b = btnTpl.cloneNode(true);
      b.dataset.what = 'the loop';
      b.setAttribute('aria-label', 'Pause the loop');
      box.appendChild(b);
    }
  });
  const boxes = $$('.lv-box');
  // r6: a loop may carry a 4:5 crop for phones (data-src-m) and a WebM twin (data-webm, data-webm-m); the choice is made
  // once, when the loop first loads
  const mqPhone = window.matchMedia('(max-width: 767px)');
  const webmOk = (() => { try { return document.createElement('video').canPlayType('video/webm; codecs="vp9"') === 'probably'; } catch (_) { return false; } })();
  const pickSrc = v => {
    const d = v.dataset, m = mqPhone.matches && d.srcM;
    if (webmOk && (m ? d.webmM : d.webm)) return m ? d.webmM : d.webm;
    return m ? d.srcM : d.src;
  };
  const load = v => { if (!v.getAttribute('src') && v.dataset.src) v.src = pickSrc(v); };
  // r6-qa: the 4:5 phone clip gets its own 4:5 poster (data-poster-m), so nothing jumps when it starts
  if (mqPhone.matches) $$('video[data-poster-m]').forEach(v => { v.poster = v.dataset.posterM; });
  // r6: the VR clip's 'Option A / Option B' chip is HTML and follows the clip's time (the hard cut at data-cut seconds)
  $$('video[data-cut]').forEach(v => {
    const chip = $('.opt-chip', v.closest('.vid') || v.parentElement);
    const cut = parseFloat(v.dataset.cut) || 0;
    const labels = (v.dataset.labels || '').split('|');
    if (!chip || !cut || labels.length < 2) return;
    const sync = () => { const t = labels[v.currentTime >= cut ? 1 : 0]; if (chip.textContent !== t) chip.textContent = t; };
    if ('requestVideoFrameCallback' in v) {
      const tick = () => { sync(); v.requestVideoFrameCallback(tick); };
      v.requestVideoFrameCallback(tick);
    }
    v.addEventListener('timeupdate', sync);
    v.addEventListener('seeked', sync);
  });
  boxes.forEach(box => {
    const v = $('video', box);
    const b = $('.lv-btn', box);
    if (!v || !b) return;
    const what = b.dataset.what || 'the loop';
    const sync = () => {
      const paused = v.paused;
      box.classList.toggle('paused', paused && (box.classList.contains('user') || !RM()) && box.dataset.started === '1');
      b.setAttribute('aria-label', (paused ? 'Play ' : 'Pause ') + what);
    };
    v.addEventListener('play', () => { box.dataset.started = '1'; sync(); });
    v.addEventListener('pause', sync);
    b.addEventListener('click', () => {
      box.classList.add('user');
      if (v.paused) { load(v); v.play().catch(() => {}); } else { v.pause(); }
      sync();
    });
    sync();
  });
  if (!RM()) {
    const start = v => { load(v); v.play().catch(() => {}); };
    const vids = boxes.map(b => $('video', b)).filter(Boolean);
    if (hasIO) {
      const io = new IntersectionObserver(es => es.forEach(e => {
        if (e.isIntersecting) { start(e.target); io.unobserve(e.target); }
      }), { rootMargin: '400px 400px' });
      vids.forEach(v => io.observe(v));
    } else {
      vids.forEach(start);
    }
  }

  /* ---- proof: the drawing over the render: 'Render | With drawing', the rooms' segmented pair (r5-publish, item 8) ---- */
  const regSw = $$('#reg-toggle [data-lines]');
  const regLines = $('#reg-lines');
  if (regSw.length && regLines) {
    regSw.forEach(b => b.addEventListener('click', () => {
      const on = b.dataset.lines === '1';
      regSw.forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      regLines.classList.toggle('off', !on);
    }));
  }

  /* ---- 360 views (r5-qa, lead addendum 3): a real 360 viewer. The equirectangular render is drawn through a rectilinear
     (pinhole) camera, 72 degrees across with the horizon level, so verticals, the window and the worktop stay straight: no
     fisheye. WebGL first (a small inline shader, bicubic, wrapping across the seam); a 2D canvas does the same projection
     where WebGL is missing; where neither can read the image, the room's still stays (tools/r5qa_media.py made it through
     the same camera). Drag or the left and right arrow keys turn the view. No auto-rotation and no motion on scroll:
     nothing moves unless the visitor moves it, so reduced motion needs no special case. A view inside a hidden tab sets
     itself up when it is shown. ---- */
  const HFOV = 72 * Math.PI / 180;
  // r5-publish (items 4, 17): until the 6144 px equirects land, the Platform view on wide screens is narrower (columns 5-12,
  // site.css) and opens wider, 85 degrees across, so the picture is upscaled about 1.9x instead of about 3.3x. With the
  // finals: set PANO_WIDE_FOV back to 72 and remove the wide-screen .tour block in site.css.
  const PANO_WIDE_FOV = 85 * Math.PI / 180;
  const mqWide = window.matchMedia('(min-width: 1100px)');     // r6-qa: the narrow wide-screen 360 column starts at 1100 px (site.css)
  const fovOf = pano => (pano.id === 'pano' && mqWide.matches ? PANO_WIDE_FOV : HFOV);
  const VS = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  const FS = [
    '#ifdef GL_FRAGMENT_PRECISION_HIGH', 'precision highp float;', '#else', 'precision mediump float;', '#endif',
    'uniform sampler2D t;uniform vec2 res;uniform vec2 ts;uniform float yaw;uniform float f;',
    'vec3 tx(vec2 c){c.x=mod(c.x,ts.x);c.y=clamp(c.y,0.,ts.y-1.);return texture2D(t,(c+.5)/ts).rgb;}',
    'vec4 cw(float x){float x2=x*x;float x3=x2*x;return vec4(-.5*x3+x2-.5*x,1.5*x3-2.5*x2+1.,-1.5*x3+2.*x2+.5*x,.5*x3-.5*x2);}',
    'vec3 row(vec2 i,float dy,vec4 w){return w.x*tx(i+vec2(-1.,dy))+w.y*tx(i+vec2(0.,dy))+w.z*tx(i+vec2(1.,dy))+w.w*tx(i+vec2(2.,dy));}',
    'void main(){vec2 q=gl_FragCoord.xy-.5*res;',
    'float lon=atan(q.x,f)+yaw;float lat=atan(q.y,length(vec2(q.x,f)));',
    'vec2 uv=vec2(lon/6.2831853+.5,.5-lat/3.1415927)*ts-.5;vec2 i=floor(uv);vec2 r=uv-i;',
    'vec4 wx=cw(r.x);vec4 wy=cw(r.y);',
    'vec3 c=wy.x*row(i,-1.,wx)+wy.y*row(i,0.,wx)+wy.z*row(i,1.,wx)+wy.w*row(i,2.,wx);',
    'gl_FragColor=vec4(clamp(c,0.,1.),1.);}'].join('\n');

  // WebGL: null where WebGL is missing; setImage throws where the image cannot be read (a cross-origin host)
  const glView = cv => {
    let gl = null;
    try { gl = cv.getContext('webgl', { antialias: false, depth: false, alpha: false, preserveDrawingBuffer: true }); } catch (_) { gl = null; }
    if (!gl) return null;
    const sh = (type, src) => {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('shader');
      return s;
    };
    const pr = gl.createProgram();
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error('link');
    gl.useProgram(pr);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(pr, 'p');
    gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
    [[gl.TEXTURE_MIN_FILTER, gl.NEAREST], [gl.TEXTURE_MAG_FILTER, gl.NEAREST], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]
      .forEach(([k, v]) => gl.texParameteri(gl.TEXTURE_2D, k, v));
    gl.uniform1i(gl.getUniformLocation(pr, 't'), 0);
    const U = n => gl.getUniformLocation(pr, n);
    const uRes = U('res'), uTs = U('ts'), uYaw = U('yaw'), uF = U('f');
    let tw = 0, th = 0;
    return {
      kind: 'webgl',
      setImage: img => {
        if (Math.max(img.naturalWidth, img.naturalHeight) > gl.getParameter(gl.MAX_TEXTURE_SIZE)) throw new Error('size');
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
        if (gl.getError() !== gl.NO_ERROR) throw new Error('texture');
        tw = img.naturalWidth; th = img.naturalHeight;
      },
      draw: (yaw, fov) => {
        const W = cv.width, H = cv.height;
        gl.viewport(0, 0, W, H);
        gl.uniform2f(uRes, W, H); gl.uniform2f(uTs, tw, th); gl.uniform1f(uYaw, yaw);
        gl.uniform1f(uF, (W / 2) / Math.tan(fov / 2));
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        if (gl.isContextLost() || gl.getError() !== gl.NO_ERROR) throw new Error('draw');
      },
    };
  };

  // 2D canvas: the same camera, bilinear, at most 900 px across so a drag stays smooth
  const cvView = cv => {
    const ctx = cv.getContext && cv.getContext('2d');
    if (!ctx) return null;
    let src = null, SW = 0, SH = 0, W = 0, H = 0, F = 0, out = null, colU = null, base = null, wy = null, cx0 = null, cx1 = null, cfx = null;
    const setup = fov => {
      W = cv.width; H = cv.height; F = fov;
      out = ctx.createImageData(W, H);
      for (let k = 3; k < out.data.length; k += 4) out.data[k] = 255;
      const f = (W / 2) / Math.tan(fov / 2);
      colU = new Float32Array(W); cx0 = new Int32Array(W); cx1 = new Int32Array(W); cfx = new Float32Array(W);
      const colS = new Float32Array(W);
      for (let i = 0; i < W; i++) {
        const X = (i + 0.5 - W / 2) / f;
        colU[i] = (Math.atan(X) / (2 * Math.PI)) * SW;
        colS[i] = Math.sqrt(1 + X * X);
      }
      base = new Int32Array(W * H); wy = new Float32Array(W * H);
      for (let j = 0; j < H; j++) {
        const Y = (j + 0.5 - H / 2) / f;
        for (let i = 0; i < W; i++) {
          const v = (0.5 + Math.atan(Y / colS[i]) / Math.PI) * SH - 0.5;
          let y0 = Math.floor(v), fy = v - y0;
          if (y0 < 0) { y0 = 0; fy = 0; } else if (y0 > SH - 2) { y0 = SH - 2; fy = 1; }
          base[j * W + i] = y0 * SW * 4; wy[j * W + i] = fy;
        }
      }
    };
    return {
      kind: '2d', maxW: 900,
      setImage: img => {
        const t = document.createElement('canvas');
        SW = img.naturalWidth; SH = img.naturalHeight; t.width = SW; t.height = SH;
        t.getContext('2d').drawImage(img, 0, 0, SW, SH);
        src = t.getContext('2d').getImageData(0, 0, SW, SH).data;
        W = 0;
      },
      draw: (yaw, fov) => {
        if (!src) return;
        if (W !== cv.width || H !== cv.height || F !== fov) setup(fov);
        const s = src, d = out.data, row = SW * 4;
        const u0 = (yaw / (2 * Math.PI) + 0.5) * SW - 0.5;
        for (let i = 0; i < W; i++) {
          const u = u0 + colU[i];
          let x0 = Math.floor(u);
          cfx[i] = u - x0;
          x0 = ((x0 % SW) + SW) % SW;
          cx0[i] = x0 * 4; cx1[i] = (x0 + 1 === SW ? 0 : x0 + 1) * 4;
        }
        let k = 0, p = 0;
        for (let j = 0; j < H; j++) {
          for (let i = 0; i < W; i++, k++, p += 4) {
            const b0 = base[k], fy = wy[k], fx = cfx[i];
            const a = b0 + cx0[i], b = b0 + cx1[i], c = a + row, e = b + row;
            const w00 = (1 - fx) * (1 - fy), w01 = fx * (1 - fy), w10 = (1 - fx) * fy, w11 = fx * fy;
            d[p] = s[a] * w00 + s[b] * w01 + s[c] * w10 + s[e] * w11;
            d[p + 1] = s[a + 1] * w00 + s[b + 1] * w01 + s[c + 1] * w10 + s[e + 1] * w11;
            d[p + 2] = s[a + 2] * w00 + s[b + 2] * w01 + s[c + 2] * w10 + s[e + 2] * w11;
          }
        }
        ctx.putImageData(out, 0, 0);
      },
    };
  };

  const initPano = pano => {
    let cvEl = $('.pano-cv', pano);
    const views = $$('.pano-view', pano);
    if (!cvEl || !views.length) return;
    const tour = pano.closest('.tour');
    const roomBtns = tour ? $$('.room', tour) : [];
    const rooms = views.map(v => ({ url: v.dataset.eq, js: v.dataset.eqjs, key: v.dataset.eqkey, name: v.dataset.name || 'The room',
      yaw: ((parseFloat(v.dataset.yaw) || 0.5) - 0.5) * 2 * Math.PI, clean: null, tried: new Set(), fed: false, busy: false }));
    let cur = 0, eng = null, ei = -1, dead = false, queued = 0, near = !hasIO;
    const label = () => pano.setAttribute('aria-label', rooms[cur].name +
      (dead ? '.' : ' in 360. Drag, or use the left and right arrow keys, to look around.'));
    const still = () => { dead = true; eng = null; pano.classList.remove('cv'); pano.classList.add('still'); pano.dataset.view = 'still'; label(); };
    const nextEngine = () => {                       // WebGL, then a 2D canvas; none left means the still
      eng = null;
      rooms.forEach(r => { r.fed = false; });
      while (!eng && ++ei < 2) {
        if (ei === 1 && cvEl.dataset.gl) {           // a canvas that held a WebGL context cannot give a 2D one
          const n = cvEl.cloneNode(false); delete n.dataset.gl; cvEl.replaceWith(n); cvEl = n;
        }
        try { eng = (ei === 0 ? glView : cvView)(cvEl); } catch (_) { eng = null; }
        if (ei === 0) cvEl.dataset.gl = '1';
      }
      if (eng && eng.kind === 'webgl') cvEl.addEventListener('webglcontextlost', e => { e.preventDefault(); fail(); }, { once: true });
      return !!eng;
    };
    const fit = () => {
      const w0 = pano.clientWidth, h0 = pano.clientHeight;
      if (!w0 || !h0) return false;
      let k = Math.min(window.devicePixelRatio || 1, 2);
      if (eng.maxW) k = Math.min(k, eng.maxW / w0);
      const w = Math.max(2, Math.round(w0 * k)), h = Math.max(2, Math.round(h0 * k));
      if (cvEl.width !== w || cvEl.height !== h) { cvEl.width = w; cvEl.height = h; }
      return true;
    };
    const draw = () => {
      queued = 0;
      const r = rooms[cur];
      if (dead || !eng || !r.fed || !fit()) return;
      try { eng.draw(r.yaw, fovOf(pano)); pano.classList.add('cv'); pano.dataset.view = eng.kind; } catch (_) { fail(); }
    };
    const queue = () => { if (!queued) queued = requestAnimationFrame(draw); };
    const loadImg = (url, cors) => new Promise(res => {
      const im = new Image();
      if (cors) im.crossOrigin = 'anonymous';
      im.onload = () => res(im.naturalWidth ? im : null);
      im.onerror = () => res(null);
      im.src = url;
    });
    // the Artifact ships each equirect also as a data URI inside a small script: a data URI never taints a canvas, so the
    // view works inside a sandboxed frame too
    const loadJs = r => new Promise(res => {
      const got = () => (window.__sp360 || {})[r.key];
      if (got()) { res(got()); return; }
      const sc = document.createElement('script');
      sc.src = r.js; sc.async = true;
      sc.onload = () => res(got() || null);
      sc.onerror = () => res(null);
      (document.head || document.documentElement).appendChild(sc);
    });
    const readable = im => {
      try { const t = document.createElement('canvas'); t.width = t.height = 1; const c = t.getContext('2d'); c.drawImage(im, 0, 0, 1, 1); c.getImageData(0, 0, 1, 1); return true; } catch (_) { return false; }
    };
    const getImg = async r => {                      // an image the canvas may read, or null
      if (r.clean) return r.clean;
      for (const how of (r.js ? ['js', 'url', 'cors'] : ['url', 'cors'])) {
        if (r.tried.has(how)) continue;
        r.tried.add(how);
        let im = null;
        if (how === 'js') { const d = await loadJs(r); if (d) im = await loadImg(d, false); }
        else if (r.url) im = await loadImg(r.url, how === 'cors');
        if (im && readable(im)) { r.clean = im; return im; }
      }
      return null;
    };
    const feed = r => {
      rooms.forEach(x => { x.fed = false; });       // one texture: only the room fed last is in it
      try { eng.setImage(r.clean); r.fed = true; } catch (_) { r.fed = false; }
      return r.fed;
    };
    const start = async () => {
      if (dead || !near) return;
      if (!eng && !nextEngine()) { still(); return; }
      const r = rooms[cur];
      if (!r.fed) {
        if (r.busy) return;
        r.busy = true;
        const im = await getImg(r);
        r.busy = false;
        if (dead) return;
        if (!im) { still(); return; }                                  // nothing this browser may read: keep the still
        if (!feed(r)) { fail(); return; }                              // this engine cannot take it: the next one may
        if (rooms[cur] !== r) { start(); return; }                     // the visitor switched rooms meanwhile
      }
      queue();
    };
    function fail() {
      pano.classList.remove('cv');
      if (nextEngine()) start(); else still();
    }
    const pick = i => {
      if (i === cur || !rooms[i]) return;
      cur = i;
      views.forEach((v, k) => { v.hidden = k !== i; });
      roomBtns.forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.room === i)));
      pano.classList.remove('cv');
      label();
      start();
    };
    roomBtns.forEach(b => b.addEventListener('click', () => pick(+b.dataset.room)));
    label();
    if (!near) {
      const io = new IntersectionObserver(es => {
        if (es.some(e => e.isIntersecting)) { near = true; io.disconnect(); start(); }
      }, { rootMargin: '600px 0px' });
      io.observe(pano);
    } else start();
    if ('ResizeObserver' in window) new ResizeObserver(() => { if (rooms[cur].fed) queue(); else start(); }).observe(pano);
    else window.addEventListener('resize', queue);
    // drag: the picture under the finger follows it; a vertical swipe still scrolls the page (touch-action: pan-y)
    let down = false, lastX = 0;
    const turn = rad => { rooms[cur].yaw += rad; pano.classList.add('turned'); queue(); };
    pano.addEventListener('pointerdown', e => {
      if (e.button !== 0 || dead) return;
      down = true; lastX = e.clientX;
      try { pano.setPointerCapture(e.pointerId); } catch (_) { /* older engines */ }
      pano.classList.add('grab');
      pano.focus({ preventScroll: true, focusVisible: false });
    });
    pano.addEventListener('pointermove', e => {
      if (!down) return;
      const f = ((pano.clientWidth || 1) / 2) / Math.tan(fovOf(pano) / 2);
      turn(-(e.clientX - lastX) / f);
      lastX = e.clientX;
    });
    const up = () => { down = false; pano.classList.remove('grab'); };
    pano.addEventListener('pointerup', up);
    pano.addEventListener('pointercancel', up);
    pano.addEventListener('keydown', e => {
      if (dead || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
      e.preventDefault();
      turn((e.key === 'ArrowLeft' ? -1 : 1) * 10 * Math.PI / 180);
    });
  };
  $$('.pano').forEach(initPano);

  /* ---- dialogs: gallery lightbox and the film (plays only after the click) ---- */
  let opener = null;
  const openDlg = d => {
    if (typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', '');
    root.classList.add('dlg-open');
  };
  const closeDlg = d => { if (typeof d.close === 'function') d.close(); else { d.removeAttribute('open'); d.dispatchEvent(new Event('close')); } };
  $$('dialog.lb').forEach(d => {
    d.addEventListener('close', () => {
      root.classList.remove('dlg-open');
      if (opener) { opener.focus({ preventScroll: true }); opener = null; }
    });
    d.addEventListener('click', e => {
      if (e.target === d || e.target.classList.contains('lb-stage') || e.target.closest('[data-close]')) closeDlg(d);
    });
  });

  const lb = $('#lb');
  const tiles = $$('[data-lb]');
  if (lb && tiles.length) {
    const img = $('#lb-img');
    const count = $('#lb-count');
    let idx = 0;
    const show = i => {
      idx = (i + tiles.length) % tiles.length;
      const t = tiles[idx];
      const src = $('img', t);
      img.src = t.dataset.lb;
      img.alt = src ? src.alt : '';
      count.textContent = (idx + 1) + ' / ' + tiles.length;
    };
    tiles.forEach((t, i) => t.addEventListener('click', () => { opener = t; show(i); openDlg(lb); }));
    $('#lb-prev').addEventListener('click', e => { e.stopPropagation(); show(idx - 1); });
    $('#lb-next').addEventListener('click', e => { e.stopPropagation(); show(idx + 1); });
    lb.addEventListener('keydown', e => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); show(idx - 1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); show(idx + 1); }
    });
  }

  const filmDlg = $('#film-dlg');
  const filmV = $('#film-v');
  if (filmDlg && filmV) {
    $$('[data-film]').forEach(b => b.addEventListener('click', () => {
      opener = b;
      load(filmV);
      openDlg(filmDlg);
      filmV.play().catch(() => {});
    }));
    filmDlg.addEventListener('close', () => filmV.pause());
  }

  /* ---- 02 Concepts (r6): one option at a time; the A B C D chips switch the picture (a click, no motion) ---- */
  const cx = $('#cx');
  if (cx) {
    const chips = $$('.cx-chip', cx);
    const opts = $$('.cx-opt', cx);
    chips.forEach(c => c.addEventListener('click', () => {
      const o = c.dataset.opt;
      opts.forEach(x => { x.hidden = x.dataset.opt !== o; const im = $('img', x); if (im && x.dataset.opt === o) im.loading = 'eager'; });
      chips.forEach(x => x.setAttribute('aria-pressed', String(x === c)));
    }));
  }

  /* ---- old anchors (r6 renamed the sections): #how, #platform, #work and #for-developers still land ---- */
  const ALIAS = { '#how': '#how-it-works', '#platform': '#what-you-get', '#work': '#sample', '#top': '#hero', '#for-developers': '#for-owners' };
  if (ALIAS[location.hash] && document.querySelector(ALIAS[location.hash])) {
    try { history.replaceState(null, '', location.href.split('#')[0] + ALIAS[location.hash]); } catch (_) { /* sandboxed frames */ }
    const el = document.querySelector(location.hash);
    if (el) requestAnimationFrame(() => { try { el.scrollIntoView({ block: 'start', behavior: 'instant' }); } catch (_) { el.scrollIntoView(true); } });
  }

  /* ---- who it's for: segmented tabs (arrow keys, Home, End), deep-linkable as #for-architects ... #for-builders ---- */
  const tabs = $$('.seg [role="tab"]');
  const pick = (t, focus) => {
    tabs.forEach(x => {
      const on = x === t;
      x.setAttribute('aria-selected', String(on));
      x.tabIndex = on ? 0 : -1;
      const p = document.getElementById(x.getAttribute('aria-controls'));
      if (p) p.hidden = !on;
    });
    if (focus) t.focus();
  };
  const fromHash = () => {
    const t = tabs.find(x => '#' + x.id === location.hash);
    if (t) pick(t, false);
  };
  const deepLink = t => { try { history.replaceState(null, '', location.href.split('#')[0] + '#' + t.id); } catch (_) { /* sandboxed frames */ } };
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => { pick(t, false); deepLink(t); });
    t.addEventListener('keydown', e => {
      let j = null;
      if (e.key === 'ArrowRight') j = (i + 1) % tabs.length;
      else if (e.key === 'ArrowLeft') j = (i - 1 + tabs.length) % tabs.length;
      else if (e.key === 'Home') j = 0;
      else if (e.key === 'End') j = tabs.length - 1;
      if (j !== null) { e.preventDefault(); pick(tabs[j], true); deepLink(tabs[j]); }
    });
  });
  fromHash();
  window.addEventListener('hashchange', fromHash);
  // a deep link opened cold: the web fonts can land after the browser has scrolled to the tab and push it under the sticky
  // nav, so once they are in (and only while the visitor has not scrolled) the tab is put back in place, at once
  const linked = tabs.find(x => '#' + x.id === location.hash);
  if (linked) {
    let moved = false;
    ['wheel', 'touchstart', 'keydown', 'pointerdown'].forEach(t => window.addEventListener(t, () => { moved = true; }, { once: true, passive: true }));
    const settle = () => {
      if (moved) return;
      try { linked.scrollIntoView({ block: 'start', behavior: 'instant' }); } catch (_) { linked.scrollIntoView(true); }
    };
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => requestAnimationFrame(settle));
    window.addEventListener('load', () => requestAnimationFrame(settle), { once: true });
  }

  /* ---- how it works (phones): the carousel's dots follow the card in view; a dot brings its card in ---- */
  const steps = $('#steps');
  const dots = $$('#dots .dot');
  if (steps && dots.length) {
    const cards = $$('.step', steps);
    const setDot = id => dots.forEach(d => { if (d.dataset.step === id) d.setAttribute('aria-current', 'true'); else d.removeAttribute('aria-current'); });
    if (hasIO) {
      const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) setDot(e.target.id); }), { root: steps, threshold: 0.6 });
      cards.forEach(c => io.observe(c));
    }
    dots.forEach(d => d.addEventListener('click', () => {
      const c = document.getElementById(d.dataset.step);
      if (!c) return;
      const pad = parseFloat(getComputedStyle(steps).scrollPaddingLeft) || 0;
      const left = steps.scrollLeft + c.getBoundingClientRect().left - steps.getBoundingClientRect().left - pad;
      steps.scrollTo({ left, behavior: RM() ? 'auto' : 'smooth' });
      setDot(c.id);
    }));
  }

  /* ---- the pilot form (r6, ROUND6 Part B 7, rulings 1 and 5): exactly four required fields (name, email, I am, at least
     one interest), the uploads shown only for their services, prefill from the query string or the hash
     (?role=gc&service=bidding&upload=bid, or #pilot?service=vr), a honeypot, the consent line and the error state. It posts
     only when the build gave it an endpoint (dist with pilotFormEndpoint set); the Artifact never posts. On success the
     visitor goes to thank-you.html. ---- */
  const pilot = $('#pilot');
  const form = $('#pilot-form');
  let schema = null;
  try { schema = JSON.parse(($('#pilot-schema') || {}).textContent || 'null'); } catch (_) { schema = null; }
  const ups = form ? $$('.upl', form) : [];
  const interestBoxes = form ? $$('input[name="interests"]', form) : [];
  const ticked = () => interestBoxes.filter(b => b.checked).map(b => b.value);
  const showUploads = () => {
    const t = ticked();
    ups.forEach(u => {
      const on = (u.dataset.when || '').split(' ').some(w => t.includes(w));
      u.classList.toggle('on', on);
      const inp = $('input[type="file"]', u);
      if (inp) inp.disabled = !on;
    });
  };
  const norm = (v, aliases) => { v = String(v || '').trim().toLowerCase(); return (aliases && aliases[v]) || v; };
  const applyPrefill = params => {
    if (!form || !params) return;
    const S = schema || {};
    const role = params.get('role');
    if (role) {
      const v = norm(role, S.roleAliases);
      const sel = $('#f-role');
      if (sel && [...sel.options].some(o => o.value === v)) sel.value = v;
    }
    const svc = params.getAll('service').concat(params.getAll('interest')).join(',').split(',').filter(Boolean);
    if ((params.get('upload') || '').toLowerCase() === 'bid') svc.push('bidding');
    svc.forEach(s => {
      const v = norm(s, S.interestAliases);
      const b = interestBoxes.find(x => x.value === v);
      if (b) b.checked = true;
    });
    showUploads();
  };
  const paramsFrom = str => { try { return new URLSearchParams(String(str || '').replace(/&amp;/g, '&')); } catch (_) { return null; } };
  const ring = el => { const d = el && el.closest('.upl') && $('.drop', el.closest('.upl')); if (d && !d.hidden) d.classList.add('ring'); };
  const goPilot = (params, pick) => {
    if (!pilot) return false;
    applyPrefill(params);
    const inp = pick && $('#f-' + pick);
    // with a file to pick, the page lands on that upload (in the middle of the screen), so the chosen file shows in its
    // chip the moment the picker closes; otherwise on the top of the form
    const target = (inp && !inp.disabled && inp.closest('.upl')) || pilot;
    try { target.scrollIntoView({ behavior: 'instant', block: target === pilot ? 'start' : 'center' }); } catch (_) { target.scrollIntoView(true); }
    if (inp && !inp.disabled) {
      ring(inp);
      try { inp.focus({ preventScroll: true, focusVisible: true }); } catch (_) { inp.focus(); }
      try { inp.click(); } catch (_) { /* no picker here: the form is on screen, focused at the file field */ }
    } else {
      const f = $('#f-name');
      if (f && !f.value) { try { f.focus({ preventScroll: true }); } catch (_) { f.focus(); } }
    }
    return true;
  };
  // every link to the form that carries a prefill (data-prefill="service=vr", or href="#pilot?role=gc") fills it and jumps
  // at once; the hero button and the phone bar also open the file picker in the same click, so a chosen file is already in
  // the form when the picker closes (r5-publish, items 1, 15)
  document.addEventListener('click', e => {
    const a = e.target.closest && e.target.closest('a[href]');
    if (!a || !pilot) return;
    const href = a.getAttribute('href') || '';
    if (!(href === '#pilot' || href.startsWith('#pilot?'))) return;
    if (!a.dataset.prefill && !a.dataset.pick && href === '#pilot') return;     // a plain link: the browser jumps
    e.preventDefault();
    const q = a.dataset.prefill || (href.split('?')[1] || '');
    goPilot(paramsFrom(q), a.dataset.pick);
  });
  if (form) {
    showUploads();
    interestBoxes.forEach(b => b.addEventListener('change', showUploads));
    // arriving with ?role=...&service=... (an ad or a link from another page) or #pilot?service=...
    const qs = paramsFrom(location.search);
    const hp = location.hash.startsWith('#pilot?') ? paramsFrom(location.hash.split('?')[1]) : null;
    if (qs && [...qs.keys()].length) applyPrefill(qs);
    if (hp) {
      applyPrefill(hp);
      requestAnimationFrame(() => { try { pilot.scrollIntoView({ behavior: 'instant', block: 'start' }); } catch (_) { pilot.scrollIntoView(true); } });
    }
    window.addEventListener('hashchange', () => { if (location.hash.startsWith('#pilot?')) goPilot(paramsFrom(location.hash.split('?')[1])); });
    document.addEventListener('focusin', e => { if (!e.target.matches || !e.target.matches('.file-in')) $$('.drop.ring', form).forEach(d => d.classList.remove('ring')); });
    document.addEventListener('pointerdown', e => { if (!e.target.closest('[data-pick]')) $$('.drop.ring', form).forEach(d => d.classList.remove('ring')); });
  }

  /* ---- phones: the sticky CTA bar (by audience: home 'Upload a sketch or plan', builders 'Join the contractor pilot')
     shows whenever the hero button is not on screen, and hides while #hero-cta, the pilot form or the footer is on screen
     (and below them). An instant state change, never an animation. ---- */
  const bar = $('#cta-bar');
  const heroCta = $('#hero-cta');
  const foot = $('.site-foot');
  if (bar && heroCta && pilot && hasIO) {
    let ctaOn = true, reached = false, footOn = false;
    const upd = () => { bar.hidden = ctaOn || reached || footOn; };
    const onOrAbove = e => e.isIntersecting || e.boundingClientRect.top < 0;
    new IntersectionObserver(([e]) => { ctaOn = e.isIntersecting; upd(); }).observe(heroCta);
    new IntersectionObserver(([e]) => { reached = onOrAbove(e); upd(); }).observe(pilot);
    if (foot) new IntersectionObserver(([e]) => { footOn = onOrAbove(e); upd(); }).observe(foot);
  }

  if (form) {
    const S = schema || { maxFileMB: 25, uploads: {}, honeypot: 'company_website' };
    const MAXB = (S.maxFileMB || 25) * 1048576;
    const send = $('#pilot-send');
    const sendErr = $('#e-send');
    const endpoint = form.dataset.endpoint || '';
    const size = n => (n < 1048576 ? Math.max(1, Math.round(n / 1024)) + ' KB' : (n / 1048576).toFixed(1) + ' MB');
    const extOf = n => { const m = /\.[A-Za-z0-9]+$/.exec(n || ''); return m ? m[0].toLowerCase() : ''; };
    // each upload: a quiet drop zone, then a chip with the file's name (and a thumbnail for an image)
    const fileErr = ups.map(u => {
      const inp = $('input[type="file"]', u), drop = $('.drop', u), chip = $('.file-chip', u);
      const nm = $('.file-name', u), thumb = $('.file-thumb', u), err = $('.err', u);
      const rule = (S.uploads || {})[inp.name] || {};
      let url = null;
      const problem = f => {
        if (!f) return '';
        if (f.size > MAXB) return 'That file is over ' + (S.maxFileMB || 25) + ' MB. Please choose a smaller one.';
        if (rule.ext && rule.ext.length && !rule.ext.includes(extOf(f.name))) return rule.typeError || 'Please choose another file.';
        return '';
      };
      const show = f => {
        if (url) { URL.revokeObjectURL(url); url = null; }
        const p = problem(f);
        err.textContent = p; err.hidden = !p;
        if (p) inp.setAttribute('aria-invalid', 'true'); else inp.removeAttribute('aria-invalid');
        if (!f) { chip.hidden = true; drop.hidden = false; thumb.hidden = true; thumb.removeAttribute('src'); return; }
        nm.textContent = f.name + ' · ' + size(f.size);
        if (/^image\//.test(f.type)) { url = URL.createObjectURL(f); thumb.src = url; thumb.hidden = false; } else { thumb.hidden = true; }
        chip.hidden = false; drop.hidden = true;
      };
      inp.addEventListener('change', () => { drop.classList.remove('ring'); show(inp.files && inp.files[0]); });
      ['dragenter', 'dragover'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.add('over'); }));
      ['dragleave', 'drop'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.remove('over'); }));
      drop.addEventListener('drop', e => {
        const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
        if (!f) return;
        try { const dt = new DataTransfer(); dt.items.add(f); inp.files = dt.files; } catch (_) { /* keep the preview only */ }
        show(f);
      });
      $('.file-x', u).addEventListener('click', () => { inp.value = ''; show(null); inp.focus(); });
      return { u, inp, bad: () => !!problem(inp.files && inp.files[0]) && u.classList.contains('on') };
    });

    // the four required fields
    const fs = $('#f-interests');
    const checks = [
      { el: $('#f-name'), err: $('#e-name'), ok: el => el.value.trim().length > 0 },
      { el: $('#f-email'), err: $('#e-email'), ok: el => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(el.value.trim()) },
      { el: $('#f-role'), err: $('#e-role'), ok: el => !!el.value },
      { el: fs, err: $('#e-interests'), ok: () => ticked().length > 0, focus: () => interestBoxes[0] },
    ].filter(c => c.el && c.err);
    const check = c => {
      const good = c.ok(c.el);
      c.err.hidden = good;
      if (good) c.el.removeAttribute('aria-invalid'); else c.el.setAttribute('aria-invalid', 'true');
      return good;
    };
    checks.forEach(c => {
      const ev = c.el === fs ? 'change' : (c.el.tagName === 'SELECT' ? 'change' : 'blur');
      c.el.addEventListener(ev, () => { if (c.el.getAttribute('aria-invalid')) check(c); });
    });
    // 'Next: we reply to <the email typed> within ...' (only when a reply time is set in the config)
    const echo = $('.echo-email', form);
    const em = $('#f-email');
    if (echo && em) {
      const def = echo.textContent;
      const upd = () => { const v = em.value.trim(); echo.textContent = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? v : def; };
      em.addEventListener('input', upd);
    }
    const busy = on => {
      send.disabled = on;
      if (on) send.setAttribute('aria-busy', 'true'); else send.removeAttribute('aria-busy');
    };
    form.addEventListener('submit', e => {
      e.preventDefault();
      if (!endpoint || send.disabled) return;
      sendErr.hidden = true;
      const bad = checks.filter(c => !check(c));
      const badFile = fileErr.find(f => f.bad());
      if (bad.length || badFile) {
        const first = bad.length ? (bad[0].focus ? bad[0].focus() : bad[0].el) : badFile.inp;
        try { first.focus(); } catch (_) { /* nothing to focus */ }
        return;
      }
      const data = new FormData(form);
      const trap = String(data.get(S.honeypot || 'company_website') || '').trim();
      if (trap) { location.href = 'thank-you.html'; return; }     // a bot filled the hidden field: send nothing
      ups.forEach(u => { if (!u.classList.contains('on')) { const i = $('input[type="file"]', u); if (i) data.delete(i.name); } });
      busy(true);
      fetch(endpoint, { method: 'POST', body: data, headers: { Accept: 'application/json' }, credentials: 'omit' })
        .then(r => { if (!r.ok) throw new Error(String(r.status)); location.href = 'thank-you.html'; })
        .catch(() => { busy(false); sendErr.hidden = false; });
    });
    if (/[?&]error=1/.test(location.search) && sendErr) sendErr.hidden = false;     // a plain (no-JS) post that failed
  }
})();
