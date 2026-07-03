# tmaca-live

A small browser-based TMACA episode validation and scraped dataset system.

## Scripts

- `npm run build-scraped` — Generate `episodes-scraped.json` from source fixtures.
- `npm run test-scraper` — Run the scraper test harness.
- `npm start` — Start a local static web server on port `8000`.

## Usage

1. Run `npm install` if you want package script convenience (not required for the local app).
2. Start the app: `npm start`
3. Open `http://0.0.0.0:8000/` in your browser.
4. Use the dashboard buttons to load the scraped dataset, load the static dataset, reset, export, or import JSON.
