/* 萌系贴贴 —— 小红书小工具
 * 基线：ES2017 / Chrome 61；纯离线；脚本外置经典脚本。
 */
(function () {
  'use strict';

  var EXPORT_SIZE = 1180;

  /* ================= 小工具 ================= */
  function $(id) { return document.getElementById(id); }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  var toastTimer = null;
  function toast(msg) {
    var t = $('toast');
    t.textContent = msg;
    t.className = 'show';
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.className = ''; }, 1800);
  }

  function safeGet(key) {
    try { return window.localStorage.getItem(key); } catch (e) { return null; }
  }
  function safeSet(key, val) {
    try { window.localStorage.setItem(key, val); return true; } catch (e) { return false; }
  }

  function getMiniTool() {
    return (typeof window.xhs !== 'undefined') && window.xhs && window.xhs.miniTool;
  }

  /* ================= 程序化底纹 ================= */
  function drawDots(ctx, s, bgColor, dotColor, cols, altOffset) {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = dotColor;
    var step = s / cols;
    var r = step * 0.16;
    for (var row = 0; row < cols + 2; row++) {
      var off = (altOffset && row % 2 === 1) ? step / 2 : 0;
      for (var col = -1; col < cols + 1; col++) {
        var cx = col * step + off + step / 2;
        var cy = row * step - step / 2;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawStarShape(ctx, cx, cy, outer, inner, points) {
    ctx.beginPath();
    for (var i = 0; i < points * 2; i++) {
      var ang = (Math.PI / points) * i - Math.PI / 2;
      var rad = (i % 2 === 0) ? outer : inner;
      var x = cx + Math.cos(ang) * rad;
      var y = cy + Math.sin(ang) * rad;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  }

  var MULTI = ['#ff9ecb', '#9adcf0', '#ffe36e', '#b8e986', '#f8f4ff'];

  function drawMultiDots(ctx, s, bgColor, cols) {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, s, s);
    var step = s / cols;
    var r = step * 0.12;
    var idx = 0;
    for (var row = 0; row < cols + 2; row++) {
      var off = (row % 2 === 1) ? step / 2 : 0;
      for (var col = -1; col < cols + 1; col++) {
        ctx.fillStyle = MULTI[idx % MULTI.length];
        idx++;
        ctx.beginPath();
        ctx.arc(col * step + off + step / 2, row * step - step / 2, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  var PROC_BGS = [
    { id: 'dots-blue',   name: '波点·蓝',   draw: function (c, s) { drawDots(c, s, '#47b1f0', '#ffffff', 7, true); } },
    { id: 'dots-pink',   name: '波点·粉',   draw: function (c, s) { drawDots(c, s, '#ffb6d5', '#ffffff', 8, true); } },
    { id: 'dots-rose',   name: '波点·玫红', draw: function (c, s) { drawDots(c, s, '#f062a8', '#ffffff', 8, true); } },
    { id: 'dots-mint',   name: '波点·薄荷', draw: function (c, s) { drawDots(c, s, '#7fe3c3', '#ffffff', 8, true); } },
    { id: 'dots-lemon',  name: '波点·柠檬', draw: function (c, s) { drawDots(c, s, '#f5e63d', '#ffffff', 8, true); } },
    { id: 'dots-orange', name: '波点·橘',   draw: function (c, s) { drawDots(c, s, '#ff9a3d', '#ffffff', 8, true); } },
    { id: 'dots-cocoa',  name: '彩点·可可', draw: function (c, s) { drawMultiDots(c, s, '#6b4a2f', 9); } }
  ];

  function findProcBg(id) {
    for (var i = 0; i < PROC_BGS.length; i++) {
      if (PROC_BGS[i].id === id) return PROC_BGS[i];
    }
    return PROC_BGS[0];
  }

  /* ================= 颜文字表情（兜底素材） ================= */
  var FACES = ['·ω·', '>ω<', '·x·', '-ω-', '·◡·', '·▽·', '⊙ω⊙', 'ˊωˋ', 'ω', '✧ω✧'];

  /* ================= 预置图片素材（assets.js 清单） ================= */
  var fileStickers = [];   // [{src, img}]
  var fileBgs = [];        // [{src, img}]
  var fileObjects = [];    // [{src, img}] 主体抠图

  function loadManifest() {
    var assets = window.MTG_ASSETS || {};
    var stks = assets.stickers || [];
    var bgs = assets.backgrounds || [];
    var objs = assets.objects || [];
    stks.forEach(function (src) { preloadImage(src, fileStickers, refreshRows); });
    bgs.forEach(function (src) { preloadImage(src, fileBgs, refreshRows); });
    objs.forEach(function (src) { preloadImage(src, fileObjects, refreshRows); });
  }

  function preloadImage(src, list, onDone) {
    var img = new Image();
    img.onload = function () { list.push({ src: src, img: img }); onDone(); };
    img.onerror = function () { /* 清单与包内文件不一致时跳过 */ };
    img.src = src;
  }

  /* ================= 用户自定义素材 ================= */
  var CUSTOM_STK_KEY = 'cfg.customStickers';
  var CUSTOM_BG_KEY = 'cfg.customBgs';
  var PREFS_KEY = 'cfg.prefs';
  var customStickers = [];  // [{src, img}]
  var customBgs = [];       // [{src, img}]

  function loadCustomAssets() {
    ['customStickers', 'customBgs'].forEach(function (name) {
      var raw = safeGet(name === 'customStickers' ? CUSTOM_STK_KEY : CUSTOM_BG_KEY);
      if (!raw) return;
      var arr = null;
      try { arr = JSON.parse(raw); } catch (e) { arr = null; }
      if (!arr || !arr.length) return;
      var list = (name === 'customStickers') ? customStickers : customBgs;
      arr.forEach(function (src) { preloadImage(src, list, refreshRows); });
    });
  }

  function persistCustom(key, list) {
    var srcs = list.map(function (it) { return it.src; });
    if (!safeSet(key, JSON.stringify(srcs))) {
      toast('本地空间不足，自定义素材仅本次有效');
    }
  }

  /* ================= 状态 ================= */
  var state = {
    photo: null,            // Image
    photoStyle: 'circle',   // fill | card | circle
    bgId: 'dots-blue',      // proc id / 'file:n' / 'custom:n'
    stickers: [],           // {kind:'face'|'img'|'spark', ...}
    selIndex: -1,
    brush: false,
    zoom: 1
  };
  var prefs = { size: 100 };
  var undoStack = [];

  function stickerBaseSize(st) {
    if (st.kind === 'spark') return EXPORT_SIZE * 0.09;
    if (st.kind === 'face') return EXPORT_SIZE * 0.30;
    return EXPORT_SIZE * 0.34;
  }

  function pushUndo() {
    var snap = state.stickers.map(function (st) {
      var copy = {};
      for (var k in st) { if (Object.prototype.hasOwnProperty.call(st, k)) copy[k] = st[k]; }
      return copy;
    });
    undoStack.push({ stickers: snap, bgId: state.bgId, photoStyle: state.photoStyle });
    if (undoStack.length > 30) undoStack.shift();
  }

  function doUndo() {
    var snap = undoStack.pop();
    if (!snap) { toast('没有可撤销的操作'); return; }
    state.stickers = snap.stickers;
    state.bgId = snap.bgId;
    state.photoStyle = snap.photoStyle;
    state.selIndex = -1;
    render();
    refreshRows();
    updateCount();
  }

  /* ================= 画布尺寸与渲染 ================= */
  var view = $('view');
  var vctx = view.getContext('2d');
  var dpr = Math.min(window.devicePixelRatio || 1, 2);

  function fitCanvas() {
    var stage = $('stage');
    var w = stage.clientWidth - 8;
    var h = stage.clientHeight - 8;
    var size = Math.max(160, Math.min(w, h));
    view.style.width = size + 'px';
    view.style.height = size + 'px';
    view.width = Math.round(size * dpr);
    view.height = Math.round(size * dpr);
    render();
  }

  function resolveBg() {
    if (state.bgId.indexOf('custom:') === 0) {
      var ci = parseInt(state.bgId.slice(7), 10);
      if (customBgs[ci]) return { type: 'img', img: customBgs[ci].img };
    } else if (state.bgId.indexOf('file:') === 0) {
      var fi = parseInt(state.bgId.slice(5), 10);
      if (fileBgs[fi]) return { type: 'img', img: fileBgs[fi].img };
    }
    return { type: 'proc', def: findProcBg(state.bgId) };
  }

  function drawBg(ctx, s) {
    var bg = resolveBg();
    if (bg.type === 'proc') {
      bg.def.draw(ctx, s);
      return;
    }
    drawCover(ctx, bg.img, s, 0, 0, s, s);
  }

  function drawCover(ctx, img, s, dx, dy, dw, dh) {
    var iw = img.width, ih = img.height;
    var scale = Math.max(dw / iw, dh / ih);
    var w = iw * scale, h = ih * scale;
    ctx.drawImage(img, dx + (dw - w) / 2, dy + (dh - h) / 2, w, h);
  }

  function roundedRectPath(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }

  function drawPhoto(ctx, s) {
    if (!state.photo) return;
    if (state.photoStyle === 'raw') {
      // 原样：透明抠图按原轮廓展示，带白色柔光（最接近示例效果）
      var img = state.photo;
      var target = s * 0.84;
      var sc = Math.min(target / img.width, target / img.height);
      var w = img.width * sc, h = img.height * sc;
      ctx.save();
      ctx.shadowColor = 'rgba(255,255,255,0.95)';
      ctx.shadowBlur = s * 0.05;
      ctx.drawImage(img, (s - w) / 2, (s - h) / 2, w, h);
      ctx.restore();
      return;
    }
    if (state.photoStyle === 'fill') {
      drawCover(ctx, state.photo, s, 0, 0, s, s);
      return;
    }
    if (state.photoStyle === 'card') {
      var m = s * 0.07;
      var w = s - m * 2;
      var r = s * 0.05;
      ctx.save();
      ctx.shadowColor = 'rgba(255,255,255,0.95)';
      ctx.shadowBlur = s * 0.045;
      roundedRectPath(ctx, m, m, w, w, r);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.restore();
      ctx.save();
      roundedRectPath(ctx, m, m, w, w, r);
      ctx.clip();
      drawCover(ctx, state.photo, s, m, m, w, w);
      ctx.restore();
      ctx.save();
      roundedRectPath(ctx, m, m, w, w, r);
      ctx.lineWidth = s * 0.028;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
      ctx.restore();
      return;
    }
    // circle：圆形白边贴纸（默认，最接近示例效果）
    var d = s * 0.78;
    var cx = s / 2, cy = s / 2;
    ctx.save();
    ctx.shadowColor = 'rgba(255,255,255,0.95)';
    ctx.shadowBlur = s * 0.05;
    ctx.beginPath();
    ctx.arc(cx, cy, d / 2 + s * 0.012, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, d / 2, 0, Math.PI * 2);
    ctx.clip();
    drawCover(ctx, state.photo, s, cx - d / 2, cy - d / 2, d, d);
    ctx.restore();
    ctx.beginPath();
    ctx.arc(cx, cy, d / 2, 0, Math.PI * 2);
    ctx.lineWidth = s * 0.03;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
  }

  function drawSticker(ctx, st, s) {
    var size = stickerBaseSize(st) * st.scale;
    var x = st.x * s, y = st.y * s;
    if (st.kind === 'face') {
      ctx.save();
      ctx.font = '700 ' + Math.round(size * 0.62) + 'px "PingFang SC","Microsoft YaHei",sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#111111';
      ctx.fillText(st.text, x, y);
      ctx.restore();
    } else if (st.kind === 'img') {
      ctx.drawImage(st.img, x - size / 2, y - size / 2, size, size);
    } else { // spark
      var colors = ['#ffffff', '#ffe36e', '#ffd0e4'];
      ctx.save();
      ctx.fillStyle = colors[st.seed % colors.length];
      drawStarShape(ctx, x, y, size / 2, size * 0.2, 4 + (st.seed % 2));
      ctx.restore();
    }
  }

  function stickerBBox(st, s) {
    var half = stickerBaseSize(st) * st.scale * 0.62;
    if (st.kind === 'face') half = stickerBaseSize(st) * st.scale * 0.75;
    return {
      x1: st.x * s - half, y1: st.y * s - half,
      x2: st.x * s + half, y2: st.y * s + half
    };
  }

  var renderPending = false;
  function render() {
    if (renderPending) return;
    renderPending = true;
    window.requestAnimationFrame(function () {
      renderPending = false;
      var s = EXPORT_SIZE;
      var k = view.width / s;
      vctx.setTransform(k, 0, 0, k, 0, 0);
      drawBg(vctx, s);
      drawPhoto(vctx, s);
      for (var i = 0; i < state.stickers.length; i++) {
        drawSticker(vctx, state.stickers[i], s);
      }
      if (state.selIndex >= 0 && state.stickers[state.selIndex]) {
        var b = stickerBBox(state.stickers[state.selIndex], s);
        vctx.save();
        vctx.strokeStyle = '#ff5fa8';
        vctx.lineWidth = 4;
        vctx.setLineDash([14, 10]);
        vctx.strokeRect(b.x1 - 10, b.y1 - 10, b.x2 - b.x1 + 20, b.y2 - b.y1 + 20);
        vctx.restore();
      }
      if (!state.photo) {
        vctx.save();
        vctx.font = '600 44px "PingFang SC","Microsoft YaHei",sans-serif';
        vctx.textAlign = 'center';
        vctx.textBaseline = 'middle';
        vctx.shadowColor = 'rgba(0,0,0,0.45)';
        vctx.shadowBlur = 12;
        vctx.fillStyle = 'rgba(255,255,255,0.95)';
        vctx.fillText('点下方「主体」行选个食物或传照片', s / 2, s * 0.9);
        vctx.restore();
      }
    });
  }

  function updateCount() {
    $('statCount').textContent = '✨ × ' + state.stickers.length;
  }

  /* ================= 素材行渲染 ================= */
  function clearNode(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function makeTile(cls) {
    var d = document.createElement('div');
    d.className = 'mat-tile' + (cls ? ' ' + cls : '');
    return d;
  }

  function makePlusTile(text, onClick) {
    var t = makeTile();
    var sp = document.createElement('span');
    sp.className = 'plus-tile';
    sp.textContent = text || '+';
    t.appendChild(sp);
    t.addEventListener('click', onClick);
    return t;
  }

  function refreshRows() {
    renderBgRow();
    renderPhotoRow();
    renderStkRow();
  }

  function renderBgRow() {
    var row = $('bgScroll');
    clearNode(row);
    PROC_BGS.forEach(function (def, i) {
      var t = makeTile();
      var c = document.createElement('canvas');
      c.width = 60; c.height = 60;
      def.draw(c.getContext('2d'), 60);
      t.appendChild(c);
      if (state.bgId === def.id) t.className += ' sel';
      t.addEventListener('click', function () {
        pushUndo();
        state.bgId = def.id;
        persistPrefs();
        refreshRows(); render();
      });
      row.appendChild(t);
    });
    customBgs.forEach(function (it, i) {
      var t = makeTile();
      var c = document.createElement('canvas');
      c.width = 60; c.height = 60;
      drawCover(c.getContext('2d'), it.img, 60, 0, 0, 60, 60);
      t.appendChild(c);
      if (state.bgId === 'custom:' + i) t.className += ' sel';
      t.addEventListener('click', function () {
        pushUndo();
        state.bgId = 'custom:' + i;
        persistPrefs();
        refreshRows(); render();
      });
      row.appendChild(t);
    });
    fileBgs.forEach(function (it, i) {
      var t = makeTile();
      var c = document.createElement('canvas');
      c.width = 60; c.height = 60;
      drawCover(c.getContext('2d'), it.img, 60, 0, 0, 60, 60);
      t.appendChild(c);
      if (state.bgId === 'file:' + i) t.className += ' sel';
      t.addEventListener('click', function () {
        pushUndo();
        state.bgId = 'file:' + i;
        persistPrefs();
        refreshRows(); render();
      });
      row.appendChild(t);
    });
    row.appendChild(makePlusTile('+', function () { $('bgInput').click(); }));
  }

  function drawContain(cc, img, s) {
    var sc = Math.min(s / img.width, s / img.height);
    var w = img.width * sc, h = img.height * sc;
    cc.drawImage(img, (s - w) / 2, (s - h) / 2, w, h);
  }

  function renderPhotoRow() {
    var row = $('photoScroll');
    clearNode(row);
    fileObjects.forEach(function (it) {
      var t = makeTile();
      var c = document.createElement('canvas');
      c.width = 60; c.height = 60;
      drawContain(c.getContext('2d'), it.img, 60);
      t.appendChild(c);
      t.addEventListener('click', function () {
        pushUndo();
        state.photo = it.img;
        state.photoStyle = 'raw';
        persistPrefs();
        refreshRows(); render();
      });
      row.appendChild(t);
    });
    if (state.photo) {
      var t = makeTile();
      var c = document.createElement('canvas');
      c.width = 60; c.height = 60;
      var cc = c.getContext('2d');
      if (state.photoStyle === 'raw') drawContain(cc, state.photo, 60);
      else drawCover(cc, state.photo, 60, 0, 0, 60, 60);
      t.appendChild(c);
      t.addEventListener('click', function () { $('photoInput').click(); });
      row.appendChild(t);
    }
    var pick = makePlusTile('+', function () { $('photoInput').click(); });
    pick.title = '上传自己的照片';
    row.appendChild(pick);
  }

  function renderStkRow() {
    var row = $('stkScroll');
    clearNode(row);
    FACES.forEach(function (text) {
      var t = makeTile();
      var sp = document.createElement('span');
      sp.className = 'face-tile';
      sp.textContent = text;
      t.appendChild(sp);
      t.addEventListener('click', function () { addFace(text); });
      row.appendChild(t);
    });
    fileStickers.forEach(function (it) {
      var t = makeTile();
      var im = document.createElement('img');
      im.src = it.src;
      im.alt = '表情';
      t.appendChild(im);
      t.addEventListener('click', function () { addImgSticker(it.img); });
      row.appendChild(t);
    });
    customStickers.forEach(function (it) {
      var t = makeTile();
      var im = document.createElement('img');
      im.src = it.src;
      im.alt = '自定义表情';
      t.appendChild(im);
      t.addEventListener('click', function () { addImgSticker(it.img); });
      row.appendChild(t);
    });
    row.appendChild(makePlusTile('+', function () { $('stickerInput').click(); }));
  }

  function addFace(text) {
    pushUndo();
    state.stickers.push({
      kind: 'face', text: text,
      x: 0.5 + (Math.random() - 0.5) * 0.16,
      y: 0.5 + (Math.random() - 0.5) * 0.16,
      scale: prefs.size / 100
    });
    state.selIndex = state.stickers.length - 1;
    render(); updateCount();
  }

  function addImgSticker(img) {
    pushUndo();
    state.stickers.push({
      kind: 'img', img: img,
      x: 0.5 + (Math.random() - 0.5) * 0.16,
      y: 0.5 + (Math.random() - 0.5) * 0.16,
      scale: prefs.size / 100
    });
    state.selIndex = state.stickers.length - 1;
    render(); updateCount();
  }

  function addSpark(x, y) {
    state.stickers.push({
      kind: 'spark', seed: Math.floor(Math.random() * 6),
      x: x / EXPORT_SIZE, y: y / EXPORT_SIZE,
      scale: 0.7 + Math.random() * 0.9
    });
  }

  /* ================= 画布交互 ================= */
  var drag = null; // {index, moved}

  function canvasPoint(ev) {
    var rect = view.getBoundingClientRect();
    return {
      x: (ev.clientX - rect.left) / rect.width * EXPORT_SIZE,
      y: (ev.clientY - rect.top) / rect.height * EXPORT_SIZE
    };
  }

  function hitTest(pt) {
    for (var i = state.stickers.length - 1; i >= 0; i--) {
      var b = stickerBBox(state.stickers[i], EXPORT_SIZE);
      if (pt.x >= b.x1 && pt.x <= b.x2 && pt.y >= b.y1 && pt.y <= b.y2) return i;
    }
    return -1;
  }

  function pointInTrash(ev) {
    var tr = $('trash').getBoundingClientRect();
    return ev.clientX >= tr.left && ev.clientX <= tr.right &&
           ev.clientY >= tr.top && ev.clientY <= tr.bottom;
  }

  view.addEventListener('pointerdown', function (ev) {
    ev.preventDefault();
    view.setPointerCapture && view.setPointerCapture(ev.pointerId);
    var pt = canvasPoint(ev);
    if (state.brush) {
      drag = { brush: true, lastX: pt.x, lastY: pt.y };
      pushUndo();
      addSpark(pt.x, pt.y);
      render(); updateCount();
      return;
    }
    var idx = hitTest(pt);
    state.selIndex = idx;
    drag = (idx >= 0) ? { index: idx, moved: false, snap: null } : null;
    if (idx >= 0) {
      var st = state.stickers[idx];
      drag.offX = st.x - pt.x / EXPORT_SIZE;
      drag.offY = st.y - pt.y / EXPORT_SIZE;
      syncSliderToSelection();
    }
    render();
  });

  view.addEventListener('pointermove', function (ev) {
    if (!drag) return;
    ev.preventDefault();
    var pt = canvasPoint(ev);
    if (drag.brush) {
      var dx = pt.x - drag.lastX, dy = pt.y - drag.lastY;
      if (dx * dx + dy * dy > 26 * 26) {
        drag.lastX = pt.x; drag.lastY = pt.y;
        addSpark(pt.x, pt.y);
        render(); updateCount();
      }
      return;
    }
    var st = state.stickers[drag.index];
    if (!st) return;
    drag.moved = true;
    if (!drag.snap) pushUndo();
    drag.snap = true;
    st.x = clamp(pt.x / EXPORT_SIZE + drag.offX, 0.02, 0.98);
    st.y = clamp(pt.y / EXPORT_SIZE + drag.offY, 0.02, 0.98);
    $('trash').className = pointInTrash(ev) ? 'hot' : '';
    render();
  });

  function endDrag(ev) {
    if (!drag) return;
    if (drag.brush) {
      drag = null;
      return;
    }
    var st = state.stickers[drag.index];
    if (st && ev && pointInTrash(ev)) {
      state.stickers.splice(drag.index, 1);
      state.selIndex = -1;
      toast('已删除');
      render(); updateCount();
    }
    $('trash').className = '';
    drag = null;
  }
  view.addEventListener('pointerup', endDrag);
  view.addEventListener('pointercancel', function () { endDrag(null); });

  /* ================= 滑杆 / 缩放 / 工具栏 ================= */
  function syncSliderToSelection() {
    var st = state.stickers[state.selIndex];
    var v = st ? Math.round(st.scale * 100) : prefs.size;
    $('sizeSlider').value = clamp(v, 40, 220);
    $('sizeVal').textContent = v + '%';
  }

  $('sizeSlider').addEventListener('input', function () {
    var v = parseInt(this.value, 10);
    $('sizeVal').textContent = v + '%';
    var st = state.stickers[state.selIndex];
    if (st) {
      st.scale = v / 100;
      render();
    } else {
      prefs.size = v;
      persistPrefs();
    }
  });

  var ZOOMS = [1, 1.25, 1.5, 2];
  function setZoom(z) {
    state.zoom = z;
    view.style.transform = z === 1 ? 'none' : 'scale(' + z + ')';
    var label = z === 1 ? '1:1' : Math.round(z * 100) + '%';
    $('zoomLabel').textContent = label;
    $('statZoom').textContent = '缩放 ' + Math.round(z * 100) + '%';
  }
  $('zoomIn').addEventListener('click', function () {
    var next = ZOOMS[0];
    for (var i = 0; i < ZOOMS.length; i++) { if (ZOOMS[i] > state.zoom) { next = ZOOMS[i]; break; } }
    setZoom(next);
  });
  $('zoomOut').addEventListener('click', function () {
    var next = ZOOMS[0];
    for (var i = ZOOMS.length - 1; i >= 0; i--) { if (ZOOMS[i] < state.zoom) { next = ZOOMS[i]; break; } }
    setZoom(next);
  });

  $('btnBrush').addEventListener('click', function () {
    state.brush = !state.brush;
    this.className = 'tool-btn' + (state.brush ? ' on' : '');
    toast(state.brush ? '画笔已开启：在画布上拖动撒星星' : '画笔已关闭');
  });
  $('btnUndo').addEventListener('click', doUndo);
  $('btnClear').addEventListener('click', function () {
    if (!state.stickers.length) { toast('画布上还没有贴纸'); return; }
    if (window.confirm('清空全部贴纸？')) {
      pushUndo();
      state.stickers = [];
      state.selIndex = -1;
      render(); updateCount();
    }
  });
  $('btnSave').addEventListener('click', function () { saveFlow(); });
  $('btnExport').addEventListener('click', function () { saveFlow(); });

  /* ================= 菜单 ================= */
  function closeMenus() {
    var pops = document.querySelectorAll('.menu-pop');
    for (var i = 0; i < pops.length; i++) pops[i].className = 'menu-pop';
  }
  var menuBtns = document.querySelectorAll('.menu-btn');
  for (var mi = 0; mi < menuBtns.length; mi++) {
    menuBtns[mi].addEventListener('click', function () {
      var pop = this.parentNode.querySelector('.menu-pop');
      var shown = pop.className.indexOf('show') >= 0;
      closeMenus();
      if (!shown) pop.className = 'menu-pop show';
    });
  }
  document.addEventListener('pointerdown', function (ev) {
    if (!ev.target || !ev.target.closest || !ev.target.closest('.menu-item')) closeMenus();
  });

  var ACTIONS = {
    pick: function () { closeMenus(); $('photoInput').click(); },
    save: function () { closeMenus(); saveFlow(); },
    clear: function () { closeMenus(); $('btnClear').click(); },
    undo: function () { closeMenus(); doUndo(); },
    delSel: function () {
      closeMenus();
      if (state.selIndex < 0) { toast('请先点选一个表情'); return; }
      pushUndo();
      state.stickers.splice(state.selIndex, 1);
      state.selIndex = -1;
      render(); updateCount();
    },
    about: function () {
      closeMenus();
      window.alert('萌系贴贴\n\n1. 点「照片」行选一张照片（白底食物图会自动抠掉背景）\n2. 点「背景」行挑一块波点底或上传背景\n3. 点「表情」行贴上颜文字，拖动摆位置\n4. 点「保存」生成方图，可存相册或发笔记');
    }
  };
  var acts = document.querySelectorAll('.menu-act');
  for (var ai = 0; ai < acts.length; ai++) {
    acts[ai].addEventListener('click', function () {
      var fn = ACTIONS[this.getAttribute('data-act')];
      if (fn) fn();
    });
  }

  /* ================= 文件选择 ================= */
  // 读取失败时回调 cb(null)，避免调用方计数器卡死
  function fileToDataURL(file, maxSide, mime, quality, cb) {
    var reader = new FileReader();
    reader.onload = function () {
      var img = new Image();
      img.onload = function () {
        var scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        var w = Math.max(1, Math.round(img.width * scale));
        var h = Math.max(1, Math.round(img.height * scale));
        var c = document.createElement('canvas');
        c.width = w; c.height = h;
        var cc = c.getContext('2d');
        cc.drawImage(img, 0, 0, w, h);
        // 含透明像素时改用 PNG，避免 JPEG 把透明区填成纯黑
        var out = mime;
        try {
          var px = cc.getImageData(0, 0, w, h).data;
          for (var i = 3; i < px.length; i += 4) {
            if (px[i] < 255) { out = 'image/png'; break; }
          }
        } catch (e) { /* 像素读取受限时沿用原格式 */ }
        cb(c.toDataURL(out, quality));
      };
      img.onerror = function () { toast('这张图片读不出来，换一张试试'); cb(null); };
      img.src = reader.result;
    };
    reader.onerror = function () { toast('图片读取失败'); cb(null); };
    reader.readAsDataURL(file);
  }

  $('photoInput').addEventListener('change', function () {
    var file = this.files && this.files[0];
    this.value = '';
    if (!file) return;
    fileToDataURL(file, 1600, 'image/jpeg', 0.9, function (url) {
      if (!url) return;
      var img = new Image();
      img.onload = function () {
        pushUndo();
        var cut = autoCutout(img);
        state.photo = cut.img;
        state.photoStyle = cut.cut ? 'raw' : 'circle';
        refreshRows(); render();
        toast(cut.cut ? '已按轮廓抠掉浅色背景 ✂️' : '照片已就绪');
      };
      img.src = url;
    });
  });

  /* ================= 上传主体自动抠图（白/浅色底洪泛填充） ================= */
  // 从四边向内清除近白像素；返回清除数量。纯像素操作，便于单独测试。
  function floodRemove(px, w, h, tol) {
    function nearWhite(i) {
      return px[i] > 255 - tol && px[i + 1] > 255 - tol && px[i + 2] > 255 - tol;
    }
    var total = w * h;
    var visited = new Uint8Array(total);
    var queue = new Int32Array(total);
    var qh = 0, qt = 0, removed = 0, k, idx, x, y;
    function visit(i) {
      if (visited[i]) return;
      visited[i] = 1;
      if (nearWhite(i * 4)) {
        px[i * 4 + 3] = 0;
        removed++;
        queue[qt++] = i;
      }
    }
    for (k = 0; k < w; k++) { visit(k); visit((h - 1) * w + k); }
    for (k = 0; k < h; k++) { visit(k * w); visit(k * w + w - 1); }
    while (qh < qt) {
      idx = queue[qh++];
      x = idx % w;
      y = (idx / w) | 0;
      if (x > 0) visit(idx - 1);
      if (x < w - 1) visit(idx + 1);
      if (y > 0) visit(idx - w);
      if (y < h - 1) visit(idx + w);
    }
    // 边缘羽化：与透明区相邻且非常白的像素一并清除，减少白边（只走 1 轮、阈值更严）
    if (removed > 0) {
      var toClear = [], i2, x2, y2, neigh;
      for (y2 = 0; y2 < h; y2++) {
        for (x2 = 0; x2 < w; x2++) {
          i2 = y2 * w + x2;
          if (px[i2 * 4 + 3] === 0) continue;
          if (!(px[i2 * 4] > 247 && px[i2 * 4 + 1] > 247 && px[i2 * 4 + 2] > 247)) continue;
          neigh = false;
          if (x2 > 0 && px[(i2 - 1) * 4 + 3] === 0) neigh = true;
          else if (x2 < w - 1 && px[(i2 + 1) * 4 + 3] === 0) neigh = true;
          else if (y2 > 0 && px[(i2 - w) * 4 + 3] === 0) neigh = true;
          else if (y2 < h - 1 && px[(i2 + w) * 4 + 3] === 0) neigh = true;
          if (neigh) toClear.push(i2);
        }
      }
      for (k = 0; k < toClear.length; k++) px[toClear[k] * 4 + 3] = 0;
    }
    return removed;
  }

  // 自动抠图入口：背景不明显或主体大面积偏白时放弃，保留原图
  function autoCutout(img) {
    var maxSide = 1200;
    var scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    var w = Math.max(1, Math.round(img.width * scale));
    var h = Math.max(1, Math.round(img.height * scale));
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);
    var data;
    try { data = ctx.getImageData(0, 0, w, h); } catch (e) { return { img: img, cut: false }; }
    var removed = floodRemove(data.data, w, h, 12);
    var total = w * h;
    // 清除占比过小=背景不是浅色；占比过高=主体本身大面积偏白被误吃，都放弃抠图
    if (removed < total * 0.04 || removed > total * 0.9) {
      return { img: img, cut: false };
    }
    ctx.putImageData(data, 0, 0);
    return { img: c, cut: true };
  }

  $('stickerInput').addEventListener('change', function () {
    var files = this.files || [];
    this.value = '';
    var pending = files.length;
    if (!pending) return;
    var added = 0;
    // 无论成功失败都结算，防止单张失败导致整批不刷新
    function settle() {
      if (--pending === 0) {
        if (added > 0) {
          persistCustom(CUSTOM_STK_KEY, customStickers);
          refreshRows();
          toast('已添加 ' + added + ' 个表情');
        } else {
          toast('表情图片没有读取成功');
        }
      }
    }
    for (var i = 0; i < files.length; i++) {
      (function (file) {
        fileToDataURL(file, 360, 'image/png', 0.9, function (url) {
          if (!url) { settle(); return; }
          var img = new Image();
          img.onload = function () {
            if (customStickers.length >= 8) {
              customStickers.shift();
              toast('最多保留 8 个自定义表情，最早的已被替换');
            }
            customStickers.push({ src: url, img: img });
            added++;
            settle();
          };
          img.onerror = function () { settle(); };
          img.src = url;
        });
      })(files[i]);
    }
  });

  $('bgInput').addEventListener('change', function () {
    var files = this.files || [];
    this.value = '';
    var pending = files.length;
    if (!pending) return;
    var added = 0;
    // 无论成功失败都结算，防止单张失败导致整批不刷新
    function settle() {
      if (--pending === 0) {
        if (added > 0) {
          persistCustom(CUSTOM_BG_KEY, customBgs);
          persistPrefs();
          refreshRows(); render();
        } else {
          toast('背景图片没有读取成功');
        }
      }
    }
    for (var i = 0; i < files.length; i++) {
      (function (file) {
        fileToDataURL(file, 900, 'image/jpeg', 0.82, function (url) {
          if (!url) { settle(); return; }
          var img = new Image();
          img.onload = function () {
            if (customBgs.length >= 6) {
              customBgs.shift();
              toast('最多保留 6 张自定义背景，最早的已被替换');
            }
            customBgs.push({ src: url, img: img });
            state.bgId = 'custom:' + (customBgs.length - 1);
            added++;
            settle();
          };
          img.onerror = function () { settle(); };
          img.src = url;
        });
      })(files[i]);
    }
  });

  /* ================= 导出与端能力 ================= */
  function renderExport() {
    var c = document.createElement('canvas');
    c.width = EXPORT_SIZE;
    c.height = EXPORT_SIZE;
    var ctx = c.getContext('2d');
    drawBg(ctx, EXPORT_SIZE);
    drawPhoto(ctx, EXPORT_SIZE);
    for (var i = 0; i < state.stickers.length; i++) {
      drawSticker(ctx, state.stickers[i], EXPORT_SIZE);
    }
    return c.toDataURL('image/png');
  }

  var lastExport = '';

  function showSaveModal(url, msg) {
    lastExport = url;
    $('savePreview').src = url;
    $('saveMsg').textContent = msg || '';
    var mt = getMiniTool();
    $('btnSaveAlbum').style.display = mt ? '' : 'none';
    $('btnPost').style.display = mt ? '' : 'none';
    $('saveModal').className = 'show';
  }

  function hideSaveModal() { $('saveModal').className = ''; }

  $('btnCloseModal').addEventListener('click', hideSaveModal);
  $('saveModal').addEventListener('click', function (ev) {
    if (ev.target === this) hideSaveModal();
  });

  $('btnSaveAlbum').addEventListener('click', function () {
    var mt = getMiniTool();
    if (!mt || !lastExport) return;
    var btn = this;
    btn.disabled = true;
    mt.writeTempFile({ data: lastExport }).then(function (res) {
      return mt.saveImageToPhotosAlbum({ filePath: res.filePath });
    }).then(function () {
      btn.disabled = false;
      hideSaveModal();
      toast('已保存到相册 🎉');
    }).catch(function (err) {
      btn.disabled = false;
      toast('保存失败：' + ((err && err.errMsg) || '请重试'));
    });
  });

  $('btnPost').addEventListener('click', function () {
    var mt = getMiniTool();
    if (!mt || !lastExport) return;
    mt.postNote({
      content: '用「萌系贴贴」做的可爱图～',
      mediaInfo: { image_resources: [{ url: lastExport }] }
    }).then(function () {
      hideSaveModal();
      toast('已唤起发布页');
    }).catch(function (err) {
      toast('发布失败：' + ((err && err.errMsg) || '请重试'));
    });
  });

  function saveFlow() {
    if (!state.photo && !state.stickers.length) {
      toast('先选张照片或贴点表情吧');
      return;
    }
    var url = renderExport();
    var mt = getMiniTool();
    if (!mt) {
      showSaveModal(url, '长按图片可保存（小红书 App 内可直接存相册 / 发笔记）');
      return;
    }
    mt.writeTempFile({ data: url }).then(function (res) {
      return mt.saveImageToPhotosAlbum({ filePath: res.filePath });
    }).then(function () {
      showSaveModal(url, '已保存到相册，也可以直接发布笔记～');
    }).catch(function (err) {
      showSaveModal(url, '自动保存未成功（' + ((err && err.errMsg) || '未知错误') + '），可长按图片手动保存');
    });
  }

  /* ================= 偏好 ================= */
  function persistPrefs() {
    safeSet(PREFS_KEY, JSON.stringify({ bgId: state.bgId, photoStyle: state.photoStyle, size: prefs.size }));
  }
  function loadPrefs() {
    var raw = safeGet(PREFS_KEY);
    if (!raw) return;
    try {
      var p = JSON.parse(raw);
      if (p) {
        if (p.bgId) state.bgId = p.bgId;
        if (p.photoStyle) state.photoStyle = p.photoStyle;
        if (p.size) prefs.size = clamp(parseInt(p.size, 10) || 100, 40, 220);
      }
    } catch (e) { /* 忽略损坏的偏好数据 */ }
  }

  /* ================= 启动 ================= */
  function init() {
    loadPrefs();
    loadCustomAssets();
    loadManifest();
    $('sizeSlider').value = prefs.size;
    $('sizeVal').textContent = prefs.size + '%';
    refreshRows();
    fitCanvas();
    setZoom(1);
    updateCount();
    window.addEventListener('resize', fitCanvas);
  }

  try {
    init();
  } catch (e) {
    var f = $('fatal');
    if (f) f.className = 'show';
  }
  window.addEventListener('error', function () {
    var f = $('fatal');
    if (f) f.className = 'show';
  });
})();
