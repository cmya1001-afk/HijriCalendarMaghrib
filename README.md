# Hijri Calendar for Morocco (Maghrib)

A Hijri calendar for Morocco that uses the official start dates where they are known (1445–1448 AH) and forecasts every month from Jumada al-Thani 1448 to Dhul-Hijjah 1460 AH (late 2026 to early 2039).

Morocco's Ministry of Habous and Islamic Affairs starts each month the day after the new crescent is sighted in Morocco on the evening of the 29th. If it isn't sighted, the month runs to 30 days. This project learns how Morocco's decisions relate to the crescent visibility maps published by moonsighting.com. It then uses that to forecast future months, with a probability for each date.

**Open `index.html`.** It is the main page: a small (about 70 KB), easy-to-read calendar that opens in Arabic, with French and English one tap away. It shows today's Hijri date with the moon phase, a countdown to Ramadan and the Eids, one month at a time (tap any day for details, swipe or use the arrows to change month, or jump with the year picker and month strip), each year's holidays, a date converter, and a button to add a year's holidays to Google, Apple or Outlook Calendar. Every month links to itself (`index.html#m1448-9` is Ramadan 1448). Official dates are marked confirmed; every forecast date shows how certain it is as a percentage.

**For the full forecast and evidence, open `details.html`.** It is one self-contained page with the crescent maps, the model's predictions against Morocco's announcements, and its accuracy.

Both pages need no build step to view.

### Hosting on Netlify (with the admin page)

