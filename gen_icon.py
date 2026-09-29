# -*- coding: utf-8 -*-
"""生成错题本应用图标：蓝色圆角底 + 白色书本 + 绿色对勾"""
import os
from PIL import Image, ImageDraw


def make_icon(size):
    s = size
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # 圆角蓝色背景
    m = int(s * 0.04)
    r = int(s * 0.20)
    d.rounded_rectangle([m, m, s - m, s - m], radius=r, fill=(51, 85, 224, 255))

    # 打开的书本（两页）
    cx = s * 0.5
    top = s * 0.30
    bot = s * 0.72
    left = s * 0.20
    right = s * 0.80
    page_top = s * 0.40
    page_bot = s * 0.68
    spine = int(s * 0.018)

    # 左页（白）
    d.polygon([(cx, top), (left, page_top), (left, page_bot), (cx, bot)], fill=(255, 255, 255, 255))
    # 右页（浅蓝）
    d.polygon([(cx, top), (right, page_top), (right, page_bot), (cx, bot)], fill=(226, 233, 255, 255))
    # 书脊
    d.line([(cx, top), (cx, bot)], fill=(41, 66, 173, 255), width=spine)
    # 封面底线
    d.line([(left, page_top), (right, page_top)], fill=(41, 66, 173, 255), width=int(s * 0.012))
    d.line([(left, page_bot), (right, page_bot)], fill=(41, 66, 173, 255), width=int(s * 0.012))

    # 绿色对勾（叠在书上，表示"错题→掌握"）
    gx1 = cx - s * 0.115
    gy1 = s * 0.53
    gx2 = cx - s * 0.005
    gy2 = s * 0.62
    gx3 = cx + s * 0.14
    gy3 = s * 0.405
    w = max(6, int(s * 0.042))
    d.line([(gx1, gy1), (gx2, gy2), (gx3, gy3)], fill=(34, 197, 94, 255), width=w, joint="curve")

    return img


def main():
    out_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "icons")
    os.makedirs(out_dir, exist_ok=True)
    for size in (512, 192):
        img = make_icon(size)
        path = os.path.join(out_dir, f"icon-{size}.png")
        img.save(path)
        print(f"已生成 {path}")


if __name__ == "__main__":
    main()
