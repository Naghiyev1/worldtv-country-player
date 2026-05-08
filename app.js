
const APP_VERSION = "1.2.2";

const SOURCES = {
  "iptv-country": {
    label: "IPTV-org · World by country",
    description: "Best for world TV. Choose a country and load IPTV-org /countries/xx.m3u.",
    type: "country-m3u",
    url: "https://iptv-org.github.io/iptv/countries/{country}.m3u",
    defaultCountry: "ES"
  },
  "iptv-index": {
    label: "IPTV-org · Full global index",
    description: "Loads IPTV-org index.m3u. More channels, but slower and messier.",
    type: "global-m3u",
    url: "https://iptv-org.github.io/iptv/index.m3u"
  },
  "tdt-github-tv": {
    label: "TDTChannels · Spain TV catalogue",
    description: "Spain-focused backup catalogue from TDTChannels GitHub. This is not a world-TV source.",
    type: "tdt-md",
    forcedCountry: "ES",
    url: "https://raw.githubusercontent.com/LaQuay/TDTChannels/master/TELEVISION.md"
  }
};

const COUNTRY_CODES = ["AF", "AL", "DZ", "AD", "AO", "AR", "AM", "AU", "AT", "AZ", "BH", "BD", "BY", "BE", "BO", "BA", "BR", "BG", "CA", "CL", "CN", "CO", "CR", "HR", "CY", "CZ", "DK", "EC", "EG", "EE", "FI", "FR", "GE", "DE", "GR", "HK", "HU", "IS", "IN", "ID", "IR", "IQ", "IE", "IL", "IT", "JP", "JO", "KZ", "KR", "KW", "LV", "LB", "LT", "LU", "MY", "MX", "MD", "ME", "MA", "NL", "NZ", "NG", "NO", "PK", "PS", "PA", "PY", "PE", "PH", "PL", "PT", "QA", "RO", "RU", "SA", "RS", "SG", "SK", "SI", "ZA", "ES", "SE", "CH", "TW", "TH", "TN", "TR", "UA", "AE", "GB", "US", "UY", "UZ", "VE", "VN"];
const STORAGE = {
  favs: "worldtv_favourites_v122",
  recent: "worldtv_recent_v122",
  source: "worldtv_source_v122",
  country: "worldtv_country_v122"
};

const regionNames = typeof Intl !== "undefined" && Intl.DisplayNames ? new Intl.DisplayNames(["en"], { type: "region" }) : null;

const state = {
  sourceKey: localStorage.getItem(STORAGE.source) || "iptv-country",
  country: localStorage.getItem(STORAGE.country) || "ES",
  channels: [],
  filtered: [],
  group: "All",
  query: "",
  section: "browse",
  active: null,
  loading: true,
  error: "",
  hls: null,
  dash: null,
  currentPlaylistUrl: ""
};

const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;" }[c]));
const norm = s => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const safeParse = (k,f) => { try { const r = localStorage.getItem(k); return r ? JSON.parse(r) : f; } catch { return f; } };
const saveJSON = (k,v) => localStorage.setItem(k, JSON.stringify(v));
const channelId = c => `${c.sourceKey}::${c.name}::${c.url}`;

function getFavs(){ return new Set(safeParse(STORAGE.favs, [])); }
function setFavs(s){ saveJSON(STORAGE.favs, [...s]); }
function getRecent(){ return safeParse(STORAGE.recent, []); }
function setRecent(arr){ saveJSON(STORAGE.recent, arr.slice(0, 40)); }

function countryLabel(code){
  if(!code || code === "All") return "All countries";
  if(code === "INT") return "International";
  try { return regionNames ? regionNames.of(code) || code : code; } catch { return code; }
}

function currentSource(){ return SOURCES[state.sourceKey] || SOURCES["iptv-country"]; }
function sourceNeedsCountry(){ return currentSource().type === "country-m3u"; }
function sourceIsSpainOnly(){ return Boolean(currentSource().forcedCountry === "ES"); }
function playlistUrl(){
  const src = currentSource();
  if(src.type === "country-m3u") return src.url.replace("{country}", String(state.country || src.defaultCountry || "ES").toLowerCase());
  return src.url;
}
function toggleFav(c){ const favs=getFavs(); const key=channelId(c); favs.has(key) ? favs.delete(key) : favs.add(key); setFavs(favs); render(); }

