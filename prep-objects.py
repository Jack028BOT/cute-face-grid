"""把缓存里的 12 张食物抠图处理成小工具内置主体素材。

- 无 alpha 的白底图：从四边向内泛洪去白底（容差温和，只清除与边缘连通的近白像素）
- 裁掉透明空白边，最长边缩到 800px，PNG 优化保存
"""
import os
from collections import deque
from PIL import Image

CACHE = r"C:\Users\86198\.zcode\cli\image-cache\sess_b54093ca-8321-4231-8d5d-8d526b0e04cb"
OUT = r"C:\Users\86198\.zcode\workspace\default\cute-face-grid\objects"
os.makedirs(OUT, exist_ok=True)

OBJECTS = [
    ("image-be5ad0043dc309e3442a64dbe020375b.png", "baozi"),
    ("image-8158997d53e1a7733276984f56743a2b.png", "onigiri"),
    ("image-1de6a95f7f73d7e3aecb4a4c7d86dca4.png", "toast"),
    ("image-96fc83367e44fa0f8903c317e3164c79.png", "cookie"),
    ("image-d6a16afdedbb35fe2fb30c7076a86921.png", "cheesecake"),
    ("image-d6add9387430ad25f6ccbbf4e0db2ab4.png", "sprinkle-cake"),
    ("image-9bd0eeabf7932dbda443fc384c0f68ab.png", "pudding"),
    ("image-8c996655015a4571429e6b8cf3a41ef0.png", "macaron"),
    ("image-073bcc4cb3aef855806d33f73bedc8d1.png", "cupcake"),
    ("image-fd149ae9e17d20b3faa92d9ffef1ac3b.png", "melonpan"),
    ("image-a4a07f689f2bb232ddae74473867a253.png", "pistachio-icecream"),
    ("image-7600edd3c8205c667adbdaab9cfbe3f7.png", "strawberry-icecream"),
]

TOL = 30  # 近白判定容差


def remove_white_bg(im):
    im = im.convert("RGBA")
    w, h = im.size
    px = im.load()

    def is_near_white(x, y):
        r, g, b, a = px[x, y]
        return a > 0 and r > 255 - TOL and g > 255 - TOL and b > 255 - TOL

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


for fname, name in OBJECTS:
    im = Image.open(os.path.join(CACHE, fname))
    has_alpha = im.mode in ("RGBA", "LA") and im.getextrema()[-1][0] < 255
    if not has_alpha:
        im = remove_white_bg(im)
    bbox = im.getbbox()
    if bbox:
        im = im.crop(bbox)
    if max(im.size) > 800:
        im.thumbnail((800, 800), Image.LANCZOS)
    out = os.path.join(OUT, name + ".png")
    im.save(out, optimize=True)
    print(f"{name}.png  {im.size[0]}x{im.size[1]}  {os.path.getsize(out)//1024}KB")
