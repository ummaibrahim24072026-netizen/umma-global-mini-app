const googleFinance='https://www.google.com/finance/beta/quote/';
const pairs={
  'RUB-VND':{title:'Russian Ruble / Vietnamese dong',min:10,max:10000},
  'USD-VND':{title:'United States Dollar / Vietnamese dong',min:1000,max:100000},
  'EUR-VND':{title:'Euro / Vietnamese dong',min:1000,max:100000},
  'RUB-KZT':{title:'Russian Ruble / Kazakhstani Tenge',min:0.1,max:100},
};
type Pair=keyof typeof pairs;
const maxQuoteAge=72*60*60*1000;
type Quote={rate:string,quotedAt:string};

export function parseGoogleRate(html:string, pair:Pair, now=Date.now()):Quote|null {
 const {title,min,max}=pairs[pair];
 const currency=html.indexOf(title+'</div>');
 if(currency<0)return null;
 const header=html.slice(currency,currency+1600);
 const rate=header.match(/<span jsname="Pdsbrc"[^>]*><span>([\d,]+(?:\.\d{1,8})?)<\/span>/)?.[1]?.replaceAll(',','');
 const time=header.match(/>([A-Z][a-z]{2} \d{1,2}, \d{1,2}:\d{2}:\d{2})\s+([AP]M) UTC<\/div>/);
 if(!rate||!time||+rate<min||+rate>max)return null;
 const year=new Date(now).getUTCFullYear();
 const timestamp=[year,year-1].map(y=>Date.parse(time[1].replace(',',', '+y+',')+' '+time[2]+' UTC'))
  .find(t=>t<=now+60_000&&now-t<=maxQuoteAge);
 return timestamp===undefined?null:{rate,quotedAt:new Date(timestamp).toISOString()};
}

const cache=new Map<Pair,{quote:Quote,until:number}>();
const fetching=new Map<Pair,Promise<Quote|null>>();
async function googleRate(pair:Pair):Promise<Quote|null> {
 const cached=cache.get(pair);
 if(cached&&Date.now()<cached.until)return cached.quote;
 const pending=fetching.get(pair);
 if(pending)return pending;
 const request=(async()=>{
  try{
   const res=await fetch(googleFinance+pair+'?hl=en',{headers:{'User-Agent':'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36'},signal:AbortSignal.timeout(10000)});
   const quote=res.ok?parseGoogleRate(await res.text(),pair):null;
   if(quote)cache.set(pair,{quote,until:Math.min(Date.now()+300000,Date.parse(quote.quotedAt)+maxQuoteAge)});
   return quote;
  }catch{
   return null;
  }
 })().finally(()=>fetching.delete(pair));
 fetching.set(pair,request);
 return request;
}

const rubleQuote=(quote:Quote|null)=>quote&&{vndPerRub:quote.rate,quotedAt:quote.quotedAt};
export function parseRubleQuote(html:string, now=Date.now()){
 return rubleQuote(parseGoogleRate(html,'RUB-VND',now));
}

export const googleRubleQuote=async()=>rubleQuote(await googleRate('RUB-VND'));

export async function googleTengeQuote(){
 // Google lists both rates against RUB. Keep the older timestamp for the cross rate.
 const [vnd,kzt]=await Promise.all([googleRate('RUB-VND'),googleRate('RUB-KZT')]);
 if(!vnd||!kzt)return null;
 const vndPerKzt=Number(vnd.rate)/Number(kzt.rate);
 if(!Number.isFinite(vndPerKzt)||vndPerKzt<1||vndPerKzt>1000)return null;
 return {vndPerKzt:vndPerKzt.toFixed(8),quotedAt:vnd.quotedAt<kzt.quotedAt?vnd.quotedAt:kzt.quotedAt};
}

export async function googleCashQuote(currency:'USD'|'EUR'){
 const quote=await googleRate(currency==='USD'?'USD-VND':'EUR-VND');
 if(!quote||Date.now()-Date.parse(quote.quotedAt)>=24*60*60*1000)return null;
 return {currency,vndPerUnit:Number(quote.rate),quotedAt:quote.quotedAt,source:'Google Finance'};
}
