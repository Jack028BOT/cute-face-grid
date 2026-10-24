/* 萌系贴贴 —— 小红书小工具
 * 基线：ES2017 / Chrome 61；纯离线；脚本外置经典脚本。
 */
(function () {
  'use strict';

  var EXPORT_SIZE = 1180;   // 导出宽度基准（1:1 与 3:4 共用宽度）
  var EXP_RATIOS = { '1:1': { w: 1180, h: 1180 }, '3:4': { w: 1180, h: 1573 } };
  function expDims() { return EXP_RATIOS[state.ratio] || EXP_RATIOS['1:1']; }

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
  function drawDots(ctx, w, h, bgColor, dotColor, cols, altOffset) {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = dotColor;
    var step = w / cols;
    var r = step * 0.16;
    var rows = Math.ceil(h / step) + 2;
    for (var row = 0; row < rows; row++) {
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

  function drawMultiDots(ctx, w, h, bgColor, cols) {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, w, h);
    var step = w / cols;
    var r = step * 0.12;
    var idx = 0;
    var rows = Math.ceil(h / step) + 2;
    for (var row = 0; row < rows; row++) {
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
    { id: 'dots-blue',   name: '波点·蓝',   draw: function (c, w, h) { drawDots(c, w, h,'#47b1f0', '#ffffff', 7, true); } },
    { id: 'dots-pink',   name: '波点·粉',   draw: function (c, w, h) { drawDots(c, w, h,'#ffb6d5', '#ffffff', 8, true); } },
    { id: 'dots-rose',   name: '波点·玫红', draw: function (c, w, h) { drawDots(c, w, h,'#f062a8', '#ffffff', 8, true); } },
    { id: 'dots-mint',   name: '波点·薄荷', draw: function (c, w, h) { drawDots(c, w, h,'#7fe3c3', '#ffffff', 8, true); } },
    { id: 'dots-lemon',  name: '波点·柠檬', draw: function (c, w, h) { drawDots(c, w, h,'#f5e63d', '#ffffff', 8, true); } },
    { id: 'dots-orange', name: '波点·橘',   draw: function (c, w, h) { drawDots(c, w, h,'#ff9a3d', '#ffffff', 8, true); } },
    { id: 'dots-cocoa',  name: '彩点·可可', draw: function (c, w, h) { drawMultiDots(c, w, h, '#6b4a2f', 9); } }
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
  var CUSTOM_PHOTO_KEY = 'cfg.customPhotos';
  var MAX_CUSTOM_PHOTOS = 6;
  var PREFS_KEY = 'cfg.prefs';
  var customStickers = [];  // [{src, img}]
  var customBgs = [];       // [{src, img}]
  var customObjects = [];   // [{src, img, cut}] 上传并持久化的主体

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
    photoRef: null,         // 'file:n' | 'custom:n'（跨刷新恢复当前主体用）
    photoStyle: 'circle',   // raw | fill | circle（旧版 square/card/star/heart 读取时归一为 circle）
    bgId: 'dots-blue',      // proc id / 'file:n' / 'custom:n'
    stickers: [],           // {kind:'face'|'img'|'spark', ...}
    selIndex: -1,
    brush: false,
    zoom: 1,
    ratio: '1:1',           // 导出比例：1:1 方图 / 3:4 竖图
    photoX: 0.5,            // 主体在画布中的位置（归一化，0.5=居中，可拖动）
    photoY: 0.5
  };
  var prefs = { size: 100, photoSize: 100 };
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
    undoStack.push({ stickers: snap, bgId: state.bgId, photoStyle: state.photoStyle, photoX: state.photoX, photoY: state.photoY });
    if (undoStack.length > 30) undoStack.shift();
  }

  function doUndo() {
    var snap = undoStack.pop();
    if (!snap) { toast('没有可撤销的操作'); return; }
    state.stickers = snap.stickers;
    state.bgId = snap.bgId;
    state.photoStyle = snap.photoStyle;
    if (typeof snap.photoX === 'number') state.photoX = snap.photoX;
    if (typeof snap.photoY === 'number') state.photoY = snap.photoY;
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
    var dims = expDims();
    var availW = Math.max(120, stage.clientWidth - 8);
    var availH = Math.max(120, stage.clientHeight - 8);
    // 预览画布保持与导出一致的宽高比
    var scale = Math.min(availW / dims.w, availH / dims.h);
    var cssW = Math.max(120, Math.round(dims.w * scale));
    var cssH = Math.max(120, Math.round(dims.h * scale));
    view.style.width = cssW + 'px';
    view.style.height = cssH + 'px';
    view.width = Math.round(cssW * dpr);
    view.height = Math.round(cssH * dpr);
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

  function drawBg(ctx, w, h) {
    var bg = resolveBg();
    // 背景定义缺失（旧版本偏好残留 / 索引越界）时兜底为第一块波点，避免渲染抛错弹出 fatal 遮罩
    if (bg.type !== 'img' && !bg.def) bg.def = PROC_BGS[0];
    if (bg.type === 'proc') {
      bg.def.draw(ctx, w, h);
      return;
    }
    drawCover(ctx, bg.img, 0, 0, w, h);
  }

  function drawCover(ctx, img, dx, dy, dw, dh) {
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

  function drawPhoto(ctx, w, h) {
    if (!state.photo) return;
    var k = prefs.photoSize / 100;
    var ox = ((state.photoX || 0.5) - 0.5) * w;
    var oy = ((state.photoY || 0.5) - 0.5) * h;
    ctx.save();
    ctx.translate(ox, oy);
    if (k !== 1) {
      // 以主体自身中心为锚点缩放，各样式（raw/fill/circle）内部逻辑保持不变
      ctx.translate(w / 2, h / 2);
      ctx.scale(k, k);
      ctx.translate(-w / 2, -h / 2);
    }
    drawPhotoInner(ctx, w, h);
    ctx.restore();
  }

  /* ================= 主体形状（圆形裁剪，无边缘线条） ================= */
  function shapeCirclePath(ctx, cx, cy, r) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
  }
  function drawShapePhoto(ctx, w, h, pathFn) {
    var r = Math.min(w, h) * 0.39, cx = w / 2, cy = h / 2;
    // 无边缘线条：仅按形状裁剪照片
    ctx.save();
    pathFn(ctx, cx, cy, r);
    ctx.clip();
    drawCover(ctx, state.photo, cx - r, cy - r, r * 2, r * 2);
    ctx.restore();
  }

  function drawPhotoInner(ctx, w, h) {
    if (!state.photo) return;
    if (state.photoStyle === 'raw') {
      // 原样：透明抠图按原轮廓展示，带白色柔光（最接近示例效果）
      var img = state.photo;
      var target = w * 0.84;
      var sc = Math.min(target / img.width, target / img.height);
      var iw = img.width * sc, ih = img.height * sc;
      ctx.drawImage(img, (w - iw) / 2, (h - ih) / 2, iw, ih);
      return;
    }
    if (state.photoStyle === 'fill') {
      drawCover(ctx, state.photo, 0, 0, w, h);
      return;
    }
    // circle：圆形裁剪（默认，无边缘线条）
    drawShapePhoto(ctx, w, h, shapeCirclePath);
  }

  function drawSticker(ctx, st, w, h) {
    var size = stickerBaseSize(st) * st.scale;
    var x = st.x * w, y = st.y * h;
    ctx.save();
    ctx.translate(x, y);
    if (st.rot) ctx.rotate(st.rot);   // 双指旋转
    if (st.kind === 'face') {
      // 白色羽化光晕：深色文字在主体照片上更突出
      ctx.shadowColor = 'rgba(255,255,255,0.95)';
      ctx.shadowBlur = size * 0.09;
      ctx.font = '700 ' + Math.round(size * 0.62) + 'px "PingFang SC","Microsoft YaHei",sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = st.tint || '#111111';
      ctx.fillText(st.text, 0, 0);
      ctx.fillText(st.text, 0, 0);
    } else if (st.kind === 'img') {
      // 纯色叠加换色（保留透明区域与原图明暗，深色贴纸也明显可见）
      var painted = tintedImg(st.img, st.tint || '');
      // 白色羽化光晕：画两遍，第一遍带阴影形成柔光轮廓，第二遍补密光晕
      ctx.shadowColor = 'rgba(255,255,255,0.95)';
      ctx.shadowBlur = size * 0.11;
      ctx.drawImage(painted, -size / 2, -size / 2, size, size);
      ctx.drawImage(painted, -size / 2, -size / 2, size, size);
    } else { // spark
      var colors = ['#ffffff', '#ffe36e', '#ffd0e4'];
      ctx.fillStyle = colors[st.seed % colors.length];
      drawStarShape(ctx, 0, 0, size / 2, size * 0.2, 4 + (st.seed % 2));
    }
    ctx.restore();
  }

  function stickerBBox(st, w, h) {
    var half = stickerBaseSize(st) * st.scale * 0.62;
    if (st.kind === 'face') half = stickerBaseSize(st) * st.scale * 0.75;
    // 旋转后用外接方形近似命中区域
    if (st.rot) half *= Math.abs(Math.cos(st.rot)) + Math.abs(Math.sin(st.rot));
    return {
      x1: st.x * w - half, y1: st.y * h - half,
      x2: st.x * w + half, y2: st.y * h + half
    };
  }

  var renderPending = false;
  var tintRowKey = null;
  function render() {
    if (renderPending) return;
    renderPending = true;
    window.requestAnimationFrame(function () {
      renderPending = false;
      var dims = expDims();
      vctx.setTransform(view.width / dims.w, 0, 0, view.height / dims.h, 0, 0);
      drawBg(vctx, dims.w, dims.h);
      drawPhoto(vctx, dims.w, dims.h);
      for (var i = 0; i < state.stickers.length; i++) {
        drawSticker(vctx, state.stickers[i], dims.w, dims.h);
      }
      if (state.selIndex >= 0 && state.stickers[state.selIndex]) {
        var b = stickerBBox(state.stickers[state.selIndex], dims.w, dims.h);
        vctx.save();
        vctx.strokeStyle = '#ff5fa8';
        vctx.lineWidth = 4;
        vctx.setLineDash([14, 10]);
        vctx.strokeRect(b.x1 - 10, b.y1 - 10, b.x2 - b.x1 + 20, b.y2 - b.y1 + 20);
        vctx.restore();
      }
      // 拖动主体时显示虚线框反馈
      if (drag && drag.photo && state.photo) {
        var pb = photoBBox();
        if (pb) {
          vctx.save();
          vctx.strokeStyle = '#ff5fa8';
          vctx.lineWidth = 4;
          vctx.setLineDash([14, 10]);
          vctx.strokeRect(pb.x1 - 10, pb.y1 - 10, pb.x2 - pb.x1 + 20, pb.y2 - pb.y1 + 20);
          vctx.restore();
        }
      }
      if (!state.photo) {
        vctx.save();
        vctx.font = '600 44px "PingFang SC","Microsoft YaHei",sans-serif';
        vctx.textAlign = 'center';
        vctx.textBaseline = 'middle';
        vctx.shadowColor = 'rgba(0,0,0,0.45)';
        vctx.shadowBlur = 12;
        vctx.fillStyle = 'rgba(255,255,255,0.95)';
        vctx.fillText('点下方「主体」行选个食物或传照片', dims.w / 2, dims.h * 0.9);
        vctx.restore();
      }
      // 颜色行跟随选中状态：选中对象变化时重建，否则仅同步显隐
      var sel = selSticker();
      var key = sel ? state.selIndex + ':' + sel.kind : '';
      if (key !== tintRowKey) {
        tintRowKey = key;
        syncTintRow(true);
      } else {
        syncTintRow(false);
      }
      // 选中贴纸时显示浮层工具条
      updateSelTools();
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
    var t = makeTile('slot-empty');
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
    syncTintRow(true);
  }

  /* ================= 表情换色（选中表情时显示颜色行） ================= */
  // 多巴胺配色：高饱和暖色为主（红→粉→橙→黄），青柠/薄荷/湖蓝/葡萄紫点缀
  var DOPAMINE_COLORS = [
    { name: '默认', value: '' },
    { name: '草莓红', value: '#ff5252' },
    { name: '热粉', value: '#ff4f9a' },
    { name: '蜜桃', value: '#ff8577' },
    { name: '珊瑚', value: '#ff6f61' },
    { name: '活力橙', value: '#ff9a3d' },
    { name: '芒果黄', value: '#ffd93d' },
    { name: '青柠', value: '#c8e04b' },
    { name: '抹茶', value: '#5dd39e' },
    { name: '薄荷', value: '#3ee6c4' },
    { name: '湖蓝', value: '#38b6ff' },
    { name: '葡萄紫', value: '#b06cf0' }
  ];
  var FACE_COLORS = DOPAMINE_COLORS;
  // 图片表情换色：用纯色叠加（离屏 canvas source-atop），任何颜色（含深色贴纸）都可见
  var IMG_TINTS = DOPAMINE_COLORS;

  function tintedImg(img, color) {
    if (!color) return img;
    if (!img._tintCache) img._tintCache = {};
    var hit = img._tintCache[color];
    if (hit) return hit;
    var c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    var cc = c.getContext('2d');
    cc.drawImage(img, 0, 0);
    cc.globalCompositeOperation = 'source-atop';
    cc.globalAlpha = 0.6;
    cc.fillStyle = color;
    cc.fillRect(0, 0, c.width, c.height);
    img._tintCache[color] = c;
    return c;
  }

  function selSticker() {
    return state.selIndex >= 0 ? state.stickers[state.selIndex] : null;
  }

  function syncTintRow(rebuild) {
    var rowEl = $('tintRow');
    var st = selSticker();
    if (!st || st.kind === 'spark') { rowEl.style.display = 'none'; return; }
    rowEl.style.display = '';
    if (!rebuild) return;
    var row = $('tintScroll');
    clearNode(row);
    if (st.kind === 'face') {
      FACE_COLORS.forEach(function (c) {
        var t = makeTile();
        var dot = document.createElement('span');
        dot.style.cssText = 'width:34px;height:34px;border-radius:50%;background:' + (c.value || '#111111') +
          ';border:2px solid ' + ((st.tint || '') === c.value ? '#e2559a' : '#f3c3da') + ';box-sizing:border-box';
        t.appendChild(dot);
        t.title = c.name;
        if ((st.tint || '') === c.value) t.className += ' sel';
        t.addEventListener('click', function () {
          pushUndo();
          st.tint = c.value;
          syncTintRow(true); render();
        });
        row.appendChild(t);
      });
    } else if (st.kind === 'img') {
      IMG_TINTS.forEach(function (c) {
        var t = makeTile();
        var dot = document.createElement('span');
        // 原色用彩虹渐变圆点表示，其余为纯色圆点
        var bg = c.value || 'linear-gradient(135deg,#ff9ac4 25%,#ffe36e 50%,#8be0c8 75%,#9ecbff)';
        dot.style.cssText = 'width:34px;height:34px;border-radius:50%;background:' + bg +
          ';border:2px solid ' + ((st.tint || '') === c.value ? '#e2559a' : '#f3c3da') + ';box-sizing:border-box';
        t.appendChild(dot);
        t.title = c.name;
        if ((st.tint || '') === c.value) t.className += ' sel';
        t.addEventListener('click', function () {
          pushUndo();
          st.tint = c.value;
          syncTintRow(true); render();
        });
        row.appendChild(t);
      });
    }
  }

  function renderBgRow() {
    var row = $('bgScroll');
    clearNode(row);
    PROC_BGS.forEach(function (def, i) {
      var t = makeTile();
      var c = document.createElement('canvas');
      c.width = 60; c.height = 60;
      def.draw(c.getContext('2d'), 60, 60);
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
    // 打包背景分两组展示：波点（dots-*.png）在前，照片底在后；自定义槽位仍在最后
    var dotsList = [], photoList = [];
    fileBgs.forEach(function (it, i) {
      (it.src.indexOf('dots') >= 0 ? dotsList : photoList).push({ it: it, i: i });
    });
    dotsList.concat(photoList).forEach(function (entry) {
      var it = entry.it, i = entry.i;
      var t = makeTile();
      var c = document.createElement('canvas');
      c.width = 60; c.height = 60;
      drawCover(c.getContext('2d'), it.img, 0, 0, 60, 60);
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
    var slot = makeTile();
    if (customBgs.length) {
      var lastIdx = customBgs.length - 1;
      (function (idx) {
        var it = customBgs[idx];
        var c = document.createElement('canvas');
        c.width = 60; c.height = 60;
        drawCover(c.getContext('2d'), it.img, 0, 0, 60, 60);
        slot.appendChild(c);
        if (state.bgId === 'custom:' + idx) slot.className += ' sel';
        slot.addEventListener('click', function () {
          pushUndo();
          state.bgId = 'custom:' + idx;
          persistPrefs();
          refreshRows(); render();
        });
        var rep = document.createElement('span');
        rep.className = 'slot-replace';
        rep.textContent = '↻';
        rep.addEventListener('click', function (ev) {
          ev.stopPropagation();
          $('bgInput').click();
        });
        slot.appendChild(rep);
      })(lastIdx);
    } else {
      slot.className += ' slot-empty';
      var sp = document.createElement('span');
      sp.className = 'plus-tile';
      sp.textContent = '+';
      slot.appendChild(sp);
      slot.addEventListener('click', function () { $('bgInput').click(); });
    }
    row.appendChild(slot);
  }

  function drawContain(cc, img, s) {
    var sc = Math.min(s / img.width, s / img.height);
    var w = img.width * sc, h = img.height * sc;
    cc.drawImage(img, (s - w) / 2, (s - h) / 2, w, h);
  }

  function renderPhotoRow() {
    var row = $('photoScroll');
    clearNode(row);
    // 按食物种类分组排序：1 主食早餐 → 2 水果 → 3 蛋糕甜品 → 4 布丁果冻饼干 → 5 冰品（未登记的排最后）
    var PHOTO_GROUPS = {
      'baozi': 1, 'melonpan': 1, 'onigiri': 1, 'toast': 1, 'fried-egg': 1, 'corn-slice': 1, 'cheese': 1,
      'orange-slice': 2, 'starfruit': 2, 'blueberry': 2,
      'strawberry-shortcake': 3, 'blackforest-cake': 3, 'blueberry-cake': 3, 'cheesecake': 3,
      'sprinkle-cake': 3, 'cupcake': 3, 'mango-crepe': 3, 'cream-cherry': 3, 'donut': 3, 'macaron': 3,
      'swiss-roll': 3, 'cream-puff': 3, 'baked-cheesecake': 3,
      'pudding': 4, 'pudding-pink': 4, 'pudding-choco': 4, 'green-jelly': 4, 'cookie': 4, 'cookie-choc': 4, 'biscuit': 4,
      'strawberry-icecream': 5, 'pistachio-icecream': 5, 'cat-popsicle': 5
    };
    function photoGroup(src) {
      var name = String(src).replace(/^.*\//, '').replace(/\.png$/i, '');
      return PHOTO_GROUPS[name] || 99;
    }
    // 携带原始索引排序，保证 photoRef 'file:n' 引用稳定
    var sortedObjs = fileObjects.map(function (it, i) { return { it: it, i: i }; })
      .sort(function (a, b) { return photoGroup(a.it.src) - photoGroup(b.it.src); }); // 同组内保持原相对顺序（sort 稳定）
    sortedObjs.forEach(function (entry) {
      var it = entry.it, i = entry.i;
      var t = makeTile();
      var c = document.createElement('canvas');
      c.width = 60; c.height = 60;
      drawContain(c.getContext('2d'), it.img, 60);
      t.appendChild(c);
      if (state.photoRef === 'file:' + i) t.className += ' sel';
      t.addEventListener('click', function () {
        pushUndo();
        state.photo = it.img;
        state.photoRef = 'file:' + i;
        state.photoStyle = 'raw';
        persistPrefs();
        refreshRows(); render();
      });
      row.appendChild(t);
    });
    // 自定义主体（上传后持久化）排在预置素材之后
    customObjects.forEach(function (it, i) {
      var t = makeTile();
      var c = document.createElement('canvas');
      c.width = 60; c.height = 60;
      drawContain(c.getContext('2d'), it.img, 60);
      t.appendChild(c);
      if (state.photoRef === 'custom:' + i) t.className += ' sel';
      t.addEventListener('click', function () {
        pushUndo();
        state.photo = it.img;
        state.photoRef = 'custom:' + i;
        state.photoStyle = it.cut ? 'raw' : 'circle';
        persistPrefs();
        refreshRows(); render();
      });
      row.appendChild(t);
    });
    if (state.photo && !state.photoRef) {
      // 当前主体不在任何素材栏（如槽位替换后引用被清）时显示替换磁贴
      var t = makeTile();
      var c = document.createElement('canvas');
      c.width = 60; c.height = 60;
      var cc = c.getContext('2d');
      if (state.photoStyle === 'raw') drawContain(cc, state.photo, 60);
      else drawCover(cc, state.photo, 0, 0, 60, 60);
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
    // 行末固定上传槽位：虚线框 + 加号，点击唤起选图（与背景栏槽位样式一致）
    var slot = makeTile('slot-empty');
    var sp = document.createElement('span');
    sp.className = 'plus-tile';
    sp.textContent = '+';
    slot.appendChild(sp);
    slot.title = '上传自定义表情';
    slot.addEventListener('click', function () { $('stickerInput').click(); });
    row.appendChild(slot);
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
    var dims = expDims();
    state.stickers.push({
      kind: 'spark', seed: Math.floor(Math.random() * 6),
      x: x / dims.w, y: y / dims.h,
      scale: 0.7 + Math.random() * 0.9
    });
  }

  /* ================= 画布交互 ================= */
  var drag = null;    // {index, moved} 单指拖贴纸 / {brush} 画笔 / {photo} 拖主体
  var pointers = {};  // pointerId -> 导出坐标（双指手势用）
  var pinch = null;   // {dist0, ang0, scale0, rot0, undone} 双指缩放/旋转选中贴纸

  function canvasPoint(ev) {
    var rect = view.getBoundingClientRect();
    var dims = expDims();
    return {
      x: (ev.clientX - rect.left) / rect.width * dims.w,
      y: (ev.clientY - rect.top) / rect.height * dims.h
    };
  }

  function hitTest(pt) {
    var dims = expDims();
    for (var i = state.stickers.length - 1; i >= 0; i--) {
      var b = stickerBBox(state.stickers[i], dims.w, dims.h);
      if (pt.x >= b.x1 && pt.x <= b.x2 && pt.y >= b.y1 && pt.y <= b.y2) return i;
    }
    return -1;
  }

  // 主体命中区域（用于拖动主体）
  function photoBBox() {
    if (!state.photo) return null;
    var dims = expDims();
    var k = prefs.photoSize / 100;
    var cx = state.photoX * dims.w, cy = state.photoY * dims.h;
    if (state.photoStyle === 'fill') return { x1: 0, y1: 0, x2: dims.w, y2: dims.h };
    var half = (state.photoStyle === 'circle')
      ? Math.min(dims.w, dims.h) * 0.39 * k
      : dims.w * 0.42 * k;   // raw：按宽度估算包围
    return { x1: cx - half, y1: cy - half, x2: cx + half, y2: cy + half };
  }

  function activePoints() {
    var pts = [];
    for (var k in pointers) {
      if (Object.prototype.hasOwnProperty.call(pointers, k)) pts.push(pointers[k]);
    }
    return pts;
  }

  function pinchPair(a, b) {
    return {
      dist: Math.max(1, Math.sqrt((a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y))),
      ang: Math.atan2(b.y - a.y, b.x - a.x)
    };
  }

  view.addEventListener('pointerdown', function (ev) {
    ev.preventDefault();
    view.setPointerCapture && view.setPointerCapture(ev.pointerId);
    var pt = canvasPoint(ev);
    pointers[ev.pointerId] = pt;
    if (state.brush) {
      drag = { brush: true, lastX: pt.x, lastY: pt.y };
      pushUndo();
      addSpark(pt.x, pt.y);
      render(); updateCount();
      return;
    }
    // 第二根手指落下：进入双指缩放/旋转，作用于当前选中贴纸
    var pts = activePoints();
    if (pts.length >= 2 && state.selIndex >= 0 && state.stickers[state.selIndex]) {
      var pp = pinchPair(pts[0], pts[1]);
      var tgt = state.stickers[state.selIndex];
      drag = null;
      pinch = { dist0: pp.dist, ang0: pp.ang, scale0: tgt.scale, rot0: tgt.rot || 0, undone: false };
      render();
      return;
    }
    var idx = hitTest(pt);
    state.selIndex = idx;   // 点到贴纸选中；点到空白/主体则取消选中
    drag = (idx >= 0) ? { index: idx, moved: false, snap: null } : null;
    if (idx >= 0) {
      var st = state.stickers[idx];
      var ed = expDims();
      drag.offX = st.x - pt.x / ed.w;
      drag.offY = st.y - pt.y / ed.h;
      syncSliderToSelection();
    } else if (state.photo) {
      // 没点到贴纸时尝试拖动主体
      var pb = photoBBox();
      if (pb && pt.x >= pb.x1 && pt.x <= pb.x2 && pt.y >= pb.y1 && pt.y <= pb.y2) {
        var ed2 = expDims();
        drag = { photo: true, moved: false, snap: false };
        drag.offX = state.photoX - pt.x / ed2.w;
        drag.offY = state.photoY - pt.y / ed2.h;
      }
    }
    render();
  });

  view.addEventListener('pointermove', function (ev) {
    if (pointers[ev.pointerId]) pointers[ev.pointerId] = canvasPoint(ev);
    // 双指捏合：等比缩放 + 旋转选中贴纸
    if (pinch) {
      var pts2 = activePoints();
      if (pts2.length < 2) { pinch = null; return; }
      var st2 = state.stickers[state.selIndex];
      if (!st2) { pinch = null; return; }
      ev.preventDefault();
      var pp2 = pinchPair(pts2[0], pts2[1]);
      if (!pinch.undone) { pushUndo(); pinch.undone = true; }
      st2.scale = clamp(pinch.scale0 * pp2.dist / pinch.dist0, 0.4, 1.6);
      st2.rot = pinch.rot0 + (pp2.ang - pinch.ang0);
      syncSliderToSelection();
      render();
      return;
    }
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
    if (drag.photo) {
      var ed = expDims();
      if (!drag.snap) pushUndo();
      drag.snap = true;
      drag.moved = true;
      state.photoX = clamp(pt.x / ed.w + drag.offX, 0.02, 0.98);
      state.photoY = clamp(pt.y / ed.h + drag.offY, 0.02, 0.98);
      persistPrefs();
      render();
      return;
    }
    var st = state.stickers[drag.index];
    if (!st) return;
    drag.moved = true;
    if (!drag.snap) pushUndo();
    drag.snap = true;
    var ed3 = expDims();
    st.x = clamp(pt.x / ed3.w + drag.offX, 0.02, 0.98);
    st.y = clamp(pt.y / ed3.h + drag.offY, 0.02, 0.98);
    render();
  });

  function endDrag(ev) {
    if (ev && ev.pointerId in pointers) delete pointers[ev.pointerId];
    if (pinch) {
      if (activePoints().length < 2) pinch = null;
      return;
    }
    if (!drag) return;
    if (drag.brush) {
      if (activePoints().length === 0) drag = null;  // 双指撒星星时抬一根不结束笔画
      return;
    }
    if (drag && drag.photo && drag.moved) toast('主体位置已调整');
    drag = null;
  }
  view.addEventListener('pointerup', endDrag);
  view.addEventListener('pointercancel', endDrag);

  /* ================= 选中贴纸浮层工具条（删除/复制/置顶） ================= */
  var selToolsShown = null;
  function updateSelTools() {
    var show = !state.brush && state.selIndex >= 0 && !!state.stickers[state.selIndex];
    if (show === selToolsShown) return;
    selToolsShown = show;
    $('selTools').className = show ? 'show' : '';
  }

  $('stDelete').addEventListener('click', function () {
    if (state.selIndex < 0) return;
    pushUndo();
    state.stickers.splice(state.selIndex, 1);
    state.selIndex = -1;
    render(); updateCount();
  });

  $('stCopy').addEventListener('click', function () {
    var st = selSticker();
    if (!st) return;
    pushUndo();
    var copy = {};
    for (var k in st) { if (Object.prototype.hasOwnProperty.call(st, k)) copy[k] = st[k]; }
    copy.x = clamp(st.x + 0.06, 0.02, 0.98);
    copy.y = clamp(st.y + 0.06, 0.02, 0.98);
    state.stickers.push(copy);
    state.selIndex = state.stickers.length - 1;
    render(); updateCount();
    toast('已复制，拖到新位置试试');
  });

  $('stTop').addEventListener('click', function () {
    var i = state.selIndex;
    if (i < 0) return;
    if (i === state.stickers.length - 1) { toast('已经在最上层啦'); return; }
    pushUndo();
    var st = state.stickers.splice(i, 1)[0];
    state.stickers.push(st);
    state.selIndex = state.stickers.length - 1;
    render();
  });

  /* ================= 滑杆 / 缩放 / 工具栏 ================= */
  function syncSliderToSelection() {
    var st = state.stickers[state.selIndex];
    var v = st ? Math.round(st.scale * 100) : prefs.size;
    $('sizeSlider').value = clamp(v, 40, 160);
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

  $('photoSizeSlider').addEventListener('input', function () {
    var v = parseInt(this.value, 10);
    $('photoSizeVal').textContent = v + '%';
    prefs.photoSize = clamp(v, 40, 160);
    persistPrefs();
    render();
  });

  var ZOOMS = [1, 1.25, 1.5, 2];
  function setZoom(z) {
    state.zoom = z;
    view.style.transform = z === 1 ? 'none' : 'scale(' + z + ')';
    var label = z === 1 ? '适配' : Math.round(z * 100) + '%';   // 「适配」避免与导出比例 1:1 混淆
    $('zoomLabel').textContent = label;
    $('statZoom').textContent = '缩放 ' + Math.round(z * 100) + '%';
  }

  /* ================= 导出比例（1:1 方图 / 3:4 竖图） ================= */
  function updateRatioLabel() {
    $('ratioLabel').textContent = state.ratio === '3:4' ? '竖图' : '方图';
  }
  $('btnRatio').addEventListener('click', function () {
    state.ratio = (state.ratio === '3:4') ? '1:1' : '3:4';
    updateRatioLabel();
    persistPrefs();
    fitCanvas();
    toast(state.ratio === '3:4' ? '已切换 3:4 竖图（笔记展示面积更大）' : '已切换 1:1 方图');
  });
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
    updateSelTools();
  });
  $('btnUndo').addEventListener('click', doUndo);
  $('btnClear').addEventListener('click', function () {
    if (!state.stickers.length) { toast('画布上还没有贴纸'); return; }
    // 页内确认弹窗（不用 window.confirm：webview 可能屏蔽原生弹窗，导致按钮看起来无反应）
    askConfirm('清空全部贴纸？', function () {
      pushUndo();
      state.stickers = [];
      state.selIndex = -1;
      render(); updateCount();
    });
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
      showAbout();
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
        // 与表情/背景一致：上传主体也持久化进「主体」栏，刷新后不丢
        if (customObjects.length >= MAX_CUSTOM_PHOTOS) {
          customObjects.shift();
          if (state.photoRef && state.photoRef.indexOf('custom:') === 0) state.photoRef = null;
          toast('最多保留 ' + MAX_CUSTOM_PHOTOS + ' 个自定义主体，最早的已被替换');
        }
        customObjects.push({ src: url, img: cut.img, cut: cut.cut });
        state.photo = cut.img;
        state.photoRef = 'custom:' + (customObjects.length - 1);
        state.photoStyle = cut.cut ? 'raw' : 'circle';
        persistCustom(CUSTOM_PHOTO_KEY, customObjects);
        persistPrefs();
        refreshRows(); render();
        toast(cut.cut ? '已抠掉浅色背景，并加入主体栏 ✂️' : '照片已就绪，并加入主体栏');
      };
      img.src = url;
    });
  });

  // 按引用找回当前主体（file:n / custom:n）；只在能找到时补挂，找不到不主动清除（可能尚未加载完）
  function resolvePhoto() {
    if (!state.photoRef || state.photo) return;
    var p = state.photoRef;
    if (p.indexOf('custom:') === 0) {
      var ci = parseInt(p.slice(7), 10);
      if (customObjects[ci]) state.photo = customObjects[ci].img;
    } else if (p.indexOf('file:') === 0) {
      var fi = parseInt(p.slice(5), 10);
      if (fileObjects[fi]) state.photo = fileObjects[fi].img;
    }
  }

  // 顺序加载持久化的自定义主体（重跑自动抠图，还原与上传时一致的处理结果）
  function loadCustomPhotos() {
    var raw = safeGet(CUSTOM_PHOTO_KEY);
    if (!raw) return;
    var arr = null;
    try { arr = JSON.parse(raw); } catch (e) { arr = null; }
    if (!arr || !arr.length) return;
    var i = 0;
    function next() {
      resolvePhoto();
      if (i >= arr.length) { refreshRows(); render(); return; }
      var src = arr[i++];
      var img = new Image();
      img.onload = function () {
        var cut = autoCutout(img);
        customObjects.push({ src: src, img: cut.img, cut: cut.cut });
        refreshRows();
        next();
      };
      img.onerror = next;
      img.src = src;
    }
    next();
  }

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
    // 先快照 File 对象到真实数组：清空 input.value 会连带清空 FileList，
    // 之后再读 length 会得到 0，导致上传静默失败
    var files = Array.prototype.slice.call(this.files || []);
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
    var file = this.files && this.files[0];
    this.value = '';
    if (!file) { toast('没有选到图片，再试一次'); return; }
    fileToDataURL(file, 900, 'image/jpeg', 0.82, function (url) {
      if (!url) { toast('背景图片没有读取成功'); return; }
      var img = new Image();
      img.onload = function () {
        // 槽位只保留最近一张：清空旧的，放入新的并立即启用
        customBgs.length = 0;
        customBgs.push({ src: url, img: img });
        state.bgId = 'custom:0';
        persistCustom(CUSTOM_BG_KEY, customBgs);
        persistPrefs();
        refreshRows(); render();
        toast('已放入背景栏末尾的槽位，点它即可启用');
      };
      img.onerror = function () { toast('这张图片解码失败，换一张试试'); };
      img.src = url;
    });
  });

  /* ================= 导出与端能力 ================= */
  function renderExport() {
    var dims = expDims();
    var c = document.createElement('canvas');
    c.width = dims.w;
    c.height = dims.h;
    var ctx = c.getContext('2d');
    drawBg(ctx, dims.w, dims.h);
    drawPhoto(ctx, dims.w, dims.h);
    for (var i = 0; i < state.stickers.length; i++) {
      drawSticker(ctx, state.stickers[i], dims.w, dims.h);
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

  /* ================= 页内确认 / 使用说明弹窗（替代 window.confirm/alert） ================= */
  // 小红书 webview 可能屏蔽原生 confirm/alert：点了按钮什么也不发生，审核会判"按钮无法点击"
  var confirmCb = null;
  function askConfirm(msg, onOk) {
    $('confirmMsg').textContent = msg;
    confirmCb = onOk || null;
    $('confirmModal').className = 'show';
  }
  function closeConfirm() {
    $('confirmModal').className = '';
    confirmCb = null;
  }
  $('btnConfirmOk').addEventListener('click', function () {
    var cb = confirmCb;
    closeConfirm();
    if (cb) cb();
  });
  $('btnConfirmCancel').addEventListener('click', closeConfirm);
  $('confirmModal').addEventListener('click', function (ev) {
    if (ev.target === this) closeConfirm();
  });

  function showAbout() {
    var lines = [
      '1. 点「背景」行挑一块波点底；点末尾「+」可上传自己的背景（↻ 可换图）',
      '2. 点「主体」行选个食物，或上传照片（浅色底自动抠图）；拖「主体大小」滑杆调整大小',
      '3. 点「表情」行贴颜文字或五官，拖动摆位置；选中后可删除/复制/置顶，双指捏合缩放旋转',
      '4. 主体可以直接在画布上拖动位置；点选表情出现「颜色」行，可换颜色或滤镜',
      '5. 工具栏「方图/竖图」切换导出比例；点「保存」或「导出图片」生成图片，可存相册或发笔记'
    ];
    var body = $('infoBody');
    clearNode(body);
    lines.forEach(function (t) {
      var p = document.createElement('p');
      p.textContent = t;
      body.appendChild(p);
    });
    $('infoModal').className = 'show';
  }
  $('btnInfoClose').addEventListener('click', function () { $('infoModal').className = ''; });
  $('infoModal').addEventListener('click', function (ev) {
    if (ev.target === this) this.className = '';
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
    safeSet(PREFS_KEY, JSON.stringify({
      bgId: state.bgId, photoStyle: state.photoStyle, size: prefs.size, photoSize: prefs.photoSize,
      photoRef: state.photoRef, photoX: state.photoX, photoY: state.photoY, ratio: state.ratio
    }));
  }
  function loadPrefs() {
    var raw = safeGet(PREFS_KEY);
    if (!raw) return;
    try {
      var p = JSON.parse(raw);
      if (p) {
        if (p.bgId) state.bgId = p.bgId;
        if (p.photoStyle) state.photoStyle = ['raw', 'fill', 'circle'].indexOf(p.photoStyle) >= 0 ? p.photoStyle : 'circle';
        if (p.size) prefs.size = clamp(parseInt(p.size, 10) || 100, 40, 160);
        if (p.photoSize) prefs.photoSize = clamp(parseInt(p.photoSize, 10) || 100, 40, 160);
        if (typeof p.photoRef === 'string' && p.photoRef) state.photoRef = p.photoRef;
        if (typeof p.photoX === 'number') state.photoX = clamp(p.photoX, 0.02, 0.98);
        if (typeof p.photoY === 'number') state.photoY = clamp(p.photoY, 0.02, 0.98);
        if (p.ratio === '1:1' || p.ratio === '3:4') state.ratio = p.ratio;
      }
    } catch (e) { /* 忽略损坏的偏好数据 */ }
  }

  /* ================= 启动 ================= */
  function init() {
    loadPrefs();
    loadCustomAssets();
    loadCustomPhotos();
    loadManifest();
    $('sizeSlider').value = prefs.size;
    $('sizeVal').textContent = prefs.size + '%';
    refreshRows();
    fitCanvas();
    setZoom(1);
    updateRatioLabel();
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
  // fatal 遮罩可点击关闭：出错后允许用户继续使用，而不是被遮罩锁死
  $('fatal').addEventListener('click', function () { this.className = ''; });
})();
