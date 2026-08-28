<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">

  <title>Umma Global</title>

  <script src="https://telegram.org/js/telegram-web-app.js"></script>

  <style>
    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      font-family: Arial, sans-serif;
      background: #f5f7fa;
      color: #17202a;
    }

    .container {
      max-width: 600px;
      margin: auto;
      padding: 24px 16px 40px;
    }

    .header {
      text-align: center;
      padding: 20px 0 30px;
    }

    .logo {
      width: 82px;
      height: 82px;
      margin: auto;
      border-radius: 50%;
      background: #2196e0;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 28px;
      font-weight: bold;
    }

    h1 {
      margin: 16px 0 8px;
      font-size: 30px;
    }

    .subtitle {
      color: #68737d;
      line-height: 1.5;
    }

    .welcome {
      background: white;
      border-radius: 18px;
      padding: 20px;
      margin-bottom: 24px;
    }

    .welcome h2 {
      margin: 0 0 8px;
      font-size: 20px;
    }

    .welcome p {
      margin: 0;
      color: #68737d;
    }

    .section-title {
      font-size: 20px;
      font-weight: bold;
      margin-bottom: 14px;
    }

    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }

    .card {
      border: 0;
      background: white;
      border-radius: 18px;
      padding: 20px 16px;
      text-align: left;
      min-height: 130px;
      color: #17202a;
      cursor: pointer;
      font-family: inherit;
    }

    .card:active {
      transform: scale(0.98);
    }

    .icon {
      font-size: 30px;
      margin-bottom: 12px;
    }

    .card h3 {
      margin: 0 0 6px;
      font-size: 17px;
    }

    .card p {
      margin: 0;
      font-size: 13px;
      color: #68737d;
      line-height: 1.4;
    }

    .mission {
      margin-top: 24px;
      padding: 22px;
      border-radius: 18px;
      background: #2196e0;
      color: white;
    }

    .mission h2 {
      margin: 0 0 10px;
      font-size: 20px;
    }

    .mission p {
      margin: 0;
      line-height: 1.6;
    }

    .footer {
      text-align: center;
      margin-top: 28px;
      color: #7b858e;
      font-size: 12px;
    }

    @media (max-width: 400px) {
      .grid {
        grid-template-columns: 1fr;
      }
    }
  </style>
</head>

<body>

  <div class="container">

    <div class="header">
      <div class="logo">UG</div>

      <h1>Umma Global</h1>

      <div class="subtitle">
        Единая экосистема для жизни,<br>
        бизнеса и сообщества
      </div>
    </div>

    <div class="welcome">
      <h2 id="welcome">Ассаляму алейкум!</h2>
      <p>Добро пожаловать в Umma Global</p>
    </div>

    <div class="section-title">
      Экосистема Umma
    </div>

    <div class="grid">

      <button class="card" onclick="showMessage('Сообщество')">
        <div class="icon">🤝</div>
        <h3>Сообщество</h3>
        <p>Люди, связи и взаимопомощь</p>
      </button>

      <button class="card" onclick="showMessage('Бизнес')">
        <div class="icon">💼</div>
        <h3>Бизнес</h3>
        <p>Халяльные проекты и возможности</p>
      </button>

      <button class="card" onclick="showMessage('Сервисы')">
        <div class="icon">🌍</div>
        <h3>Сервисы</h3>
        <p>Полезные решения для жизни</p>
      </button>

      <button class="card" onclick="showMessage('Проекты')">
        <div class="icon">🚀</div>
        <h3>Проекты</h3>
        <p>Создаём и развиваем вместе</p>
      </button>

    </div>

    <div class="mission">
      <h2>Наше намерение</h2>

      <p>
        Создавать полезную экосистему для Уммы,
        объединять людей и развивать халяльные проекты —
        ради довольства Аллаха.
      </p>
    </div>

    <div class="footer">
      Umma Global<br>
      Ради довольства Аллаха
    </div>

  </div>

  <script>
    const tg = window.Telegram.WebApp;

    tg.ready();
    tg.expand();

    const user = tg.initDataUnsafe.user;

    if (user && user.first_name) {
      document.getElementById("welcome").textContent =
        "Ассаляму алейкум, " + user.first_name + "!";
    }

    function showMessage(section) {
      tg.showAlert(
        "Раздел «" + section + "» будет подключён следующим этапом."
      );
    }
  </script>

</body>
</html>
