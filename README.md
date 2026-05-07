# WorldTV v1.0.1 — Quota Fix

A clean browser TV player for the public IPTV-org M3U playlist.

## What changed in v1.0.1

- Removed full playlist caching in localStorage
- Fixed “The quota has been exceeded” error
- Keeps favourites and recent channels in localStorage
- Fetches IPTV-org playlist fresh on load
- Keeps HLS.js playback
- Keeps country/category/search/player logic
- Cache updated to v1.0.1
- JavaScript syntax checked successfully

## Important notes

WorldTV does not host or control any streams. Stream reliability depends on the original providers, browser support, geo-blocking, stream format, and availability.

Some channels will fail. That is normal for public IPTV lists.

## Upload

Upload all files to your repo root:

- index.html
- style-v1-0-1.css
- app-v1-0-1.js
- style.css
- app.js
- README.md
- icon.svg
- manifest.json
- service-worker.js

After upload, hard refresh. If the old version remains, clear site data because the previous service worker may still be active.
