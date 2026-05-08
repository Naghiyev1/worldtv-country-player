
const APP_VERSION = "1.3.3";

const SOURCES = {
  "auto": {
    label: "Auto-best source",
    description: "Chooses the best available route for the selected country. Spain uses TDTChannels; other countries use IPTV-org country playlists.",
    type: "auto"
  },
  "iptv-country": {
    label: "IPTV-org · World by country",
    description: "Best general world-TV source. Choose a country and load IPTV-org /countries/xx.m3u.",
    type: "country-m3u",
    url: "https://iptv-org.github.io/iptv/countries/{country}.m3u",
    defaultCountry: "ES"
  },
  "iptv-language": {
    label: "IPTV-org · By language",
    description: "Loads IPTV-org language playlists. Useful when country lists are weak.",
    type: "language-m3u",
    url: "https://iptv-org.github.io/iptv/languages/{language}.m3u",
    defaultLanguage: "spa"
  },
  "iptv-category": {
    label: "IPTV-org · By category",
    description: "Loads IPTV-org category playlists such as news, sports, movies, kids and music.",
    type: "category-m3u",
    url: "https://iptv-org.github.io/iptv/categories/{category}.m3u",
    defaultCategory: "news"
  },
  "iptv-index": {
    label: "IPTV-org · Full global index",
    description: "Loads IPTV-org index.m3u. Biggest global list, but slower and messier.",
    type: "global-m3u",
    url: "https://iptv-org.github.io/iptv/index.m3u"
  },
  "free-tv-global": {
    label: "Free-TV/IPTV · Global backup",
    description: "Global backup playlist from the Free-TV/IPTV project.",
    type: "global-m3u",
    url: "https://raw.githubusercontent.com/Free-TV/IPTV/master/playlist.m3u8"
  },
  "tdt-spain": {
    label: "TDTChannels · Spain TV catalogue",
    description: "Spain-focused curated TV catalogue from TDTChannels GitHub. Not a world-TV source.",
    type: "tdt-md",
    forcedCountry: "ES",
    url: "https://raw.githubusercontent.com/LaQuay/TDTChannels/master/TELEVISION.md"
  }
};

const COUNTRY_CODES = ["AF", "AL", "DZ", "AD", "AO", "AR", "AM", "AU", "AT", "AZ", "BH", "BD", "BY", "BE", "BO", "BA", "BR", "BG", "CA", "CL", "CN", "CO", "CR", "HR", "CY", "CZ", "DK", "EC", "EG", "EE", "FI", "FR", "GE", "DE", "GR", "HK", "HU", "IS", "IN", "ID", "IR", "IQ", "IE", "IL", "IT", "JP", "JO", "KZ", "KR", "KW", "LV", "LB", "LT", "LU", "MY", "MX", "MD", "ME", "MA", "NL", "NZ", "NG", "NO", "PK", "PS", "PA", "PY", "PE", "PH", "PL", "PT", "QA", "RO", "RU", "SA", "RS", "SG", "SK", "SI", "ZA", "ES", "SE", "CH", "TW", "TH", "TN", "TR", "UA", "AE", "GB", "US", "UY", "UZ", "VE", "VN"];

const LANGUAGE_OPTIONS = [
  ["spa","Spanish"], ["eng","English"], ["fra","French"], ["deu","German"], ["ita","Italian"],
  ["por","Portuguese"], ["jpn","Japanese"], ["zho","Chinese"], ["ara","Arabic"], ["rus","Russian"],
  ["kor","Korean"], ["tur","Turkish"], ["hin","Hindi"]
];

const CATEGORY_OPTIONS = [
  ["news","News"], ["sports","Sports"], ["movies","Movies"], ["series","Series"], ["documentary","Documentary"],
  ["kids","Kids"], ["music","Music"], ["entertainment","Entertainment"], ["business","Business"],
  ["education","Education"], ["lifestyle","Lifestyle"], ["general","General"]
];

const MATURE_TERMS = ["adult","xxx","18+","18 plus","erotic","erotica","porn","porno","sex","sexy"];

const STORAGE = {
  favs: "worldtv_favourites_v133",
  recent: "worldtv_recent_v133",
  source: "worldtv_source_v133",
  country: "worldtv_country_v133"
};

const regionNames = typeof Intl !== "undefined" && Intl.DisplayNames ? new Intl.DisplayNames(["en"], { type: "region" }) : null;

