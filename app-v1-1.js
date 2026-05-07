
const INDEX_PLAYLIST_URL = "https://iptv-org.github.io/iptv/index.m3u";
const COUNTRY_PLAYLIST_BASE = "https://iptv-org.github.io/iptv/countries/";
const APP_VERSION = "1.1";
const COUNTRY_CODES = ["AF", "AL", "DZ", "AD", "AO", "AR", "AM", "AW", "AU", "AT", "AZ", "BS", "BH", "BD", "BB", "BY", "BE", "BZ", "BJ", "BM", "BT", "BO", "BA", "BW", "BR", "BN", "BG", "BF", "BI", "KH", "CM", "CA", "CV", "KY", "CF", "TD", "CL", "CN", "CO", "CR", "HR", "CU", "CW", "CY", "CZ", "DK", "DO", "EC", "EG", "SV", "EE", "ET", "FI", "FR", "GE", "DE", "GH", "GR", "GT", "HK", "HU", "IS", "IN", "ID", "IR", "IQ", "IE", "IL", "IT", "JM", "JP", "JO", "KZ", "KE", "KR", "KW", "KG", "LA", "LV", "LB", "LT", "LU", "MO", "MK", "MY", "MX", "MD", "MN", "ME", "MA", "MM", "NP", "NL", "NZ", "NG", "NO", "PK", "PS", "PA", "PY", "PE", "PH", "PL", "PT", "PR", "QA", "RO", "RU", "SA", "RS", "SG", "SK", "SI", "ZA", "ES", "LK", "SE", "CH", "SY", "TW", "TJ", "TH", "TN", "TR", "UA", "AE", "GB", "US", "UY", "UZ", "VE", "VN", "YE"];
const STORAGE = {
  favs: "worldtv_favourites_v1",
  recent: "worldtv_recent_v1",
  country: "worldtv_last_country_v1"
};

const regionNames = typeof Intl !== "undefined" && Intl.DisplayNames ? new Intl.DisplayNames(["en"], { type: "region" }) : null;
const state = {
  channels: [],
  filtered: [],
  country: localStorage.getItem(STORAGE.country) || "All",
  group: "All",
  query: "",
  section: "browse",
  active: null,
  loading: true,
  error: "",
  hls: null,
  currentPlaylistUrl: ""
};

const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;" }[c]));
const norm = s => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const safeParse = (k,f) => { try { const r = localStorage.getItem(k); return r ? JSON.parse(r) : f; } catch { return f; } };
const saveJSON = (k,v) => localStorage.setItem(k, JSON.stringify(v));
const channelId = c => `${c.name}::${c.url}`;

function getFavs(){ return new Set(safeParse(STORAGE.favs, [])); }
function setFavs(s){ saveJSON(STORAGE.favs, [...s]); }
function getRecent(){ return safeParse(STORAGE.recent, []); }
function setRecent(arr){ saveJSON(STORAGE.recent, arr.slice(0, 30)); }
function countryLabel(code){
  if(!code || code === "All") return "All countries";
  if(code === "INT") return "International";
  try { return regionNames ? regionNames.of(code) || code : code; } catch { return code; }
}
function playlistUrlForCountry(code){
  return code === "All" ? INDEX_PLAYLIST_URL : `${COUNTRY_PLAYLIST_BASE}${String(code).toLowerCase()}.m3u`;
}
function toggleFav(c){ const favs=getFavs(); const key=channelId(c); favs.has(key) ? favs.delete(key) : favs.add(key); setFavs(favs); render(); }

function parseAttrs(line){
  const attrs = {};
  const re = /([\w-]+)="([^"]*)"/g;
  let m;
  while((m = re.exec(line))) attrs[m[1]] = m[2];
  return attrs;
}

function inferCountry(attrs, name, forcedCountry){
  if(forcedCountry && forcedCountry !== "All") return forcedCountry;
  const explicit = attrs["tvg-country"] || attrs["country"] || attrs["countries"] || "";
  const first = explicit.split(/[;,]/).map(x => x.trim().toUpperCase()).find(x => /^[A-Z]{2}$/.test(x));
  return first || "INT";
}

