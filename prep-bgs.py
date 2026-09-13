"""把缓存里的 6 张波点底图处理成小工具内置底图素材。"""
import os
from PIL import Image

CACHE = r"C:\Users\86198\.zcode\cli\image-cache\sess_b54093ca-8321-4231-8d5d-8d526b0e04cb"
OUT = r"C:\Users\86198\.zcode\workspace\default\cute-face-grid\bg"
os.makedirs(OUT, exist_ok=True)

BGS = [
    ("image-8088078e58d3b5dce5bc669c505bcebe.png", "dots-lime-pink"),
    ("image-04c2f3cf9831590120d2fdaef0f17435.png", "dots-pink-lime"),
    ("image-36fa2998e6667d92d400dc67c4666765.png", "dots-mint-pink"),
    ("image-54f10988d2454fda0ca3c9d15baada64.png", "dots-pink-mint"),
    ("image-5c3deaa6465a0168a15c6663e733bbd9.png", "dots-cocoa-pastel"),
    ("image-ddba292ac91d4ffc0aefeedccddb717e.png", "dots-blue-yellow"),
]

for fname, name in BGS:
    im = Image.open(os.path.join(CACHE, fname)).convert("RGB")
    if max(im.size) > 1100:
        im.thumbnail((1100, 1100), Image.LANCZOS)
    out = os.path.join(OUT, name + ".png")
    im.quantize(colors=256, method=Image.FASTOCTREE, dither=Image.NONE).save(out, optimize=True)
    print(f"{name}.png  {im.size[0]}x{im.size[1]}  {os.path.getsize(out)//1024}KB")
