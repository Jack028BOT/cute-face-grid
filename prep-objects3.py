# -*- coding: utf-8 -*-
"""第四批 6 张主体抠图入包：白底去除、裁边、缩放、量化（沿用 prep-objects2.py 管线）。"""
import os
from collections import deque
from PIL import Image

CACHE = r"C:\Users\86198\.workbuddy\clipboard-images"
OUT = r"D:\WorkBuddy项目\2026-09-23-14-04-50\cute-face-grid\cute-face-grid\objects"

OBJECTS = [
    ("clipboard-2026-09-23T06-15-35-623Z-670ed496.png", "pudding-choco", 30),
    ("clipboard-2026-09-23T06-15-35-626Z-b0f84500.png", "cookie-choc", 30),
    ("clipboard-2026-09-23T06-15-35-629Z-40dc138d.png", "bread-slice", 30),
    ("clipboard-2026-09-23T06-15-35-631Z-0f58d00f.png", "fried-egg", 8),   # 蛋白偏白，收紧阈值防止被误删
    ("clipboard-2026-09-23T06-15-35-632Z-5c930fe8.png", "cheese", 30),
    ("clipboard-2026-09-23T06-15-35-635Z-b87f0140.png", "donut", 30),
]


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


for fname, name, tol in OBJECTS:
    src = os.path.join(CACHE, fname)
    im = Image.open(src)
    has_alpha = im.mode in ("RGBA", "LA") and im.getextrema()[-1][0] < 255
    if not has_alpha:
        im = remove_white_bg(im, tol)
    bbox = im.getbbox()
    if bbox:
        im = im.crop(bbox)
    if max(im.size) > 800:
        im.thumbnail((800, 800), Image.LANCZOS)
    q = im.quantize(colors=256, method=Image.FASTOCTREE, dither=Image.FLOYDSTEINBERG)
    out = os.path.join(OUT, name + ".png")
    q.save(out, optimize=True)
    print(f"{name}.png  {im.size[0]}x{im.size[1]}  {os.path.getsize(out)//1024}KB")