function parseM3U(text, forcedCountry="All"){
  const lines = text.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
  const channels = [];

  for(let i=0;i<lines.length;i++){
    const line = lines[i];
    if(!line.startsWith("#EXTINF")) continue;

    const attrs = parseAttrs(line);
    const comma = line.indexOf(",");
    const displayName = comma >= 0 ? line.slice(comma + 1).trim() : "";
    let url = "";

    for(let j=i+1;j<Math.min(lines.length, i+7);j++){
      if(lines[j] && !lines[j].startsWith("#")){
        url = lines[j].trim();
        break;
      }
    }

    if(!url || !/^https?:\/\//i.test(url)) continue;

    const name = attrs["tvg-name"] || displayName || attrs["tvg-id"] || "Unknown channel";
    const group = attrs["group-title"] || "General";
    const logo = attrs["tvg-logo"] || "";
    const country = inferCountry(attrs, name, forcedCountry);

    channels.push({
      name, group, logo, url, country,
      countryName: countryLabel(country),
      tvgId: attrs["tvg-id"] || "",
      lang: attrs["tvg-language"] || attrs["language"] || "",
      raw: line
    });
  }

  return channels.filter(c => c.name && c.url).sort((a,b) => a.name.localeCompare(b.name));
}

async function loadPlaylist(force=false){
  state.loading = true;
  state.error = "";
  state.channels = [];
  state.filtered = [];
  state.currentPlaylistUrl = playlistUrlForCountry(state.country);
  renderShell();

  try{
    const r = await fetch(state.currentPlaylistUrl, { cache: force ? "reload" : "no-store" });
    if(!r.ok) throw new Error(`Playlist returned ${r.status}`);
    const text = await r.text();

    state.channels = parseM3U(text, state.country);
    state.loading = false;
    applyFilters();
    render();
  }catch(err){
    state.loading = false;
    state.error = `Could not load ${countryLabel(state.country)} playlist. Try refreshing, choose All countries, or try another country. Details: ${err.message || err}`;
    render();
  }
}

function currentGroups(){
  return ["All", ...new Set(state.channels.map(c => c.group || "General"))].sort((a,b) => a.localeCompare(b));
}

function applyFilters(){
  const q = norm(state.query);
  state.filtered = state.channels.filter(c => {
    const groupOk = state.group === "All" || c.group === state.group;
    const text = norm([c.name,c.group,c.countryName,c.lang,c.tvgId].join(" "));
    return groupOk && (!q || text.includes(q));
  });
}

function addRecent(c){
  const rec = getRecent().filter(x => x.id !== channelId(c));
  rec.unshift({ id: channelId(c), name:c.name, country:c.country, countryName:c.countryName, group:c.group, logo:c.logo, url:c.url, at: new Date().toISOString() });
  setRecent(rec);
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

  if(state.hls){
    try { state.hls.destroy(); } catch {}
    state.hls = null;
  }

  const src = c.url;
  video.poster = "";
  video.removeAttribute("src");
  video.load();

  const isHls = /\.m3u8($|\?)/i.test(src) || src.includes(".m3u8");
  if(isHls && window.Hls && Hls.isSupported()){
    const hls = new Hls({ lowLatencyMode:true, backBufferLength:60, maxBufferLength:30, enableWorker:true });
    state.hls = hls;
    hls.loadSource(src);
    hls.attachMedia(video);
    hls.on(Hls.Events.ERROR, (_, data) => {
      if(data?.fatal) showPlayerError("This stream failed in the browser. Try another channel or open the stream directly.");
    });
  } else if(video.canPlayType("application/vnd.apple.mpegurl") || !isHls) {
    video.src = src;
  } else {
    showPlayerError("This browser cannot play this stream format.");
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
          <div class="eyebrow">${esc(c.countryName)} · ${esc(c.group || "General")}</div>
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
    <p class="small-note">Streams are provided by IPTV-org country playlists. Availability can vary by country, browser, provider and time.</p>
  ` : `
    <div class="empty-player">
      <h2>Choose a channel</h2>
      <p>Select a country, pick a channel, and it will play here.</p>
    </div>`;
}

function renderShell(){
  document.body.innerHTML = `
    <div class="app-shell">
      <header class="topbar">
        <div class="brand" data-nav="browse">
          <div class="logo-mark">TV</div>
          <div><strong>WorldTV</strong><span>Country IPTV Player</span></div>
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
    $("#contentPanel").innerHTML = `<section class="loading-card"><div class="loader"></div><h1>Loading ${esc(countryLabel(state.country))}…</h1><p>Fetching the ${esc(state.country==="All" ? "main IPTV-org index" : "country-specific IPTV-org playlist")}.</p></section>`;
  }
}

function topControls(){
  return `<section class="controls-card">
    <div class="controls-grid">
      <label><span>Country</span><select id="countrySelect">
        <option value="All" ${state.country==="All"?"selected":""}>All countries / main index</option>
        ${COUNTRY_CODES.map(code => `<option value="${esc(code)}" ${state.country===code?"selected":""}>${esc(countryLabel(code))}</option>`).join("")}
      </select></label>
      <label><span>Category</span><select id="groupSelect">
        ${currentGroups().map(g => `<option value="${esc(g)}" ${state.group===g?"selected":""}>${esc(g)}</option>`).join("")}
      </select></label>
      <label><span>Search</span><input id="searchBox" type="search" placeholder="Search channel, category..." value="${esc(state.query)}"></label>
      <button id="clearFilters" class="pill-btn">Clear</button>
    </div>
    <div class="source-line">Source: <a href="${esc(state.currentPlaylistUrl || playlistUrlForCountry(state.country))}" target="_blank" rel="noopener noreferrer">${esc(state.currentPlaylistUrl || playlistUrlForCountry(state.country))}</a></div>
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
        <p>${esc(c.countryName)} · ${esc(c.group || "General")}</p>
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
        <h1>Choose a country. Watch live TV.</h1>
        <p>Now using IPTV-org country playlists, not weak country guessing from the big index.</p>
      </div>
      <button class="pill-btn" id="refreshPlaylist">Refresh playlist</button>
    </section>
    ${topControls()}
    <section class="result-head"><h2>${state.filtered.length} channels</h2><p>${esc(countryLabel(state.country))}${state.group==="All" ? "" : " · " + esc(state.group)}</p></section>
    <section class="channel-grid">${state.filtered.map(channelCard).join("") || `<div class="empty-card">No channels found.</div>`}</section>`;
}

function renderFavourites(){
  const favs = getFavs();
  const arr = state.channels.filter(c => favs.has(channelId(c)));
  $("#contentPanel").innerHTML = `
    <section class="page-head"><div><h1>Favourites</h1><p>${arr.length} saved channel${arr.length===1?"":"s"} in the currently loaded playlist. Switch country to load other saved-country channels.</p></div></section>
    <section class="channel-grid">${arr.map(channelCard).join("") || `<div class="empty-card">No favourites in this loaded playlist yet.</div>`}</section>`;
}

function renderRecent(){
  const rec = getRecent();
  const arr = rec.map(r => state.channels.find(c => channelId(c) === r.id) || r).filter(Boolean);
  $("#contentPanel").innerHTML = `
    <section class="page-head"><div><h1>Recent</h1><p>Your last watched channels on this device.</p></div></section>
    <section class="channel-grid">${arr.map(channelCard).join("") || `<div class="empty-card">No recent channels yet.</div>`}</section>`;
}

function renderAbout(){
  $("#contentPanel").innerHTML = `
    <section class="about-card">
      <h1>About WorldTV</h1>
      <p>WorldTV is a clean browser player for IPTV-org playlists. v1.1 uses country-specific playlists for better country coverage.</p>
      <div class="stat-grid">
        <div><strong>${state.channels.length}</strong><span>loaded channels</span></div>
        <div><strong>${COUNTRY_CODES.length}</strong><span>country options</span></div>
        <div><strong>${getFavs().size}</strong><span>favourites</span></div>
      </div>
      <div class="notes">
        <p><strong>Why this changed:</strong> the main index playlist is useful for “all channels”, but it is not the cleanest way to infer country. Country playlists are more reliable for country browsing.</p>
        <p><strong>Why some channels fail:</strong> streams can be offline, geo-blocked, browser-incompatible, overloaded, or changed by the provider.</p>
        <p><strong>Main index:</strong> ${esc(INDEX_PLAYLIST_URL)}</p>
        <p><strong>Country playlist pattern:</strong> ${esc(COUNTRY_PLAYLIST_BASE)}xx.m3u</p>
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
  if(nav){
    state.section = nav.dataset.nav;
    render();
    return;
  }

  const action = e.target.closest("[data-action]");
  if(action){
    const act = action.dataset.action;
    const key = action.dataset.id;
    if(act === "play"){
      const c = findById(key);
      if(c) playChannel(c);
    }
    if(act === "fav"){
      const c = findById(key);
      if(c) toggleFav(c);
    }
    if(act === "fav-active" && state.active) toggleFav(state.active);
    return;
  }

  if(e.target.id === "clearFilters"){
    state.group = "All";
    state.query = "";
    applyFilters();
    renderBrowse();
  }

  if(e.target.id === "refreshPlaylist"){
    loadPlaylist(true);
  }
}

function handleInput(e){
  if(e.target.id === "searchBox"){
    state.query = e.target.value || "";
    applyFilters();
    renderBrowse();
  }
}

function handleChange(e){
  if(e.target.id === "countrySelect"){
    state.country = e.target.value || "All";
    localStorage.setItem(STORAGE.country, state.country);
    state.group = "All";
    state.query = "";
    state.active = null;
    loadPlaylist(true);
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
