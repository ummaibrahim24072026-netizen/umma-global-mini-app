const tg = window.Telegram?.WebApp;

if (tg) {
  tg.ready();
  tg.expand();
}

const pages = document.querySelectorAll(".page");
const moduleButtons = document.querySelectorAll(".module-card");
const toast = document.getElementById("toast");

function showPage(pageId) {
  pages.forEach((page) => {
    page.classList.remove("active");
  });

  const targetPage = document.getElementById(pageId);

  if (!targetPage) {
    return;
  }

  targetPage.classList.add("active");

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

function showToast(message) {
  if (!toast) {
    return;
  }

  toast.textContent = message;
  toast.classList.add("show");

  setTimeout(() => {
    toast.classList.remove("show");
  }, 2500);
}

function getTelegramUser() {
  if (!tg || !tg.initDataUnsafe) {
    return null;
  }

  return tg.initDataUnsafe.user || null;
}

function getUserLanguage() {
  const user = getTelegramUser();

  if (user?.language_code) {
    return user.language_code;
  }

  const browserLanguage = navigator.language;

  if (browserLanguage) {
    return browserLanguage.split("-")[0];
  }

  return "en";
}

function updateWelcomeMessage() {
  const user = getTelegramUser();
  const languageElement = document.getElementById("user-language");

  if (!languageElement) {
    return;
  }

  const language = getUserLanguage();

  if (user) {
    const firstName = user.first_name || "";

    languageElement.textContent =
      `Language: ${language} · ${firstName}`;
  } else {
    languageElement.textContent =
      `Language: ${language}`;
  }
}

function createBackButton() {
  const button = document.createElement("button");

  button.className = "back";
  button.type = "button";
  button.textContent = "← Back";

  button.addEventListener("click", () => {
    showPage("home-page");
  });

  return button;
}

function createIntro(icon, title, description) {
  const intro = document.createElement("section");

  intro.className = "intro";

  intro.innerHTML = `
    <div class="icon">${icon}</div>
    <h2>${title}</h2>
    <p class="muted">${description}</p>
  `;

  return intro;
}

function createProductCard(title, description, price = "") {
  const card = document.createElement("article");

  card.className = "product-card";

  card.innerHTML = `
    <h3>${title}</h3>
    <p>${description}</p>
    ${
      price
        ? `<div class="price">${price}</div>`
        : ""
    }
  `;

  return card;
}

function setupCafePage() {
  const page = document.getElementById("cafe-page");

  if (!page) {
    return;
  }

  page.innerHTML = "";

  page.appendChild(createBackButton());

  page.appendChild(
    createIntro(
      "🍽️",
      "Umma Cafe",
      "Halal food prepared with care and served for the pleasure of Allah."
    )
  );

  const list = document.createElement("div");

  list.className = "list";

  list.appendChild(
    createProductCard(
      "Shurpa",
      "Traditional lamb soup · approximately 650 g",
      "90,000 VND"
    )
  );

  list.appendChild(
    createProductCard(
      "Plov",
      "Lamb plov · approximately 450 g",
      "120,000 VND"
    )
  );

  list.appendChild(
    createProductCard(
      "Manti",
      "Traditional manti · approximately 400 g",
      "150,000 VND"
    )
  );

  list.appendChild(
    createProductCard(
      "UMMA Flatbread",
      "Fresh flatbread · approximately 230 g",
      "25,000 VND"
    )
  );

  list.appendChild(
    createProductCard(
      "Salad",
      "Fresh vegetable salad · approximately 200 g",
      "50,000 VND"
    )
  );

  list.appendChild(
    createProductCard(
      "Samsa",
      "Halal samsa · approximately 120 g",
      "70,000 VND"
    )
  );

  list.appendChild(
    createProductCard(
      "Ayran",
      "Traditional ayran · 300 ml",
      "30,000 VND"
    )
  );

  page.appendChild(list);
}

function setupMarketPage() {
  const page = document.getElementById("market-page");

  if (!page) {
    return;
  }

  page.innerHTML = "";

  page.appendChild(createBackButton());

  page.appendChild(
    createIntro(
      "🛒",
      "Umma Market",
      "A marketplace for halal products and trusted suppliers."
    )
  );

  const list = document.createElement("div");

  list.className = "list";

  list.appendChild(
    createProductCard(
      "Halal Food",
      "Halal meat and food products from trusted suppliers."
    )
  );

  list.appendChild(
    createProductCard(
      "Household Products",
      "Useful products for homes and businesses."
    )
  );

  list.appendChild(
    createProductCard(
      "Business Supplies",
      "Products and supplies for Umma businesses."
    )
  );

  page.appendChild(list);
}

function setupServicesPage() {
  const page = document.getElementById("services-page");

  if (!page) {
    return;
  }

  page.innerHTML = "";

  page.appendChild(createBackButton());

  page.appendChild(
    createIntro(
      "🌍",
      "Services",
      "Useful services for travel, accommodation, transport and everyday life."
    )
  );

  const list = document.createElement("div");

  list.className = "list";

  list.appendChild(
    createProductCard(
      "Umma Travel",
      "Travel services and halal-friendly destinations."
    )
  );

  list.appendChild(
    createProductCard(
      "Umma Hotel",
      "Accommodation for Muslims and families."
    )
  );

  list.appendChild(
    createProductCard(
      "Transport",
      "Transportation and delivery services."
    )
  );

  page.appendChild(list);
}

function setupCommunityPage() {
  const page = document.getElementById("community-page");

  if (!page) {
    return;
  }

  page.innerHTML = "";

  page.appendChild(createBackButton());

  page.appendChild(
    createIntro(
      "🤝",
      "Community",
      "A place for people to connect, help one another and build useful projects."
    )
  );

  const list = document.createElement("div");

  list.className = "list";

  list.appendChild(
    createProductCard(
      "People",
      "Connect with Muslims and members of the Ummah."
    )
  );

  list.appendChild(
    createProductCard(
      "Help",
      "Find and offer useful help within the community."
    )
  );

  list.appendChild(
    createProductCard(
      "Announcements",
      "Important community information and updates."
    )
  );

  page.appendChild(list);
}

function setupBusinessPage() {
  const page = document.getElementById("business-page");

  if (!page) {
    return;
  }

  page.innerHTML = "";

  page.appendChild(createBackButton());

  page.appendChild(
    createIntro(
      "💼",
      "Business",
      "Businesses, entrepreneurs, halal projects and opportunities."
    )
  );

  const list = document.createElement("div");

  list.className = "list";

  list.appendChild(
    createProductCard(
      "Businesses",
      "Discover businesses operating within the Umma ecosystem."
    )
  );

  list.appendChild(
    createProductCard(
      "Entrepreneurs",
      "Connect with Muslim entrepreneurs and partners."
    )
  );

  list.appendChild(
    createProductCard(
      "Opportunities",
      "Projects, partnerships and business opportunities."
    )
  );

  page.appendChild(list);
}

function setupEducationPage() {
  const page = document.getElementById("education-page");

  if (!page) {
    return;
  }

  page.innerHTML = "";

  page.appendChild(createBackButton());

  page.appendChild(
    createIntro(
      "📚",
      "Education",
      "Education for children, families and the wider Ummah."
    )
  );

  const list = document.createElement("div");

  list.className = "list";

  list.appendChild(
    createProductCard(
      "Umma School",
      "Education for Muslim children."
    )
  );

  list.appendChild(
    createProductCard(
      "Umma Medrese",
      "Islamic education and Quran studies."
    )
  );

  list.appendChild(
    createProductCard(
      "Umma University",
      "Higher education and professional development."
    )
  );

  page.appendChild(list);
}

function setupNavigation() {
  moduleButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const pageId = button.dataset.page;

      if (!pageId) {
        return;
      }

      showPage(pageId);
    });
  });
}

function setupTelegramMainButton() {
  if (!tg) {
    return;
  }

  tg.MainButton.setText("Umma Global");
  tg.MainButton.hide();
}

function init() {
  setupNavigation();

  setupCafePage();
  setupMarketPage();
  setupServicesPage();
  setupCommunityPage();
  setupBusinessPage();
  setupEducationPage();

  updateWelcomeMessage();
  setupTelegramMainButton();

  showPage("home-page");
}

document.addEventListener("DOMContentLoaded", init);
