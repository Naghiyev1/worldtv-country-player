# WorldTV v1.3.2 — Stable Player Rollback

This build rolls back the player to the simpler stable branch and removes the v1.4 health-router playback logic.

## What changed

- Removed source health tracking from playback
- Removed worked-before / failed-before player logic
- Removed player re-rendering during playback
- Removed aggressive playback event handling
- Restored simple HLS.js / Dash.js / native playback flow
- Uses new isolated localStorage keys so broken v1.4 state cannot interfere
- Keeps:
  - Auto-best source
  - IPTV-org world by country
  - IPTV-org full global index
  - Free-TV global backup
  - TDTChannels Spain catalogue
  - Open stream fallback
- Cache updated to v1.3.2
- JavaScript syntax checked successfully

## Upload

Upload all files to your repo root:

- index.html
- style-v1-3-2.css
- app-v1-3-2.js
- style.css
- app.js
- README.md
- icon.svg
- manifest.json
- service-worker.js

Then clear site data once and reload.
