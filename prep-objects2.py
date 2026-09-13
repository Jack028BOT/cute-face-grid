"""第三批 5 张主体抠图入包：白底去除、裁边、缩放、量化。"""
import os
from collections import deque
from PIL import Image

CACHE = r"C:\Users\86198\.zcode\cli\image-cache\sess_b54093ca-8321-4231-8d5d-8d526b0e04cb"
OUT = r"C:\Users\86198\.zcode\workspace\default\cute-face-grid\objects"

OBJECTS = [
    ("image-6c9e4363b3f32c89e4eeefb37353daff.png", "starfruit"),
    ("image-fce08717ce9db108462a0ad2ec3fc88a.png", "blueberry"),
    ("image-64f665d87c50b237a8024b6330251d9e.png", "cat-popsicle"),
    ("image-e99b1cbf8922a927865c5ccc86271d2b.png", "pudding-pink"),
    ("image-f939c623721b2054397e64f011f229db.png", "green-jelly"),
]

TOL = 30


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
    q = im.quantize(colors=256, method=Image.FASTOCTREE, dither=Image.FLOYDSTEINBERG)
    out = os.path.join(OUT, name + ".png")
    q.save(out, optimize=True)
    print(f"{name}.png  {im.size[0]}x{im.size[1]}  {os.path.getsize(out)//1024}KB")
