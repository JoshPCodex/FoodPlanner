# Meal Bubble Planner (MVP)

Meal Bubble Planner is a Docker-first weekly meal planner for two people with draggable ingredient bubbles, pinned meal favorites, receipt OCR, and plan export to PNG/JPG.

## Run (Docker only)

Prerequisite: Docker Desktop for Mac.
No local `node`, `npm`, or other runtime dependencies are required.

1. Make sure Docker Desktop is running and **not paused**.
2. From the repo root, run:

```bash
docker compose up --build
```

3. Open:
- Web app: [http://localhost:5173](http://localhost:5173)
- Exporter health: [http://localhost:8787/health](http://localhost:8787/health)

## Services

- `web`: React + TypeScript + Vite + Tailwind app (port `5173`)
- `exporter`: Node + Express + Playwright image renderer (port `8787`)

The `web` service calls `POST /api/export` (proxied to `exporter`) to generate consistent image exports.

## Persist Data

Data persistence uses two mechanisms:

1. Browser `localStorage` for app state (inventory, meals, week plans).
2. JSON export/import for backup/transfer.

Also, container-only `node_modules` are preserved using named Docker volumes:
- `web_node_modules`
- `exporter_node_modules`

`node_modules` should never be created on the host because source code is bind-mounted while `/app/node_modules` is isolated to named Docker volumes.

## Use the App

Top bar actions:
- `Scan Receipt`: upload receipt image, run in-browser OCR (Tesseract.js), review/edit parsed lines, add to inventory
- `AI Import Helper`: copy a ChatGPT prompt for photo/receipt analysis, paste AI text output, parse, review, and import to inventory
- `Add Ingredient`
- `Add Meal`
- `Export to Image`
- `Export JSON`
- `Import JSON`
- `Reset Demo Data`

Main behaviors:
- Drag ingredient bubbles into calendar cells: adds chip and decrements inventory by 1
- Repeated ingredient in same cell merges into a single chip with `xN`
- Drag pinned meal card into a cell: sets meal title + ingredient chips, decrements inventory by ingredient qty
- Drag meal title chip between cells: move to empty cell, swap when destination occupied
- Right-click or long-press on cells/bubbles for context actions

## AI Photo/Receipt Import Flow

Use this when you want ChatGPT to interpret photos and produce import-ready inventory text:

1. Click `AI Import Helper`.
2. Click `Copy Prompt` and paste it into ChatGPT.
3. Attach your receipt/fridge/grocery photos to ChatGPT and run the prompt.
4. Paste ChatGPT output (lines like `egg x12`, `banana x5`, `milk`) into the app.
5. Click `Parse List`, review/edit categories and counts, then `Import to Inventory`.

The parser also accepts lines without quantity (`milk`) and treats them as `x1`.
It also supports raw pasted receipt text and applies quantity rules like `2 x $...`, `6 ct`, and multiplicative `2 x (6 ct eggs)` -> `egg x12`.

## Export Plan as Image (PNG/JPG)

In UI:
1. Click `Export to Image`
2. The app sends current week plan data to web endpoint `POST /api/export`, which proxies to `exporter` `POST /export`
3. A PNG download starts automatically with name:
   - `meal-plan-YYYY-MM-DD.png`

API supports JPEG too:
- Send `format: "jpeg"` (or `"jpg"`) in request payload.

## Demo Data

On first run, demo data is loaded:

Ingredients:
- chicken, pork, steak, cheese, milk, eggs, lettuce, carrots, cucumber, bread, penne, spaghetti

Pinned favorites:
- Chicken + Penne
- Spaghetti + Meatballs
- Bacon + Egg + Cheese

## Architecture Note (Exporter)

`exporter` uses Playwright Chromium in a container (`mcr.microsoft.com/playwright`) to render a dedicated fixed-size HTML export template server-side. The endpoint:

- `POST /export`
- Input: `weekStartDate`, `weekPlan`, optional `theme/layout`, optional `format`
- Output: binary image (`image/png` default, `image/jpeg` when requested)

This avoids client/browser screenshot inconsistencies and keeps exports deterministic across machines.
The web app calls exporter through a Vite dev proxy (`/api/export` -> `exporter:8787/export`) to avoid cross-origin/localhost connectivity issues in Docker.

## Troubleshooting

If volumes or dependencies get into a bad state, reset Docker volumes:

```bash
docker compose down -v
```

## Ambiguity Choices Made

To keep UX simple for a normal couple in one-pass MVP:

1. `Make leftovers` copies selected cell to **next day lunch** only within the same visible week.
2. Meal drop consumption rule: each meal ingredient consumes exactly `qty` units (default `1`) from matching inventory name.
3. Pinned meal reorder is implemented with Left/Right controls on each card.
4. Context actions `Set servings`, `Save cell as meal`, and some ingredient edits use lightweight prompt dialogs for speed.
5. Image export button defaults to PNG download; JPEG is supported by exporter API payload.
6. AI import parser normalizes names and strips common packaging/branding words for simpler inventory labels.

## Project Structure

- `/docker-compose.yml`
- `/web` (frontend service)
- `/exporter` (Playwright export service)
