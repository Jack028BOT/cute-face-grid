"""生成萌系贴贴小工具图标：蓝底白波点 + 白柔光纸杯蛋糕 + ·ω· 表情。"""
import os
from PIL import Image, ImageDraw, ImageFilter, ImageFont

TOOL = r"C:\Users\86198\.zcode\workspace\default\cute-face-grid"
PREVIEW = r"C:\Users\86198\.zcode\workspace\default\preview"
S = 512
R = 100  # 圆角半径

# ---- 底：蓝色 + 白色错位波点 ----
bg = Image.new("RGBA", (S, S), (71, 177, 240, 255))
d = ImageDraw.Draw(bg)
step = 96
r = int(step * 0.24)
row = 0
y = -step // 2
while y < S + step:
    off = (step // 2) if row % 2 else 0
    x = -step // 2 + off
    while x < S + step:
        d.ellipse((x - r, y - r, x + r, y + r), fill=(255, 255, 255, 255))
        x += step
    y += step
    row += 1

# ---- 纸杯蛋糕抠图 ----
cake = Image.open(os.path.join(TOOL, "objects", "cupcake.png")).convert("RGBA")
# 量化图残留中值 alpha 会形成杂边，二值化：>=128 保留，其余全透
cake.putalpha(cake.split()[3].point(lambda v: 255 if v >= 128 else 0))
target = int(S * 0.66)
sc = target / max(cake.size)
cake = cake.resize((int(cake.width * sc), int(cake.height * sc)), Image.LANCZOS)

# 白色柔光：剪影加足 padding 再模糊，避免边界钳制形成矩形亮边
PAD = 80
sil = Image.new("RGBA", (cake.width + PAD * 2, cake.height + PAD * 2), (0, 0, 0, 0))
sil.paste((255, 255, 255, 255), (PAD, PAD), cake.split()[3])
cx, cy = S // 2, int(S * 0.56)
pos = (cx - cake.width // 2, cy - cake.height // 2)
glow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
for blur, alpha in [(30, 190), (16, 220), (7, 255)]:
    layer = sil.filter(ImageFilter.GaussianBlur(blur))
    layer.putalpha(layer.split()[3].point(lambda v: min(v, alpha)))
    glow.alpha_composite(layer, (pos[0] - PAD, pos[1] - PAD))
bg.alpha_composite(glow)
bg.alpha_composite(cake, pos)

# ---- ·ω· 表情 ----
font = ImageFont.truetype(r"C:\Windows\Fonts\arialbd.ttf", 118)
text = "·ω·"
td = ImageDraw.Draw(bg)
tw = td.textlength(text, font=font)
tx = cx - tw / 2
ty = cy - 30
for dx, dy in [(-3, 0), (3, 0), (0, -3), (0, 3)]:
    td.text((tx + dx, ty + dy), text, font=font, fill=(255, 255, 255, 220))
td.text((tx, ty), text, font=font, fill=(17, 17, 17, 255))

# ---- 圆角裁切 ----
mask = Image.new("L", (S, S), 0)
ImageDraw.Draw(mask).rounded_rectangle((0, 0, S - 1, S - 1), R, fill=255)
out = Image.new("RGBA", (S, S), (0, 0, 0, 0))
out.paste(bg, (0, 0), mask)

out.save(os.path.join(PREVIEW, "icon-v2.png"))
print("icon-v2 saved")