const state = {
  sourceKey: localStorage.getItem(STORAGE.source) || "auto",
  country: localStorage.getItem(STORAGE.country) || "ES",
  language: localStorage.getItem("worldtv_language_v133") || "spa",
  category: localStorage.getItem("worldtv_category_v133") || "news",
  hideMature: localStorage.getItem("worldtv_hide_mature_v133") !== "false",
  resolvedSourceKey: "",
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
function setRecent(arr){ saveJSON(STORAGE.recent, arr.slice(0, 50)); }

function countryLabel(code){
  if(!code || code === "All") return "All countries";
  if(code === "INT") return "International";
  try { return regionNames ? regionNames.of(code) || code : code; } catch { return code; }
}

function selectedSource(){ return SOURCES[state.sourceKey] || SOURCES["auto"]; }
function resolveSourceKey(){
  if(state.sourceKey !== "auto") return state.sourceKey;
  return state.country === "ES" ? "tdt-spain" : "iptv-country";
}
function resolvedSource(){
  return SOURCES[resolveSourceKey()] || SOURCES["iptv-country"];
}
function sourceNeedsCountry(){
  const s = resolvedSource();
  return s.type === "country-m3u" || selectedSource().type === "auto";
}
function sourceNeedsLanguage(){ return resolvedSource().type === "language-m3u"; }
function sourceNeedsCategory(){ return resolvedSource().type === "category-m3u"; }
function sourceIsSpainOnly(){
  const s = resolvedSource();
  return Boolean(s.forcedCountry === "ES");
}
function playlistUrl(){
  const src = resolvedSource();
  if(src.type === "country-m3u") return src.url.replace("{country}", String(state.country || src.defaultCountry || "ES").toLowerCase());
  if(src.type === "language-m3u") return src.url.replace("{language}", String(state.language || src.defaultLanguage || "spa").toLowerCase());
  if(src.type === "category-m3u") return src.url.replace("{category}", String(state.category || src.defaultCategory || "news").toLowerCase());
  return src.url;
}
function getFavObjects(){ return safeParse(STORAGE.favs + "_objects", []); }
function setFavObjects(arr){ saveJSON(STORAGE.favs + "_objects", arr); }

function compactChannel(c){
  return {
    id: channelId(c),
    name: c.name,
    group: c.group,
    logo: c.logo,
    url: c.url,
    country: c.country,
    countryName: c.countryName,
    tvgId: c.tvgId,
    lang: c.lang,
    sourceKey: c.sourceKey,
    sourceMode: c.sourceMode,
    sourceLabel: c.sourceLabel,
    streamType: c.streamType,
    savedAt: new Date().toISOString()
  };
}

function toggleFav(c){
  const favs = getFavs();
  const key = channelId(c);
  let objects = getFavObjects().filter(x => x.id !== key);
  if(favs.has(key)){
    favs.delete(key);
  } else {
    favs.add(key);
    objects.unshift(compactChannel(c));
  }
  setFavs(favs);
  setFavObjects(objects);
  render();
}

function isMatureChannel(c){
  const text = norm([c.name, c.group, c.tvgId, c.lang].join(" "));
  return MATURE_TERMS.some(t => text.includes(norm(t)));
}

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
  if(first) return first;

  const group = norm(attrs["group-title"] || "");
  const n = norm(name || "");
  for(const code of COUNTRY_CODES){
    const label = norm(countryLabel(code));
    if(group.includes(label) || n.includes(label)) return code;
  }
  return "INT";
}

function classifyType(url){
  const u = String(url || "").toLowerCase();
  if(u.includes(".mpd")) return "dash";
  if(u.includes(".m3u8")) return "hls";
  if(u.includes(".mp4") || u.includes(".m4v") || u.includes(".webm") || u.includes(".ogv") || u.includes(".mp3") || u.includes(".aac")) return "file";
  return "unknown";
}

function makeChannel({name, group, logo, url, country, tvgId, lang}, source){
  const srcKey = state.resolvedSourceKey || resolveSourceKey();
  const src = source || resolvedSource();
  return {
    name,
    group: group || "General",
    logo: logo || "",
    url,
    country: country || "INT",
    countryName: countryLabel(country || "INT"),
    tvgId: tvgId || "",
    lang: lang || "",
    sourceKey: srcKey,
    sourceMode: state.sourceKey,
    sourceLabel: src.label,
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

    channels.push(makeChannel({
      name,
      group,
      logo,
      url,
      country,
      tvgId: attrs["tvg-id"] || "",
      lang: attrs["tvg-language"] || attrs["language"] || ""
    }, source));

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
    if(!line.includes("](") || !(line.includes("m3u8") || line.includes("stream") || line.includes("mpd"))) continue;

    const firstLink = line.match(/\[(m3u8|stream|mpd)[^\]]*\]\((https?:\/\/[^\)]+)\)/i);
    if(!firstLink) continue;
    const url = firstLink[2];

    let name = line.split("[")[0].replace(/\|/g, "").trim();
    name = name.replace(/^-\s*/, "").trim();
    if(!name || name.length > 90) continue;

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
    }, source));
  }

  return dedupeSort(channels);
}

