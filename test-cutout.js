/* 测试 app.js 中 floodRemove 的真实行为：
 * 1) 从 app.js 源码中原样提取函数（测试的就是上线代码）
 * 2) 合成图：白底红色方块，验证只清背景
 * 3) 真实图：曲奇 / 煎蛋 / 布丁，验证抠图占比与关键像素
 */
const fs = require('fs');
const path = require('path');

const ROOT = 'D:/WorkBuddy项目/2026-09-23-14-04-50';
const appSrc = fs.readFileSync(path.join(ROOT, 'cute-face-grid/cute-face-grid/app.js'), 'utf8');
const m = appSrc.match(/function floodRemove\(px, w, h, tol\) \{[\s\S]*?\n  \}/);
if (!m) { console.error('FAIL: 未从 app.js 提取到 floodRemove'); process.exit(1); }
const floodRemove = new Function('return ' + m[0])();

let failed = 0;
function check(name, cond, detail) {
  console.log((cond ? 'PASS' : 'FAIL') + '  ' + name + (detail ? '  (' + detail + ')' : ''));
  if (!cond) failed++;
}

/* --- 1. 合成图：10x10，白底，中心 4x4 红块 --- */
{
  const w = 10, h = 10, px = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const x = i % w, y = (i / w) | 0;
    const red = x >= 3 && x <= 6 && y >= 3 && y <= 6;
    px[i * 4] = red ? 200 : 255; px[i * 4 + 1] = red ? 30 : 255; px[i * 4 + 2] = red ? 50 : 255; px[i * 4 + 3] = 255;
  }
  const removed = floodRemove(px, w, h, 20);
  check('合成图：清除 84 个白底像素', removed === 84, 'removed=' + removed);
  check('合成图：红块中心不透明', px[(5 * w + 5) * 4 + 3] === 255);
  check('合成图：角落已透明', px[3] === 0);
}

/* --- 2. 真实图（TOL=12，与 app.js autoCutout 一致） --- */
const meta = JSON.parse(fs.readFileSync(path.join(ROOT, '_testdata/meta.json'), 'utf8'));
for (const name of Object.keys(meta)) {
  const { w, h } = meta[name];
  const raw = fs.readFileSync(path.join(ROOT, '_testdata/' + name + '.raw'));
  const px = new Uint8ClampedArray(raw);
  const removed = floodRemove(px, w, h, 12);
  const ratio = removed / (w * h);
  const cx = ((w / 2) | 0) * w + ((w / 2) | 0);
  const cornerOpaque = px[(2 * w + 2) * 4 + 3] === 0;
  console.log('  [' + name + '] ' + w + 'x' + h + ' removed=' + (ratio * 100).toFixed(1) + '% 中心alpha=' + px[cx * 4 + 3]);
  check(name + ': 角落背景已透明', cornerOpaque);
  check(name + ': 中心主体仍不透明', px[cx * 4 + 3] !== 0);
  if (name === 'cookie') check('曲奇: 抠掉占比在 4%~90% 安全区间', ratio > 0.04 && ratio < 0.9, (ratio * 100).toFixed(1) + '%');
  if (name === 'egg') console.log('  [egg] 占比 ' + (ratio * 100).toFixed(1) + '% → ' + (ratio > 0.9 ? '触发安全回退(保留原图)' : '直接抠图'));
  if (name === 'pudding') console.log('  [pudding] 占比 ' + (ratio * 100).toFixed(1) + '% → ' + (ratio > 0.9 ? '触发安全回退' : '直接抠图'));
}

console.log(failed ? ('\n' + failed + ' 项失败') : '\n全部通过 ✅');
process.exit(failed ? 1 : 0);
