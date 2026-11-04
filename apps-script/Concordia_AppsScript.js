const SHEET_ID = '1gO9jUqyXwwhmqZqS0r3-XRcGkx_zwFU1Fvs7QVGE4_Q';

const SHEETS = {
  MEMBERS: 'Medlemmer',
  EVENTS: 'Arrangementer',
  SIGNUPS: 'Tilmeldinger',
  KITCHEN: 'Køkken'
};

// OneSignal - manuel push fra køkken-appen
const CONCORDIA_ONESIGNAL_APP_ID = '6917c2bb-a55c-4899-81c3-6664760c12ed';
const CONCORDIA_BROTHER_APP_URL = 'https://concordia35.github.io/AktiviteterV2/';

const MEMBER_HEADERS = ['id', 'navn'];
const EVENT_HEADERS = ['id', 'dato', 'tid', 'titel', 'beskrivelse', 'allowGuests', 'deadline', 'kategori'];
const SIGNUP_HEADERS = ['timestamp', 'memberId', 'navn', 'eventId', 'deltager', 'mad', 'guest', 'guestName', 'guestFood', 'note', 'guestCount'];

function doGet(e) {
  const action = e && e.parameter && e.parameter.action ? e.parameter.action : 'list';

  if (action === 'setup') {
    setupSheet();
    return json_({ ok: true, message: 'Sheet sat op' });
  }

  if (action === 'kitchen') {
    rebuildKitchenSheet_();
    return json_({ ok: true, message: 'Køkken opdateret' });
  }

  if (action === 'pushStatus') return json_(concordiaPushStatus_());

  const ss = SpreadsheetApp.openById(SHEET_ID);
  return json_({
    members: getMembers_(ss),
    events: getEvents_(ss),
    rows: getLatestRows_(ss)
  });
}

function doPost(e) {
  let data;
  try { data = JSON.parse(e && e.postData && e.postData.contents || '{}'); }
  catch(err) { return json_({ok:false,success:false,error:'Ugyldigt JSON.'}); }
  if (data.action === 'sendAutomatedPush') return sendAutomatedConcordiaPush_(data);
  if (data.action === 'sendPush') return sendConcordiaPush_(data);
  const lock = LockService.getScriptLock();
  let acquired = false;
  try {
    lock.waitLock(10000); acquired = true;

    if (!String(data.memberId || '').trim() || !normalizeEventId_(data.eventId || '')) throw Error('Medlem og aften skal angives.');
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const sheet = getOrCreate_(ss, SHEETS.SIGNUPS, SIGNUP_HEADERS);

    ensureHeaders_(sheet, SIGNUP_HEADERS);

    sheet.appendRow([
      new Date(),
      String(data.memberId || '').trim(),
      String(data.navn || data.name || '').trim(),
      normalizeEventId_(data.eventId || ''),
      ynText_(data.deltager || data.attending),
      ynText_(data.mad || data.meal),
      ynText_(data.guest),
      String(data.guestName || '').trim(),
      ynText_(data.guestFood || data.guestMeal),
      String(data.note || '').trim(),
      concordiaGuestCount_(data.guestCount, data.guestName, data.guest)
    ]);

    rebuildKitchenSheet_();

    return json_({ ok: true, success: true });
  } catch (err) {
    return json_({ ok: false, success: false, error: String(err) });
  } finally {
    if (acquired) lock.releaseLock();
  }
}

function setupSheet() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  getOrCreate_(ss, SHEETS.MEMBERS, MEMBER_HEADERS);
  getOrCreate_(ss, SHEETS.EVENTS, EVENT_HEADERS);
  getOrCreate_(ss, SHEETS.SIGNUPS, SIGNUP_HEADERS);
  getOrCreate_(ss, SHEETS.KITCHEN, ['Køkkenoversigt']);
  formatAll_();
  rebuildKitchenSheet_();
}

function getMembers_(ss) {
  ss = ss || SpreadsheetApp.openById(SHEET_ID);
  const sheet = getOrCreate_(ss, SHEETS.MEMBERS, MEMBER_HEADERS);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];

  const headers = normalizeHeaders_(values[0]);
  const idCol = findCol_(headers, ['id', 'medlemid', 'memberid']);
  const nameCol = findCol_(headers, ['navn', 'name']);
  const activeCol = findCol_(headers, ['aktiv', 'active']);

  return values.slice(1)
    .filter(r => nameCol !== -1 && String(r[nameCol] || '').trim())
    .filter(r => activeCol === -1 || !['nej', 'no', 'false', '0'].includes(String(r[activeCol] || '').trim().toLowerCase()))
    .map((r, i) => ({
      id: String(idCol === -1 ? i + 1 : r[idCol]).trim(),
      name: String(r[nameCol]).trim()
    }));
}

