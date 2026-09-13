"""把 bg/ 下所有底图中心裁剪为正方形。"""
import os
from PIL import Image

D = r"C:\Users\86198\.zcode\workspace\default\cute-face-grid\bg"

for n in sorted(os.listdir(D)):
    p = os.path.join(D, n)
    im = Image.open(p)
    w, h = im.size
    if w == h:
        print(n, "已是正方形", w)
        continue
    side = min(w, h)
    left = (w - side) // 2
    top = (h - side) // 2
    im = im.crop((left, top, left + side, top + side))
    im.save(p, optimize=True)
    print(n, f"{w}x{h} -> {side}x{side}  {os.path.getsize(p)//1024}KB")
