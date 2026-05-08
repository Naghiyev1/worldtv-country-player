# WorldTV v1.2.2 — Source Cleanup

## What changed

- Removed confusing/broken TDTChannels Official TV source from the main source list
- Removed confusing/broken TDTChannels Official Radio source from the main source list
- Kept TDTChannels GitHub TV catalogue only
- Renamed it clearly: `TDTChannels · Spain TV catalogue`
- TDTChannels is now shown as Spain-only
- IPTV-org Country playlists remain the main world-TV source
- IPTV-org Full global index remains available for bigger global browsing
- Kept HLS.js and Dash.js playback support
- Cache updated to v1.2.2
- JavaScript syntax checked successfully

## Source logic

Use:

- `IPTV-org · World by country` for proper country browsing
- `IPTV-org · Full global index` for the biggest global list
- `TDTChannels · Spain TV catalogue` for Spain-focused channels

TDTChannels is not a world-TV source.

## Upload

Upload all files to your repo root:

- index.html
- style-v1-2-2.css
- app-v1-2-2.js
- style.css
- app.js
- README.md
- icon.svg
- manifest.json
- service-worker.js

Then hard refresh. If the old version remains, clear site data once.