function getEvents_(ss) {
  ss = ss || SpreadsheetApp.openById(SHEET_ID);
  const sheet = getOrCreate_(ss, SHEETS.EVENTS, EVENT_HEADERS);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];

  const headers = normalizeHeaders_(values[0]);
  const idCol = findCol_(headers, ['id', 'eventid']);
  const dateCol = findCol_(headers, ['dato', 'date']);
  const timeCol = findCol_(headers, ['tid', 'time']);
  const titleCol = findCol_(headers, ['titel', 'title']);
  const descCol = findCol_(headers, ['beskrivelse', 'description']);
  const categoryCol = findCol_(headers, ['kategori', 'category', 'type']);
  const guestsCol = findCol_(headers, ['allowguests', 'gaestertilladt', 'gæstertilladt', 'gaester']);
  const deadlineCol = findCol_(headers, ['deadline', 'frist', 'tilmeldingsfrist']);

  return values.slice(1)
    .filter(r => String(idCol === -1 ? r[dateCol] : r[idCol] || '').trim())
    .map(r => {
      const date = normalizeEventId_(dateCol === -1 ? r[idCol] : r[dateCol]);
      const id = normalizeEventId_(idCol === -1 ? date : r[idCol]);
      return {
        id,
        date,
        time: normalizeTime_(timeCol === -1 ? '19:30' : r[timeCol]),
        title: String(titleCol === -1 ? '' : r[titleCol] || '').trim() || 'Logeaften',
        category: categoryCol === -1 ? '' : String(r[categoryCol] || '').trim(),
        description: descCol === -1 ? '' : String(r[descCol] || '').trim(),
        allowGuests: isYes_(guestsCol === -1 ? false : r[guestsCol]),
        deadline: normalizeDeadline_(deadlineCol === -1 ? '' : r[deadlineCol], date)
      };
    });
}

function getLatestRows_(ss) {
  ss = ss || SpreadsheetApp.openById(SHEET_ID);
  const sheet = getOrCreate_(ss, SHEETS.SIGNUPS, SIGNUP_HEADERS);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];

  const headers = normalizeHeaders_(values[0]);

  const timestampCol = findCol_(headers, ['timestamp', 'tidspunkt']);
  const memberIdCol = findCol_(headers, ['memberid', 'medlemid']);
  const nameCol = findCol_(headers, ['navn', 'name']);
  const eventIdCol = findCol_(headers, ['eventid']);
  const attendingCol = findCol_(headers, ['deltager', 'attending']);
  const mealCol = findCol_(headers, ['mad', 'meal']);
  const guestCol = findCol_(headers, ['guest', 'gaest', 'gæst']);
  const guestNameCol = findCol_(headers, ['guestname', 'gaestensnavn', 'gæstensnavn']);
  const guestFoodCol = findCol_(headers, ['guestfood', 'guestmeal', 'gaestspiser', 'gæstspiser']);
  const guestCountCol = findCol_(headers, ['guestcount']);
  const noteCol = findCol_(headers, ['note', 'bemaerkning', 'bemærkning']);

  const latest = {};

  values.slice(1).forEach((row, index) => {
    const normalized = {
      memberId: String(memberIdCol === -1 ? '' : row[memberIdCol]).trim(),
      name: String(nameCol === -1 ? '' : row[nameCol]).trim(),
      eventId: normalizeEventId_(eventIdCol === -1 ? '' : row[eventIdCol]),
      attending: ynValue_(attendingCol === -1 ? '' : row[attendingCol]),
      meal: ynValue_(mealCol === -1 ? '' : row[mealCol]),
      guest: ynValue_(guestCol === -1 ? '' : row[guestCol]),
      guestName: String(guestNameCol === -1 ? '' : row[guestNameCol]).trim(),
      guestMeal: ynValue_(guestFoodCol === -1 ? '' : row[guestFoodCol]),
      guestCount: concordiaGuestCount_(guestCountCol === -1 ? '' : row[guestCountCol], guestNameCol === -1 ? '' : row[guestNameCol], guestCol === -1 ? '' : row[guestCol]),
      note: String(noteCol === -1 ? '' : row[noteCol]).trim(),
      updatedAt: toIsoDateTime_(timestampCol === -1 ? new Date() : row[timestampCol]),
      sortIndex: index
    };

    if (!normalized.memberId || !normalized.eventId) return;

    const key = normalized.eventId + '__' + normalized.memberId;
    if (!latest[key] || normalized.sortIndex >= latest[key].sortIndex) {
      latest[key] = normalized;
    }
  });

  return Object.keys(latest).map(k => latest[k]);
}

