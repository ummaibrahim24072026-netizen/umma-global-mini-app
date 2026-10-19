export function buildJobs(A:any,p:any,now=new Date()){
 const c=p.config,parts=Object.fromEntries(new Intl.DateTimeFormat('en',{timeZone:c.zone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now).map(x=>[x.type,x.value]));
 const params=A.CalculationMethod[c.method]();params.madhab=c.asr===2?A.Madhab.Hanafi:A.Madhab.Shafi;params.highLatitudeRule=A.HighLatitudeRule.TwilightAngle;params.polarCircleResolution=A.PolarCircleResolution.Unresolved;
 for(const id of ['fajr','sunrise','dhuhr','asr','maghrib','isha'])params.adjustments[id]=c.offsets?.[id]??0;
 const jobs=[];
 for(let offset=0;offset<2;offset++){
  const utc=new Date(Date.UTC(+parts.year,+parts.month-1,+parts.day+offset));
  const date=new Date(utc.getUTCFullYear(),utc.getUTCMonth(),utc.getUTCDate(),12),times=new A.PrayerTimes(new A.Coordinates(c.lat,c.lon),date,params);
  const ordered=['fajr','sunrise','dhuhr','asr','maghrib','isha'].map(id=>+times[id]);if(ordered.some((x,i)=>!Number.isFinite(x)||i>0&&x<=ordered[i-1]))continue;
  for(const prayer of p.prayers){
   for(const kind of ['before','at_time']){
    if(kind==='before'&&p.before_minutes===0||kind==='at_time'&&!p.at_time)continue;
    const prayerAt=times[prayer],due=new Date(+prayerAt-(kind==='before'?p.before_minutes*60000:0));
    // Enabling reminders never sends earlier prayers retrospectively.
    if(+due<=+now)continue;
    jobs.push({telegram_id:p.telegram_id,local_date:utc.toISOString().slice(0,10),prayer,kind,due_at:due.toISOString(),prayer_at:prayerAt.toISOString(),config_version:p.version});
   }
  }
 }
 return jobs;
}
const names:any={ru:{fajr:'Фаджр',dhuhr:'Зухр',asr:'Аср',maghrib:'Магриб',isha:'Иша'},en:{fajr:'Fajr',dhuhr:'Dhuhr',asr:'Asr',maghrib:'Maghrib',isha:'Isha'},vi:{fajr:'Fajr',dhuhr:'Dhuhr',asr:'Asr',maghrib:'Maghrib',isha:'Isha'}};
export function messageFor(job:any,p:any){const lang=names[p.language]?p.language:'ru',time=new Intl.DateTimeFormat('en-GB',{timeZone:p.config.zone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(job.prayer_at));const name=names[lang][job.prayer];return lang==='ru'?`UMMA GLOBAL · ${name}\n${job.kind==='before'?'Скоро наступит расчётное время':'Наступило расчётное время'}: ${time} (${p.config.zone}).\nСверяйте с местной мечетью.`:lang==='vi'?`UMMA GLOBAL · ${name}\n${job.kind==='before'?'Sắp đến giờ tính toán':'Đã đến giờ tính toán'}: ${time} (${p.config.zone}).\nĐối chiếu với thánh đường địa phương.`:`UMMA GLOBAL · ${name}\n${job.kind==='before'?'Calculated prayer time is approaching':'Calculated prayer time has begun'}: ${time} (${p.config.zone}).\nCompare with your local mosque.`;}
