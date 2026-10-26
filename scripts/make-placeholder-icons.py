#!/usr/bin/env python3
"""Generate the PLACEHOLDER app icons in icons/.

A white check mark on a solid dark background. Python 3 standard library only
(zlib + struct write the PNG files). Run from anywhere:

    python3 scripts/make-placeholder-icons.py

These are placeholders until the visual design step replaces them.
"""
import math
import os
import struct
import zlib

BACKGROUND = (0x1B, 0x2A, 0x41)  # keep in sync with manifest.webmanifest colors
MARK = (0xFF, 0xFF, 0xFF)

# The check mark in unit coordinates (0..1). Every point, stroke included, stays
# well inside the central 80% (and the 40% radius circle) so the same drawing is
# safe for the maskable icon.
CHECK = [(0.28, 0.52), (0.44, 0.68), (0.74, 0.34)]
STROKE = 0.11

ICONS = [
    ('icon-192.png', 192),
    ('icon-512.png', 512),
    ('icon-maskable-512.png', 512),
    ('apple-touch-icon.png', 180),
]


def distance_to_segment(px, py, a, b):
    ax, ay = a
    bx, by = b
    dx, dy = bx - ax, by - ay
    t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)
    t = max(0.0, min(1.0, t))
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy))


def render(size):
    """Return raw RGB rows. Fully opaque: every pixel is background or mark."""
    radius = STROKE / 2 * size
    points = [(x * size, y * size) for x, y in CHECK]
    rows = []
    for y in range(size):
        row = bytearray([0])  # PNG filter type 0 (none)
        for x in range(size):
            px, py = x + 0.5, y + 0.5
            d = min(distance_to_segment(px, py, points[i], points[i + 1]) for i in range(len(points) - 1))
            cover = max(0.0, min(1.0, radius - d + 0.5))  # 1 px antialiased edge
            row.extend(round(BACKGROUND[c] + (MARK[c] - BACKGROUND[c]) * cover) for c in range(3))
        rows.append(bytes(row))
    return rows


def chunk(kind, data):
    body = kind + data
    return struct.pack('>I', len(data)) + body + struct.pack('>I', zlib.crc32(body) & 0xFFFFFFFF)


def write_png(path, size):
    header = struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0)  # 8-bit RGB, no alpha
    data = zlib.compress(b''.join(render(size)), 9)
    with open(path, 'wb') as f:
        f.write(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', header) + chunk(b'IDAT', data) + chunk(b'IEND', b''))


def main():
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'icons')
    os.makedirs(out, exist_ok=True)
    for name, size in ICONS:
        write_png(os.path.join(out, name), size)
        print(f'wrote icons/{name} ({size}x{size})')


if __name__ == '__main__':
    main()
