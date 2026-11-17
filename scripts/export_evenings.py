"""Optional: measures every crescent map from the first forecast month to the end of the maps and
writes data/evenings.json (zone shares over Morocco for each possible 29th evening).

data/evenings.json is normally made from the map thumbnails by scripts/thumb_features.py (build_calendar.py runs it);
this script measures the full maps instead. Both give the same probabilities to within 0.15 percentage points.

Needs only Pillow (pip install pillow). On Windows PowerShell:
    $env:MOON_MAPS = "C:\\Users\\C100\\Desktop\\moon\\Moon Visibility Maps (moonsighting.com)"
    python scripts\\export_evenings.py
"""
import csv, json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from config import MAPS as R, DATA
from features import feats

if not os.path.exists(R + 'index.csv'):
    sys.exit(f'index.csv not found in {R}\nSet MOON_MAPS to the "Moon Visibility Maps (moonsighting.com)" folder.')
cal = json.load(open(DATA / 'calendar.json', encoding='utf-8'))
first = cal['future'][0]
start = (first['hy'], first['hm'])
rows = [x for x in csv.DictReader(open(R + 'index.csv', encoding='utf-8-sig'))
        if x['file'] and (int(x['hijri_year']), int(x['month_no'])) >= start]
out, missing = {}, []
for i, x in enumerate(sorted(rows, key=lambda x: x['gregorian_date'])):
    if not os.path.exists(R + x['file']):
        missing.append(x['file']); continue
    f = feats(x['file'])['all']
    out.setdefault(f"{int(x['hijri_year'])}-{int(x['month_no'])}", {})[x['gregorian_date']] = [f[k] for k in 'ABCDN']
    if i % 50 == 0:
        print(f'{i}/{len(rows)} {x["gregorian_date"]}')
if missing:
    print(f'{len(missing)} map files are missing, for example {missing[0]}. Run scripts/fetch_maps.py first.')
json.dump({'from': f'{start[0]}-{start[1]}', 'evenings': out}, open(DATA / 'evenings.json', 'w', encoding='utf-8'),
          separators=(',', ':'))
print(f'wrote data/evenings.json: {sum(len(v) for v in out.values())} evenings in {len(out)} months')
