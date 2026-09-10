"""Reproduce the shared interaction assets without modifying upstream originals.

Requires Pillow. Run from any directory with python3 scripts/prepare-interaction-assets.py.
"""
from collections import deque
import json
from pathlib import Path
import shutil

from PIL import Image, ImageChops, ImageDraw

APP = Path(__file__).resolve().parents[1]
SOURCE = APP / 'src-tauri/assets/models'
OUTPUT = APP / 'public/interaction'
PARTS = {
    'face': (485, 22, 854, 250),
    'eye-left': (405, 29, 430, 56),
    'eye-right': (466, 35, 491, 65),
    'paw-down': (321, 61, 433, 202),
    'paw-up': (852, 111, 951, 217),
    'mouse': (254, 201, 349, 289),
    'mouse-left-glow': (348, 220, 418, 277),
    'mouse-right-glow': (423, 220, 469, 286),
}


def keep_largest_alpha_island(image):
    alpha = image.getchannel('A')
    pixels = alpha.load()
    width, height = image.size
    visited, groups = set(), []
    for y in range(height):
        for x in range(width):
            if (x, y) in visited or pixels[x, y] == 0:
                continue
            pending, group = deque([(x, y)]), []
            visited.add((x, y))
            while pending:
                cx, cy = pending.popleft()
                group.append((cx, cy))
                for nx, ny in [(cx - 1, cy), (cx + 1, cy), (cx, cy - 1), (cx, cy + 1)]:
                    if 0 <= nx < width and 0 <= ny < height and (nx, ny) not in visited and pixels[nx, ny] > 0:
                        visited.add((nx, ny))
                        pending.append((nx, ny))
            groups.append(group)
    for group in sorted(groups, key=len, reverse=True)[1:]:
        for x, y in group:
            pixels[x, y] = 0
    image.putalpha(alpha)


def main():
    mappings = {}
    for mode in ['standard', 'keyboard', 'gamepad']:
        source = SOURCE / mode / 'resources'
        target = OUTPUT / mode
        shutil.copytree(source, target, dirs_exist_ok=True)
        mappings[mode] = {}
        for side in ['left', 'right']:
            keys = sorted((source / (side + '-keys')).glob('*.png'))
            mappings[mode][side] = [key.stem for key in keys]
            glow_directory = target / (side + '-glows')
            glow_directory.mkdir(exist_ok=True)
            for key in keys:
                image = Image.open(key).convert('RGBA')
                glow = Image.new('RGBA', image.size)
                glow.putdata([
                    (r, g, b, a if g > 100 and b > 100 and r < 170 and min(g - r, b - r) > 45 else 0)
                    for r, g, b, a in image.getdata()
                ])
                glow.save(glow_directory / key.name)
    atlas_path = SOURCE / 'standard/demomodel.1024/texture_00.png'
    atlas = Image.open(atlas_path)
    target = OUTPUT / 'original'
    target.mkdir(exist_ok=True)
    for name, bounds in PARTS.items():
        image = atlas.crop(bounds)
        if name == 'face':
            keep_largest_alpha_island(image)
        if name == 'paw-up':
            mask = Image.new('L', image.size, 0)
            ImageDraw.Draw(mask).polygon([(0, 0), (99, 0), (99, 86), (85, 91), (69, 106), (0, 106)], fill=255)
            image.putalpha(ImageChops.multiply(image.getchannel('A'), mask))
        image.save(target / (name + '.png'))
    (target / 'provenance.json').write_text(json.dumps({
        'source': 'src-tauri/assets/models/standard/demomodel.1024/texture_00.png',
        'parts': PARTS,
        'faceCleanup': 'Keep the largest connected alpha island; discard a neighboring UV fragment.',
        'pawUpCleanup': 'Clip the atlas UV region to its paw mesh contour.',
        'glows': 'Keep original RGBA cyan pixels where g>100, b>100, r<170 and min(g-r,b-r)>45.',
        'originalResources': 'All backgrounds, covers, and complete per-key PNGs are copied byte-for-byte.',
    }, indent=2) + '\n')
    (APP / 'src/components/wizard-pet/interaction-assets.ts').write_text(
        "export type InteractionMode = 'standard' | 'keyboard' | 'gamepad' | 'trackpad'\n\n"
        + 'export const interactionKeys = ' + json.dumps(mappings, indent=2) + ' as const\n'
    )


if __name__ == '__main__':
    main()
