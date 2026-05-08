# WorldTV v1.2.1 — TDT Source Fix

## What changed

- Fixed TDTChannels source handling
- Added TDTChannels GitHub TV catalogue parser
- Kept official TDT TV and Radio M3U8 sources, but marked that browser CORS may block them
- Removed unreliable assumed TV+Radio / MPD source URLs
- Kept IPTV-org country playlists
- Kept IPTV-org full index
- Kept HLS.js and Dash.js
- Better Markdown parsing for TDTChannels TELEVISION.md
- Cache updated to v1.2.1
- JavaScript syntax checked successfully

## Recommended TDT source

Use:

`TDTChannels · GitHub TV catalogue`

That source fetches:

`https://raw.githubusercontent.com/LaQuay/TDTChannels/master/TELEVISION.md`

## Upload

Upload all files to your repo root:

- index.html
- style-v1-2-1.css
- app-v1-2-1.js
- style.css
- app.js
- README.md
- icon.svg
- manifest.json
- service-worker.js

Then hard refresh. If the old version remains, clear site data once.