function rebuildKitchenSheet_() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const kitchen = getOrCreate_(ss, SHEETS.KITCHEN, ['Køkkenoversigt']);
  const events = getEvents_(ss)
    .filter(e => !isPastEvent_(e.date))
    .sort((a, b) => String(a.date + a.time).localeCompare(String(b.date + b.time)));
  const latest = getLatestRows_(ss);

  kitchen.clear();

  let row = 1;

  events.forEach(event => {
    const rows = latest
      .filter(r => r.eventId === event.id && r.attending === 'yes')
      .sort((a, b) => String(a.name).localeCompare(String(b.name), 'da'));

    const brothers = rows.filter(r => !r.memberId.startsWith('external_'));
    const external = rows.filter(r => r.memberId.startsWith('external_'));
    const brotherMeals = brothers.filter(r => r.meal === 'yes').length;
    const guests = rows.reduce((n,r) => n+r.guestCount,0)+external.length;
    const guestMeals = rows.reduce((n,r) => n+(r.guestMeal === 'yes' ? r.guestCount : 0),0)+external.filter(r => r.meal === 'yes').length;
    const totalMeals = brotherMeals + guestMeals;

    kitchen.getRange(row, 1, 1, 6).merge().setValue(`${formatDate_(event.date)} kl. ${event.time} · ${event.title}`);
    kitchen.getRange(row, 1).setFontWeight('bold').setFontSize(13).setBackground('#8f2733').setFontColor('#ffffff');
    row++;

    kitchen.getRange(row, 1, 1, 5).setValues([['Deltagere', 'Brødre spiser', 'Gæster', 'Gæster spiser', 'Kuverter i alt']]).setFontWeight('bold').setBackground('#f3eadc');
    row++;

    kitchen.getRange(row, 1, 1, 5).setValues([[brothers.length, brotherMeals, guests, guestMeals, totalMeals]]);
    row += 2;

    kitchen.getRange(row, 1, 1, 6).setValues([['Navn', 'Mad', 'Gæst', 'Gæstens navn', 'Gæst spiser', 'Bemærkning']]).setFontWeight('bold').setBackground('#f3eadc');
    row++;

    if (rows.length) {
      const values = rows.map(r => [r.name, da_(r.meal), da_(r.guest), r.guestName || '', da_(r.guestMeal), r.note || '']);
      kitchen.getRange(row, 1, values.length, 6).setValues(values);
      row += values.length;
    } else {
      kitchen.getRange(row, 1).setValue('Ingen tilmeldte endnu').setFontStyle('italic');
      row++;
    }

    row += 2;
  });

  if (row === 1) {
    kitchen.getRange(1, 1).setValue('Ingen kommende aftener').setFontStyle('italic');
  }

  kitchen.setColumnWidths(1, 6, 145);
}

function getOrCreate_(ss, name, headers) {
  const sheet = ss.getSheetByName(name) || ss.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  return sheet;
}

function ensureHeaders_(sheet, headers) {
  const count = sheet.getLastColumn();
  if (!count) { sheet.getRange(1,1,1,headers.length).setValues([headers]); return; }
  const existing = sheet.getRange(1,1,1,count).getValues()[0];
  // Existing legacy signup fields are A:J. Only append the new count column.
  if (headers === SIGNUP_HEADERS && count === 10) sheet.getRange(1,11).setValue('guestCount');
  if (headers === SIGNUP_HEADERS && (count < 10 || normalizeKey_(existing[0]) !== 'timestamp' || (count >= 11 && normalizeKey_(existing[10]) !== 'guestcount'))) throw Error('Tilmeldingskolonnerne stemmer ikke. Ingen tilmelding gemt.');
}

