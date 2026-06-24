const APP_VERSION = '1.3.0';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const loadingScreen = $('#loadingScreen');

const eventList = $('#eventList');
const pastEventList = $('#pastEventList');
const pastEventsBlock = $('#pastEventsBlock');
const logeList = $('#logeList');
const pastLogeList = $('#pastLogeList');
const pastLogeBlock = $('#pastLogeBlock');
const nextEvent = $('#nextEvent');
const nextLoge = $('#nextLoge');
const modal = $('#eventModal');
const modalContent = $('#modalContent');
const filterSelect = $('#filterSelect');
const initiativeList = $('#initiativeList');
const pastInitiativeList = $('#pastInitiativeList');
const pastInitiativeBlock = $('#pastInitiativeBlock');
const initiativeModal = $('#initiativeModal');
const initiativeForm = $('#initiativeForm');
const suggestInitiativeBtn = $('#suggestInitiativeBtn');
const initiativeSubmitModal = $('#initiativeSubmitModal');
const initiativeSubmitForm = $('#initiativeSubmitForm');
const initiativeSubmitStatus = $('#initiativeSubmitStatus');
const submitInitiativeButton = $('#submitInitiativeButton');
const joinModal = $('#joinModal');
const joinForm = $('#joinForm');
const joinStatus = $('#joinStatus');
const joinSubmitButton = $('#joinSubmitButton');
const joinActivityTitle = $('#joinActivityTitle');
const joinActivityId = $('#joinActivityId');
const joinActivityName = $('#joinActivityName');

let events = [];
let logeaftener = [];
let initiativer = [];
let participants = [];
let initiativesLoading = true;
let currentFilter = 'all';

const GOOGLE_SHEET_ID = '1QCnVFk5PzcF_3N6ONFNwzmjCUU-KzBeXFpfyueWa2Jc';
const INITIATIVE_SHEET_NAME = 'Initiativer';
const PARTICIPANTS_SHEET_NAME = 'Deltagere';
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzivUCgohSlZRNIFGGsa9goS12lTksr7DMmShgC_bAlJODfmOlogCjj2X6eSeBsP8lY/exec';
const PARTICIPATION_FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSfvSDx6diX77ZzmuZTMGRPvKFZ4B_wb-EKYFfOXYQtDNiMiUQ/viewform';
const PARTICIPATION_ACTIVITY_ENTRY = 'entry.1746932510';
const PARTICIPATION_NAME_ENTRY = 'entry.383752271';
const INITIATIVE_FORM_URL = 'https://docs.google.com/forms/d/1QazCOa3-Xd2UfnDAIxLU8IbGOnHqSvNo-1k0-oUaDsI/viewform';

function todayMidnight(){
  const d = new Date();
  d.setHours(0,0,0,0);
  return d;
}

function isUpcoming(item){
  return new Date(item.date + 'T00:00:00') >= todayMidnight();
}

function daDate(iso, weekday=true){
  return new Intl.DateTimeFormat('da-DK',{
    weekday: weekday ? 'long' : undefined,
    day:'numeric',
    month:'long',
    year:'numeric'
  }).format(new Date(iso + 'T12:00:00'));
}

function shortDate(iso){
  return new Intl.DateTimeFormat('da-DK',{day:'numeric', month:'short'}).format(new Date(iso + 'T12:00:00'));
}

function tag(type){
  return type === 'internal' ? 'Internt arrangement' : 'Offentligt arrangement';
}

function sortByDate(items){
  return [...items].sort((a,b) => a.date.localeCompare(b.date));
}

function upcomingEvents(){
  return sortByDate(events).filter(isUpcoming);
}

function pastEvents(){
  return sortByDate(events).filter(e => !isUpcoming(e)).reverse();
}

function shownEvents(){
  return upcomingEvents().filter(e => currentFilter === 'all' || e.type === currentFilter);
}

function upcomingLoge(){
  return sortByDate(logeaftener).filter(isUpcoming);
}

function pastLoge(){
  return sortByDate(logeaftener).filter(e => !isUpcoming(e)).reverse();
}

function byId(id){
  return events.find(e => e.id === id);
}

function logeById(id){
  return logeaftener.find(e => e.id === id);
}

function googleCalendarUrl(item){
  if(!item.start || !item.end) return '#';
  const start = item.date.replaceAll('-','') + 'T' + item.start.replace(':','') + '00';
  const end = item.date.replaceAll('-','') + 'T' + item.end.replace(':','') + '00';
  const text = encodeURIComponent(item.title + (item.subtitle ? ' – ' + item.subtitle : ''));
  const details = encodeURIComponent(`${item.text || item.description || ''}\n\n${item.timeText || ''}`);
  const location = encodeURIComponent(item.place || 'Odd Fellow Bygningen, Frederiksgade 15, Slagelse');
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${start}/${end}&details=${details}&location=${location}`;
}

function logeCalendarUrl(item){
  if(!item.time) return '#';
  const endTime = item.end || addMinutes(item.time, 120);
  const start = item.date.replaceAll('-','') + 'T' + item.time.replace(':','') + '00';
  const end = item.date.replaceAll('-','') + 'T' + endTime.replace(':','') + '00';
  const text = encodeURIComponent('Logeaften – ' + item.title);
  const details = encodeURIComponent(item.description || '');
  const location = encodeURIComponent('Logen, Frederiksgade 15, Slagelse');
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${start}/${end}&details=${details}&location=${location}`;
}

function addMinutes(time, minutes){
  const [h,m] = time.split(':').map(Number);
  const d = new Date(2000,0,1,h,m + minutes);
  return String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
}

function appleCalendarData(item){
  return '';
}

function renderEventHero(){
  const e = upcomingEvents()[0] || sortByDate(events)[0];
  if(!e){
    nextEvent.innerHTML = `<div class="empty">Ingen aktiviteter oprettet endnu.</div>`;
    return;
  }

  nextEvent.innerHTML = `
    <button class="next-card no-poster-card" onclick="openEvent('${e.id}')" aria-label="Åbn ${e.title}">
      <div class="event-icon large">${e.icon || '•'}</div>
      <div class="next-info">
        <span class="tag">${tag(e.type)}</span>
        <h3>${e.title}</h3>
        <div class="match">${e.subtitle || ''}</div>
        <div class="meta">
          <div><span>📅</span><span>${daDate(e.date)}</span></div>
          <div><span>🕘</span><span>${e.timeText || ''}</span></div>
          <div><span>📍</span><span>${e.place || ''}</span></div>
        </div>
        <p class="desc">${e.text || ''}</p>
        <div class="card-arrow">Tryk for detaljer ›</div>
      </div>
    </button>`;
}

function renderEventList(){
  const items = shownEvents();
  eventList.innerHTML = items.length ? items.map(e => `
    <button class="event-card" onclick="openEvent('${e.id}')">
      <div class="event-icon">${e.icon || '•'}</div>
      <div>
        <h3>${e.title}</h3>
        <p><strong>${e.subtitle || ''}</strong><br>${daDate(e.date,false)} · ${e.timeText || ''}</p>
      </div>
      <div class="chev">›</div>
    </button>
  `).join('') : `<div class="empty">Ingen kommende aktiviteter i denne kategori.</div>`;

  const old = pastEvents();
  pastEventsBlock.hidden = old.length === 0;
  pastEventList.innerHTML = old.map(e => `
    <button class="event-card muted-card" onclick="openEvent('${e.id}')">
      <div class="event-icon">${e.icon || '•'}</div>
      <div>
        <h3>${e.title}</h3>
        <p><strong>${e.subtitle || ''}</strong><br>${daDate(e.date,false)}</p>
      </div>
      <div class="chev">›</div>
    </button>
  `).join('');
}

function renderLogeHero(){
  const e = upcomingLoge()[0];
  if(!e){
    nextLoge.innerHTML = `<div class="empty">Ingen kommende logeaftener oprettet.</div>`;
    return;
  }

  nextLoge.innerHTML = `
    <button class="next-card no-poster-card" onclick="openLoge('${e.id}')" aria-label="Åbn ${e.title}">
      <div class="event-icon large">◆</div>
      <div class="next-info">
        <span class="tag">Logeaften</span>
        <h3>${e.title}</h3>
        <div class="match">${e.time ? 'Mødet kl. ' + e.time : 'Intet møde'}</div>
        <div class="meta">
          <div><span>📅</span><span>${daDate(e.date)}</span></div>
          <div><span>🕘</span><span>${e.time ? 'Kl. ' + e.time : '—'}</span></div>
          <div><span>📍</span><span>Logen</span></div>
        </div>
        ${e.description ? `<p class="desc">${e.description}</p>` : ''}
        <div class="card-arrow">Tryk for detaljer ›</div>
      </div>
    </button>`;
}

function renderLogeList(){
  const items = upcomingLoge();
  logeList.innerHTML = items.length ? items.map(e => `
    <button class="event-card" onclick="openLoge('${e.id}')">
      <div class="date-box small">${shortDate(e.date)}</div>
      <div>
        <h3>${e.title}</h3>
        <p>${e.time ? 'Mødet kl. ' + e.time : 'Intet møde'}${e.description ? '<br>' + e.description : ''}</p>
      </div>
      <div class="chev">›</div>
    </button>
  `).join('') : `<div class="empty">Ingen kommende logeaftener.</div>`;

  const old = pastLoge();
  pastLogeBlock.hidden = old.length === 0;
  pastLogeList.innerHTML = old.map(e => `
    <button class="event-card muted-card" onclick="openLoge('${e.id}')">
      <div class="date-box small">${shortDate(e.date)}</div>
      <div>
        <h3>${e.title}</h3>
        <p>${e.time ? 'Kl. ' + e.time : 'Intet møde'}</p>
      </div>
      <div class="chev">›</div>
    </button>
  `).join('');
}

window.openEvent = function(id){
  const e = byId(id);
  if(!e) return;

  modalContent.innerHTML = `
    ${e.poster ? `
      <div class="detail-poster-wrap">
        <img class="detail-poster" src="${e.poster}" alt="${e.title} plakat">
      </div>` : ''}
    <h2 class="modal-title">${e.icon || ''} ${e.title}</h2>
    <p class="modal-sub">${e.subtitle || ''}</p>
    <div class="info-grid">
      <div class="info-row"><span>📅</span><div>${daDate(e.date)}</div></div>
      <div class="info-row"><span>🕘</span><div>${e.timeText || ''}</div></div>
      <div class="info-row"><span>📍</span><div>${e.place || ''}</div></div>
      <div class="info-row"><span>🔒</span><div>${tag(e.type)}</div></div>
    </div>
    <p class="description">${e.text || ''}</p>
    ${e.start && e.end ? `<div class="modal-actions"><a class="btn primary" href="${googleCalendarUrl(e)}" target="_blank" rel="noopener">Tilføj kalender</a></div>` : ''}
  `;
  modal.showModal();
}

