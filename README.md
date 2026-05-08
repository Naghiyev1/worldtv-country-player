# WorldTV v1.4.2 — Simple Player Revert

## What changed

- Reverted to a simpler player flow
- Removed “press play / ready” overlay behaviour
- Removed early browser error health marking
- HLS now waits for MANIFEST_PARSED before play
- DASH now waits for STREAM_INITIALIZED before play
- Native streams now play after loadedmetadata
- Player health labels remain, but only update after actual playback starts
- Player message overlay no longer blocks controls
- Keeps:
  - Source health router
  - Try backup source button
  - IPTV-org country playlists
  - IPTV-org full global index
  - Free-TV/IPTV backup
  - TDTChannels Spain catalogue
  - Format filter
- Cache updated to v1.4.2
- JavaScript syntax checked successfully

## Upload

Upload all files to your repo root:

- index.html
- style-v1-4-2.css
- app-v1-4-2.js
- style.css
- app.js
- README.md
- icon.svg
- manifest.json
- service-worker.js

Then clear site data once and reload.
