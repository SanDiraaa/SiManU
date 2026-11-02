/**
 * Script ini juga tersedia dalam versi Python di bawah untuk kemudahan eksekusi otomatis.
 */
import os
from PIL import Image, ImageDraw

os.makedirs('icons', exist_ok=True)

BG_COLOR = (15, 23, 42, 255)       # #0f172a
CARD_COLOR = (30, 41, 59, 255)     # #1e293b
EMERALD_COLOR = (16, 185, 129, 255)# #10b981
TEXT_WHITE = (248, 250, 252, 255)  # #f8fafc
TEXT_MUTED = (148, 163, 184, 255)  # #94a3b8

def generate_icon(size, filename):
    img = Image.new('RGBA', (size, size), BG_COLOR)
    draw = ImageDraw.Draw(img)
    
    safe_margin = int(size * 0.15)
    r = int(size * 0.16)
    
    draw.rounded_rectangle(
        [safe_margin, safe_margin, size - safe_margin, size - safe_margin],
        radius=r,
        fill=CARD_COLOR,
        outline=EMERALD_COLOR,
        width=max(2, size // 40)
    )
    
    w_left = int(size * 0.26)
    w_top = int(size * 0.32)
    w_right = int(size * 0.74)
    w_bottom = int(size * 0.68)
    draw.rounded_rectangle(
        [w_left, w_top, w_right, w_bottom],
        radius=int(size * 0.08),
        fill=EMERALD_COLOR
    )
    
    flap_cx = int(size * 0.62)
    flap_cy = int(size * 0.50)
    fr = max(4, int(size * 0.05))
    draw.ellipse([flap_cx - fr, flap_cy - fr, flap_cx + fr, flap_cy + fr], fill=TEXT_WHITE)
    
    img.save(filename, 'PNG')
    print(f'Generated {filename}')

def generate_screenshots():
    # Mobile
    w, h = 540, 960
    img = Image.new('RGBA', (w, h), BG_COLOR)
    draw = ImageDraw.Draw(img)
    draw.rectangle([0, 0, w, 60], fill=(24, 33, 47, 255))
    draw.rounded_rectangle([20, 16, 48, 44], radius=8, fill=EMERALD_COLOR)
    draw.rounded_rectangle([20, 80, w - 20, 240], radius=20, fill=CARD_COLOR, outline=(51, 65, 85, 255), width=2)
    draw.rounded_rectangle([20, 260, 255, 315], radius=14, fill=EMERALD_COLOR)
    draw.rounded_rectangle([285, 260, w - 20, 315], radius=14, fill=(225, 29, 72, 255))
    for i in range(4):
        y = 350 + i * 85
        draw.rounded_rectangle([20, y, w - 20, y + 70], radius=16, fill=CARD_COLOR)
    draw.rectangle([0, h - 70, w, h], fill=(15, 23, 42, 255), outline=(51, 65, 85, 255), width=1)
    img.save('icons/screenshot-mobile.png', 'PNG')
    print('Generated icons/screenshot-mobile.png')

    # Desktop
    dw, dh = 1280, 720
    dimg = Image.new('RGBA', (dw, dh), (10, 15, 30, 255))
    ddraw = ImageDraw.Draw(dimg)
    mw, mh = 380, 680
    mx = (dw - mw) // 2
    my = (dh - mh) // 2
    ddraw.rounded_rectangle([mx - 4, my - 4, mx + mw + 4, my + mh + 4], radius=24, fill=(51, 65, 85, 255))
    ddraw.rounded_rectangle([mx, my, mx + mw, my + mh], radius=20, fill=BG_COLOR)
    ddraw.rounded_rectangle([mx + 15, my + 60, mx + mw - 15, my + 180], radius=16, fill=CARD_COLOR)
    dimg.save('icons/screenshot-desktop.png', 'PNG')
    print('Generated icons/screenshot-desktop.png')

if __name__ == '__main__':
    generate_icon(192, 'icons/icon-192.png')
    generate_icon(512, 'icons/icon-512.png')
    generate_icon(512, 'icons/icon-maskable.png')
    generate_screenshots()

