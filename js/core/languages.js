/* Built-in language metadata and additional interface catalogues. No online translation. */
(() => {
 'use strict';
 const metadata={
  ru:{name:'Русский',locale:'ru-RU',title:'Язык приложения',choose:'Выбрать язык',auto:'Автоматически · Telegram / устройство',items:'{n} позиций'},
  en:{name:'English',locale:'en-GB',title:'App language',choose:'Choose language',auto:'Automatic · Telegram / device',items:'{n} items'},
  vi:{name:'Tiếng Việt',locale:'vi-VN',title:'Ngôn ngữ ứng dụng',choose:'Chọn ngôn ngữ',auto:'Tự động · Telegram / thiết bị',items:'{n} món'},
  ar:{name:'العربية',locale:'ar',dir:'rtl',title:'لغة التطبيق',choose:'اختر اللغة',auto:'تلقائي · Telegram / الجهاز',items:'عدد الأصناف: {n}'},
  id:{name:'Bahasa Indonesia',locale:'id-ID',title:'Bahasa aplikasi',choose:'Pilih bahasa',auto:'Otomatis · Telegram / perangkat',items:'{n} item'},
  th:{name:'ไทย',locale:'th-TH',title:'ภาษาของแอป',choose:'เลือกภาษา',auto:'อัตโนมัติ · Telegram / อุปกรณ์',items:'{n} รายการ'},
  zh:{name:'简体中文',locale:'zh-CN',title:'应用语言',choose:'选择语言',auto:'自动 · Telegram / 设备',items:'{n}项'},
  ko:{name:'한국어',locale:'ko-KR',title:'앱 언어',choose:'언어 선택',auto:'자동 · Telegram / 기기',items:'{n}개'},
  fr:{name:'Français',locale:'fr-FR',title:'Langue de l’application',choose:'Choisir la langue',auto:'Automatique · Telegram / appareil',items:'{n} articles',item:'{n} article'},
  de:{name:'Deutsch',locale:'de-DE',title:'App-Sprache',choose:'Sprache wählen',auto:'Automatisch · Telegram / Gerät',items:'{n} Artikel'},
  pt:{name:'Português',locale:'pt-PT',title:'Idioma da aplicação',choose:'Escolher idioma',auto:'Automático · Telegram / dispositivo',items:'{n} itens',item:'{n} item'},
  tr:{name:'Türkçe',locale:'tr-TR',title:'Uygulama dili',choose:'Dil seçin',auto:'Otomatik · Telegram / cihaz',items:'{n} ürün'}
 };
 const codes=['ar','id','th','zh','ko','fr','de','pt','tr'];
 // Columns: Russian source | Arabic | Indonesian | Thai | Simplified Chinese | Korean | French | German | Portuguese | Turkish.
 const rows=`
Главная|الرئيسية|Beranda|หน้าหลัก|首页|홈|Accueil|Startseite|Início|Ana sayfa
Ещё|المزيد|Lainnya|เพิ่มเติม|更多|더보기|Plus|Mehr|Mais|Diğer
Кафе|المقهى|Kafe|ร้านอาหาร|餐厅|카페|Café|Café|Café|Kafe
Кафе Umma|مقهى UMMA|Kafe UMMA|ร้าน UMMA|UMMA餐厅|UMMA 카페|Café UMMA|UMMA Café|Café UMMA|UMMA Kafe
Кафе UMMA|مقهى UMMA|Kafe UMMA|ร้าน UMMA|UMMA餐厅|UMMA 카페|Café UMMA|UMMA Café|Café UMMA|UMMA Kafe
Мои заказы|طلباتي|Pesanan saya|คำสั่งซื้อของฉัน|我的订单|내 주문|Mes commandes|Meine Bestellungen|Os meus pedidos|Siparişlerim
Заказы|الطلبات|Pesanan|คำสั่งซื้อ|订单|주문|Commandes|Bestellungen|Pedidos|Siparişler
События|الفعاليات|Acara|กิจกรรม|活动|행사|Événements|Veranstaltungen|Eventos|Etkinlikler
Подключаемся…|جارٍ الاتصال…|Menghubungkan…|กำลังเชื่อมต่อ…|正在连接…|연결 중…|Connexion…|Verbindung wird hergestellt…|A ligar…|Bağlanıyor…
Ассаляму алейкум ва рахматуллахи ва баракатух,|السلام عليكم ورحمة الله وبركاته،|Assalamu alaykum wa rahmatullahi wa barakatuh,|อัสสลามุอะลัยกุม วะเราะห์มะตุลลอฮิ วะบะรอกาตุฮ์|愿真主赐予你们平安、慈悯和吉庆，|앗살라무 알라이쿰 와 라흐마툴라히 와 바라카투후,|Assalamu alaykum wa rahmatullahi wa barakatuh,|Assalamu alaykum wa rahmatullahi wa barakatuh,|Assalamu alaykum wa rahmatullahi wa barakatuh,|Esselamu aleyküm ve rahmetullahi ve berekatüh,
Ассаляму алейкум|السلام عليكم|Assalamu alaykum|อัสสลามุอะลัยกุม|愿你们平安|앗살라무 알라이쿰|Assalamu alaykum|Assalamu alaykum|Assalamu alaykum|Esselamu aleyküm
ва рахматуллахи ва баракатух,|ورحمة الله وبركاته،|wa rahmatullahi wa barakatuh,|วะเราะห์มะตุลลอฮิ วะบะรอกาตุฮ์|愿真主赐予你们慈悯和吉庆，|와 라흐마툴라히 와 바라카투후,|wa rahmatullahi wa barakatuh,|wa rahmatullahi wa barakatuh,|wa rahmatullahi wa barakatuh,|ve rahmetullahi ve berekatüh,
ва рахматуллахи ва баракатух!|ورحمة الله وبركاته!|wa rahmatullahi wa barakatuh!|วะเราะห์มะตุลลอฮิ วะบะรอกาตุฮ์|愿真主赐予你们慈悯和吉庆！|와 라흐마툴라히 와 바라카투후!|wa rahmatullahi wa barakatuh !|wa rahmatullahi wa barakatuh!|wa rahmatullahi wa barakatuh!|ve rahmetullahi ve berekatüh!
УММА!|UMMA!|UMMA!|UMMA!|UMMA！|UMMA!|UMMA !|UMMA!|UMMA!|UMMA!
Единая экосистема для жизни,|منظومة موحدة للحياة،|Satu ekosistem untuk kehidupan,|ระบบนิเวศเดียวเพื่อชีวิต|一个服务生活、|삶과 비즈니스,|Un écosystème pour la vie,|Ein Ökosystem für Leben,|Um ecossistema para a vida,|Yaşam, iş ve toplum için
бизнеса и общества.|والأعمال والمجتمع.|bisnis dan masyarakat.|ธุรกิจและชุมชน|商业和社区的生态系统。|공동체를 위한 하나의 생태계.|les affaires et la communauté.|Wirtschaft und Gemeinschaft.|negócios e comunidade.|tek bir ekosistem.
Открыть кафе|فتح المقهى|Buka kafe|เปิดร้านอาหาร|进入餐厅|카페 열기|Ouvrir le café|Café öffnen|Abrir café|Kafeyi aç
Сервисы Umma|خدمات UMMA|Layanan UMMA|บริการ UMMA|UMMA服务|UMMA 서비스|Services UMMA|UMMA Dienste|Serviços UMMA|UMMA hizmetleri
Все сервисы →|جميع الخدمات ←|Semua layanan →|บริการทั้งหมด →|全部服务 →|모든 서비스 →|Tous les services →|Alle Dienste →|Todos os serviços →|Tüm hizmetler →
Рынок Umma|سوق UMMA|Pasar UMMA|ตลาด UMMA|UMMA市场|UMMA 마켓|Marché UMMA|UMMA Markt|Mercado UMMA|UMMA Market
Продукты и товары|الأغذية والمنتجات|Makanan dan barang|อาหารและสินค้า|食品与商品|식품 및 상품|Alimentation et produits|Lebensmittel und Waren|Alimentos e produtos|Gıda ve ürünler
Путешествия|السفر|Perjalanan|การท่องเที่ยว|旅行|여행|Voyages|Reisen|Viagens|Seyahat
Туры, билеты, отели|الجولات والتذاكر والفنادق|Tur, tiket, hotel|ทัวร์ ตั๋ว โรงแรม|旅游、票务、酒店|투어, 티켓, 호텔|Circuits, billets, hôtels|Touren, Tickets, Hotels|Passeios, bilhetes, hotéis|Turlar, biletler, oteller
Отели Umma|فنادق UMMA|Hotel UMMA|โรงแรม UMMA|UMMA酒店|UMMA 호텔|Hôtels UMMA|UMMA Hotels|Hotéis UMMA|UMMA Otelleri
Проживание по миру|إقامة حول العالم|Akomodasi di seluruh dunia|ที่พักทั่วโลก|全球住宿|전 세계 숙소|Séjours dans le monde|Unterkünfte weltweit|Alojamento pelo mundo|Dünya genelinde konaklama
Недвижимость|العقارات|Properti|อสังหาริมทรัพย์|房地产|부동산|Immobilier|Immobilien|Imóveis|Gayrimenkul
Жильё, аренда, инвестиции|السكن والإيجار والاستثمار|Hunian, sewa, investasi|ที่อยู่อาศัย เช่า ลงทุน|住房、租赁、投资|주택, 임대, 투자|Logement, location, investissement|Wohnen, Mieten, Investieren|Habitação, arrendamento, investimento|Konut, kiralama, yatırım
Сообщество|المجتمع|Komunitas|ชุมชน|社区|커뮤니티|Communauté|Gemeinschaft|Comunidade|Topluluk
Люди, помощь и связи|الناس والدعم والتواصل|Orang, bantuan dan koneksi|ผู้คน ความช่วยเหลือและการเชื่อมต่อ|人脉、互助与联系|사람, 도움, 연결|Entraide et liens|Menschen, Hilfe und Kontakte|Pessoas, apoio e ligações|İnsanlar, yardım ve bağlantılar
Бизнес|الأعمال|Bisnis|ธุรกิจ|商业|비즈니스|Affaires|Geschäft|Negócios|İş
Возможности и партнёрства|الفرص والشراكات|Peluang dan kemitraan|โอกาสและความร่วมมือ|机遇与合作|기회와 파트너십|Opportunités et partenariats|Chancen und Partnerschaften|Oportunidades e parcerias|Fırsatlar ve ortaklıklar
Образование|التعليم|Pendidikan|การศึกษา|教育|교육|Éducation|Bildung|Educação|Eğitim
Школа, медресе, университет|المدرسة والمعهد والجامعة|Sekolah, madrasah, universitas|โรงเรียน มัดราซะฮ์ มหาวิทยาลัย|学校、经学院、大学|학교, 마드라사, 대학교|École, madrasa, université|Schule, Madrasa, Universität|Escola, madraça, universidade|Okul, medrese, üniversite
Здоровье|الصحة|Kesehatan|สุขภาพ|健康|건강|Santé|Gesundheit|Saúde|Sağlık
Спорт и здоровый образ жизни|الرياضة والحياة الصحية|Olahraga dan hidup sehat|กีฬาและวิถีชีวิตสุขภาพดี|运动与健康生活|운동과 건강한 생활|Sport et vie saine|Sport und gesundes Leben|Desporto e vida saudável|Spor ve sağlıklı yaşam
Халяльное производство|الإنتاج الحلال|Produksi halal|การผลิตฮาลาล|清真生产|할랄 생산|Production halal|Halal-Produktion|Produção halal|Helal üretim
и натуральные продукты|والأغذية الطبيعية|dan makanan alami|และอาหารธรรมชาติ|与天然食品|및 천연 식품|et produits naturels|und natürliche Produkte|e produtos naturais|ve doğal ürünler
Подробнее|المزيد من التفاصيل|Selengkapnya|ดูเพิ่มเติม|了解更多|자세히 보기|En savoir plus|Mehr erfahren|Saber mais|Daha fazla bilgi
← Назад|رجوع →|← Kembali|← กลับ|← 返回|← 뒤로|← Retour|← Zurück|← Voltar|← Geri
Назад|رجوع|Kembali|กลับ|返回|뒤로|Retour|Zurück|Voltar|Geri
← Главная|الرئيسية →|← Beranda|← หน้าหลัก|← 首页|← 홈|← Accueil|← Startseite|← Início|← Ana sayfa
← К заказам|الطلبات →|← Pesanan|← คำสั่งซื้อ|← 订单|← 주문|← Commandes|← Bestellungen|← Pedidos|← Siparişler
← Назад к заказу|العودة إلى الطلب →|← Kembali ke pesanan|← กลับไปที่คำสั่งซื้อ|← 返回订单|← 주문으로|← Retour à la commande|← Zur Bestellung|← Voltar ao pedido|← Siparişe dön
← Вернуться к меню|العودة إلى القائمة →|← Kembali ke menu|← กลับไปที่เมนู|← 返回菜单|← 메뉴로 돌아가기|← Retour au menu|← Zur Speisekarte|← Voltar ao menu|← Menüye dön
Мы кормим людей|نطعم الناس|Kami memberi makan orang|เราให้อาหารผู้คน|我们为人们提供食物|우리는 사람들에게 음식을 제공합니다|Nous nourrissons les gens|Wir versorgen Menschen mit Essen|Alimentamos as pessoas|İnsanlara yemek sunuyoruz
ради довольства Аллаха|ابتغاء مرضاة الله|demi rida Allah|เพื่อความพอพระทัยของอัลลอฮ์|只为寻求真主的喜悦|알라의 기쁨을 구하며|pour l’agrément d’Allah|um Allahs Wohlgefallen zu erlangen|pela satisfação de Allah|Allah’ın rızası için
ПРИГОТОВЛЕНО С ЗАБОТОЙ|أُعدّ بعناية|DISIAPKAN DENGAN SEPENUH HATI|ปรุงด้วยความใส่ใจ|用心烹制|정성껏 준비한 음식|PRÉPARÉ AVEC SOIN|MIT SORGFALT ZUBEREITET|PREPARADO COM CUIDADO|ÖZENLE HAZIRLANDI
Наше меню|قائمتنا|Menu kami|เมนูของเรา|我们的菜单|메뉴|Notre menu|Unsere Speisekarte|O nosso menu|Menümüz
Найти блюдо|البحث عن طبق|Cari hidangan|ค้นหาอาหาร|搜索菜品|메뉴 검색|Chercher un plat|Gericht suchen|Procurar prato|Yemek ara
Сбросить|إعادة ضبط|Atur ulang|รีเซ็ต|重置|초기화|Réinitialiser|Zurücksetzen|Repor|Sıfırla
Показать всё меню|عرض القائمة كاملة|Tampilkan seluruh menu|แสดงเมนูทั้งหมด|显示全部菜单|전체 메뉴 보기|Afficher tout le menu|Ganze Speisekarte anzeigen|Ver todo o menu|Tüm menüyü göster
Загружаем меню…|جارٍ تحميل القائمة…|Memuat menu…|กำลังโหลดเมนู…|正在加载菜单…|메뉴 불러오는 중…|Chargement du menu…|Speisekarte wird geladen…|A carregar o menu…|Menü yükleniyor…
Ваш заказ|طلبك|Pesanan Anda|คำสั่งซื้อของคุณ|您的订单|주문 내역|Votre commande|Ihre Bestellung|O seu pedido|Siparişiniz
Посмотреть / изменить|عرض / تعديل|Lihat / ubah|ดู / แก้ไข|查看 / 修改|보기 / 수정|Voir / modifier|Ansehen / bearbeiten|Ver / editar|Görüntüle / düzenle
Как получить заказ|طريقة استلام الطلب|Cara menerima pesanan|วิธีรับคำสั่งซื้อ|取餐方式|수령 방법|Mode de réception|Bestellung erhalten|Como receber o pedido|Teslim alma şekli
В кафе|في المقهى|Makan di tempat|ทานที่ร้าน|堂食|매장 식사|Sur place|Vor Ort|No café|Kafede
С собой|سفري|Bawa pulang|สั่งกลับบ้าน|自取|포장|À emporter|Zum Mitnehmen|Para levar|Paket servis
Доставка|توصيل|Pengantaran|จัดส่ง|配送|배달|Livraison|Lieferung|Entrega|Teslimat
Загружаем кафе…|جارٍ تحميل المقاهي…|Memuat kafe…|กำลังโหลดร้านอาหาร…|正在加载餐厅…|카페 불러오는 중…|Chargement des cafés…|Cafés werden geladen…|A carregar cafés…|Kafeler yükleniyor…
Выбрать другое кафе|اختيار مقهى آخر|Pilih kafe lain|เลือกร้านอื่น|选择其他餐厅|다른 카페 선택|Choisir un autre café|Anderes Café wählen|Escolher outro café|Başka kafe seç
Как выбрать кафе|طريقة اختيار المقهى|Cara memilih kafe|วิธีเลือกร้าน|如何选择餐厅|카페 선택 방법|Comment choisir un café|Café auswählen|Como escolher o café|Kafe nasıl seçilir
Ближайшее кафе по геолокации|أقرب مقهى حسب الموقع|Kafe terdekat berdasarkan lokasi|ร้านที่ใกล้ที่สุดตามตำแหน่ง|按定位选择最近餐厅|위치 기준 가까운 카페|Café le plus proche|Nächstgelegenes Café|Café mais próximo|Konuma göre en yakın kafe
Выбрать кафе вручную|اختيار المقهى يدوياً|Pilih kafe secara manual|เลือกร้านเอง|手动选择餐厅|카페 직접 선택|Choisir le café manuellement|Café manuell wählen|Escolher café manualmente|Kafeyi elle seç
Кафе для заказа|مقهى الطلب|Kafe untuk pesanan|ร้านที่สั่ง|下单餐厅|주문할 카페|Café de la commande|Café für die Bestellung|Café do pedido|Sipariş verilecek kafe
Куда доставить?|إلى أين نوصّل؟|Antar ke mana?|จัดส่งที่ไหน?|送到哪里？|어디로 배달할까요?|Où livrer ?|Wohin liefern?|Onde entregar?|Nereye teslim edelim?
Указать на карте|تحديد على الخريطة|Pilih di peta|เลือกบนแผนที่|在地图上选择|지도에서 선택|Choisir sur la carte|Auf Karte wählen|Escolher no mapa|Haritada seç
Убрать точку|إزالة النقطة|Hapus titik|ลบจุด|移除标记|위치 삭제|Retirer le repère|Markierung entfernen|Remover ponto|Noktayı kaldır
Или введите адрес доставки|أو أدخل عنوان التوصيل|Atau masukkan alamat pengantaran|หรือกรอกที่อยู่จัดส่ง|或输入配送地址|또는 배달 주소 입력|Ou saisissez l’adresse de livraison|Oder Lieferadresse eingeben|Ou introduza a morada de entrega|Veya teslimat adresini girin
Оплата|الدفع|Pembayaran|ชำระเงิน|付款|결제|Paiement|Zahlung|Pagamento|Ödeme
Наличными|نقداً|Tunai|เงินสด|现金|현금|Espèces|Barzahlung|Dinheiro|Nakit
QR-кодом|رمز QR|Kode QR|รหัส QR|二维码|QR 코드|Code QR|QR-Code|Código QR|QR kodu
Перевод на карту|تحويل بنكي|Transfer bank|โอนเงินผ่านธนาคาร|银行转账|계좌 이체|Virement bancaire|Banküberweisung|Transferência bancária|Banka havalesi
Перевод на российский / казахстанский банк|تحويل إلى بنك روسي / كازاخستاني|Transfer ke bank Rusia / Kazakhstan|โอนไปธนาคารรัสเซีย / คาซัคสถาน|转账至俄罗斯 / 哈萨克斯坦银行|러시아 / 카자흐스탄 은행 이체|Virement vers une banque russe / kazakhe|Überweisung an russische / kasachische Bank|Transferência para banco russo / cazaque|Rus / Kazak bankasına havale
Оплата курьеру при доставке|الدفع للمندوب عند الاستلام|Bayar kurir saat diterima|จ่ายพนักงานส่งเมื่อรับสินค้า|货到付款|배달원에게 현장 결제|Paiement au livreur à réception|Beim Kurier bezahlen|Pagar ao estafeta na entrega|Teslimatta kuryeye ödeme
Контактные данные|بيانات الاتصال|Data kontak|ข้อมูลติดต่อ|联系方式|연락처|Coordonnées|Kontaktdaten|Dados de contacto|İletişim bilgileri
Ваш профиль Telegram|ملفك في Telegram|Profil Telegram Anda|โปรไฟล์ Telegram ของคุณ|您的Telegram资料|Telegram 프로필|Votre profil Telegram|Ihr Telegram-Profil|O seu perfil Telegram|Telegram profiliniz
Изменить|تعديل|Ubah|แก้ไข|修改|수정|Modifier|Bearbeiten|Editar|Düzenle
Имя (необязательно)|الاسم (اختياري)|Nama (opsional)|ชื่อ (ไม่บังคับ)|姓名（选填）|이름 (선택)|Nom (facultatif)|Name (optional)|Nome (opcional)|İsim (isteğe bağlı)
Телефон (необязательно)|الهاتف (اختياري)|Telepon (opsional)|โทรศัพท์ (ไม่บังคับ)|电话（选填）|전화번호 (선택)|Téléphone (facultatif)|Telefon (optional)|Telefone (opcional)|Telefon (isteğe bağlı)
Пожелания к заказу|ملاحظات الطلب|Permintaan pesanan|คำขอเพิ่มเติม|订单偏好|주문 요청 사항|Préférences|Wünsche zur Bestellung|Preferências do pedido|Sipariş tercihleri
Необязательно|اختياري|Opsional|ไม่บังคับ|选填|선택 사항|Facultatif|Optional|Opcional|İsteğe bağlı
Добавить|إضافة|Tambah|เพิ่ม|添加|추가|Ajouter|Hinzufügen|Adicionar|Ekle
Комментарий к заказу (необязательно)|ملاحظة للطلب (اختياري)|Catatan pesanan (opsional)|หมายเหตุ (ไม่บังคับ)|订单备注（选填）|주문 메모 (선택)|Note de commande (facultatif)|Bestellnotiz (optional)|Nota do pedido (opcional)|Sipariş notu (isteğe bağlı)
Оформить заказ|تأكيد الطلب|Buat pesanan|สั่งอาหาร|提交订单|주문하기|Commander|Bestellen|Fazer pedido|Sipariş ver
Перейти к заказу|عرض الطلب|Lihat pesanan|ดูคำสั่งซื้อ|查看订单|주문 보기|Voir la commande|Zur Bestellung|Ver pedido|Siparişe git
Загружаем ваши заказы…|جارٍ تحميل طلباتك…|Memuat pesanan Anda…|กำลังโหลดคำสั่งซื้อ…|正在加载您的订单…|주문 불러오는 중…|Chargement de vos commandes…|Bestellungen werden geladen…|A carregar os seus pedidos…|Siparişleriniz yükleniyor…
↻ Обновить|↻ تحديث|↻ Segarkan|↻ รีเฟรช|↻ 刷新|↻ 새로고침|↻ Actualiser|↻ Aktualisieren|↻ Atualizar|↻ Yenile
↻ Обновить меню|↻ تحديث القائمة|↻ Segarkan menu|↻ รีเฟรชเมนู|↻ 刷新菜单|↻ 메뉴 새로고침|↻ Actualiser le menu|↻ Speisekarte aktualisieren|↻ Atualizar menu|↻ Menüyü yenile
Итого|الإجمالي|Total|รวม|合计|합계|Total|Gesamt|Total|Toplam
Состав заказа|تفاصيل الطلب|Isi pesanan|รายการอาหาร|订单明细|주문 항목|Détail de la commande|Bestellübersicht|Itens do pedido|Sipariş içeriği
Сумма заказа|مبلغ الطلب|Total pesanan|ยอดคำสั่งซื้อ|订单金额|주문 금액|Montant de la commande|Bestellsumme|Valor do pedido|Sipariş tutarı
Добавьте блюда из меню.|أضف أطباقاً من القائمة.|Tambahkan hidangan dari menu.|เพิ่มอาหารจากเมนู|请从菜单添加菜品。|메뉴에서 음식을 추가하세요.|Ajoutez des plats du menu.|Fügen Sie Gerichte hinzu.|Adicione pratos do menu.|Menüden yemek ekleyin.
Супы|الشوربات|Sup|ซุป|汤类|수프|Soupes|Suppen|Sopas|Çorbalar
Горячее|الأطباق الرئيسية|Hidangan utama|อาหารจานหลัก|主菜|메인 요리|Plats principaux|Hauptgerichte|Pratos principais|Ana yemekler
Салаты|السلطات|Salad|สลัด|沙拉|샐러드|Salades|Salate|Saladas|Salatalar
Выпечка|المخبوزات|Roti dan kue|เบเกอรี่|烘焙|베이커리|Boulangerie|Backwaren|Padaria|Hamur işleri
Десерты|الحلويات|Hidangan penutup|ของหวาน|甜点|디저트|Desserts|Desserts|Sobremesas|Tatlılar
Напитки|المشروبات|Minuman|เครื่องดื่ม|饮品|음료|Boissons|Getränke|Bebidas|İçecekler
Соусы|الصلصات|Saus|ซอส|酱料|소스|Sauces|Soßen|Molhos|Soslar
Другое|أخرى|Lainnya|อื่น ๆ|其他|기타|Autre|Sonstiges|Outros|Diğer
Все|الكل|Semua|ทั้งหมด|全部|전체|Tout|Alle|Todos|Tümü
Описание|الوصف|Deskripsi|รายละเอียด|详情|설명|Description|Beschreibung|Descrição|Açıklama
В заказе|في الطلب|Dalam pesanan|ในคำสั่งซื้อ|已选|담은 수량|Dans la commande|In der Bestellung|No pedido|Siparişte
Блюдо|طبق|Hidangan|อาหาร|菜品|요리|Plat|Gericht|Prato|Yemek
Халяль|حلال|Halal|ฮาลาล|清真|할랄|Halal|Halal|Halal|Helal
Уменьшить|تقليل|Kurangi|ลด|减少|줄이기|Diminuer|Verringern|Diminuir|Azalt
Увеличить|زيادة|Tambah|เพิ่ม|增加|늘리기|Augmenter|Erhöhen|Aumentar|Artır
Новый|جديد|Baru|ใหม่|新订单|신규|Nouveau|Neu|Novo|Yeni
Принят|تم القبول|Diterima|รับแล้ว|已接单|접수됨|Accepté|Angenommen|Aceite|Kabul edildi
Принят кафе|قبله المقهى|Diterima kafe|ร้านรับแล้ว|餐厅已接单|카페에서 접수함|Accepté par le café|Vom Café angenommen|Aceite pelo café|Kafe kabul etti
Готовится|قيد التحضير|Sedang disiapkan|กำลังเตรียม|准备中|준비 중|En préparation|In Zubereitung|Em preparação|Hazırlanıyor
Готов|جاهز|Siap|พร้อมแล้ว|已备好|준비 완료|Prêt|Fertig|Pronto|Hazır
Готов к выдаче|جاهز للاستلام|Siap diambil|พร้อมรับ|可取餐|수령 가능|Prêt à retirer|Abholbereit|Pronto para recolha|Teslim almaya hazır
Выдан|تم التسليم|Diserahkan|ส่งมอบแล้ว|已交付|전달됨|Remis|Ausgegeben|Entregue|Teslim edildi
Завершён|مكتمل|Selesai|เสร็จสิ้น|已完成|완료|Terminé|Abgeschlossen|Concluído|Tamamlandı
Отменён|ملغى|Dibatalkan|ยกเลิกแล้ว|已取消|취소됨|Annulé|Storniert|Cancelado|İptal edildi
Не оплачен|غير مدفوع|Belum dibayar|ยังไม่ชำระ|未付款|미결제|Non payé|Unbezahlt|Não pago|Ödenmedi
Оплачен|مدفوع|Sudah dibayar|ชำระแล้ว|已付款|결제됨|Payé|Bezahlt|Pago|Ödendi
Оплачено|تم الدفع|Sudah dibayar|ชำระแล้ว|已付款|결제 완료|Payé|Bezahlt|Pago|Ödendi
✓ Оплачено|✓ تم الدفع|✓ Sudah dibayar|✓ ชำระแล้ว|✓ 已付款|✓ 결제 완료|✓ Payé|✓ Bezahlt|✓ Pago|✓ Ödendi
Ожидает оплаты|بانتظار الدفع|Menunggu pembayaran|รอชำระเงิน|等待付款|결제 대기|En attente de paiement|Zahlung ausstehend|A aguardar pagamento|Ödeme bekleniyor
Ожидается оплата|بانتظار الدفع|Menunggu pembayaran|รอชำระเงิน|等待付款|결제 대기|En attente de paiement|Zahlung ausstehend|A aguardar pagamento|Ödeme bekleniyor
Ожидает подтверждения|بانتظار التأكيد|Menunggu konfirmasi|รอการยืนยัน|等待确认|확인 대기|En attente de confirmation|Bestätigung ausstehend|A aguardar confirmação|Onay bekleniyor
Ожидает курьера|بانتظار المندوب|Menunggu kurir|รอพนักงานส่ง|等待骑手|배달원 대기|En attente du livreur|Kurier wird erwartet|A aguardar estafeta|Kurye bekleniyor
Курьер назначен|تم تعيين المندوب|Kurir ditugaskan|มอบหมายพนักงานแล้ว|已分配骑手|배달원 배정됨|Livreur attribué|Kurier zugewiesen|Estafeta atribuído|Kurye atandı
У курьера|مع المندوب|Dibawa kurir|พนักงานรับแล้ว|骑手已取餐|배달원이 수령함|Chez le livreur|Beim Kurier|Com o estafeta|Kuryede
В пути|في الطريق|Dalam perjalanan|กำลังจัดส่ง|配送中|배달 중|En route|Unterwegs|A caminho|Yolda
Курьер в пути|المندوب في الطريق|Kurir dalam perjalanan|พนักงานกำลังมา|骑手正在路上|배달원이 오는 중|Livreur en route|Kurier unterwegs|Estafeta a caminho|Kurye yolda
Доставлен|تم التوصيل|Terkirim|จัดส่งแล้ว|已送达|배달 완료|Livré|Geliefert|Entregue|Teslim edildi
Доставлено|تم التوصيل|Terkirim|จัดส่งแล้ว|已送达|배달 완료|Livré|Geliefert|Entregue|Teslim edildi
История статусов|سجل الحالات|Riwayat status|ประวัติสถานะ|状态记录|상태 기록|Historique des statuts|Statusverlauf|Histórico de estados|Durum geçmişi
Где мой курьер|تتبع المندوب|Lacak kurir|ติดตามพนักงานส่ง|跟踪骑手|배달원 추적|Suivre le livreur|Kurier verfolgen|Seguir estafeta|Kuryeyi takip et
У вас пока нет заказов.|ليس لديك طلبات بعد.|Anda belum memiliki pesanan.|คุณยังไม่มีคำสั่งซื้อ|您还没有订单。|아직 주문이 없습니다.|Vous n’avez pas encore de commande.|Sie haben noch keine Bestellungen.|Ainda não tem pedidos.|Henüz siparişiniz yok.
Оплата возвращена|تم رد المبلغ|Pembayaran dikembalikan|คืนเงินแล้ว|已退款|환불됨|Paiement remboursé|Zahlung erstattet|Pagamento reembolsado|Ödeme iade edildi
Меню|القائمة|Menu|เมนู|菜单|메뉴|Menu|Speisekarte|Menu|Menü
На весь экран|ملء الشاشة|Layar penuh|เต็มหน้าจอ|全屏|전체 화면|Plein écran|Vollbild|Ecrã inteiro|Tam ekran
Уведомления|الإشعارات|Notifikasi|การแจ้งเตือน|通知|알림|Notifications|Benachrichtigungen|Notificações|Bildirimler
Закрыть|إغلاق|Tutup|ปิด|关闭|닫기|Fermer|Schließen|Fechar|Kapat
Закрыть карту|إغلاق الخريطة|Tutup peta|ปิดแผนที่|关闭地图|지도 닫기|Fermer la carte|Karte schließen|Fechar mapa|Haritayı kapat
Очистить поиск|مسح البحث|Hapus pencarian|ล้างการค้นหา|清除搜索|검색 지우기|Effacer la recherche|Suche löschen|Limpar pesquisa|Aramayı temizle
Карта для выбора точки доставки|خريطة موقع التوصيل|Peta lokasi pengantaran|แผนที่เลือกจุดจัดส่ง|配送地点地图|배달 위치 지도|Carte du lieu de livraison|Karte für Lieferort|Mapa do local de entrega|Teslimat konumu haritası
UMMA MAPS · ДОСТАВКА|UMMA MAPS · التوصيل|UMMA MAPS · PENGANTARAN|UMMA MAPS · จัดส่ง|UMMA MAPS · 配送|UMMA MAPS · 배달|UMMA MAPS · LIVRAISON|UMMA MAPS · LIEFERUNG|UMMA MAPS · ENTREGA|UMMA MAPS · TESLİMAT
Куда привезти заказ?|إلى أين نوصّل طلبك؟|Ke mana pesanan diantar?|จัดส่งคำสั่งซื้อที่ไหน?|您的订单送到哪里？|주문을 어디로 배달할까요?|Où livrer votre commande ?|Wohin liefern wir Ihre Bestellung?|Onde entregar o pedido?|Siparişinizi nereye teslim edelim?
Моё местоположение|موقعي|Lokasi saya|ตำแหน่งของฉัน|我的位置|내 위치|Ma position|Mein Standort|A minha localização|Konumum
Точная точка доставки|نقطة التوصيل الدقيقة|Titik pengantaran tepat|จุดจัดส่งที่แน่นอน|准确配送地点|정확한 배달 위치|Point de livraison précis|Genauer Lieferpunkt|Ponto exato de entrega|Tam teslimat noktası
Доставить сюда|التوصيل هنا|Antar ke sini|จัดส่งที่นี่|送到这里|여기로 배달|Livrer ici|Hierhin liefern|Entregar aqui|Buraya teslim et
Подготовка карты…|جارٍ إعداد الخريطة…|Menyiapkan peta…|กำลังเตรียมแผนที่…|正在准备地图…|지도 준비 중…|Préparation de la carte…|Karte wird vorbereitet…|A preparar mapa…|Harita hazırlanıyor…
Готовится к запуску|قريباً|Segera hadir|เร็ว ๆ นี้|即将上线|출시 예정|Bientôt disponible|Demnächst verfügbar|Brevemente|Yakında
Открыть UMMA Cafe|فتح مقهى UMMA|Buka Kafe UMMA|เปิดร้าน UMMA|进入UMMA餐厅|UMMA 카페 열기|Ouvrir UMMA Cafe|UMMA Café öffnen|Abrir UMMA Cafe|UMMA Kafe’yi aç
Направления UMMA|خدمات UMMA|Layanan UMMA|บริการ UMMA|UMMA服务|UMMA 서비스|Services UMMA|UMMA Bereiche|Serviços UMMA|UMMA hizmetleri
Добавить на главный экран телефона|إضافة إلى الشاشة الرئيسية|Tambahkan ke layar utama|เพิ่มไปยังหน้าจอหลัก|添加到主屏幕|홈 화면에 추가|Ajouter à l’écran d’accueil|Zum Startbildschirm hinzufügen|Adicionar ao ecrã inicial|Ana ekrana ekle
Администрирование|الإدارة|Administrasi|การดูแลระบบ|管理|관리|Administration|Verwaltung|Administração|Yönetim
Работа в кафе|إدارة المقهى|Operasional kafe|การดำเนินงานร้าน|餐厅运营|카페 운영|Activité du café|Cafébetrieb|Operação do café|Kafe işlemleri
Кухня|المطبخ|Dapur|ครัว|厨房|주방|Cuisine|Küche|Cozinha|Mutfak
Курьер|مندوب التوصيل|Kurir|พนักงานส่ง|骑手|배달원|Livreur|Kurier|Estafeta|Kurye
Приём заказов|استقبال الطلبات|Terima pesanan|รับคำสั่งซื้อ|接单|주문 접수|Prise de commandes|Bestellannahme|Receber pedidos|Sipariş alma
Учёт кафе|حسابات المقهى|Pembukuan kafe|บัญชีร้าน|餐厅记账|카페 회계|Comptabilité du café|Cafébuchhaltung|Contabilidade do café|Kafe muhasebesi
Пользователи|المستخدمون|Pengguna|ผู้ใช้|用户|사용자|Utilisateurs|Benutzer|Utilizadores|Kullanıcılar
Сотрудники|الموظفون|Staf|พนักงาน|员工|직원|Personnel|Mitarbeiter|Funcionários|Çalışanlar
Товары и остатки|المنتجات والمخزون|Produk dan stok|สินค้าและสต็อก|商品与库存|상품 및 재고|Produits et stock|Produkte und Bestand|Produtos e stock|Ürünler ve stok
Управление кафе|إدارة المقهى|Kelola kafe|จัดการร้าน|管理餐厅|카페 관리|Gérer le café|Café verwalten|Gerir café|Kafe yönetimi
Категория|الفئة|Kategori|หมวดหมู่|分类|카테고리|Catégorie|Kategorie|Categoria|Kategori
Цена, VND|السعر، VND|Harga, VND|ราคา VND|价格，越南盾|가격, VND|Prix, VND|Preis, VND|Preço, VND|Fiyat, VND
Количество|الكمية|Jumlah|จำนวน|数量|수량|Quantité|Menge|Quantidade|Miktar
Адрес|العنوان|Alamat|ที่อยู่|地址|주소|Adresse|Adresse|Morada|Adres
Страна|الدولة|Negara|ประเทศ|国家|국가|Pays|Land|País|Ülke
Комментарий|ملاحظة|Catatan|หมายเหตุ|备注|메모|Note|Notiz|Nota|Not
Способ оплаты|طريقة الدفع|Metode pembayaran|วิธีชำระเงิน|付款方式|결제 수단|Mode de paiement|Zahlungsart|Método de pagamento|Ödeme yöntemi
Активные|النشطة|Aktif|ที่ใช้งาน|进行中|진행 중|Actives|Aktiv|Ativos|Aktif
Закрытые|المغلقة|Ditutup|ปิดแล้ว|已关闭|종료됨|Clôturées|Geschlossen|Fechados|Kapatılan
Сохранить|حفظ|Simpan|บันทึก|保存|저장|Enregistrer|Speichern|Guardar|Kaydet
Отменить|إلغاء|Batal|ยกเลิก|取消|취소|Annuler|Abbrechen|Cancelar|İptal
Принять|قبول|Terima|รับ|接受|접수|Accepter|Annehmen|Aceitar|Kabul et
Готово|جاهز|Selesai|เสร็จแล้ว|完成|완료|Prêt|Fertig|Pronto|Hazır
Загрузка…|جارٍ التحميل…|Memuat…|กำลังโหลด…|加载中…|불러오는 중…|Chargement…|Wird geladen…|A carregar…|Yükleniyor…
Повторить|إعادة المحاولة|Coba lagi|ลองอีกครั้ง|重试|다시 시도|Réessayer|Erneut versuchen|Tentar novamente|Tekrar dene
Оплатить|الدفع|Bayar|ชำระเงิน|付款|결제|Payer|Bezahlen|Pagar|Öde
Оплатить по QR|الدفع برمز QR|Bayar dengan QR|ชำระด้วย QR|二维码付款|QR로 결제|Payer par QR|Mit QR bezahlen|Pagar por QR|QR ile öde
Оплата заказа|دفع الطلب|Pembayaran pesanan|ชำระคำสั่งซื้อ|订单付款|주문 결제|Paiement de la commande|Bestellung bezahlen|Pagamento do pedido|Sipariş ödemesi
Закрыть оплату|إغلاق الدفع|Tutup pembayaran|ปิดการชำระเงิน|关闭付款|결제 닫기|Fermer le paiement|Zahlung schließen|Fechar pagamento|Ödemeyi kapat
Ваш банк|البنك الخاص بك|Bank Anda|ธนาคารของคุณ|您的银行|이용 은행|Votre banque|Ihre Bank|O seu banco|Bankanız
Показать QR-код|عرض رمز QR|Tampilkan kode QR|แสดงรหัส QR|显示二维码|QR 코드 표시|Afficher le code QR|QR-Code anzeigen|Mostrar código QR|QR kodunu göster
Сохранить QR для оплаты|حفظ رمز الدفع|Simpan QR pembayaran|บันทึก QR ชำระเงิน|保存付款二维码|결제 QR 저장|Enregistrer le QR de paiement|Zahlungs-QR speichern|Guardar QR de pagamento|Ödeme QR kodunu kaydet
Сохранить QR|حفظ رمز QR|Simpan QR|บันทึก QR|保存二维码|QR 저장|Enregistrer le QR|QR speichern|Guardar QR|QR kaydet
Подготавливаем QR…|جارٍ إعداد QR…|Menyiapkan QR…|กำลังเตรียม QR…|正在准备二维码…|QR 준비 중…|Préparation du QR…|QR wird vorbereitet…|A preparar QR…|QR hazırlanıyor…
Открыть банк снова|فتح البنك مجدداً|Buka bank lagi|เปิดธนาคารอีกครั้ง|重新打开银行|은행 앱 다시 열기|Rouvrir la banque|Bank erneut öffnen|Reabrir banco|Bankayı tekrar aç
Скриншот оплаты|لقطة شاشة للدفع|Tangkapan layar pembayaran|ภาพหน้าจอการชำระเงิน|付款截图|결제 화면 캡처|Capture du paiement|Zahlungsnachweis|Captura do pagamento|Ödeme ekran görüntüsü
Скриншот перевода|لقطة شاشة للتحويل|Tangkapan layar transfer|ภาพหน้าจอการโอน|转账截图|이체 화면 캡처|Capture du virement|Überweisungsnachweis|Captura da transferência|Havale ekran görüntüsü
Выбрать скриншот|اختيار لقطة شاشة|Pilih tangkapan layar|เลือกภาพหน้าจอ|选择截图|화면 캡처 선택|Choisir une capture|Screenshot wählen|Escolher captura|Ekran görüntüsü seç
Отправить чек|إرسال الإيصال|Kirim bukti|ส่งหลักฐาน|发送凭证|영수증 보내기|Envoyer le justificatif|Beleg senden|Enviar comprovativo|Dekont gönder
Чек отправлен|تم إرسال الإيصال|Bukti terkirim|ส่งหลักฐานแล้ว|凭证已发送|영수증 전송됨|Justificatif envoyé|Beleg gesendet|Comprovativo enviado|Dekont gönderildi
Отправляем…|جارٍ الإرسال…|Mengirim…|กำลังส่ง…|正在发送…|전송 중…|Envoi…|Wird gesendet…|A enviar…|Gönderiliyor…
Проверяем поступление оплаты…|جارٍ التحقق من الدفع…|Memeriksa pembayaran…|กำลังตรวจสอบการชำระเงิน…|正在核实付款…|결제 확인 중…|Vérification du paiement…|Zahlung wird geprüft…|A verificar pagamento…|Ödeme kontrol ediliyor…
Ожидаем информацию от банка|بانتظار تأكيد البنك|Menunggu konfirmasi bank|รอการยืนยันจากธนาคาร|等待银行确认|은행 확인 대기|En attente de la banque|Bankbestätigung ausstehend|A aguardar o banco|Bankadan onay bekleniyor
Оформляем заказ…|جارٍ تأكيد الطلب…|Membuat pesanan…|กำลังสั่งอาหาร…|正在提交订单…|주문 처리 중…|Commande en cours…|Bestellung wird aufgegeben…|A efetuar pedido…|Sipariş oluşturuluyor…
Приём заказов приостановлен|الطلبات متوقفة مؤقتاً|Pemesanan dijeda|หยุดรับคำสั่งซื้อชั่วคราว|暂停接单|주문 일시 중단|Commandes suspendues|Bestellannahme pausiert|Pedidos suspensos|Sipariş alımı duraklatıldı
Укажите адрес доставки|أدخل عنوان التوصيل|Masukkan alamat pengantaran|กรอกที่อยู่จัดส่ง|请输入配送地址|배달 주소를 입력하세요|Saisissez l’adresse de livraison|Lieferadresse eingeben|Introduza a morada de entrega|Teslimat adresini girin
Сначала добавьте блюда в заказ|أضف أطباقاً إلى الطلب أولاً|Tambahkan hidangan dahulu|เพิ่มอาหารก่อน|请先添加菜品|먼저 음식을 추가하세요|Ajoutez d’abord des plats|Zuerst Gerichte hinzufügen|Adicione pratos primeiro|Önce yemek ekleyin
Закрыть выбор|إغلاق الاختيار|Tutup pilihan|ปิดตัวเลือก|关闭选择|선택 닫기|Fermer la sélection|Auswahl schließen|Fechar seleção|Seçimi kapat
Выберите вариант|اختر خياراً|Pilih opsi|เลือกตัวเลือก|请选择|옵션 선택|Choisissez une option|Option wählen|Escolha uma opção|Bir seçenek seçin
Точка доставки|نقطة التوصيل|Titik pengantaran|จุดจัดส่ง|配送地点|배달 위치|Point de livraison|Lieferpunkt|Ponto de entrega|Teslimat noktası
Изменить точку на карте|تغيير النقطة على الخريطة|Ubah titik di peta|เปลี่ยนจุดบนแผนที่|更改地图位置|지도 위치 변경|Modifier le point sur la carte|Kartenpunkt ändern|Alterar ponto no mapa|Haritadaki noktayı değiştir
Определяем…|جارٍ تحديد الموقع…|Mencari lokasi…|กำลังระบุตำแหน่ง…|正在定位…|위치 찾는 중…|Localisation…|Standort wird ermittelt…|A localizar…|Konum belirleniyor…
Курьер на карте|المندوب على الخريطة|Kurir di peta|พนักงานบนแผนที่|骑手位置|지도 위 배달원|Livreur sur la carte|Kurier auf der Karte|Estafeta no mapa|Haritada kurye
Ожидаем позицию|بانتظار الموقع|Menunggu lokasi|รอตำแหน่ง|等待位置|위치 대기|En attente de position|Standort wird erwartet|A aguardar localização|Konum bekleniyor
Нет свежей позиции|لا يوجد موقع حديث|Belum ada lokasi terbaru|ไม่มีตำแหน่งล่าสุด|暂无最新位置|최신 위치 없음|Aucune position récente|Kein aktueller Standort|Sem localização recente|Güncel konum yok
Название или ингредиент|اسم الطبق أو المكوّن|Nama atau bahan|ชื่ออาหารหรือส่วนผสม|菜名或食材|음식 이름 또는 재료|Nom ou ingrédient|Name oder Zutat|Nome ou ingrediente|Yemek adı veya malzeme
Категории меню|فئات القائمة|Kategori menu|หมวดเมนู|菜单分类|메뉴 카테고리|Catégories du menu|Menükategorien|Categorias do menu|Menü kategorileri
Меню кафе|قائمة المقهى|Menu kafe|เมนูร้าน|餐厅菜单|카페 메뉴|Menu du café|Café-Speisekarte|Menu do café|Kafe menüsü
Ваше имя|اسمك|Nama Anda|ชื่อของคุณ|您的姓名|이름|Votre nom|Ihr Name|O seu nome|Adınız
Для связи по заказу|للتواصل بشأن الطلب|Untuk menghubungi terkait pesanan|สำหรับติดต่อเรื่องคำสั่งซื้อ|用于订单联系|주문 관련 연락용|Pour vous joindre|Für Rückfragen zur Bestellung|Para contacto sobre o pedido|Sipariş için iletişim
Например, соус отдельно|مثلاً، الصلصة منفصلة|Misalnya, saus terpisah|เช่น แยกซอส|例如：酱料另放|예: 소스 별도|Ex. : sauce à part|Z. B. Soße separat|Ex.: molho à parte|Örn. sos ayrı
Найдено: {n} из {m}|النتائج: {n} من {m}|Ditemukan: {n} dari {m}|พบ: {n} จาก {m}|找到：{n} / {m}|검색: {n} / {m}|Trouvés : {n} sur {m}|Gefunden: {n} von {m}|Encontrados: {n} de {m}|Bulunan: {n} / {m}
Доступно в меню: {n}|الأطباق المتاحة: {n}|Hidangan tersedia: {n}|อาหารที่มี: {n}|可选菜品：{n}|주문 가능: {n}|Plats disponibles : {n}|Verfügbare Gerichte: {n}|Pratos disponíveis: {n}|Mevcut yemekler: {n}
Стол {n}|الطاولة {n}|Meja {n}|โต๊ะ {n}|{n}号桌|{n}번 테이블|Table {n}|Tisch {n}|Mesa {n}|Masa {n}
Заказ №{id}|الطلب رقم {id}|Pesanan #{id}|คำสั่งซื้อ #{id}|订单 #{id}|주문 #{id}|Commande nº {id}|Bestellung Nr. {id}|Pedido n.º {id}|Sipariş #{id}
Заказ №{id} принят.|تم قبول الطلب رقم {id}.|Pesanan #{id} diterima.|รับคำสั่งซื้อ #{id} แล้ว|订单 #{id} 已接单。|주문 #{id} 접수됨.|Commande nº {id} acceptée.|Bestellung Nr. {id} angenommen.|Pedido n.º {id} aceite.|Sipariş #{id} kabul edildi.
Уведомления сотрудникам кафе: {n}|تم إشعار الموظفين: {n}|Staf diberi tahu: {n}|แจ้งพนักงานแล้ว: {n}|已通知员工：{n}|직원 알림: {n}|Personnel averti : {n}|Benachrichtigte Mitarbeiter: {n}|Funcionários avisados: {n}|Bildirilen çalışan: {n}
Сумма: {text}|المبلغ: {text}|Jumlah: {text}|ยอด: {text}|金额：{text}|금액: {text}|Montant : {text}|Betrag: {text}|Valor: {text}|Tutar: {text}
Кафе: {text}|المقهى: {text}|Kafe: {text}|ร้าน: {text}|餐厅：{text}|카페: {text}|Café : {text}|Café: {text}|Café: {text}|Kafe: {text}
Доступный остаток: {n}|المخزون المتاح: {n}|Stok tersedia: {n}|คงเหลือ: {n}|库存：{n}|재고: {n}|Stock disponible : {n}|Verfügbarer Bestand: {n}|Stock disponível: {n}|Mevcut stok: {n}
Уменьшить {text}|تقليل {text}|Kurangi {text}|ลด {text}|减少{text}|{text} 줄이기|Diminuer {text}|{text} verringern|Diminuir {text}|{text} azalt
Добавить ещё {text}|إضافة المزيد من {text}|Tambah lagi {text}|เพิ่ม {text}|再加{text}|{text} 더 추가|Ajouter encore {text}|Mehr {text} hinzufügen|Adicionar mais {text}|Daha fazla {text} ekle
Добавить {text}|إضافة {text}|Tambah {text}|เพิ่ม {text}|添加{text}|{text} 추가|Ajouter {text}|{text} hinzufügen|Adicionar {text}|{text} ekle
VietQR для оплаты заказа №{id}|VietQR لدفع الطلب رقم {id}|VietQR untuk pesanan #{id}|VietQR สำหรับคำสั่งซื้อ #{id}|订单 #{id} 的VietQR付款码|주문 #{id} VietQR 결제|VietQR pour la commande nº {id}|VietQR für Bestellung Nr. {id}|VietQR do pedido n.º {id}|Sipariş #{id} için VietQR
АЯТ ДНЯ|آية اليوم|AYAT HARI INI|อายะฮ์ประจำวัน|今日经文|오늘의 구절|VERSET DU JOUR|VERS DES TAGES|VERSÍCULO DO DIA|GÜNÜN AYETİ
«И помогайте друг другу|«وَتَعَاوَنُوا|“Dan tolong-menolonglah|“และจงช่วยเหลือกัน|“你们应当互助|“의로움과 경건함으로|« Entraidez-vous|„Helft einander|«Ajudai-vos mutuamente|“İyilik ve takva üzere
в благочестии и богобоязненности...»|عَلَى الْبِرِّ وَالتَّقْوَىٰ...»|dalam kebajikan dan takwa…”|ในคุณธรรมและความยำเกรง…”|以正义和敬畏……”|서로 도우라…”|dans la bonté et la piété… »|in Güte und Gottesfurcht …“|na virtude e no temor a Allah…»|yardımlaşın…”
Коран, 5:2|القرآن، ٥:٢|Al-Qur'an, 5:2|อัลกุรอาน 5:2|《古兰经》5:2|꾸란 5:2|Coran, 5:2|Koran, 5:2|Alcorão, 5:2|Kur’an, 5:2
Проверьте заказ перед подтверждением. Деньги автоматически не списываются.|راجع طلبك قبل التأكيد. لن يُخصم المال تلقائياً.|Periksa pesanan sebelum konfirmasi. Uang tidak dipotong otomatis.|ตรวจสอบคำสั่งซื้อก่อนยืนยัน เงินจะไม่ถูกหักอัตโนมัติ|确认前请检查订单。系统不会自动扣款。|확인 전에 주문을 검토하세요. 자동으로 결제되지 않습니다.|Vérifiez la commande avant de confirmer. Aucun débit automatique.|Prüfen Sie Ihre Bestellung vor der Bestätigung. Keine automatische Abbuchung.|Verifique o pedido antes de confirmar. O dinheiro não é debitado automaticamente.|Onaylamadan önce siparişinizi kontrol edin. Otomatik ödeme alınmaz.
Статусы, оплата и доставка обновляются автоматически.|تُحدّث حالات الطلب والدفع والتوصيل تلقائياً.|Status pesanan, pembayaran, dan pengantaran diperbarui otomatis.|สถานะคำสั่งซื้อ การชำระเงินและการจัดส่งอัปเดตอัตโนมัติ|订单、付款和配送状态会自动更新。|주문, 결제 및 배달 상태가 자동으로 갱신됩니다.|Les statuts de commande, paiement et livraison s’actualisent automatiquement.|Bestell-, Zahlungs- und Lieferstatus werden automatisch aktualisiert.|Os estados do pedido, pagamento e entrega são atualizados automaticamente.|Sipariş, ödeme ve teslimat durumları otomatik güncellenir.
Приём заказов временно приостановлен. Меню доступно для просмотра.|الطلبات متوقفة مؤقتاً. يمكنك تصفح القائمة.|Pemesanan dihentikan sementara. Menu tetap dapat dilihat.|หยุดรับคำสั่งซื้อชั่วคราว คุณยังดูเมนูได้|暂时停止接单，您仍可浏览菜单。|주문이 일시 중단되었습니다. 메뉴는 확인할 수 있습니다.|Les commandes sont suspendues. Le menu reste consultable.|Bestellungen sind vorübergehend pausiert. Die Speisekarte ist einsehbar.|Os pedidos estão temporariamente suspensos. Pode consultar o menu.|Sipariş alımı geçici olarak durduruldu. Menüyü inceleyebilirsiniz.
Приём заказов временно приостановлен.|الطلبات متوقفة مؤقتاً.|Pemesanan dihentikan sementara.|หยุดรับคำสั่งซื้อชั่วคราว|暂时停止接单。|주문이 일시 중단되었습니다.|Les commandes sont temporairement suspendues.|Bestellannahme vorübergehend pausiert.|Os pedidos estão temporariamente suspensos.|Sipariş alımı geçici olarak durduruldu.
Ничего не найдено. Измените запрос, выберите другую категорию или нажмите «Показать всё меню».|لا توجد نتائج. غيّر البحث أو الفئة أو اعرض القائمة كاملة.|Tidak ditemukan. Ubah pencarian, pilih kategori lain, atau tampilkan seluruh menu.|ไม่พบอาหาร ลองเปลี่ยนคำค้น หมวดหมู่ หรือแสดงเมนูทั้งหมด|未找到结果。请更改搜索词、选择其他分类或显示全部菜单。|검색 결과가 없습니다. 검색어 또는 카테고리를 바꾸거나 전체 메뉴를 확인하세요.|Aucun résultat. Modifiez la recherche, la catégorie ou affichez tout le menu.|Keine Treffer. Ändern Sie Suche oder Kategorie oder zeigen Sie die ganze Speisekarte an.|Sem resultados. Altere a pesquisa ou categoria, ou veja todo o menu.|Sonuç bulunamadı. Aramayı veya kategoriyi değiştirin ya da tüm menüyü gösterin.
В выбранном кафе пока нет товаров с доступным остатком. Выберите другое кафе или попробуйте позже.|لا توجد أطباق متاحة في هذا المقهى. اختر مقهى آخر أو حاول لاحقاً.|Tidak ada hidangan tersedia di kafe ini. Pilih kafe lain atau coba nanti.|ร้านนี้ยังไม่มีอาหารพร้อมจำหน่าย เลือกร้านอื่นหรือลองภายหลัง|该餐厅暂无可售菜品。请选择其他餐厅或稍后重试。|이 카페에 주문 가능한 메뉴가 없습니다. 다른 카페를 선택하거나 나중에 다시 시도하세요.|Aucun plat disponible dans ce café. Choisissez un autre café ou réessayez plus tard.|In diesem Café sind keine Gerichte verfügbar. Wählen Sie ein anderes Café oder versuchen Sie es später.|Este café não tem pratos disponíveis. Escolha outro café ou tente mais tarde.|Bu kafede mevcut ürün yok. Başka bir kafe seçin veya daha sonra deneyin.
Всё, что нужно нашей семье. Кафе уже работает в приложении; остальные направления готовятся к запуску.|كل ما تحتاجه عائلتنا. المقهى متاح الآن في التطبيق والخدمات الأخرى قريباً.|Semua kebutuhan keluarga kita. Kafe sudah tersedia; layanan lain segera hadir.|ทุกสิ่งที่ครอบครัวเราต้องการ ร้านอาหารพร้อมใช้งานแล้ว บริการอื่นกำลังเตรียมเปิด|我们大家庭所需的一切。餐厅已在应用中开放，其他服务即将上线。|우리 가족에게 필요한 모든 것. 카페는 이용 가능하며 다른 서비스는 준비 중입니다.|Tout pour notre famille. Le café est disponible ; les autres services arrivent bientôt.|Alles für unsere Familie. Das Café ist verfügbar, weitere Angebote folgen.|Tudo para a nossa família. O café já está disponível; outros serviços chegam em breve.|Ailemizin ihtiyacı olan her şey. Kafe uygulamada açık; diğer hizmetler hazırlanıyor.
Оплата подтвердится автоматически. Скриншот не нужен.|سيُؤكّد الدفع تلقائياً. لا حاجة إلى لقطة شاشة.|Pembayaran dikonfirmasi otomatis. Tidak perlu tangkapan layar.|การชำระเงินจะยืนยันอัตโนมัติ ไม่ต้องส่งภาพหน้าจอ|付款将自动确认，无需截图。|결제가 자동으로 확인됩니다. 화면 캡처는 필요 없습니다.|Le paiement sera confirmé automatiquement. Aucune capture nécessaire.|Die Zahlung wird automatisch bestätigt. Kein Screenshot nötig.|O pagamento será confirmado automaticamente. Não é necessária captura.|Ödeme otomatik onaylanır. Ekran görüntüsü gerekmez.
Ждём подтверждение банка… Если уже оплатили, не переводите повторно.|بانتظار تأكيد البنك… إذا دفعت فلا تحوّل مجدداً.|Menunggu konfirmasi bank… Jika sudah membayar, jangan transfer lagi.|รอธนาคารยืนยัน… หากชำระแล้วอย่าโอนซ้ำ|正在等待银行确认…如果已付款，请勿重复转账。|은행 확인 대기 중… 이미 결제했다면 다시 송금하지 마세요.|En attente de la banque… Si vous avez payé, ne renvoyez pas d’argent.|Warten auf Bankbestätigung… Wenn Sie bezahlt haben, überweisen Sie nicht erneut.|A aguardar confirmação do banco… Se já pagou, não transfira novamente.|Banka onayı bekleniyor… Ödediyseniz tekrar havale yapmayın.
Спасибо! Оплата заказа подтверждена.|شكراً! تم تأكيد دفع طلبك.|Terima kasih! Pembayaran terkonfirmasi.|ขอบคุณ! ยืนยันการชำระเงินแล้ว|谢谢！订单付款已确认。|감사합니다! 주문 결제가 확인되었습니다.|Merci ! Le paiement est confirmé.|Vielen Dank! Ihre Zahlung wurde bestätigt.|Obrigado! O pagamento foi confirmado.|Teşekkürler! Sipariş ödemesi onaylandı.
Нет связи. Проверим оплату автоматически после восстановления.|لا يوجد اتصال. سنتحقق من الدفع تلقائياً عند عودة الاتصال.|Tidak ada koneksi. Pembayaran diperiksa otomatis setelah tersambung.|ไม่มีการเชื่อมต่อ ระบบจะตรวจสอบการชำระเงินเมื่อเชื่อมต่ออีกครั้ง|网络已断开。恢复连接后将自动核实付款。|연결이 끊겼습니다. 연결 복구 후 결제를 자동 확인합니다.|Hors connexion. Le paiement sera vérifié au rétablissement.|Keine Verbindung. Nach Wiederherstellung wird die Zahlung automatisch geprüft.|Sem ligação. O pagamento será verificado quando a ligação voltar.|Bağlantı yok. Bağlantı kurulduğunda ödeme otomatik kontrol edilir.
Сохраните QR на телефон или сделайте скриншот.|احفظ رمز QR على هاتفك أو التقط لقطة شاشة.|Simpan QR di ponsel atau ambil tangkapan layar.|บันทึก QR ในโทรศัพท์หรือถ่ายภาพหน้าจอ|将二维码保存到手机或截屏。|QR을 휴대전화에 저장하거나 화면을 캡처하세요.|Enregistrez le QR ou faites une capture.|Speichern Sie den QR-Code oder machen Sie einen Screenshot.|Guarde o QR no telemóvel ou faça uma captura.|QR kodunu telefonunuza kaydedin veya ekran görüntüsü alın.
Откройте Vietcombank → QR → выберите изображение из галереи.|افتح Vietcombank ثم QR واختر الصورة من المعرض.|Buka Vietcombank → QR → pilih gambar dari galeri.|เปิด Vietcombank → QR → เลือกภาพจากแกลเลอรี|打开Vietcombank → QR → 从相册选择图片。|Vietcombank → QR → 갤러리에서 이미지를 선택하세요.|Ouvrez Vietcombank → QR → choisissez l’image dans la galerie.|Öffnen Sie Vietcombank → QR → wählen Sie das Bild aus der Galerie.|Abra Vietcombank → QR → escolha a imagem da galeria.|Vietcombank → QR → galeriden görseli seçin.
Проверьте получателя и подтвердите перевод.|تحقق من المستلم وأكّد التحويل.|Periksa penerima dan konfirmasi transfer.|ตรวจสอบผู้รับและยืนยันการโอน|核对收款人并确认转账。|수취인을 확인한 후 송금을 승인하세요.|Vérifiez le bénéficiaire et confirmez le virement.|Prüfen Sie den Empfänger und bestätigen Sie die Überweisung.|Verifique o destinatário e confirme a transferência.|Alıcıyı kontrol edin ve havaleyi onaylayın.
Сумма и номер заказа уже в QR. Не меняйте их при оплате.|المبلغ ورقم الطلب موجودان في QR. لا تغيّرهما عند الدفع.|Jumlah dan nomor pesanan sudah dalam QR. Jangan diubah.|QR มีจำนวนเงินและเลขคำสั่งซื้อแล้ว อย่าเปลี่ยนขณะชำระ|二维码已包含金额和订单号，请勿修改。|QR에 금액과 주문 번호가 포함되어 있습니다. 변경하지 마세요.|Le montant et le numéro sont dans le QR. Ne les modifiez pas.|Betrag und Bestellnummer stehen im QR-Code. Bitte nicht ändern.|O QR já contém o valor e o número do pedido. Não os altere.|Tutar ve sipariş numarası QR kodunda mevcut. Değiştirmeyin.
Выберите сохранённый QR в сканере банка. Сумма и номер заказа уже указаны.|اختر QR المحفوظ في ماسح البنك. المبلغ ورقم الطلب محدّدان.|Pilih QR tersimpan di pemindai bank. Jumlah dan nomor pesanan sudah terisi.|เลือก QR ที่บันทึกไว้ในแอปธนาคาร มีจำนวนเงินและเลขคำสั่งซื้อแล้ว|在银行扫码功能中选择已保存的二维码，金额和订单号已填写。|은행 스캐너에서 저장한 QR을 선택하세요. 금액과 주문 번호가 입력되어 있습니다.|Choisissez le QR enregistré dans le scanner bancaire. Le montant et le numéro sont inclus.|Wählen Sie den gespeicherten QR im Bankscanner. Betrag und Bestellnummer sind enthalten.|Selecione o QR guardado no leitor do banco. O valor e o número já constam.|Banka tarayıcısında kayıtlı QR kodunu seçin. Tutar ve sipariş numarası mevcut.
Уже перевели?|هل حوّلت المبلغ؟|Sudah transfer?|โอนแล้วใช่ไหม?|已经转账？|이미 송금하셨나요?|Déjà effectué le virement ?|Bereits überwiesen?|Já transferiu?|Havale yaptınız mı?
Прикрепите фото или скриншот перевода. JPG, PNG или WEBP до 5 МБ.|أرفق صورة أو لقطة للتحويل. JPG أو PNG أو WEBP حتى 5 ميغابايت.|Lampirkan foto atau tangkapan layar transfer. JPG, PNG atau WEBP hingga 5 MB.|แนบรูปหรือภาพหน้าจอการโอน JPG, PNG หรือ WEBP ไม่เกิน 5 MB|请上传转账照片或截图。支持JPG、PNG或WEBP，不超过5MB。|이체 사진 또는 화면 캡처를 첨부하세요. JPG, PNG, WEBP, 최대 5MB.|Joignez une photo ou capture du virement. JPG, PNG ou WEBP, 5 Mo maximum.|Foto oder Screenshot der Überweisung anhängen. JPG, PNG oder WEBP bis 5 MB.|Anexe uma foto ou captura da transferência. JPG, PNG ou WEBP até 5 MB.|Havale fotoğrafı veya ekran görüntüsü ekleyin. JPG, PNG veya WEBP, en fazla 5 MB.
Выберите JPG, PNG или WEBP до 5 МБ.|اختر JPG أو PNG أو WEBP حتى 5 ميغابايت.|Pilih JPG, PNG atau WEBP hingga 5 MB.|เลือก JPG, PNG หรือ WEBP ไม่เกิน 5 MB|请选择不超过5MB的JPG、PNG或WEBP。|최대 5MB의 JPG, PNG 또는 WEBP를 선택하세요.|Choisissez JPG, PNG ou WEBP, 5 Mo maximum.|JPG, PNG oder WEBP bis 5 MB wählen.|Escolha JPG, PNG ou WEBP até 5 MB.|En fazla 5 MB JPG, PNG veya WEBP seçin.
Скриншот выбран. Нажмите «Отправить чек».|تم اختيار الصورة. اضغط «إرسال الإيصال».|Tangkapan layar dipilih. Ketuk Kirim bukti.|เลือกภาพแล้ว กดส่งหลักฐาน|已选择截图。请点击发送凭证。|화면 캡처가 선택되었습니다. 영수증 보내기를 누르세요.|Capture sélectionnée. Appuyez sur Envoyer le justificatif.|Screenshot ausgewählt. Tippen Sie auf Beleg senden.|Captura selecionada. Toque em Enviar comprovativo.|Ekran görüntüsü seçildi. Dekont gönder’e dokunun.
Скриншот отправлен. Ожидайте проверки кафе.|تم إرسال الصورة. انتظر تحقق المقهى.|Tangkapan layar terkirim. Tunggu pemeriksaan kafe.|ส่งภาพแล้ว กรุณารอร้านตรวจสอบ|截图已发送，请等待餐厅审核。|화면 캡처가 전송되었습니다. 카페 확인을 기다려 주세요.|Capture envoyée. Attendez la vérification du café.|Screenshot gesendet. Warten Sie auf die Prüfung durch das Café.|Captura enviada. Aguarde a verificação do café.|Ekran görüntüsü gönderildi. Kafenin kontrolünü bekleyin.
Чек проверен сотрудником.|تحقق الموظف من الإيصال.|Bukti diverifikasi staf.|พนักงานตรวจสอบหลักฐานแล้ว|员工已核实凭证。|직원이 영수증을 확인했습니다.|Justificatif vérifié par le personnel.|Beleg vom Personal geprüft.|Comprovativo verificado pelo funcionário.|Dekont çalışan tarafından kontrol edildi.
Чек отправлен на проверку. Оплату подтвердит сотрудник после поступления денег.|أُرسل الإيصال للتحقق. يؤكّد الموظف الدفع بعد وصول المال.|Bukti dikirim untuk diperiksa. Staf mengonfirmasi setelah uang diterima.|ส่งหลักฐานเพื่อตรวจสอบแล้ว พนักงานจะยืนยันเมื่อได้รับเงิน|凭证已提交审核。员工收到款项后将确认付款。|영수증 검토 중입니다. 입금 후 직원이 결제를 확인합니다.|Justificatif envoyé. Le personnel confirmera après réception des fonds.|Beleg zur Prüfung gesendet. Nach Geldeingang bestätigt das Personal.|Comprovativo enviado. O funcionário confirma após receber o dinheiro.|Dekont kontrole gönderildi. Para ulaştıktan sonra çalışan onaylayacak.
Не удалось отправить чек. Попробуйте ещё раз.|تعذّر إرسال الإيصال. حاول مجدداً.|Bukti gagal dikirim. Coba lagi.|ส่งหลักฐานไม่สำเร็จ ลองอีกครั้ง|发送凭证失败，请重试。|영수증을 보내지 못했습니다. 다시 시도하세요.|Impossible d’envoyer le justificatif. Réessayez.|Beleg konnte nicht gesendet werden. Erneut versuchen.|Não foi possível enviar o comprovativo. Tente novamente.|Dekont gönderilemedi. Tekrar deneyin.
Повторить отправку|إعادة الإرسال|Kirim ulang|ส่งอีกครั้ง|重新发送|다시 보내기|Renvoyer|Erneut senden|Reenviar|Tekrar gönder
Оплатили, но статус не изменился?|دفعت ولم تتغير الحالة؟|Sudah bayar tetapi status belum berubah?|ชำระแล้วแต่สถานะไม่เปลี่ยน?|已付款但状态未变？|결제했는데 상태가 바뀌지 않았나요?|Payé mais le statut n’a pas changé ?|Bezahlt, aber Status unverändert?|Pagou mas o estado não mudou?|Ödediniz ama durum değişmedi mi?
Не оплачивайте повторно. Если изменили сумму или назначение, автоматическое подтверждение не сработает. Отправьте скриншот: сотрудник проверит поступление и поможет с разницей в сумме.|لا تدفع مجدداً. تغيير المبلغ أو المرجع يمنع التأكيد التلقائي. أرسل لقطة شاشة ليتحقق الموظف من التحويل ويعالج فرق المبلغ.|Jangan bayar lagi. Jika jumlah atau referensi diubah, konfirmasi otomatis gagal. Kirim tangkapan layar agar staf memeriksa dan membantu selisihnya.|อย่าชำระซ้ำ หากเปลี่ยนยอดหรือหมายเหตุ ระบบจะยืนยันอัตโนมัติไม่ได้ ส่งภาพหน้าจอให้พนักงานตรวจสอบและช่วยเรื่องส่วนต่าง|请勿重复付款。如修改金额或转账附言，将无法自动确认。请发送截图，由员工核实入账并协助处理差额。|다시 결제하지 마세요. 금액이나 참조를 변경하면 자동 확인되지 않습니다. 화면 캡처를 보내면 직원이 입금과 차액을 확인합니다.|Ne payez pas à nouveau. Un montant ou libellé modifié empêche la confirmation automatique. Envoyez une capture pour vérification et traitement de l’écart.|Nicht erneut bezahlen. Änderungen an Betrag oder Verwendungszweck verhindern die automatische Bestätigung. Senden Sie einen Screenshot zur Prüfung und Klärung der Differenz.|Não pague novamente. Alterar valor ou referência impede a confirmação automática. Envie uma captura para o funcionário verificar e resolver diferenças.|Tekrar ödeme yapmayın. Tutar veya açıklama değiştiyse otomatik onay çalışmaz. Çalışanın kontrol edip farkı çözmesi için ekran görüntüsü gönderin.
Точка доставки|نقطة التوصيل|Titik pengantaran|จุดจัดส่ง|配送地点|배달 위치|Point de livraison|Lieferpunkt|Ponto de entrega|Teslimat noktası
Место доставки отмечено на карте|تم تحديد مكان التوصيل على الخريطة|Lokasi pengantaran ditandai di peta|ทำเครื่องหมายจุดจัดส่งบนแผนที่แล้ว|配送地点已标记|배달 위치가 표시되었습니다|Lieu de livraison indiqué sur la carte|Lieferort auf Karte markiert|Local de entrega marcado no mapa|Teslimat konumu haritada işaretlendi
Выберите точку на карте или введите полный адрес ниже.|اختر نقطة على الخريطة أو أدخل العنوان الكامل أدناه.|Pilih titik di peta atau masukkan alamat lengkap di bawah.|เลือกจุดบนแผนที่หรือกรอกที่อยู่เต็มด้านล่าง|请在地图上选择地点，或在下方输入完整地址。|지도에서 위치를 선택하거나 아래에 전체 주소를 입력하세요.|Choisissez un point ou saisissez l’adresse complète ci-dessous.|Wählen Sie einen Kartenpunkt oder geben Sie unten die vollständige Adresse ein.|Escolha um ponto no mapa ou introduza a morada completa abaixo.|Haritada nokta seçin veya aşağıya tam adresi girin.
Проверьте точку и нажмите «Доставить сюда».|تحقق من النقطة واضغط «التوصيل هنا».|Periksa titik lalu ketuk Antar ke sini.|ตรวจสอบจุดแล้วกดจัดส่งที่นี่|请核对地点并点击送到这里。|위치를 확인하고 여기로 배달을 누르세요.|Vérifiez le point et appuyez sur Livrer ici.|Punkt prüfen und Hierhin liefern wählen.|Verifique o ponto e toque em Entregar aqui.|Noktayı kontrol edin ve Buraya teslim et’e dokunun.
Геолокация недоступна. Поставьте точку на карте вручную.|الموقع غير متاح. ضع نقطة على الخريطة يدوياً.|Lokasi tidak tersedia. Pilih titik di peta secara manual.|ตำแหน่งไม่พร้อมใช้งาน กรุณาเลือกจุดบนแผนที่เอง|定位不可用，请手动在地图上标记。|위치를 사용할 수 없습니다. 지도에서 직접 선택하세요.|Localisation indisponible. Placez le repère manuellement.|Standort nicht verfügbar. Markierung manuell setzen.|Localização indisponível. Marque um ponto manualmente.|Konum kullanılamıyor. Haritada elle nokta seçin.
Разрешите доступ к местоположению. Затем проверьте найденную точку.|اسمح بالوصول إلى الموقع ثم تحقق من النقطة.|Izinkan akses lokasi, lalu periksa titiknya.|อนุญาตเข้าถึงตำแหน่ง แล้วตรวจสอบจุดที่พบ|请允许访问位置，然后核对定位点。|위치 접근을 허용한 후 표시된 위치를 확인하세요.|Autorisez la localisation, puis vérifiez le point.|Standortzugriff erlauben und Punkt prüfen.|Permita o acesso à localização e verifique o ponto.|Konum erişimine izin verin, sonra noktayı kontrol edin.
Квартира, этаж, ориентир (необязательно)|الشقة، الطابق، معلم قريب (اختياري)|Apartemen, lantai, patokan (opsional)|ห้อง ชั้น จุดสังเกต (ไม่บังคับ)|房号、楼层、地标（选填）|호수, 층, 주변 건물 (선택)|Appartement, étage, repère (facultatif)|Wohnung, Etage, Orientierung (optional)|Apartamento, andar, referência (opcional)|Daire, kat, yakın yer (isteğe bağlı)
Улица, дом, квартира или ориентир|الشارع، المبنى، الشقة أو معلم قريب|Jalan, gedung, apartemen atau patokan|ถนน บ้าน ห้อง หรือจุดสังเกต|街道、门牌、房号或地标|도로, 건물, 호수 또는 주변 건물|Rue, immeuble, appartement ou repère|Straße, Haus, Wohnung oder Orientierungspunkt|Rua, edifício, apartamento ou referência|Sokak, bina, daire veya yakın yer
Откройте приложение через Telegram.|افتح التطبيق عبر Telegram.|Buka aplikasi melalui Telegram.|เปิดแอปผ่าน Telegram|请通过Telegram打开应用。|Telegram에서 앱을 여세요.|Ouvrez l’application via Telegram.|Öffnen Sie die App über Telegram.|Abra a aplicação pelo Telegram.|Uygulamayı Telegram üzerinden açın.
Откройте приложение через Telegram|افتح التطبيق عبر Telegram|Buka aplikasi melalui Telegram|เปิดแอปผ่าน Telegram|请通过Telegram打开应用|Telegram에서 앱을 여세요|Ouvrez l’application via Telegram|Öffnen Sie die App über Telegram|Abra a aplicação pelo Telegram|Uygulamayı Telegram üzerinden açın
Не удалось загрузить меню|تعذّر تحميل القائمة|Gagal memuat menu|โหลดเมนูไม่สำเร็จ|无法加载菜单|메뉴를 불러오지 못했습니다|Impossible de charger le menu|Speisekarte konnte nicht geladen werden|Não foi possível carregar o menu|Menü yüklenemedi
Не удалось оформить заказ|تعذّر تأكيد الطلب|Gagal membuat pesanan|สั่งอาหารไม่สำเร็จ|提交订单失败|주문하지 못했습니다|Impossible de passer commande|Bestellung fehlgeschlagen|Não foi possível fazer o pedido|Sipariş oluşturulamadı
Не удалось загрузить заказы|تعذّر تحميل الطلبات|Gagal memuat pesanan|โหลดคำสั่งซื้อไม่สำเร็จ|无法加载订单|주문을 불러오지 못했습니다|Impossible de charger les commandes|Bestellungen konnten nicht geladen werden|Não foi possível carregar os pedidos|Siparişler yüklenemedi
Выберите кафе, в котором хотите заказать.|اختر المقهى الذي تريد الطلب منه.|Pilih kafe tempat Anda memesan.|เลือกร้านที่ต้องการสั่ง|请选择下单的餐厅。|주문할 카페를 선택하세요.|Choisissez le café où commander.|Wählen Sie das gewünschte Café.|Escolha o café onde quer pedir.|Sipariş vereceğiniz kafeyi seçin.
Доставлено|تم التوصيل|Terkirim|จัดส่งแล้ว|已送达|배달 완료|Livré|Geliefert|Entregue|Teslim edildi
Заказ доставлен.|تم توصيل الطلب.|Pesanan telah diantar.|จัดส่งคำสั่งซื้อแล้ว|订单已送达。|주문이 배달되었습니다.|Commande livrée.|Bestellung geliefert.|Pedido entregue.|Sipariş teslim edildi.
Курьер ещё не забрал заказ.|المندوب لم يستلم الطلب بعد.|Kurir belum mengambil pesanan.|พนักงานยังไม่ได้รับอาหาร|骑手尚未取餐。|배달원이 아직 주문을 수령하지 않았습니다.|Le livreur n’a pas encore retiré la commande.|Kurier hat die Bestellung noch nicht abgeholt.|O estafeta ainda não recolheu o pedido.|Kurye henüz siparişi almadı.
Курьер пока не передаёт позицию.|المندوب لا يشارك موقعه بعد.|Kurir belum membagikan lokasi.|พนักงานยังไม่ได้แชร์ตำแหน่ง|骑手暂未共享位置。|배달원이 아직 위치를 공유하지 않습니다.|Le livreur ne partage pas encore sa position.|Kurier teilt noch keinen Standort.|O estafeta ainda não partilha a localização.|Kurye henüz konum paylaşmıyor.
Нет свежей позиции. GPS или связь временно недоступны.|لا يوجد موقع حديث. GPS أو الاتصال غير متاح مؤقتاً.|Belum ada lokasi terbaru. GPS atau koneksi sementara tidak tersedia.|ไม่มีตำแหน่งล่าสุด GPS หรือการเชื่อมต่อไม่พร้อมชั่วคราว|暂无最新位置，GPS或网络暂时不可用。|최신 위치가 없습니다. GPS 또는 연결을 잠시 사용할 수 없습니다.|Pas de position récente. GPS ou connexion temporairement indisponible.|Kein aktueller Standort. GPS oder Verbindung vorübergehend nicht verfügbar.|Sem localização recente. GPS ou ligação temporariamente indisponível.|Güncel konum yok. GPS veya bağlantı geçici olarak kullanılamıyor.
Отслеживание завершено или недоступно.|انتهى التتبع أو أنه غير متاح.|Pelacakan selesai atau tidak tersedia.|การติดตามสิ้นสุดหรือไม่พร้อมใช้งาน|跟踪已结束或不可用。|추적이 종료되었거나 사용할 수 없습니다.|Suivi terminé ou indisponible.|Verfolgung beendet oder nicht verfügbar.|Seguimento terminado ou indisponível.|Takip sona erdi veya kullanılamıyor.
Позиция недоступна.|الموقع غير متاح.|Lokasi tidak tersedia.|ตำแหน่งไม่พร้อมใช้งาน|位置不可用。|위치를 사용할 수 없습니다.|Position indisponible.|Standort nicht verfügbar.|Localização indisponível.|Konum kullanılamıyor.
Шурпа|شوربا|Shurpa|ชูร์ปา|舒尔帕汤|슈르파|Chourpa|Schurpa|Shurpa|Şurpa
Плов|بلاو|Plov|พลอฟ|抓饭|플로프|Plov|Plow|Plov|Pilav
Манты|مانتي|Manti|มันตี|曼特蒸饺|만티|Manty|Manti|Manti|Mantı
Лепёшка UMMA|خبز UMMA|Roti pipih UMMA|ขนมปังแผ่น UMMA|UMMA烤饼|UMMA 납작빵|Pain plat UMMA|UMMA Fladenbrot|Pão achatado UMMA|UMMA ekmeği
Самса с бараниной|سمبوسة بلحم الضأن|Samsa daging domba|ซัมซาไส้เนื้อแกะ|羊肉烤包子|양고기 삼사|Samsa à l’agneau|Samsa mit Lamm|Samsa de borrego|Kuzu etli samsa
Самса с курицей|سمبوسة بالدجاج|Samsa ayam|ซัมซาไส้ไก่|鸡肉烤包子|닭고기 삼사|Samsa au poulet|Samsa mit Hähnchen|Samsa de frango|Tavuklu samsa
Борщ с говядиной|بورش بلحم البقر|Borscht daging sapi|บอร์ชเนื้อวัว|牛肉罗宋汤|소고기 보르시|Bortsch au bœuf|Borschtsch mit Rind|Borscht de vaca|Dana etli borş
Куриный окорочок с салатом|فخذ دجاج مع سلطة|Paha ayam dengan salad|น่องไก่พร้อมสลัด|鸡腿配沙拉|닭다리와 샐러드|Cuisse de poulet et salade|Hähnchenschenkel mit Salat|Perna de frango com salada|Salatalı tavuk but
Хачапури|خاتشابوري|Khachapuri|คาชาปูรี|哈恰普里奶酪饼|하차푸리|Khatchapouri|Chatschapuri|Khachapuri|Haçapuri
Круассан|كرواسون|Kroisan|ครัวซองต์|可颂|크루아상|Croissant|Croissant|Croissant|Kruvasan
Аджика|أجيكا|Adjika|อัดจิกา|阿吉卡辣酱|아지카|Adjika|Adschika|Adjika|Acıka
Оливье|سلطة أوليفييه|Salad Olivier|สลัดโอลิเวียร์|奥利维耶沙拉|올리비에 샐러드|Salade Olivier|Olivier-Salat|Salada Olivier|Olivier salatası
Винегрет|سلطة الشمندر|Salad bit|สลัดบีทรูท|甜菜沙拉|비트 샐러드|Salade de betteraves|Rote-Bete-Salat|Salada de beterraba|Pancar salatası
Салат «Хрустящий»|سلطة مقرمشة|Salad renyah|สลัดกรอบ|爽脆沙拉|아삭한 샐러드|Salade croquante|Knackiger Salat|Salada crocante|Çıtır salata
Чай зелёный|شاي أخضر|Teh hijau|ชาเขียว|绿茶|녹차|Thé vert|Grüner Tee|Chá verde|Yeşil çay
Чай чёрный|شاي أسود|Teh hitam|ชาดำ|红茶|홍차|Thé noir|Schwarzer Tee|Chá preto|Siyah çay
Айран UMMA|عيران UMMA|Ayran UMMA|อัยรัน UMMA|UMMA咸酸奶|UMMA 아이란|Ayran UMMA|UMMA Ayran|Ayran UMMA|UMMA Ayran
Компот ежевичный|شراب التوت الأسود|Kompot blackberry|น้ำแบล็กเบอร์รี|黑莓果饮|블랙베리 콤포트|Compote de mûres à boire|Brombeerkompott-Getränk|Bebida de amora|Böğürtlen kompostosu
Маршрут доставки|مسار التوصيل|Rute pengantaran|เส้นทางจัดส่ง|配送路线|배달 경로|Itinéraire de livraison|Lieferroute|Rota de entrega|Teslimat rotası
Открыть маршрут в Картах Apple|فتح المسار في خرائط Apple|Buka rute di Apple Maps|เปิดเส้นทางใน Apple Maps|在Apple地图中打开路线|Apple 지도에서 경로 열기|Ouvrir dans Plans Apple|Route in Apple Karten öffnen|Abrir rota no Apple Maps|Rotayı Apple Haritalar’da aç
Начать навигацию в Google Maps|بدء الملاحة في Google Maps|Mulai navigasi di Google Maps|เริ่มนำทางใน Google Maps|在Google地图中开始导航|Google 지도에서 길 안내 시작|Démarrer dans Google Maps|Navigation in Google Maps starten|Navegar com Google Maps|Google Haritalar’da navigasyonu başlat
Скриншот подтверждения оплаты|لقطة شاشة لتأكيد الدفع|Tangkapan layar konfirmasi pembayaran|ภาพหน้าจอยืนยันชำระเงิน|付款确认截图|결제 확인 화면 캡처|Capture de confirmation du paiement|Screenshot der Zahlungsbestätigung|Captura de confirmação do pagamento|Ödeme onayı ekran görüntüsü
Выбранный скриншот перевода|صورة التحويل المختارة|Tangkapan layar transfer terpilih|ภาพหน้าจอการโอนที่เลือก|已选转账截图|선택한 이체 화면 캡처|Capture du virement sélectionnée|Ausgewählter Überweisungsbeleg|Captura da transferência selecionada|Seçilen havale ekran görüntüsü
Чек отклонён. Проверьте перевод и прикрепите другой скриншот.|رُفض الإيصال. تحقق من التحويل وأرفق صورة أخرى.|Bukti ditolak. Periksa transfer dan lampirkan tangkapan layar lain.|หลักฐานถูกปฏิเสธ ตรวจสอบการโอนและแนบภาพใหม่|凭证被拒绝。请核对转账并上传其他截图。|영수증이 거절되었습니다. 이체를 확인하고 다른 화면 캡처를 첨부하세요.|Justificatif refusé. Vérifiez le virement et joignez une autre capture.|Beleg abgelehnt. Überweisung prüfen und anderen Screenshot anhängen.|Comprovativo rejeitado. Verifique a transferência e anexe outra captura.|Dekont reddedildi. Havaleyi kontrol edin ve başka görüntü ekleyin.
Не удалось прочитать фото. Выберите его ещё раз.|تعذّرت قراءة الصورة. اخترها مجدداً.|Foto tidak terbaca. Pilih lagi.|อ่านรูปไม่สำเร็จ กรุณาเลือกอีกครั้ง|无法读取照片，请重新选择。|사진을 읽지 못했습니다. 다시 선택하세요.|Photo illisible. Sélectionnez-la à nouveau.|Foto konnte nicht gelesen werden. Erneut auswählen.|Não foi possível ler a foto. Selecione novamente.|Fotoğraf okunamadı. Tekrar seçin.
Ответ задерживается. Откройте оплату ещё раз, чтобы проверить отправку чека.|تأخر الرد. افتح الدفع مجدداً للتحقق من إرسال الإيصال.|Respons tertunda. Buka pembayaran lagi untuk memeriksa pengiriman bukti.|การตอบกลับล่าช้า เปิดชำระเงินอีกครั้งเพื่อตรวจสอบการส่งหลักฐาน|响应延迟。请重新打开付款以确认凭证是否已发送。|응답이 지연됩니다. 결제를 다시 열어 영수증 전송을 확인하세요.|Réponse retardée. Rouvrez le paiement pour vérifier l’envoi du justificatif.|Antwort verzögert. Zahlung erneut öffnen, um den Belegversand zu prüfen.|Resposta demorada. Reabra o pagamento para verificar o envio do comprovativo.|Yanıt gecikiyor. Dekont gönderimini kontrol etmek için ödemeyi tekrar açın.
Чек отправляется…|جارٍ إرسال الإيصال…|Mengirim bukti…|กำลังส่งหลักฐาน…|正在发送凭证…|영수증 전송 중…|Envoi du justificatif…|Beleg wird gesendet…|A enviar comprovativo…|Dekont gönderiliyor…
Некорректные реквизиты|بيانات الدفع غير صحيحة|Detail pembayaran tidak valid|ข้อมูลชำระเงินไม่ถูกต้อง|收款信息无效|결제 정보가 잘못되었습니다|Coordonnées bancaires incorrectes|Ungültige Zahlungsdaten|Dados de pagamento inválidos|Geçersiz ödeme bilgileri
Открыть QR и сохранить изображение|فتح QR وحفظ الصورة|Buka QR dan simpan gambar|เปิด QR และบันทึกภาพ|打开二维码并保存图片|QR 열기 및 이미지 저장|Ouvrir le QR et enregistrer l’image|QR öffnen und Bild speichern|Abrir QR e guardar imagem|QR kodunu aç ve görseli kaydet
Не удалось получить ссылку на QR|تعذّر الحصول على رابط QR|Gagal mendapatkan tautan QR|รับลิงก์ QR ไม่สำเร็จ|无法获取二维码链接|QR 링크를 가져오지 못했습니다|Impossible d’obtenir le lien QR|QR-Link konnte nicht abgerufen werden|Não foi possível obter o link QR|QR bağlantısı alınamadı
Не удалось подготовить QR|تعذّر إعداد QR|Gagal menyiapkan QR|เตรียม QR ไม่สำเร็จ|无法生成二维码|QR을 준비하지 못했습니다|Impossible de préparer le QR|QR konnte nicht erstellt werden|Não foi possível preparar o QR|QR hazırlanamadı
Заказ изменился. Закройте оплату и откройте её снова.|تغيّر الطلب. أغلق الدفع وافتحه مجدداً.|Pesanan berubah. Tutup dan buka pembayaran lagi.|คำสั่งซื้อเปลี่ยนแล้ว ปิดและเปิดชำระเงินอีกครั้ง|订单已变更，请关闭付款后重新打开。|주문이 변경되었습니다. 결제를 닫고 다시 여세요.|Commande modifiée. Fermez et rouvrez le paiement.|Bestellung geändert. Zahlung schließen und erneut öffnen.|O pedido mudou. Feche e reabra o pagamento.|Sipariş değişti. Ödemeyi kapatıp tekrar açın.
QR готов. Нажмите «Сохранить QR» ещё раз.|QR جاهز. اضغط «حفظ رمز QR» مجدداً.|QR siap. Ketuk Simpan QR lagi.|QR พร้อมแล้ว กดบันทึก QR อีกครั้ง|二维码已就绪，请再次点击保存二维码。|QR이 준비되었습니다. QR 저장을 다시 누르세요.|QR prêt. Appuyez à nouveau sur Enregistrer le QR.|QR bereit. Erneut auf QR speichern tippen.|QR pronto. Toque novamente em Guardar QR.|QR hazır. QR kaydet’e tekrar dokunun.
Подтвердите скачивание в Telegram. Если окно не появилось, используйте ссылку ниже.|أكّد التنزيل في Telegram. إن لم تظهر النافذة فاستخدم الرابط أدناه.|Konfirmasi unduhan di Telegram. Jika jendela tidak muncul, gunakan tautan di bawah.|ยืนยันดาวน์โหลดใน Telegram หากไม่มีหน้าต่างให้ใช้ลิงก์ด้านล่าง|请在Telegram中确认下载。如未弹出窗口，请使用下方链接。|Telegram에서 다운로드를 확인하세요. 창이 뜨지 않으면 아래 링크를 이용하세요.|Confirmez le téléchargement dans Telegram. Sinon, utilisez le lien ci-dessous.|Download in Telegram bestätigen. Falls kein Fenster erscheint, Link unten nutzen.|Confirme a transferência no Telegram. Se não surgir a janela, use o link abaixo.|Telegram’da indirmeyi onaylayın. Pencere açılmazsa aşağıdaki bağlantıyı kullanın.
Скачивание запрошено. После загрузки выберите QR в банке.|طُلب التنزيل. بعد الحفظ اختر QR في تطبيق البنك.|Unduhan diminta. Setelah tersimpan, pilih QR di aplikasi bank.|ส่งคำขอดาวน์โหลดแล้ว หลังบันทึกให้เลือก QR ในแอปธนาคาร|已请求下载。下载后请在银行应用中选择二维码。|다운로드를 요청했습니다. 저장 후 은행 앱에서 QR을 선택하세요.|Téléchargement demandé. Sélectionnez ensuite le QR dans votre banque.|Download angefordert. Danach den QR in der Bank-App wählen.|Transferência pedida. Depois selecione o QR no banco.|İndirme istendi. Kaydettikten sonra bankada QR kodunu seçin.
Сохранение отменено. Можно повторить или открыть изображение по ссылке ниже.|أُلغي الحفظ. حاول مجدداً أو افتح الصورة بالرابط أدناه.|Penyimpanan dibatalkan. Coba lagi atau buka gambar melalui tautan di bawah.|ยกเลิกการบันทึกแล้ว ลองอีกครั้งหรือเปิดภาพจากลิงก์ด้านล่าง|保存已取消。可重试或通过下方链接打开图片。|저장이 취소되었습니다. 다시 시도하거나 아래 링크로 이미지를 여세요.|Enregistrement annulé. Réessayez ou ouvrez l’image avec le lien ci-dessous.|Speichern abgebrochen. Erneut versuchen oder Bild über den Link unten öffnen.|Gravação cancelada. Tente de novo ou abra a imagem pelo link abaixo.|Kaydetme iptal edildi. Tekrar deneyin veya aşağıdaki bağlantıdan görseli açın.
Открыта загрузка QR. Если она не началась, нажмите ссылку ниже.|فُتح تنزيل QR. إن لم يبدأ فاضغط الرابط أدناه.|Unduhan QR dibuka. Jika belum mulai, ketuk tautan di bawah.|เปิดดาวน์โหลด QR แล้ว หากไม่เริ่มให้กดลิงก์ด้านล่าง|二维码下载已打开。如未开始，请点击下方链接。|QR 다운로드가 열렸습니다. 시작되지 않으면 아래 링크를 누르세요.|Téléchargement QR ouvert. Sinon, cliquez sur le lien ci-dessous.|QR-Download geöffnet. Falls er nicht startet, Link unten wählen.|Download do QR aberto. Se não começar, toque no link abaixo.|QR indirmesi açıldı. Başlamadıysa aşağıdaki bağlantıya dokunun.
Не удалось сохранить QR|تعذّر حفظ QR|Gagal menyimpan QR|บันทึก QR ไม่สำเร็จ|无法保存二维码|QR을 저장하지 못했습니다|Impossible d’enregistrer le QR|QR konnte nicht gespeichert werden|Não foi possível guardar o QR|QR kaydedilemedi
Загружаем реквизиты…|جارٍ تحميل بيانات الدفع…|Memuat detail pembayaran…|กำลังโหลดข้อมูลชำระเงิน…|正在加载收款信息…|결제 정보 불러오는 중…|Chargement des coordonnées…|Zahlungsdaten werden geladen…|A carregar dados de pagamento…|Ödeme bilgileri yükleniyor…
Не удалось загрузить оплату|تعذّر تحميل الدفع|Gagal memuat pembayaran|โหลดการชำระเงินไม่สำเร็จ|无法加载付款|결제를 불러오지 못했습니다|Impossible de charger le paiement|Zahlung konnte nicht geladen werden|Não foi possível carregar o pagamento|Ödeme yüklenemedi
Передвиньте карту или нажмите на нужное здание. Затем подтвердите точку.|حرّك الخريطة أو اضغط المبنى المطلوب ثم أكّد النقطة.|Geser peta atau ketuk bangunan yang dituju, lalu konfirmasi titik.|เลื่อนแผนที่หรือกดอาคารที่ต้องการ แล้วยืนยันจุด|移动地图或点击所需建筑，然后确认地点。|지도를 이동하거나 건물을 누른 후 위치를 확인하세요.|Déplacez la carte ou touchez le bâtiment, puis confirmez.|Karte verschieben oder Gebäude antippen, dann Punkt bestätigen.|Mova o mapa ou toque no edifício e confirme o ponto.|Haritayı kaydırın veya binaya dokunun, sonra noktayı onaylayın.
Карта не загрузилась. Закройте окно и введите адрес вручную либо повторите позже.|لم تُحمّل الخريطة. أغلق النافذة وأدخل العنوان يدوياً أو حاول لاحقاً.|Peta gagal dimuat. Tutup dan masukkan alamat manual atau coba nanti.|โหลดแผนที่ไม่สำเร็จ ปิดหน้าต่างและกรอกที่อยู่เอง หรือลองภายหลัง|地图加载失败。请关闭窗口并手动输入地址，或稍后重试。|지도를 불러오지 못했습니다. 창을 닫고 주소를 직접 입력하거나 나중에 시도하세요.|Carte non chargée. Fermez et saisissez l’adresse ou réessayez plus tard.|Karte nicht geladen. Fenster schließen und Adresse eingeben oder später versuchen.|O mapa não carregou. Feche e introduza a morada ou tente mais tarde.|Harita yüklenemedi. Pencereyi kapatıp adresi girin veya sonra deneyin.
Не удалось определить точку. Выберите её на карте.|تعذّر تحديد الموقع. اختره على الخريطة.|Lokasi tidak ditemukan. Pilih di peta.|ระบุตำแหน่งไม่สำเร็จ กรุณาเลือกบนแผนที่|无法确定位置，请在地图上选择。|위치를 찾지 못했습니다. 지도에서 선택하세요.|Position introuvable. Choisissez-la sur la carte.|Standort nicht ermittelt. Auf Karte wählen.|Não foi possível localizar. Escolha no mapa.|Konum belirlenemedi. Haritada seçin.
Не удалось получить геолокацию. Проверьте разрешение или поставьте точку вручную.|تعذّر تحديد الموقع. تحقق من الأذونات أو حدده يدوياً.|Gagal mendapatkan lokasi. Periksa izin atau pilih titik manual.|รับตำแหน่งไม่สำเร็จ ตรวจสอบสิทธิ์หรือเลือกจุดเอง|无法获取位置。请检查权限或手动选择地点。|위치를 가져오지 못했습니다. 권한을 확인하거나 직접 선택하세요.|Position inaccessible. Vérifiez les autorisations ou placez le repère.|Standort nicht verfügbar. Berechtigungen prüfen oder Punkt manuell setzen.|Não foi possível obter a localização. Verifique as permissões ou marque manualmente.|Konum alınamadı. İzinleri kontrol edin veya elle nokta seçin.
Определяем ваше местоположение…|جارٍ تحديد موقعك…|Mencari lokasi Anda…|กำลังค้นหาตำแหน่งของคุณ…|正在获取您的位置…|현재 위치 찾는 중…|Recherche de votre position…|Ihr Standort wird ermittelt…|A encontrar a sua localização…|Konumunuz belirleniyor…
Не удалось выбрать кафе. Выберите его вручную.|تعذّر اختيار المقهى. اختره يدوياً.|Gagal memilih kafe. Pilih secara manual.|เลือกร้านไม่สำเร็จ กรุณาเลือกเอง|无法选择餐厅，请手动选择。|카페를 선택하지 못했습니다. 직접 선택하세요.|Impossible de choisir le café. Sélectionnez-le manuellement.|Café konnte nicht gewählt werden. Bitte manuell auswählen.|Não foi possível escolher o café. Escolha manualmente.|Kafe seçilemedi. Elle seçin.
Максимум 99 единиц одного блюда|الحد الأقصى 99 من كل طبق|Maksimal 99 porsi per hidangan|สูงสุด 99 ชิ้นต่อรายการ|每道菜最多99份|메뉴당 최대 99개|Maximum 99 portions par plat|Maximal 99 pro Gericht|Máximo de 99 por prato|Her yemekten en fazla 99 adet
Наличными в кафе|نقداً في المقهى|Tunai di kafe|เงินสดที่ร้าน|到店现金付款|카페에서 현금 결제|Espèces au café|Bar im Café|Dinheiro no café|Kafede nakit
QR-оплата заранее либо наличными курьеру при получении.|الدفع مسبقاً برمز QR أو نقداً للمندوب عند الاستلام.|Bayar QR di muka atau tunai ke kurir saat diterima.|ชำระด้วย QR ล่วงหน้า หรือจ่ายเงินสดให้พนักงานเมื่อรับ|提前扫码付款，或收货时向骑手支付现金。|QR로 선결제하거나 수령 시 배달원에게 현금으로 결제하세요.|Paiement QR à l’avance ou espèces au livreur à réception.|Vorab per QR oder bar beim Kurier bezahlen.|QR antecipado ou dinheiro ao estafeta na entrega.|Önceden QR ile veya teslimatta kuryeye nakit ödeme.
Для заказа с собой оплата производится сразу.|تُدفع الطلبات السفرية مسبقاً.|Pesanan bawa pulang dibayar di muka.|สั่งกลับบ้านต้องชำระทันที|自取订单需提前付款。|포장 주문은 선결제입니다.|Les commandes à emporter se paient à l’avance.|Bestellungen zum Mitnehmen werden vorab bezahlt.|Pedidos para levar são pagos antecipadamente.|Paket siparişler önceden ödenir.
В кафе можно оплатить сразу или после трапезы.|يمكن الدفع في المقهى الآن أو بعد الوجبة.|Makan di tempat bisa dibayar sekarang atau setelah makan.|ทานที่ร้านชำระทันทีหรือหลังอาหารได้|堂食可立即付款或用餐后付款。|매장에서는 바로 결제하거나 식사 후 결제할 수 있습니다.|Sur place, payez maintenant ou après le repas.|Im Café können Sie sofort oder nach dem Essen bezahlen.|No café, pode pagar agora ou após a refeição.|Kafede hemen veya yemekten sonra ödeyebilirsiniz.
Оплата позже возможна только в кафе|الدفع لاحقاً متاح داخل المقهى فقط|Bayar nanti hanya untuk makan di tempat|ชำระภายหลังได้เฉพาะทานที่ร้าน|仅堂食支持后付款|후불은 매장 식사만 가능합니다|Paiement différé uniquement sur place|Später zahlen nur im Café möglich|Pagar depois apenas no café|Sonradan ödeme yalnız kafede mümkündür
Не удалось прочитать файл|تعذّرت قراءة الملف|Gagal membaca berkas|อ่านไฟล์ไม่สำเร็จ|无法读取文件|파일을 읽지 못했습니다|Impossible de lire le fichier|Datei konnte nicht gelesen werden|Não foi possível ler o ficheiro|Dosya okunamadı
Ошибка отправки|خطأ في الإرسال|Kesalahan pengiriman|ส่งไม่สำเร็จ|发送错误|전송 오류|Erreur d’envoi|Sendefehler|Erro de envio|Gönderim hatası
Статус: ожидает подтверждения кафе.|الحالة: بانتظار تأكيد المقهى.|Status: menunggu konfirmasi kafe.|สถานะ: รอร้านยืนยัน|状态：等待餐厅确认。|상태: 카페 확인 대기.|Statut : confirmation du café attendue.|Status: Café-Bestätigung ausstehend.|Estado: a aguardar confirmação do café.|Durum: kafe onayı bekleniyor.
Внимание: уведомление сотрудникам не подтверждено. Свяжитесь с кафе, если заказ срочный.|لم يُؤكّد إشعار الموظفين. اتصل بالمقهى إن كان الطلب عاجلاً.|Notifikasi staf belum terkonfirmasi. Hubungi kafe jika pesanan mendesak.|ยังไม่ยืนยันการแจ้งพนักงาน ติดต่อร้านหากคำสั่งซื้อเร่งด่วน|尚未确认已通知员工。如订单紧急，请联系餐厅。|직원 알림이 확인되지 않았습니다. 급한 주문은 카페에 연락하세요.|Notification du personnel non confirmée. Contactez le café si c’est urgent.|Personalbenachrichtigung nicht bestätigt. Bei dringenden Bestellungen Café kontaktieren.|Notificação do pessoal não confirmada. Contacte o café se for urgente.|Çalışan bildirimi onaylanmadı. Sipariş acilse kafeyle iletişime geçin.
QR с суммой заказа готов. Оплату подтвердит кафе после поступления денег.|رمز QR بمبلغ الطلب جاهز. يؤكّد المقهى الدفع بعد وصول المال.|QR dengan jumlah pesanan siap. Kafe mengonfirmasi setelah uang diterima.|QR พร้อมยอดคำสั่งซื้อแล้ว ร้านจะยืนยันเมื่อได้รับเงิน|已生成订单金额二维码。餐厅收到款项后会确认付款。|주문 금액 QR이 준비되었습니다. 입금 후 카페에서 확인합니다.|QR du montant prêt. Le café confirmera à réception des fonds.|QR mit Bestellbetrag bereit. Café bestätigt nach Geldeingang.|QR com o valor pronto. O café confirma após receber o dinheiro.|Sipariş tutarlı QR hazır. Para ulaştığında kafe ödemeyi onaylar.
Переведите сумму по реквизитам, полученным от кафе. Приложите скриншот перевода. Оплату подтвердит сотрудник после проверки поступления денег.|حوّل المبلغ إلى حساب المقهى وأرفق لقطة التحويل. يؤكّد الموظف الدفع بعد التحقق من وصول المال.|Transfer sesuai detail bank dari kafe dan lampirkan tangkapan layar. Staf mengonfirmasi setelah memeriksa uang masuk.|โอนตามข้อมูลธนาคารจากร้านและแนบภาพหน้าจอ พนักงานจะยืนยันหลังตรวจสอบเงินเข้า|请按餐厅提供的收款信息转账并上传截图。员工核实到账后会确认付款。|카페가 제공한 계좌로 이체하고 화면 캡처를 첨부하세요. 직원이 입금을 확인합니다.|Virez le montant aux coordonnées du café et joignez une capture. Le personnel confirmera les fonds reçus.|An die Bankdaten des Cafés überweisen und Screenshot anhängen. Personal bestätigt nach Geldeingangsprüfung.|Transfira para os dados do café e anexe uma captura. O funcionário confirma após verificar o recebimento.|Kafenin banka bilgilerine havale yapıp ekran görüntüsü ekleyin. Çalışan paranın ulaştığını kontrol ederek onaylar.
Борщ|بورش|Borscht|บอร์ช|罗宋汤|보르시|Bortsch|Borschtsch|Borscht|Borş
Плов с бараниной|بلاو بلحم الضأن|Plov daging domba|พลอฟเนื้อแกะ|羊肉抓饭|양고기 플로프|Plov à l’agneau|Plow mit Lamm|Plov de borrego|Kuzu etli pilav
Манты (4 шт.)|مانتي (4 قطع)|Manti (4 buah)|มันตี (4 ชิ้น)|曼特蒸饺（4个）|만티 (4개)|Manty (4 pièces)|Manti (4 Stück)|Manti (4 unidades)|Mantı (4 adet)
Салат Ачичук|سلطة أتشيتشوك|Salad Achichuk|สลัดอาชิชุก|阿奇丘克沙拉|아치추크 샐러드|Salade Achichouk|Achichuk-Salat|Salada Achichuk|Açıçuk salatası
Хачапури с сыром|خاتشابوري بالجبن|Khachapuri keju|คาชาปูรีไส้ชีส|奶酪哈恰普里|치즈 하차푸리|Khatchapouri au fromage|Chatschapuri mit Käse|Khachapuri de queijo|Peynirli haçapuri
Айран турецкий|عيران تركي|Ayran Turki|อัยรันตุรกี|土耳其咸酸奶|터키식 아이란|Ayran turc|Türkischer Ayran|Ayran turco|Türk ayranı
Чай чёрный с лимоном|شاي أسود بالليمون|Teh hitam dengan lemon|ชาดำมะนาว|柠檬红茶|레몬 홍차|Thé noir au citron|Schwarzer Tee mit Zitrone|Chá preto com limão|Limonlu siyah çay
Основные разделы|الأقسام الرئيسية|Bagian utama|เมนูหลัก|主要栏目|주요 메뉴|Rubriques principales|Hauptbereiche|Secções principais|Ana bölümler
Онлайн|متصل|Online|ออนไลน์|在线|온라인|En ligne|Online|Ligado|Çevrimiçi
Связь прервана|انقطع الاتصال|Koneksi terputus|การเชื่อมต่อขาดหาย|连接中断|연결 끊김|Connexion perdue|Verbindung unterbrochen|Ligação perdida|Bağlantı kesildi
Онлайн: автоматическое обновление включено|متصل: التحديث التلقائي مفعّل|Online: pembaruan otomatis aktif|ออนไลน์: เปิดอัปเดตอัตโนมัติแล้ว|在线：已启用自动更新|온라인: 자동 업데이트 켜짐|En ligne : actualisation automatique activée|Online: automatische Aktualisierung aktiv|Ligado: atualização automática ativa|Çevrimiçi: otomatik güncelleme açık
Связь прервана: повторяем подключение|انقطع الاتصال: جارٍ إعادة الاتصال|Koneksi terputus: menyambungkan kembali|ขาดการเชื่อมต่อ: กำลังเชื่อมต่อใหม่|连接中断：正在重连|연결 끊김: 다시 연결 중|Connexion perdue : reconnexion|Verbindung unterbrochen: erneuter Verbindungsaufbau|Ligação perdida: a voltar a ligar|Bağlantı kesildi: yeniden bağlanıyor
Управление Umma Global|إدارة UMMA Global|Kelola UMMA Global|จัดการ UMMA Global|管理UMMA Global|UMMA Global 관리|Gérer UMMA Global|UMMA Global verwalten|Gerir UMMA Global|UMMA Global yönetimi
Туры, билеты и маршруты|الجولات والتذاكر والمسارات|Tur, tiket dan rute|ทัวร์ ตั๋วและเส้นทาง|旅游、票务与路线|투어, 티켓 및 경로|Circuits, billets et itinéraires|Touren, Tickets und Routen|Passeios, bilhetes e rotas|Turlar, biletler ve rotalar
`;
 const catalogue=Object.create(null);
 for(const line of rows.trim().split('\n')){
  const [source,...values]=line.split('|');if(values.length!==codes.length||values.some(x=>!x))throw Error('Incomplete language row: '+source);
  catalogue[source]=Object.fromEntries(codes.map((code,index)=>[code,values[index]]));
 }
 for(const [source,values] of Object.entries(window.ummaExtraTranslations||{}))catalogue[source]={...catalogue[source],...values};
 const allCodes=[...codes,...Object.keys(window.ummaExtraLanguages||{})];
 const dishAliases={"Салат Оливье":"Оливье","Салат Винегрет":"Винегрет"};
 for(const [source,target] of Object.entries(dishAliases))catalogue[source]={...catalogue[target],...catalogue[source]};
 const aliases={"Нет заказов": "У вас пока нет заказов.", "Заказов пока нет.": "У вас пока нет заказов.", "Школа, медресе и университет": "Школа, медресе, университет", "Ошибка оформления заказа": "Не удалось оформить заказ", "Ошибка загрузки меню": "Не удалось загрузить меню", "Чек отправлен. Ожидайте подтверждения сотрудником кафе.": "Скриншот отправлен. Ожидайте проверки кафе.", "Курьер принял заказ": "У курьера", "Профиль Telegram": "Ваш профиль Telegram", "Не удалось отправить чек": "Не удалось отправить чек. Попробуйте ещё раз.", "Проверьте точку и подтвердите доставку сюда.": "Проверьте точку и нажмите «Доставить сюда».", "Доступ к геолокации недоступен. Поставьте точку на карте вручную.": "Геолокация недоступна. Поставьте точку на карте вручную.", "Скачать QR": "Сохранить QR", "Отправить скриншот": "Отправить чек"};
 for(const [source,target] of Object.entries(aliases))catalogue[source]={...catalogue[target],...catalogue[source]};
 for(const [source,target] of [["🥡 С собой","С собой"],["🛵 Доставка","Доставка"],["🍳 Кухня","Кухня"],["📋 Приём заказов","Приём заказов"],["＋ Оформить заказ","Оформить заказ"]]){const prefix=source.slice(0,source.indexOf(" ")+1);catalogue[source]=Object.fromEntries(allCodes.filter(code=>catalogue[target][code]).map(code=>[code,prefix+catalogue[target][code]]));}
 window.ummaLanguages=Object.freeze(Object.fromEntries(Object.entries({...metadata,...window.ummaExtraLanguages}).map(([code,value])=>[code,Object.freeze(value)])));
 window.ummaAdditionalTranslations=catalogue;
})();
