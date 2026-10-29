/* Concordia Monitor: anonymous diagnostics only. No names, IDs, IPs, notes or unique identifiers. */
(()=>{'use strict';
const ENDPOINT='https://concordia-telemetry.oddfellow-concordia35.workers.dev/collect';
const ALLOWED=new Set(['app_open','tab_view','signup_load','signup_saved','signup_error','calendar_click','activity_load_error','javascript_error']);
const ALLOWED_TABS=new Set(['overview','loge','initiatives','gallery','about']);
const ALLOWED_CHANNELS=new Set(['apple','google','unknown']);
const ALLOWED_ERRORS=new Set(['network','timeout','http','invalid_response','unknown']);
const started=performance.now();
const sent=new Map();
function device(){const ua=navigator.userAgent||'';if(/iPhone|iPad|iPod/i.test(ua))return 'ios';if(/Android/i.test(ua))return 'android';return 'desktop'}
function emit(type,detail={}){
try{
 if(!ALLOWED.has(type))return;
 const now=Date.now();const throttle=type==='tab_view'?2500:type==='javascript_error'?15000:0;
 const safe={
  event:type,
  tab:ALLOWED_TABS.has(detail.tab)?detail.tab:'unknown',
  channel:ALLOWED_CHANNELS.has(detail.channel)?detail.channel:'unknown',
  error:ALLOWED_ERRORS.has(detail.error)?detail.error:'unknown',
  device:device(),
  duration_ms:Number.isFinite(detail.duration_ms)?Math.max(0,Math.min(60000,Math.round(detail.duration_ms))):0,
  app_version:'1.7.5'
 };
 const key=[safe.event,safe.tab,safe.channel,safe.error].join('|');
 if(throttle&&now-(sent.get(key)||0)<throttle)return;
 sent.set(key,now);
 const body=JSON.stringify(safe);
 if(navigator.sendBeacon){navigator.sendBeacon(ENDPOINT,new Blob([body],{type:'text/plain;charset=UTF-8'}))}
 else fetch(ENDPOINT,{method:'POST',body,headers:{'Content-Type':'text/plain;charset=UTF-8'},mode:'no-cors',keepalive:true}).catch(()=>{});
}catch{}}
window.ConcordiaTelemetry=Object.freeze({emit});
window.addEventListener('error',()=>emit('javascript_error'),{passive:true});
window.addEventListener('unhandledrejection',()=>emit('javascript_error'),{passive:true});
document.addEventListener('click',e=>{
 const nav=e.target.closest('.nav-btn[data-view]');
 if(nav)emit('tab_view',{tab:nav.dataset.view});
 const calendar=e.target.closest('a.signup-calendar-btn');
 if(calendar){
  const label=calendar.getAttribute('aria-label')||'';
  emit('calendar_click',{channel:/Google/.test(label)?'google':/Apple|Outlook/.test(label)?'apple':'unknown'});
 }
},{passive:true});
const ready=()=>emit('app_open',{duration_ms:performance.now()-started});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready,{once:true});else ready();
})();
