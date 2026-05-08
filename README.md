# WorldTV v1.4 — Source Health Router

## What changed

- Added source health routing
- Added Free-TV/IPTV country playlist pattern
- Kept Free-TV/IPTV global backup
- Kept IPTV-org country playlists
- Kept IPTV-org full global index
- Kept TDTChannels Spain TV catalogue
- Auto route:
  - Spain: TDTChannels → IPTV-org Spain → Free-TV country → Free-TV global → IPTV-org full index
  - Other countries: IPTV-org country → Free-TV country → Free-TV global → IPTV-org full index
- Added “Try backup source” button
- Added stream health labels: Untested / Worked before / Failed before
- Added format filter: All / HLS / DASH / File / Unknown
- Added route log so users can see which sources were tried
- Merges duplicate channel names into alternatives
- Cache updated to v1.4
- JavaScript syntax checked successfully

## Upload

Upload all files to your repo root:

- index.html
- style-v1-4.css
- app-v1-4.js
- style.css
- app.js
- README.md
- icon.svg
- manifest.json
- service-worker.js

Then hard refresh. If the old version remains, clear site data once.