function concordiaGuestCount_(raw, name, flag) {
  if (!isYes_(flag)) return 0;
  const direct = String(raw == null ? '' : raw).trim();
  if (/^\d+$/.test(direct)) return Math.max(1,Math.min(10,Number(direct)));
  const match = String(name || '').match(/^(\d{1,2})\s+gæst/i);
  return match ? Math.max(1,Math.min(10,Number(match[1]))) : 1;
}

function formatAll_() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  Object.values(SHEETS).forEach(name => {
    const sh = ss.getSheetByName(name);
    if (!sh) return;
    sh.setFrozenRows(1);
    if (sh.getLastColumn() > 0) {
      sh.getRange(1, 1, 1, sh.getLastColumn()).setFontWeight('bold').setBackground('#f3eadc');
      sh.autoResizeColumns(1, Math.max(1, sh.getLastColumn()));
    }
  });
}

function normalizeHeaders_(headers) {
  return headers.map(h => normalizeKey_(h));
}

function normalizeKey_(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/æ/g, 'ae')
    .replace(/ø/g, 'oe')
    .replace(/å/g, 'aa')
    .replace(/[^a-z0-9]/g, '');
}

function findCol_(headers, names) {
  const normalizedNames = names.map(normalizeKey_);
  return headers.findIndex(h => normalizedNames.includes(h));
}

function normalizeEventId_(v) {
  if (v instanceof Date) {
    return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }

  const s = String(v || '').trim();

  const isoMatch = s.match(/\d{4}-\d{2}-\d{2}/);
  if (isoMatch) return isoMatch[0];

  const dk = s.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})$/);
  if (dk) return `${dk[3]}-${String(dk[2]).padStart(2, '0')}-${String(dk[1]).padStart(2, '0')}`;

  const monthMap = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' };
  const textDate = s.match(/^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+([A-Z][a-z]{2})\s+(\d{1,2})\s+(\d{4})/);
  if (textDate) return `${textDate[3]}-${monthMap[textDate[1]]}-${String(textDate[2]).padStart(2, '0')}`;

  return s;
}

function normalizeTime_(v) {
  if (v instanceof Date) {
    return Utilities.formatDate(v, Session.getScriptTimeZone(), 'HH:mm');
  }

  const s = String(v || '').trim();
  const m = s.match(/^(\d{1,2})[.:](\d{2})/);
  if (!m) return s || '19:30';
  return `${String(m[1]).padStart(2, '0')}:${m[2]}`;
}

