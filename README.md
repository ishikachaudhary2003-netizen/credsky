# SKY CRED

> Check the sky's credit score before you step out.

A lightweight weather application built with **HTML + CSS + vanilla JavaScript**.
Search any city, view live current conditions, and get a simple, friendly
"sky credit verdict" that tells you whether it's a good idea to step outside.

## Features

- **Default city (Mumbai)** — live weather loads automatically on launch
- **City search** — button + Enter key, with empty-input validation
- **Popular city chips** — Mumbai, Delhi, Bengaluru, Hyderabad, Chennai, Kolkata, Pune, Ahmedabad, New York, London (with selected-city highlight)
- **Weather interpretation** — application-generated personality:
  Rain Check ☔ / Breezy Mode 🍃 / Sun Alert ☀️ / Freeze Frame ❄️ / Perfect Day 😎
  (priority order: rain → wind → very hot → very cold → pleasant)
- **Primary metrics** — Humidity (%), Wind (km/h), UV index
- **Secondary info** — cloud coverage, visibility, pressure, wind speed, °F, last updated
- **JSON viewer** — Formatted / Raw tabs, copy-to-clipboard, scrollable
- **Robust error handling** — city not found, invalid API key, rate limit, network offline, service unavailable, stale-response protection, Retry action
- **Responsive** — desktop / laptop / tablet / mobile, no horizontal overflow
- **Accessible** — keyboard navigation, ARIA labels, focus states

## Tech

- WeatherAPI.com `current.json` endpoint (`https://api.weatherapi.com/v1/current.json`)
- No frameworks, no build step, no mock data — everything is rendered from the live API response.

## Run locally

```bash
# from this folder (any static server works)
python3 -m http.server 3000
# open http://localhost:3000
```

## Configuration

The WeatherAPI key lives in `config.js` (`window.CONFIG`). A `.env` file is
also provided, but static hosting does not read `.env` — the frontend key is
not treated as a secure secret per the PRD's security note.

## Structure

```
sky-cred/
├── index.html   # markup & layout
├── styles.css   # visual design & responsiveness
├── script.js    # state, API, rendering, interpretation, errors
├── config.js    # API endpoint, key, default city
└── .env         # key reference (not read by static hosting)
```
