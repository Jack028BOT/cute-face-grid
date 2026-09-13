#!/usr/bin/env python3
"""扫描 cute-face-grid/{stickers,bg,objects}，重新生成 assets.js 素材清单。

用法：python gen-cute-face-grid-manifest.py
"""
import os

ROOT = os.path.dirname(os.path.abspath(__file__))
TOOL = os.path.join(ROOT, "cute-face-grid")
ALLOWED = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"}


def scan(sub):
    d = os.path.join(TOOL, sub)
    if not os.path.isdir(d):
        return []
    files = []
    for name in sorted(os.listdir(d)):
        base, ext = os.path.splitext(name)
        if ext.lower() not in ALLOWED:
            print(f"[跳过] 非白名单类型：{sub}/{name}")
            continue
        if not base.isascii() or not base.replace("-", "").replace("_", "").isalnum():
            print(f"[警告] 文件名建议使用英文数字/连字符：{sub}/{name}")
        files.append(f"./{sub}/{name}")
    return files


def main():
    stickers = scan("stickers")
    bgs = scan("bg")
    objects = scan("objects")
    lines = [
        "// 素材清单（由 gen-cute-face-grid-manifest.py 自动扫描生成，请勿手工编辑）",
        "// 预置表情放入 stickers/，底图放入 bg/，主体抠图放入 objects/，重新运行本脚本并打包即可。",
        "window.MTG_ASSETS = {",
        f"  stickers: {stickers!r},".replace("'", '"'),
        f"  backgrounds: {bgs!r},".replace("'", '"'),
        f"  objects: {objects!r}".replace("'", '"'),
        "};",
        "",
    ]
    out = os.path.join(TOOL, "assets.js")
    with open(out, "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(lines))
    print(
        f"已生成 {out}（stickers: {len(stickers)}, backgrounds: {len(bgs)}, objects: {len(objects)}）"
    )


if __name__ == "__main__":
    main()
