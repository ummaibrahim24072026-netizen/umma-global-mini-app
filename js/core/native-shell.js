/* Native-feeling presentation only. Does not change identities, orders or payments. */
(() => {
 'use strict';
 const sdk=window.Telegram?.WebApp,app=document.querySelector('.app'),byId=id=>document.getElementById(id);
 if(!app)return;
 const paths={navHome:'M4.5 10.5v9a1 1 0 0 0 1 1H9v-6h6v6h3.5a1 1 0 0 0 1-1v-9',navCafe:'M4 16a8 8 0 0 1 16 0M3 16h18M5 20h14',navOrders:'M8 5H6a1.5 1.5 0 0 0-1.5 1.5v13A1.5 1.5 0 0 0 6 21h12a1.5 1.5 0 0 0 1.5-1.5v-13A1.5 1.5 0 0 0 18 5h-2M8 11h8M8 15h5',navBell:'M5 16c1-1.5 1.5-3 1.5-7a5.5 5.5 0 0 1 11 0c0 4 .5 5.5 1.5 7M4 17h16M9.5 20h5',navMore:'M4 4h5v5H4zM4 15h5v5H4zM15 15h5v5h-5z',serving:'M4 16a8 8 0 0 1 16 0M3 16h18M5 20h14',globe:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M3 12h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18',kitchen:'M4 10h16v8a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3zm-2 0h20M8 3v3m4-4v4m4-3v3',courier:'M3 7h11v11H3zm11 4h4l3 4v3h-7M7 18a2 2 0 1 0 0 4 2 2 0 0 0 0-4m10 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4',accounting:'M4 21h16M6 17V9h3v8m3 0V3h3v14m3 0v-5h3v5',home:'M3 10 12 3l9 7M5 9v12h5v-7h4v7h5V9',cafe:'M4 3v7m3-7v7m-6-4v2a3 3 0 0 0 6 0V3M4 11v10M15 3v8h4V3m0 8v10',orders:'M7 3h10v3H7zM7 5H4v16h16V5h-3M8 11h8M8 15h5',bell:'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4',more:'M5 6h14M5 12h14M5 18h14',expand:'M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5',market:'M3 3h2l3 12h11l2-8H6M10 20h.01M18 20h.01',travel:'m3 13 18-8-8 18-2-10z',hotels:'M4 21V3h16v18M8 7h2m4 0h2M8 11h2m4 0h2M10 21v-6h4v6',realestate:'M3 10 12 3l9 7M5 9v12h14V9m-9 12v-7h4v7',community:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8M17 4a4 4 0 0 1 0 7m5 10v-2a4 4 0 0 0-3-4',business:'M8 7V3h8v4M3 7h18v14H3zM3 12h18M10 12v3h4v-3',education:'m2 9 10-5 10 5-10 5zm4 3v6l6 3 6-3v-6M22 9v7',health:'M20 4c-3-2-6 0-8 3-2-3-5-5-8-3-5 4 2 11 8 17 6-6 13-13 8-17',farm:'M5 21c0-6 3-12 12-16M4 12C1 3 11 2 21 3c-1 10-4 19-13 15'};
 function icon(name){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('class','umma-icon');svg.setAttribute('aria-hidden','true');const p=document.createElementNS(svg.namespaceURI,'path');p.setAttribute('d',paths[name]||(name==='b2b'?paths.business:paths.more));svg.append(p);const accents={navHome:'M3 10 12 3l9 7',navCafe:'M10 5h4M12 5v3',navOrders:'M9 3h6v4H9z',navBell:'M10 2h4',navMore:'M15 4h5v5h-5z'};if(accents[name]){const accent=document.createElementNS(svg.namespaceURI,'path');accent.setAttribute('d',accents[name]);accent.setAttribute('class','umma-icon-accent');svg.append(accent);}if(name==='serving'){const accent=document.createElementNS(svg.namespaceURI,'path');accent.setAttribute('d','M10 5h4M12 5v3');accent.setAttribute('class','direction-icon-gold');svg.append(accent);}return svg;}
 document.querySelectorAll('[data-native-icon]').forEach(el=>{
  const nav=el.closest('.bottom-nav,.cafe-notification-bar'),key=el.dataset.nativeIcon,mapping={home:'navHome',cafe:'navCafe',orders:'navOrders',bell:'navBell',more:'navMore'};el.replaceChildren(icon(nav?(mapping[key]||key):key));
  if(nav){el.classList.add('brand-nav-icon');el.setAttribute('aria-hidden','true');const crop=document.createElement('span');crop.className='nav-art';const image=document.createElement('img');image.alt='';image.width=1536;image.height=1024;image.decoding='async';const cell={home:[0,0],cafe:[1,0],orders:[2,0],bell:[0,1],more:[1,1]}[key];if(!cell)return;image.style.left=(-100*cell[0])+'%';image.style.top=(-100*cell[1])+'%';image.onload=()=>el.classList.add('nav-art-ready');image.onerror=()=>el.classList.remove('nav-art-ready');image.src='assets/illustrations/navigation-atlas-v2.webp';crop.append(image);el.append(crop);}
 });
 for(const [id,name] of Object.entries({staffEntryButton:'orders',staffKitchenEntryButton:'kitchen',staffCourierEntryButton:'courier',accountingEntryButton:'accounting'}))byId(id)?.querySelector('.admin-entry-icon')?.replaceChildren(icon(name));
 const scenes=['adminPage','adminUsersPage','locationAdminPage','cafeProductsAdminPage','cafeStaffAdminPage','cafeWaiterPage','cafeKitchenPage','cafeInventoryPage','cafePage','cafeOrdersPage','cafeAccountingPage','marketPage','marketShopPage','b2bPage','servicesPage'];
 scenes.forEach(id=>byId(id)?.classList.add('native-screen'));
 const titles={marketPage:'UMMA Stock & Scan',marketShopPage:'UMMA Market',b2bPage:'UMMA B2B',home:'UMMA Global',cafePage:'UMMA Cafe',cafeOrdersPage:'Мои заказы',servicesPage:'Ещё',adminPage:'Администрирование',adminUsersPage:'Пользователи',locationAdminPage:'Локации',cafeProductsAdminPage:'Меню кафе',cafeStaffAdminPage:'Сотрудники',cafeWaiterPage:'Приём заказов',cafeKitchenPage:'Работа в кафе',cafeInventoryPage:'Товары и остатки',cafeAccountingPage:'Учёт кафе'};
 const current=()=>scenes.find(id=>byId(id)&&!byId(id).hidden)||'home';
 let active='home',dialog=null;
 function syncScene(records=[]){
  const opened=records.filter(r=>r.attributeName==='hidden'&&scenes.includes(r.target.id)&&!r.target.hidden).map(r=>r.target.id);
  const next=opened.at(-1)||current();
  const home=document.querySelector('.app>main'),nav=document.querySelector('.bottom-nav');
  if(home&&home.style.display!==(next==='home'?'':'none'))home.style.display=next==='home'?'':'none';
  const navDisplay=['home','cafePage','cafeOrdersPage','servicesPage'].includes(next)?'':'none';if(nav&&nav.style.display!==navDisplay)nav.style.display=navDisplay;
  if(next!=='home')scenes.forEach(id=>{if(id!==next&&byId(id)&&!byId(id).hidden)byId(id).hidden=true;});
  if(next!==active){const el=next==='home'?document.querySelector('.app>main'):byId(next);el?.classList.add('native-screen-enter');window.setTimeout(()=>el?.classList.remove('native-screen-enter'),180);active=next;}
  const title=byId('nativeAppTitle');if(title&&title.textContent!==(titles[next]||'UMMA Global'))title.textContent=titles[next]||'UMMA Global';
  try{if(next==='home'&&!dialog?.open&&!document.querySelector('dialog[open]')&&byId('courierMapModal')?.hidden!==false)sdk?.BackButton?.hide();else sdk?.BackButton?.show();}catch{}
 }
 new MutationObserver(syncScene).observe(app,{subtree:true,attributes:true,attributeFilter:['hidden','style']});
 new MutationObserver(records=>{if(records.some(r=>r.type==='attributes'&&r.target.tagName==='DIALOG'||r.type==='childList'&&r.target===document.body&&[...r.addedNodes,...r.removedNodes].some(n=>n.nodeName==='DIALOG')))syncScene();}).observe(document.body,{subtree:true,attributes:true,attributeFilter:['open'],childList:true});syncScene();
 let restingHeight=Number(sdk?.viewportStableHeight)||window.innerHeight;
 function geometry(){
  const focused=/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName||'');
  const visual=window.visualViewport,stable=Number(sdk?.viewportStableHeight)||window.innerHeight;
  if(!focused)restingHeight=stable;
  const keyboard=focused&&visual&&Math.max(stable,restingHeight)-visual.height>140;
  const height=keyboard?visual.height:(Number(sdk?.viewportStableHeight)||visual?.height||window.innerHeight);
  const root=document.documentElement.style;
  if(height>0)root.setProperty('--umma-viewport-height',Math.round(height)+'px');
  root.setProperty('--umma-keyboard-offset',Math.max(0,keyboard?window.innerHeight-visual.height-(visual.offsetTop||0):0)+'px');
  const device=sdk?.safeAreaInset||{},content=sdk?.contentSafeAreaInset||{};
  for(const side of ['top','bottom','left','right']){
   const fallback=side==='top'&&sdk?.isFullscreen&&!Number(content.top)?48:0;
   const inset=(Number(device[side])||0)+Math.max(Number(content[side])||0,fallback);
   root.setProperty('--umma-safe-'+side,'max('+inset+'px, env(safe-area-inset-'+side+', 0px))');
  }
  app.classList.toggle('native-keyboard',!!keyboard);
  if(keyboard)window.setTimeout(()=>document.activeElement?.scrollIntoView?.({block:'nearest',behavior:'smooth'}),160);
  const button=byId('nativeFullscreen');if(button)button.hidden=!supportsFull()||sdk.isFullscreen===true;
 }
 const supportsFull=()=>sdk?.initData&&typeof sdk.requestFullscreen==='function'&&(!sdk.isVersionAtLeast||sdk.isVersionAtLeast('8.0'));
 function fullscreen(){if(!supportsFull())return;try{sdk.requestFullscreen();}catch{sdk.expand?.();}geometry();}
 byId('nativeFullscreen')?.addEventListener('click',fullscreen);
 window.addEventListener('resize',geometry);window.visualViewport?.addEventListener('resize',geometry);
 document.addEventListener('focusin',geometry);document.addEventListener('focusout',()=>window.setTimeout(geometry,80));
 for(const event of ['viewportChanged','safeAreaChanged','contentSafeAreaChanged','fullscreenChanged','fullscreenFailed'])try{sdk?.onEvent?.(event,geometry);}catch{}
 try{sdk?.BackButton?.onClick(()=>{if(dialog?.open){dialog.close();return;}if(!window.ummaNavigation?.back()&&current()!=='home'&&typeof openPage==='function')openPage('home');});}catch{}
 geometry();if(supportsFull())fullscreen();
 let lastHaptic=0;document.addEventListener('click',event=>{const button=event.target.closest?.('button');if(!button||button.disabled||Date.now()-lastHaptic<60)return;lastHaptic=Date.now();try{sdk?.HapticFeedback?.impactOccurred('light');}catch{}});
 // One registry drives the home overview, directory, search and future module pages.
 const directions=[
  {id:"quran",icon:"education",group:"family",title:"Коран",description:"Арабский оригинал, перевод Кулиева и тафсир ас-Саади",available:true},
  {
    "id": "cafe",
    "icon": "cafe",
    "group": "food",
    "title": "UMMA Cafe",
    "description": "Готовые блюда и напитки",
    "available": true
  },
  {
    "id": "market",
    "icon": "market",
    "group": "food",
    "title": "UMMA Market",
    "description": "Продукты и товары для семьи",
    "available": true,
    "launchStatus": "В разработке"
  },
  {
    "id": "b2b",
    "icon": "business",
    "group": "food",
    "title": "UMMA B2B",
    "description": "Продукты и товары для бизнеса",
    "available": true,
    "launchStatus": "В разработке"
  },
  {
    "id": "trade",
    "icon": "business",
    "group": "food",
    "title": "Торговля",
    "description": "Импорт, экспорт и оптовые поставки",
    "available": false
  },
  {
    "id": "farm",
    "icon": "farm",
    "group": "food",
    "title": "Ферма",
    "description": "Растениеводство, животноводство и натуральные продукты",
    "available": false
  },
  {
    "id": "production",
    "icon": "farm",
    "group": "food",
    "title": "Производство",
    "description": "Собственная продукция, переработка и упаковка",
    "available": false
  },
  {
    "id": "family",
    "icon": "community",
    "group": "family",
    "title": "Семья",
    "description": "Поддержка семьи, отношения и семейные программы",
    "available": false
  },
  {
    "id": "kids",
    "icon": "community",
    "group": "family",
    "title": "Дети",
    "description": "Детские занятия, развитие и досуг",
    "available": false
  },
  {
    "id": "care",
    "icon": "health",
    "group": "family",
    "title": "Забота",
    "description": "Поддержка пожилых и людей, которым нужна забота",
    "available": false
  },
  {
    "id": "education",
    "icon": "education",
    "group": "family",
    "title": "Образование",
    "description": "Детский сад, школа, медресе, университет и курсы",
    "available": false,
    "features": [
      "Детский сад",
      "Школа",
      "Медресе",
      "Университет",
      "Курсы и обучение"
    ]
  },
  {
    "id": "health",
    "icon": "health",
    "group": "wellbeing",
    "title": "Здоровье",
    "description": "Здоровье, профилактика и сопровождение",
    "available": false
  },
  {
    "id": "fitness",
    "icon": "health",
    "group": "wellbeing",
    "title": "Фитнес",
    "description": "Тренировки, занятия и спортивные программы",
    "available": false
  },
  {
    "id": "barbershop",
    "icon": "more",
    "group": "wellbeing",
    "title": "Барбершоп",
    "description": "Мужские стрижки и уход",
    "available": false
  },
  {
    "id": "beauty",
    "icon": "more",
    "group": "wellbeing",
    "title": "Женский салон",
    "description": "Уход и услуги для женщин",
    "available": false
  },
  {
    "id": "household",
    "icon": "home",
    "group": "home",
    "title": "Дом и быт",
    "description": "Бытовые услуги, ремонт и обустройство",
    "available": false
  },
  {
    "id": "realestate",
    "icon": "realestate",
    "group": "home",
    "title": "Недвижимость",
    "description": "Жильё, покупка, продажа и аренда",
    "available": false
  },
  {
    "id": "cleaning",
    "icon": "home",
    "group": "home",
    "title": "Клининг",
    "description": "Уборка дома и коммерческих помещений",
    "available": false
  },
  {
    "id": "travel",
    "icon": "travel",
    "group": "travel",
    "title": "Путешествия",
    "description": "Организация поездок и билеты",
    "available": false
  },
  {
    "id": "hotels",
    "icon": "hotels",
    "group": "travel",
    "title": "Отели",
    "description": "Проживание и бронирование отелей",
    "available": false
  },
  {
    "id": "tours",
    "icon": "travel",
    "group": "travel",
    "title": "Туры и экскурсии",
    "description": "Экскурсии, маршруты и сопровождение",
    "available": false
  },
  {
    "id": "visa",
    "icon": "orders",
    "group": "travel",
    "title": "Визовые услуги",
    "description": "Визы и сопровождение документов",
    "available": false
  },
  {
    "id": "mobility",
    "icon": "courier",
    "group": "transport",
    "title": "Передвижение",
    "description": "Транспортные сервисы и маршруты",
    "available": false
  },
  {
    "id": "taxi",
    "icon": "courier",
    "group": "transport",
    "title": "UMMA Taxi",
    "description": "Городские поездки и трансферы",
    "available": false
  },
  {
    "id": "auto",
    "icon": "courier",
    "group": "transport",
    "title": "Авто и мототехника",
    "description": "Покупка и продажа автомобилей и мототехники",
    "available": false
  },
  {
    "id": "rent",
    "icon": "courier",
    "group": "transport",
    "title": "Прокат транспорта",
    "description": "Аренда автомобилей, мотоциклов и скутеров",
    "available": false
  },
  {
    "id": "logistics",
    "icon": "courier",
    "group": "transport",
    "title": "Логистика",
    "description": "Доставка, перевозки и отправления",
    "available": false
  },
  {
    "id": "business",
    "icon": "business",
    "group": "business",
    "title": "Бизнес",
    "description": "Предпринимательство, партнёрства и франшиза",
    "available": false
  },
  {
    "id": "jobs",
    "icon": "business",
    "group": "business",
    "title": "Работа",
    "description": "Вакансии, специалисты и занятость",
    "available": false
  },
  {
    "id": "fashion",
    "icon": "more",
    "group": "business",
    "title": "Одежда и стиль",
    "description": "Одежда, аксессуары и собственные коллекции",
    "available": false
  },
  {
    "id": "energy",
    "icon": "more",
    "group": "business",
    "title": "Энергия",
    "description": "Энергетические решения и проекты",
    "available": false
  },
  {
    "id": "finance",
    "icon": "accounting",
    "group": "business",
    "title": "Финансы",
    "description": "Финансовые сервисы и учёт",
    "available": false
  },
  {
    "id": "exchange",
    "icon": "accounting",
    "group": "business",
    "title": "Обмен валют",
    "description": "Обмен валют и переводы",
    "available": false
  },
  {
    "id": "community",
    "icon": "community",
    "group": "society",
    "title": "Сообщество",
    "description": "Знакомства, взаимопомощь и связи",
    "available": false
  },
  {
    "id": "events",
    "icon": "community",
    "group": "society",
    "title": "Мероприятия",
    "description": "Встречи, семейные и общественные мероприятия",
    "available": false
  },
  {
    "id": "media",
    "icon": "more",
    "group": "society",
    "title": "Медиа",
    "description": "Новости, публикации и полезные материалы",
    "available": false
  },
  {
    "id": "charity",
    "icon": "health",
    "group": "society",
    "title": "Благотворительность",
    "description": "Закят, садака и адресная помощь",
    "available": false
  },
  {
    "id": "waqf",
    "icon": "community",
    "group": "society",
    "title": "Вакф",
    "description": "Долгосрочные общественно полезные проекты и фонд",
    "available": false
  }
];
 const groups=[{"id": "food", "title": "Еда и торговля"}, {"id": "family", "title": "Семья и образование"}, {"id": "wellbeing", "title": "Здоровье и уход"}, {"id": "home", "title": "Дом и услуги"}, {"id": "travel", "title": "Путешествия и проживание"}, {"id": "transport", "title": "Транспорт и доставка"}, {"id": "business", "title": "Бизнес и сервисы"}, {"id": "society", "title": "Общество и помощь"}];
 const copy={"Коран":{"en":"Quran","vi":"Kinh Qur’an"},"Арабский оригинал, перевод Кулиева и тафсир ас-Саади":{"en":"Arabic text, Kuliev’s Russian translation and as-Saadi’s tafsir","vi":"Bản gốc Ả Rập, bản dịch tiếng Nga Kuliev và tafsir as-Saadi"},"UMMA Cafe": {"en": "UMMA Cafe", "vi": "UMMA Cafe"}, "Готовые блюда и напитки": {"en": "Meals and drinks", "vi": "Món ăn và đồ uống"}, "UMMA Market": {"en": "UMMA Market", "vi": "UMMA Market"}, "Продукты и товары для семьи": {"en": "Groceries and household goods", "vi": "Thực phẩm và hàng gia dụng"}, "UMMA B2B": {"en": "UMMA B2B", "vi": "UMMA B2B"}, "Продукты и товары для бизнеса": {"en": "Food and supplies for businesses", "vi": "Thực phẩm và hàng hóa cho doanh nghiệp"}, "Торговля": {"en": "Trade", "vi": "Thương mại"}, "Импорт, экспорт и оптовые поставки": {"en": "Import, export and wholesale supply", "vi": "Xuất nhập khẩu và cung ứng bán buôn"}, "Ферма": {"en": "Farm", "vi": "Nông trại"}, "Растениеводство, животноводство и натуральные продукты": {"en": "Crops, livestock and natural produce", "vi": "Trồng trọt, chăn nuôi và nông sản"}, "Производство": {"en": "Production", "vi": "Sản xuất"}, "Собственная продукция, переработка и упаковка": {"en": "Own products, processing and packaging", "vi": "Sản phẩm riêng, chế biến và đóng gói"}, "Семья": {"en": "Family", "vi": "Gia đình"}, "Поддержка семьи, отношения и семейные программы": {"en": "Family support, relationships and programmes", "vi": "Hỗ trợ gia đình, các mối quan hệ và chương trình gia đình"}, "Дети": {"en": "Kids", "vi": "Trẻ em"}, "Детские занятия, развитие и досуг": {"en": "Activities, development and leisure for children", "vi": "Hoạt động, phát triển và vui chơi cho trẻ em"}, "Забота": {"en": "Care", "vi": "Chăm sóc"}, "Поддержка пожилых и людей, которым нужна забота": {"en": "Support for older people and those needing care", "vi": "Hỗ trợ người cao tuổi và người cần chăm sóc"}, "Образование": {"en": "Education", "vi": "Giáo dục"}, "Детский сад, школа, медресе, университет и курсы": {"en": "Kindergarten, school, madrasah, university and courses", "vi": "Mẫu giáo, trường học, trường Hồi giáo, đại học và khóa học"}, "Детский сад": {"en": "Kindergarten", "vi": "Mẫu giáo"}, "Школа": {"en": "School", "vi": "Trường học"}, "Медресе": {"en": "Madrasah", "vi": "Trường Hồi giáo"}, "Университет": {"en": "University", "vi": "Đại học"}, "Курсы и обучение": {"en": "Courses and learning", "vi": "Khóa học và đào tạo"}, "Здоровье": {"en": "Health", "vi": "Sức khỏe"}, "Здоровье, профилактика и сопровождение": {"en": "Health, prevention and support", "vi": "Sức khỏe, phòng ngừa và hỗ trợ"}, "Фитнес": {"en": "Fitness", "vi": "Thể dục"}, "Тренировки, занятия и спортивные программы": {"en": "Training, classes and sports programmes", "vi": "Tập luyện, lớp học và chương trình thể thao"}, "Барбершоп": {"en": "Barbershop", "vi": "Tiệm cắt tóc nam"}, "Мужские стрижки и уход": {"en": "Men’s haircuts and grooming", "vi": "Cắt tóc và chăm sóc cho nam"}, "Женский салон": {"en": "Women’s salon", "vi": "Salon nữ"}, "Уход и услуги для женщин": {"en": "Care and services for women", "vi": "Chăm sóc và dịch vụ dành cho nữ"}, "Дом и быт": {"en": "Home services", "vi": "Dịch vụ gia đình"}, "Бытовые услуги, ремонт и обустройство": {"en": "Household services, repairs and home improvement", "vi": "Dịch vụ gia đình, sửa chữa và cải tạo nhà"}, "Недвижимость": {"en": "Real estate", "vi": "Bất động sản"}, "Жильё, покупка, продажа и аренда": {"en": "Housing, buying, selling and rentals", "vi": "Nhà ở, mua bán và cho thuê"}, "Клининг": {"en": "Cleaning", "vi": "Vệ sinh"}, "Уборка дома и коммерческих помещений": {"en": "Home and commercial cleaning", "vi": "Vệ sinh nhà ở và cơ sở kinh doanh"}, "Путешествия": {"en": "Travel", "vi": "Du lịch"}, "Организация поездок и билеты": {"en": "Trip planning and tickets", "vi": "Lập kế hoạch chuyến đi và vé"}, "Отели": {"en": "Hotels", "vi": "Khách sạn"}, "Проживание и бронирование отелей": {"en": "Stays and hotel reservations", "vi": "Lưu trú và đặt phòng khách sạn"}, "Туры и экскурсии": {"en": "Tours and excursions", "vi": "Tour và tham quan"}, "Экскурсии, маршруты и сопровождение": {"en": "Excursions, itineraries and guides", "vi": "Tham quan, hành trình và hướng dẫn"}, "Визовые услуги": {"en": "Visa services", "vi": "Dịch vụ thị thực"}, "Визы и сопровождение документов": {"en": "Visas and document assistance", "vi": "Thị thực và hỗ trợ giấy tờ"}, "Передвижение": {"en": "Mobility", "vi": "Di chuyển"}, "Транспортные сервисы и маршруты": {"en": "Transport services and routes", "vi": "Dịch vụ vận tải và lộ trình"}, "UMMA Taxi": {"en": "UMMA Taxi", "vi": "UMMA Taxi"}, "Городские поездки и трансферы": {"en": "City rides and transfers", "vi": "Chuyến đi trong thành phố và đưa đón"}, "Авто и мототехника": {"en": "Vehicles", "vi": "Phương tiện"}, "Покупка и продажа автомобилей и мототехники": {"en": "Buying and selling cars and motorcycles", "vi": "Mua bán ô tô và xe máy"}, "Прокат транспорта": {"en": "Vehicle rental", "vi": "Thuê xe"}, "Аренда автомобилей, мотоциклов и скутеров": {"en": "Car, motorcycle and scooter rentals", "vi": "Thuê ô tô, xe máy và xe tay ga"}, "Логистика": {"en": "Logistics", "vi": "Logistics"}, "Доставка, перевозки и отправления": {"en": "Delivery, freight and shipments", "vi": "Giao hàng, vận tải và gửi hàng"}, "Бизнес": {"en": "Business", "vi": "Kinh doanh"}, "Предпринимательство, партнёрства и франшиза": {"en": "Entrepreneurship, partnerships and franchising", "vi": "Khởi nghiệp, hợp tác và nhượng quyền"}, "Работа": {"en": "Jobs", "vi": "Việc làm"}, "Вакансии, специалисты и занятость": {"en": "Vacancies, professionals and employment", "vi": "Tuyển dụng, chuyên gia và việc làm"}, "Одежда и стиль": {"en": "Fashion", "vi": "Thời trang"}, "Одежда, аксессуары и собственные коллекции": {"en": "Clothing, accessories and own collections", "vi": "Quần áo, phụ kiện và bộ sưu tập riêng"}, "Энергия": {"en": "Energy", "vi": "Năng lượng"}, "Энергетические решения и проекты": {"en": "Energy solutions and projects", "vi": "Giải pháp và dự án năng lượng"}, "Финансы": {"en": "Finance", "vi": "Tài chính"}, "Финансовые сервисы и учёт": {"en": "Financial services and accounting", "vi": "Dịch vụ tài chính và kế toán"}, "Обмен валют": {"en": "Currency exchange", "vi": "Đổi ngoại tệ"}, "Обмен валют и переводы": {"en": "Currency exchange and transfers", "vi": "Đổi ngoại tệ và chuyển tiền"}, "Сообщество": {"en": "Community", "vi": "Cộng đồng"}, "Знакомства, взаимопомощь и связи": {"en": "Connections, mutual support and networking", "vi": "Kết nối, tương trợ và giao lưu"}, "Мероприятия": {"en": "Events", "vi": "Sự kiện"}, "Встречи, семейные и общественные мероприятия": {"en": "Meetups, family and community events", "vi": "Gặp gỡ, sự kiện gia đình và cộng đồng"}, "Медиа": {"en": "Media", "vi": "Truyền thông"}, "Новости, публикации и полезные материалы": {"en": "News, publications and useful resources", "vi": "Tin tức, bài viết và tài liệu hữu ích"}, "Благотворительность": {"en": "Charity", "vi": "Từ thiện"}, "Закят, садака и адресная помощь": {"en": "Zakat, sadaqah and targeted assistance", "vi": "Zakat, sadaqah và hỗ trợ theo nhu cầu"}, "Вакф": {"en": "Waqf", "vi": "Waqf"}, "Долгосрочные общественно полезные проекты и фонд": {"en": "Long-term community projects and endowment", "vi": "Dự án cộng đồng dài hạn và quỹ hiến tặng"}, "Еда и торговля": {"en": "Food and trade", "vi": "Ẩm thực và thương mại"}, "Семья и образование": {"en": "Family and education", "vi": "Gia đình và giáo dục"}, "Здоровье и уход": {"en": "Health and care", "vi": "Sức khỏe và chăm sóc"}, "Дом и услуги": {"en": "Home and services", "vi": "Nhà ở và dịch vụ"}, "Путешествия и проживание": {"en": "Travel and stays", "vi": "Du lịch và lưu trú"}, "Транспорт и доставка": {"en": "Transport and delivery", "vi": "Vận tải và giao hàng"}, "Бизнес и сервисы": {"en": "Business and services", "vi": "Kinh doanh và dịch vụ"}, "Общество и помощь": {"en": "Community and support", "vi": "Cộng đồng và hỗ trợ"}, "Направления UMMA": {"en": "UMMA directions", "vi": "Các lĩnh vực UMMA"}, "Поиск направления": {"en": "Search directions", "vi": "Tìm lĩnh vực"}, "Все направления": {"en": "All directions", "vi": "Tất cả lĩnh vực"}, "Ничего не найдено. Попробуйте другое название.": {"en": "No results. Try another name.", "vi": "Không tìm thấy. Hãy thử tên khác."}, "Готовится к запуску": {"en": "Preparing to launch", "vi": "Đang chuẩn bị ra mắt"}, "Раздел в разработке. Услуги пока недоступны.": {"en": "This section is in development. Services are not available yet.", "vi": "Mục này đang phát triển. Dịch vụ chưa khả dụng."}, "Планируемые возможности": {"en": "Planned features", "vi": "Tính năng dự kiến"}, "Ко всем направлениям": {"en": "All directions", "vi": "Tất cả lĩnh vực"}, "Кафе, Market, B2B и Коран доступны в приложении. Остальные направления готовятся к запуску.": {"en": "Cafe, Market, B2B and Quran are available in the app. Other directions are being prepared.", "vi": "Cafe, Market, B2B và Kinh Qur’an có trong ứng dụng. Các lĩnh vực khác đang được chuẩn bị."}};
 const catalogue=Object.fromEntries(directions.map(item=>[item.id,item]));
 window.ummaDirections=Object.freeze(directions.map(item=>Object.freeze({...item,features:Object.freeze(item.features||[item.description])})));
 const translate=root=>window.ummaI18n?.translate?.(root);
 function info(title,text){
  dialog?.remove();dialog=document.createElement('dialog');dialog.className='native-service-dialog';dialog.setAttribute('aria-label',title);
  const close=document.createElement('button');close.type='button';close.className='cafe-back';close.textContent='← Назад';close.onclick=()=>dialog.close();
  const h=document.createElement('h2');h.textContent=title;const p=document.createElement('p');p.textContent=text;dialog.append(close,h,p);
  dialog.onclose=()=>syncScene();document.body.append(dialog);dialog.showModal();syncScene();return dialog;
 }
 function openAbout(){
  const opener=document.activeElement;
  const sheet=info('О UMMA GLOBAL','Объединяем людей. Создаём возможности.');
  sheet.classList.add('umma-about');
  const section=(heading,texts)=>{const el=document.createElement('section');const h=document.createElement('h3');h.textContent=heading;el.append(h);for(const text of texts){const p=document.createElement('p');p.textContent=text;el.append(p);}sheet.append(el);return el;};
  section('Кто мы',["UMMA GLOBAL — развивающаяся международная экосистема для жизни, семьи и бизнеса, основанная на исламских ценностях.", "Наш путь начинается в Нячанге. Мы объединяем полезные сервисы, предпринимательские инициативы и общественные проекты, стремясь приносить пользу людям в разных странах.", "Для нас UMMA — это наша большая семья, в которой важны доверие, уважение и забота друг о друге."]);
  const mission=section('Наша миссия',["Всё, что мы делаем, мы делаем ради довольства Аллаха.", "Мы стремимся воплощать это намерение в конкретных делах: честно вести бизнес, заботиться о людях, поддерживать семьи, развивать взаимопомощь и создавать возможности для полезного труда и получения знаний."]);mission.querySelector('p').className='umma-about-mission';
  const values=section('Наши ценности',[]);const valueList=document.createElement('dl');valueList.className='umma-about-values';
  for(const [title,text] of [["Вера и искренность", "Руководствоваться исламскими ценностями, сохранять искреннее намерение и стремиться к дозволенному в наших делах."], ["Честность и ответственность", "Открыто объяснять условия, выполнять обещания и отвечать за свои решения."], ["Качество и забота", "Внимательно относиться к продуктам и услугам, слышать обратную связь и улучшать нашу работу."], ["Уважение и гостеприимство", "Встречать людей с доброжелательностью, уважать их достоинство и проявлять внимание к их потребностям."], ["Семья и знания", "Беречь семейные ценности, поддерживать получение полезных знаний и заботиться о будущих поколениях."], ["Взаимопомощь и польза обществу", "Поддерживать друг друга и объединять усилия ради полезных дел."]]){const item=document.createElement('div');const dt=document.createElement('dt');dt.textContent=title;const dd=document.createElement('dd');dd.textContent=text;item.append(dt,dd);valueList.append(item);}values.append(valueList);
  const ventures=section('Наши направления',[]);const list=document.createElement('div');list.className='umma-about-directions';
  for(const [id,statusText,description] of [["cafe", "Работает", "Наше первое направление — халяльное кафе в Нячанге. Здесь наши ценности воплощаются в ежедневной работе: в приготовлении еды, гостеприимстве и заботе о каждом госте."], ["market", "В разработке", "Направление розничной торговли. Мы работаем над ассортиментом и подготовкой сервиса к запуску."], ["b2b", "В разработке", "Направление для предпринимателей: закупки и поставки товаров для бизнеса."]]){const item=catalogue[id];const card=document.createElement('article');const button=document.createElement('button');button.type='button';button.append(icon(item.icon));const name=document.createElement('span');name.textContent=item.title;const status=document.createElement('small');status.textContent=statusText;button.append(name,status);button.onclick=()=>{sheet.close();if(typeof openPage==='function')openPage(item.id);};const p=document.createElement('p');p.textContent=description;card.append(button,p);list.append(card);}ventures.append(list);const future=document.createElement('p');future.textContent="В дальнейшем мы планируем развивать и другие направления UMMA GLOBAL. Об их готовности и запуске будем сообщать отдельно.";ventures.append(future);
  section('Как присоединиться',["Начните с того, что близко вам: знакомьтесь с направлениями UMMA GLOBAL, пользуйтесь доступными сервисами и делитесь обратной связью.", "Ваши идеи и участие помогают нашей большой семье развиваться."]);
  const all=document.createElement('button');all.type='button';all.className='cafe-submit';all.textContent='Ко всем направлениям';all.onclick=()=>{sheet.close();openService('more');};
  sheet.append(all);sheet.addEventListener('close',()=>opener?.focus());translate(sheet);
 }
 function openService(key){
  if(key==='about'){openAbout();return;}

  if(key==='quran'){window.ummaQuran?.open();return;}
  if(key==='b2b'){window.ummaB2B?.open();return;}
  if(key==='market'){window.ummaMarket?.open();return;}
  if(key==='services'||key==='more'){
   scenes.forEach(id=>{if(byId(id))byId(id).hidden=id!=='servicesPage';});document.querySelector('.app>main').style.display='none';const nav=document.querySelector('.bottom-nav');if(nav)nav.style.display='';if(typeof setActiveNav==='function')setActiveNav('more');return;
  }
  if(key==='cafe'){if(typeof openPage==='function')openPage('cafe');return;}
  const item=catalogue[key];if(!item)return;
  const opener=document.activeElement;
  const sheet=info(item.title,'Раздел в разработке. Услуги пока недоступны.');
  const status=document.createElement('span');status.className='native-coming';status.textContent='Готовится к запуску';
  const heading=document.createElement('h3');heading.textContent='Планируемые возможности';
  const list=document.createElement('ul');
  for(const feature of item.features||[item.description]){const li=document.createElement('li');li.textContent=feature;list.append(li);}
  const all=document.createElement('button');all.type='button';all.className='cafe-submit';all.textContent='Ко всем направлениям';all.onclick=()=>{sheet.close();openService('more');};
  const artwork=directionArtwork(item);artwork.classList.add('umma-page-emblem');sheet.querySelector('h2')?.before(artwork);
  sheet.append(status,heading,list,all);sheet.addEventListener('close',()=>opener?.focus());translate(sheet);
 }
 // Source rectangles keep generated labels out of the localized interface.
 const directionArt={"cafe":["directions-atlas-v2.webp",0,0,512,512],"market":["directions-atlas-v2.webp",512,0,512,512],"b2b":["directions-atlas-v2.webp",1024,0,512,512],"education":["directions-atlas-v2.webp",0,512,512,512],"tours":["directions-atlas-v2.webp",512,512,512,512],"hotels":["directions-atlas-v2.webp",1024,512,512,512],"trade":["catalogue-food-v1.webp",70,590,410,300],"farm":["catalogue-food-v1.webp",560,585,425,310],"production":["catalogue-food-v1.webp",1050,592,440,300],"quran":["catalogue-family-v1.webp",60,160,430,300],"family":["catalogue-family-v1.webp",560,155,420,315],"kids":["catalogue-family-v1.webp",1050,170,430,300],"care":["catalogue-family-v1.webp",85,590,390,305],"health":["catalogue-wellbeing-v1.webp",185,162,400,285],"fitness":["catalogue-wellbeing-v1.webp",900,180,490,270],"barbershop":["catalogue-wellbeing-v1.webp",120,570,550,320],"beauty":["catalogue-wellbeing-v1.webp",860,570,550,320],"household":["catalogue-home-v1.webp",50,340,440,410],"realestate":["catalogue-home-v1.webp",548,340,440,410],"cleaning":["catalogue-home-v1.webp",1040,340,420,410],"travel":["catalogue-travel-v1.webp",145,140,500,340],"visa":["catalogue-travel-v1.webp",890,570,500,320],"mobility":["catalogue-transport-v1.webp",85,185,400,280],"taxi":["catalogue-transport-v1.webp",550,200,440,265],"auto":["catalogue-transport-v1.webp",1050,205,440,265],"rent":["catalogue-transport-v1.webp",65,575,440,300],"logistics":["catalogue-transport-v1.webp",540,600,450,280],"business":["catalogue-business-v1.webp",90,185,400,310],"jobs":["catalogue-business-v1.webp",560,175,430,320],"fashion":["catalogue-business-v1.webp",1110,170,330,320],"energy":["catalogue-business-v1.webp",80,610,400,280],"finance":["catalogue-business-v1.webp",590,600,380,290],"exchange":["catalogue-business-v1.webp",1050,610,440,290],"community":["catalogue-society-v1.webp",90,170,400,285],"events":["catalogue-society-v1.webp",550,160,450,300],"media":["catalogue-society-v1.webp",1060,165,420,290],"charity":["catalogue-society-v1.webp",80,605,410,290],"waqf":["catalogue-society-v1.webp",565,580,410,320]};
 function directionArtwork(item){
  const emblem=document.createElement('span');emblem.className='direction-emblem';emblem.setAttribute('aria-hidden','true');emblem.append(icon(item.id==='cafe'?'serving':item.icon));
  const art=directionArt[item.id];if(!art)return emblem;
  const [file,x,y,width,height]=art,crop=document.createElement('span');crop.className='direction-crop';crop.style.aspectRatio=width+'/'+height;
  const image=document.createElement('img');image.className='direction-artwork';image.alt='';image.width=1536;image.height=1024;image.loading='lazy';image.decoding='async';
  image.style.width=(153600/width)+'%';image.style.height=(102400/height)+'%';image.style.left=(-100*x/width)+'%';image.style.top=(-100*y/height)+'%';
  image.onload=()=>emblem.classList.add('artwork-ready');image.onerror=()=>emblem.classList.remove('artwork-ready');image.src='assets/illustrations/'+file;crop.append(image);emblem.append(crop);return emblem;
 }
 // Reuse approved assets across rerendered screens, with no extra catalogue or data requests.
 function decoratePages(){
  const artworkFor={cafeOrdersPage:'cafe',cafeKitchenPage:'cafe',cafeWaiterPage:'cafe',cafeProductsAdminPage:'cafe',cafeInventoryPage:'market',cafeStaffAdminPage:'community',locationAdminPage:'travel',cafeAccountingPage:'business',marketPage:'market',marketShopPage:'market',b2bPage:'b2b'};
  for(const [id,key] of Object.entries(artworkFor)){
   const title=byId(id)?.querySelector('h1');if(!title||title.querySelector('.umma-page-emblem'))continue;
   const item=catalogue[key];if(!item)continue;
   const artwork=directionArtwork(item);artwork.classList.add('umma-page-emblem');title.prepend(artwork);
  }
  for(const [id,name] of Object.entries({adminPage:'business',adminUsersPage:'community'})){
   const holder=byId(id)?.querySelector('.admin-header-icon');if(holder&&!holder.dataset.brandReady){holder.replaceChildren(icon(name));holder.dataset.brandReady='true';}
  }
 }
 let decorationFrame=0;
 new MutationObserver(records=>{if(!decorationFrame&&records.some(r=>[...r.addedNodes].some(n=>n.nodeType===1&&(n.matches('h1,.admin-header-icon')||n.querySelector('h1,.admin-header-icon')))))decorationFrame=requestAnimationFrame(()=>{decorationFrame=0;decoratePages();});}).observe(app,{childList:true,subtree:true});
 decoratePages();
 function card(item,home=false){
  const b=document.createElement('button');b.type='button';b.dataset.service=item.id;b.dataset.page=item.id;b.className=home?'service':'native-directory-card';
  const title=document.createElement('strong');title.textContent=home?({cafe:'Кафе',market:'Маркет',b2b:'B2B',education:'Образование',tours:'Туры',hotels:'Отель'}[item.id]||item.title):item.title;
  const desc=document.createElement('small');desc.textContent=home?({cafe:'Блюда и напитки',market:'Товары для семьи',b2b:'Поставки для бизнеса',education:'Знания и развитие',tours:'Поездки и открытия',hotels:'Отдых и комфорт'}[item.id]||item.description):item.description;
  const arrow=document.createElement('span');arrow.className='direction-arrow';arrow.setAttribute('aria-hidden','true');arrow.textContent='↗';b.append(directionArtwork(item),arrow,title,desc);
  if(item.id==='cafe'){const live=document.createElement('span');live.className='direction-live';live.textContent='Работает';b.append(live);}
  if(item.launchStatus||!item.available){const status=document.createElement('span');status.className='native-coming';status.textContent=item.launchStatus||'Готовится к запуску';b.append(status);}
  b.onclick=()=>{if(typeof openPage==='function')openPage(item.id);};return b;
 }
 const homeGrid=document.querySelector('.services-grid');
 if(homeGrid){homeGrid.replaceChildren();
  for(const id of ['cafe','market','b2b','education','tours','hotels']){
   const item=catalogue[id];if(item)homeGrid.append(card(item,true));
  }translate(homeGrid);
 }
 const grid=byId('nativeDirectory');
 const search=byId('directionSearch'),filter=byId('directionGroup'),empty=byId('directionEmpty');
 if(filter)for(const group of groups){const option=document.createElement('option');option.value=group.id;option.textContent=group.title;filter.append(option);}
 function renderDirectory(){
  if(!grid)return;grid.replaceChildren();
  const query=(search?.value||'').trim().toLocaleLowerCase();let count=0;
  for(const group of groups){
   if(filter?.value&&filter.value!==group.id)continue;
   const matches=directions.filter(item=>item.group===group.id&&(!query||[item.id,item.title,item.description,group.title,...(item.features||[])]
    .flatMap(text=>[text,...Object.values(copy[text]||{})]).join(' ').toLocaleLowerCase().includes(query)));
   if(!matches.length)continue;
   const heading=document.createElement('h3');heading.className='umma-direction-group';heading.textContent=group.title;grid.append(heading);
   for(const item of matches){grid.append(card(item));count++;}
  }
  if(empty)empty.hidden=count>0;
  const total=byId('directionCount');if(total)total.textContent=count+' / '+directions.length;
  translate(grid);
 }
 search?.addEventListener('input',renderDirectory);filter?.addEventListener('change',renderDirectory);
 window.addEventListener('umma:languagechange',()=>{renderDirectory();translate(homeGrid);});renderDirectory();
 byId('servicesBack')?.addEventListener('click',()=>{if(!window.ummaNavigation?.back()&&typeof openPage==='function')openPage('home');});
 document.querySelector('.farm-button')?.addEventListener('click',()=>openService('farm'));
 byId('nativeHomeShortcut')?.addEventListener('click',()=>{try{sdk?.addToHomeScreen?.();}catch{if(typeof showToast==='function')showToast('Добавление ярлыка недоступно в этой версии Telegram');}});
 if(byId('nativeHomeShortcut'))byId('nativeHomeShortcut').hidden=typeof sdk?.addToHomeScreen!=='function'||!sdk?.initData;
 // Fit the introductory stack to Telegram's actual available height. Text remains unscaled.
 const homeMain=document.querySelector('.app>main'),homeHero=document.querySelector('.brand-art');
 let homeFitFrame=0;
 function fitHomeIntro(){
  homeFitFrame=0;if(!homeMain||!homeHero||homeMain.style.display==='none'||document.querySelector('.daily-ayah')?.open)return;
  const image=homeHero.querySelector('.brand-art-image'),intro=document.querySelector('.ecosystem-intro'),ayah=document.querySelector('.ayah-card');
  if(!image||!intro||!ayah||!homeMain.clientHeight)return;
  const css=el=>getComputedStyle(el),n=value=>parseFloat(value)||0;
  const reserve=n(css(homeMain).paddingTop)+intro.offsetHeight+ayah.offsetHeight+n(css(homeHero).marginBottom)+n(css(intro).marginBottom)+24;
  const budget=homeMain.clientHeight-reserve,full=homeHero.clientWidth;
  // Image and its overlapping caption contribute 1.5 - .67 = .83 times artwork width.
  const fixed=homeHero.getBoundingClientRect().height-image.getBoundingClientRect().width*.83;
  const size=Math.min(100,Math.max(20,100*(budget-fixed)/(.83*full)));
  const value=size.toFixed(2)+'%';if(homeHero.style.getPropertyValue('--home-art-size')!==value)homeHero.style.setProperty('--home-art-size',value);
  homeHero.classList.toggle('home-fit-art',size<99.5);
 }
 function scheduleHomeFit(){if(!homeFitFrame)homeFitFrame=window.requestAnimationFrame?window.requestAnimationFrame(fitHomeIntro):window.setTimeout(fitHomeIntro,0);}
 if(typeof ResizeObserver==='function'){
  const observer=new ResizeObserver(scheduleHomeFit);
  for(const element of [homeMain,homeHero?.querySelector('.brand-art-copy'),document.querySelector('.ecosystem-intro'),document.querySelector('.ayah-card')])if(element)observer.observe(element);
 }
 window.addEventListener('umma:languagechange',scheduleHomeFit);window.addEventListener('resize',scheduleHomeFit);scheduleHomeFit();
 window.ummaNativeShell={openService,geometry,isDialogOpen:()=>dialog?.open===true,closeDialog:()=>dialog?.close()};
})();
