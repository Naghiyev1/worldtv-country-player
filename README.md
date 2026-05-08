# WorldTV v1.2 — Multi-source + Better Playback

## What changed

- Added source switcher
- Sources:
  - IPTV-org Country playlists
  - IPTV-org Full index
  - TDTChannels TV
  - TDTChannels TV + Radio
  - TDTChannels TV M3U8 + MPD
- Added Dash.js for MPD/DASH playback
- Kept HLS.js for M3U8 playback
- Kept native fallback and Open Stream button
- Better format labelling: HLS / DASH / file / unknown
- Better parsing for `#EXTGRP`
- No full playlist localStorage caching
- Favourites and recent now include source key
- Cache updated to v1.2
- JavaScript syntax checked successfully

## Upload

Upload all files to your repo root:

- index.html
- style-v1-2.css
- app-v1-2.js
- style.css
- app.js
- README.md
- icon.svg
- manifest.json
- service-worker.js

Then hard refresh. If the old version remains, clear site data once.
