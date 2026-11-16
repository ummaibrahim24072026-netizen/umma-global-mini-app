const quoteUrl='https://www.google.com/finance/beta/quote/RUB-VND?hl=en';
const maxQuoteAge=72*60*60*1000;
type Quote={vndPerRub:string,quotedAt:string};

export function parseRubleQuote(html:string, now=Date.now()):Quote|null {
 const currency=html.indexOf('Russian Ruble / Vietnamese dong</div>');
 if(currency<0)return null;
 const header=html.slice(currency,currency+1600);
 const rate=header.match(/<span jsname="Pdsbrc"[^>]*><span>([1-9][\d,]*(?:\.\d{1,8})?)<\/span>/)?.[1]?.replaceAll(',','');
 const time=header.match(/>([A-Z][a-z]{2} \d{1,2}, \d{1,2}:\d{2}:\d{2})\s+([AP]M) UTC<\/div>/);
 if(!rate||!time||+rate<10||+rate>10000)return null;
 const year=new Date(now).getUTCFullYear();
 const timestamp=[year,year-1].map(y=>Date.parse(time[1].replace(',',', '+y+',')+' '+time[2]+' UTC'))
  .find(t=>t<=now+60_000&&now-t<=maxQuoteAge);
 return timestamp===undefined?null:{vndPerRub:rate,quotedAt:new Date(timestamp).toISOString()};
}

let cache:{quote:Quote,until:number}|undefined;
let fetching:Promise<Quote|null>|undefined;
export async function googleRubleQuote():Promise<Quote|null> {
 if(cache&&Date.now()<cache.until)return cache.quote;
 if(!fetching)fetching=(async()=>{
  try{
   const res=await fetch(quoteUrl,{headers:{'User-Agent':'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36'},signal:AbortSignal.timeout(10000)});
   const quote=res.ok?parseRubleQuote(await res.text()):null;
   if(quote)cache={quote,until:Math.min(Date.now()+300000,Date.parse(quote.quotedAt)+maxQuoteAge)};
   return quote;
  }catch{
   return null;
  }
 })().finally(()=>{fetching=undefined;});
 return fetching;
}
