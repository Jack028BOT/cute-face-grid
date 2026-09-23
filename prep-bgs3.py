# -*- coding: utf-8 -*-
"""第四批 5 张照片背景入包：整图压缩（无透明，存 JPEG），沿用 bg 命名规范。"""
import os
from PIL import Image

CACHE = r"C:\Users\86198\.workbuddy\clipboard-images"
OUT = r"D:\WorkBuddy项目\2026-09-23-14-04-50\cute-face-grid\cute-face-grid\bg"

BGS = [
    ("clipboard-2026-09-23T06-25-06-262Z-4423ae34.png", "heaven-hands"),
    ("clipboard-2026-09-23T06-25-06-267Z-8219c3e0.png", "sun-hands"),
    ("clipboard-2026-09-23T06-25-06-271Z-6d91dd0f.png", "ok-hand-sun"),
    ("clipboard-2026-09-23T06-25-06-272Z-726d91c3.png", "angel-wings"),
    ("clipboard-2026-09-23T06-25-06-273Z-26dc7dde.png", "sun-burst"),
]

for fname, name in BGS:
    im = Image.open(os.path.join(CACHE, fname)).convert("RGB")
    if max(im.size) > 900:
        im.thumbnail((900, 900), Image.LANCZOS)
    out = os.path.join(OUT, name + ".jpg")
    im.save(out, "JPEG", quality=85, optimize=True)
    print(f"{name}.jpg  {im.size[0]}x{im.size[1]}  {os.path.getsize(out)//1024}KB")
