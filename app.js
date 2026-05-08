const APP_VERSION="1.4";
const SOURCE_DEFS={
"tdt-spain":{label:"TDTChannels · Spain TV catalogue",short:"TDTChannels",quality:"Stable Spain source",type:"tdt-md",forcedCountry:"ES",url:"https://raw.githubusercontent.com/LaQuay/TDTChannels/master/TELEVISION.md"},
"iptv-country":{label:"IPTV-org · World by country",short:"IPTV-org country",quality:"Main world source",type:"country-m3u",url:"https://iptv-org.github.io/iptv/countries/{country}.m3u",defaultCountry:"ES"},
"free-tv-country":{label:"Free-TV/IPTV · Country backup",short:"Free-TV country",quality:"Backup source",type:"free-country-m3u",url:"https://raw.githubusercontent.com/Free-TV/IPTV/master/playlists/playlist_{countryName}.m3u8"},
"free-tv-global":{label:"Free-TV/IPTV · Global backup",short:"Free-TV global",quality:"Global backup",type:"global-m3u",url:"https://raw.githubusercontent.com/Free-TV/IPTV/master/playlist.m3u8"},
"iptv-index":{label:"IPTV-org · Full global index",short:"IPTV-org index",quality:"Big global fallback",type:"global-m3u",url:"https://iptv-org.github.io/iptv/index.m3u"}
};
const SOURCE_MODES={auto:{label:"Auto-best source",description:"Tries the best source route for the selected country and falls back if needed."},"iptv-country":SOURCE_DEFS["iptv-country"],"free-tv-country":SOURCE_DEFS["free-tv-country"],"free-tv-global":SOURCE_DEFS["free-tv-global"],"iptv-index":SOURCE_DEFS["iptv-index"],"tdt-spain":SOURCE_DEFS["tdt-spain"]};
const COUNTRY_CODES=["AR","AU","BR","CA","CL","CO","DE","ES","FR","GB","IN","IT","JP","MX","PE","PT","US","VE","AF","AL","DZ","AT","BE","BO","CH","CN","CZ","DK","EC","EG","FI","GR","HK","HU","IE","IL","KR","NL","NO","PL","QA","RO","RU","SA","SE","SG","TR","UA","AE","UY","VN"];
const FREE_TV_COUNTRY_SLUGS={AR:"argentina",AU:"australia",BR:"brazil",CA:"canada",CL:"chile",CO:"colombia",DE:"germany",ES:"spain",FR:"france",GB:"uk",IN:"india",IT:"italy",JP:"japan",MX:"mexico",PE:"peru",PT:"portugal",US:"us",VE:"venezuela"};
const STORAGE={favs:"worldtv_favourites_v14",recent:"worldtv_recent_v14",sourceMode:"worldtv_source_mode_v14",country:"worldtv_country_v14",health:"worldtv_stream_health_v14",lastWorking:"worldtv_last_working_source_v14"};
const regionNames=typeof Intl!=="undefined"&&Intl.DisplayNames?new Intl.DisplayNames(["en"],{type:"region"}):null;
const state={sourceMode:localStorage.getItem(STORAGE.sourceMode)||"auto",country:localStorage.getItem(STORAGE.country)||"ES",channels:[],filtered:[],group:"All",format:"All",query:"",section:"browse",active:null,loading:true,error:"",routeMessages:[],hls:null,dash:null,currentSourceKey:"",currentPlaylistUrl:""};
const $=s=>document.querySelector(s),$$=s=>Array.from(document.querySelectorAll(s));
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
const norm=s=>String(s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
const safeParse=(k,f)=>{try{const r=localStorage.getItem(k);return r?JSON.parse(r):f}catch{return f}};
const saveJSON=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
const channelId=c=>`${c.sourceKey}::${c.name}::${c.url}`;
function getFavs(){return new Set(safeParse(STORAGE.favs,[]))}function setFavs(s){saveJSON(STORAGE.favs,[...s])}
function getRecent(){return safeParse(STORAGE.recent,[])}function setRecent(a){saveJSON(STORAGE.recent,a.slice(0,50))}
function getHealth(){return safeParse(STORAGE.health,{})}function setHealth(h){saveJSON(STORAGE.health,h)}
function healthFor(c){return getHealth()[channelId(c)]||"unknown"}function markHealth(c,status){const h=getHealth();h[channelId(c)]=status;setHealth(h)}
function markLastWorking(c){const m=safeParse(STORAGE.lastWorking,{});m[c.country||state.country]=c.sourceKey;saveJSON(STORAGE.lastWorking,m)}
function countryLabel(code){if(!code||code==="All")return"All countries";if(code==="INT")return"International";try{return regionNames?regionNames.of(code)||code:code}catch{return code}}
function freeTvSlug(code){return FREE_TV_COUNTRY_SLUGS[code]||countryLabel(code).toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_|_$/g,"")}
function currentSourceMode(){return SOURCE_MODES[state.sourceMode]||SOURCE_MODES.auto}function sourceDef(k){return SOURCE_DEFS[k]}
function sourceNeedsCountry(){return state.sourceMode==="auto"||state.sourceMode==="iptv-country"||state.sourceMode==="free-tv-country"}function sourceIsSpainOnly(){return state.sourceMode==="tdt-spain"}
function sourceUrl(k){const s=sourceDef(k);if(!s)return"";if(s.type==="country-m3u")return s.url.replace("{country}",String(state.country||s.defaultCountry||"ES").toLowerCase());if(s.type==="free-country-m3u")return s.url.replace("{countryName}",freeTvSlug(state.country||"ES"));return s.url}
function routeForCountry(){if(state.sourceMode!=="auto")return[state.sourceMode];const saved=safeParse(STORAGE.lastWorking,{})[state.country];const base=state.country==="ES"?["tdt-spain","iptv-country","free-tv-country","free-tv-global","iptv-index"]:["iptv-country","free-tv-country","free-tv-global","iptv-index"];return saved&&base.includes(saved)?[saved,...base.filter(x=>x!==saved)]:base}
function toggleFav(c){const f=getFavs(),k=channelId(c);f.has(k)?f.delete(k):f.add(k);setFavs(f);render()}
function parseAttrs(line){const a={};let m;const re=/([\w-]+)="([^"]*)"/g;while((m=re.exec(line)))a[m[1]]=m[2];return a}
function classifyType(url){const u=String(url||"").toLowerCase();if(u.includes(".mpd"))return"DASH";if(u.includes(".m3u8"))return"HLS";if(u.match(/\.(mp4|m4v|webm|ogv|mp3|aac)(\?|$)/))return"File";return"Unknown"}
function inferCountry(attrs,name,source){if(source?.type==="country-m3u"||source?.type==="free-country-m3u")return String(state.country||source.defaultCountry||"ES").toUpperCase();if(source?.forcedCountry)return source.forcedCountry;const ex=attrs["tvg-country"]||attrs.country||attrs.countries||"";const first=ex.split(/[;,]/).map(x=>x.trim().toUpperCase()).find(x=>/^[A-Z]{2}$/.test(x));if(first)return first;return"INT"}
function makeChannel(o,k){const s=sourceDef(k);return{name:o.name,group:o.group||"General",logo:o.logo||"",url:o.url,country:o.country||"INT",countryName:countryLabel(o.country||"INT"),tvgId:o.tvgId||"",lang:o.lang||"",sourceKey:k,sourceMode:state.sourceMode,sourceLabel:s.label,sourceShort:s.short,sourceQuality:s.quality,streamType:classifyType(o.url),alternatives:[]}}
function dedupeSort(channels,merge=true){const map=new Map(),out=[];for(const c of channels){const k=merge?norm(`${c.country}::${c.name}`):`${c.name}::${c.url}`;if(map.has(k)){map.get(k).alternatives.push({sourceKey:c.sourceKey,sourceLabel:c.sourceLabel,sourceShort:c.sourceShort,url:c.url,streamType:c.streamType});continue}map.set(k,c);out.push(c)}return out.sort((a,b)=>a.countryName.localeCompare(b.countryName)||a.group.localeCompare(b.group)||a.name.localeCompare(b.name))}
function parseM3U(text,k){const s=sourceDef(k),lines=text.split(/\r?\n/).map(x=>x.trim()).filter(Boolean),channels=[];let extgrp="";for(let i=0;i<lines.length;i++){const line=lines[i];if(line.startsWith("#EXTGRP:")){extgrp=line.replace("#EXTGRP:","").trim();continue}if(!line.startsWith("#EXTINF"))continue;const attrs=parseAttrs(line),comma=line.indexOf(","),display=comma>=0?line.slice(comma+1).trim():"";let url="";for(let j=i+1;j<Math.min(lines.length,i+9);j++){if(lines[j].startsWith("#EXTGRP:"))extgrp=lines[j].replace("#EXTGRP:","").trim();if(lines[j]&&!lines[j].startsWith("#")){url=lines[j].trim();break}}if(!url||!/^https?:\/\//i.test(url))continue;channels.push(makeChannel({name:attrs["tvg-name"]||display||attrs["tvg-id"]||"Unknown channel",group:attrs["group-title"]||extgrp||"General",logo:attrs["tvg-logo"]||"",url,country:inferCountry(attrs,display,s),tvgId:attrs["tvg-id"]||"",lang:attrs["tvg-language"]||attrs.language||""},k));extgrp=""}return channels}
function parseTdtMarkdown(text,k){const s=sourceDef(k),channels=[];let group="General";for(const raw of text.split(/\r?\n/)){const line=raw.trim();if(line.startsWith("## ")&&!line.toLowerCase().includes("canales de televisión")){group=line.replace(/^##\s+/,"").trim()||"General";continue}if(!line||line.startsWith("#")||line.startsWith("Canal "))continue;if(!line.includes("](")||!(line.includes("m3u8")||line.includes("stream")||line.includes("mpd")))continue;const first=line.match(/\[(m3u8|stream|mpd)[^\]]*\]\((https?:\/\/[^\)]+)\)/i);if(!first)continue;let name=line.split("[")[0].replace(/\|/g,"").replace(/^-\s*/,"").trim();if(!name||name.length>90)continue;const logo=line.match(/\[logo\]\((https?:\/\/[^\)]+)\)/i),epg=line.match(/\)\s+([A-Za-z0-9_.-]+\.TV)\s+/);channels.push(makeChannel({name,group,logo:logo?logo[1]:"",url:first[2],country:s.forcedCountry||"ES",tvgId:epg?epg[1]:"",lang:"Spanish"},k))}return channels}
async function fetchSource(k){const s=sourceDef(k);if(!s)throw new Error(`Unknown source: ${k}`);state.currentSourceKey=k;state.currentPlaylistUrl=sourceUrl(k);const r=await fetch(state.currentPlaylistUrl,{cache:"no-store"});if(!r.ok)throw new Error(`${s.label} returned ${r.status}`);const text=await r.text();return s.type==="tdt-md"?parseTdtMarkdown(text,k):parseM3U(text,k)}
async function loadPlaylist(force=false,forceRoute=null){state.loading=true;state.error="";state.routeMessages=[];state.channels=[];state.filtered=[];state.active=null;renderShell();const route=forceRoute?[forceRoute]:routeForCountry();let result=[];for(const k of route){try{const ch=await fetchSource(k);state.routeMessages.push(`${sourceDef(k).short}: ${ch.length} channels`);if(ch.length){markLastWorking({country:state.country,sourceKey:k});result=ch;break}}catch(e){state.routeMessages.push(`${sourceDef(k)?.short||k} failed: ${e.message||e}`)}}if(!result.length&&state.sourceMode==="auto"){try{const ch=await fetchSource("iptv-index");result=ch.filter(c=>state.country==="All"||c.country===state.country||c.country==="INT");state.routeMessages.push(`Final index fallback: ${result.length} channels`)}catch(e){state.routeMessages.push(`Final fallback failed: ${e.message||e}`)}}state.channels=dedupeSort(result,true);state.loading=false;if(!state.channels.length)state.error="No channels loaded from this route. Try IPTV-org Full global index or Free-TV global backup.";applyFilters();render()}
async function loadBackupSource(){const route=routeForCountry(),idx=Math.max(0,route.indexOf(state.currentSourceKey));const next=route[idx+1]||"free-tv-global";await loadPlaylist(true,next)}
function currentGroups(){return["All",...new Set(state.channels.map(c=>c.group||"General"))].sort((a,b)=>a.localeCompare(b))}
function countriesInLoadedSource(){const m=new Map();for(const c of state.channels)m.set(c.country,(m.get(c.country)||0)+1);return[...m.entries()].sort((a,b)=>countryLabel(a[0]).localeCompare(countryLabel(b[0])))}
function applyFilters(){const q=norm(state.query);state.filtered=state.channels.filter(c=>{const groupOk=state.group==="All"||c.group===state.group,formatOk=state.format==="All"||c.streamType===state.format,countryOk=sourceNeedsCountry()||sourceIsSpainOnly()||state.country==="All"||c.country===state.country||c.country==="INT";const text=norm([c.name,c.group,c.countryName,c.lang,c.tvgId,c.sourceLabel,c.streamType,c.sourceQuality].join(" "));return groupOk&&formatOk&&countryOk&&(!q||text.includes(q))})}
function addRecent(c){const rec=getRecent().filter(x=>x.id!==channelId(c));rec.unshift({id:channelId(c),sourceKey:c.sourceKey,sourceMode:c.sourceMode,sourceLabel:c.sourceLabel,name:c.name,country:c.country,countryName:c.countryName,group:c.group,logo:c.logo,url:c.url,streamType:c.streamType,at:new Date().toISOString()});setRecent(rec)}
function destroyPlayers(){if(state.hls){try{state.hls.destroy()}catch{}state.hls=null}if(state.dash){try{state.dash.reset()}catch{}state.dash=null}}
function playChannel(c){state.active=c;addRecent(c);renderPlayer();setTimeout(()=>attachPlayer(c),50)}
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

  const markOk = () => {
    markHealth(c, "working");
    markLastWorking(c);
    renderPlayerHeaderOnly();
  };

  const playVideo = () => {
    const p = video.play();
    if(p && typeof p.catch === "function"){
      p.catch(() => {
        // Browser blocked autoplay. Do not show a scary error or change player state.
        // The native video controls remain usable.
      });
    }
  };

  video.addEventListener("playing", markOk, { once:true });

  if(type === "DASH" && window.dashjs){
    try{
      const player = dashjs.MediaPlayer().create();
      state.dash = player;
      player.initialize(video, src, false);
      player.on(dashjs.MediaPlayer.events.STREAM_INITIALIZED, playVideo);
      player.on(dashjs.MediaPlayer.events.ERROR, () => {
        showPlayerError("This DASH/MPD stream failed in the browser. Try another channel or backup source.");
      });
      return;
    }catch(e){
      showPlayerError("DASH player failed to initialise. Try opening the stream directly.");
      return;
    }
  }

  if(type === "HLS" && window.Hls && Hls.isSupported()){
    const hls = new Hls({
      lowLatencyMode: true,
      backBufferLength: 60,
      maxBufferLength: 30,
      enableWorker: true
    });

    state.hls = hls;
    hls.attachMedia(video);

    hls.on(Hls.Events.MEDIA_ATTACHED, () => {
      hls.loadSource(src);
    });

    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      playVideo();
    });

    hls.on(Hls.Events.ERROR, (_, data) => {
      if(!data?.fatal) return;

      if(data.type === Hls.ErrorTypes.NETWORK_ERROR){
        try { hls.startLoad(); return; } catch {}
      }

      if(data.type === Hls.ErrorTypes.MEDIA_ERROR){
        try { hls.recoverMediaError(); return; } catch {}
      }

      showPlayerError("This HLS stream failed in the browser. Try another channel or backup source.");
    });

    return;
  }

  // Native fallback: Safari HLS, MP4, WebM, audio streams, unknown direct streams.
  video.src = src;
  video.load();

  video.addEventListener("loadedmetadata", playVideo, { once:true });
  video.addEventListener("error", () => {
    showPlayerError("The browser could not play this stream directly. Try another channel or backup source.");
  }, { once:true });
}

function showPlayerError(msg){const b=$("#playerMessage");if(b){b.textContent=msg;b.classList.add("error");b.hidden=false}}function showPlayerNotice(msg){const b=$("#playerMessage");if(b){b.textContent=msg;b.classList.remove("error");b.hidden=false}}
function healthLabel(c){const h=healthFor(c);if(h==="working")return`<span class="health-pill working">Worked before</span>`;if(h==="failed")return`<span class="health-pill failed">Failed before</span>`;return`<span class="health-pill unknown">Untested</span>`}function renderPlayerHeaderOnly(){if(state.active)renderPlayer()}
function renderPlayer(){const c=state.active,f=getFavs(),isFav=c&&f.has(channelId(c)),p=$("#playerPanel");if(!p)return;p.innerHTML=c?`<div class="player-header"><div class="channel-identity"><div class="logo-box">${c.logo?`<img src="${esc(c.logo)}" alt="">`:`<span>${esc((c.name||"?").slice(0,1))}</span>`}</div><div><div class="eyebrow">${esc(c.sourceLabel)} · ${esc(c.countryName)} · ${esc(c.group||"General")} · ${esc(c.streamType)}</div><h2>${esc(c.name)}</h2><div class="player-meta">${healthLabel(c)} <span class="source-quality">${esc(c.sourceQuality)}</span>${c.alternatives?.length?`<span class="source-quality">${c.alternatives.length} alt source${c.alternatives.length===1?"":"s"}</span>`:""}</div></div></div><div class="player-actions"><button class="pill-btn ${isFav?"active":""}" data-action="fav-active">${isFav?"Saved ★":"Save ★"}</button><button class="pill-btn" id="tryBackup">Try backup source</button><a class="pill-btn link-pill" href="${esc(c.url)}" target="_blank" rel="noopener noreferrer">Open stream</a></div></div><div class="video-wrap"><video id="videoPlayer" controls playsinline></video><div id="playerMessage" class="player-message" hidden></div></div><p class="small-note">If this stream fails here but works in another player, it may need codecs, headers, redirects, DRM, a proxy, or native-player behaviour browsers do not expose.</p>`:`<div class="empty-player"><h2>Choose a channel</h2><p>Auto mode tries the best source order for the country. Use “Try backup source” if a source is weak.</p></div>`}
function renderShell(){document.body.innerHTML=`<div class="app-shell"><header class="topbar"><div class="brand" data-nav="browse"><div class="logo-mark">TV</div><div><strong>WorldTV</strong><span>Source Health Router</span></div></div><nav class="nav"><button class="nav-btn ${state.section==="browse"?"active":""}" data-nav="browse">Browse</button><button class="nav-btn ${state.section==="favourites"?"active":""}" data-nav="favourites">Favourites</button><button class="nav-btn ${state.section==="recent"?"active":""}" data-nav="recent">Recent</button><button class="nav-btn ${state.section==="about"?"active":""}" data-nav="about">About</button></nav></header><main><section id="playerPanel" class="player-panel"></section><section id="contentPanel"></section></main></div>`;renderPlayer();if(state.loading)$("#contentPanel").innerHTML=`<section class="loading-card"><div class="loader"></div><h1>Finding best source…</h1><p>${esc(currentSourceMode().label)} · ${esc(countryLabel(state.country))}</p></section>`}
function sourceOptions(){return Object.entries(SOURCE_MODES).map(([k,s])=>`<option value="${esc(k)}" ${state.sourceMode===k?"selected":""}>${esc(s.label)}</option>`).join("")}
function countryOptions(){if(sourceIsSpainOnly()&&state.sourceMode!=="auto")return`<option value="ES" selected>Spain only</option>`;if(sourceNeedsCountry())return COUNTRY_CODES.map(c=>`<option value="${esc(c)}" ${state.country===c?"selected":""}>${esc(countryLabel(c))}</option>`).join("");const loaded=countriesInLoadedSource(),dyn=loaded.length?loaded.map(([c,n])=>`<option value="${esc(c)}" ${state.country===c?"selected":""}>${esc(countryLabel(c))} (${n})</option>`).join(""):"";return`<option value="All" ${state.country==="All"?"selected":""}>All countries</option>${dyn}`}
function routeBadge(){const route=routeForCountry();return`<div class="route-badge">Route: ${route.map(k=>`<strong>${esc(sourceDef(k)?.short||k)}</strong>`).join(" → ")}</div>`}function routeLog(){return state.routeMessages.length?`<div class="route-log">${state.routeMessages.map(x=>`<span>${esc(x)}</span>`).join("")}</div>`:""}
function topControls(){return`<section class="controls-card"><div class="controls-grid enhanced v14"><label><span>Source mode</span><select id="sourceSelect">${sourceOptions()}</select></label><label><span>Country</span><select id="countrySelect">${countryOptions()}</select></label><label><span>Category</span><select id="groupSelect">${currentGroups().map(g=>`<option value="${esc(g)}" ${state.group===g?"selected":""}>${esc(g)}</option>`).join("")}</select></label><label><span>Format</span><select id="formatSelect">${["All","HLS","DASH","File","Unknown"].map(f=>`<option value="${f}" ${state.format===f?"selected":""}>${f}</option>`).join("")}</select></label><label><span>Search</span><input id="searchBox" type="search" placeholder="Search channel, category, source..." value="${esc(state.query)}"></label><button id="clearFilters" class="pill-btn">Clear</button></div>${routeBadge()}${routeLog()}<div class="source-line"><strong>${esc(currentSourceMode().description)}</strong><br>Loaded source: <a href="${esc(state.currentPlaylistUrl||"")}" target="_blank" rel="noopener noreferrer">${esc(state.currentPlaylistUrl||"not loaded yet")}</a></div>${state.error?`<div class="warning">${esc(state.error)}</div>`:""}</section>`}
function channelCard(c){const isFav=getFavs().has(channelId(c));return`<article class="channel-card"><button class="channel-main" data-action="play" data-id="${esc(channelId(c))}"><div class="logo-box">${c.logo?`<img src="${esc(c.logo)}" alt="" loading="lazy" onerror="this.remove()">`:`<span>${esc((c.name||"?").slice(0,1))}</span>`}</div><div><h3>${esc(c.name)}</h3><p>${esc(c.countryName)} · ${esc(c.group||"General")} · ${esc(c.streamType)} · ${esc(c.sourceShort)}</p><div class="card-meta">${healthLabel(c)}<span>${esc(c.sourceQuality)}</span>${c.alternatives?.length?`<span>${c.alternatives.length} alt</span>`:""}</div></div></button><button class="fav-btn ${isFav?"active":""}" data-action="fav" data-id="${esc(channelId(c))}">★</button></article>`}
function renderBrowse(){applyFilters();$("#contentPanel").innerHTML=`<section class="hero"><div><div class="eyebrow">WorldTV v${APP_VERSION}</div><h1>Source health routing.</h1><p>WorldTV now tries reliable source routes by country, adds Free-TV/IPTV backup, marks stream health, and lets you jump to a backup source.</p></div><button class="pill-btn" id="refreshPlaylist">Refresh route</button></section>${topControls()}<section class="result-head"><h2>${state.filtered.length} channels</h2><p>${esc(sourceDef(state.currentSourceKey)?.label||currentSourceMode().label)} · ${esc(countryLabel(state.country))}${state.group==="All"?"":" · "+esc(state.group)}${state.format==="All"?"":" · "+esc(state.format)}</p></section><section class="channel-grid">${state.filtered.map(channelCard).join("")||`<div class="empty-card">No channels found.</div>`}</section>`}
function renderFavourites(){const f=getFavs(),arr=state.channels.filter(c=>f.has(channelId(c)));$("#contentPanel").innerHTML=`<section class="page-head"><div><h1>Favourites</h1><p>${arr.length} saved channel${arr.length===1?"":"s"} in the currently loaded source.</p></div></section><section class="channel-grid">${arr.map(channelCard).join("")||`<div class="empty-card">No favourites in this loaded source yet.</div>`}</section>`}
function renderRecent(){const rec=getRecent(),arr=rec.map(r=>state.channels.find(c=>channelId(c)===r.id)||r).filter(Boolean);$("#contentPanel").innerHTML=`<section class="page-head"><div><h1>Recent</h1><p>Your last watched channels on this device.</p></div></section><section class="channel-grid">${arr.map(channelCard).join("")||`<div class="empty-card">No recent channels yet.</div>`}</section>`}
function renderAbout(){const loaded=countriesInLoadedSource().length;$("#contentPanel").innerHTML=`<section class="about-card"><h1>About WorldTV</h1><p>WorldTV is a browser player for public IPTV sources. v1.4 adds source health routing and backup source switching.</p><div class="stat-grid"><div><strong>${state.channels.length}</strong><span>loaded channels</span></div><div><strong>${loaded}</strong><span>countries in source</span></div><div><strong>${Object.keys(getHealth()).length}</strong><span>health records</span></div></div><div class="notes"><p><strong>Auto route:</strong> Spain tries TDTChannels, then IPTV-org Spain, then Free-TV and global fallbacks. Other countries start with IPTV-org country, then Free-TV and global fallbacks.</p><p><strong>Health labels:</strong> channels become “Worked before” or “Failed before” on this device based on browser playback events.</p><p><strong>Still normal:</strong> some streams fail because they are offline, geo-blocked, browser-incompatible, overloaded, or changed by the provider.</p></div></section>`}
function render(){if(!document.querySelector(".app-shell"))renderShell();renderPlayer();$$(".nav-btn").forEach(b=>b.classList.toggle("active",b.dataset.nav===state.section));if(state.loading)return;if(state.section==="browse")renderBrowse();if(state.section==="favourites")renderFavourites();if(state.section==="recent")renderRecent();if(state.section==="about")renderAbout()}
function findById(k){return state.channels.find(c=>channelId(c)===k)}
function handleClick(e){const nav=e.target.closest("[data-nav]");if(nav){state.section=nav.dataset.nav;render();return}const action=e.target.closest("[data-action]");if(action){const act=action.dataset.action,key=action.dataset.id;if(act==="play"){const c=findById(key);if(c)playChannel(c)}if(act==="fav"){const c=findById(key);if(c)toggleFav(c)}if(act==="fav-active"&&state.active)toggleFav(state.active);return}if(e.target.id==="clearFilters"){state.group="All";state.format="All";state.query="";applyFilters();renderBrowse()}if(e.target.id==="refreshPlaylist")loadPlaylist(true);if(e.target.id==="tryBackup")loadBackupSource()}
function handleInput(e){if(e.target.id==="searchBox"){state.query=e.target.value||"";applyFilters();renderBrowse()}}
function handleChange(e){if(e.target.id==="sourceSelect"){state.sourceMode=e.target.value||"auto";localStorage.setItem(STORAGE.sourceMode,state.sourceMode);const src=currentSourceMode();if(src.forcedCountry)state.country=src.forcedCountry;else if(src.type==="global-m3u")state.country="All";else state.country=localStorage.getItem(STORAGE.country)||src.defaultCountry||"ES";state.group="All";state.format="All";state.query="";state.active=null;loadPlaylist(true)}if(e.target.id==="countrySelect"){if(sourceIsSpainOnly()&&state.sourceMode!=="auto")state.country="ES";else state.country=e.target.value||(sourceNeedsCountry()?"ES":"All");localStorage.setItem(STORAGE.country,state.country);state.group="All";state.query="";state.active=null;if(sourceNeedsCountry())loadPlaylist(true);else{applyFilters();renderBrowse()}}if(e.target.id==="groupSelect"){state.group=e.target.value||"All";applyFilters();renderBrowse()}if(e.target.id==="formatSelect"){state.format=e.target.value||"All";applyFilters();renderBrowse()}}
function boot(){renderShell();document.addEventListener("click",handleClick);document.addEventListener("input",handleInput);document.addEventListener("change",handleChange);if("serviceWorker"in navigator)navigator.serviceWorker.register("./service-worker.js").catch(()=>{});loadPlaylist()}
document.addEventListener("DOMContentLoaded",boot);