function normalizeDeadline_(v, fallbackDate) {
  if (!v) return '';

  if (v instanceof Date) {
    return Utilities.formatDate(v, Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm");
  }

  const s = String(v || '').trim();
  if (!s) return '';

  if (/^\d{4}-\d{2}-\d{2}[ T]\d{1,2}:\d{2}/.test(s)) {
    const parts = s.replace(' ', 'T').split('T');
    return `${normalizeEventId_(parts[0])}T${normalizeTime_(parts[1])}`;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return `${s}T23:59`;

  if (/^\d{1,2}[.\/-]\d{1,2}[.\/-]\d{4}\s+\d{1,2}[.:]\d{2}$/.test(s)) {
    const parts = s.split(/\s+/);
    return `${normalizeEventId_(parts[0])}T${normalizeTime_(parts[1])}`;
  }

  if (/^\d{1,2}[.:]\d{2}$/.test(s) && fallbackDate) {
    return `${fallbackDate}T${normalizeTime_(s)}`;
  }

  return s;
}

function isYes_(v) {
  const s = String(v || '').trim().toLowerCase();
  return ['yes', 'ja', 'true', '1', 'x'].includes(s);
}

function ynText_(v) {
  return isYes_(v) ? 'yes' : 'no';
}

function ynValue_(v) {
  return isYes_(v) ? 'yes' : 'no';
}

function da_(v) {
  return v === 'yes' ? 'Ja' : 'Nej';
}

function toIsoDateTime_(v) {
  if (v instanceof Date) {
    return Utilities.formatDate(v, Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss");
  }

  const d = new Date(v);
  if (!isNaN(d.getTime())) {
    return Utilities.formatDate(d, Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss");
  }

  return String(v || '').trim() || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss");
}

function formatDate_(iso) {
  const d = new Date(String(iso) + 'T12:00:00');
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'dd.MM.yyyy');
}

function isPastEvent_(date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const eventDate = new Date(String(normalizeEventId_(date)) + 'T23:59:59');
  return eventDate < today;
}


// Shared OneSignal delivery for manual messages and automated notifications.
// Set ONESIGNAL_CLOUDFLARE_API_KEY in Script Properties; keep ONESIGNAL_API_KEY.
// PUSH_TARGET_MODE: both (default), cloudflare, or legacy.
const CONCORDIA_CLOUD_APP_ID = '7081ee09-3c7e-43d9-8d6c-b6a9db28ff31';
const CONCORDIA_CLOUD_APP_URL = 'https://35concordia.pages.dev/';

function concordiaPushTargets_() {
  const p = PropertiesService.getScriptProperties();
  const mode = p.getProperty('PUSH_TARGET_MODE') || 'both';
  if (!['both', 'cloudflare', 'legacy'].includes(mode)) throw Error('Ugyldig PUSH_TARGET_MODE.');
  const targets = [];
  if (mode !== 'cloudflare') targets.push({name:'legacy', appId:CONCORDIA_ONESIGNAL_APP_ID, url:CONCORDIA_BROTHER_APP_URL, key:p.getProperty('ONESIGNAL_API_KEY')});
  if (mode !== 'legacy') targets.push({name:'cloudflare', appId:CONCORDIA_CLOUD_APP_ID, url:CONCORDIA_CLOUD_APP_URL, key:p.getProperty('ONESIGNAL_CLOUDFLARE_API_KEY')});
  return targets;
}

function concordiaPushStatus_() {
  try {
    const targets = concordiaPushTargets_();
    const missing = targets.filter(t => !String(t.key || '').trim()).map(t => t.name);
    return {ok:true, version:'concordia-relay-v2', securityRequired:true, ready:missing.length === 0 && !!PropertiesService.getScriptProperties().getProperty('PUSH_RELAY_TOKEN') && !!PropertiesService.getScriptProperties().getProperty('KITCHEN_PUSH_PIN'), targets:targets.map(t => t.name), reason:missing.length ? 'OneSignal-nøgle mangler for: '+missing.join(', ') : ''};
  } catch (e) { return {ok:false, ready:false, error:String(e.message || e)}; }
}

function concordiaPushUuid_(requestId, appId) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, requestId+'|'+appId, Utilities.Charset.UTF_8).slice(0,16).map(b => (b+256)%256);
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const h = bytes.map(b => b.toString(16).padStart(2,'0')).join('');
  return [h.slice(0,8),h.slice(8,12),h.slice(12,16),h.slice(16,20),h.slice(20)].join('-');
}

function concordiaPushUrl_(requested, target) {
  if (!requested) return '';
  for (const base of [CONCORDIA_BROTHER_APP_URL, CONCORDIA_CLOUD_APP_URL]) {
    if (requested.indexOf(base) === 0) {
      const suffix = requested.slice(base.length);
      // All callers use app-root query links. Reject path navigation and foreign URLs.
      if (!suffix || /^[?#]/.test(suffix)) return target.url+suffix;
    }
  }
  throw Error('Beskedens link skal pege på brødrenes app.');
}

function deliverConcordiaPush_(data, automated) {
  const title = String(data.title || '').trim();
  const message = String(data.message || '').trim();
  if (!title || title.length > (automated ? 120 : 60)) throw Error('Overskriften mangler eller er for lang.');
  if (message.length < 3 || message.length > (automated ? 2000 : 300)) throw Error('Beskeden mangler eller er for lang.');
  const requestId = String(data.requestId || Utilities.getUuid());
  if (requestId.length > 250) throw Error('Ugyldigt besked-ID.');
  const requestedUrl = String(data.url || '').trim();
  const targets = concordiaPushTargets_();
  if (targets.some(t => !String(t.key || '').trim())) throw Error('En OneSignal-nøgle mangler i Script Properties. Ingen beskeder sendt.');
  // Validate all target URLs before sending anything.
  const urls = targets.map(t => concordiaPushUrl_(requestedUrl,t));
  const results = targets.map((target,index) => {
    try {
      const payload = {
        app_id:target.appId, target_channel:'push', included_segments:['Subscribed Users'],
        name:String(data.name || (automated ? 'Automatisk besked: ' : 'Manuel besked: ')+title).slice(0,128),
        headings:{en:title}, contents:{en:message},
        idempotency_key:concordiaPushUuid_(requestId,target.appId)
      };
      if (urls[index]) payload.url = urls[index];
      const response = UrlFetchApp.fetch('https://api.onesignal.com/notifications', {
        method:'post', contentType:'application/json; charset=utf-8',
        headers:{Authorization:'Key '+String(target.key).trim()}, payload:JSON.stringify(payload), muteHttpExceptions:true
      });
      const status = response.getResponseCode();
      let result = {};
      try { result = JSON.parse(response.getContentText() || '{}'); } catch(ignore) {}
      const errors = JSON.stringify(result.errors || '');
      // An empty audience is a completed no-op, not a reason to repeat the other delivery.
      if (status >= 200 && status < 300 && !result.id && /All included players are not subscribed|No subscribed users/i.test(errors)) {
        return {target:target.name, ok:true, skipped:true, recipients:0};
      }
      if (status < 200 || status >= 300 || result.errors || !result.id) {
        return {target:target.name, ok:false, status:status, error:'OneSignal afviste beskeden for '+target.name+'.'};
      }
      return {target:target.name, ok:true, id:result.id, recipients:typeof result.recipients === 'number' ? result.recipients : null};
    } catch(e) {
      return {target:target.name, ok:false, error:'Afsendelsen til '+target.name+' kunne ikke bekræftes.'};
    }
  });
  const ok = results.every(r => r.ok);
  const ids = results.filter(r => r.id).map(r => r.id);
  return {
    ok:ok, success:ok, id:ids.join(','), notificationId:ids.join(','), results:results,
    requestId:requestId,
    recipients:results.every(r => typeof r.recipients === 'number') ? results.reduce((n,r) => n+r.recipients,0) : null,
    error:ok ? undefined : 'Beskeden blev ikke accepteret for alle versioner. Genforsøg med samme besked-ID.'
  };
}


// Run once from the Apps Script editor. Existing credentials are preserved.
function setupConcordiaPushSecurity() {
  const p = PropertiesService.getScriptProperties();
  if (!p.getProperty('PUSH_RELAY_TOKEN')) p.setProperty('PUSH_RELAY_TOKEN',Utilities.getUuid()+Utilities.getUuid());
  if (!p.getProperty('KITCHEN_PUSH_PIN')) p.setProperty('KITCHEN_PUSH_PIN',Utilities.getUuid().replace(/-/g,'').slice(0,8).toUpperCase());
  console.log('PUSH_RELAY_TOKEN: '+p.getProperty('PUSH_RELAY_TOKEN'));
  console.log('Kokkens beskedkode: '+p.getProperty('KITCHEN_PUSH_PIN'));
}

function concordiaPushAuthorized_(data, automated) {
  const p = PropertiesService.getScriptProperties();
  const token = p.getProperty('PUSH_RELAY_TOKEN') || '';
  if (token && String(data.relayToken || '') === token) return true;
  if (automated) return false;
  const pin = p.getProperty('KITCHEN_PUSH_PIN') || '';
  if (!pin) return false;
  const cache = CacheService.getScriptCache();
  const failures = Number(cache.get('push-pin-failures') || 0);
  if (failures >= 10) return false;
  if (String(data.pin || '').toUpperCase() === pin.toUpperCase()) {
    cache.remove('push-pin-failures');return true;
  }
  cache.put('push-pin-failures',String(failures+1),600);
  return false;
}

function sendConcordiaPush_(data) {
  if (!concordiaPushAuthorized_(data,false)) return json_({ok:false,success:false,error:'Beskedkoden er forkert eller mangler. Ved gentagne fejl: vent 10 minutter.',code:'push_auth'});
  try { return json_(deliverConcordiaPush_(data,false)); }
  catch(e) { return json_({ok:false, success:false, error:String(e.message || e),requestId:data.requestId || ''}); }
}

function sendAutomatedConcordiaPush_(data) {
  if (!concordiaPushAuthorized_(data,true)) return json_({ok:false,success:false,error:'PUSH_RELAY_TOKEN mangler eller er forkert.',code:'push_auth'});
  try {
    const payload = data.payload || {};
    if (!data.requestId) throw Error('Automatiske beskeder kræver et stabilt besked-ID.');
    return json_(deliverConcordiaPush_({
      title:payload.headings && (payload.headings.en || payload.headings.da),
      message:payload.contents && (payload.contents.en || payload.contents.da),
      url:payload.url || '', name:payload.name || '', requestId:data.requestId
    },true));
  } catch(e) { return json_({ok:false, success:false, error:String(e.message || e),requestId:data.requestId || ''}); }
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
