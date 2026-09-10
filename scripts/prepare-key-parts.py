"""Partition original pressed PNGs into immutable-color paws and key surfaces.

Writes only public/interaction-separated. No input source, mapping or UI changes.
Metadata anchors are STAGE coordinates (include source image y=176).
"""
import hashlib
import importlib.util
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

APP = Path(__file__).resolve().parents[1]
ROOT = APP.parent
SOURCE = APP / 'public/interaction'
OUTPUT = APP / 'public/interaction-separated'
QA = ROOT / 'research/wardrobe-v1.7/key-parts'
spec = importlib.util.spec_from_file_location('device_mask_tools', Path(__file__).with_name('prepare-device-skins.py'))
helper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helper)


def dilate(mask, radius):
    return np.array(Image.fromarray(mask.astype(np.uint8)*255).filter(ImageFilter.MaxFilter(radius*2+1))) > 0


def bounds(mask):
    yy, xx = np.where(mask)
    return [int(xx.min()), int(yy.min()), int(xx.max()+1-xx.min()), int(yy.max()+1-yy.min())]


def main():
    QA.mkdir(parents=True, exist_ok=True)
    report = {'schemaVersion': 1, 'sourceSize': [612, 354], 'sourceStageOffset': [0, 176],
        'coordinateContract': 'bbox and whiteCoreBBox are source [x,y,width,height]; anchorY and contactY include +176 and are stage coordinates. Uniform device translation belongs only on pressed-surface. Paw y mapping fixes anchorY and adds deviceOffsetY at contactY.',
        'method': 'Keep all original RGBA visible pixels exactly once. Cyan belongs to surface; the main non-cyan component containing the largest white paw owns its original black outline. Small separate white glyphs beside cyan belong to surface. Any remaining original fringe is assigned, never erased.',
        'entries': {}}
    selected = {'standard': ['KeyQ', 'KeyA', 'Space', 'Shift', 'Return'], 'keyboard': ['KeyQ', 'KeyA', 'Space', 'RightArrow', 'LeftArrow'], 'gamepad': ['South', 'East', 'DPadDown', 'LeftTrigger2']}
    review_rows = []
    for mode in ['standard', 'keyboard', 'gamepad']:
        for file_path in sorted((SOURCE / mode).glob('*-keys/*.png')):
            rgba = np.array(Image.open(file_path).convert('RGBA')); rgb = rgba[:, :, :3].astype(int)
            visible = rgba[:, :, 3] > 0
            cyan = visible & (rgb[:, :, 1] > 100) & (rgb[:, :, 2] > 100) & (rgb[:, :, 0] < 170) & (np.minimum(rgb[:, :, 1]-rgb[:, :, 0], rgb[:, :, 2]-rgb[:, :, 0]) > 45)
            whites = helper.components((rgb.min(axis=2) > 180) & (rgba[:, :, 3] > 64))
            core = helper.point_mask(whites[0])
            noncyan_groups = helper.components(visible & ~cyan)
            main_paw = next(helper.point_mask(group) for group in noncyan_groups if any(core[y, x] for x, y in group))
            near_blue = dilate(cyan, 4)
            cyan_fringe = near_blue & (np.minimum(rgb[:, :, 1]-rgb[:, :, 0], rgb[:, :, 2]-rgb[:, :, 0]) > 3) & (np.maximum(rgb[:, :, 1], rgb[:, :, 2]) > 70)
            glyphs = np.zeros_like(visible)
            close_blue = dilate(cyan, 1)
            for group in whites[1:]:
                if any(close_blue[y, x] for x, y in group):
                    glyphs |= helper.point_mask(group)
            glyphs = dilate(glyphs, 1) & ~dilate(core, 2) & near_blue
            # A few source key-border antialias pixels are connected to the
            # paw through one dark pixel. They lie beyond its 9px outline band
            # and must follow the key surface, rather than stretch as a stray arc.
            key_border = near_blue & ~dilate(core, 9)
            # Original pressed paws are white/gray/black; unlike paw-up atlas
            # they contain no pink pads. Dark cyan edge pixels can be RGB21/68/67
            # and fail a brightness test. Assign every non-neutral visible color
            # to the key surface, without a brightness threshold.
            chromatic = (rgb.max(axis=2)-rgb.min(axis=2)) > 1
            surface_mask = visible & (cyan | cyan_fringe | chromatic | (near_blue & ~main_paw) | glyphs | key_border)
            paw_mask = visible & ~surface_mask
            paw = rgba.copy(); paw[:, :, 3] = np.where(paw_mask, rgba[:, :, 3], 0)
            surface = rgba.copy(); surface[:, :, 3] = np.where(surface_mask, rgba[:, :, 3], 0)
            # Some image previews expose RGB hidden below alpha zero. Clear that
            # invisible data so even those previews cannot show a blue key in paw.
            paw[paw[:, :, 3] == 0, :3] = 0
            surface[surface[:, :, 3] == 0, :3] = 0
            side = file_path.parent.name.removesuffix('-keys')
            paw_file = OUTPUT / mode / f'{side}-paws' / file_path.name
            surface_file = OUTPUT / mode / f'{side}-pressed' / file_path.name
            paw_file.parent.mkdir(parents=True, exist_ok=True); surface_file.parent.mkdir(parents=True, exist_ok=True)
            Image.fromarray(paw).save(paw_file); Image.fromarray(surface).save(surface_file)
            no_overlap = not np.any((paw[:, :, 3] > 0) & (surface[:, :, 3] > 0))
            exact_alpha = np.array_equal(paw[:, :, 3].astype(int)+surface[:, :, 3], rgba[:, :, 3])
            exact_color = np.array_equal(paw[paw_mask], rgba[paw_mask]) and np.array_equal(surface[surface_mask], rgba[surface_mask])
            # Anchor derives from the actual hand near its large white fill,
            # not from isolated source UV/antialias pixels elsewhere in the PNG.
            anatomical = paw_mask & dilate(core, 9) & (rgba[:, :, 3] > 64)
            bx, by, bw, bh = bounds(anatomical)
            key_id = f'{mode}/{side}/{file_path.stem}'
            report['entries'][key_id] = {'key': file_path.stem, 'mode': mode, 'side': side,
                'pawSrc': '/'+str(paw_file.relative_to(APP / 'public')), 'surfaceSrc': '/'+str(surface_file.relative_to(APP / 'public')),
                'bbox': bounds(paw_mask), 'whiteCoreBBox': bounds(core), 'anatomicalBBox': [bx, by, bw, bh],
                'anchorY': by+176, 'contactY': by+bh-1+176,
                'pawPixels': int(paw_mask.sum()), 'surfacePixels': int(surface_mask.sum()), 'cyanPixels': int(cyan.sum()),
                'surfaceGlyphCorePixels': int((glyphs & (rgb.min(axis=2) > 180)).sum()),
                'noOverlap': no_overlap, 'alphaPartitionExact': bool(exact_alpha), 'visibleRGBAExact': bool(exact_color),
                'allCyanInSurface': bool(np.all(surface_mask[cyan])), 'pawHasCyan': bool(np.any(paw_mask & cyan)),
                'pawChromaticVisiblePixels': int((paw_mask & chromatic).sum()),
                'transparentRGBZero': bool(np.all(paw[paw[:, :, 3] == 0, :3] == 0) and np.all(surface[surface[:, :, 3] == 0, :3] == 0)),
                'sourceSHA256': hashlib.sha256(file_path.read_bytes()).hexdigest()}
            if file_path.stem in selected[mode]:
                review_rows.append((key_id, rgba, paw, surface))
    OUTPUT.mkdir(parents=True, exist_ok=True)
    (OUTPUT / 'metadata.json').write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n')
    lightweight = {key: {field: entry[field] for field in ['pawSrc', 'surfaceSrc', 'anchorY', 'contactY']} for key, entry in report['entries'].items()}
    (APP / 'src/data/interaction-paws.json').write_text(json.dumps(lightweight, ensure_ascii=False, indent=2)+'\n')
    columns, cell_w, cell_h = 3, 250, 145
    sheet = Image.new('RGB', (columns*cell_w, len(review_rows)*cell_h), '#292630'); draw = ImageDraw.Draw(sheet)
    for row, (name, original, paw, surface) in enumerate(review_rows):
        original_box = Image.fromarray(original).getbbox()
        for col, (label, pixels) in enumerate([('original', original), ('paw', paw), ('surface', surface)]):
            pic = Image.fromarray(pixels).crop(original_box); pic.thumbnail((238, 116))
            x, y = col*cell_w+(cell_w-pic.width)//2, row*cell_h
            sheet.paste(pic, (x, y), pic)
            draw.text((col*cell_w+5, y+121), f'{name} {label}', fill='white')
    sheet.save(QA / 'selected-parts.png')
    summary = {'count': len(report['entries']), 'exactPartitions': sum(e['noOverlap'] and e['alphaPartitionExact'] and e['visibleRGBAExact'] and e['allCyanInSurface'] and not e['pawHasCyan'] for e in report['entries'].values()),
               'pawChromaticVisiblePixels': sum(e['pawChromaticVisiblePixels'] for e in report['entries'].values()),
               'transparentRGBZero': all(e['transparentRGBZero'] for e in report['entries'].values()),
               'selected': {key: value for key, value in report['entries'].items() if value['key'] in selected[value['mode']]}}
    (QA / 'summary.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2)+'\n')
    print(json.dumps({k:v for k,v in summary.items() if k!='selected'}, indent=2))


if __name__ == '__main__':
    main()
