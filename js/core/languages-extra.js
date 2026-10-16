/* Additional local catalogues: Turkmen, Tajik, Uzbek (Latin), Japanese and Uyghur (Arabic). */
(() => {
 'use strict';
 window.ummaExtraLanguages={
  tk:{name:'Türkmençe',locale:'tk-TM',title:'Programma dili',choose:'Dil saýlaň',auto:'Awtomatik · Telegram / enjam',items:'{n} önüm'},
  tg:{name:'Тоҷикӣ',locale:'tg-TJ',title:'Забони барнома',choose:'Интихоби забон',auto:'Худкор · Telegram / дастгоҳ',items:'{n} номгӯй'},
  uz:{name:'O‘zbekcha',locale:'uz-Latn-UZ',title:'Ilova tili',choose:'Tilni tanlang',auto:'Avtomatik · Telegram / qurilma',items:'{n} ta mahsulot'},
  ja:{name:'日本語',locale:'ja-JP',title:'アプリの言語',choose:'言語を選択',auto:'自動 · Telegram / 端末',items:'{n}品'},
  ug:{name:'ئۇيغۇرچە',locale:'ug-CN',dir:'rtl',title:'ئەپ تىلى',choose:'تىل تاللاش',auto:'ئاپتوماتىك · Telegram / ئۈسكۈنە',items:'{n} تۈر'}
 };
 const codes=['tk','tg','uz','ja','ug'];
 // Source | Turkmen | Tajik | Uzbek | Japanese | Uyghur.
 const rows=`
Главная|Baş sahypa|Асосӣ|Bosh sahifa|ホーム|باش بەت
Ещё|Goşmaça|Бештар|Yana|その他|تېخىمۇ كۆپ
Кафе|Kafe|Кафе|Kafe|カフェ|ئاشخانا
Кафе UMMA|UMMA kafesi|Кафеи UMMA|UMMA kafesi|UMMAカフェ|UMMA ئاشخانىسى
Кафе Umma|UMMA kafesi|Кафеи UMMA|UMMA kafesi|UMMAカフェ|UMMA ئاشخانىسى
Мои заказы|Sargytlarym|Фармоишҳои ман|Buyurtmalarim|注文履歴|زاكازلىرىم
Заказы|Sargytlar|Фармоишҳо|Buyurtmalar|注文|زاكازلار
События|Çäreler|Чорабиниҳо|Tadbirlar|イベント|پائالىيەتلەر
Подключаемся…|Birikdirilýär…|Пайвастшавӣ…|Ulanmoqda…|接続中…|ئۇلىنىۋاتىدۇ…
Ассаляму алейкум ва рахматуллахи ва баракатух,|Essalawmaleýkim we rahmetullahi we berekätuh,|Ассалому алайкум ва раҳматуллоҳи ва баракотуҳ,|Assalomu alaykum va rahmatullohi va barokatuh,|アッサラーム・アライクム・ワ・ラフマトゥッラーヒ・ワ・バラカートゥフ|ئەسسالامۇ ئەلەيكۇم ۋە رەھمەتۇللاھى ۋە بەرەكاتۇھۇ،
Ассаляму алейкум|Essalawmaleýkim|Ассалому алайкум|Assalomu alaykum|アッサラーム・アライクム|ئەسسالامۇ ئەلەيكۇم
ва рахматуллахи ва баракатух,|we rahmetullahi we berekätuh,|ва раҳматуллоҳи ва баракотуҳ,|va rahmatullohi va barokatuh,|ワ・ラフマトゥッラーヒ・ワ・バラカートゥフ|ۋە رەھمەتۇللاھى ۋە بەرەكاتۇھۇ،
ва рахматуллахи ва баракатух!|we rahmetullahi we berekätuh!|ва раҳматуллоҳи ва баракотуҳ!|va rahmatullohi va barokatuh!|ワ・ラフマトゥッラーヒ・ワ・バラカートゥフ！|ۋە رەھمەتۇللاھى ۋە بەرەكاتۇھۇ!
УММА!|UMMA!|UMMA!|UMMA!|UMMA！|UMMA!
Единая экосистема для жизни,|Durmuş üçin bitewi ekoulgam,|Низоми ягона барои зиндагӣ,|Hayot uchun yagona ekotizim,|暮らし、ビジネス、|تۇرمۇش، سودا ۋە
бизнеса и общества.|işewürlik we jemgyýet üçin.|тиҷорат ва ҷомеа.|biznes va jamiyat uchun.|コミュニティをつなぐエコシステム。|جەمئىيەت ئۈچۈن بىر گەۋدىلەشكەن سىستېما.
Открыть кафе|Kafeni aç|Каферо кушодан|Kafeni ochish|カフェを開く|ئاشخانىنى ئېچىش
Сервисы Umma|UMMA hyzmatlary|Хизматҳои UMMA|UMMA xizmatlari|UMMAサービス|UMMA مۇلازىمەتلىرى
Все сервисы →|Ähli hyzmatlar →|Ҳамаи хизматҳо →|Barcha xizmatlar →|すべてのサービス →|بارلىق مۇلازىمەتلەر ←
Рынок Umma|UMMA bazary|Бозори UMMA|UMMA bozori|UMMAマーケット|UMMA بازىرى
Продукты и товары|Azyk we harytlar|Маҳсулоти хӯрокворӣ ва молҳо|Oziq-ovqat va mahsulotlar|食品・商品|يېمەكلىك ۋە مەھسۇلاتلار
Путешествия|Syýahat|Саёҳат|Sayohat|旅行|ساياھەت
Туры, билеты, отели|Syýahatlar, petekler, myhmanhanalar|Саёҳатҳо, чиптаҳо, меҳмонхонаҳо|Turlar, chiptalar, mehmonxonalar|ツアー・チケット・ホテル|ساياھەت، بېلەت، مېھمانخانا
Отели Umma|UMMA myhmanhanalary|Меҳмонхонаҳои UMMA|UMMA mehmonxonalari|UMMAホテル|UMMA مېھمانخانىلىرى
Проживание по миру|Dünýä boýunça ýaşaýyş|Иқомат дар саросари ҷаҳон|Dunyo bo‘ylab turar joy|世界各地の宿泊施設|دۇنيانىڭ ھەرقايسى جايلىرىدىكى تۇرالغۇ
Недвижимость|Gozgalmaýan emläk|Амволи ғайриманқул|Ko‘chmas mulk|不動産|كۆچمەس مۈلۈك
Жильё, аренда, инвестиции|Ýaşaýyş jaýy, kärende, maýa goýum|Манзил, иҷора, сармоягузорӣ|Uy-joy, ijara, investitsiya|住まい・賃貸・投資|تۇرالغۇ، ئىجارە، مەبلەغ سېلىش
Сообщество|Jemgyýet|Ҷомеа|Hamjamiyat|コミュニティ|جامائەت
Люди, помощь и связи|Adamlar, kömek we aragatnaşyk|Одамон, ёрӣ ва робитаҳо|Odamlar, yordam va aloqalar|人・助け合い・つながり|كىشىلەر، ياردەم ۋە ئالاقە
Бизнес|Işewürlik|Тиҷорат|Biznes|ビジネス|سودا
Возможности и партнёрства|Mümkinçilikler we hyzmatdaşlyk|Имкониятҳо ва ҳамкорӣ|Imkoniyatlar va hamkorlik|機会・パートナーシップ|پۇرسەت ۋە ھەمكارلىق
Образование|Bilim|Маориф|Ta’lim|教育|مائارىپ
Школа, медресе, университет|Mekdep, medrese, uniwersitet|Мактаб, мадраса, донишгоҳ|Maktab, madrasa, universitet|学校・マドラサ・大学|مەكتەپ، مەدرىسە، ئۇنىۋېرسىتېت
Здоровье|Saglyk|Саломатӣ|Salomatlik|健康|ساغلاملىق
Спорт и здоровый образ жизни|Sport we sagdyn durmuş|Варзиш ва тарзи ҳаёти солим|Sport va sog‘lom turmush|スポーツと健康的な暮らし|تەنتەربىيە ۋە ساغلام تۇرمۇش
Халяльное производство|Halal önümçilik|Истеҳсоли ҳалол|Halol ishlab chiqarish|ハラール生産|ھالال ئىشلەپچىقىرىش
и натуральные продукты|we tebigy önümler|ва маҳсулоти табиӣ|va tabiiy mahsulotlar|と自然食品|ۋە تەبىئىي مەھسۇلاتلار
Подробнее|Giňişleýin|Муфассал|Batafsil|詳しく見る|تەپسىلاتى
← Назад|← Yza|← Бозгашт|← Orqaga|← 戻る|قايتىش →
Назад|Yza|Бозгашт|Orqaga|戻る|قايتىش
← Главная|← Baş sahypa|← Асосӣ|← Bosh sahifa|← ホーム|باش بەت →
← К заказам|← Sargytlara|← Ба фармоишҳо|← Buyurtmalarga|← 注文へ|زاكازلارغا →
← Назад к заказу|← Sargyda dolan|← Бозгашт ба фармоиш|← Buyurtmaga qaytish|← 注文に戻る|زاكازغا قايتىش →
← Вернуться к меню|← Menýuwa dolan|← Бозгашт ба меню|← Menyuga qaytish|← メニューに戻る|تاماق تىزىملىكىگە قايتىش →
Мы кормим людей|Biz adamlary naharlaýarys|Мо мардумро ғизо медиҳем|Biz odamlarga taom beramiz|私たちは人々に食事を届けます|بىز كىشىلەرگە تاماق بېرىمىز
ради довольства Аллаха|Allanyň razylygy üçin|барои ризои Аллоҳ|Allohning roziligi uchun|アッラーのご満悦を求めて|ئاللاھنىڭ رازىلىقى ئۈچۈن
ПРИГОТОВЛЕНО С ЗАБОТОЙ|YHLAS BILEN TAÝÝARLANYLDY|БО ҒАМХОРӢ ОМОДА ШУДААСТ|MEHR BILAN TAYYORLANGAN|心を込めて調理|كۆڭۈل قويۇپ تەييارلاندى
Наше меню|Menýumyz|Менюи мо|Menyumiz|メニュー|تاماق تىزىملىكىمىز
Найти блюдо|Nahary gözle|Ҷустуҷӯи таом|Taom qidirish|料理を検索|تاماق ئىزدەش
Сбросить|Arassala|Барқарор кардан|Tozalash|リセット|ئەسلىگە قايتۇرۇش
Показать всё меню|Ähli menýuny görkez|Намоиши тамоми меню|Barcha menyuni ko‘rsatish|全メニューを表示|بارلىق تاماقلارنى كۆرسىتىش
Загружаем меню…|Menýu ýüklenýär…|Меню бор шуда истодааст…|Menyu yuklanmoqda…|メニューを読み込み中…|تاماق تىزىملىكى يۈكلىنىۋاتىدۇ…
Ваш заказ|Sargydyňyz|Фармоиши шумо|Buyurtmangiz|ご注文|زاكازىڭىز
Посмотреть / изменить|Gör / üýtget|Дидан / тағйир додан|Ko‘rish / o‘zgartirish|確認・変更|كۆرۈش / ئۆزگەرتىش
Как получить заказ|Sargydy almagyň usuly|Тарзи гирифтани фармоиш|Buyurtmani olish usuli|受け取り方法|زاكازنى ئېلىش ئۇسۇلى
В кафе|Kafede|Дар кафе|Kafeda|店内飲食|ئاشخانىدا
С собой|Özüň bilen|Бо худ бурдан|Olib ketish|お持ち帰り|ئېلىپ كېتىش
Доставка|Eltip bermek|Расонидан|Yetkazib berish|配達|يەتكۈزۈش
Загружаем кафе…|Kafeler ýüklenýär…|Кафеҳо бор шуда истодаанд…|Kafelar yuklanmoqda…|カフェを読み込み中…|ئاشخانىلار يۈكلىنىۋاتىدۇ…
Выбрать другое кафе|Başga kafe saýla|Интихоби кафеи дигар|Boshqa kafe tanlash|別のカフェを選択|باشقا ئاشخانا تاللاش
Как выбрать кафе|Kafeni saýlamagyň usuly|Тарзи интихоби кафе|Kafeni tanlash usuli|カフェの選び方|ئاشخانا تاللاش ئۇسۇلى
Ближайшее кафе по геолокации|Ýerleşişe görä iň ýakyn kafe|Кафеи наздиктарин аз рӯи ҷойгиршавӣ|Joylashuv bo‘yicha eng yaqin kafe|現在地に最も近いカフェ|ئورۇن بويىچە ئەڭ يېقىن ئاشخانا
Выбрать кафе вручную|Kafeni el bilen saýla|Интихоби дастии кафе|Kafeni qo‘lda tanlash|カフェを手動で選択|ئاشخانىنى قولدا تاللاش
Кафе для заказа|Sargyt üçin kafe|Кафе барои фармоиш|Buyurtma uchun kafe|注文するカフェ|زاكاز قىلىدىغان ئاشخانا
Куда доставить?|Nirä eltmeli?|Ба куҷо расонем?|Qayerga yetkazamiz?|配達先はどちらですか？|قەيەرگە يەتكۈزەيلى؟
Указать на карте|Kartada görkez|Дар харита нишон додан|Xaritada ko‘rsatish|地図で選択|خەرىتىدە كۆرسىتىش
Убрать точку|Belligi aýyr|Нуқтаро нест кардан|Nuqtani olib tashlash|ピンを削除|نۇقتىنى ئۆچۈرۈش
Или введите адрес доставки|Ýa-da eltip beriş salgysyny giriziň|Ё суроғаи расониданро ворид кунед|Yoki yetkazish manzilini kiriting|または配達先住所を入力|ياكى يەتكۈزۈش ئادرېسىنى كىرگۈزۈڭ
Оплата|Töleg|Пардохт|To‘lov|お支払い|پۇل تۆلەش
Наличными|Nagt|Нақдӣ|Naqd pul|現金|نەق پۇل
QR-кодом|QR kod bilen|Бо рамзи QR|QR-kod orqali|QRコード|QR كود ئارقىلىق
Перевод на карту|Bank geçirmesi|Интиқоли бонкӣ|Bank o‘tkazmasi|銀行振込|بانكا ئارقىلىق پۇل يۆتكەش
Перевод на российский / казахстанский банк|Russiýa / Gazagystan bankyna geçirmek|Интиқол ба бонки Русия / Қазоқистон|Rossiya / Qozog‘iston bankiga o‘tkazma|ロシア・カザフスタンの銀行への振込|رۇسىيە / قازاقىستان بانكىسىغا پۇل يۆتكەش
Оплата курьеру при доставке|Alanyňyzda kurýere tölemek|Пардохт ба қосид ҳангоми қабул|Qabul qilishda kuryerga to‘lash|配達員に代金を支払う|تاپشۇرۇۋالغاندا يەتكۈزگۈچىگە تۆلەش
Контактные данные|Habarlaşmak üçin maglumat|Маълумоти тамос|Aloqa ma’lumotlari|連絡先|ئالاقىلىشىش ئۇچۇرلىرى
Ваш профиль Telegram|Telegram profiliňiz|Профили Telegram-и шумо|Telegram profilingiz|Telegramプロフィール|Telegram ئارخىپىڭىز
Изменить|Üýtget|Тағйир додан|O‘zgartirish|変更|ئۆزگەرتىش
Имя (необязательно)|Adyňyz (hökmany däl)|Ном (ихтиёрӣ)|Ism (ixtiyoriy)|お名前（任意）|ئىسىم (ئىختىيارىي)
Телефон (необязательно)|Telefon (hökmany däl)|Телефон (ихтиёрӣ)|Telefon (ixtiyoriy)|電話番号（任意）|تېلېفون (ئىختىيارىي)
Пожелания к заказу|Sargyt boýunça islegler|Хоҳишҳо ба фармоиш|Buyurtma bo‘yicha istaklar|ご要望|زاكاز ھەققىدىكى تەلەپلەر
Необязательно|Hökmany däl|Ихтиёрӣ|Ixtiyoriy|任意|ئىختىيارىي
Добавить|Goş|Илова кардан|Qo‘shish|追加|قوشۇش
Комментарий к заказу (необязательно)|Sargyt üçin bellik (hökmany däl)|Шарҳи фармоиш (ихтиёрӣ)|Buyurtma izohi (ixtiyoriy)|注文メモ（任意）|زاكاز ئىزاھاتى (ئىختىيارىي)
Оформить заказ|Sargyt et|Фармоиш додан|Buyurtma berish|注文する|زاكاز قىلىش
Перейти к заказу|Sargyda geç|Гузаштан ба фармоиш|Buyurtmaga o‘tish|注文を確認|زاكازغا ئۆتۈش
Загружаем ваши заказы…|Sargytlaryňyz ýüklenýär…|Фармоишҳои шумо бор шуда истодаанд…|Buyurtmalaringiz yuklanmoqda…|注文を読み込み中…|زاكازلىرىڭىز يۈكلىنىۋاتىدۇ…
↻ Обновить|↻ Täzele|↻ Навсозӣ|↻ Yangilash|↻ 更新|↻ يېڭىلاش
↻ Обновить меню|↻ Menýuny täzele|↻ Навсозии меню|↻ Menyuni yangilash|↻ メニューを更新|↻ تاماق تىزىملىكىنى يېڭىلاش
Итого|Jemi|Ҳамагӣ|Jami|合計|جەمئىي
Состав заказа|Sargydyň düzümi|Таркиби фармоиш|Buyurtma tarkibi|ご注文内容|زاكاز تەپسىلاتى
Сумма заказа|Sargyt möçberi|Маблағи фармоиш|Buyurtma summasi|注文金額|زاكاز سوممىسى
Добавьте блюда из меню.|Menýudan nahar goşuň.|Аз меню таом илова кунед.|Menyudan taom qo‘shing.|メニューから料理を追加してください。|تاماق تىزىملىكىدىن تاماق قوشۇڭ.
Супы|Çorbalar|Шӯрбоҳо|Sho‘rvalar|スープ|شورپىلار
Горячее|Esasy naharlar|Таомҳои асосӣ|Asosiy taomlar|メイン料理|ئاساسلىق تاماقلار
Салаты|Salatlar|Хӯришҳо|Salatlar|サラダ|سالاتلار
Выпечка|Hamyr önümleri|Нонпазӣ|Pishiriqlar|パン・焼き料理|پىشۇرۇقلار
Десерты|Süýjülikler|Шириниҳо|Shirinliklar|デザート|تاتلىق تۈرۈملەر
Напитки|Içgiler|Нӯшокиҳо|Ichimliklar|ドリンク|ئىچىملىكلەر
Соусы|Souslar|Чошниҳо|Souslar|ソース|قىيامлар
Другое|Beýlekiler|Дигар|Boshqa|その他|باشقىلار
Все|Hemmesi|Ҳама|Barchasi|すべて|ھەممىسى
Описание|Düşündiriş|Тавсиф|Tavsif|説明|چۈشەندۈرۈش
В заказе|Sargytda|Дар фармоиш|Buyurtmada|注文に追加済み|زاكازدا
Блюдо|Nahar|Таом|Taom|料理|تاماق
Халяль|Halal|Ҳалол|Halol|ハラール|ھالال
Уменьшить|Azalt|Кам кардан|Kamaytirish|減らす|ئازايتىش
Увеличить|Artdyr|Зиёд кардан|Ko‘paytirish|増やす|كۆپەيتىش
Новый|Täze|Нав|Yangi|新規|يېڭى
Принят|Kabul edildi|Қабул шуд|Qabul qilindi|受付済み|قوبۇل قىلىندى
Принят кафе|Kafe kabul etdi|Кафе қабул кард|Kafe qabul qildi|カフェが受付済み|ئاشخانا قوبۇل قىلدى
Готовится|Taýýarlanýar|Омода шуда истодааст|Tayyorlanmoqda|調理中|تەييارلىنىۋاتىدۇ
Готов|Taýýar|Омода|Tayyor|準備完了|تەييار
Готов к выдаче|Almak üçin taýýar|Барои гирифтан омода|Olib ketish uchun tayyor|お渡しできます|ئېلىشقا تەييار
Выдан|Gowşuryldy|Супорида шуд|Topshirildi|お渡し済み|تاپشۇرۇلدى
Завершён|Tamamlandy|Анҷом ёфт|Yakunlandi|完了|تاماملاندى
Отменён|Ýatyryldy|Бекор шуд|Bekor qilindi|キャンセル済み|بىكار قىلىندى
Не оплачен|Tölenmedi|Пардохт нашудааст|To‘lanmagan|未払い|تۆلەنمىدى
Оплачен|Tölendi|Пардохт шуд|To‘landi|支払い済み|تۆلەندى
Оплачено|Tölendi|Пардохт шуд|To‘landi|支払い済み|تۆلەندى
✓ Оплачено|✓ Tölendi|✓ Пардохт шуд|✓ To‘landi|✓ 支払い済み|✓ تۆلەندى
Ожидает оплаты|Tölege garaşylýar|Интизори пардохт|To‘lov kutilmoqda|お支払い待ち|پۇل تۆلەشنى كۈتۈۋاتىدۇ
Ожидается оплата|Tölege garaşylýar|Интизори пардохт|To‘lov kutilmoqda|お支払い待ち|پۇل تۆلەشنى كۈتۈۋاتىدۇ
Ожидает подтверждения|Tassyklama garaşylýar|Интизори тасдиқ|Tasdiq kutilmoqda|確認待ち|جەزملەشتۈرۈشنى كۈتۈۋاتىدۇ
Ожидает курьера|Kurýere garaşylýar|Интизори қосид|Kuryer kutilmoqda|配達員待ち|يەتكۈزگۈچىنى كۈتۈۋاتىدۇ
Курьер назначен|Kurýer bellenildi|Қосид таъин шуд|Kuryer tayinlandi|配達員を手配済み|يەتكۈزگۈچى بېكىتىلدى
У курьера|Kurýerde|Дар дасти қосид|Kuryerda|配達員が受け取り済み|يەتكۈزگۈچىدە
В пути|Ýolda|Дар роҳ|Yo‘lda|配達中|يولدا
Курьер в пути|Kurýer ýolda|Қосид дар роҳ аст|Kuryer yo‘lda|配達員が向かっています|يەتكۈزگۈچى يولدا
Доставлен|Eltildi|Расонида шуд|Yetkazildi|配達済み|يەتكۈزۈلدى
Доставлено|Eltildi|Расонида шуд|Yetkazildi|配達済み|يەتكۈزۈلدى
История статусов|Ýagdaý taryhy|Таърихи ҳолатҳо|Holatlar tarixi|ステータス履歴|ھالەت تارىخى
Где мой курьер|Kurýeri yzarla|Пайгирии қосид|Kuryerni kuzatish|配達員を追跡|يەتكۈزگۈچىنى ئىز قوغلاش
У вас пока нет заказов.|Siziň entek sargydyňyz ýok.|Шумо ҳоло фармоиш надоред.|Hozircha buyurtmalaringiz yo‘q.|まだ注文がありません。|سىزنىڭ تېخى زاكازىڭىز يوق.
Оплата возвращена|Töleg yzyna gaýtaryldy|Маблағ баргардонида шуд|To‘lov qaytarildi|返金済み|پۇل قايتۇرۇلدى
Меню|Menýu|Меню|Menyu|メニュー|تاماق تىزىملىكى
На весь экран|Doly ekran|Тамоми экран|To‘liq ekran|全画面表示|تولۇق ئېكران
Уведомления|Duýduryşlar|Огоҳиҳо|Bildirishnomalar|通知|ئۇقتۇرۇشلار
Закрыть|Ýap|Пӯшидан|Yopish|閉じる|تاقاش
Закрыть карту|Kartany ýap|Пӯшидани харита|Xaritani yopish|地図を閉じる|خەرىتىنى تاقاش
Очистить поиск|Gözlegi arassala|Тоза кардани ҷустуҷӯ|Qidiruvni tozalash|検索をクリア|ئىزدەشنى تازىلاش
Карта для выбора точки доставки|Eltip beriş nokadynyň kartasy|Харитаи нуқтаи расонидан|Yetkazish nuqtasi xaritasi|配達先を選ぶ地図|يەتكۈزۈش ئورنى خەرىتىسى
UMMA MAPS · ДОСТАВКА|UMMA MAPS · ELTIP BERMEK|UMMA MAPS · РАСОНИДАН|UMMA MAPS · YETKAZISH|UMMA MAPS · 配達|UMMA MAPS · يەتكۈزۈش
Куда привезти заказ?|Sargydy nirä eltmeli?|Фармоишро ба куҷо расонем?|Buyurtmani qayerga yetkazamiz?|ご注文の配達先はどちらですか？|زاكازنى قەيەرگە يەتكۈزەيلى؟
Моё местоположение|Ýerleşýän ýerim|Ҷойгиршавии ман|Mening joylashuvim|現在地|مېنىڭ ئورنۇم
Точная точка доставки|Takyk eltip beriş nokady|Нуқтаи дақиқи расонидан|Aniq yetkazish nuqtasi|正確な配達場所|ئېنىق يەتكۈزۈش ئورنى
Доставить сюда|Şu ýere elt|Ба ин ҷо расонед|Shu yerga yetkazish|ここに配達|بۇ يەرگە يەتكۈزۈش
Подготовка карты…|Karta taýýarlanýar…|Харита омода мешавад…|Xarita tayyorlanmoqda…|地図を準備中…|خەرىتە تەييارلىنىۋاتىدۇ…
Готовится к запуску|Tiz wagtda|Ба зудӣ|Tez kunda|近日公開|پات يېقىندا
Открыть UMMA Cafe|UMMA kafesini aç|Кушодани UMMA Cafe|UMMA kafesini ochish|UMMAカフェを開く|UMMA ئاشخانىسىنى ئېچىش
Направления UMMA|UMMA ugurlary|Самтҳои UMMA|UMMA yo‘nalishlari|UMMAのサービス|UMMA يۆنىلىشلىرى
Добавить на главный экран телефона|Esasy ekrana goş|Ба экрани асосӣ илова кардан|Bosh ekranga qo‘shish|ホーム画面に追加|باش ئېكرانغا قوشۇش
Администрирование|Dolandyryş|Маъмурият|Boshqaruv|管理|باشقۇرۇش
Работа в кафе|Kafäniň işi|Кори кафе|Kafe faoliyati|カフェ業務|ئاشخانا ئىشلىرى
Кухня|Aşhana|Ошхона|Oshxona|キッチン|ئاشخانا بۆلۈمى
Курьер|Kurýer|Қосид|Kuryer|配達員|يەتكۈزگۈچى
Приём заказов|Sargytlary kabul etmek|Қабули фармоишҳо|Buyurtmalarni qabul qilish|注文受付|زاكاز قوبۇل قىلىش
Учёт кафе|Kafe hasaby|Ҳисобдории кафе|Kafe hisobi|カフェ会計|ئاشخانا ھېساباتى
Пользователи|Ulanyjylar|Корбарон|Foydalanuvchilar|ユーザー|ئىشلەتكۈچىلەر
Сотрудники|Işgärler|Кормандон|Xodimlar|スタッフ|خىزمەتچىلەر
Товары и остатки|Harytlar we galyndylar|Молҳо ва бақияҳо|Mahsulotlar va qoldiqlar|商品・在庫|مەھسۇلات ۋە قالدۇق
Управление кафе|Kafeni dolandyrmak|Идоракунии кафе|Kafeni boshqarish|カフェ管理|ئاشخانىنى باشقۇرۇش
Категория|Kategoriýa|Гурӯҳ|Toifa|カテゴリー|تۈر
Цена, VND|Baha, VND|Нарх, VND|Narx, VND|価格（VND）|باھا، VND
Количество|Mukdar|Миқдор|Miqdor|数量|مىقدار
Адрес|Salgy|Суроға|Manzil|住所|ئادرېس
Страна|Ýurt|Кишвар|Mamlakat|国|دۆلەت
Комментарий|Bellik|Шарҳ|Izoh|メモ|ئىزاھات
Способ оплаты|Töleg usuly|Тарзи пардохт|To‘lov usuli|お支払い方法|پۇل تۆلەش ئۇسۇلى
Активные|Işjeň|Фаъол|Faol|進行中|ئاكتىپ
Закрытые|Ýapylan|Басташуда|Yopilgan|終了済み|تاقالغان
Сохранить|Ýatda sakla|Захира кардан|Saqlash|保存|ساقلاش
Отменить|Ýatyr|Бекор кардан|Bekor qilish|キャンセル|بىكار قىلىش
Принять|Kabul et|Қабул кардан|Qabul qilish|受け付ける|قوبۇل قىلىش
Готово|Taýýar|Омода|Tayyor|完了|تەييار
Загрузка…|Ýüklenýär…|Боркунӣ…|Yuklanmoqda…|読み込み中…|يۈكلىنىۋاتىدۇ…
Повторить|Gaýtala|Такрор кардан|Qayta urinish|再試行|قايتا سىناش
Оплатить|Töle|Пардохт кардан|To‘lash|支払う|پۇل تۆلەش
Оплатить по QR|QR bilen töle|Бо QR пардохт кардан|QR orqali to‘lash|QRで支払う|QR ئارقىلىق تۆلەش
Оплата заказа|Sargyt tölegi|Пардохти фармоиш|Buyurtma to‘lovi|注文のお支払い|زاكاز پۇلىنى تۆلەش
Закрыть оплату|Tölegi ýap|Пӯшидани пардохт|To‘lovni yopish|お支払い画面を閉じる|پۇل تۆلەشنى تاقاش
Ваш банк|Bankyňyz|Бонки шумо|Bankingiz|ご利用の銀行|بانكىڭىز
Показать QR-код|QR kody görkez|Намоиши рамзи QR|QR-kodni ko‘rsatish|QRコードを表示|QR كودنى كۆرسىتىش
Сохранить QR для оплаты|Töleg QR koduny sakla|Захираи QR барои пардохт|To‘lov QR-kodini saqlash|支払い用QRを保存|پۇل تۆلەش QR كودىنى ساقلاش
Сохранить QR|QR koduny sakla|Захираи QR|QR-kodni saqlash|QRを保存|QR كودنى ساقلاش
Подготавливаем QR…|QR taýýarlanýar…|QR омода мешавад…|QR tayyorlanmoqda…|QRを準備中…|QR تەييارلىنىۋاتىدۇ…
Открыть банк снова|Banky täzeden aç|Бонкро аз нав кушодан|Bankni qayta ochish|銀行アプリを再度開く|بانكىنى قايتا ئېچىش
Скриншот оплаты|Tölegiň ekran suraty|Акси экрани пардохт|To‘lov skrinshoti|支払いのスクリーンショット|پۇل تۆلەش ئېكران سۈرىتى
Скриншот перевода|Geçirmäniň ekran suraty|Акси экрани интиқол|O‘tkazma skrinshoti|振込のスクリーンショット|پۇل يۆتكەش ئېكران سۈرىتى
Выбрать скриншот|Ekran suratyny saýla|Интихоби акси экран|Skrinshot tanlash|スクリーンショットを選択|ئېكران سۈرىتىنى تاللاش
Отправить чек|Çegi iber|Фиристодани расид|Chekni yuborish|支払い証明を送信|تالوننى يوللاش
Чек отправлен|Çek iberildi|Расид фиристода шуд|Chek yuborildi|支払い証明を送信しました|تالون يوللاندى
Отправляем…|Iberilýär…|Фиристода мешавад…|Yuborilmoqda…|送信中…|يوللىنىۋاتىدۇ…
Проверяем поступление оплаты…|Töleg barlanýar…|Воридшавии пардохт санҷида мешавад…|To‘lov tushgani tekshirilmoqda…|入金を確認中…|پۇل كىرگەنلىكى تەكشۈرۈلۈۋاتىدۇ…
Ожидаем информацию от банка|Bankyň tassyklamasyna garaşylýar|Интизори тасдиқи бонк|Bank tasdig‘i kutilmoqda|銀行の確認を待っています|بانكا جەزملەشتۈرۈشىنى كۈتۈۋاتىمىز
Оформляем заказ…|Sargyt edilýär…|Фармоиш омода мешавад…|Buyurtma berilmoqda…|注文処理中…|زاكاز قىلىنىۋاتىدۇ…
Приём заказов приостановлен|Sargyt kabul etmek togtadyldy|Қабули фармоишҳо боздошта шуд|Buyurtma qabul qilish to‘xtatilgan|注文受付を休止中|زاكاز قوبۇل قىلىش توختىتىلدى
Укажите адрес доставки|Eltip beriş salgysyny giriziň|Суроғаи расониданро ворид кунед|Yetkazish manzilini kiriting|配達先住所を入力してください|يەتكۈزۈش ئادرېسىنى كىرگۈزۈڭ
Сначала добавьте блюда в заказ|Ilki sargyda nahar goşuň|Аввал ба фармоиш таом илова кунед|Avval buyurtmaga taom qo‘shing|先に料理を追加してください|ئالدى بىلەن تاماق قوشۇڭ
Закрыть выбор|Saýlawy ýap|Пӯшидани интихоб|Tanlovni yopish|選択画面を閉じる|تاللاشنى تاقاش
Выберите вариант|Görnüşi saýlaň|Вариантро интихоб кунед|Variantni tanlang|選択してください|بىر تاللاشنى تاللاڭ
Точка доставки|Eltip beriş nokady|Нуқтаи расонидан|Yetkazish nuqtasi|配達地点|يەتكۈزۈش نۇقتىسى
Изменить точку на карте|Kartadaky nokady üýtget|Тағйири нуқта дар харита|Xaritadagi nuqtani o‘zgartirish|地図の地点を変更|خەرىتىدىكى نۇقتىنى ئۆزگەرتىش
Определяем…|Kesgitlenýär…|Муайян мешавад…|Aniqlanmoqda…|現在地を取得中…|ئېنىقلىنىۋاتىدۇ…
Курьер на карте|Kartada kurýer|Қосид дар харита|Xaritadagi kuryer|地図上の配達員|خەرىتىدىكى يەتكۈزگۈچى
Ожидаем позицию|Ýerleşişe garaşylýar|Интизори ҷойгиршавӣ|Joylashuv kutilmoqda|位置情報を待っています|ئورۇن ئۇچۇرىنى كۈتۈۋاتىمىز
Нет свежей позиции|Täze ýerleşiş ýok|Ҷойгиршавии нав нест|Yangi joylashuv yo‘q|最新の位置情報がありません|يېڭى ئورۇن ئۇچۇرى يوق
Название или ингредиент|Ady ýa-da düzümi|Ном ё таркиб|Nomi yoki masalliq|料理名または食材|نام ياكى تەركىب
Категории меню|Menýu kategoriýalary|Гурӯҳҳои меню|Menyu toifalari|メニューカテゴリー|تاماق تۈرلىرى
Меню кафе|Kafeniň menýusy|Менюи кафе|Kafe menyusi|カフェメニュー|ئاشخانا تاماق تىزىملىكى
Ваше имя|Adyňyz|Номи шумо|Ismingiz|お名前|ئىسىمىڭىز
Для связи по заказу|Sargyt boýunça habarlaşmak üçin|Барои тамос оид ба фармоиш|Buyurtma bo‘yicha bog‘lanish uchun|注文に関するご連絡用|زاكاز توغرىسىدا ئالاقىلىشىش ئۈچۈن
Например, соус отдельно|Mysal üçin, sous aýratyn|Масалан, чошнӣ алоҳида|Masalan, sous alohida|例：ソースは別添え|مەسىلەن، قىيام ئايرىم
Основные разделы|Esasy bölümler|Бахшҳои асосӣ|Asosiy bo‘limlar|メインメニュー|ئاساسلىق بۆلۈملەر
Найдено: {n} из {m}|Tapylan: {n} / {m}|Ёфт шуд: {n} аз {m}|Topildi: {n} / {m}|{m}件中{n}件|تېپىلغان: {n} / {m}
Доступно в меню: {n}|Elýeterli naharlar: {n}|Таомҳои дастрас: {n}|Mavjud taomlar: {n}|注文可能：{n}品|بار بولغان تاماقلار: {n}
Стол {n}|Stol {n}|Мизи {n}|{n}-stol|{n}番テーブル|{n}-ئۈستەل
Заказ №{id}|Sargyt №{id}|Фармоиши №{id}|Buyurtma №{id}|注文番号 {id}|زاكاز نومۇرى {id}
Заказ №{id} принят.|Sargyt №{id} kabul edildi.|Фармоиши №{id} қабул шуд.|Buyurtma №{id} qabul qilindi.|注文番号 {id} を受け付けました。|{id} نومۇرلۇق زاكاز قوبۇل قىلىندى.
Уведомления сотрудникам кафе: {n}|Işgärlere habar berildi: {n}|Кормандони огоҳшуда: {n}|Xabardor qilingan xodimlar: {n}|通知済みスタッフ：{n}人|ئۇقتۇرۇلغان خىزمەتچىلەر: {n}
Сумма: {text}|Möçber: {text}|Маблағ: {text}|Summa: {text}|金額：{text}|سومما: {text}
Кафе: {text}|Kafe: {text}|Кафе: {text}|Kafe: {text}|カフェ：{text}|ئاشخانا: {text}
Доступный остаток: {n}|Elýeterli galyndy: {n}|Бақияи дастрас: {n}|Mavjud qoldiq: {n}|在庫：{n}|بار بولغان قالدۇق: {n}
Уменьшить {text}|{text} azalt|Кам кардани {text}|{text}ni kamaytirish|{text}を減らす|{text} نى ئازايتىش
Добавить ещё {text}|Ýene {text} goş|Боз илова кардани {text}|Yana {text} qo‘shish|{text}をさらに追加|يەنە {text} قوشۇش
Добавить {text}|{text} goş|Илова кардани {text}|{text} qo‘shish|{text}を追加|{text} قوشۇش
VietQR для оплаты заказа №{id}|Sargyt №{id} üçin VietQR|VietQR барои фармоиши №{id}|Buyurtma №{id} uchun VietQR|注文番号 {id} のVietQR|{id} نومۇرلۇق زاكاز ئۈچۈن VietQR
Шурпа|Çorba|Шӯрбо|Sho‘rva|シュルパ|شورپا
Борщ|Borş|Борщ|Borshch|ボルシチ|بورش
Плов|Palaw|Оши палав|Palov|プロフ|پولو
Плов с бараниной|Goýun etli palaw|Оши палав бо гӯшти гӯсфанд|Qo‘y go‘shtli palov|羊肉のプロフ|قوي گۆشى پولوسى
Манты (4 шт.)|Manty (4 sany)|Манту (4 дона)|Manti (4 dona)|マンティ（4個）|مانتا (4 دانە)
Куриный окорочок с салатом|Salatly towuk budy|Рони мурғ бо хӯриш|Salat bilan tovuq soni|鶏もも肉のサラダ添え|سالات بىلەن توخۇ يوتىسى
Салат Ачичук|Açiçuk salaty|Хӯриши ачичук|Achichuk salati|アチチュクサラダ|ئاچچىق چۈچۈك سالات
Салат Оливье|Oliwýe salaty|Хӯриши оливйе|Olivye salati|オリヴィエサラダ|ئولىۋىيە سالات
Салат Винегрет|Winegret salaty|Хӯриши винегрет|Vinegret salati|ビーツのヴィネグレットサラダ|ۋىنېگرېت سالات
Салат «Хрустящий»|«Şygyrdyly» salat|Хӯриши «Қарсосӣ»|«Qarsildoq» salati|シャキシャキサラダ|«چۈرۈك» سالات
Лепёшка UMMA|UMMA çöregi|Нони UMMA|UMMA noni|UMMAナン|UMMA نېنى
Самса с бараниной|Goýun etli somsa|Самбӯса бо гӯшти гӯсфанд|Qo‘y go‘shtli somsa|羊肉のサムサ|قوي گۆشى سامسىسى
Самса с курицей|Towukly somsa|Самбӯса бо мурғ|Tovuqli somsa|鶏肉のサムサ|توخۇ گۆشى سامسىسى
Хачапури с сыром|Peýnirli haçapuri|Хачапурӣ бо панир|Pishloqli xachapuri|チーズのハチャプリ|پىشلاقلىق خاچاپۇرى
Круассан|Kruassan|Круассан|Kruassan|クロワッサン|كىرۇئاسسان
Айран UMMA|UMMA aýrany|Айрони UMMA|UMMA ayroni|UMMAアイラン|UMMA ئايرىنى
Айран турецкий|Türk aýrany|Айрони туркӣ|Turk ayroni|トルコ風アイラン|تۈرك ئايرىنى
Чай зелёный|Gök çaý|Чойи сабз|Ko‘k choy|緑茶|يېشىل چاي
Чай чёрный с лимоном|Limonly gara çaý|Чойи сиёҳ бо лимӯ|Limonli qora choy|レモンティー|لىمونلۇق قارا چاي
Компот ежевичный|Böwürslen kompoty|Компоти марминҷон|Maymunjon kompoti|ブラックベリーのコンポートドリンク|قارا بۆلدۈرگەن كومپوتى
Аджика|Ajika|Аҷика|Adjika|アジカソース|ئاجىكا قىيامى
Проверьте заказ перед подтверждением. Деньги автоматически не списываются.|Tassyklamazdan öň sargydy barlaň. Pul awtomatik tutulmaýar.|Пеш аз тасдиқ фармоишро санҷед. Пул худкор гирифта намешавад.|Tasdiqlashdan oldin buyurtmani tekshiring. Pul avtomatik yechilmaydi.|確定前に注文をご確認ください。自動で引き落とされることはありません。|جەزملەشتۈرۈشتىن بۇرۇن زاكازنى تەكشۈرۈڭ. پۇل ئاپتوماتىك تۇتۇلمايدۇ.
Статусы, оплата и доставка обновляются автоматически.|Sargyt, töleg we eltip beriş ýagdaýlary awtomatik täzelenýär.|Ҳолатҳои фармоиш, пардохт ва расонидан худкор нав мешаванд.|Buyurtma, to‘lov va yetkazish holatlari avtomatik yangilanadi.|注文・支払い・配達状況は自動更新されます。|زاكاز، پۇل تۆلەش ۋە يەتكۈزۈش ھالەتلىرى ئاپتوماتىك يېڭىلىنىدۇ.
Приём заказов временно приостановлен. Меню доступно для просмотра.|Sargytlar wagtlaýyn togtadyldy. Menýuny görüp bilersiňiz.|Қабули фармоишҳо муваққатан боздошта шудааст. Менюро дидан мумкин аст.|Buyurtmalar vaqtincha to‘xtatilgan. Menyuni ko‘rishingiz mumkin.|注文受付を一時休止しています。メニューはご覧いただけます。|زاكاز قوبۇل قىلىش ۋاقىتلىق توختىتىلدى. تاماق تىزىملىكىنى كۆرەلەيسىز.
Приём заказов временно приостановлен.|Sargytlar wagtlaýyn togtadyldy.|Қабули фармоишҳо муваққатан боздошта шудааст.|Buyurtmalar vaqtincha to‘xtatilgan.|注文受付を一時休止しています。|زاكاز قوبۇل قىلىش ۋاقىتلىق توختىتىلدى.
Ничего не найдено. Измените запрос, выберите другую категорию или нажмите «Показать всё меню».|Hiç zat tapylmady. Gözlegi ýa-da kategoriýany üýtgediň ýa-da ähli menýuny görkeziň.|Чизе ёфт нашуд. Ҷустуҷӯ ё гурӯҳро тағйир диҳед ё тамоми менюро нишон диҳед.|Hech narsa topilmadi. Qidiruvni yoki toifani o‘zgartiring yoki barcha menyuni ko‘rsating.|見つかりませんでした。検索語やカテゴリーを変更するか、全メニューを表示してください。|ھېچنېمە تېپىلمىدى. ئىزدەش سۆزى ياكى تۈرنى ئۆزگەرتىڭ ياكى بارلىق تاماقلارنى كۆرسىتىڭ.
В выбранном кафе пока нет товаров с доступным остатком. Выберите другое кафе или попробуйте позже.|Bu kafede elýeterli nahar ýok. Başga kafe saýlaň ýa-da soňrak synanyşyň.|Дар ин кафе таоми дастрас нест. Кафеи дигарро интихоб кунед ё дертар кӯшиш кунед.|Bu kafeda hozircha taom yo‘q. Boshqa kafe tanlang yoki keyinroq urinib ko‘ring.|このカフェには現在注文可能な料理がありません。別のカフェを選ぶか、後ほどお試しください。|بۇ ئاشخانىدا ھازىر بار تاماق يوق. باشقا ئاشخانا تاللاڭ ياكى كېيىن قايتا سىناڭ.
Оплата подтвердится автоматически. Скриншот не нужен.|Töleg awtomatik tassyklanar. Ekran suraty gerek däl.|Пардохт худкор тасдиқ мешавад. Акси экран лозим нест.|To‘lov avtomatik tasdiqlanadi. Skrinshot kerak emas.|支払いは自動確認されます。スクリーンショットは不要です。|پۇل تۆلەش ئاپتوماتىك جەزملەشتۈرۈلىدۇ. ئېكران سۈرىتى لازىم ئەمەس.
Ждём подтверждение банка… Если уже оплатили, не переводите повторно.|Bankyň tassyklamasyna garaşylýar… Tölän bolsaňyz, gaýtadan geçirmäň.|Интизори тасдиқи бонк… Агар пардохт кардед, такроран нафиристед.|Bank tasdig‘i kutilmoqda… To‘lagan bo‘lsangiz, qayta o‘tkazmang.|銀行の確認待ちです…お支払い済みの場合は再度振り込まないでください。|بانكا جەزملەشتۈرۈشىنى كۈتۈۋاتىمىز… تۆلىگەن بولسىڭىز قايتا پۇل يۆتكىمەڭ.
Спасибо! Оплата заказа подтверждена.|Sag boluň! Tölegiňiz tassyklandy.|Ташаккур! Пардохти фармоиш тасдиқ шуд.|Rahmat! Buyurtma to‘lovi tasdiqlandi.|ありがとうございます。お支払いを確認しました。|رەھمەت! زاكاز پۇلى جەزملەشتۈرۈلدى.
Нет связи. Проверим оплату автоматически после восстановления.|Aragatnaşyk ýok. Birikme dikeldilende töleg awtomatik barlanar.|Алоқа нест. Пас аз барқароршавӣ пардохт худкор санҷида мешавад.|Aloqa yo‘q. Tiklangach to‘lov avtomatik tekshiriladi.|接続が切れています。復旧後に支払いを自動確認します。|تور ئۇلىنىشى يوق. ئۇلانغاندىن كېيىن پۇل تۆلەش ئاپتوماتىك تەكشۈرۈلىدۇ.
Сохраните QR на телефон или сделайте скриншот.|QR koduny telefona saklaň ýa-da ekran suratyny alyň.|QR-ро ба телефон захира кунед ё акси экран гиред.|QR-kodni telefonga saqlang yoki skrinshot oling.|QRをスマートフォンに保存するか、スクリーンショットを撮ってください。|QR كودنى تېلېفونغا ساقلاڭ ياكى ئېكران سۈرىتى ئېلىڭ.
Откройте Vietcombank → QR → выберите изображение из галереи.|Vietcombank → QR → galereýadan suraty saýlaň.|Vietcombank → QR → аксро аз галерея интихоб кунед.|Vietcombank → QR → galereyadan rasmni tanlang.|Vietcombank → QR → ギャラリーから画像を選択してください。|Vietcombank → QR → رەسىم ئامبىرىدىن رەسىمنى تاللاڭ.
Проверьте получателя и подтвердите перевод.|Alyjyny barlap, geçirmäni tassyklaň.|Қабулкунандаро санҷед ва интиқолро тасдиқ кунед.|Qabul qiluvchini tekshiring va o‘tkazmani tasdiqlang.|受取人を確認し、振込を確定してください。|تاپشۇرۇۋالغۇچىنى تەكشۈرۈپ پۇل يۆتكەشنى جەزملەشتۈرۈڭ.
Сумма и номер заказа уже в QR. Не меняйте их при оплате.|Möçber we sargyt belgisi QR kodunda bar. Tölegde olary üýtgetmäň.|Маблағ ва рақами фармоиш дар QR ҳастанд. Ҳангоми пардохт онҳоро тағйир надиҳед.|Summa va buyurtma raqami QR-kodda bor. To‘lovda ularni o‘zgartirmang.|金額と注文番号はQRに含まれています。支払い時に変更しないでください。|سومما ۋە زاكاز نومۇرى QR كودتا بار. پۇل تۆلىگەندە ئۆزگەرتمەڭ.
Выберите сохранённый QR в сканере банка. Сумма и номер заказа уже указаны.|Bank skanerinde saklanan QR koduny saýlaň. Möçber we sargyt belgisi görkezilen.|QR-и захирашударо дар барномаи бонк интихоб кунед. Маблағ ва рақами фармоиш нишон дода шудаанд.|Bank skanerida saqlangan QR-kodni tanlang. Summa va buyurtma raqami kiritilgan.|銀行アプリのスキャナーで保存したQRを選択してください。金額と注文番号は入力済みです。|بانكا سىكانېرىدا ساقلانغان QR كودنى تاللاڭ. سومما ۋە زاكاز نومۇرى كىرگۈزۈلگەن.
Уже перевели?|Geçirdiňizmi?|Аллакай интиқол додед?|O‘tkazib bo‘ldingizmi?|すでに振り込みましたか？|پۇل يۆتكەپ بولدىڭىزمۇ؟
Прикрепите фото или скриншот перевода. JPG, PNG или WEBP до 5 МБ.|Geçirmäniň suratyny goşuň. JPG, PNG ýa-da WEBP, 5 MB çenli.|Акс ё акси экрани интиқолро замима кунед. JPG, PNG ё WEBP то 5 МБ.|O‘tkazma rasmi yoki skrinshotini biriktiring. JPG, PNG yoki WEBP, 5 MB gacha.|振込の写真またはスクリーンショットを添付してください。JPG・PNG・WEBP、5MBまで。|پۇل يۆتكەش رەسىمى ياكى ئېكران سۈرىتىنى قوشۇڭ. JPG، PNG ياكى WEBP، 5 MB غىچە.
Выберите JPG, PNG или WEBP до 5 МБ.|5 MB çenli JPG, PNG ýa-da WEBP saýlaň.|JPG, PNG ё WEBP то 5 МБ интихоб кунед.|5 MB gacha JPG, PNG yoki WEBP tanlang.|5MB以下のJPG・PNG・WEBPを選択してください。|5 MB غىچە JPG، PNG ياكى WEBP تاللاڭ.
Скриншот выбран. Нажмите «Отправить чек».|Ekran suraty saýlandy. «Çegi iber» basyň.|Акси экран интихоб шуд. «Фиристодани расид»-ро пахш кунед.|Skrinshot tanlandi. «Chekni yuborish»ni bosing.|スクリーンショットを選択しました。「支払い証明を送信」を押してください。|ئېكران سۈرىتى تاللاندى. «تالوننى يوللاش» نى بېسىڭ.
Скриншот отправлен. Ожидайте проверки кафе.|Ekran suraty iberildi. Kafeniň barlagyna garaşyň.|Акси экран фиристода шуд. Санҷиши каферо интизор шавед.|Skrinshot yuborildi. Kafe tekshiruvini kuting.|スクリーンショットを送信しました。カフェの確認をお待ちください。|ئېكران سۈرىتى يوللاندى. ئاشخانىنىڭ تەكشۈرۈشىنى كۈتۈڭ.
Чек проверен сотрудником.|Çek işgär tarapyndan barlandy.|Расид аз ҷониби корманд санҷида шуд.|Chek xodim tomonidan tekshirildi.|スタッフが支払い証明を確認しました。|خىزمەتچى تالوننى تەكشۈردى.
Чек отправлен на проверку. Оплату подтвердит сотрудник после поступления денег.|Çek barlaga iberildi. Pul gelenden soň işgär tölegi tassyklar.|Расид барои санҷиш фиристода шуд. Корманд пас аз воридшавии пул пардохтро тасдиқ мекунад.|Chek tekshiruvga yuborildi. Pul tushgach xodim to‘lovni tasdiqlaydi.|支払い証明を送信しました。入金後にスタッフが確認します。|تالون تەكشۈرۈشكە يوللاندى. پۇل كىرگەندىن كېيىن خىزمەتچى جەزملەشتۈرىدۇ.
Не удалось отправить чек. Попробуйте ещё раз.|Çegi iberip bolmady. Täzeden synanyşyň.|Расид фиристода нашуд. Аз нав кӯшиш кунед.|Chek yuborilmadi. Qayta urinib ko‘ring.|支払い証明を送信できませんでした。もう一度お試しください。|تالوننى يوللىيالمىدى. قايتا سىناڭ.
Повторить отправку|Täzeden iber|Аз нав фиристодан|Qayta yuborish|再送信|قايتا يوللاش
Оплатили, но статус не изменился?|Tölediňiz, emma ýagdaý üýtgemedimi?|Пардохт кардед, вале ҳолат тағйир наёфт?|To‘ladingiz, lekin holat o‘zgarmadimi?|支払い済みなのに状態が変わりませんか？|تۆلىدىڭىز، لېكىن ھالەت ئۆزگەرمىدىمۇ؟
Не оплачивайте повторно. Если изменили сумму или назначение, автоматическое подтверждение не сработает. Отправьте скриншот: сотрудник проверит поступление и поможет с разницей в сумме.|Gaýtadan tölemäň. Möçber ýa-da bellik üýtgedilse awtomatik tassyklama işlemez. Ekran suratyny iberiň: işgär puluň gelşini we tapawudy barlar.|Такроран пардохт накунед. Тағйири маблағ ё таъинот тасдиқи худкорро қатъ мекунад. Акси экранро фиристед: корманд воридшавӣ ва фарқияти маблағро месанҷад.|Qayta to‘lamang. Summa yoki izoh o‘zgartirilsa, avtomatik tasdiq ishlamaydi. Skrinshot yuboring: xodim tushumni va farqni tekshiradi.|再度支払わないでください。金額や振込内容を変更すると自動確認されません。スクリーンショットを送るとスタッフが入金と差額を確認します。|قايتا پۇل تۆلىمەڭ. سومما ياكى ئىزاھات ئۆزگەرسە ئاپتوماتىك جەزملەشتۈرۈش ئىشلىمەيدۇ. ئېكران سۈرىتىنى يوللاڭ، خىزمەتچى پۇل ۋە سومما پەرقىنى تەكشۈرىدۇ.
Место доставки отмечено на карте|Eltip beriş ýeri kartada bellendi|Ҷойи расонидан дар харита нишон дода шуд|Yetkazish joyi xaritada belgilandi|配達場所を地図に設定しました|يەتكۈزۈش ئورنى خەرىتىدە بەلگىلەندى
Выберите точку на карте или введите полный адрес ниже.|Kartada nokat saýlaň ýa-da aşakda doly salgyny giriziň.|Дар харита нуқтаро интихоб кунед ё суроғаи пурраро дар поён нависед.|Xaritada nuqta tanlang yoki pastda to‘liq manzilni kiriting.|地図で地点を選ぶか、下に住所を入力してください。|خەرىتىدە نۇقتا تاللاڭ ياكى تۆۋەنگە تولۇق ئادرېسنى كىرگۈزۈڭ.
Проверьте точку и нажмите «Доставить сюда».|Nokady barlaň we «Şu ýere elt» basyň.|Нуқтаро санҷед ва «Ба ин ҷо расонед»-ро пахш кунед.|Nuqtani tekshirib «Shu yerga yetkazish»ni bosing.|地点を確認し、「ここに配達」を押してください。|نۇقتىنى تەكشۈرۈپ «بۇ يەرگە يەتكۈزۈش» نى بېسىڭ.
Геолокация недоступна. Поставьте точку на карте вручную.|Ýerleşiş elýeterli däl. Kartada nokady el bilen belläň.|Ҷойгиршавӣ дастрас нест. Нуқтаро дар харита дастӣ гузоред.|Joylashuv mavjud emas. Xaritada nuqtani qo‘lda belgilang.|位置情報を利用できません。地図で手動設定してください。|ئورۇن ئۇچۇرى يوق. خەرىتىدە نۇقتىنى قولدا تاللاڭ.
Разрешите доступ к местоположению. Затем проверьте найденную точку.|Ýerleşişe rugsat beriň, soňra tapylan nokady barlaň.|Дастрасӣ ба ҷойгиршавиро иҷозат диҳед ва нуқтаро санҷед.|Joylashuvga ruxsat bering, keyin topilgan nuqtani tekshiring.|位置情報へのアクセスを許可し、表示された地点を確認してください。|ئورۇن ئۇچۇرىغا رۇخسەت بېرىپ، تېپىلغان نۇقتىنى تەكشۈرۈڭ.
Квартира, этаж, ориентир (необязательно)|Öý, gat, ugrukdyryjy (hökmany däl)|Хона, ошёна, нишона (ихтиёрӣ)|Xonadon, qavat, mo‘ljal (ixtiyoriy)|部屋番号・階・目印（任意）|ئۆي، قەۋەت، بەلگە (ئىختىيارىي)
Улица, дом, квартира или ориентир|Köçe, jaý, öý ýa-da ugrukdyryjy|Кӯча, бино, хона ё нишона|Ko‘cha, uy, xonadon yoki mo‘ljal|通り・建物・部屋番号・目印|كوچا، بىنا، ئۆي ياكى بەلگە
Откройте приложение через Telegram.|Programmany Telegram arkaly açyň.|Барномаро тавассути Telegram кушоед.|Ilovani Telegram orqali oching.|Telegramからアプリを開いてください。|ئەپنى Telegram ئارقىلىق ئېچىڭ.
Откройте приложение через Telegram|Programmany Telegram arkaly açyň|Барномаро тавассути Telegram кушоед|Ilovani Telegram orqali oching|Telegramからアプリを開いてください|ئەپنى Telegram ئارقىلىق ئېچىڭ
Не удалось загрузить меню|Menýuny ýükläp bolmady|Меню бор нашуд|Menyu yuklanmadi|メニューを読み込めませんでした|تاماق تىزىملىكى يۈكلەنمىدى
Не удалось оформить заказ|Sargyt edip bolmady|Фармоиш дода нашуд|Buyurtma berilmadi|注文できませんでした|زاكاز قىلالمىدى
Не удалось загрузить заказы|Sargytlary ýükläp bolmady|Фармоишҳо бор нашуданд|Buyurtmalar yuklanmadi|注文を読み込めませんでした|زاكازلار يۈكلەنمىدى
Выберите кафе, в котором хотите заказать.|Sargyt etjek kafeňizi saýlaň.|Кафееро, ки фармоиш медиҳед, интихоб кунед.|Buyurtma beradigan kafeni tanlang.|注文するカフェを選択してください。|زاكاز قىلىدىغان ئاشخانىنى تاللاڭ.
Заказ доставлен.|Sargyt eltildi.|Фармоиш расонида шуд.|Buyurtma yetkazildi.|注文を配達しました。|زاكاز يەتكۈزۈلدى.
Курьер ещё не забрал заказ.|Kurýer sargydy entek almady.|Қосид ҳанӯз фармоишро нагирифтааст.|Kuryer hali buyurtmani olmadi.|配達員はまだ注文を受け取っていません。|يەتكۈزگۈچى زاكازنى تېخى ئالمىدى.
Курьер пока не передаёт позицию.|Kurýer entek ýerleşişini ibermeýär.|Қосид ҳанӯз ҷойгиршавиро намефиристад.|Kuryer hali joylashuvini yubormayapti.|配達員はまだ位置情報を共有していません。|يەتكۈزگۈچى تېخى ئورۇن ئۇچۇرىنى يوللىمىدى.
Нет свежей позиции. GPS или связь временно недоступны.|Täze ýerleşiş ýok. GPS ýa-da aragatnaşyk wagtlaýyn ýok.|Ҷойгиршавии нав нест. GPS ё алоқа муваққатан дастрас нест.|Yangi joylashuv yo‘q. GPS yoki aloqa vaqtincha mavjud emas.|最新の位置情報がありません。GPSまたは通信が一時的に利用できません。|يېڭى ئورۇن ئۇچۇرى يوق. GPS ياكى تور ۋاقىتلىق ئىشلىمەيۋاتىدۇ.
Отслеживание завершено или недоступно.|Yzarlama tamamlandy ýa-da elýeterli däl.|Пайгирӣ анҷом ёфт ё дастрас нест.|Kuzatish yakunlangan yoki mavjud emas.|追跡が終了したか、利用できません。|ئىز قوغلاش تاماملاندى ياكى ئىشلىمەيدۇ.
Позиция недоступна.|Ýerleşiş elýeterli däl.|Ҷойгиршавӣ дастрас нест.|Joylashuv mavjud emas.|位置情報を利用できません。|ئورۇن ئۇچۇرى يوق.
Онлайн|Onlaýn|Онлайн|Onlayn|オンライン|توردا
Связь прервана|Birikme kesildi|Алоқа қатъ шуд|Aloqa uzildi|接続が切れました|ئۇلىنىش ئۈزۈلدى
Онлайн: автоматическое обновление включено|Onlaýn: awtomatik täzelenme açyk|Онлайн: навсозии худкор фаъол аст|Onlayn: avtomatik yangilanish yoqilgan|オンライン：自動更新が有効です|توردا: ئاپتوماتىك يېڭىلاش ئېچىلغان
Связь прервана: повторяем подключение|Birikme kesildi: täzeden birikdirilýär|Алоқа қатъ шуд: аз нав пайваст мешавем|Aloqa uzildi: qayta ulanmoqda|接続が切れました：再接続中|ئۇلىنىش ئۈزۈلدى: قايتا ئۇلىنىۋاتىدۇ
Управление Umma Global|UMMA Global dolandyryşy|Идоракунии UMMA Global|UMMA Global boshqaruvi|UMMA Globalの管理|UMMA Global نى باشقۇرۇش
Туры, билеты и маршруты|Syýahatlar, petekler we ugurlar|Саёҳатҳо, чиптаҳо ва хатсайрҳо|Turlar, chiptalar va yo‘nalishlar|ツアー・チケット・ルート|ساياھەت، بېلەت ۋە يوللار
Всё, что нужно нашей семье. Кафе уже работает в приложении; остальные направления готовятся к запуску.|Maşgalamyza gerek zatlaryň ählisi. Kafe programmada işleýär; beýleki hyzmatlar taýýarlanýar.|Ҳама чиз барои оилаи мо. Кафе дар барнома фаъол аст; дигар хизматҳо омода мешаванд.|Oilamizga kerak bo‘lgan hamma narsa. Kafe ilovada ishlayapti; boshqa xizmatlar tayyorlanmoqda.|私たちの家族に必要なすべてを。カフェは利用可能で、その他のサービスは準備中です。|ئائىلىمىزگە كېرەكلىك ھەممە نەرسە. ئاشخانا ئەپتە ئىشلىمەكتە؛ باشقا مۇلازىمەتلەر تەييارلىنىۋاتىدۇ.
Доставляем только в пределах зоны на карте. Выберите точку доставки.|Diňe kartada görkezilen zolaga eltip berýäris. Eltip bermeli nokady saýlaň.|Танҳо дар ҳудуди дар харита нишондодашуда мерасонем. Нуқтаи расониданро интихоб кунед.|Faqat xaritada ko‘rsatilgan hududga yetkazamiz. Yetkazish nuqtasini tanlang.|地図に表示された範囲内のみ配達できます。配達先を選択してください。|پەقەت خەرىتىدە كۆرسىتىلگەن دائىرىگە يەتكۈزىمىز. يەتكۈزۈش نۇقتىسىنى تاللاڭ.
Адрес входит в зону доставки.|Bu salgy eltip beriş zolagynda.|Ин суроға дар ҳудуди расонидан аст.|Bu manzil yetkazish hududida.|この住所は配達可能な範囲内です。|بۇ ئادرېس يەتكۈزۈش دائىرىسىدە.
Этот адрес вне зоны доставки выбранного кафе. Выберите другой адрес или самовывоз.|Bu salgy saýlanan kafeniň eltip beriş zolagyndan daşarda. Başga salgy ýa-da alyp gitmegi saýlaň.|Ин суроға берун аз ҳудуди расонидани қаҳвахонаи интихобшуда аст. Суроғаи дигар ё худгирифтро интихоб кунед.|Bu manzil tanlangan kafe yetkazish hududidan tashqarida. Boshqa manzil yoki olib ketishni tanlang.|選択したカフェの配達範囲外です。別の住所か持ち帰りを選択してください。|بۇ ئادرېس تاللانغان ئاشخانىنىڭ يەتكۈزۈش دائىرىسىدىن سىرتتا. باشقا ئادرېس ياكى ئۆزىڭىز ئېلىپ كېتىشنى تاللاڭ.
Доставка из выбранного кафе пока недоступна. Выберите самовывоз.|Saýlanan kafeden eltip bermek häzir elýeterli däl. Alyp gitmegi saýlaň.|Расонидан аз ин қаҳвахона ҳоло дастрас нест. Худгирифтро интихоб кунед.|Tanlangan kafedan yetkazish hozircha mavjud emas. Olib ketishni tanlang.|選択したカフェは現在配達に対応していません。持ち帰りを選択してください。|تاللانغان ئاشخانا ھازىرچە يەتكۈزمەيدۇ. ئۆزىڭىز ئېلىپ كېتىشنى تاللاڭ.
Выберите точку доставки на карте, чтобы проверить зону обслуживания.|Hyzmat zolagyny barlamak üçin kartada eltip bermeli nokady saýlaň.|Барои санҷидани ҳудуди хизматрасонӣ нуқтаро дар харита интихоб кунед.|Xizmat hududini tekshirish uchun xaritada yetkazish nuqtasini tanlang.|地図で配達先を選び、配達可能な範囲か確認してください。|مۇلازىمەت دائىرىسىنى تەكشۈرۈش ئۈچۈن خەرىتىدە يەتكۈزۈش نۇقتىسىنى تاللاڭ.
Для доставки нужна точка на карте. Доступ к геолокации необязателен.|Eltip bermek üçin kartada nokat gerek. Ýerleşiş rugsady hökmany däl.|Барои расонидан нуқта дар харита лозим аст. Иҷозати ҷойгиршавӣ ҳатмӣ нест.|Yetkazish uchun xaritada nuqta kerak. Joylashuv ruxsati ixtiyoriy.|配達には地図上のピンが必要です。位置情報へのアクセス許可は任意です。|يەتكۈزۈش ئۈچۈن خەرىتىدە نۇقتا لازىم. ئورۇن ئۇچۇرىغا رۇخسەت بېرىش ئىختىيارىي.
Доставка доступна только в зоне выбранного кафе. Проверьте адрес на карте перед заказом.|Eltip bermek saýlanan kafeniň hyzmat zolagy bilen çäklenýär. Sargytdan öň salgyny kartada barlaň.|Расонидан танҳо дар ҳудуди қаҳвахонаи интихобшуда имконпазир аст. Пеш аз фармоиш суроғаро дар харита санҷед.|Yetkazish faqat tanlangan kafe hududida mavjud. Buyurtmadan oldin manzilni xaritada tekshiring.|配達は選択したカフェのサービス範囲内に限ります。注文前に地図で住所を確認してください。|پەقەت تاللانغان ئاشخانىنىڭ مۇلازىمەت دائىرىسىگە يەتكۈزۈلىدۇ. زاكازدىن بۇرۇن ئادرېسنى خەرىتىدە تەكشۈرۈڭ.
Карта не загрузилась. Проверьте соединение и повторите выбор точки. Без проверки зоны доставка недоступна.|Karta ýüklenmedi. Birikmäni barlap gaýtadan synanyşyň. Eltip bermek üçin zolak barlanmaly.|Харита бор нашуд. Пайвастро санҷида, такрор кунед. Пеш аз расонидан ҳудуд бояд санҷида шавад.|Xarita yuklanmadi. Ulanishni tekshirib qayta urinib ko‘ring. Yetkazish uchun hudud tekshirilishi kerak.|地図を読み込めませんでした。接続を確認して再度お試しください。配達には範囲の確認が必要です。|خەرىتە يۈكلەنمىدى. ئۇلىنىشنى تەكشۈرۈپ قايتا سىناڭ. يەتكۈزۈش ئۈچۈن دائىرە تەكشۈرۈلۈشى كېرەك.
Карта недоступна. Повторите позже или выберите самовывоз.|Karta elýeterli däl. Soňrak synanyşyň ýa-da alyp gitmegi saýlaň.|Харита дастрас нест. Баъдтар такрор кунед ё худгирифтро интихоб кунед.|Xarita mavjud emas. Keyinroq urinib ko‘ring yoki olib ketishni tanlang.|地図を利用できません。後でもう一度試すか、持ち帰りを選択してください。|خەرىتىنى ئىشلەتكىلى بولمايدۇ. كېيىن قايتا سىناڭ ياكى ئۆزىڭىز ئېلىپ كېتىشنى تاللاڭ.
`;
 const catalogue=Object.create(null);
 for(const line of rows.trim().split('\n')){
  const [source,...values]=line.split('|');if(values.length!==codes.length||values.some(x=>!x))throw Error('Incomplete extra-language row: '+source);
  catalogue[source]=Object.fromEntries(codes.map((code,index)=>[code,values[index]]));
 }
 window.ummaExtraTranslations=catalogue;
})();
