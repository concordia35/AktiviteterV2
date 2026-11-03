const reply=(status,body)=>new Response(body,{status,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'}});
function calendarResponse(request,url){
 if(request.method!=='GET'&&request.method!=='HEAD')return reply(405,'Method not allowed');
 const p=url.searchParams;
 if(request.url.length>12000)return reply(413,'Calendar request too large');
 const start=p.get('start')||'',end=p.get('end')||'';
 const parse=s=>/^\d{8}T\d{6}Z$/.test(s)?new Date(s.replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/,'$1-$2-$3T$4:$5:$6Z')):new Date(NaN);
 const a=parse(start),b=parse(end);
 const stamp=d=>d.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
 if(!Number.isFinite(+a)||!Number.isFinite(+b)||stamp(a)!==start||stamp(b)!==end||b<=a||b-a>7*86400000)return reply(400,'Invalid event dates');
 const title=p.get('title')||'Logeaften · Concordia 35',description=p.get('description')||'',location=p.get('location')||'Odd Fellow Logen, Slagelse',id=p.get('id')||start;
 if(title.length>300||description.length>4000||location.length>500||id.length>200)return reply(400,'Invalid event fields');
 const escape=s=>s.replace(/\\/g,'\\\\').replace(/\r\n|\r|\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g,'');
 // RFC 5545: fold by UTF-8 octets, without splitting a character.
 const fold=line=>{let out='',part='',size=0;for(const ch of line){const n=new TextEncoder().encode(ch).length;if(size+n>75){out+=part+'\r\n';part=' ';size=1;}part+=ch;size+=n;}return out+part;};
 const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Concordia35//Single event//DA','CALSCALE:GREGORIAN','METHOD:PUBLISH','BEGIN:VEVENT',
 'UID:'+escape(id+'@concordia35-tilmelding'),'DTSTAMP:'+stamp(new Date()),'DTSTART:'+start,'DTEND:'+end,
 'SUMMARY:'+escape(title),'DESCRIPTION:'+escape(description),'LOCATION:'+escape(location),'END:VEVENT','END:VCALENDAR'];
 return new Response(request.method==='HEAD'?null:lines.map(fold).join('\r\n')+'\r\n',{headers:{
 'content-type':'text/calendar; charset=utf-8','content-disposition':'inline; filename="concordia-aften.ics"',
 'cache-control':'no-store','x-content-type-options':'nosniff','access-control-allow-origin':'https://concordia35.github.io',
 'referrer-policy':'no-referrer'}});
}


export default {async fetch(request){const url=new URL(request.url);if(url.pathname!=='/calendar/event.ics')return reply(404,'Not found');return calendarResponse(request,url);}};
