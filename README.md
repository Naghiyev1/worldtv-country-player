# WorldTV v1.3 — Source Router

## What changed

- Added `Auto-best source`
- Auto mode:
  - Spain → TDTChannels Spain TV catalogue
  - Other countries → IPTV-org country playlist
- Added `Free-TV/IPTV · Global backup`
- Kept:
  - IPTV-org · World by country
  - IPTV-org · Full global index
  - TDTChannels · Spain TV catalogue
- Added source route badge so users can see what Auto selected
- Auto mode falls back to IPTV-org country playlist if TDT Spain fails
- Kept HLS.js and Dash.js playback support
- Cache updated to v1.3
- JavaScript syntax checked successfully

## Source logic

Use:

- `Auto-best source` for normal use
- `IPTV-org · World by country` for direct country mode
- `IPTV-org · Full global index` for the biggest global list
- `Free-TV/IPTV · Global backup` when IPTV-org is weak
- `TDTChannels · Spain TV catalogue` for Spain-focused channels

## Upload

Upload all files to your repo root:

- index.html
- style-v1-3.css
- app-v1-3.js
- style.css
- app.js
- README.md
- icon.svg
- manifest.json
- service-worker.js

Then hard refresh. If the old version remains, clear site data once.
