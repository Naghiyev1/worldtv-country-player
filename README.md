# WorldTV v1.4.1 — Player Stability Fix

## What changed

- Fixed player stopping after first frame / image
- Health updates no longer re-render and replace the video element during playback
- Kept health labels but update them in-place
- Made HLS.js error handling less aggressive
- Added HLS network/media recovery attempts
- Dash.js now uses explicit play after setup
- Keeps:
  - Source health router
  - Try backup source button
  - IPTV-org country playlists
  - IPTV-org full global index
  - Free-TV/IPTV backup
  - TDTChannels Spain catalogue
  - Format filter
- Cache updated to v1.4.1
- JavaScript syntax checked successfully

## Upload

Upload all files to your repo root:

- index.html
- style-v1-4-1.css
- app-v1-4-1.js
- style.css
- app.js
- README.md
- icon.svg
- manifest.json
- service-worker.js

Then hard refresh. If the old version remains, clear site data once.
