"""第二批 5 张波点底图入包。"""
import os
from PIL import Image

CACHE = r"C:\Users\86198\.zcode\cli\image-cache\sess_b54093ca-8321-4231-8d5d-8d526b0e04cb"
OUT = r"C:\Users\86198\.zcode\workspace\default\cute-face-grid\bg"

BGS = [
    ("image-138db3066ded8e63c412fd6b32e6692a.png", "dots-purple-yellow"),
    ("image-3348527e19c87170329015986c41e8e4.png", "dots-blue-white-small"),
    ("image-bcf3e48eed227010af6aef299cc47688.png", "dots-sky-yellow"),
    ("image-a99a34592e27951e65abe3cf45b8af62.png", "dots-cream-blue"),
    ("image-17f1a1af0d4b8d2f7ca2d04310d928fb.png", "dots-lemon-periwinkle"),
]

for fname, name in BGS:
    im = Image.open(os.path.join(CACHE, fname)).convert("RGB")
    if max(im.size) > 1100:
        im.thumbnail((1100, 1100), Image.LANCZOS)
    out = os.path.join(OUT, name + ".png")
    im.quantize(colors=256, method=Image.FASTOCTREE, dither=Image.NONE).save(out, optimize=True)
    print(f"{name}.png  {im.size[0]}x{im.size[1]}  {os.path.getsize(out)//1024}KB")
