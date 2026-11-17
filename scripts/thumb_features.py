"""Zone shares over Morocco measured from the cropped map thumbnails stored in data/calendar.json,
the same way scripts/features.py measures the full moonsighting.com maps. Used to fill in
data/evenings.json without the original maps (see scripts/export_evenings.py for the full-map route)."""
import base64, collections, io, os, sys
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from features import PTS, cls   # same Morocco grid and colour rules as the full-map measurement

# The thumbnails are the full map cropped at (X0, Y0) and enlarged 3x (see thumb() in build_calendar.py)
X0 = round(497 - 19 * 83 / 30)
Y0 = round(254 - 37.5 * 2.85)
CITIES = [(34.0, -6.8), (31.6, -8.0), (27.15, -13.2), (23.7, -15.9), (34.7, -1.9)]  # white dots drawn on top


def _pixel(px, x, y):
    """Colour of map pixel (x, y): one of the 3x3 thumbnail pixels it was enlarged to, avoiding city dots."""
    for ox, oy in ((1, 1), (0, 0), (2, 2), (0, 2), (2, 0), (1, 0), (0, 1), (2, 1), (1, 2)):
        tx, ty = (x - X0) * 3 + ox, (y - Y0) * 3 + oy
        if not any((tx - cx) ** 2 + (ty - cy) ** 2 <= 5.5 ** 2 for cx, cy in DOTS):
            return px[tx, ty]
    return None


DOTS = [((497 + lo * 83 / 30 - X0) * 3, (254 - la * 2.85 - Y0) * 3) for la, lo in CITIES]


def _zone(px, lat, lon):
    x, y = round(497 + lon * 83 / 30), round(254 - lat * 85.5 / 30)
    c = collections.Counter()
    for dx in range(-2, 3):
        for dy in range(-2, 3):
            p = _pixel(px, x + dx, y + dy)
            k = cls(p) if p else None
            if k:
                c[k] += 1
    return c.most_common(1)[0][0] if c else None


def thumb_feats(data_uri):
    im = Image.open(io.BytesIO(base64.b64decode(data_uri.split(',', 1)[1]))).convert('RGB')
    px = im.load()
    c = collections.Counter(_zone(px, la, lo) for la, lo in PTS)
    c.pop(None, None)
    n = sum(c.values()) or 1
    return {k: round(c[k] / n, 3) for k in 'ABCDN'}


def build_evenings():
    """data/evenings.json from data/calendar.json alone: the readings the build made from the full maps,
    plus thumbnail readings for every other map evening (checked against the full-map readings: same
    probabilities to within 0.15 percentage points on 334 evenings)."""
    import json
    from config import DATA
    cal = json.load(open(DATA / 'calendar.json', encoding='utf-8'))
    full = {}
    for f in cal['future']:
        for b in f['branches']:
            full[(f['hy'], f['hm'], b['ev'])] = b['f']
    out, n_full, n_thumb = {}, 0, 0
    for f in cal['future']:
        key = f"{f['hy']}-{f['hm']}"
        if f['maps']:
            for m in f['maps']:
                z = full.get((f['hy'], f['hm'], m['date']))
                if z is not None:
                    n_full += 1
                else:
                    z = thumb_feats(m['img']); n_thumb += 1
                out.setdefault(key, {})[m['date']] = [z[k] for k in 'ABCDN']
        else:   # no thumbnails (the end anchor month): keep the build's readings
            for b in f['branches']:
                out.setdefault(key, {})[b['ev']] = [b['f'][k] for k in 'ABCDN']; n_full += 1
    first = cal['future'][0]
    json.dump({'from': f"{first['hy']}-{first['hm']}", 'source': f'{n_full} full-map readings, {n_thumb} from thumbnails',
               'evenings': out}, open(DATA / 'evenings.json', 'w', encoding='utf-8'), separators=(',', ':'))
    print(f'wrote data/evenings.json: {n_full} full-map readings, {n_thumb} thumbnail readings, {len(out)} months')


if __name__ == '__main__':
    build_evenings()
