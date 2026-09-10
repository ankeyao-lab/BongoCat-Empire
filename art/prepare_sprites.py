"""Reproducible, non-destructive matte extraction, explicitly approved by Harry.

Source art stays untouched. Only edge-connected neutral background and reviewed
enclosed background regions are removed; white faces and ivory garments remain.
"""
from pathlib import Path
import json
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

ROOT = Path(__file__).resolve().parent
DEST = ROOT.parent / 'public' / 'wizard' / 'sprites'
DEST.mkdir(parents=True, exist_ok=True)
report = []
previews = []

for level in range(1, 10):
    src = Image.open(ROOT / 'source' / f'{level:02}.png').convert('RGB')
    rgb = np.asarray(src).astype(np.float32)
    neutral = (rgb.min(axis=2) >= (235 if level in (1, 3) else 241)) & ((np.ptp(rgb, axis=2) <= 13) | (level == 3))
    labels, count = ndimage.label(neutral)
    edge_ids = np.unique(np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]]))
    edge_ids = edge_ids[edge_ids != 0]
    remove = np.isin(labels, edge_ids)
    # Closed holes in the final halo; coordinates reviewed against the source.
    seeds = {9: [(640, 150), (946, 407)]}.get(level, [])
    for x, y in seeds:
        region = labels[y, x]
        if region:
            remove |= labels == region
    if level == 6:
        # Reviewed empty spaces in the orbital arc and the open astrolabe cage.
        for region in [2, 4, 10, 11, 15, 17, 18, 22, 27, 28]:
            remove |= labels == region
    # The retained silhouette is antialiased into the adjacent matte boundary.
    solid = ~remove
    alpha = np.where(solid, 255, 0).astype(np.uint8)
    edge = remove & ndimage.binary_dilation(solid)
    contrast = 255 - rgb.min(axis=2)
    alpha[edge] = np.clip(contrast[edge] * 2, 0, 180).astype(np.uint8)
    # Normalize garment baseline, so every costume meets the same animated paws.
    ys, xs = np.nonzero(alpha > 190)
    bottom = int(ys.max())
    offset = 1044 - bottom
    rgba = np.dstack([rgb.astype(np.uint8), alpha])
    # Decontaminate the 1 px antialiased edge from its original white matte.
    core = solid & (rgb.min(axis=2) < 205)
    distance, nearest = ndimage.distance_transform_edt(~core, return_indices=True)
    boundary = (ndimage.distance_transform_edt(solid) <= 1.5) & (distance <= 3) & (alpha > 0)
    foreground = rgb[nearest[0], nearest[1]]
    numerator = np.sum((255 - rgb) * (255 - foreground), axis=2)
    denominator = np.maximum(1, np.sum((255 - foreground) ** 2, axis=2))
    coverage = np.clip(numerator / denominator, 0, 1)
    rgba[boundary, :3] = foreground[boundary].astype(np.uint8)
    rgba[boundary, 3] = np.minimum(alpha[boundary], coverage[boundary] * 255).astype(np.uint8)
    sprite = Image.fromarray(rgba, 'RGBA')
    aligned = Image.new('RGBA', src.size)
    aligned.alpha_composite(sprite, (0, offset))
    aligned.save(DEST / f'{level:02}.png', optimize=True)
    regions = []
    sizes = np.bincount(labels.ravel())
    for region in range(1, count + 1):
        if sizes[region] > 200 and not np.any(remove[labels == region]):
            yy, xx = np.nonzero(labels == region)
            regions.append({'id': region, 'area': int(sizes[region]), 'xy': [int(xx.mean()), int(yy.mean())], 'bbox': [int(xx.min()), int(yy.min()), int(xx.max()), int(yy.max())]})
    report.append({'level': level, 'offsetY': offset, 'transparentPixels': int((np.asarray(aligned)[:, :, 3] == 0).sum()), 'retainedWhiteRegions': regions})
    tile = Image.new('RGBA', src.size, '#292533')
    tile.alpha_composite(aligned)
    previews.append(tile.convert('RGB').resize((400, 400)))

board = Image.new('RGB', (1200, 1200), '#292533')
draw = ImageDraw.Draw(board)
for i, tile in enumerate(previews):
    x, y = i % 3 * 400, i // 3 * 400
    board.paste(tile, (x, y))
    draw.text((x + 8, y + 8), f'LV.{i + 1}', fill='white')
board.save(ROOT / 'sprites-dark-review.jpg', quality=94)
(ROOT / 'alpha-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
print(json.dumps(report, ensure_ascii=False, indent=2))
