// Recipient reused from the owner's existing HALAL UMMA Vietcombank QR.
export function rentalPayment(intent: {id:string;amount_vnd:number;reference:string;status:string}) {
 const amount=Number(intent.amount_vnd),account='1062679069';
 if(!Number.isSafeInteger(amount)||amount<=0||!/^[A-Z0-9]{5,32}$/.test(intent.reference))throw Error('RENT_PAYMENT');
 const tlv=(tag:string,value:string)=>{if(value.length>99)throw Error('RENT_PAYMENT');return tag+String(value.length).padStart(2,'0')+value;};
 const merchant=tlv('00','A000000727')+tlv('01',tlv('00','970436')+tlv('01',account))+tlv('02','QRIBFTTA');
 const raw=tlv('00','01')+tlv('01','12')+tlv('38',merchant)+tlv('53','704')+tlv('54',String(amount))+tlv('58','VN')+tlv('62',tlv('08',intent.reference))+'6304';
 let crc=0xffff;for(const c of raw){crc^=c.charCodeAt(0)<<8;for(let bit=0;bit<8;bit++)crc=((crc<<1)^((crc&0x8000)?0x1021:0))&0xffff;}
 return {...intent,bankName:'Vietcombank',bankCode:'vcb',account,currency:'VND',qrPayload:raw+crc.toString(16).toUpperCase().padStart(4,'0')};
}
