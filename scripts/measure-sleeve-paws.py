"""Measure original paw contact points without changing any source image.

The original interaction-paws manifest already locates the anatomical bottom
row. Measure X with the alpha-weighted last four rows (alpha > 64) so detached
antialias pixels and the old upper wrist opening cannot move the contact.
"""
import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image

APP = Path(__file__).resolve().parents[1]


def main():
    entries = json.loads((APP / 'src/data/interaction-paws.json').read_text())
    contacts = {}
    for entry in entries.values():
        source = APP / 'public' / entry['pawSrc'].lstrip('/')
        alpha = np.array(Image.open(source).convert('RGBA'))[:, :, 3]
        yy, xx = np.where(alpha > 64)
        bottom = entry['contactY'] - 176
        band = (yy >= bottom - 3) & (yy <= bottom)
        if not band.any():
            raise ValueError(f'No distal paw pixels at {entry["pawSrc"]}')
        center_x = np.average(xx[band], weights=alpha[yy[band], xx[band]])
        contacts[entry['pawSrc']] = {
            'x': round(float(center_x), 3),
            'contactY': entry['contactY'],
            'sourceSHA256': hashlib.sha256(source.read_bytes()).hexdigest(),
        }
    destination = APP / 'src/components/wizard-pet/sleeve-paw-contacts.json'
    destination.write_text(json.dumps(contacts, indent=2) + '\n')
    print(f'Measured {len(contacts)} original paw contacts: {destination}')


if __name__ == '__main__':
    main()