The site runs on [Netlify](https://www.netlify.com/), set up in `netlify.toml`. On every push Netlify builds `site/` (the calendar, `admin.html` and `details.html`) with Python's standard library, and deploys one function, `/api/confirmations`, which keeps the month starts confirmed on the admin page in Netlify Blobs (Netlify's built-in storage). Everything fits in Netlify's free plan.

**Connect it once**

1. Sign in at app.netlify.com with GitHub, choose **Add new site → Import an existing project → GitHub**, and select this repository and the branch to publish. Keep the build settings Netlify reads from `netlify.toml`, then deploy.
2. In **Site configuration → Environment variables**, add `ADMIN_KEY` with a long random value (for example from a password generator), then **Deploys → Trigger deploy**.
3. Bookmark the admin page: `https://<your-site>.netlify.app/admin?key=<ADMIN_KEY>`. The key is the only protection, so keep the link private. To change it, change `ADMIN_KEY` and redeploy.

**Confirming a month**

When the Ministry of Habous announces the start of a month, open the admin link, pick *Crescent seen* or *Not seen* (each shows its date and the model's probability), optionally paste the announcement link, and confirm. The public calendar shows the month as confirmed straight away, and every later month is re-forecast from it in the visitor's browser (`scripts/engine.js`, the same method as `build_calendar.py`). Only the next month can be confirmed, always 29 or 30 days after the previous one, and the last confirmation can be undone.

**Forecasts after a surprise**

To re-forecast after any confirmed date, the pages and the API need the visibility over Morocco for every possible 29th evening, not only the likely ones. `data/evenings.json` holds all 455 of them through 1460: 295 measured from the full maps by the build, and 160 measured from the map thumbnails stored in `data/calendar.json` by `scripts/thumb_features.py` (on the 334 evenings that have both, the two give the same probability to within 0.15 percentage points). `build_calendar.py` regenerates it on every rebuild. `scripts/export_evenings.py` measures every evening from the full maps instead, if you prefer.

**Teaching the model**

Confirmations live on Netlify, not in the repository. Before a rebuild with the maps, copy them from the admin page's *Export* box into `data/official_months_2024_2026.json` (and the sighting results into `data/dataset.json`), then run `python scripts/build_calendar.py` and push. Those months become official and the admin page continues from the next one.

## API

The Netlify site has a free, public JSON API, so other apps can use the same dates as the calendar. It includes months confirmed on the admin page (live within about a minute) and allows calls from any website (CORS).

| Endpoint | Returns |
|---|---|
| `GET /api/date` | Today's Hijri date in Morocco |
| `GET /api/date?date=2027-03-10` | The Hijri date for any day from 19 Jul 2023 to 25 Jan 2039 |
| `GET /api/months?year=1448` | The months of a Hijri year with start, end and length (default: current year) |
| `GET /api/holidays?year=1448` | Holidays and religious occasions of a Hijri year (default: current year) |
| `GET /api` | This list |

Every answer says whether the date is `"confirmed"` (official, or confirmed after the Ministry's announcement) or `"expected"` (forecast), with a `certainty` from 0 to 1 and the other possible date when there is a real chance of it. Example, `GET /api/date?date=2027-03-10`:

```json
{
 "gregorian": "2027-03-10",
 "weekday": "Wednesday",
 "hijri": { "day": 1, "month": 10, "year": 1448,
            "monthName": { "en": "Shawwal", "ar": "شوال", "fr": "Chaoual" },
            "formatted": { "en": "1 Shawwal 1448 AH", "ar": "1 شوال 1448 هـ", "fr": "1 Chaoual 1448 H" } },
 "status": "expected",
 "certainty": 0.974,
 "source": "forecast",
 "alternative": null,
 "month": { "start": "2027-03-10", "length": 29, "lengthCertain": false, "announcement": null },
 "holiday": { "key": "eid-al-fitr", "name": { "en": "Eid al-Fitr", "ar": "عيد الفطر", "fr": "Aïd al-Fitr" }, "publicHoliday": true },
 "isRamadan": false
}
```

From another app, for example in JavaScript:

```js
const r = await fetch('https://<your-site>.netlify.app/api/date');
const today = await r.json();
console.log(today.hijri.formatted.ar);   // "6 جمادى الآخرة 1448 هـ"
```

Dates are civil days, as used in Morocco. The Islamic day itself begins at sunset the evening before. Errors come back as `{ "error": "..." }` with status 400 (bad input) or 404 (no data for that date or year).

## What the detailed page (`details.html`) shows

- **Calendar:** each Hijri month as a grid, with the Hijri day large and the Gregorian date beside it. Ramadan, the two Eids, the Islamic New Year and Mawlid are highlighted. Weeks start on Monday.
- **Key dates, 1445–1460:** Islamic New Year, Eid al-Mawlid, the start of Ramadan, Eid al-Fitr and Eid al-Adha for every year, with the forecast probability for future years.
- **Evidence:** for every month, the three crescent maps (the new-moon evening and the two after it) cropped to Morocco, with the 29th evening outlined. Past months show what the model would have predicted at the time and the actual announced date. Future months show the forecast.
- **How good the model is:** walk-forward accuracy, calibration, the model weights, and how Morocco's decisions on borderline nights changed in 2025–26.

## Method

1. **Features.** On each 29th-evening map, measure the share of Moroccan land (Tangier to Lagouira) in each visibility zone: A green (naked eye), B cyan (perfect conditions), C grey (optical aid to find), D red (optical aid only) or none. See `scripts/features.py`.
2. **Labels.** Whether Morocco reported the crescent that evening, for 137 evenings from Muharram 1437 (Oct 2015) to Jumada al-Ula 1448 (Oct 2026). Sources are the Morocco Awqaf sighting reports logged on moonsighting.org.uk (1437–1444), Morocco's announced start dates on the same site (1445–1446), and official Habous announcements for 2025–26.
3. **Model** (`scripts/build_calendar.py`):
   - **Any naked-eye green over Morocco:** observed rate, 50 of 50 reported (98% with smoothing).
   - **Only red or no visibility:** observed rate, 0 of 43 reported (2%).
   - **Borderline nights (cyan or grey):** logistic regression on the cyan and grey shares, weighting recent years more (half-life 2 years, C = 3). This setting was chosen by walk-forward testing in `scripts/tune_model.py`.
4. **Forecasting.** Start-date probabilities are carried forward month by month. The calendar shows the most likely consistent chain of month starts (Viterbi), so every month is 29 or 30 days.

## Results (walk-forward: each evening predicted using only earlier evenings)

| | Model | Simple rule: "seen only if green" |
|---|---|---|
| All 117 evenings, 2017–2026 | 94.9% correct, Brier 0.041 | 89.7%, Brier 0.103 |
| 31 borderline evenings | 80.6%, Brier 0.143 | 61.3%, Brier 0.387 |
| 9 borderline evenings since July 2024 | 44% | 44% |

From 2015 to 2024 Morocco reported every all-cyan night (8 of 8) and no grey-heavy night (0 of 19). In 2025–26 that reversed: 1 of 3 all-cyan nights and 3 of 4 grey-heavy nights were reported. Borderline nights stay close to a coin toss, and the forecast percentages reflect that. Full notes and the month table are in [`docs/model.md`](docs/model.md).

## Rebuilding

Requires Python 3.10+ (`pip install -r requirements.txt`) and curl.

```bash
# 1. Get the maps (about 1,300 GIFs, not stored in this repo).
#    Windows: run tools/Download-MoonMaps.ps1, which creates
#    "Moon Visibility Maps (moonsighting.com)" with index.csv.
#    Then fetch the remaining maps, including 1437 AH, which the site still hosts but no longer lists:
export MOON_MAPS="/path/to/Moon Visibility Maps (moonsighting.com)"
python scripts/fetch_maps.py

# 2. Rebuild data/calendar.json, details.html, index.html and admin.html
python scripts/build_calendar.py            # TODAY=YYYY-MM-DD to pin the date

# Only rebuild index.html and admin.html from data/calendar.json (no maps needed)
python scripts/build_simple.py

# Optional: re-run model selection
python scripts/tune_model.py
```

To add a new month once Morocco announces it, add the evening to `data/dataset.json`, or to `data/official_months_2024_2026.json` for the official start, then rebuild.

## Data files

| File | Contents |
|---|---|
| `data/labelled_evenings.csv` | The 137 training evenings: date, which month it decided, reported or not, source, map file, zone shares |
| `data/dataset.json` | The same data in the form the build script reads |
| `data/official_months_2024_2026.json` | Official Moroccan month starts Jumada al-Thani 1446 to Jumada al-Ula 1448, with source links |
| `data/reports_parsed.json` | Morocco results parsed from moonsighting.org.uk monthly reports |
| `data/maps_1437.csv` | URLs of the 1437 AH maps |
| `data/calendar.json` | Everything the pages display (months, evidence, forecasts, stats) |
| `data/evenings.json` | Zone shares over Morocco for every possible future 29th evening (from `scripts/thumb_features.py`) |

## Credits and caveats

- Crescent visibility maps: [moonsighting.com](https://www.moonsighting.com/visibility.html) (OmegaHilalSighting by Fawzi Kayali, Shaukat criterion). The page embeds small cropped thumbnails, and the full maps are not redistributed here.
- Sighting results: [moonsighting.org.uk](https://www.moonsighting.org.uk/) (ICOUK) and announcements by Morocco's Ministry of Habous and Islamic Affairs as reported by Hespress, SNRT News, Médias24, TelQuel and Le360.
- Forecasts are for planning only. Morocco's months begin on the Ministry's announcement, which depends on an actual sighting and on the weather.
