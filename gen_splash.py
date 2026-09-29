# -*- coding: utf-8 -*-
"""生成 iPhone PWA 启动画面（splash screen），让安装后像原生 App 一样有开屏页"""
import os
from PIL import Image, ImageDraw, ImageFont

BASE = os.path.dirname(os.path.abspath(__file__))
ICON = os.path.join(BASE, "icons", "icon-512.png")

BG = (244, 245, 248, 255)
TITLE = "错题本"
SUB = "高中政治 · 考编"

# (CSS宽, CSS高, 倍率) -> 实际像素
DEVICES = [
    (390, 844, 3),   # iPhone 12/13/14
    (393, 852, 3),   # iPhone 14 Pro/15/16
    (430, 932, 3),   # iPhone 14 Pro Max/15 Plus
    (414, 896, 2),   # iPhone 11/XR
    (375, 667, 2),   # iPhone SE2/8/7
    (375, 812, 3),   # iPhone X/XS/11 Pro
]


def font(size, bold=True):
    paths = [
        "C:/Windows/Fonts/msyhbd.ttc" if bold else "C:/Windows/Fonts/msyh.ttc",
        "C:/Windows/Fonts/msyh.ttc",
        "C:/Windows/Fonts/simhei.ttf",
    ]
    for p in paths:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                continue
    return ImageFont.load_default()


def make_splash(w, h, path):
    img = Image.new("RGB", (w, h), BG[:3])
    d = ImageDraw.Draw(img)

    # 居中图标
    icon_size = int(w * 0.30)
    icon = Image.open(ICON).convert("RGBA").resize((icon_size, icon_size), Image.LANCZOS)
    ix = (w - icon_size) // 2
    iy = int(h * 0.40) - icon_size // 2
    img.paste(icon, (ix, iy), icon)

    # 标题
    f_title = font(int(w * 0.085), bold=True)
    tb = d.textbbox((0, 0), TITLE, font=f_title)
    tw = tb[2] - tb[0]
    ty = iy + icon_size + int(h * 0.030)
    d.text(((w - tw) // 2, ty), TITLE, font=f_title, fill=(31, 36, 48))

    # 副标题
    f_sub = font(int(w * 0.042), bold=False)
    sb = d.textbbox((0, 0), SUB, font=f_sub)
    sw = sb[2] - sb[0]
    sy = ty + (tb[3] - tb[1]) + int(h * 0.012)
    d.text(((w - sw) // 2, sy), SUB, font=f_sub, fill=(130, 138, 152))

    img.save(path)
    return path


def main():
    out_dir = os.path.join(BASE, "splash")
    os.makedirs(out_dir, exist_ok=True)
    links = []
    for cw, ch, ratio in DEVICES:
        w, h = cw * ratio, ch * ratio
        name = f"splash-{w}x{h}.png"
        make_splash(w, h, os.path.join(out_dir, name))
        links.append(
            f'  <link rel="apple-touch-startup-image" '
            f'media="screen and (device-width: {cw}px) and (device-height: {ch}px) '
            f'and (-webkit-device-pixel-ratio: {ratio})" href="splash/{name}">'
        )
        print(f"generated {name}")
    print("\n".join(links))


if __name__ == "__main__":
    main()
