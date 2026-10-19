/* UMMA astronomical calculations. Adhan 4.4.3, MIT; no network or user tracking. */
(() => {
 'use strict';
 const A=window.adhan,cache=new Map();
 const prayers=['fajr','dhuhr','asr','maghrib','isha'];
 const events=['fajr','sunrise','dhuhr','asr','maghrib','isha'];
 const methods={MuslimWorldLeague:[18,17],Karachi:[18,18],Egyptian:[19.5,17.5],NorthAmerica:[15,15],Singapore:[20,18]};
 const norm=x=>(x%360+360)%360,rad=x=>x*Math.PI/180;
 function coordinates(lat,lon){if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)throw Error('coordinates');return new A.Coordinates(lat,lon);}
 function qibla(lat,lon){coordinates(lat,lon);const a=rad(lat),b=rad(21.4225),d=rad(39.8262-lon);const y=Math.sin(d)*Math.cos(b),x=Math.cos(a)*Math.sin(b)-Math.sin(a)*Math.cos(b)*Math.cos(d);if(Math.hypot(x,y)<1e-10)return null;return norm(Math.atan2(y,x)*180/Math.PI);}
 function zoneOK(zone){try{new Intl.DateTimeFormat('en',{timeZone:zone});return typeof zone==='string'&&zone.length>0;}catch{return false;}}
 function dateKey(date=new Date(),zone='Asia/Ho_Chi_Minh'){if(!zoneOK(zone))throw Error('timezone');const p=Object.fromEntries(new Intl.DateTimeFormat('en',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date).map(x=>[x.type,x.value]));return `${p.year}-${p.month}-${p.day}`;}
 function parseDate(key){if(!/^\d{4}-\d{2}-\d{2}$/.test(key))throw Error('date');const [y,m,d]=key.split('-').map(Number),utc=new Date(Date.UTC(y,m-1,d));if(y<1900||y>2100||utc.toISOString().slice(0,10)!==key)throw Error('date');return new Date(y,m-1,d,12);}
 function shift(key,n){const [y,m,d]=key.split('-').map(Number);return new Date(Date.UTC(y,m-1,d+n)).toISOString().slice(0,10);}
 function calculate(key,settings){const cacheKey=JSON.stringify([key,settings.lat,settings.lon,settings.zone,settings.method,settings.asr,settings.offsets]);if(cache.has(cacheKey))return cache.get(cacheKey);const c=coordinates(settings.lat,settings.lon);if(!zoneOK(settings.zone)||!methods[settings.method]||![1,2].includes(settings.asr))throw Error('settings');const params=A.CalculationMethod[settings.method]();params.madhab=settings.asr===2?A.Madhab.Hanafi:A.Madhab.Shafi;params.highLatitudeRule=A.HighLatitudeRule.TwilightAngle;params.polarCircleResolution=A.PolarCircleResolution.Unresolved;
  for(const p of events){const n=Number(settings.offsets?.[p]??0);if(!Number.isInteger(n)||Math.abs(n)>60)throw Error('offset');params.adjustments[p]=n;}
  const times=new A.PrayerTimes(c,parseDate(key),params),rows=events.map(id=>({id,time:times[id]}));
  const valid=rows.every(r=>Number.isFinite(+r.time))&&rows.every((r,i)=>!i||+r.time>+rows[i-1].time);
  const result={key,rows,valid,highLatitude:Math.abs(settings.lat)>=48,method:settings.method};if(cache.size>=120)cache.delete(cache.keys().next().value);cache.set(cacheKey,result);return result;
 }
 function next(now,settings){const today=dateKey(now,settings.zone),days=[-1,0,1].map(n=>calculate(shift(today,n),settings));const rows=days.flatMap(d=>d.valid?d.rows:[]).sort((a,b)=>a.time-b.time);return {next:rows.find(r=>prayers.includes(r.id)&&r.time>now)||null,last:rows.filter(r=>r.time<=now).at(-1)||null};}
 function format(date,zone){return Number.isFinite(+date)?new Intl.DateTimeFormat('en-GB',{timeZone:zone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(date):'—';}
 // Only absolute sensor samples are accepted. A user-supplied north correction
 // is required by the UI; absolute device north is not assumed to be true north.
 function sensorHeading(e){if(typeof e.webkitCompassHeading==='number'&&Number.isFinite(e.webkitCompassHeading)){if(typeof e.webkitCompassAccuracy==='number'&&(e.webkitCompassAccuracy<0||e.webkitCompassAccuracy>25))return null;return norm(e.webkitCompassHeading);}if(e.absolute===true&&typeof e.alpha==='number'&&Number.isFinite(e.alpha))return norm(360-e.alpha);return null;}
 window.ummaIslamCalc=Object.freeze({prayers,events,methods,norm,qibla,zoneOK,dateKey,shift,calculate,next,format,sensorHeading});
})();