async function fetchPlaylistFor(sourceKey){
  state.resolvedSourceKey = sourceKey;
  const src = SOURCES[sourceKey];
  state.currentPlaylistUrl = playlistUrl();

  const r = await fetch(state.currentPlaylistUrl, { cache: "no-store" });
  if(!r.ok) throw new Error(`${src.label} returned ${r.status}`);
  const text = await r.text();

  if(src.type === "tdt-md") return parseTdtMarkdown(text, src);
  return parseM3U(text, src);
}

async function loadPlaylist(force=false){
  state.loading = true;
  state.error = "";
  state.channels = [];
  state.filtered = [];
  state.active = null;
  state.resolvedSourceKey = resolveSourceKey();
  state.currentPlaylistUrl = playlistUrl();
  renderShell();

  try{
    let channels = await fetchPlaylistFor(state.resolvedSourceKey);

    // If Auto mode selects TDT Spain but it fails to parse, fall back to IPTV-org Spain.
    if(state.sourceKey === "auto" && state.country === "ES" && channels.length === 0){
      state.error = "TDTChannels returned no channels, so Auto mode fell back to IPTV-org Spain.";
      channels = await fetchPlaylistFor("iptv-country");
    }

    state.channels = channels;
    state.loading = false;
    applyFilters();
    render();
  }catch(err){
    if(state.sourceKey === "auto"){
      try {
        state.error = `Auto source failed (${err.message || err}), so it fell back to IPTV-org country playlist.`;
        state.resolvedSourceKey = "iptv-country";
        const channels = await fetchPlaylistFor("iptv-country");
        state.channels = channels;
        state.loading = false;
        applyFilters();
        render();
        return;
      } catch(fallbackErr) {
        state.error = `Auto source and fallback both failed. Details: ${fallbackErr.message || fallbackErr}`;
      }
    } else {
      state.error = `Could not load playlist. Try Auto-best source or IPTV-org country mode. Details: ${err.message || err}`;
    }
    state.loading = false;
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
    const countryOk = sourceNeedsCountry() || sourceIsSpainOnly() || state.country === "All" || c.country === state.country;
    const text = norm([c.name,c.group,c.countryName,c.lang,c.tvgId,c.sourceLabel,c.streamType].join(" "));
    return groupOk && countryOk && (!q || text.includes(q));
  });
}