function parseAttrs(line){
  const attrs = {};
  const re = /([\w-]+)="([^"]*)"/g;
  let m;
  while((m = re.exec(line))) attrs[m[1]] = m[2];
  return attrs;
}

function inferCountry(attrs, name, source){
  if(source?.type === "country-m3u") return String(state.country || source.defaultCountry || "ES").toUpperCase();
  if(source?.forcedCountry) return source.forcedCountry;
  const explicit = attrs["tvg-country"] || attrs["country"] || attrs["countries"] || "";
  const first = explicit.split(/[;,]/).map(x => x.trim().toUpperCase()).find(x => /^[A-Z]{2}$/.test(x));
  return first || "INT";
}

function classifyType(url){
  const u = String(url || "").toLowerCase();
  if(u.includes(".mpd")) return "dash";
  if(u.includes(".m3u8")) return "hls";
  if(u.includes(".mp4") || u.includes(".m4v") || u.includes(".webm") || u.includes(".ogv") || u.includes(".mp3") || u.includes(".aac")) return "file";
  return "unknown";
}

function parseM3U(text, source){
  const lines = text.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
  const channels = [];
  let pendingExtGrp = "";

  for(let i=0;i<lines.length;i++){
    const line = lines[i];
    if(line.startsWith("#EXTGRP:")){
      pendingExtGrp = line.replace("#EXTGRP:","").trim();
      continue;
    }
    if(!line.startsWith("#EXTINF")) continue;

    const attrs = parseAttrs(line);
    const comma = line.indexOf(",");
    const displayName = comma >= 0 ? line.slice(comma + 1).trim() : "";
    let url = "";

    for(let j=i+1;j<Math.min(lines.length, i+9);j++){
      if(lines[j].startsWith("#EXTGRP:")) pendingExtGrp = lines[j].replace("#EXTGRP:","").trim();
      if(lines[j] && !lines[j].startsWith("#")){
        url = lines[j].trim();
        break;
      }
    }

    if(!url || !/^https?:\/\//i.test(url)) continue;

    const name = attrs["tvg-name"] || displayName || attrs["tvg-id"] || "Unknown channel";
    const group = attrs["group-title"] || pendingExtGrp || "General";
    const logo = attrs["tvg-logo"] || "";
    const country = inferCountry(attrs, name, source);
    channels.push(makeChannel({ name, group, logo, url, country, tvgId:attrs["tvg-id"]||"", lang:attrs["tvg-language"]||attrs["language"]||"" }));
    pendingExtGrp = "";
  }
  return dedupeSort(channels);
}

function parseTdtMarkdown(text, source){
  const channels = [];
  let group = "General";
  const lines = text.split(/\r?\n/);

  for(const raw of lines){
    const line = raw.trim();

    if(line.startsWith("## ") && !line.toLowerCase().includes("canales de televisión")){
      group = line.replace(/^##\s+/, "").trim() || "General";
      continue;
    }

    if(!line || line.startsWith("#") || line.startsWith("Canal ")) continue;
    if(!line.includes("](") || !(line.includes("m3u8") || line.includes("stream"))) continue;

    const firstLink = line.match(/\[(m3u8|stream|mpd)[^\]]*\]\((https?:\/\/[^\)]+)\)/i);
    if(!firstLink) continue;
    const url = firstLink[2];

    // Channel name is the text before the first markdown link.
    let name = line.split("[")[0].replace(/\|/g, "").trim();
    name = name.replace(/^-\s*/, "").trim();
    if(!name || name.length > 80) continue;

    const logoMatch = line.match(/\[logo\]\((https?:\/\/[^\)]+)\)/i);
    const epgMatch = line.match(/\)\s+([A-Za-z0-9_.-]+\.TV)\s+/);
    channels.push(makeChannel({
      name,
      group,
      logo: logoMatch ? logoMatch[1] : "",
      url,
      country: source.forcedCountry || "ES",
      tvgId: epgMatch ? epgMatch[1] : "",
      lang: "Spanish"
    }));
  }

  return dedupeSort(channels);
}

