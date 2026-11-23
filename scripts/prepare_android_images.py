import os, struct, zlib, math

base = 'android/app/src/main/res'

def chunk(kind, data):
    return (
        struct.pack('>I', len(data)) + kind + data +
        struct.pack('>I', zlib.crc32(kind + data) & 0xffffffff)
    )

def make_png(w, h, mode='splash'):
    rows = []
    cx = (w - 1) / 2
    cy = (h - 1) / 2
    r1 = min(w, h) * 0.34
    r2 = min(w, h) * 0.23
    for y in range(h):
        row = bytearray([0])
        for x in range(w):
            d = math.hypot(x - cx, y - cy)
            if mode == 'foreground':
                if d <= r2:
                    rgba = (220, 38, 38, 255)
                elif d <= r1:
                    rgba = (245, 245, 245, 255)
                else:
                    rgba = (0, 0, 0, 0)
            elif mode == 'launcher':
                if d <= r1:
                    rgba = (18, 18, 20, 255)
                else:
                    rgba = (5, 5, 6, 255)
            else:
                if d <= r2:
                    rgba = (185, 28, 28, 255)
                elif d <= r1:
                    rgba = (25, 25, 28, 255)
                else:
                    rgba = (5, 5, 6, 255)
            row.extend(rgba)
        rows.append(bytes(row))
    raw = b''.join(rows)
    return (
        b'\x89PNG\r\n\x1a\n' +
        chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0)) +
        chunk(b'IDAT', zlib.compress(raw, 9)) +
        chunk(b'IEND', b'')
    )

launcher_sizes = {
    'mipmap-mdpi': 48,
    'mipmap-hdpi': 72,
    'mipmap-xhdpi': 96,
    'mipmap-xxhdpi': 144,
    'mipmap-xxxhdpi': 192,
}
for folder, size in launcher_sizes.items():
    path = os.path.join(base, folder)
    os.makedirs(path, exist_ok=True)
    assets = {
        'ic_launcher.png': make_png(size, size, 'launcher'),
        'ic_launcher_round.png': make_png(size, size, 'launcher'),
        'ic_launcher_foreground.png': make_png(size, size, 'foreground'),
    }
    for name, data in assets.items():
        target = os.path.join(path, name)
        with open(target, 'wb') as f:
            f.write(data)
        print('Regenerado:', target)

splash_data = make_png(256, 256, 'splash')
for root, dirs, files in os.walk(base):
    if 'splash.png' in files:
        target = os.path.join(root, 'splash.png')
        with open(target, 'wb') as f:
            f.write(splash_data)
        print('Regenerado:', target)

generic = os.path.join(base, 'drawable', 'splash.png')
os.makedirs(os.path.dirname(generic), exist_ok=True)
with open(generic, 'wb') as f:
    f.write(splash_data)

bad = []
for root, dirs, files in os.walk(base):
    for name in files:
        if not name.lower().endswith('.png'):
            continue
        path = os.path.join(root, name)
        with open(path, 'rb') as f:
            sig = f.read(8)
        if sig != b'\x89PNG\r\n\x1a\n':
            bad.append(path)
if bad:
    raise SystemExit('PNG inválidos restantes: ' + ', '.join(bad))
