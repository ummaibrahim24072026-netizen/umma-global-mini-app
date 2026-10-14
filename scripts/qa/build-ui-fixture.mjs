import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
// Generated UI fixture uses real markup/scripts and an in-memory backend. CSP blocks all external calls.
const target=process.argv[2];if(!target)throw Error('QA output directory required');mkdirSync(target,{recursive:true});
let html=readFileSync('index.html','utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<link\b[^>]*>/gi,'');
html=html.replace('</head>','<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\'; style-src \'unsafe-inline\'; img-src data:; connect-src \'none\'"><style>'+readFileSync('css/app.css','utf8')+readFileSync('css/admin.css','utf8')+'.app{width:320px;margin:0}.qa-toolbar{position:fixed;right:12px;top:12px;z-index:200;background:white;padding:12px;display:grid;gap:8px;max-width:220px}button{cursor:pointer}</style></head>');
const setup=`window.ummaRole='super_admin';window.Telegram={WebApp:{initData:'synthetic-qa-only',initDataUnsafe:{user:{id:10}}}};
const location={id:'11111111-1111-4111-8111-111111111111',name:'QA HALAL UMMA',location_type:'cafe'};
const product={id:'33333333-3333-4333-8333-333333333333',name_ru:'Тестовый плов',name_vi:'QA pilaf',name_en:'QA pilaf',price_vnd:120000};
let qaOrders=[{id:'44444444-4444-4444-8444-444444444444',location_id:location.id,order_number:1,order_type:'delivery',status:'ready',delivery_status:'courier_assigned',courier_telegram_id:20,customer_name:'QA guest',delivery_address:'Длинный адрес доставки '+ 'LongAddressWithoutSpaces'.repeat(6),payment_method:'cash',payment_status:'pending',total_vnd:120000,staffRole:'manager',canAcceptPayments:true,cafe_order_items:[{product_name_ru:'Тестовый плов',quantity:1,line_total_vnd:120000}],created_at:new Date().toISOString()}];
const reply=data=>new Response(JSON.stringify({ok:true,...data}),{headers:{'Content-Type':'application/json'}});
window.fetch=async(url,options={})=>{const body=options.body?JSON.parse(options.body):{};
if(!options.body)return reply({products:[product]});
if(body.staffOrder){const id=crypto.randomUUID();const amount=body.items.reduce((sum,item)=>sum+item.quantity*120000,0);qaOrders.push({...qaOrders[0],id,order_number:qaOrders.length+1,status:'pending',delivery_status:'waiting_courier',courier_telegram_id:null,customer_name:body.customerName,delivery_address:body.deliveryAddress,payment_method:body.paymentMethod,total_vnd:amount});return reply({order:{id,orderNumber:qaOrders.length,totalVnd:amount}});}
if(body.action==='list')return reply({orders:qaOrders,locationIds:[location.id],locations:[location],staffRole:'manager',actorTelegramId:10,couriers:[{telegram_id:20,location_id:location.id,name:'Очень длинное тестовое имя курьера'}]});
if(body.action==='cashList')return reply({locationId:location.id,cafeName:location.name,locations:[location],receipts:[],refunds:[],handovers:[],staff:[],shifts:[],actorTelegramId:10,cashSummary:{total24hVnd:0,cash24hVnd:0,refund24hVnd:0,pendingHandovers:0}});
const order=qaOrders.find(o=>o.id===body.orderId);
if(body.action==='refundOrder'&&order){order.payment_status='refunded';order.status='cancelled';return reply({refund:{id:crypto.randomUUID(),amount_vnd:order.total_vnd}});}
if(body.action==='updatePayment'&&order)order.payment_status=body.paymentStatus;
if(body.action==='updateDelivery'&&order)order.delivery_status=body.deliveryStatus;
if(body.action==='updateStatus'&&order)order.status=body.status;
return reply({});};
window.ummaCafeRequests={request:(url,payload)=>window.fetch(url,{body:JSON.stringify(payload)})};
window.showToast=()=>{};
`;
const controls=`<aside class="qa-toolbar"><strong>QA · только фиктивные данные</strong><label>Ширина<select id="qaWidth"><option>320</option><option>390</option><option>768</option></select></label><button id="qaKitchen">Кухня</button><button id="qaPaid">Тестовый оплаченный заказ</button></aside>`;
html=html.replace('</body>',controls+'<script>'+setup+'</script><script>'+readFileSync('js/cafe/kitchen.js','utf8')+'</script><script>'+`document.getElementById('qaWidth').onchange=event=>document.querySelector('.app').style.width=event.target.value+'px';document.getElementById('qaKitchen').onclick=()=>window.ummaKitchen.open();document.getElementById('qaPaid').onclick=()=>{qaOrders[0].payment_status='paid';window.ummaKitchen.open();};document.getElementById('staffEntryButton').click();`+'</script></body>');
writeFileSync(target+'/index.html',html);
