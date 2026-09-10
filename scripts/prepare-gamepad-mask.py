"""Preserve real gamepad button surfaces; leave connected table-white paintable."""
from collections import deque
import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image

APP = Path(__file__).resolve().parents[1]
source = APP / 'public/interaction/gamepad/background.png'
target = APP / 'public/device-skins/v1/masks/gamepad-exclusion.png'
pixels = np.array(Image.open(source).convert('RGBA'))
height, width = pixels.shape[:2]
white = (pixels[:, :, :3].min(axis=2) >= 245) & (pixels[:, :, 3] > 240)
open_table = np.zeros((height, width), dtype=bool)
queue = deque()
for y in range(height):
    for x in range(width):
        if (x == 0 or x == width-1 or y == height-1) and y+176 > 331+x*113/612 and white[y, x]:
            open_table[y, x] = True; queue.append((x, y))
while queue:
    x, y = queue.popleft()
    for nx, ny in [(x-1, y), (x+1, y), (x, y-1), (x, y+1)]:
        if 0 <= nx < width and 0 <= ny < height and white[ny, nx] and not open_table[ny, nx]:
            open_table[ny, nx] = True; queue.append((nx, ny))
# RGB black removes these pixels from DeskSurface's luminance mask. Original
# dark outlines and genuinely enclosed white caps are protected, without any
# dilation/polygons that would leave rectangular table-colored omissions.
protected = (pixels[:, :, 3] > 0) & ~open_table
mask = np.zeros_like(pixels)
mask[:, :, 3] = np.where(protected, 255, 0)
target.parent.mkdir(parents=True, exist_ok=True)
Image.fromarray(mask).save(target)
report = {'sourceSHA256': hashlib.sha256(source.read_bytes()).hexdigest(),
          'maskSHA256': hashlib.sha256(target.read_bytes()).hexdigest(),
          'size': [width, height], 'sceneOffset': [0, 176],
          'protectedPixels': int(protected.sum()), 'enclosedWhitePixels': int((white & protected).sum()),
          'connectedTableWhitePixels': int(open_table.sum()),
          'protectedConnectedTableWhitePixels': int((protected & open_table).sum()),
          'method': 'Border flood fill of source near-white table; preserve original ink and closed white button regions. No inferred controller shell, no expanded polygon.'}
qa = APP.parent / 'research/wardrobe-v1.7/integrated-device-review'
qa.mkdir(parents=True, exist_ok=True)
(qa / 'gamepad-mask.json').write_text(json.dumps(report, indent=2)+'\n')
print(json.dumps(report, indent=2))