function makeChannel({name, group, logo, url, country, tvgId, lang}){
  return {
    name,
    group: group || "General",
    logo: logo || "",
    url,
    country: country || "INT",
    countryName: countryLabel(country || "INT"),
    tvgId: tvgId || "",
    lang: lang || "",
    sourceKey: state.sourceKey,
    sourceLabel: currentSource().label,
    streamType: classifyType(url)
  };
}

function dedupeSort(channels){
  const seen = new Set();
  return channels.filter(c => {
    const key = `${c.name}::${c.url}`;
    if(seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((a,b) => a.countryName.localeCompare(b.countryName) || a.group.localeCompare(b.group) || a.name.localeCompare(b.name));
}

async function loadPlaylist(force=false){
  state.loading = true;
  state.error = "";
  state.channels = [];
  state.filtered = [];
  state.active = null;
  state.currentPlaylistUrl = playlistUrl();
  renderShell();

  try{
    const r = await fetch(state.currentPlaylistUrl, { cache: force ? "reload" : "no-store" });
    if(!r.ok) throw new Error(`Playlist returned ${r.status}`);
    const text = await r.text();

    const src = currentSource();
    state.channels = src.type === "tdt-md" ? parseTdtMarkdown(text, src) : parseM3U(text, src);
    state.loading = false;
    applyFilters();
    render();
  }catch(err){
    state.loading = false;
    state.error = `Could not load playlist. Try another source. If this is TDT Official, use TDT GitHub TV instead because browsers may block the official domain. Details: ${err.message || err}`;
    render();
  }
}

function currentGroups(){
  return ["All", ...new Set(state.channels.map(c => c.group || "General"))].sort((a,b) => a.localeCompare(b));
}

function countriesInLoadedSource(){
  const map = new Map();
  for(const c of state.channels) map.set(c.country, (map.get(c.country) || 0) + 1);
  return [...map.entries()].sort((a,b) => countryLabel(a[0]).localeCompare(countryLabel(b[0])));
}

function applyFilters(){
  const q = norm(state.query);
  state.filtered = state.channels.filter(c => {
    const groupOk = state.group === "All" || c.group === state.group;
    const countryOk = sourceNeedsCountry() || state.country === "All" || c.country === state.country;
    const text = norm([c.name,c.group,c.countryName,c.lang,c.tvgId,c.sourceLabel,c.streamType].join(" "));
    return groupOk && countryOk && (!q || text.includes(q));
  });
}

function addRecent(c){
  const rec = getRecent().filter(x => x.id !== channelId(c));
  rec.unshift({ id:channelId(c), sourceKey:c.sourceKey, sourceLabel:c.sourceLabel, name:c.name, country:c.country, countryName:c.countryName, group:c.group, logo:c.logo, url:c.url, streamType:c.streamType, at:new Date().toISOString() });
  setRecent(rec);
}

function destroyPlayers(){
  if(state.hls){ try { state.hls.destroy(); } catch {} state.hls = null; }
  if(state.dash){ try { state.dash.reset(); } catch {} state.dash = null; }
}

function playChannel(c){
  state.active = c;
  addRecent(c);
  renderPlayer();
  setTimeout(() => attachPlayer(c), 50);
}

function attachPlayer(c){
  const video = $("#videoPlayer");
  if(!video || !c) return;

  destroyPlayers();
  const src = c.url;
  video.poster = "";
  video.removeAttribute("src");
  video.load();

  const type = classifyType(src);

  if(type === "dash" && window.dashjs){
    try {
      const player = dashjs.MediaPlayer().create();
      state.dash = player;
      player.initialize(video, src, true);
      player.on(dashjs.MediaPlayer.events.ERROR, () => showPlayerError("This DASH/MPD stream failed in the browser. Try another channel or open the stream."));
      return;
    } catch(e) {
      showPlayerError("DASH player failed to initialise. Try opening the stream directly.");
      return;
    }
  }

  if(type === "hls" && window.Hls && Hls.isSupported()){
    const hls = new Hls({ lowLatencyMode:true, backBufferLength:60, maxBufferLength:30, enableWorker:true });
    state.hls = hls;
    hls.loadSource(src);
    hls.attachMedia(video);
    hls.on(Hls.Events.ERROR, (_, data) => {
      if(data?.fatal){
        try {
          hls.destroy();
          state.hls = null;
          video.src = src;
          video.play().catch(() => showPlayerError("This stream failed in HLS.js and native fallback. Try another channel or open stream."));
        } catch {
          showPlayerError("This stream failed in the browser. Try another channel or open the stream directly.");
        }
      }
    });
  } else {
    video.src = src;
  }

  video.play().catch(() => showPlayerNotice("Press play to start. Some browsers block autoplay."));
}

function showPlayerError(msg){
  const box = $("#playerMessage");
  if(box){ box.textContent = msg; box.classList.add("error"); box.hidden = false; }
}
function showPlayerNotice(msg){
  const box = $("#playerMessage");
  if(box){ box.textContent = msg; box.classList.remove("error"); box.hidden = false; }
}

function renderPlayer(){
  const c = state.active;
  const favs = getFavs();
  const isFav = c && favs.has(channelId(c));
  const player = $("#playerPanel");
  if(!player) return;

  player.innerHTML = c ? `
    <div class="player-header">
      <div class="channel-identity">
        <div class="logo-box">${c.logo ? `<img src="${esc(c.logo)}" alt="">` : `<span>${esc((c.name || "?").slice(0,1))}</span>`}</div>
        <div>
          <div class="eyebrow">${esc(c.sourceLabel)} · ${esc(c.countryName)} · ${esc(c.group || "General")} · ${esc(c.streamType.toUpperCase())}</div>
          <h2>${esc(c.name)}</h2>
        </div>
      </div>
      <div class="player-actions">
        <button class="pill-btn ${isFav ? "active" : ""}" data-action="fav-active">${isFav ? "Saved ★" : "Save ★"}</button>
        <a class="pill-btn link-pill" href="${esc(c.url)}" target="_blank" rel="noopener noreferrer">Open stream</a>
      </div>
    </div>
    <div class="video-wrap">
      <video id="videoPlayer" controls playsinline></video>
      <div id="playerMessage" class="player-message" hidden></div>
    </div>
    <p class="small-note">If this stream fails here but works in another player, it may need codecs, headers, redirects, DRM, app-level proxying, or native-player behaviour browsers do not expose.</p>
  ` : `
    <div class="empty-player">
      <h2>Choose a channel</h2>
      <p>Select a source, country and channel. For world TV use IPTV-org. For Spanish TV, use TDTChannels Spain TV catalogue.</p>
    </div>`;
}

function renderShell(){
  document.body.innerHTML = `
    <div class="app-shell">
      <header class="topbar">
        <div class="brand" data-nav="browse">
          <div class="logo-mark">TV</div>
          <div><strong>WorldTV</strong><span>Multi-source IPTV Player</span></div>
        </div>
        <nav class="nav">
          <button class="nav-btn ${state.section==="browse" ? "active" : ""}" data-nav="browse">Browse</button>
          <button class="nav-btn ${state.section==="favourites" ? "active" : ""}" data-nav="favourites">Favourites</button>
          <button class="nav-btn ${state.section==="recent" ? "active" : ""}" data-nav="recent">Recent</button>
          <button class="nav-btn ${state.section==="about" ? "active" : ""}" data-nav="about">About</button>
        </nav>
      </header>
      <main>
        <section id="playerPanel" class="player-panel"></section>
        <section id="contentPanel"></section>
      </main>
    </div>`;
  renderPlayer();

  if(state.loading){
    $("#contentPanel").innerHTML = `<section class="loading-card"><div class="loader"></div><h1>Loading channels…</h1><p>${esc(currentSource().label)} · ${esc(sourceNeedsCountry() ? countryLabel(state.country) : "full source")}</p></section>`;
  }
}

function sourceOptions(){
  return Object.entries(SOURCES).map(([key, src]) => `<option value="${esc(key)}" ${state.sourceKey===key?"selected":""}>${esc(src.label)}</option>`).join("");
}

function countryOptions(){
  if(sourceIsSpainOnly()){
    return `<option value="ES" selected>Spain only</option>`;
  }

  if(sourceNeedsCountry()){
    return COUNTRY_CODES.map(code => `<option value="${esc(code)}" ${state.country===code?"selected":""}>${esc(countryLabel(code))}</option>`).join("");
  }

  const loaded = countriesInLoadedSource();
  const dynamic = loaded.length ? loaded.map(([code,count]) => `<option value="${esc(code)}" ${state.country===code?"selected":""}>${esc(countryLabel(code))} (${count})</option>`).join("") : "";
  return `<option value="All" ${state.country==="All"?"selected":""}>All countries</option>${dynamic}`;
}

function topControls(){
  return `<section class="controls-card">
    <div class="controls-grid enhanced">
      <label><span>Source</span><select id="sourceSelect">${sourceOptions()}</select></label>
      <label><span>Country</span><select id="countrySelect">${countryOptions()}</select></label>
      <label><span>Category</span><select id="groupSelect">
        ${currentGroups().map(g => `<option value="${esc(g)}" ${state.group===g?"selected":""}>${esc(g)}</option>`).join("")}
      </select></label>
      <label><span>Search</span><input id="searchBox" type="search" placeholder="Search channel, category, format..." value="${esc(state.query)}"></label>
      <button id="clearFilters" class="pill-btn">Clear</button>
    </div>
    <div class="source-line"><strong>${esc(currentSource().description)}</strong><br>Loaded source: <a href="${esc(state.currentPlaylistUrl || playlistUrl())}" target="_blank" rel="noopener noreferrer">${esc(state.currentPlaylistUrl || playlistUrl())}</a></div>
    ${state.error ? `<div class="warning">${esc(state.error)}</div>` : ""}
  </section>`;
}

function channelCard(c){
  const favs = getFavs();
  const isFav = favs.has(channelId(c));
  return `<article class="channel-card">
    <button class="channel-main" data-action="play" data-id="${esc(channelId(c))}">
      <div class="logo-box">${c.logo ? `<img src="${esc(c.logo)}" alt="" loading="lazy" onerror="this.remove()">` : `<span>${esc((c.name || "?").slice(0,1))}</span>`}</div>
      <div>
        <h3>${esc(c.name)}</h3>
        <p>${esc(c.countryName)} · ${esc(c.group || "General")} · ${esc(c.streamType.toUpperCase())}</p>
      </div>
    </button>
    <button class="fav-btn ${isFav ? "active" : ""}" data-action="fav" data-id="${esc(channelId(c))}">★</button>
  </article>`;
}

function renderBrowse(){
  applyFilters();
  $("#contentPanel").innerHTML = `
    <section class="hero">
      <div>
        <div class="eyebrow">WorldTV v${APP_VERSION}</div>
        <h1>Switch source. Pick country. Watch live TV.</h1>
        <p>v1.2.2 cleans up sources: IPTV-org for world TV, TDTChannels as Spain-only backup.</p>
      </div>
      <button class="pill-btn" id="refreshPlaylist">Refresh playlist</button>
    </section>
    ${topControls()}
    <section class="result-head"><h2>${state.filtered.length} channels</h2><p>${esc(currentSource().label)} · ${esc(sourceNeedsCountry() ? countryLabel(state.country) : (state.country==="All" ? "All countries" : countryLabel(state.country)))}${state.group==="All" ? "" : " · " + esc(state.group)}</p></section>
    <section class="channel-grid">${state.filtered.map(channelCard).join("") || `<div class="empty-card">No channels found.</div>`}</section>`;
}

function renderFavourites(){
  const favs = getFavs();
  const arr = state.channels.filter(c => favs.has(channelId(c)));
  $("#contentPanel").innerHTML = `<section class="page-head"><div><h1>Favourites</h1><p>${arr.length} saved channel${arr.length===1?"":"s"} in the currently loaded source.</p></div></section><section class="channel-grid">${arr.map(channelCard).join("") || `<div class="empty-card">No favourites in this loaded source yet.</div>`}</section>`;
}

function renderRecent(){
  const rec = getRecent();
  const arr = rec.map(r => state.channels.find(c => channelId(c) === r.id) || r).filter(Boolean);
  $("#contentPanel").innerHTML = `<section class="page-head"><div><h1>Recent</h1><p>Your last watched channels on this device.</p></div></section><section class="channel-grid">${arr.map(channelCard).join("") || `<div class="empty-card">No recent channels yet.</div>`}</section>`;
}

function renderAbout(){
  const loadedCountries = countriesInLoadedSource().length;
  $("#contentPanel").innerHTML = `
    <section class="about-card">
      <h1>About WorldTV</h1>
      <p>WorldTV is a clean browser player for public IPTV playlists. v1.2.2 removes confusing broken TDT official sources and keeps TDTChannels clearly Spain-only.</p>
      <div class="stat-grid">
        <div><strong>${state.channels.length}</strong><span>loaded channels</span></div>
        <div><strong>${loadedCountries}</strong><span>countries in source</span></div>
        <div><strong>${getFavs().size}</strong><span>favourites</span></div>
      </div>
      <div class="notes">
        <p><strong>TDT note:</strong> TDTChannels is Spain-focused, not a world-TV source. The official TDT M3U links were removed from the main source list because they can be blocked by browser CORS from GitHub Pages.</p>
        <p><strong>Why another player may play more:</strong> native IPTV apps can support more codecs, headers, redirects, DRM cases or non-browser playback behaviour.</p>
        <p><strong>Still normal:</strong> some streams fail because they are offline, geo-blocked, browser-incompatible, overloaded, or changed by the provider.</p>
      </div>
    </section>`;
}

function render(){
  if(!document.querySelector(".app-shell")) renderShell();
  renderPlayer();
  $$(".nav-btn").forEach(b => b.classList.toggle("active", b.dataset.nav === state.section));
  if(state.loading) return;
  if(state.section === "browse") renderBrowse();
  if(state.section === "favourites") renderFavourites();
  if(state.section === "recent") renderRecent();
  if(state.section === "about") renderAbout();
}

function findById(key){ return state.channels.find(c => channelId(c) === key); }

function handleClick(e){
  const nav = e.target.closest("[data-nav]");
  if(nav){ state.section = nav.dataset.nav; render(); return; }

  const action = e.target.closest("[data-action]");
  if(action){
    const act = action.dataset.action;
    const key = action.dataset.id;
    if(act === "play"){ const c = findById(key); if(c) playChannel(c); }
    if(act === "fav"){ const c = findById(key); if(c) toggleFav(c); }
    if(act === "fav-active" && state.active) toggleFav(state.active);
    return;
  }

  if(e.target.id === "clearFilters"){
    state.group = "All";
    state.query = "";
    if(!sourceNeedsCountry()) state.country = "All";
    applyFilters();
    renderBrowse();
  }

  if(e.target.id === "refreshPlaylist") loadPlaylist(true);
}

function handleInput(e){
  if(e.target.id === "searchBox"){
    state.query = e.target.value || "";
    applyFilters();
    renderBrowse();
  }
}

function handleChange(e){
  if(e.target.id === "sourceSelect"){
    state.sourceKey = e.target.value || "iptv-country";
    localStorage.setItem(STORAGE.source, state.sourceKey);
    const src = currentSource();
    state.country = src.forcedCountry || (src.type === "country-m3u" ? (localStorage.getItem(STORAGE.country) || src.defaultCountry || "ES") : "All");
    state.group = "All";
    state.query = "";
    state.active = null;
    loadPlaylist(true);
  }

  if(e.target.id === "countrySelect"){
    state.country = sourceIsSpainOnly() ? "ES" : (e.target.value || (sourceNeedsCountry() ? "ES" : "All"));
    localStorage.setItem(STORAGE.country, state.country);
    state.group = "All";
    state.query = "";
    state.active = null;
    if(sourceNeedsCountry()) loadPlaylist(true);
    else { applyFilters(); renderBrowse(); }
  }

  if(e.target.id === "groupSelect"){
    state.group = e.target.value || "All";
    applyFilters();
    renderBrowse();
  }
}

function boot(){
  renderShell();
  document.addEventListener("click", handleClick);
  document.addEventListener("input", handleInput);
  document.addEventListener("change", handleChange);
  if("serviceWorker" in navigator) navigator.serviceWorker.register("./service-worker.js").catch(()=>{});
  loadPlaylist();
}

document.addEventListener("DOMContentLoaded", boot);
