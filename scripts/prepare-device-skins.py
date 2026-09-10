"""Derive registered masks/ink from original devices, and crop the imagegen atlas.

Original interaction assets are read-only. New output lives in public/device-skins/v1.
Run from any directory; requires Pillow and NumPy.
"""
from collections import deque
import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

APP = Path(__file__).resolve().parents[1]
ROOT = APP.parent
OUTPUT = APP / 'public/device-skins/v1'
RESEARCH = ROOT / 'research/wardrobe-v1.7'
SOURCE = APP / 'public/interaction'
W, H = 612, 354


def components(mask):
    seen = np.zeros(mask.shape, dtype=bool)
    result = []
    for y, x in zip(*np.where(mask)):
        if seen[y, x]:
            continue
        queue = deque([(int(x), int(y))])
        seen[y, x] = True
        points = []
        while queue:
            xx, yy = queue.popleft()
            points.append((xx, yy))
            for nx, ny in [(xx-1, yy), (xx+1, yy), (xx, yy-1), (xx, yy+1)]:
                if 0 <= nx < mask.shape[1] and 0 <= ny < mask.shape[0] and mask[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True
                    queue.append((nx, ny))
        result.append(points)
    return sorted(result, key=len, reverse=True)


def fill_holes(mask):
    inverse = ~mask
    outside = np.zeros_like(mask)
    queue = deque()
    for y in range(mask.shape[0]):
        for x in [0, mask.shape[1]-1]:
            if inverse[y, x] and not outside[y, x]:
                queue.append((x, y)); outside[y, x] = True
    for x in range(mask.shape[1]):
        for y in [0, mask.shape[0]-1]:
            if inverse[y, x] and not outside[y, x]:
                queue.append((x, y)); outside[y, x] = True
    while queue:
        x, y = queue.popleft()
        for nx, ny in [(x-1, y), (x+1, y), (x, y-1), (x, y+1)]:
            if 0 <= nx < mask.shape[1] and 0 <= ny < mask.shape[0] and inverse[ny, nx] and not outside[ny, nx]:
                outside[ny, nx] = True; queue.append((nx, ny))
    return ~outside


def point_mask(points):
    mask = np.zeros((H, W), dtype=bool)
    for x, y in points:
        mask[y, x] = True
    return mask


def save_mask(name, mask):
    rgba = np.full((H, W, 4), 255, dtype=np.uint8)
    rgba[:, :, 3] = mask.astype(np.uint8) * 255
    Image.fromarray(rgba).save(OUTPUT / 'masks' / name)


def write_ink(name, pixels, mask):
    # Original dark glyph pixels remain exact; gray antialias becomes black
    # coverage on the new material. Gray chassis shading is retained softly.
    luminance = np.round(pixels[:, :, :3].astype(float).mean(axis=2)).astype(np.uint8)
    ink = np.zeros_like(pixels)
    ink[:, :, 3] = np.where(mask, 255-luminance, 0)
    dark = mask & (luminance <= 80)
    ink[dark] = pixels[dark]
    Image.fromarray(ink).save(OUTPUT / 'masks' / name)
    return int(dark.sum())


def main():
    (OUTPUT / 'masks').mkdir(parents=True, exist_ok=True)
    (OUTPUT / 'wizard/materials').mkdir(parents=True, exist_ok=True)
    RESEARCH.mkdir(parents=True, exist_ok=True)
    atlas_path = ROOT / 'proposal/device-skins-v1/wizard/source/material-atlas.png'
    atlas = Image.open(atlas_path).convert('RGB')
    aw, ah = atlas.size
    crops = {'wood': (0, 0, aw//2, ah//2), 'ivory': (aw//2, 0, aw, ah//2),
             'crystal': (0, ah//2, aw//2, ah), 'gold': (aw//2, ah//2, aw, ah)}
    for name, bounds in crops.items():
        atlas.crop(bounds).save(OUTPUT / f'wizard/materials/{name}.png')

    y, x = np.indices((H, W))
    report = {'sourceAtlasSHA256': hashlib.sha256(atlas_path.read_bytes()).hexdigest(),
              'sourceAtlasSize': list(atlas.size), 'cropBounds': crops,
              'registration': {'size': [612, 354], 'sceneOffset': [0, 176], 'parentOffsetY': 36},
              'devices': {}, 'perKeyOverlays': {}}
    for mode in ['standard', 'keyboard']:
        source_file = SOURCE / mode / 'background.png'
        pixels = np.array(Image.open(source_file).convert('RGBA'))
        minimum = pixels[:, :, :3].min(axis=2)
        below_table = y > 150+x*113/612+5
        solid = (pixels[:, :, 3] > 64) & (minimum < 245) & below_table
        groups = components(solid)
        keyboard_points = next(points for points in groups if len(points) > 1000 and min(p[0] for p in points) > 200)
        shell = fill_holes(point_mask(keyboard_points))
        # Fill source-white key interiors including their enclosed glyph holes.
        keys = np.zeros_like(shell)
        key_regions = []
        for points in components(shell & (minimum >= 245)):
            if len(points) >= 18:
                key_regions.append(len(points))
                keys |= fill_holes(point_mask(points))
        # The 612px source contains gray antialiasing and small labels touching
        # their key borders. A threshold of white pixels creates purple holes in
        # those letters. Use one light key deck under ALL original key outlines,
        # including their antialias area; the original ink restores every gap.
        side = shell & (y > 278+(x-222)*0.274)
        keys = (np.array(Image.fromarray(shell.astype(np.uint8)*255).filter(ImageFilter.MinFilter(5))) > 0) & ~side
        save_mask(f'{mode}-keyboard-shell.png', shell)
        save_mask(f'{mode}-keyboard-keycaps.png', keys)
        save_mask(f'{mode}-keyboard-side.png', side)
        ink_pixels = write_ink(f'{mode}-keyboard-ink.png', pixels, shell)
        report['devices'][mode] = {'backgroundSHA256': hashlib.sha256(source_file.read_bytes()).hexdigest(),
            'shellPixels': int(shell.sum()), 'keycapPixels': int(keys.sum()), 'keycapRegions': len(key_regions),
            'sidePixels': int(side.sum()), 'exactDarkInkPixels': ink_pixels}
        if mode == 'standard':
            pad_points = next(points for points in groups if len(points) > 1000 and min(p[0] for p in points) == 0)
            pad = fill_holes(point_mask(pad_points))
            save_mask('standard-pad.png', pad)
        else:
            arrows = np.zeros_like(shell)
            for points in groups:
                if len(points) >= 100 and max(p[0] for p in points) < 265:
                    arrows |= fill_holes(point_mask(points))
            save_mask('keyboard-arrows.png', arrows)
            write_ink('keyboard-arrows-ink.png', pixels, arrows)
            report['devices'][mode]['arrowPixels'] = int(arrows.sum())

    # Audit every original pressed overlay and produce contact sheets for visual review.
    for mode in ['standard', 'keyboard', 'gamepad']:
        files = sorted((SOURCE / mode).glob('*-keys/*.png'))
        sheet = Image.new('RGB', (960, ((len(files)+7)//8)*112), '#292630')
        draw = ImageDraw.Draw(sheet)
        rows = []
        for index, file_path in enumerate(files):
            picture = Image.open(file_path).convert('RGBA')
            p = np.array(picture); pi = p.astype(int)
            cyan = (pi[:, :, 1] > 100) & (pi[:, :, 2] > 100) & (pi[:, :, 0] < 170) & (np.minimum(pi[:, :, 1]-pi[:, :, 0], pi[:, :, 2]-pi[:, :, 0]) > 45) & (p[:, :, 3] > 0)
            glow = np.array(Image.open(file_path.parent.parent / file_path.parent.name.replace('-keys', '-glows') / file_path.name).convert('RGBA'))
            glow_ok = np.array_equal(glow[:, :, 3], np.where(cyan, p[:, :, 3], 0))
            crop = picture.crop(picture.getbbox()); crop.thumbnail((112, 86))
            sx, sy = (index % 8)*120, (index//8)*112
            sheet.paste(crop, (sx+(120-crop.width)//2, sy), crop)
            draw.text((sx+3, sy+89), file_path.stem, fill='white')
            rows.append({'key': file_path.stem, 'side': file_path.parent.name,
                'opaquePixels': int((p[:, :, 3] == 255).sum()), 'cyanPixels': int(cyan.sum()),
                'bounds': picture.getbbox(), 'derivedGlowExact': bool(glow_ok)})
        sheet.save(RESEARCH / f'key-overlays-{mode}.png')
        report['perKeyOverlays'][mode] = rows
    (RESEARCH / 'device-mask-audit.json').write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n')
    print(json.dumps({'devices': report['devices'], 'keys': {mode: len(rows) for mode, rows in report['perKeyOverlays'].items()},
                     'derivedGlowsExact': all(row['derivedGlowExact'] for rows in report['perKeyOverlays'].values() for row in rows)}, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