window.openLoge = function(id){
  const e = logeById(id);
  if(!e) return;

  modalContent.innerHTML = `
    <div class="loge-detail-icon">◆</div>
    <h2 class="modal-title">${e.title}</h2>
    <p class="modal-sub">Logeaften</p>
    <div class="info-grid">
      <div class="info-row"><span>📅</span><div>${daDate(e.date)}</div></div>
      <div class="info-row"><span>🕘</span><div>${e.time ? 'Mødet kl. ' + e.time : 'Intet møde'}</div></div>
      <div class="info-row"><span>📍</span><div>Logen</div></div>
    </div>
    ${e.description ? `<p class="description">${e.description}</p>` : ''}
    ${e.time ? `<div class="modal-actions"><a class="btn primary" href="${logeCalendarUrl(e)}" target="_blank" rel="noopener">Tilføj kalender</a></div>` : ''}
  `;
  modal.showModal();
}



function upcomingInitiatives(){ return sortByDate(initiativer).filter(isUpcoming); }
function pastInitiatives(){ return sortByDate(initiativer).filter(e => !isUpcoming(e)).reverse(); }
function initiativeById(id){ return initiativer.find(e => e.id === id); }


function normalizeKey(value){
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ');
}

function firstValue(row, keys){
  for(const key of keys){
    if(row && row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== '') return row[key];
  }
  return '';
}

