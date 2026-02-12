# Refridgermate

A simple weekly meal planner for home use. Drag ingredients and favorite meals into the calendar, assign them to Family or a person, and keep a live inventory.

## Quick Start (Docker only)

You only need Docker Desktop.

1. Install Docker Desktop for Mac.
2. Open Docker Desktop and make sure it is running.
3. In this project folder, run:

```bash
docker compose up --build
```

4. Open the app:

[http://localhost:5173](http://localhost:5173)

## Run on iPhone (same Wi-Fi)

1. Keep the app running on your Mac with `docker compose up --build`
2. Find your Mac local IP:
   - Mac path: `System Settings -> Wi-Fi -> Details (connected network) -> TCP/IP -> IP address`
   - Terminal shortcut: `ipconfig getifaddr en0`
3. Optional: verify iPhone network info:
   - iPhone path: `Settings -> Wi-Fi -> (i) on your connected network -> IP Address`
4. On iPhone Safari, open `http://YOUR-MAC-IP:5173`
5. Optional: Share -> Add to Home Screen

## What Is Running

- `web` (React + Vite): app UI on `http://localhost:5173`
- `exporter` (Node + Playwright): local image export service used by the app

## Main Features

- Weekly meal grid (Breakfast, Lunch, Dinner, Snack)
- Inventory bubbles with counts, categories, expiration notes
- Pinned favorite meals you can drag into the calendar
- Family + per-person assignment inside each cell
- Profile manager (name, color, daily calorie goal, optional macro goals)
- Receipt scanning + AI import helper for quick inventory updates
- JSON export/import for backup
- Image export of the week plan

## Nutrition Tracking

- Ingredients can store nutrition per 1 inventory unit:
  - calories
  - optional protein/carbs/fat (grams)
- Profile goals:
  - daily calorie goal (when enabled)
  - optional macro goals (protein/carbs/fat)
- Day headers show per-profile progress bars for calories and macros.

## Export Notes

- **Export to Image** downloads a PNG of the current week.
- **Export JSON** saves your app data.
- **Import JSON** restores data from a previous export.

## Troubleshooting

If dependencies/volumes get out of sync, reset and rebuild:

```bash
docker compose down -v
docker compose up --build
```
