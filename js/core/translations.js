/* Reviewed interface copy. Russian keys bridge legacy renderers without changing stored data. */
(() => {
  'use strict';
  const rows = `
Главная|Home|Trang chủ
Ещё|More|Thêm
Кафе|Cafe|Quán ăn
Кафе Umma|UMMA Cafe|Quán UMMA
Мои заказы|My orders|Đơn hàng của tôi
Заказы|Orders|Đơn hàng
События|Events|Sự kiện
Подключаемся…|Connecting…|Đang kết nối…
Ассаляму алейкум ва рахматуллахи ва баракатух,|Assalamu alaykum wa rahmatullahi wa barakatuh,|Assalamu alaykum wa rahmatullahi wa barakatuh,
Ассаляму алейкум|Assalamu alaykum|Assalamu alaykum
ва рахматуллахи ва баракатух,|wa rahmatullahi wa barakatuh,|wa rahmatullahi wa barakatuh,
ва рахматуллахи ва баракатух!|wa rahmatullahi wa barakatuh!|wa rahmatullahi wa barakatuh!
УММА!|UMMA!|UMMA!
Единая экосистема для жизни,|One ecosystem for life,|Một hệ sinh thái cho cuộc sống,
бизнеса и общества.|business and community.|kinh doanh và cộng đồng.
Открыть кафе|Open cafe|Mở quán ăn
АЯТ ДНЯ|VERSE OF THE DAY|CÂU KINH TRONG NGÀY
«И помогайте друг другу|“And help one another|“Và hãy giúp đỡ nhau
в благочестии и богобоязненности...»|in righteousness and piety…”|trong điều thiện và lòng kính sợ Allah…”
Коран, 5:2|Quran, 5:2|Qur'an, 5:2
Сервисы Umma|UMMA services|Dịch vụ UMMA
Все сервисы →|All services →|Tất cả dịch vụ →
Рынок Umma|UMMA Market|Chợ UMMA
Продукты и товары|Food and goods|Thực phẩm và hàng hóa
Путешествия|Travel|Du lịch
Туры, билеты, отели|Tours, tickets, hotels|Tour, vé, khách sạn
Туры, билеты и маршруты|Tours, tickets and routes|Tour, vé và hành trình
Отели Umma|UMMA Hotels|Khách sạn UMMA
Проживание по миру|Stays worldwide|Lưu trú khắp thế giới
Проживание для вас и вашей семьи|Stays for you and your family|Lưu trú cho bạn và gia đình
Недвижимость|Property|Bất động sản
Жильё, аренда, инвестиции|Homes, rentals, investments|Nhà ở, cho thuê, đầu tư
Жильё и аренда|Homes and rentals|Nhà ở và cho thuê
Сообщество|Community|Cộng đồng
Люди, помощь и связи|People, support and connections|Con người, hỗ trợ và kết nối
Бизнес|Business|Kinh doanh
Возможности и партнёрства|Opportunities and partnerships|Cơ hội và hợp tác
Образование|Education|Giáo dục
Школа, медресе, университет|School, madrasa, university|Trường học, madrasa, đại học
Школа, медресе и университет|School, madrasa and university|Trường học, madrasa và đại học
Здоровье|Health|Sức khỏe
Спорт и здоровый образ жизни|Fitness and healthy living|Thể thao và lối sống lành mạnh
Халяльное производство|Halal production|Sản xuất halal
и натуральные продукты|and natural food|và thực phẩm tự nhiên
Подробнее|Learn more|Tìm hiểu thêm
← Назад|← Back|← Quay lại
Назад|Back|Quay lại
← Главная|← Home|← Trang chủ
← К заказам|← Orders|← Đơn hàng
← Назад к заказу|← Back to order|← Quay lại đơn hàng
← Вернуться к меню|← Back to menu|← Quay lại thực đơn
Мы кормим людей|We feed people|Chúng tôi phục vụ mọi người
ради довольства Аллаха|seeking Allah’s pleasure|vì sự hài lòng của Allah
ПРИГОТОВЛЕНО С ЗАБОТОЙ|PREPARED WITH CARE|CHẾ BIẾN TẬN TÂM
Наше меню|Our menu|Thực đơn
Приём заказов временно приостановлен. Меню доступно для просмотра.|Ordering is temporarily paused. You can browse the menu.|Tạm ngừng nhận đơn. Bạn vẫn có thể xem thực đơn.
Найти блюдо|Find a dish|Tìm món ăn
Сбросить|Reset|Đặt lại
Показать всё меню|Show full menu|Xem toàn bộ thực đơn
Загружаем меню…|Loading menu…|Đang tải thực đơn…
Ваш заказ|Your order|Đơn hàng của bạn
Посмотреть / изменить|View / edit|Xem / chỉnh sửa
Как получить заказ|How to receive your order|Cách nhận đơn hàng
В кафе|Dine in|Ăn tại quán
С собой|Takeaway|Mang đi
Доставка|Delivery|Giao hàng
🥡 С собой|🥡 Takeaway|🥡 Mang đi
🛵 Доставка|🛵 Delivery|🛵 Giao hàng
Загружаем кафе…|Loading cafes…|Đang tải quán ăn…
Выбрать другое кафе|Choose another cafe|Chọn quán khác
Как выбрать кафе|How to choose a cafe|Cách chọn quán
Ближайшее кафе по геолокации|Nearest cafe by location|Quán gần nhất theo vị trí
Выбрать кафе вручную|Choose cafe manually|Tự chọn quán
Кафе для заказа|Order from|Quán đặt hàng
Куда доставить?|Where should we deliver?|Giao đến đâu?
Указать на карте|Choose on map|Chọn trên bản đồ
Убрать точку|Remove pin|Xóa điểm
Или введите адрес доставки|Or enter the delivery address|Hoặc nhập địa chỉ giao hàng
Оплата|Payment|Thanh toán
Наличными|Cash|Tiền mặt
QR-кодом|QR code|Mã QR
Перевод на карту|Bank transfer|Chuyển khoản
Перевод на российский / казахстанский банк|Russian / Kazakh bank transfer|Chuyển khoản ngân hàng Nga / Kazakhstan
Оплата курьеру при доставке|Pay courier on delivery|Thanh toán cho người giao hàng
Контактные данные|Contact details|Thông tin liên hệ
Ваш профиль Telegram|Your Telegram profile|Hồ sơ Telegram của bạn
Изменить|Edit|Chỉnh sửa
Имя (необязательно)|Name (optional)|Tên (không bắt buộc)
Телефон (необязательно)|Phone (optional)|Điện thoại (không bắt buộc)
Пожелания к заказу|Order preferences|Yêu cầu cho đơn hàng
Необязательно|Optional|Không bắt buộc
Добавить|Add|Thêm
Комментарий к заказу (необязательно)|Order note (optional)|Ghi chú đơn hàng (không bắt buộc)
Оформить заказ|Place order|Đặt hàng
Проверьте заказ перед подтверждением. Деньги автоматически не списываются.|Review your order before confirming. You will not be charged automatically.|Kiểm tra đơn hàng trước khi xác nhận. Tiền sẽ không tự động bị trừ.
Перейти к заказу|View order|Xem đơn hàng
Статусы, оплата и доставка обновляются автоматически.|Order, payment and delivery statuses update automatically.|Trạng thái đơn hàng, thanh toán và giao hàng tự động cập nhật.
Загружаем ваши заказы…|Loading your orders…|Đang tải đơn hàng của bạn…
↻ Обновить|↻ Refresh|↻ Làm mới
↻ Обновить меню|↻ Refresh menu|↻ Làm mới thực đơn
Итого|Total|Tổng cộng
Состав заказа|Order items|Chi tiết đơn hàng
Сумма заказа|Order total|Tổng tiền đơn hàng
Добавьте блюда из меню.|Add dishes from the menu.|Thêm món từ thực đơn.
Супы|Soups|Súp
Горячее|Main dishes|Món chính
Салаты|Salads|Salad
Выпечка|Bakery|Bánh
Десерты|Desserts|Tráng miệng
Напитки|Drinks|Đồ uống
Соусы|Sauces|Nước sốt
Другое|Other|Khác
Все|All|Tất cả
Описание|Description|Mô tả
В заказе|In your order|Trong đơn hàng
Блюдо|Dish|Món ăn
Халяль|Halal|Halal
Уменьшить|Decrease|Giảm
Увеличить|Increase|Tăng
Ничего не найдено. Измените запрос, выберите другую категорию или нажмите «Показать всё меню».|Nothing found. Change your search, choose another category or show the full menu.|Không tìm thấy. Đổi từ khóa, chọn danh mục khác hoặc xem toàn bộ thực đơn.
В выбранном кафе пока нет товаров с доступным остатком. Выберите другое кафе или попробуйте позже.|No items are available at this cafe. Choose another cafe or try again later.|Quán này hiện chưa có món. Chọn quán khác hoặc thử lại sau.
Новый|New|Mới
Принят|Accepted|Đã nhận
Готовится|Preparing|Đang chuẩn bị
Готов|Ready|Đã sẵn sàng
Выдан|Handed over|Đã giao
Завершён|Completed|Hoàn thành
Отменён|Cancelled|Đã hủy
Не оплачен|Unpaid|Chưa thanh toán
Оплачен|Paid|Đã thanh toán
Оплачено|Paid|Đã thanh toán
Ожидает оплаты|Awaiting payment|Chờ thanh toán
Ожидает подтверждения|Awaiting confirmation|Chờ xác nhận
Ожидает курьера|Waiting for courier|Chờ người giao hàng
Курьер назначен|Courier assigned|Đã phân công người giao
У курьера|With courier|Người giao đã nhận
В пути|On the way|Đang giao
Доставлен|Delivered|Đã giao hàng
История статусов|Status history|Lịch sử trạng thái
Где мой курьер|Track courier|Theo dõi người giao hàng
Нет заказов|No orders|Chưa có đơn hàng
Заказов пока нет.|No orders yet.|Chưa có đơn hàng.
Меню|Menu|Thực đơn
На весь экран|Full screen|Toàn màn hình
Уведомления|Notifications|Thông báo
Закрыть|Close|Đóng
Закрыть карту|Close map|Đóng bản đồ
Очистить поиск|Clear search|Xóa tìm kiếm
Карта для выбора точки доставки|Delivery location map|Bản đồ chọn điểm giao hàng
UMMA MAPS · ДОСТАВКА|UMMA MAPS · DELIVERY|UMMA MAPS · GIAO HÀNG
Куда привезти заказ?|Where should we deliver your order?|Giao đơn hàng đến đâu?
Моё местоположение|My location|Vị trí của tôi
Точная точка доставки|Exact delivery point|Điểm giao hàng chính xác
Доставить сюда|Deliver here|Giao đến đây
Подготовка карты…|Preparing map…|Đang tải bản đồ…
Маршрут доставки|Delivery route|Lộ trình giao hàng
Открыть маршрут в Картах Apple|Open route in Apple Maps|Mở lộ trình trong Apple Maps
Начать навигацию в Google Maps|Navigate with Google Maps|Dẫn đường bằng Google Maps
Готовится к запуску|Coming soon|Sắp ra mắt
Готовится|Preparing|Đang chuẩn bị
Открыть UMMA Cafe|Open UMMA Cafe|Mở quán UMMA
Направления UMMA|UMMA services|Các dịch vụ UMMA
Всё, что нужно нашей семье. Кафе уже работает в приложении; остальные направления готовятся к запуску.|Everything our family needs. The cafe is open in the app; other services are coming soon.|Mọi điều gia đình chúng ta cần. Quán ăn đã hoạt động trong ứng dụng; các dịch vụ khác sắp ra mắt.
Добавить на главный экран телефона|Add to home screen|Thêm vào màn hình chính
Управление Umma Global|Manage UMMA Global|Quản lý UMMA Global
Администрирование|Administration|Quản trị
Центральное управление экосистемой Umma Global.|Central management of the UMMA Global ecosystem.|Quản lý trung tâm hệ sinh thái UMMA Global.
Работа в кафе|Cafe operations|Vận hành quán
Приём заказов|Take orders|Nhận đơn hàng
Оформить заказ, добавить блюда, принять оплату|Take orders, add dishes, accept payments|Nhận đơn, thêm món, nhận thanh toán
Кухня|Kitchen|Bếp
Новые заказы, дозаказы и приготовление|New orders, extra dishes and preparation|Đơn mới, thêm món và chế biến
Курьер|Courier|Người giao hàng
Выбрать себя, принять доставку, фото и GPS|Select yourself, accept delivery, photos and GPS|Chọn tên, nhận giao hàng, ảnh và GPS
Учёт кафе|Cafe accounting|Kế toán quán
Склад, закупки, производство и расходы|Stock, purchases, production and expenses|Kho, mua hàng, sản xuất và chi phí
Пользователи|Users|Người dùng
Роли, статусы и доступ|Roles, statuses and access|Vai trò, trạng thái và quyền truy cập
Заказы кафе|Cafe orders|Đơn hàng của quán
Кухня и статусы заказов|Kitchen and order statuses|Bếp và trạng thái đơn hàng
Локации и карта|Locations and map|Địa điểm và bản đồ
Кафе, склады, адреса и администраторы|Cafes, warehouses, addresses and administrators|Quán, kho, địa chỉ và quản trị viên
Предприниматели|Entrepreneurs|Doanh nhân
Бизнесы и владельцы|Businesses and owners|Doanh nghiệp và chủ sở hữu
Сотрудники|Staff|Nhân viên
Рабочие доступы|Staff access|Quyền truy cập nhân viên
Товары и инвентарь|Products and inventory|Sản phẩm và hàng tồn
Каталог и остатки|Catalogue and stock|Danh mục và tồn kho
Закупки, склад, производство, расходы|Purchases, stock, production, expenses|Mua hàng, kho, sản xuất, chi phí
Заказы и статусы|Orders and statuses|Đơn hàng và trạng thái
Управление кафе|Manage cafe|Quản lý quán
⚙️ Управление кафе|⚙️ Manage cafe|⚙️ Quản lý quán
📦 Товары, цены и остатки|📦 Products, prices and stock|📦 Sản phẩm, giá và tồn kho
👥 Сотрудники моего кафе|👥 My cafe staff|👥 Nhân viên quán của tôi
Доступ подтверждён|Access granted|Đã cấp quyền truy cập
Раздел открыт|Section opened|Đã mở mục
← Администрирование|← Administration|← Quản trị
Все локации|All locations|Tất cả địa điểm
＋ Новая локация|＋ New location|＋ Địa điểm mới
Добавить новую локацию|Add location|Thêm địa điểm
Название кафе / места|Cafe / location name|Tên quán / địa điểm
Тип локации|Location type|Loại địa điểm
Ресторан|Restaurant|Nhà hàng
Склад|Warehouse|Kho
Магазин|Shop|Cửa hàng
Адрес|Address|Địa chỉ
Город / остров|City / island|Thành phố / đảo
Страна|Country|Quốc gia
Телефон места (необязательно)|Location phone (optional)|Điện thoại địa điểm (không bắt buộc)
⌕ Найти адрес на карте|⌕ Find address on map|⌕ Tìm địa chỉ trên bản đồ
Широта|Latitude|Vĩ độ
Долгота|Longitude|Kinh độ
Главный администратор кафе|Cafe administrator|Quản trị viên quán
Загружаем список пользователей…|Loading users…|Đang tải người dùng…
Локация активна|Location active|Địa điểm hoạt động
Сохранить локацию|Save location|Lưu địa điểm
Товары кафе|Cafe products|Sản phẩm của quán
Добавить товар|Add product|Thêm sản phẩm
Название на русском|Russian name|Tên tiếng Nga
Название на английском|English name|Tên tiếng Anh
Название на вьетнамском|Vietnamese name|Tên tiếng Việt
Категория|Category|Danh mục
Без категории|Uncategorised|Chưa phân loại
Цена, VND|Price, VND|Giá, VND
Вес / объём|Weight / volume|Khối lượng / thể tích
Единица|Unit|Đơn vị
граммы|grams|gam
миллилитры|millilitres|mililít
Описание на русском|Russian description|Mô tả tiếng Nga
Описание на вьетнамском|Vietnamese description|Mô tả tiếng Việt
Описание на английском|English description|Mô tả tiếng Anh
URL фото (необязательно)|Photo URL (optional)|URL ảnh (không bắt buộc)
Артикул (необязательно)|SKU (optional)|Mã hàng (không bắt buộc)
Сохранить товар|Save product|Lưu sản phẩm
Очистить|Clear|Xóa
Каталог|Catalogue|Danh mục sản phẩm
Сотрудники кафе|Cafe staff|Nhân viên quán
Назначение ролей и доступов по филиалам Umma|Assign roles and access by UMMA branch|Phân quyền theo chi nhánh UMMA
Назначить сотрудника|Assign staff member|Phân công nhân viên
Telegram ID пользователя|User Telegram ID|Telegram ID của người dùng
Кафе / филиал|Cafe / branch|Quán / chi nhánh
Загружаем список кафе…|Loading cafes…|Đang tải danh sách quán…
Должность|Role|Chức vụ
Менеджер — все статусы заказов|Manager — all order statuses|Quản lý — mọi trạng thái đơn
Кассир|Cashier|Thu ngân
Официант|Waiter|Phục vụ
Курьер — забор и подтверждение доставки|Courier — pickup and delivery confirmation|Người giao — nhận và xác nhận giao hàng
Сохранить назначение|Save assignment|Lưu phân công
Назначенные сотрудники|Assigned staff|Nhân viên đã phân công
🍳 Кухня|🍳 Kitchen|🍳 Bếp
＋ Оформить заказ|＋ Place order|＋ Đặt hàng
📋 Активные заказы|📋 Active orders|📋 Đơn đang xử lý
✓ Закрытые заказы|✓ Closed orders|✓ Đơn đã đóng
Оформить заказ гостя|Place guest order|Đặt hàng cho khách
Выберите кафе|Choose cafe|Chọn quán
Где обслуживаем гостя?|Where is the guest seated?|Khách ngồi ở đâu?
Передняя зона|Front area|Khu phía trước
Задняя зона|Rear area|Khu phía sau
Другой способ получения|Other fulfilment method|Cách nhận khác
Тип заказа|Order type|Loại đơn hàng
Стол или имя гостя|Table or guest name|Bàn hoặc tên khách
Как подобрать курьера|Courier assignment|Phân công người giao hàng
Сначала ближайшему свободному курьеру|Nearest available courier first|Ưu tiên người giao gần nhất
Свободный выбор курьерами кафе|Open to cafe couriers|Người giao của quán tự chọn
Адрес доставки|Delivery address|Địa chỉ giao hàng
Комментарий|Note|Ghi chú
Когда оплатит гость|When will the guest pay?|Khách thanh toán khi nào?
Сейчас, до передачи заказа|Now, before handover|Ngay, trước khi nhận đơn
После трапезы — общий счёт|After the meal — one bill|Sau bữa ăn — một hóa đơn
При получении — наличными курьеру|Cash to courier on delivery|Tiền mặt cho người giao khi nhận
Способ оплаты|Payment method|Phương thức thanh toán
Получено от гостя, VND|Cash received, VND|Tiền khách đưa, VND
Сдача гостю|Change due|Tiền thừa trả khách
Введите сумму, которую гость передал наличными.|Enter the cash received from the guest.|Nhập số tiền mặt khách đã đưa.
Отправить заказ на кухню|Send order to kitchen|Gửi đơn đến bếp
Активные заказы|Active orders|Đơn đang xử lý
Загружаем заказы…|Loading orders…|Đang tải đơn hàng…
Закрытые заказы|Closed orders|Đơn đã đóng
Настройки кухни|Kitchen settings|Cài đặt bếp
▣ Режим планшета|▣ Tablet mode|▣ Chế độ máy tính bảng
💰 Касса и смена|💰 Register and shift|💰 Thu ngân và ca làm
Кухня · Заказы|Kitchen · Orders|Bếp · Đơn hàng
HALAL UMMA · Нячанг|HALAL UMMA · Nha Trang|HALAL UMMA · Nha Trang
📋 Приём заказов|📋 Take orders|📋 Nhận đơn hàng
Кафе и доступ курьера|Cafe and courier access|Quán và quyền người giao hàng
Я — курьер|I am a courier|Tôi là người giao hàng
Я доступен как курьер|Available for deliveries|Sẵn sàng giao hàng
Завершить работу курьером|End courier shift|Kết thúc ca giao hàng
Активные|Active|Đang hoạt động
Закрытые|Closed|Đã đóng
Товары и остатки|Products and stock|Sản phẩm và tồn kho
＋ Добавить товар в каталог|＋ Add catalogue product|＋ Thêm sản phẩm vào danh mục
Количество|Quantity|Số lượng
Вес/объём|Weight/volume|Khối lượng/thể tích
Наличие и цены по выбранному кафе|Stock and prices for this cafe|Tồn kho và giá của quán này
Филиал|Branch|Chi nhánh
Автообновление раз в минуту|Updates every minute|Cập nhật mỗi phút
Обзор|Overview|Tổng quan
Закупки|Purchases|Mua hàng
Производство|Production|Sản xuất
Расходы|Expenses|Chi phí
Поставщики|Suppliers|Nhà cung cấp
Рецептуры|Recipes|Công thức
Принять|Accept|Nhận
Готово|Ready|Xong
Выдать|Hand over|Giao
Отменить|Cancel|Hủy
Сохранить|Save|Lưu
Ошибка соединения с сервером|Server connection error|Lỗi kết nối máy chủ
Доступ запрещён|Access denied|Không có quyền truy cập
Загрузка…|Loading…|Đang tải…
Повторить|Retry|Thử lại
Оплатить|Pay|Thanh toán
Оплатить по QR|Pay by QR|Thanh toán bằng QR
Скачать QR|Download QR|Tải mã QR
Скриншот оплаты|Payment screenshot|Ảnh chụp thanh toán
Отправить скриншот|Send screenshot|Gửi ảnh chụp
Ожидаем информацию от банка|Waiting for bank confirmation|Đang chờ xác nhận từ ngân hàng
Построить маршрут|Get directions|Chỉ đường
Товар передал|Order delivered|Đã giao đơn hàng
Забрать заказ|Pick up order|Nhận đơn hàng
Пользователи Umma Global, роли, статусы и доступ.|UMMA Global users, roles, statuses and access.|Người dùng UMMA Global, vai trò, trạng thái và quyền truy cập.
Следующим шагом подключим данные из telegram_users.|User data integration is planned next.|Dữ liệu người dùng sẽ được kết nối ở bước tiếp theo.
Добавляйте кафе, склады и другие точки. Положение на карте будет использоваться для выбора филиала и построения маршрутов доставки.|Add cafes, warehouses and other locations. Map positions are used for branch selection and delivery routes.|Thêm quán, kho và địa điểm khác. Vị trí trên bản đồ được dùng để chọn chi nhánh và lập lộ trình giao hàng.
Карта OpenStreetMap. Нажмите на карту, чтобы поставить точку, или перетащите маркер. Поиск адреса помогает найти приблизительное место — всегда проверяйте положение.|OpenStreetMap. Tap to place a pin or drag the marker. Address search is approximate; always check the position.|Bản đồ OpenStreetMap. Chạm để đặt điểm hoặc kéo dấu ghim. Tìm địa chỉ chỉ cho vị trí gần đúng; luôn kiểm tra lại.
У каждого кафе один главный администратор. Один администратор может управлять несколькими кафе. Только суперадминистратор назначает главного администратора.|Each cafe has one administrator. An administrator may manage several cafes. Only the superadmin can appoint administrators.|Mỗi quán có một quản trị viên chính. Một người có thể quản lý nhiều quán. Chỉ quản trị viên cấp cao được bổ nhiệm.
Добавляйте и редактируйте блюда. Скрытие не удаляет историю заказов.|Add and edit dishes. Hiding a dish preserves order history.|Thêm và sửa món. Ẩn món không xóa lịch sử đơn hàng.
Пользователь должен хотя бы один раз открыть Umma Global. Если его роль «user», она автоматически изменится на employee.|The user must open UMMA Global at least once. The user role will automatically change to employee.|Người dùng phải mở UMMA Global ít nhất một lần. Vai trò user sẽ tự đổi thành employee.
Рабочее место приёма заказов · HALAL UMMA|Order desk · HALAL UMMA|Quầy nhận đơn · HALAL UMMA
Сотрудник принимает заказ, добавляет блюда и оформляет оплату. Заказ автоматически появляется на отдельном экране кухни.|Staff take orders, add dishes and accept payments. Orders appear automatically on the kitchen screen.|Nhân viên nhận đơn, thêm món và nhận thanh toán. Đơn tự xuất hiện trên màn hình bếp.
Передняя зона — столы 1–5, задняя зона — стол 6.|Front area: tables 1–5. Rear area: table 6.|Khu trước: bàn 1–5. Khu sau: bàn 6.
Нажмите стол или «С собой», затем добавляйте блюда.|Choose a table or takeaway, then add dishes.|Chọn bàn hoặc mang đi, sau đó thêm món.
Создай заказ для гостя здесь. Для контроля уже оформленных заказов открой вкладку «Активные заказы».|Create a guest order here. Track existing orders in Active orders.|Tạo đơn cho khách tại đây. Theo dõi đơn đã đặt trong Đơn đang xử lý.
При оплате позже все новые блюда будут добавляться в один открытый счёт. Оплата — после завершения трапезы.|When paying later, extra dishes go on the same open bill. Pay after the meal.|Khi thanh toán sau, món thêm được tính chung vào hóa đơn đang mở. Thanh toán sau bữa ăn.
Все незавершённые заказы кафе: оплата, сумма и текущий этап выполнения.|All open cafe orders: payment, amount and progress.|Tất cả đơn chưa hoàn thành: thanh toán, số tiền và tiến độ.
Завершённые и отменённые заказы. Статус оплаты указан отдельно.|Completed and cancelled orders. Payment status is shown separately.|Đơn hoàn thành và đã hủy. Trạng thái thanh toán được hiển thị riêng.
Голосовые подсказки доступны в приложении Google Maps. При переключении из Telegram передача позиции клиенту может приостановиться.|Voice guidance is available in Google Maps. Leaving Telegram may pause live location sharing.|Dẫn đường bằng giọng nói có trong Google Maps. Rời Telegram có thể tạm dừng chia sẻ vị trí.
Принимайте доставку ниже. Фото и GPS включаются после назначения заказа.|Accept deliveries below. Photos and GPS are enabled after assignment.|Nhận giao hàng bên dưới. Ảnh và GPS được bật sau khi phân công đơn.
Цены и наличие отдельно для каждого кафе HALAL UMMA.|Prices and stock are managed separately for each HALAL UMMA cafe.|Giá và tồn kho được quản lý riêng cho từng quán HALAL UMMA.
Закупки, склад, производство и расходы по филиалам.|Purchases, stock, production and expenses by branch.|Mua hàng, kho, sản xuất và chi phí theo chi nhánh.
Оплата заказа|Order payment|Thanh toán đơn hàng
Закрыть оплату|Close payment|Đóng thanh toán
Уже перевели?|Already transferred?|Đã chuyển khoản?
Прикрепите фото или скриншот перевода. JPG, PNG или WEBP до 5 МБ.|Attach a transfer photo or screenshot. JPG, PNG or WEBP up to 5 MB.|Đính kèm ảnh chuyển khoản. JPG, PNG hoặc WEBP tối đa 5 MB.
Выбрать скриншот|Choose screenshot|Chọn ảnh chụp
Скриншот подтверждения оплаты|Payment confirmation screenshot|Ảnh xác nhận thanh toán
Выбранный скриншот перевода|Selected transfer screenshot|Ảnh chuyển khoản đã chọn
Отправить чек|Send receipt|Gửi biên lai
Чек проверен сотрудником.|Receipt verified by staff.|Nhân viên đã xác minh biên lai.
Чек отклонён. Проверьте перевод и прикрепите другой скриншот.|Receipt rejected. Check your transfer and attach another screenshot.|Biên lai bị từ chối. Kiểm tra chuyển khoản và đính kèm ảnh khác.
Чек отправлен на проверку. Оплату подтвердит сотрудник после поступления денег.|Receipt sent for review. Staff will confirm payment after the money arrives.|Đã gửi biên lai để kiểm tra. Nhân viên xác nhận khi nhận được tiền.
Выберите JPG, PNG или WEBP до 5 МБ.|Choose JPG, PNG or WEBP up to 5 MB.|Chọn JPG, PNG hoặc WEBP tối đa 5 MB.
Скриншот выбран. Нажмите «Отправить чек».|Screenshot selected. Tap Send receipt.|Đã chọn ảnh. Nhấn Gửi biên lai.
Не удалось прочитать фото. Выберите его ещё раз.|Could not read the photo. Select it again.|Không đọc được ảnh. Vui lòng chọn lại.
Отправляем…|Sending…|Đang gửi…
Не удалось отправить чек|Could not send receipt|Không gửi được biên lai
Чек отправлен|Receipt sent|Đã gửi biên lai
Скриншот отправлен. Ожидайте проверки кафе.|Screenshot sent. Await cafe verification.|Đã gửi ảnh. Vui lòng chờ quán kiểm tra.
Ответ задерживается. Откройте оплату ещё раз, чтобы проверить отправку чека.|The response is delayed. Reopen payment to check whether the receipt was sent.|Phản hồi chậm. Mở lại thanh toán để kiểm tra biên lai đã gửi chưa.
Не удалось отправить чек. Попробуйте ещё раз.|Could not send receipt. Try again.|Không gửi được biên lai. Thử lại.
Повторить отправку|Send again|Gửi lại
Не удалось проверить ранее отправленные чеки. Если вы уже отправляли чек, откройте оплату ещё раз перед повторной отправкой.|Could not check previous receipts. If you already sent one, reopen payment before resending.|Không kiểm tra được biên lai trước. Nếu đã gửi, hãy mở lại thanh toán trước khi gửi lại.
Чек отправляется…|Sending receipt…|Đang gửi biên lai…
Некорректные реквизиты|Invalid payment details|Thông tin thanh toán không hợp lệ
Ваш банк|Your bank|Ngân hàng của bạn
Оплата подтвердится автоматически. Скриншот не нужен.|Payment will be confirmed automatically. No screenshot needed.|Thanh toán sẽ tự xác nhận. Không cần ảnh chụp.
Показать QR-код|Show QR code|Hiện mã QR
Сохранить QR для оплаты|Save payment QR|Lưu mã QR thanh toán
Сохранить QR|Save QR|Lưu mã QR
Открыть QR и сохранить изображение|Open QR and save image|Mở QR và lưu ảnh
Не удалось получить ссылку на QR|Could not get QR link|Không lấy được liên kết QR
Подготавливаем QR…|Preparing QR…|Đang chuẩn bị QR…
Не удалось подготовить QR|Could not prepare QR|Không chuẩn bị được QR
Заказ изменился. Закройте оплату и откройте её снова.|Order changed. Close payment and reopen it.|Đơn hàng đã thay đổi. Đóng và mở lại thanh toán.
QR готов. Нажмите «Сохранить QR» ещё раз.|QR ready. Tap Save QR again.|QR đã sẵn sàng. Nhấn Lưu mã QR lần nữa.
Подтвердите скачивание в Telegram. Если окно не появилось, используйте ссылку ниже.|Confirm the download in Telegram. If no dialog appears, use the link below.|Xác nhận tải xuống trong Telegram. Nếu không thấy hộp thoại, dùng liên kết bên dưới.
Скачивание запрошено. После загрузки выберите QR в банке.|Download requested. Once saved, select the QR in your bank app.|Đã yêu cầu tải xuống. Sau khi lưu, chọn QR trong ứng dụng ngân hàng.
Сохранение отменено. Можно повторить или открыть изображение по ссылке ниже.|Save cancelled. Try again or open the image using the link below.|Đã hủy lưu. Thử lại hoặc mở ảnh bằng liên kết bên dưới.
Открыта загрузка QR. Если она не началась, нажмите ссылку ниже.|QR download opened. If it did not start, tap the link below.|Đã mở tải QR. Nếu chưa bắt đầu, nhấn liên kết bên dưới.
Не удалось сохранить QR|Could not save QR|Không lưu được QR
Сохраните QR на телефон или сделайте скриншот.|Save the QR to your phone or take a screenshot.|Lưu QR vào điện thoại hoặc chụp màn hình.
Откройте Vietcombank → QR → выберите изображение из галереи.|Open Vietcombank → QR → choose the image from your gallery.|Mở Vietcombank → QR → chọn ảnh từ thư viện.
Проверьте получателя и подтвердите перевод.|Check the recipient and confirm the transfer.|Kiểm tra người nhận và xác nhận chuyển khoản.
Сумма и номер заказа уже в QR. Не меняйте их при оплате.|The QR contains the amount and order number. Do not change them.|QR đã có số tiền và số đơn hàng. Không thay đổi khi thanh toán.
Выберите сохранённый QR в сканере банка. Сумма и номер заказа уже указаны.|Select the saved QR in your bank scanner. The amount and order number are included.|Chọn QR đã lưu trong trình quét ngân hàng. Đã có số tiền và số đơn.
Открыть банк снова|Reopen bank app|Mở lại ngân hàng
Ждём подтверждение банка… Если уже оплатили, не переводите повторно.|Waiting for bank confirmation… If you have paid, do not transfer again.|Đang chờ ngân hàng xác nhận… Nếu đã thanh toán, đừng chuyển lại.
Оплатили, но статус не изменился?|Paid but the status has not changed?|Đã trả tiền nhưng trạng thái chưa đổi?
Не оплачивайте повторно. Если изменили сумму или назначение, автоматическое подтверждение не сработает. Отправьте скриншот: сотрудник проверит поступление и поможет с разницей в сумме.|Do not pay again. If you changed the amount or reference, automatic confirmation will not work. Send a screenshot so staff can check and resolve any difference.|Đừng thanh toán lại. Nếu đổi số tiền hoặc nội dung, xác nhận tự động sẽ không hoạt động. Gửi ảnh để nhân viên kiểm tra và xử lý chênh lệch.
Загружаем реквизиты…|Loading payment details…|Đang tải thông tin thanh toán…
Откройте приложение через Telegram.|Open the app through Telegram.|Mở ứng dụng qua Telegram.
Откройте приложение через Telegram|Open the app through Telegram|Mở ứng dụng qua Telegram
Не удалось загрузить оплату|Could not load payment|Không tải được thanh toán
✓ Оплачено|✓ Paid|✓ Đã thanh toán
Спасибо! Оплата заказа подтверждена.|Thank you! Your payment is confirmed.|Cảm ơn! Thanh toán đã được xác nhận.
Нет связи. Проверим оплату автоматически после восстановления.|Offline. Payment will be checked automatically when connected.|Mất kết nối. Sẽ tự kiểm tra thanh toán khi có mạng.
Проверяем поступление оплаты…|Checking payment…|Đang kiểm tra thanh toán…
Точка доставки|Delivery point|Điểm giao hàng
Место доставки отмечено на карте|Delivery location marked on map|Đã đánh dấu điểm giao hàng
Выберите точку на карте или введите полный адрес ниже.|Choose a map point or enter the full address below.|Chọn điểm trên bản đồ hoặc nhập địa chỉ đầy đủ bên dưới.
Изменить точку на карте|Change map point|Đổi điểm trên bản đồ
Проверьте точку и подтвердите доставку сюда.|Check the point and confirm delivery here.|Kiểm tra điểm và xác nhận giao tại đây.
Проверьте точку и нажмите «Доставить сюда».|Check the point and tap Deliver here.|Kiểm tra điểm và nhấn Giao đến đây.
Передвиньте карту или нажмите на нужное здание. Затем подтвердите точку.|Move the map or tap the building, then confirm the point.|Di chuyển bản đồ hoặc chạm tòa nhà, rồi xác nhận điểm.
Карта не загрузилась. Закройте окно и введите адрес вручную либо повторите позже.|Map did not load. Close it and enter your address manually or try later.|Không tải được bản đồ. Đóng và nhập địa chỉ hoặc thử lại sau.
Карта недоступна. Можно закрыть окно и ввести адрес вручную.|Map unavailable. Close it and enter your address manually.|Bản đồ không khả dụng. Đóng và nhập địa chỉ thủ công.
Геолокация недоступна. Поставьте точку на карте вручную.|Location unavailable. Place a pin manually.|Không có vị trí. Hãy tự đặt điểm trên bản đồ.
Определяем…|Locating…|Đang định vị…
Разрешите доступ к местоположению. Затем проверьте найденную точку.|Allow location access, then check the point.|Cho phép truy cập vị trí rồi kiểm tra điểm tìm được.
Не удалось определить точку. Выберите её на карте.|Could not locate you. Choose a point on the map.|Không xác định được vị trí. Chọn điểm trên bản đồ.
Не удалось получить геолокацию. Проверьте разрешение или поставьте точку вручную.|Could not get location. Check permissions or place a pin manually.|Không lấy được vị trí. Kiểm tra quyền hoặc tự đặt điểm.
Доступ к геолокации недоступен. Поставьте точку на карте вручную.|Location access unavailable. Place a pin manually.|Không truy cập được vị trí. Hãy tự đặt điểm.
Нажмите на нужное здание или передвиньте карту к месту доставки. Затем нажмите «Доставить сюда».|Tap the building or move the map to your delivery location. Then tap Deliver here.|Chạm tòa nhà hoặc di chuyển bản đồ đến điểm giao. Sau đó nhấn Giao đến đây.
Приём заказов приостановлен|Ordering paused|Tạm ngừng nhận đơn
Оформляем заказ…|Placing order…|Đang đặt hàng…
Не удалось загрузить меню|Could not load menu|Không tải được thực đơn
Ошибка загрузки меню|Menu loading error|Lỗi tải thực đơn
Приём заказов временно приостановлен.|Ordering is temporarily paused.|Tạm ngừng nhận đơn hàng.
Выберите кафе, в котором хотите заказать.|Choose the cafe to order from.|Chọn quán để đặt hàng.
Геолокация недоступна на этом устройстве. Выберите кафе вручную.|Location unavailable on this device. Choose a cafe manually.|Thiết bị không hỗ trợ vị trí. Hãy tự chọn quán.
Определяем ваше местоположение…|Finding your location…|Đang tìm vị trí của bạn…
Не удалось выбрать кафе. Выберите его вручную.|Could not select a cafe. Choose manually.|Không chọn được quán. Hãy tự chọn.
Доступ к геолокации не разрешён. Выберите кафе вручную.|Location permission denied. Choose a cafe manually.|Chưa cho phép vị trí. Hãy tự chọn quán.
Не удалось определить геолокацию. Выберите кафе вручную.|Could not locate you. Choose a cafe manually.|Không định vị được. Hãy tự chọn quán.
Максимум 99 единиц одного блюда|Maximum 99 of each dish|Tối đa 99 phần mỗi món
Профиль Telegram|Telegram profile|Hồ sơ Telegram
Наличными в кафе|Cash at cafe|Tiền mặt tại quán
QR-оплата заранее либо наличными курьеру при получении.|Pay by QR in advance or cash to the courier on delivery.|Trả trước bằng QR hoặc tiền mặt cho người giao khi nhận.
Для заказа с собой оплата производится сразу.|Takeaway orders are paid upfront.|Đơn mang đi thanh toán ngay.
В кафе можно оплатить сразу или после трапезы.|Dine-in orders can be paid now or after your meal.|Ăn tại quán có thể trả ngay hoặc sau bữa ăn.
Квартира, этаж, ориентир (необязательно)|Apartment, floor, landmark (optional)|Căn hộ, tầng, mốc chỉ đường (không bắt buộc)
Сначала добавьте блюда в заказ|Add dishes to your order first|Hãy thêm món trước
Укажите адрес доставки|Enter delivery address|Nhập địa chỉ giao hàng
Оплата позже возможна только в кафе|Pay later is available for dine-in only|Chỉ được trả sau khi ăn tại quán
Не удалось оформить заказ|Could not place order|Không đặt được hàng
Не удалось прочитать файл|Could not read file|Không đọc được tệp
Ошибка отправки|Sending error|Lỗi gửi
Чек отправлен. Ожидайте подтверждения сотрудником кафе.|Receipt sent. Await confirmation from cafe staff.|Đã gửi biên lai. Chờ nhân viên quán xác nhận.
Ошибка оформления заказа|Order error|Lỗi đặt hàng
Принят кафе|Accepted by cafe|Quán đã nhận
Готов к выдаче|Ready for pickup|Sẵn sàng để nhận
Курьер принял заказ|Courier accepted order|Người giao đã nhận đơn
Курьер в пути|Courier on the way|Người giao đang đến
Доставлено|Delivered|Đã giao hàng
Не удалось загрузить заказы|Could not load orders|Không tải được đơn hàng
У вас пока нет заказов.|You have no orders yet.|Bạn chưa có đơn hàng.
Оплата возвращена|Payment refunded|Đã hoàn tiền
Ожидается оплата|Awaiting payment|Chờ thanh toán
Закрыть выбор|Close selection|Đóng lựa chọn
Выберите вариант|Choose an option|Chọn một phương án
Курьер ещё не забрал заказ.|Courier has not picked up the order yet.|Người giao chưa nhận hàng.
Курьер пока не передаёт позицию.|Courier is not sharing location yet.|Người giao chưa chia sẻ vị trí.
Нет свежей позиции. GPS или связь временно недоступны.|No recent location. GPS or connection temporarily unavailable.|Chưa có vị trí mới. GPS hoặc mạng tạm thời không khả dụng.
Заказ доставлен.|Order delivered.|Đã giao đơn hàng.
Отслеживание завершено или недоступно.|Tracking ended or unavailable.|Theo dõi đã kết thúc hoặc không khả dụng.
Курьер на карте|Courier on map|Người giao trên bản đồ
Ожидаем позицию|Waiting for location|Đang chờ vị trí
Позиция недоступна.|Location unavailable.|Vị trí không khả dụng.
Нет свежей позиции|No recent location|Chưa có vị trí mới
Ждём свежую позицию курьера. Проверьте подключение к интернету.|Waiting for courier location. Check your internet connection.|Đang chờ vị trí mới của người giao. Kiểm tra kết nối mạng.
Связь потеряна или позиция устарела. Ожидаем обновление…|Connection lost or location outdated. Waiting for update…|Mất kết nối hoặc vị trí đã cũ. Đang chờ cập nhật…
Выбрать язык|Choose language|Chọn ngôn ngữ
UMMA Global — золотой символ U на бирюзовом фоне с орнаментом и земным шаром|UMMA Global — golden U on turquoise with ornament and globe|UMMA Global — chữ U vàng trên nền ngọc lam với hoa văn và địa cầu
Например, HALAL UMMA — филиал 2|For example, HALAL UMMA — branch 2|Ví dụ, HALAL UMMA — chi nhánh 2
Улица, дом, район|Street, building, district|Đường, số nhà, quận
Город или остров|City or island|Thành phố hoặc đảo
Выберите точку|Choose a point|Chọn một điểm
Например, 123456789|For example, 123456789|Ví dụ, 123456789
Работа с заказами|Order management|Quản lý đơn hàng
Выберите стол выше или укажите имя|Choose a table above or enter a name|Chọn bàn ở trên hoặc nhập tên
Например, без острого|For example, no chilli|Ví dụ, không cay
Например, 200000|For example, 200000|Ví dụ, 200000
Кафе UMMA|UMMA Cafe|Quán UMMA
Название или ингредиент|Dish name or ingredient|Tên món hoặc nguyên liệu
Категории меню|Menu categories|Danh mục thực đơn
Меню кафе|Cafe menu|Thực đơn quán
Улица, дом, квартира или ориентир|Street, building, apartment or landmark|Đường, số nhà, căn hộ hoặc mốc chỉ đường
Ваше имя|Your name|Tên của bạn
Для связи по заказу|For order enquiries|Để liên hệ về đơn hàng
Например, соус отдельно|For example, sauce on the side|Ví dụ, để nước sốt riêng
Разделы учёта|Accounting sections|Các mục kế toán
Основные разделы|Main sections|Các mục chính
Статус: ожидает подтверждения кафе.|Status: awaiting cafe confirmation.|Trạng thái: chờ quán xác nhận.
Внимание: уведомление сотрудникам не подтверждено. Свяжитесь с кафе, если заказ срочный.|Staff notification is unconfirmed. Contact the cafe if your order is urgent.|Chưa xác nhận thông báo đến nhân viên. Liên hệ quán nếu đơn cần gấp.
QR с суммой заказа готов. Оплату подтвердит кафе после поступления денег.|Your order QR is ready. The cafe will confirm payment when the money arrives.|QR đã có số tiền đơn hàng. Quán xác nhận khi nhận được tiền.
Переведите сумму по реквизитам, полученным от кафе. Приложите скриншот перевода. Оплату подтвердит сотрудник после проверки поступления денег.|Transfer the amount using the cafe’s bank details and attach a screenshot. Staff will confirm after checking receipt of funds.|Chuyển tiền theo thông tin ngân hàng của quán và đính kèm ảnh. Nhân viên xác nhận sau khi kiểm tra đã nhận tiền.
Скриншот перевода|Transfer screenshot|Ảnh chuyển khoản
Проверьте метку и при необходимости передвиньте её.|Check the pin and move it if needed.|Kiểm tra dấu ghim và di chuyển nếu cần.
Онлайн|Online|Trực tuyến
Связь прервана|Connection lost|Mất kết nối
Онлайн: автоматическое обновление включено|Online: automatic updates enabled|Trực tuyến: đã bật cập nhật tự động
Связь прервана: повторяем подключение|Connection lost: reconnecting|Mất kết nối: đang kết nối lại
Доставляем только в пределах зоны на карте. Выберите точку доставки.|We deliver only within the area shown on the map. Choose a delivery point.|Chúng tôi chỉ giao trong khu vực trên bản đồ. Hãy chọn điểm giao hàng.
Адрес входит в зону доставки.|This address is within our delivery area.|Địa chỉ này nằm trong khu vực giao hàng.
Этот адрес вне зоны доставки выбранного кафе. Выберите другой адрес или самовывоз.|This address is outside the selected cafe’s delivery area. Choose another address or pickup.|Địa chỉ này ngoài khu vực giao hàng của quán đã chọn. Hãy chọn địa chỉ khác hoặc tự đến lấy.
Доставка из выбранного кафе пока недоступна. Выберите самовывоз.|Delivery from the selected cafe is currently unavailable. Please choose pickup.|Quán đã chọn hiện chưa giao hàng. Vui lòng chọn tự đến lấy.
Выберите точку доставки на карте, чтобы проверить зону обслуживания.|Choose a delivery point on the map to check coverage.|Chọn điểm giao hàng trên bản đồ để kiểm tra phạm vi phục vụ.
Для доставки нужна точка на карте. Доступ к геолокации необязателен.|Delivery requires a map pin. Location permission is optional.|Cần ghim điểm trên bản đồ để giao hàng. Không bắt buộc cấp quyền vị trí.
Доставка доступна только в зоне выбранного кафе. Проверьте адрес на карте перед заказом.|Delivery is available only within the selected cafe’s service area. Check your address on the map before ordering.|Chỉ giao trong khu vực phục vụ của quán đã chọn. Kiểm tra địa chỉ trên bản đồ trước khi đặt.
Карта не загрузилась. Проверьте соединение и повторите выбор точки. Без проверки зоны доставка недоступна.|The map did not load. Check your connection and try again. Delivery requires coverage verification.|Không tải được bản đồ. Kiểm tra kết nối và thử lại. Cần xác minh khu vực trước khi giao hàng.
Карта недоступна. Повторите позже или выберите самовывоз.|The map is unavailable. Try later or choose pickup.|Bản đồ không khả dụng. Thử lại sau hoặc chọn tự đến lấy.
`;
 const catalogue = Object.create(null);
 for (const row of rows.trim().split('\n')) { const [ru,en,vi]=row.split('|'); if(!ru||!en||!vi)throw Error('Invalid translation row'); catalogue[ru]={en,vi}; }
 for(const [source,values] of Object.entries(window.ummaAdditionalTranslations||{}))catalogue[source]={...catalogue[source],...values};
 window.ummaTranslations=Object.freeze(catalogue);
})();