async function fetchAppsScriptAction(action, force=false){
  const cacheKey = action || 'default';
  if(!window.__appsScriptCache) window.__appsScriptCache = {};
  if(window.__appsScriptCache[cacheKey] && !force) return window.__appsScriptCache[cacheKey];

  if(!APPS_SCRIPT_URL || APPS_SCRIPT_URL.includes('INDSAET_DIN_APPS_SCRIPT')){
    throw new Error('Apps Script URL mangler i app.js');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try{
    const url = new URL(APPS_SCRIPT_URL);
    if(action) url.searchParams.set('action', action);
    url.searchParams.set('t', Date.now());

    const res = await fetch(url.toString(), {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal
    });

    if(!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    if(data && data.ok === false){
      throw new Error(data.error || 'Apps Script returnerede fejl');
    }

    window.__appsScriptCache[cacheKey] = data;
    return data;
  }finally{
    clearTimeout(timeout);
  }
}

function extractRows(data, names){
  if(Array.isArray(data)) return data;
  for(const name of names){
    if(Array.isArray(data && data[name])) return data[name];
  }
  if(Array.isArray(data && data.data)) return data.data;
  if(Array.isArray(data && data.rows)) return data.rows;
  if(data && typeof data === 'object'){
    for(const value of Object.values(data)){
      if(Array.isArray(value)) return value;
    }
  }
  return [];
}

async function fetchAppsScriptData(force=false){
  // Beholdes kun som kompatibilitet til resten af filen.
  // Initiativer skal læses via den nye doGet-action: getInitiatives.
  return await fetchAppsScriptAction('getInitiatives', force);
}

function rowsFromData(data, names){
  for(const name of names){
    if(Array.isArray(data && data[name])) return data[name];
  }
  return [];
}

function arrayRowsToObjects(rows){
  if(!Array.isArray(rows) || rows.length < 2 || !Array.isArray(rows[0])) return rows || [];
  const headers = rows[0].map(h => String(h || '').trim());
  return rows.slice(1).map(row => rowToObject(headers, row));
}

function participantActivityValue(row){
  return firstValue(row, [
    'activityId', 'Aktivitet ID', 'Aktivitets ID', 'id',
    'activity', 'aktivitet', 'Hvilken aktivitet?', 'Aktivitet',
    'Titel på aktiviteten', 'Titel', 'Initiativ', 'Initiativ titel'
  ]);
}

function participantNameValue(row){
  return firstValue(row, ['name', 'navn', 'Dit navn', 'Navn', 'Navn på kontaktperson', 'Kontaktperson']);
}



async function postToAppsScript(action, payload){
  if(!APPS_SCRIPT_URL || APPS_SCRIPT_URL.includes('INDSAET_DIN_APPS_SCRIPT')){
    throw new Error('Apps Script URL mangler i app.js');
  }

  // Apps Script-koden i det nye Sheet bruger doGet, så skrivning skal sendes som query params.
  // Det undgår samtidig CORS/problemer med POST fra GitHub Pages.
  const url = new URL(APPS_SCRIPT_URL);
  url.searchParams.set('action', action);
  Object.entries(payload || {}).forEach(([key, value]) => {
    url.searchParams.set(key, value == null ? '' : String(value));
  });
  url.searchParams.set('_', Date.now());

  const res = await fetch(url.toString(), {
    method: 'GET',
    cache: 'no-store'
  });

  if(!res.ok) throw new Error('Apps Script HTTP ' + res.status);

  const data = await res.json();
  if(!(data.ok || data.success)){
    throw new Error(data.error || 'Apps Script returnerede fejl');
  }

  appDataCache = null;
  window.__appsScriptCache = {};
  return data;
}

function openJoinDialog(initiative){
  if(!joinModal) return;
  joinActivityId.value = initiative.id || '';
  joinActivityName.value = initiative.title || '';
  joinActivityTitle.textContent = `Du tilmelder dig: ${initiative.title}`;
  joinStatus.textContent = '';
  joinForm.reset();
  joinActivityId.value = initiative.id || '';
  joinActivityName.value = initiative.title || '';
  joinModal.showModal();
}

function participationUrl(initiative){
  const url = new URL(PARTICIPATION_FORM_URL);
  url.searchParams.set(PARTICIPATION_ACTIVITY_ENTRY, initiative.title);
  return url.toString();
}


let appDataCache = null;

async function getAppData(force=false){
  return await fetchAppsScriptData(force);
}

async function loadInitiativesFromSheet(force=false){
  const data = await fetchAppsScriptAction('getInitiatives', force);
  const rows = arrayRowsToObjects(extractRows(data, ['initiatives', 'initiativer', 'Initiativer', 'items']));
  return normalizeInitiatives(rows);
}

async function loadParticipantsFromSheet(force=false){
  // Nogle Apps Scripts har ikke en særskilt getParticipants endnu.
  // Derfor prøver vi først den rigtige action og derefter den gamle samlede list-action.
  try{
    const data = await fetchAppsScriptAction('getParticipants', force);
    const rows = arrayRowsToObjects(extractRows(data, ['participants', 'deltagere', 'Deltagere', 'rows']));
    return normalizeParticipants(rows);
  }catch(err){
    try{
      const data = await fetchAppsScriptAction('list', force);
      const rows = arrayRowsToObjects(extractRows(data, ['participants', 'deltagere', 'Deltagere', 'rows']));
      return normalizeParticipants(rows);
    }catch(_err){
      return [];
    }
  }
}

async function refreshParticipants(){
  try{
    participants = await loadParticipantsFromSheet(true);
    renderInitiatives();
    return true;
  }catch(err){
    console.warn('Kunne ikke opdatere deltagerlisten fra Google Sheets:', err);
    return false;
  }
}

function participantsFor(initiative){
  const possible = [
    initiative.id,
    initiative.title,
    initiative.title + ' - ' + (initiative.date || ''),
    initiative.title + ' – ' + (initiative.date || '')
  ].map(normalizeKey).filter(Boolean);

  const names = participants
    .filter(p => possible.includes(normalizeKey(p.activityId)) || possible.includes(normalizeKey(p.activity)))
    .map(p => p.name)
    .filter(Boolean);

  return [...new Set(names)];
}

function renderInitiatives(){
  if(!initiativeList) return;
  if(initiativesLoading){
    initiativeList.innerHTML = `<div class="empty initiative-loading"><span class="mini-spinner" aria-hidden="true"></span> Henter initiativer...</div>`;
    if(pastInitiativeBlock) pastInitiativeBlock.hidden = true;
    return;
  }
  const items = upcomingInitiatives();
  initiativeList.innerHTML = items.length ? items.map(e => {
    const names = participantsFor(e);
    return `
    <button class="event-card" onclick="openInitiative('${e.id}')">
      <div class="event-icon">${e.icon || '🤝'}</div>
      <div><h3>${e.title}</h3><p><strong>${e.host || ''}</strong><br>${daDate(e.date,false)}${e.time ? ' · kl. ' + e.time : ''}<br><span class="participant-count">👥 ${names.length} deltager${names.length === 1 ? '' : 'e'}</span></p></div>
      <div class="chev">›</div>
    </button>`}).join('') : `<div class="empty">Ingen godkendte initiativer lige nu.</div>`;

  const old = pastInitiatives();
  if(pastInitiativeBlock && pastInitiativeList){
    pastInitiativeBlock.hidden = old.length === 0;
    pastInitiativeList.innerHTML = old.map(e => {
      const names = participantsFor(e);
      return `
      <button class="event-card muted-card" onclick="openInitiative('${e.id}')">
        <div class="event-icon">${e.icon || '🤝'}</div>
        <div><h3>${e.title}</h3><p><strong>${e.host || ''}</strong><br>${daDate(e.date,false)}<br><span class="participant-count">👥 ${names.length} deltager${names.length === 1 ? '' : 'e'}</span></p></div>
        <div class="chev">›</div>
      </button>`}).join('');
  }
}


function initiativeCalendarUrl(item){
  if(!item || !item.date) return '#';
  const startTime = item.time || '19:00';
  const endTime = addMinutes(startTime, 90);
  const start = item.date.replaceAll('-','') + 'T' + startTime.replace(':','') + '00';
  const end = item.date.replaceAll('-','') + 'T' + endTime.replace(':','') + '00';
  const text = encodeURIComponent(item.title || 'Broderinitiativ');
  const details = encodeURIComponent(`${item.text || ''}\n\nKontaktperson: ${item.host || ''}`.trim());
  const location = encodeURIComponent(item.place || '');
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${start}/${end}&details=${details}&location=${location}`;
}

window.openInitiative = function(id){
  const e = initiativeById(id); if(!e) return;
  const names = participantsFor(e);
  const participantList = names.length
    ? `<div class="participants-box"><h3>Deltagere (${names.length})</h3><ul>${names.map(n => `<li>✓ ${n}</li>`).join('')}</ul></div>`
    : `<div class="participants-box"><h3>Deltagere</h3><p>Ingen har skrevet sig på endnu.</p></div>`;

  modalContent.innerHTML = `
    <div class="loge-detail-icon">${e.icon || '🤝'}</div>
    <h2 class="modal-title">${e.title}</h2>
    <p class="modal-sub">Initiativ fra ${e.host || 'en broder'}</p>
    <div class="info-grid">
      <div class="info-row"><span>📅</span><div>${daDate(e.date)}</div></div>
      <div class="info-row"><span>🕘</span><div>${e.time ? 'Kl. ' + e.time : 'Tidspunkt ikke angivet'}</div></div>
      <div class="info-row"><span>📍</span><div>${e.place || 'Sted ikke angivet'}</div></div>
    </div>
    <p class="description">${e.text || ''}</p>
    ${participantList}
    <div class="modal-actions">
      <button class="btn primary" type="button" onclick="openJoinForInitiative(\'${e.id}\')">Jeg deltager</button>
      <a class="btn soft" href="${initiativeCalendarUrl(e)}" target="_blank" rel="noopener">Tilføj kalender</a>
    </div>
    <p class="sheet-status-note">Skriv dit navn direkte i appen. Deltagerlisten opdateres automatisk efter tilmelding.</p>`;
  modal.showModal();
}

function parseCsv(text){
  const rows = [];
  let row = [];
  let value = '';
  let inQuotes = false;

  for(let i = 0; i < text.length; i++){
    const c = text[i];
    const next = text[i + 1];

    if(c === '"' && inQuotes && next === '"'){
      value += '"';
      i++;
    } else if(c === '"'){
      inQuotes = !inQuotes;
    } else if(c === ',' && !inQuotes){
      row.push(value);
      value = '';
    } else if((c === '\n' || c === '\r') && !inQuotes){
      if(c === '\r' && next === '\n') i++;
      row.push(value);
      if(row.some(cell => cell.trim() !== '')) rows.push(row);
      row = [];
      value = '';
    } else {
      value += c;
    }
  }

  row.push(value);
  if(row.some(cell => cell.trim() !== '')) rows.push(row);
  return rows;
}

function normalizeDate(value){
  const raw = String(value || '').trim();
  if(!raw) return '';

  // Google Sheets kan sende både rene datoer og dato + klokkeslæt.
  const slash = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+.*)?$/);
  if(slash){
    const [, d, m, y] = slash;
    return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  }

  const dash = raw.match(/^(\d{1,2})-(\d{1,2})-(\d{4})(?:\s+.*)?$/);
  if(dash){
    const [, d, m, y] = dash;
    return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  }

  const iso = raw.match(/^(\d{4}-\d{2}-\d{2})(?:[ T].*)?$/);
  if(iso) return iso[1];

  return '';
}

function normalizeTime(value){
  const raw = String(value || '').trim();
  if(!raw) return '';

  // Eksempler: 22.11.00, 22:11:00, 22:11, 13.2
  const match = raw.match(/^(\d{1,2})[.:](\d{1,2})(?:[.:]\d{1,2})?$/);
  if(match){
    return `${String(match[1]).padStart(2,'0')}:${String(match[2]).padStart(2,'0')}`;
  }

  return raw;
}

function rowToObject(headers, row){
  const obj = {};
  headers.forEach((h, i) => obj[h.trim()] = (row[i] || '').trim());
  return obj;
}

function isApproved(status){
  const s = String(status || '').trim().toLowerCase();
  return s === 'godkendt' || s === 'ja' || s === 'approved';
}


function makeInitiativeId(row, index){
  const existing = firstValue(row, ['id', 'ID', 'Initiativ ID', 'Aktivitet ID', 'activityId']);
  if(existing) return String(existing).trim();

  const title = firstValue(row, ['title', 'Titel på aktiviteten', 'Titel', 'Initiativ', 'Aktivitet']);
  const date = normalizeDate(firstValue(row, ['date', 'Dato for aktiviteten', 'Dato', 'Hvornår?']));
  const base = normalizeKey(`${title}-${date}`).replace(/[^a-z0-9æøå -]/g, '').replace(/\s+/g, '-');
  return base || `sheet-${index}`;
}

function normalizeInitiativeRecord(row, index=0){
  const status = firstValue(row, ['status', 'Status', 'Godkendt', 'godkendt', 'Approved']);
  const date = normalizeDate(firstValue(row, ['date', 'Dato for aktiviteten', 'Dato', 'Hvornår?', 'Dato/tid']));
  const title = firstValue(row, ['title', 'Titel på aktiviteten', 'Titel', 'Initiativ', 'Aktivitet']);

  return {
    id: makeInitiativeId(row, index),
    icon: firstValue(row, ['icon', 'Ikon']) || '🤝',
    status,
    title: title || 'Uden titel',
    date,
    time: normalizeTime(firstValue(row, ['time', 'Tidspunkt', 'Tid', 'Klokkeslæt'])),
    place: firstValue(row, ['place', 'Sted', 'Lokation']),
    host: firstValue(row, ['host', 'Navn på kontaktperson', 'Kontaktperson', 'Navn', 'Oprettet af']),
    text: firstValue(row, ['text', 'Beskrivelse af aktiviteten', 'Beskrivelse', 'Tekst'])
  };
}

function normalizeInitiatives(items){
  return (Array.isArray(items) ? items : [])
    .map((row, index) => normalizeInitiativeRecord(row, index))
    .filter(e => isApproved(e.status))
    .filter(e => e.title && e.date);
}

function normalizeParticipantRecord(row){
  return {
    activityId: firstValue(row, ['activityId', 'Aktivitet ID', 'Aktivitets ID', 'id']),
    activity: participantActivityValue(row),
    name: participantNameValue(row)
  };
}

function normalizeParticipants(items){
  return (Array.isArray(items) ? items : [])
    .map(normalizeParticipantRecord)
    .filter(p => (p.activityId || p.activity) && p.name);
}






window.openJoinForInitiative = function(id){
  const e = initiativeById(id);
  if(!e) return;
  openJoinDialog(e);
}

window.refreshInitiativeParticipants = async function(id){
  const ok = await refreshParticipants();
  if(id) openInitiative(id);
  const note = document.querySelector('.sheet-status-note');
  if(note){
    note.textContent = ok
      ? 'Deltagerlisten er opdateret.'
      : 'Deltagerlisten kunne ikke opdateres lige nu.';
  }
}


/* === GOOGLE SHEETS INITIATIVER FIX - 2026-06-03 ===
   Kun Google Sheets/Apps Script. Ingen lokal fallback for initiativer.
   Frontend accepterer både:
   1) { ok:true, initiatives:[...], participants:[...] }
   2) { ok:true, data:[...] }
   3) [...]
   og både danske/originale kolonnenavne samt normaliserede felter.
*/
function pickArray(data, keys){
  if(Array.isArray(data)) return data;
  if(!data || typeof data !== 'object') return [];
  for(const key of keys){
    if(Array.isArray(data[key])) return data[key];
  }
  for(const value of Object.values(data)){
    if(Array.isArray(value)) return value;
  }
  return [];
}

async function fetchAppsScriptAction(action='list', force=false){
  const cacheKey = action || 'list';
  if(!window.__appsScriptCache) window.__appsScriptCache = {};
  if(window.__appsScriptCache[cacheKey] && !force) return window.__appsScriptCache[cacheKey];

  if(!APPS_SCRIPT_URL){
    throw new Error('Apps Script URL mangler i app.js');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try{
    const url = new URL(APPS_SCRIPT_URL);
    if(action) url.searchParams.set('action', action);
    url.searchParams.set('_', Date.now());

    const res = await fetch(url.toString(), {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal
    });

    if(!res.ok) throw new Error('Apps Script HTTP ' + res.status);
    const data = await res.json();
    if(data && data.ok === false) throw new Error(data.error || 'Apps Script returnerede ok:false');
    window.__appsScriptCache[cacheKey] = data;
    return data;
  }finally{
    clearTimeout(timeout);
  }
}

function normalizeDate(value){
  const raw = String(value || '').trim();
  if(!raw) return '';

  let m = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T].*)?$/);
  if(m) return `${m[1]}-${String(m[2]).padStart(2,'0')}-${String(m[3]).padStart(2,'0')}`;

  m = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})(?:\s+.*)?$/);
  if(m) return `${m[3]}-${String(m[2]).padStart(2,'0')}-${String(m[1]).padStart(2,'0')}`;

  m = raw.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\s+.*)?$/);
  if(m) return `${m[3]}-${String(m[2]).padStart(2,'0')}-${String(m[1]).padStart(2,'0')}`;

  return '';
}

function normalizeTime(value){
  const raw = String(value || '').trim();
  if(!raw) return '';

  let m = raw.match(/(?:^|\s)(\d{1,2})[.:](\d{1,2})(?:[.:](\d{1,2}))?(?:\s|$)/);
  if(m) return `${String(m[1]).padStart(2,'0')}:${String(m[2]).padStart(2,'0')}`;

  m = raw.match(/T(\d{1,2}):(\d{1,2})/);
  if(m) return `${String(m[1]).padStart(2,'0')}:${String(m[2]).padStart(2,'0')}`;

  return raw;
}

function isApproved(status){
  const s = String(status || '').trim().toLowerCase();
  return ['godkendt','ja','approved','true','1','ok'].includes(s);
}

function makeInitiativeId(row, index){
  const existing = firstValue(row, ['id','ID','Initiativ ID','Aktivitet ID','activityId']);
  if(existing) return String(existing).trim();
  const title = firstValue(row, ['title','Titel','Titel på aktiviteten','Initiativ','Aktivitet']);
  const date = normalizeDate(firstValue(row, ['date','Dato','Dato for aktiviteten','Hvornår?','Dato/tid']));
  const time = normalizeTime(firstValue(row, ['time','Tid','Tidspunkt','Tidspunkt for aktivitet','Klokkeslæt']));
  const base = normalizeKey(`${title}-${date}-${time}`).replace(/[^a-z0-9æøå -]/g, '').replace(/\s+/g, '-');
  return base || `sheet-${index}`;
}

function normalizeInitiativeRecord(row, index=0){
  const status = firstValue(row, ['status','Status','Godkendt','godkendt','Approved']);
  const date = normalizeDate(firstValue(row, ['date','Dato','Dato for aktiviteten','Hvornår?','Dato/tid']));
  const title = firstValue(row, ['title','Titel','Titel på aktiviteten','Initiativ','Aktivitet']);
  const host = firstValue(row, ['host','Kontaktperson','Navn på kontaktperson','Navn','Oprettet af']);
  return {
    id: makeInitiativeId(row, index),
    icon: firstValue(row, ['icon','Ikon']) || '🤝',
    status,
    title: title || 'Uden titel',
    date,
    time: normalizeTime(firstValue(row, ['time','Tid','Tidspunkt','Tidspunkt for aktivitet','Klokkeslæt'])),
    place: firstValue(row, ['place','Sted','Lokation']),
    host,
    text: firstValue(row, ['text','Beskrivelse','Beskrivelse af aktiviteten','Tekst'])
  };
}

function normalizeInitiatives(items){
  return (Array.isArray(items) ? items : [])
    .map((row, index) => normalizeInitiativeRecord(row, index))
    .filter(e => isApproved(e.status))
    .filter(e => e.title && e.date);
}

function normalizeParticipantRecord(row){
  return {
    activityId: firstValue(row, ['activityId','Aktivitet ID','Aktivitets ID','id']),
    activity: firstValue(row, ['activity','Aktivitet','Titel','Titel på aktiviteten','Initiativ']),
    name: firstValue(row, ['name','Navn','Dit navn'])
  };
}

function normalizeParticipants(items){
  return (Array.isArray(items) ? items : [])
    .map(normalizeParticipantRecord)
    .filter(p => (p.activityId || p.activity) && p.name);
}

async function loadInitiativesFromSheet(force=false){
  // Prøv specifik action først. Hvis Apps Script ikke har den, læses den samlede list.
  let data;
  try{
    data = await fetchAppsScriptAction('getInitiatives', force);
  }catch(err){
    data = await fetchAppsScriptAction('list', true);
  }
  const rows = arrayRowsToObjects(pickArray(data, ['initiatives','initiativer','Initiativer','items','data','rows']));
  return normalizeInitiatives(rows);
}

async function loadParticipantsFromSheet(force=false){
  let data;
  try{
    data = await fetchAppsScriptAction('getParticipants', force);
  }catch(err){
    data = await fetchAppsScriptAction('list', true);
  }
  const rows = arrayRowsToObjects(pickArray(data, ['participants','deltagere','Deltagere','items','data','rows']));
  return normalizeParticipants(rows);
}


function renderAll(){
  renderEventHero();
  renderEventList();
  renderInitiatives();
}

async function loadJson(path){
  const res = await fetch(path + '?v=103', {cache:'no-store'});
  if(!res.ok) throw new Error(path);
  return await res.json();
}

async function init(){
  if(loadingScreen) loadingScreen.classList.remove('hidden');

  try{
    events = await loadJson('events.json');
    if(!Array.isArray(events)) events = [];
  }catch(err){
    console.error('Kunne ikke indlæse events.json:', err);
    events = [];
    if(nextEvent) nextEvent.innerHTML = `<div class="empty">Kunne ikke indlæse events.json.</div>`;
  }


  renderAll();
  SignupApp.init();
  GalleryApp.init({ load: false });

  if(loadingScreen){
    setTimeout(() => loadingScreen.classList.add('hidden'), 250);
  }

  try{
    initiativer = await loadInitiativesFromSheet(true);
    participants = await loadParticipantsFromSheet(true);
    initiativesLoading = false;
    renderInitiatives();
  }catch(err){
    console.warn('Kunne ikke indlæse initiativdata:', err);
    initiativer = [];
    participants = [];
    initiativesLoading = false;
    renderInitiatives();
  }
}

if(filterSelect) filterSelect.addEventListener('change', e => {
  currentFilter = e.target.value;
  renderEventList();
});

$('[data-close]').addEventListener('click', () => modal.close());

$$('.nav-btn').forEach(btn => btn.addEventListener('click', () => {
  const v = btn.dataset.view;
  $$('.nav-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  $$('.view').forEach(view => view.classList.remove('active-view'));
  const targetView = $('#view' + v[0].toUpperCase() + v.slice(1));
  if(targetView) targetView.classList.add('active-view');
  if(v === 'gallery') GalleryApp.init();
  window.scrollTo({top:0, behavior:'smooth'});
}));


if(suggestInitiativeBtn){
  suggestInitiativeBtn.addEventListener('click', () => {
    if(initiativeSubmitStatus) initiativeSubmitStatus.textContent = '';
    if(initiativeSubmitForm) initiativeSubmitForm.reset();
    initiativeSubmitModal.showModal();
  });
}



const closeSubmitInitiativeBtn = $('[data-close-submit-initiative]');
if(closeSubmitInitiativeBtn){
  closeSubmitInitiativeBtn.addEventListener('click', () => initiativeSubmitModal.close());
}
const closeJoinBtn = $('[data-close-join]');
if(closeJoinBtn){
  closeJoinBtn.addEventListener('click', () => joinModal.close());
}

if(initiativeSubmitForm){
  initiativeSubmitForm.addEventListener('submit', async e => {
    e.preventDefault();
    const payload = {
      title: $('#newInitiativeTitle').value.trim(),
      date: $('#newInitiativeDate').value,
      time: $('#newInitiativeTime').value,
      place: $('#newInitiativePlace').value.trim(),
      host: $('#newInitiativeHost').value.trim(),
      text: $('#newInitiativeText').value.trim()
    };
    submitInitiativeButton.disabled = true;
    initiativeSubmitStatus.textContent = 'Sender forslag...';
    try{
      await postToAppsScript('submitInitiative', payload);
      initiativeSubmitStatus.textContent = '✓ Forslaget er sendt til godkendelse.';
      appDataCache = null;
      window.__appsScriptCache = {};
      initiativeSubmitForm.reset();
      setTimeout(() => initiativeSubmitModal.close(), 1200);
    }catch(err){
      initiativeSubmitStatus.textContent = 'Kunne ikke sende. Tjek Apps Script URL.';
      console.error(err);
    }finally{
      submitInitiativeButton.disabled = false;
    }
  });
}

if(joinForm){
  joinForm.addEventListener('submit', async e => {
    e.preventDefault();
    const payload = {
      activityId: joinActivityId.value,
      activity: joinActivityName.value,
      name: $('#joinName').value.trim()
    };
    const initiative = initiativeById(payload.activityId);
    const existingNames = initiative ? participantsFor(initiative).map(normalizeKey) : [];
    if(existingNames.includes(normalizeKey(payload.name))){
      joinStatus.textContent = 'Du står allerede på deltagerlisten.';
      return;
    }
    joinSubmitButton.disabled = true;
    joinStatus.textContent = 'Sender tilmelding...';
    try{
      await postToAppsScript('joinActivity', payload);
      joinStatus.textContent = '✓ Du er tilmeldt.';
      await new Promise(resolve => setTimeout(resolve, 900));
      await refreshParticipants();
      renderInitiatives();
      setTimeout(() => {
        joinModal.close();
        openInitiative(payload.activityId);
      }, 800);
    }catch(err){
      joinStatus.textContent = 'Kunne ikke tilmelde. Tjek Apps Script URL.';
      console.error(err);
    }finally{
      joinSubmitButton.disabled = false;
    }
  });
}


const SignupApp = (() => {
  const CONFIG = {
    GOOGLE_APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbw5kZ4Yjgge_sKnxhSjjVLkb8cI-hG0E_qcScyxP7820a7lzfCr42HhZDp3lW2kmNsy/exec'
  };

  const state = {
    initialized: false,
    events: [],
    members: [],
    rows: [],
    signups: {},
    currentEvent: null,
    currentChoice: {}
  };

  const dateFmt = new Intl.DateTimeFormat('da-DK', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  const shortMonthFmt = new Intl.DateTimeFormat('da-DK', { month: 'short' });

  const els = {};

  const storage = {
    get member() {
      try {
        return JSON.parse(localStorage.getItem('concordia_member_v3') || 'null');
      } catch {
        return null;
      }
    },
    set member(v) {
      localStorage.setItem('concordia_member_v3', JSON.stringify(v));
    }
  };

  function cacheEls() {
    els.memberSelect = document.getElementById('signupMemberSelect');
    els.saveMemberBtn = document.getElementById('signupSaveMemberBtn');
    els.syncStatus = document.getElementById('signupSyncStatus');
    els.eventsList = document.getElementById('signupEventsList');
    els.totalEvents = document.getElementById('signupTotalEvents');
    els.myAttending = document.getElementById('signupMyAttending');
    els.myMeals = document.getElementById('signupMyMeals');

    els.modal = document.getElementById('signupModal');
    els.closeModalBtn = document.getElementById('signupCloseModalBtn');
    els.modalDate = document.getElementById('signupModalDate');
    els.modalTitle = document.getElementById('signupModalTitle');
    els.modalDescription = document.getElementById('signupModalDescription');
    els.modalCalendar = document.getElementById('signupModalCalendar');
    els.mealBlock = document.getElementById('signupMealBlock');
    els.guestBlock = document.getElementById('signupGuestBlock');
    els.guestYes = document.getElementById('signupGuestYes');
    els.guestDetails = document.getElementById('signupGuestDetails');
    els.guestName = document.getElementById('signupGuestName');
    els.guestMeal = document.getElementById('signupGuestMeal');
    els.noteInput = document.getElementById('signupNoteInput');
    els.saveSignupBtn = document.getElementById('signupSaveSignupBtn');
    els.saveStatus = document.getElementById('signupSaveStatus');
  }

  function init() {
    if (state.initialized) return;
    cacheEls();
    if (!els.memberSelect || !els.eventsList || !els.modal) return;
    state.initialized = true;
    bind();
    refreshFromSheet();
  }

  function bind() {
    els.saveMemberBtn?.addEventListener('click', saveMember);
    els.memberSelect?.addEventListener('change', saveMember);
    els.closeModalBtn?.addEventListener('click', closeModal);
    els.modal?.addEventListener('click', e => {
      const rect = els.modal.querySelector('.sheet').getBoundingClientRect();
      const inDialog = rect.top <= e.clientY && e.clientY <= rect.bottom && rect.left <= e.clientX && e.clientX <= rect.right;
      if (!inDialog) closeModal();
    });

    document.querySelectorAll('[data-signup-attending]').forEach(btn => {
      btn.addEventListener('click', () => chooseAttending(btn.dataset.signupAttending));
    });
    document.querySelectorAll('[data-signup-meal]').forEach(btn => {
      btn.addEventListener('click', () => chooseMeal(btn.dataset.signupMeal));
    });
    els.guestYes?.addEventListener('change', syncGuest);
    els.saveSignupBtn?.addEventListener('click', saveSignup);
  }

  async function refreshFromSheet() {
    if (!CONFIG.GOOGLE_APPS_SCRIPT_URL) {
      state.members = fallbackMembers();
      state.events = [];
      els.syncStatus.textContent = 'Google Sheet er ikke koblet på.';
      renderMembers();
      render();
      return;
    }

    try {
      els.syncStatus.textContent = 'Henter fra Google Sheet…';
      const res = await fetch(`${CONFIG.GOOGLE_APPS_SCRIPT_URL}?action=list&t=${Date.now()}`, { cache: 'no-store' });
      const data = await res.json();
      state.members = normalizeMembers(data.members);
      state.rows = normalizeRows(data.rows || data.signups || []);
      state.events = getUpcomingEvents(normalizeEvents(data.events || []));
      mergeCurrentUserRows();
      els.syncStatus.textContent = 'Koblet på Google Sheet.';
    } catch (err) {
      console.warn('Kunne ikke hente tilmeldingsdata', err);
      state.members = fallbackMembers();
      state.rows = [];
      state.signups = {};
      state.events = [];
      els.syncStatus.textContent = 'Kunne ikke hente fra Google Sheet.';
    }

    renderMembers();
    render();
  }

  function renderMembers() {
    const current = storage.member;
    els.memberSelect.innerHTML = '<option value="">Vælg navn</option>' +
      state.members.map(m => `<option value="${esc(m.id)}">${esc(m.name)}</option>`).join('');
    if (current) els.memberSelect.value = current.id;
  }

  function saveMember() {
    const id = els.memberSelect.value;
    const member = state.members.find(m => String(m.id) === String(id));
    if (!member) return;
    storage.member = { id: String(member.id), name: member.name };
    state.signups = {};
    mergeCurrentUserRows();
    render();
  }

  function mergeCurrentUserRows() {
    const member = storage.member;
    state.signups = {};
    if (!member || !state.rows.length) return;
    const latest = getLatestRows(state.rows);
    Object.values(latest).forEach(row => {
      if (String(row.memberId) === String(member.id)) state.signups[row.eventId] = normalizeRow(row);
    });
  }

  function render() {
    const member = storage.member;
    els.totalEvents.textContent = state.events.length;
    els.myAttending.textContent = Object.values(state.signups).filter(s => s.attending === 'yes' && hasUpcomingEvent(s.eventId)).length;
    els.myMeals.textContent = Object.values(state.signups).filter(s => s.attending === 'yes' && s.meal === 'yes' && hasUpcomingEvent(s.eventId)).length;

    if (!state.events.length) {
      els.eventsList.innerHTML = '<div class="empty">Der er ingen kommende aftener.</div>';
    } else {
      els.eventsList.innerHTML = state.events.map(event => {
        const signup = state.signups[event.id];
        const status = getStatus(signup, event);
        const summary = getSummary(event.id);
        const d = new Date(`${event.date}T12:00:00`);
        const locked = isDeadlinePassed(event);
        const deadlineLabel = getDeadlineLabel(event);

        return `
          <button class="signup-event-card ${locked ? 'locked' : ''}" type="button" data-event-id="${esc(event.id)}">
            <div class="signup-date-badge">
              <span class="day">${d.getDate()}</span>
              <span class="month">${shortMonthFmt.format(d).replace('.', '')}</span>
            </div>
            <div class="signup-card-body">
              <h3>${esc(event.title)}</h3>
              <p class="signup-card-meta">${cap(dateFmt.format(d))} · kl. ${event.time.replace(':', '.')} ${event.category ? `· ${esc(event.category)}` : ''}</p>
              ${event.description ? `<p class="signup-card-description">${esc(event.description)}</p>` : ''}
              <p class="signup-card-counts">Deltagere: ${summary.attending} · Spiser: ${summary.meals}${summary.guestMeals ? ` · Gæster spiser: ${summary.guestMeals}` : ''}</p>
              ${deadlineLabel ? `<p class="signup-deadline-text ${locked ? 'locked' : ''}">${deadlineLabel}</p>` : ''}
              ${buildCalendarLinks(event)}
            </div>
            <span class="signup-status-pill ${status.className}">${status.label}</span>
          </button>
        `;
      }).join('');
    }

    els.eventsList.querySelectorAll('.signup-event-card').forEach(card => {
      card.addEventListener('click', () => openModal(card.dataset.eventId));
    });

    if (!member && CONFIG.GOOGLE_APPS_SCRIPT_URL) {
      els.syncStatus.textContent = 'Vælg dit navn for at starte.';
    }
  }

  function openModal(eventId) {
    const member = storage.member;
    if (!member) {
      els.memberSelect.focus();
      return;
    }
    const event = state.events.find(e => e.id === eventId);
    if (!event) return;

    const existing = state.signups[eventId] || {};
    const locked = isDeadlinePassed(event);
    state.currentEvent = event;
    state.currentChoice = {
      attending: existing.attending || null,
      meal: existing.meal || null,
      guest: existing.guest === 'yes',
      guestName: existing.guestName || '',
      guestMeal: existing.guestMeal === 'yes',
      note: existing.note || '',
      locked
    };

    const d = new Date(`${event.date}T12:00:00`);
    els.modalDate.textContent = `${cap(dateFmt.format(d))} · kl. ${event.time.replace(':', '.')}`;
    els.modalTitle.textContent = event.title;
    els.modalDescription.textContent = locked
      ? 'Tilmeldingsfristen er overskredet. Du kan se din nuværende status, men ændringer skal gå via restauratøren.'
      : (event.description || 'Vælg din tilmelding.');
    els.modalCalendar.innerHTML = buildCalendarLinks(event, true);
    els.guestBlock.hidden = !event.allowGuests;
    els.noteInput.value = state.currentChoice.note;
    els.saveStatus.textContent = locked ? 'Fristen er overskredet. Kontakt restauratøren ved ændringer.' : '';
    syncChoices();
    setModalDisabled(locked);
    els.modal.showModal();
  }

  function closeModal() {
    els.modal.close();
    setModalDisabled(false);
    state.currentEvent = null;
  }

  function chooseAttending(v) {
    if (state.currentChoice.locked) return;
    state.currentChoice.attending = v;
    if (v === 'no') {
      state.currentChoice.meal = 'no';
      state.currentChoice.guest = false;
      state.currentChoice.guestName = '';
      state.currentChoice.guestMeal = false;
    }
    syncChoices();
  }

  function chooseMeal(v) {
    if (state.currentChoice.locked || state.currentChoice.attending !== 'yes') return;
    state.currentChoice.meal = v;
    syncChoices();
  }

  function syncGuest() {
    if (state.currentChoice.locked) return;
    state.currentChoice.guest = els.guestYes.checked;
    if (!state.currentChoice.guest) {
      state.currentChoice.guestName = '';
      state.currentChoice.guestMeal = false;
    }
    syncChoices();
  }

  function syncChoices() {
    document.querySelectorAll('[data-signup-attending]').forEach(btn => btn.classList.toggle('active', btn.dataset.signupAttending === state.currentChoice.attending));
    document.querySelectorAll('[data-signup-meal]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.signupMeal === state.currentChoice.meal);
      btn.disabled = state.currentChoice.attending !== 'yes' || state.currentChoice.locked;
    });
    els.mealBlock.style.opacity = state.currentChoice.attending === 'yes' ? '1' : '.55';
    els.guestYes.checked = !!state.currentChoice.guest;
    els.guestYes.disabled = state.currentChoice.attending !== 'yes' || state.currentChoice.locked;
    els.guestDetails.hidden = !state.currentChoice.guest || state.currentChoice.attending !== 'yes';
    els.guestName.value = state.currentChoice.guestName || '';
    els.guestMeal.checked = !!state.currentChoice.guestMeal;
  }

  function setModalDisabled(disabled) {
    document.querySelectorAll('[data-signup-attending]').forEach(btn => btn.disabled = disabled);
    document.querySelectorAll('[data-signup-meal]').forEach(btn => btn.disabled = disabled || state.currentChoice.attending !== 'yes');
    els.guestYes.disabled = disabled || state.currentChoice.attending !== 'yes';
    els.guestName.disabled = disabled;
    els.guestMeal.disabled = disabled;
    els.noteInput.disabled = disabled;
    els.saveSignupBtn.disabled = disabled;
    els.saveSignupBtn.textContent = disabled ? 'Frist overskredet' : 'Gem';
  }

  async function saveSignup() {
    const member = storage.member;
    if (!member || !state.currentEvent) return;
    if (isDeadlinePassed(state.currentEvent)) {
      els.saveStatus.textContent = 'Tilmeldingsfristen er overskredet. Kontakt restauratøren ved ændringer.';
      setModalDisabled(true);
      return;
    }
    if (!state.currentChoice.attending) {
      els.saveStatus.textContent = 'Vælg om du deltager eller ej.';
      return;
    }
    if (state.currentChoice.attending === 'yes' && !state.currentChoice.meal) {
      els.saveStatus.textContent = 'Vælg om du spiser med eller ej.';
      return;
    }

    const signup = {
      memberId: member.id,
      name: member.name,
      navn: member.name,
      eventId: state.currentEvent.id,
      eventDate: state.currentEvent.date,
      eventTime: state.currentEvent.time,
      eventTitle: state.currentEvent.title,
      attending: state.currentChoice.attending,
      deltager: state.currentChoice.attending,
      meal: state.currentChoice.attending === 'yes' ? state.currentChoice.meal : 'no',
      mad: state.currentChoice.attending === 'yes' ? state.currentChoice.meal : 'no',
      guest: state.currentChoice.attending === 'yes' && els.guestYes.checked ? 'yes' : 'no',
      guestName: state.currentChoice.attending === 'yes' && els.guestYes.checked ? els.guestName.value.trim() : '',
      guestFood: state.currentChoice.attending === 'yes' && els.guestYes.checked && els.guestMeal.checked ? 'yes' : 'no',
      guestMeal: state.currentChoice.attending === 'yes' && els.guestYes.checked && els.guestMeal.checked ? 'yes' : 'no',
      note: els.noteInput.value.trim(),
      updatedAt: new Date().toISOString()
    };

    try {
      els.saveStatus.textContent = 'Gemmer…';
      els.saveSignupBtn.disabled = true;
      const res = await fetch(CONFIG.GOOGLE_APPS_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(signup)
      });
      const data = await res.json();
      if (!(data.ok || data.success)) throw new Error(data.error || 'Ukendt fejl');
      els.saveStatus.textContent = 'Gemt i Google Sheet.';
      await refreshFromSheet();
      setTimeout(() => closeModal(), 650);
    } catch (err) {
      console.warn('Kunne ikke gemme tilmelding', err);
      els.saveSignupBtn.disabled = false;
      els.saveStatus.textContent = 'Kunne ikke gemme i Google Sheet.';
    }
  }

  function getSummary(eventId) {
    const latest = getLatestRows(state.rows);
    const rows = Object.values(latest).filter(r => r.eventId === eventId && r.attending === 'yes');
    return {
      attending: rows.length,
      meals: rows.filter(r => r.meal === 'yes').length,
      guestMeals: rows.filter(r => r.guestMeal === 'yes').length
    };
  }

  function getLatestRows(rows) {
    const latest = {};
    rows.forEach(r => {
      if (!r || !r.eventId) return;
      const key = `${r.eventId}__${r.memberId || norm(r.name)}`;
      if (!latest[key] || new Date(r.updatedAt || 0) >= new Date(latest[key].updatedAt || 0)) latest[key] = r;
    });
    return latest;
  }

  function normalizeMembers(input) {
    if (!Array.isArray(input) || !input.length) return fallbackMembers();
    if (Array.isArray(input[0])) {
      const header = input[0].map(h => String(h).trim().toLowerCase());
      const idIndex = header.indexOf('id');
      const nameIndex = header.indexOf('navn') !== -1 ? header.indexOf('navn') : header.indexOf('name');
      return input.slice(1).filter(r => r[idIndex] && r[nameIndex]).map(r => ({ id: String(r[idIndex]).trim(), name: String(r[nameIndex]).trim() }));
    }
    return input.filter(m => m.id && (m.name || m.navn)).map(m => ({ id: String(m.id).trim(), name: String(m.name || m.navn).trim() }));
  }

  function normalizeEvents(input) {
    if (!Array.isArray(input) || !input.length) return [];
    if (Array.isArray(input[0])) {
      const header = input[0].map(h => normalizeKey(h));
      const getIndex = names => header.findIndex(h => names.map(normalizeKey).includes(h));
      const idIndex = getIndex(['id', 'eventId']);
      const dateIndex = getIndex(['dato', 'date']);
      const timeIndex = getIndex(['tid', 'time']);
      const titleIndex = getIndex(['titel', 'title']);
      const descIndex = getIndex(['beskrivelse', 'description']);
      const categoryIndex = getIndex(['kategori', 'category', 'type']);
      const guestsIndex = getIndex(['allowGuests', 'gæster tilladt', 'gaester tilladt']);
      const deadlineIndex = getIndex(['deadline', 'frist', 'tilmeldingsfrist']);
      return input.slice(1).map(r => normalizeEvent({
        id: idIndex === -1 ? '' : r[idIndex],
        date: dateIndex === -1 ? '' : r[dateIndex],
        time: timeIndex === -1 ? '' : r[timeIndex],
        title: titleIndex === -1 ? '' : r[titleIndex],
        description: descIndex === -1 ? '' : r[descIndex],
        category: categoryIndex === -1 ? '' : r[categoryIndex],
        allowGuests: guestsIndex === -1 ? false : r[guestsIndex],
        deadline: deadlineIndex === -1 ? '' : r[deadlineIndex]
      })).filter(e => e.id && e.date);
    }
    return input.map(normalizeEvent).filter(e => e.id && e.date);
  }

  function normalizeEvent(e) {
    const date = normalizeDate(e.date || e.dato || e.id || '');
    const id = normalizeDate(e.id || e.eventId || date);
    const time = normalizeTime(e.time || e.tid || '19:30');
    return {
      id,
      date,
      time,
      title: String(e.title || e.titel || '').trim() || 'Logeaften',
      category: String(e.category || e.kategori || e.type || '').trim(),
      description: String(e.description || e.beskrivelse || '').trim(),
      allowGuests: isYes(e.allowGuests ?? e.gæsterTilladt ?? e.gaesterTilladt),
      deadline: normalizeDeadline(e.deadline || e.frist || e.tilmeldingsfrist || '', date)
    };
  }

  function normalizeRows(input) {
    if (!Array.isArray(input) || !input.length) return [];
    if (Array.isArray(input[0])) {
      const header = input[0].map(h => String(h).trim());
      return input.slice(1).filter(r => r.length).map(r => {
        const obj = {};
        header.forEach((h, i) => obj[h] = r[i]);
        return normalizeRow(obj);
      });
    }
    return input.map(normalizeRow);
  }

  function normalizeRow(r) {
    return {
      memberId: String(r.memberId || '').trim(),
      name: String(r.name || r.navn || '').trim(),
      eventId: normalizeDate(r.eventId || ''),
      eventDate: normalizeDate(r.eventDate || ''),
      eventTime: r.eventTime || '',
      eventTitle: r.eventTitle || '',
      attending: yn(r.attending || r.deltager),
      meal: yn(r.meal || r.mad),
      guest: yn(r.guest),
      guestName: r.guestName || '',
      guestMeal: yn(r.guestMeal || r.guestFood),
      note: r.note || '',
      updatedAt: r.updatedAt || r.timestamp || new Date().toISOString()
    };
  }

  function getStatus(s, event) {
    const locked = event ? isDeadlinePassed(event) : false;
    if (!s) return locked ? { label: 'Frist overskredet', className: 'status-no' } : { label: 'Ikke valgt', className: 'status-none' };
    if (s.attending === 'no') return { label: locked ? 'Deltager ikke · låst' : 'Deltager ikke', className: 'status-no' };
    if (s.attending === 'yes' && s.meal === 'yes') {
      return { label: s.guest === 'yes' ? (locked ? 'Deltager + mad + gæst · låst' : 'Deltager + mad + gæst') : (locked ? 'Deltager + mad · låst' : 'Deltager + mad'), className: 'status-yes' };
    }
    if (s.attending === 'yes') {
      return { label: s.guest === 'yes' ? (locked ? 'Deltager uden mad + gæst · låst' : 'Deltager uden mad + gæst') : (locked ? 'Deltager uden mad · låst' : 'Deltager uden mad'), className: 'status-meal-no' };
    }
    return { label: 'Ikke valgt', className: 'status-none' };
  }

  function getUpcomingEvents(events) {
    return events.filter(e => !isPast(e.date)).sort((a, b) => String(a.date + a.time).localeCompare(String(b.date + b.time)));
  }

  function hasUpcomingEvent(eventId) {
    return state.events.some(e => e.id === eventId);
  }

  function isPast(date) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return new Date(`${normalizeDate(date)}T23:59:59`) < today;
  }

  function isDeadlinePassed(event) {
    const deadline = getDeadlineDate(event);
    if (!deadline) return false;
    return new Date() > deadline;
  }

  function getDeadlineDate(event) {
    if (!event || !event.deadline) return null;
    const raw = String(event.deadline).trim();
    if (!raw) return null;
    let normalized = raw.replace(' ', 'T');
    if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) normalized += 'T23:59:00';
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(normalized)) normalized += ':00';
    const d = new Date(normalized);
    return isNaN(d.getTime()) ? null : d;
  }

  function getDeadlineLabel(event) {
    const deadline = getDeadlineDate(event);
    if (!deadline) return '';
    const date = deadline.toLocaleDateString('da-DK', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const time = deadline.toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' }).replace(':', '.');
    return isDeadlinePassed(event) ? `Tilmeldingsfrist overskredet ${date} kl. ${time}` : `Tilmeld senest ${date} kl. ${time}`;
  }

  function buildCalendarLinks(event, modal = false) {
    if (!event || !event.date) return '';
    const googleUrl = buildGoogleCalendarUrl(event);
    const icsUrl = buildIcsDataUrl(event);
    return `
      <div class="signup-calendar-row" onclick="event.stopPropagation()">
        <a class="btn soft" href="${esc(googleUrl)}" target="_blank" rel="noopener">Tilføj Google Kalender</a>
        <a class="btn soft" href="${esc(icsUrl)}" download="${esc(event.id || 'arrangement')}.ics">Apple/Outlook</a>
      </div>
    `;
  }

  function buildGoogleCalendarUrl(event) {
    const start = getEventStart(event);
    const end = getEventEnd(event);
    const dates = `${formatGoogleDate(start)}/${formatGoogleDate(end)}`;
    const details = [event.description || '', 'Tilmelding: https://concordia35.github.io/TilmeldingV3/'].filter(Boolean).join('\n\n');
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: `${event.title || 'Logeaften'} · Concordia 35`,
      dates,
      ctz: 'Europe/Copenhagen',
      details,
      location: event.location || 'Odd Fellow Logen, Slagelse'
    });
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  }

  function buildIcsDataUrl(event) {
    const start = getEventStart(event);
    const end = getEventEnd(event);
    const title = `${event.title || 'Logeaften'} · Concordia 35`;
    const description = [event.description || '', 'Tilmelding: https://concordia35.github.io/TilmeldingV3/'].filter(Boolean).join('\\n\\n');
    const uid = `${event.id || Date.now()}@concordia35-tilmelding`;
    const ics = [
      'BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Concordia35//Tilmelding//DA','CALSCALE:GREGORIAN','METHOD:PUBLISH','BEGIN:VEVENT',
      `UID:${escapeIcs(uid)}`,
      `DTSTAMP:${formatIcsUtc(new Date())}`,
      `DTSTART:${formatIcsUtc(start)}`,
      `DTEND:${formatIcsUtc(end)}`,
      `SUMMARY:${escapeIcs(title)}`,
      `DESCRIPTION:${escapeIcs(description)}`,
      `LOCATION:${escapeIcs(event.location || 'Odd Fellow Logen, Slagelse')}`,
      'END:VEVENT','END:VCALENDAR'
    ].join('\r\n');
    return `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
  }

  function getEventStart(event) {
    const time = normalizeTime(event.time || '19:30');
    return new Date(`${event.date}T${time}:00`);
  }

  function getEventEnd(event) {
    const start = getEventStart(event);
    return new Date(start.getTime() + 3 * 60 * 60 * 1000);
  }

  function formatGoogleDate(date) {
    const pad = n => String(n).padStart(2, '0');
    return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T${pad(date.getHours())}${pad(date.getMinutes())}00`;
  }

  function formatIcsUtc(date) {
    const pad = n => String(n).padStart(2, '0');
    return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}00Z`;
  }

  function escapeIcs(value) {
    return String(value || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
  }

  function normalizeDate(v) {
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    const s = String(v || '').trim();
    const iso = s.match(/\d{4}-\d{2}-\d{2}/);
    if (iso) return iso[0];
    const dk = s.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})$/);
    if (dk) return `${dk[3]}-${String(dk[2]).padStart(2, '0')}-${String(dk[1]).padStart(2, '0')}`;
    const monthMap = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' };
    const textDate = s.match(/^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+([A-Z][a-z]{2})\s+(\d{1,2})\s+(\d{4})/);
    if (textDate) return `${textDate[3]}-${monthMap[textDate[1]]}-${String(textDate[2]).padStart(2, '0')}`;
    return s;
  }

  function normalizeDeadline(v, fallbackDate) {
    if (!v) return '';
    if (v instanceof Date) {
      const pad = n => String(n).padStart(2, '0');
      return `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}T${pad(v.getHours())}:${pad(v.getMinutes())}`;
    }
    const s = String(v || '').trim();
    if (!s) return '';
    if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(s)) return s.replace(' ', 'T').slice(0, 16);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return `${s}T23:59`;
    if (/^\d{1,2}[.\/-]\d{1,2}[.\/-]\d{4}\s+\d{1,2}:\d{2}$/.test(s)) {
      const [datePart, timePart] = s.split(/\s+/);
      return `${normalizeDate(datePart)}T${normalizeTime(timePart)}`;
    }
    if (/^\d{1,2}:\d{2}$/.test(s) && fallbackDate) return `${fallbackDate}T${normalizeTime(s)}`;
    return s;
  }

  function normalizeTime(v) {
    const s = String(v || '').trim();
    const m = s.match(/^(\d{1,2})[.:](\d{2})/);
    if (!m) return s || '19:30';
    return `${String(m[1]).padStart(2, '0')}:${m[2]}`;
  }

  function yn(v) {
    const s = String(v || '').trim().toLowerCase();
    if (['yes', 'ja', 'true', '1'].includes(s)) return 'yes';
    if (['no', 'nej', 'false', '0', ''].includes(s)) return 'no';
    return s;
  }

  function isYes(v) {
    const s = String(v || '').trim().toLowerCase();
    return ['yes', 'ja', 'true', '1', 'x'].includes(s);
  }

  function normalizeKey(value) {
    return String(value || '').trim().toLowerCase().replace(/æ/g, 'ae').replace(/ø/g, 'oe').replace(/å/g, 'aa').replace(/[^a-z0-9]/g, '');
  }

  function esc(v) {
    return String(v ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  function cap(s) {
    return s ? String(s).charAt(0).toUpperCase() + String(s).slice(1) : '';
  }

  function norm(s) {
    return String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
  }

  function fallbackMembers() {
    return [
      { id: '1', name: 'Peter Andersen' },
      { id: '2', name: 'Lars Møller Andersen' },
      { id: '3', name: 'Ivar Lind Bendixen' },
      { id: '4', name: 'Mone Brandstrup' },
      { id: '5', name: 'Christian Peter Brandstrup' },
      { id: '6', name: 'Svend Erik Christensen' },
      { id: '7', name: 'Jens Carsten Kilian Christiansen' },
      { id: '8', name: 'Mogens Dahl' },
      { id: '9', name: 'Anton Edholm' },
      { id: '10', name: 'Per Egekjær' },
      { id: '11', name: 'Ib Kurt Grøn' },
      { id: '12', name: 'Bjarne Halleby Hansen' },
      { id: '13', name: 'Lars Rohde Hansen' },
      { id: '14', name: 'Finn Hansen' },
      { id: '15', name: 'Lars Bo Hansen' },
      { id: '16', name: 'Ole John Hansen' },
      { id: '17', name: 'Bent Kragh Jacobsen' },
      { id: '18', name: 'Kurt Jensen' },
      { id: '19', name: 'Claus Johnny Johansen' },
      { id: '20', name: 'Kim Karlsson' },
      { id: '21', name: 'John Kristensen' },
      { id: '22', name: 'Bøje Skov Larsen' },
      { id: '23', name: 'Niels-Ebbe Dalsø Larsen' },
      { id: '24', name: 'Per Henchel Madsen' },
      { id: '25', name: 'Bjørn Mikkelsen' },
      { id: '26', name: 'Hans Nielsen' },
      { id: '27', name: "Henry O'Connor" },
      { id: '28', name: 'Lars Weide Olsen' },
      { id: '29', name: 'Daniel Holm Olsen' },
      { id: '30', name: 'Freddy Tage Ottosen' },
      { id: '31', name: 'Gert Sunesen' },
      { id: '32', name: 'Henning Søndermølle' },
      { id: '33', name: 'Torben Møller Sørensen' }
    ];
  }

  return { init, refreshFromSheet, render };
})();


