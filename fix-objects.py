# -*- coding: utf-8 -*-
"""修正布丁（奶油被误抠）与曲奇（右下角水印）。"""
import os
from collections import deque
from PIL import Image

CACHE = r"C:\Users\86198\.workbuddy\clipboard-images"
OUT = r"D:\WorkBuddy项目\2026-09-23-14-04-50\cute-face-grid\cute-face-grid\objects"

# 源图 alpha 情况检查
for f in os.listdir(CACHE):
    if f.startswith("clipboard-2026-09-23T06-15-35"):
        im = Image.open(os.path.join(CACHE, f))
        ext = im.getextrema()[-1] if im.mode in ("RGBA", "LA") else None
        print(f, im.mode, im.size, "alpha:", ext)


def remove_white_bg(im, tol):
    im = im.convert("RGBA")
    w, h = im.size
    px = im.load()

    def is_near_white(x, y):
        r, g, b, a = px[x, y]
        return a > 0 and r > 255 - tol and g > 255 - tol and b > 255 - tol

    seen = bytearray(w * h)
    q = deque()
    for x in range(w):
        q.append((x, 0)); q.append((x, h - 1))
    for y in range(h):
        q.append((0, y)); q.append((w - 1, y))
    while q:
        x, y = q.popleft()
        if x < 0 or y < 0 or x >= w or y >= h:
            continue
        i = y * w + x
        if seen[i]:
            continue
        seen[i] = 1
        if not is_near_white(x, y):
            continue
        px[x, y] = (255, 255, 255, 0)
        q.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
    return im


def process(fname, name, tol, clear_rect=None):
    im = Image.open(os.path.join(CACHE, fname))
    has_alpha = im.mode in ("RGBA", "LA") and im.getextrema()[-1][0] < 255
    if not has_alpha:
        im = remove_white_bg(im, tol)
    if clear_rect:
        px = im.load()
        w, h = im.size
        x0, y0 = int(clear_rect[0] * w), int(clear_rect[1] * h)
        for y in range(y0, h):
            for x in range(x0, w):
                r, g, b, a = px[x, y]
                px[x, y] = (r, g, b, 0)
    bbox = im.getbbox()
    if bbox:
        im = im.crop(bbox)
    if max(im.size) > 800:
        im.thumbnail((800, 800), Image.LANCZOS)
    q = im.quantize(colors=256, method=Image.FASTOCTREE, dither=Image.FLOYDSTEINBERG)
    out = os.path.join(OUT, name + ".png")
    q.save(out, optimize=True)
    print(f"{name}.png  {im.size[0]}x{im.size[1]}  {os.path.getsize(out)//1024}KB")


# 布丁：收紧阈值，保住白色奶油
process("clipboard-2026-09-23T06-15-35-623Z-670ed496.png", "pudding-choco", 8)
# 曲奇：抹掉右下角水印区域（原图比例位置）
process("clipboard-2026-09-23T06-15-35-626Z-b0f84500.png", "cookie-choc", 30, (0.68, 0.86))