function addRecent(c){
  const rec = getRecent().filter(x => x.id !== channelId(c));
  rec.unshift({
    id: channelId(c),
    sourceKey:c.sourceKey,
    sourceMode:c.sourceMode,
    sourceLabel:c.sourceLabel,
    name:c.name,
    country:c.country,
    countryName:c.countryName,
    group:c.group,
    logo:c.logo,
    url:c.url,
    streamType:c.streamType,
    at:new Date().toISOString()
  });
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

  const msgBox = $("#playerMessage");
  if(msgBox){
    msgBox.hidden = true;
    msgBox.textContent = "";
    msgBox.classList.remove("error");
  }

  const src = c.url;
  const type = classifyType(src);

  video.pause();
  video.removeAttribute("src");
  video.load();

  const safePlay = () => {
    try {
      const attempt = video.play();
      if(attempt && typeof attempt.catch === "function"){
        attempt.catch(() => {
          // Autoplay can be blocked. User can press native play button.
        });
      }
    } catch {}
  };

  if(type === "dash" && window.dashjs){
    try{
      const player = dashjs.MediaPlayer().create();
      state.dash = player;
      player.initialize(video, src, false);
      player.on(dashjs.MediaPlayer.events.STREAM_INITIALIZED, safePlay);
      player.on(dashjs.MediaPlayer.events.ERROR, () => {
        showPlayerError("This DASH/MPD stream failed in the browser. Try another channel or open the stream.");
      });
      return;
    }catch(e){
      showPlayerError("DASH player failed to initialise. Try opening the stream directly.");
      return;
    }
  }

  if(type === "hls" && window.Hls && Hls.isSupported()){
    try{
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 60,
        maxBufferLength: 30
      });

      state.hls = hls;

      hls.attachMedia(video);
      hls.on(Hls.Events.MEDIA_ATTACHED, () => {
        hls.loadSource(src);
      });
      hls.on(Hls.Events.MANIFEST_PARSED, safePlay);
      hls.on(Hls.Events.ERROR, (_, data) => {
        if(!data?.fatal) return;

        if(data.type === Hls.ErrorTypes.NETWORK_ERROR){
          try { hls.startLoad(); return; } catch {}
        }

        if(data.type === Hls.ErrorTypes.MEDIA_ERROR){
          try { hls.recoverMediaError(); return; } catch {}
        }

        showPlayerError("This HLS stream failed in the browser. Try another channel or open the stream.");
      });
      return;
    }catch(e){
      showPlayerError("HLS player failed to initialise. Try opening the stream directly.");
      return;
    }
  }

  // Native fallback, including Safari native HLS.
  video.src = src;
  video.load();
  video.addEventListener("loadedmetadata", safePlay, { once:true });
  video.addEventListener("error", () => {
    showPlayerError("The browser could not play this stream directly. Try another channel or open the stream.");
  }, { once:true });
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
      <p>Use Auto-best source, choose a country, then pick a channel. Spain gets TDTChannels first; other countries use IPTV-org country playlists.</p>
    </div>`;
}

function renderShell(){
  document.body.innerHTML = `
    <div class="app-shell">
      <header class="topbar">
        <div class="brand" data-nav="browse">
          <div class="logo-mark">TV</div>
          <div><strong>WorldTV</strong><span>Source Router IPTV Player</span></div>
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
    $("#contentPanel").innerHTML = `<section class="loading-card"><div class="loader"></div><h1>Loading channels…</h1><p>${esc(selectedSource().label)} → ${esc(resolvedSource().label)} · ${esc(sourceNeedsCountry() || state.sourceKey === "auto" ? countryLabel(state.country) : "global source")}</p></section>`;
  }
}

function sourceOptions(){
  return Object.entries(SOURCES).map(([key, src]) => `<option value="${esc(key)}" ${state.sourceKey===key?"selected":""}>${esc(src.label)}</option>`).join("");
}

function countryOptions(){
  if(sourceIsSpainOnly() && state.sourceKey !== "auto"){
    return `<option value="ES" selected>Spain only</option>`;
  }

  if(sourceNeedsCountry() || state.sourceKey === "auto"){
    return COUNTRY_CODES.map(code => `<option value="${esc(code)}" ${state.country===code?"selected":""}>${esc(countryLabel(code))}</option>`).join("");
  }

  const loaded = countriesInLoadedSource();
  const dynamic = loaded.length ? loaded.map(([code,count]) => `<option value="${esc(code)}" ${state.country===code?"selected":""}>${esc(countryLabel(code))} (${count})</option>`).join("") : "";
  return `<option value="All" ${state.country==="All"?"selected":""}>All countries</option>${dynamic}`;
}

function languageOptions(){
  return LANGUAGE_OPTIONS.map(([code,label]) => `<option value="${esc(code)}" ${state.language===code?"selected":""}>${esc(label)}</option>`).join("");
}

function categoryOptions(){
  return CATEGORY_OPTIONS.map(([code,label]) => `<option value="${esc(code)}" ${state.category===code?"selected":""}>${esc(label)}</option>`).join("");
}

function extraSourceControl(){
  if(sourceNeedsLanguage()) return `<label><span>Language</span><select id="languageSelect">${languageOptions()}</select></label>`;
  if(sourceNeedsCategory()) return `<label><span>Category list</span><select id="categoryListSelect">${categoryOptions()}</select></label>`;
  return `<label><span>Route option</span><select disabled><option>Default</option></select></label>`;
}

function routeBadge(){
  if(state.sourceKey !== "auto") return "";
  return `<div class="route-badge">Auto route: <strong>${esc(countryLabel(state.country))}</strong> → <strong>${esc(resolvedSource().label)}</strong></div>`;
}