const GalleryApp = (() => {
  const config = Object.assign({
    appsScriptUrl: '',
    maxImageDimension: 1800,
    jpegQuality: 0.82
  }, window.CONCORDIA_GALLERY_CONFIG || {});

  const state = {
    initialized: false,
    loaded: false,
    loading: false,
    images: [],
    activeFolder: ''
  };

  const els = {};

  function cacheEls(){
    els.grid = $('#galleryGrid');
    els.syncStatus = $('#gallerySyncStatus');
    els.uploadBtn = $('#galleryUploadBtn');
    els.uploadModal = $('#galleryUploadModal');
    els.uploadCloseBtn = $('#galleryUploadCloseBtn');
    els.uploadForm = $('#galleryUploadForm');
    els.uploaderName = $('#galleryUploaderName');
    els.eventName = $('#galleryEventName');
    els.fileInput = $('#galleryFileInput');
    els.selectedFiles = $('#gallerySelectedFiles');
    els.submitBtn = $('#galleryUploadSubmitBtn');
    els.uploadStatus = $('#galleryUploadStatus');
    els.progress = $('#galleryUploadProgress');
    els.progressBar = els.progress?.querySelector('span');
    els.imageModal = $('#galleryImageModal');
    els.imageCloseBtn = $('#galleryImageCloseBtn');
    els.largeImage = $('#galleryLargeImage');
    els.largeCaption = $('#galleryLargeCaption');
  }

  function init(options = {}){
    if(!state.initialized){
      cacheEls();
      if(!els.grid || !els.uploadBtn || !els.uploadModal) return;
      bind();
      restoreName();
      populateActivityOptions();
      state.initialized = true;
      render();
    }
    if(options.load !== false && !state.loaded && !state.loading) loadGallery();
  }

  function bind(){
    els.uploadBtn.addEventListener('click', openUpload);
    els.uploadCloseBtn?.addEventListener('click', () => els.uploadModal.close());
    els.fileInput?.addEventListener('change', updateSelectedFiles);
    els.uploadForm?.addEventListener('submit', uploadImages);
    els.imageCloseBtn?.addEventListener('click', closeLargeImage);
    els.imageModal?.addEventListener('click', event => {
      if(event.target === els.imageModal) closeLargeImage();
    });
  }

  function isConfigured(){
    return /^https:\/\/script\.google\.com\/macros\/s\//.test(String(config.appsScriptUrl || '').trim());
  }

  function restoreName(){
    try{
      const saved = localStorage.getItem('concordia_gallery_uploader');
      if(saved && els.uploaderName) els.uploaderName.value = saved;
    }catch{}
  }

  function populateActivityOptions(){
    if(!els.eventName) return;
    const current = els.eventName.value;
    const activityOptions = [...events]
      .filter(item => item && item.title)
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
      .map(item => {
        const dateText = item.date ? shortActivityDate(item.date) : '';
        const label = [item.title, dateText].filter(Boolean).join(' · ');
        return { value: label, label };
      });

    const unique = [];
    const seen = new Set();
    activityOptions.forEach(option => {
      if(seen.has(option.value)) return;
      seen.add(option.value);
      unique.push(option);
    });

    els.eventName.innerHTML = [
      '<option value="">Vælg aktivitet</option>',
      ...unique.map(option => `<option value="${escapeAttr(option.value)}">${escapeHtml(option.label)}</option>`),
      '<option value="Andet">Andet / ikke på listen</option>'
    ].join('');

    if(current && [...els.eventName.options].some(option => option.value === current)){
      els.eventName.value = current;
    }
  }

  function shortActivityDate(value){
    const date = new Date(String(value) + 'T12:00:00');
    if(Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('da-DK', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
  }

  function openUpload(){
    init({ load: false });
    els.uploadStatus.textContent = isConfigured() ? '' : 'Upload er ikke koblet til Google Drive endnu.';
    els.submitBtn.disabled = !isConfigured();
    els.uploadModal.showModal();
  }

  async function loadGallery(force = false){
    if(!state.initialized) init({ load: false });
    if(!isConfigured()){
      state.loaded = true;
      state.images = [];
      els.syncStatus.textContent = 'Galleriet mangler forbindelsen til Google Drive.';
      render();
      return;
    }
    if(state.loading || (state.loaded && !force)) return;

    state.loading = true;
    els.syncStatus.textContent = 'Henter billeder…';
    render();

    try{
      const url = new URL(config.appsScriptUrl);
      url.searchParams.set('action', 'listGallery');
      url.searchParams.set('_', Date.now());
      const response = await fetch(url.toString(), { cache: 'no-store' });
      if(!response.ok) throw new Error('HTTP ' + response.status);
      const data = await response.json();
      if(data.ok === false) throw new Error(data.error || 'Ukendt fejl');
      state.images = Array.isArray(data.images) ? data.images : [];
      state.loaded = true;
      const folderCount = new Set(state.images.map(image => image.event || 'Andet')).size;
      els.syncStatus.textContent = state.images.length
        ? `${state.images.length} ${state.images.length === 1 ? 'billede' : 'billeder'} fordelt på ${folderCount} ${folderCount === 1 ? 'aktivitet' : 'aktiviteter'}.`
        : 'Der er endnu ingen godkendte billeder.';
    }catch(error){
      console.error('Kunne ikke hente galleri', error);
      state.images = [];
      els.syncStatus.textContent = 'Kunne ikke hente galleriet.';
    }finally{
      state.loading = false;
      render();
    }
  }

  function render(){
    if(!els.grid) return;
    if(state.loading){
      els.grid.className = 'gallery-grid';
      els.grid.innerHTML = '<div class="gallery-loading"><div class="loading-spinner" aria-hidden="true"></div><span>Henter galleri…</span></div>';
      return;
    }
    if(!state.images.length){
      els.grid.className = 'gallery-grid';
      els.grid.innerHTML = '<div class="empty gallery-empty">Ingen billeder at vise endnu.</div>';
      return;
    }

    const folders = groupByActivity(state.images);

    if(!state.activeFolder || !folders.has(state.activeFolder)){
      state.activeFolder = '';
      els.grid.className = 'gallery-grid gallery-folder-grid';
      els.grid.innerHTML = [...folders.entries()].map(([name, images]) => {
        const cover = images[0] || {};
        const latest = formatDate(cover.date);
        return `
          <button class="gallery-folder-card" type="button" data-gallery-folder="${escapeAttr(name)}" aria-label="Åbn mappen ${escapeAttr(name)}">
            <div class="gallery-folder-cover">
              <img src="${escapeAttr(cover.thumbnailUrl || cover.url || '')}" alt="" loading="lazy">
              <span class="gallery-folder-icon" aria-hidden="true">▰</span>
            </div>
            <div class="gallery-folder-info">
              <strong>${escapeHtml(name)}</strong>
              <span>${images.length} ${images.length === 1 ? 'billede' : 'billeder'}${latest ? ` · ${escapeHtml(latest)}` : ''}</span>
            </div>
          </button>`;
      }).join('');

      els.grid.querySelectorAll('[data-gallery-folder]').forEach(button => {
        button.addEventListener('click', () => {
          state.activeFolder = button.dataset.galleryFolder || '';
          render();
          document.querySelector('.gallery-list-block')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      });
      return;
    }

    const folderImages = folders.get(state.activeFolder) || [];
    els.grid.className = 'gallery-grid gallery-images-grid';
    els.grid.innerHTML = `
      <div class="gallery-folder-toolbar">
        <button class="gallery-back-btn" type="button" data-gallery-back>‹ Alle aktiviteter</button>
        <div>
          <h3>${escapeHtml(state.activeFolder)}</h3>
          <p>${folderImages.length} ${folderImages.length === 1 ? 'billede' : 'billeder'}</p>
        </div>
      </div>
      ${folderImages.map(image => {
        const imageIndex = state.images.indexOf(image);
        const title = image.caption || image.event || 'Concordia';
        const meta = [image.uploader ? `Foto: ${image.uploader}` : '', formatDate(image.date)].filter(Boolean).join(' · ');
        return `
          <button class="gallery-card" type="button" data-gallery-index="${imageIndex}" aria-label="Åbn ${escapeAttr(title)}">
            <img src="${escapeAttr(image.thumbnailUrl || image.url || '')}" alt="${escapeAttr(title)}" loading="lazy">
            ${meta ? `<span>${escapeHtml(meta)}</span>` : ''}
          </button>`;
      }).join('')}`;

    els.grid.querySelector('[data-gallery-back]')?.addEventListener('click', () => {
      state.activeFolder = '';
      render();
    });
    els.grid.querySelectorAll('[data-gallery-index]').forEach(button => {
      button.addEventListener('click', () => openLargeImage(Number(button.dataset.galleryIndex)));
    });
  }

  function groupByActivity(images){
    const groups = new Map();
    images.forEach(image => {
      const name = String(image.event || 'Andet').trim() || 'Andet';
      if(!groups.has(name)) groups.set(name, []);
      groups.get(name).push(image);
    });
    return new Map([...groups.entries()].sort((a, b) => {
      const aDate = String(a[1][0]?.date || '');
      const bDate = String(b[1][0]?.date || '');
      return bDate.localeCompare(aDate) || a[0].localeCompare(b[0], 'da');
    }));
  }

  function openLargeImage(index){
    const image = state.images[index];
    if(!image || !els.imageModal) return;
    const title = image.event || image.caption || 'Billede fra Concordia';
    const details = [image.event, image.uploader ? `Foto: ${image.uploader}` : '', formatDate(image.date)].filter(Boolean).join(' · ');
    els.largeImage.src = image.url || image.thumbnailUrl || '';
    els.largeImage.alt = title;
    els.largeCaption.textContent = details || title;
    els.imageModal.showModal();
  }

  function closeLargeImage(){
    if(!els.imageModal) return;
    els.imageModal.close();
    els.largeImage.removeAttribute('src');
  }

  function updateSelectedFiles(){
    const files = [...(els.fileInput.files || [])];
    if(!files.length){
      els.selectedFiles.textContent = 'Ingen billeder valgt.';
      return;
    }
    const totalMb = files.reduce((sum, file) => sum + file.size, 0) / 1024 / 1024;
    els.selectedFiles.textContent = `${files.length} ${files.length === 1 ? 'billede valgt' : 'billeder valgt'} · ${totalMb.toFixed(1).replace('.', ',')} MB før komprimering`;
  }

  async function uploadImages(event){
    event.preventDefault();
    if(!isConfigured()){
      els.uploadStatus.textContent = 'Upload er ikke koblet til Google Drive endnu.';
      return;
    }

    const files = [...(els.fileInput.files || [])];
    const uploader = els.uploaderName.value.trim();
    const eventName = els.eventName.value.trim();

    if(!uploader){
      els.uploadStatus.textContent = 'Skriv dit navn.';
      els.uploaderName.focus();
      return;
    }
    if(!eventName){
      els.uploadStatus.textContent = 'Vælg hvilken aktivitet billederne hører til.';
      els.eventName.focus();
      return;
    }
    if(!files.length){
      els.uploadStatus.textContent = 'Vælg mindst ét billede.';
      return;
    }
    if(files.some(file => !String(file.type || '').startsWith('image/'))){
      els.uploadStatus.textContent = 'Der må kun vælges billedfiler.';
      return;
    }

    try{ localStorage.setItem('concordia_gallery_uploader', uploader); }catch{}

    const batchId = `gallery-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    setUploading(true);
    setProgress(0);

    try{
      for(let i = 0; i < files.length; i++){
        els.uploadStatus.textContent = `Klargør billede ${i + 1} af ${files.length}…`;
        const prepared = await prepareImage(files[i]);
        els.uploadStatus.textContent = `Uploader billede ${i + 1} af ${files.length}…`;
        await postImage({
          batchId,
          index: i + 1,
          total: files.length,
          uploader,
          event: eventName,
          filename: prepared.filename,
          mimeType: prepared.mimeType,
          data: prepared.base64
        });
        setProgress(((i + 1) / files.length) * 90);
      }

      els.uploadStatus.textContent = 'Kontrollerer upload…';
      const confirmed = await waitForConfirmation(batchId, files.length);
      setProgress(100);
      els.uploadStatus.textContent = confirmed
        ? '✓ Billederne er sendt og afventer godkendelse.'
        : 'Billederne er sendt. Google bekræftede ikke svaret, så kontrollér indbakken i Drive.';

      els.fileInput.value = '';
      updateSelectedFiles();
      setTimeout(() => {
        if(els.uploadModal.open) els.uploadModal.close();
        setProgress(0);
      }, 1800);
    }catch(error){
      console.error('Uploadfejl', error);
      els.uploadStatus.textContent = readableUploadError(error);
    }finally{
      setUploading(false);
    }
  }

  async function prepareImage(file){
    const bitmap = await loadBitmap(file);
    const maxDimension = Math.max(800, Number(config.maxImageDimension) || 1800);
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { alpha: false });
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);
    if(typeof bitmap.close === 'function') bitmap.close();

    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(value => value ? resolve(value) : reject(new Error('Billedet kunne ikke komprimeres.')), 'image/jpeg', Number(config.jpegQuality) || 0.82);
    });
    const base64 = await blobToBase64(blob);
    const stem = String(file.name || 'billede').replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9æøåÆØÅ _-]+/g, '').trim() || 'billede';
    return {
      filename: `${stem}.jpg`,
      mimeType: 'image/jpeg',
      base64
    };
  }

  async function loadBitmap(file){
    if('createImageBitmap' in window){
      try{ return await createImageBitmap(file, { imageOrientation: 'from-image' }); }
      catch{}
    }
    return await new Promise((resolve, reject) => {
      const image = new Image();
      const url = URL.createObjectURL(file);
      image.onload = () => {
        URL.revokeObjectURL(url);
        resolve(image);
      };
      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Billedformatet kunne ikke læses. Prøv at gemme billedet som JPG først.'));
      };
      image.src = url;
    });
  }

  async function blobToBase64(blob){
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || '').split(',')[1] || '');
      reader.onerror = () => reject(new Error('Billedfilen kunne ikke læses.'));
      reader.readAsDataURL(blob);
    });
  }

  async function postImage(payload){
    const body = new URLSearchParams({ action: 'upload' });
    Object.entries(payload).forEach(([key, value]) => body.set(key, String(value ?? '')));
    await fetch(config.appsScriptUrl, {
      method: 'POST',
      mode: 'no-cors',
      body
    });
  }

  async function waitForConfirmation(batchId, expected){
    for(let attempt = 0; attempt < 8; attempt++){
      await sleep(attempt === 0 ? 500 : 900);
      try{
        const url = new URL(config.appsScriptUrl);
        url.searchParams.set('action', 'uploadStatus');
        url.searchParams.set('batchId', batchId);
        url.searchParams.set('_', Date.now());
        const response = await fetch(url.toString(), { cache: 'no-store' });
        const data = await response.json();
        if(Number(data.count || 0) >= expected) return true;
      }catch{}
    }
    return false;
  }

  function setUploading(active){
    els.submitBtn.disabled = active;
    els.fileInput.disabled = active;
    els.uploaderName.disabled = active;
    els.eventName.disabled = active;
    els.progress.hidden = !active;
    els.progress.setAttribute('aria-hidden', active ? 'false' : 'true');
  }

  function setProgress(percent){
    if(els.progressBar) els.progressBar.style.width = `${Math.max(0, Math.min(100, percent))}%`;
  }

  function readableUploadError(error){
    const message = String(error?.message || '');
    if(message.includes('Billedformatet')) return message;
    if(message.includes('komprimeres')) return message;
    return 'Uploaden mislykkedes. Kontrollér forbindelsen og prøv igen.';
  }

  function formatDate(value){
    if(!value) return '';
    const date = new Date(value);
    if(Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('da-DK', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
  }

  function escapeHtml(value){
    return String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
  }

  function escapeAttr(value){
    return escapeHtml(value).replace(/`/g, '&#96;');
  }

  function sleep(ms){ return new Promise(resolve => setTimeout(resolve, ms)); }

  return { init, loadGallery };
})();


let deferredPrompt;
const installBtn = $('#installBtn');

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredPrompt = e;
  installBtn.hidden = false;
});

installBtn.addEventListener('click', async () => {
  if(!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  installBtn.hidden = true;
});

const appVersion = $('#appVersion');
if(appVersion) appVersion.textContent = APP_VERSION;

const updateBanner = $('#updateBanner');
const updateNowBtn = $('#updateNowBtn');
let waitingWorker = null;
let refreshing = false;

function showUpdateBanner(worker){
  waitingWorker = worker;
  if(updateBanner) updateBanner.hidden = false;
}

if(updateNowBtn){
  updateNowBtn.addEventListener('click', () => {
    if(waitingWorker){
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    }else{
      location.reload();
    }
  });
}

if('serviceWorker' in navigator){
  window.addEventListener('load', async () => {
    try{
      const registration = await navigator.serviceWorker.register('sw.js?v=' + APP_VERSION);

      if(registration.waiting){
        showUpdateBanner(registration.waiting);
      }

      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if(!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if(newWorker.state === 'installed' && navigator.serviceWorker.controller){
            showUpdateBanner(newWorker);
          }
        });
      });

      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if(refreshing) return;
        refreshing = true;
        location.reload();
      });

      setTimeout(() => registration.update(), 3000);
    }catch(err){
      console.error('Service worker kunne ikke registreres', err);
    }
  });
}

init();
