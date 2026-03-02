# Refridgermate

A simple weekly meal planner for home use. Drag ingredients and favorite meals into the calendar, assign them to Family or a person, and keep a live inventory.

## Quick Start (Docker only, Mac or Windows)

You only need Docker Desktop.

1. Install Docker Desktop for Mac or Windows.
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
- Optional Visualize mode with a simple low-poly fridge, pantry, and countertop scene
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

## Visualize Mode

- Click **Visualize** in the top bar to open the optional 3D inventory view.
- It reads from the same saved inventory state as the planner, so imported or scanned ingredients appear automatically.
- The scene works offline after clone. Local models belong in `web/public/visualize/models/` and local textures belong in `web/public/visualize/textures/`.
- The fridge and pantry scene components use a safe loader wrapper with geometry fallback, so Visualize Mode still renders if a GLTF is missing or fails to load.
- **Organize Mode** lets you drag stacks between fridge shelves, door bins, pantry shelves, and the countertop.
- **Auto-focus on select** controls whether camera focus moves when you click a stack. It is automatically suppressed while Organize Mode is enabled.
- **Reset Layout** clears saved stack placement, and **Reset Camera** returns the scene to the neutral overview.
- If you add third-party assets later, record license/author/source details in `THIRD_PARTY_NOTICES.md`.
- Use **Back to Planner** to return to the existing meal planning view.

## Troubleshooting

If dependencies/volumes get out of sync, reset and rebuild:

```bash
docker compose down -v
docker compose up --build
```