function topControls(){
  return `<section class="controls-card">
    <div class="controls-grid enhanced v133">
      <label><span>Source mode</span><select id="sourceSelect">${sourceOptions()}</select></label>
      <label><span>Country</span><select id="countrySelect">${countryOptions()}</select></label>
      ${extraSourceControl()}
      <label><span>Category filter</span><select id="groupSelect">
        ${currentGroups().map(g => `<option value="${esc(g)}" ${state.group===g?"selected":""}>${esc(g)}</option>`).join("")}
      </select></label>
      <label><span>Search</span><input id="searchBox" type="search" placeholder="Search channel, category, source..." value="${esc(state.query)}"></label>
      <label class="toggle-label"><span>Safety</span><button type="button" id="matureToggle" class="pill-btn ${state.hideMature ? "active" : ""}">${state.hideMature ? "Mature hidden" : "Mature shown"}</button></label>
      <button id="clearFilters" class="pill-btn">Clear</button>
    </div>
    ${routeBadge()}
    <div class="source-line"><strong>${esc(selectedSource().description)}</strong><br>Loaded source: <a href="${esc(state.currentPlaylistUrl || playlistUrl())}" target="_blank" rel="noopener noreferrer">${esc(state.currentPlaylistUrl || playlistUrl())}</a></div>
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
        <h1>Stable sources, global favourites.</h1>
        <p>Favourites now work across sources. Added IPTV-org language/category playlists and a mature-content filter.</p>
      </div>
      <button class="pill-btn" id="refreshPlaylist">Refresh playlist</button>
    </section>
    ${topControls()}
    <section class="result-head"><h2>${state.filtered.length} channels</h2><p>${esc(resolvedSource().label)} · ${esc(sourceNeedsCountry() || state.sourceKey==="auto" ? countryLabel(state.country) : (state.country==="All" ? "All countries" : countryLabel(state.country)))}${state.group==="All" ? "" : " · " + esc(state.group)}</p></section>
    <section class="channel-grid">${state.filtered.map(channelCard).join("") || `<div class="empty-card">No channels found.</div>`}</section>`;
}

function renderFavourites(){
  const arr = getFavObjects();
  $("#contentPanel").innerHTML = `
    <section class="page-head"><div><h1>Favourites</h1><p>${arr.length} saved channel${arr.length===1?"":"s"} across all sources.</p></div></section>
    <section class="channel-grid">${arr.map(channelCard).join("") || `<div class="empty-card">No favourites yet. Save channels with the star button.</div>`}</section>`;
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
      <p>WorldTV is a browser player for public IPTV sources. v1.3.3 keeps the stable player and improves sources, favourites and filtering.</p>
      <div class="stat-grid">
        <div><strong>${state.channels.length}</strong><span>loaded channels</span></div>
        <div><strong>${loadedCountries}</strong><span>countries in source</span></div>
        <div><strong>${getFavs().size}</strong><span>favourites</span></div>
      </div>
      <div class="notes">
        <p><strong>Auto-best:</strong> Spain routes to TDTChannels Spain TV catalogue. Other countries route to IPTV-org country playlists.</p>
        <p><strong>Global backup:</strong> Free-TV/IPTV is included as a separate source because it is not country-router clean, but useful when IPTV-org is weak.</p>
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

function findById(key){
  return state.channels.find(c => channelId(c) === key) || getFavObjects().find(c => c.id === key || channelId(c) === key);
}

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
    if(!sourceNeedsCountry() && state.sourceKey !== "auto") state.country = "All";
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
    state.sourceKey = e.target.value || "auto";
    localStorage.setItem(STORAGE.source, state.sourceKey);
    const src = selectedSource();
    if(src.forcedCountry) state.country = src.forcedCountry;
    else if(src.type === "global-m3u" || src.type === "language-m3u" || src.type === "category-m3u") state.country = "All";
    else state.country = localStorage.getItem(STORAGE.country) || src.defaultCountry || "ES";
    state.group = "All";
    state.query = "";
    state.active = null;
    loadPlaylist(true);
  }

  if(e.target.id === "countrySelect"){
    if(sourceIsSpainOnly() && state.sourceKey !== "auto") state.country = "ES";
    else state.country = e.target.value || (sourceNeedsCountry() || state.sourceKey === "auto" ? "ES" : "All");
    localStorage.setItem(STORAGE.country, state.country);
    state.group = "All";
    state.query = "";
    state.active = null;
    if(sourceNeedsCountry() || state.sourceKey === "auto") loadPlaylist(true);
    else { applyFilters(); renderBrowse(); }
  }

  if(e.target.id === "groupSelect"){
    state.group = e.target.value || "All";
    applyFilters();
    renderBrowse();
  }

  if(e.target.id === "languageSelect"){
    state.language = e.target.value || "spa";
    localStorage.setItem("worldtv_language_v133", state.language);
    state.group = "All";
    state.query = "";
    state.active = null;
    loadPlaylist(true);
  }

  if(e.target.id === "categoryListSelect"){
    state.category = e.target.value || "news";
    localStorage.setItem("worldtv_category_v133", state.category);
    state.group = "All";
    state.query = "";
    state.active = null;
    loadPlaylist(true);
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
