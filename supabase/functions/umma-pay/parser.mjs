// Conservative parser: unknown/masked account formats stay pending for manual review.
export function parseVcb(text, account) {
 if(typeof text!=='string'||text.length>12000)return null;
 const normalized=text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/Đ/g,'D').replace(/đ/g,'d');
 const accounts=[...normalized.matchAll(/(?:\bTK|\bACCOUNT|\bTAI KHOAN)\s*[:#]?\s*(\d{6,19})(?!\d)/gi)].map(m=>m[1]);
 if(accounts.length!==1||accounts[0]!==account)return null;
 const credits=[...normalized.matchAll(/\+\s*(\d+(?:[,.]\d{3})*)\s*(?:VND|VNĐ|₫|dong)\b/gi)];
 if(credits.length!==1||/-\s*\d[\d,.]*\s*(?:VND|VNĐ)/i.test(normalized))return null;
 const amount=Number(credits[0][1].replace(/[,.]/g,''));
 const refs=[...normalized.matchAll(/\bUMMA\s+(\d{1,18})\b/gi)];
 if(refs.length!==1||!Number.isSafeInteger(amount)||amount<=0||amount>2147483647)return null;
 return {amount,orderNumber:refs[0][1]};
}
