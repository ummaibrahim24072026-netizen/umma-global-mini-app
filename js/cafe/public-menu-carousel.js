(() => {
  'use strict';

  const host = document.getElementById('cafeSpotlight');
  if (!host) return;

  // Optional start/end values are ISO 8601 timestamps with the local offset (+07:00).
  const featured = [
    { sku: 'UMMA-CAFE-PLOV' },
    { sku: 'UMMA-CAFE-MANTI' },
    { sku: 'UMMA-CAFE-SHURPA' }
  ];
  const language = {
    ru: ['Из меню UMMA', 'Открыть блюдо', 'Подробнее', 'Пауза', 'Продолжить', 'Слайд'],
    en: ['From the UMMA menu', 'View dish', 'Read more', 'Pause', 'Play', 'Slide'],
    vi: ['Món ăn UMMA', 'Xem món', 'Xem thêm', 'Tạm dừng', 'Tiếp tục', 'Trang'],
    ko: ['UMMA 메뉴 추천', '요리 보기', '자세히 보기', '일시 정지', '재생', '슬라이드'],
    zh: ['UMMA 菜单推荐', '查看菜品', '了解更多', '暂停', '播放', '幻灯片'],
    de: ['Aus der UMMA-Speisekarte', 'Gericht ansehen', 'Mehr erfahren', 'Pausieren', 'Fortsetzen', 'Folie'],
    fr: ['À la carte chez UMMA', 'Voir le plat', 'En savoir plus', 'Mettre en pause', 'Reprendre', 'Diapositive'],
    th: ['เมนูแนะนำจาก UMMA', 'ดูเมนู', 'ดูเพิ่มเติม', 'หยุดชั่วคราว', 'เล่นต่อ', 'สไลด์'],
    ms: ['Daripada menu UMMA', 'Lihat hidangan', 'Baca lagi', 'Jeda', 'Sambung', 'Slaid'],
    id: ['Dari menu UMMA', 'Lihat hidangan', 'Baca selengkapnya', 'Jeda', 'Lanjutkan', 'Slide'],
    ar: ['من قائمة أمّة', 'عرض الطبق', 'اقرأ المزيد', 'إيقاف مؤقت', 'استئناف', 'شريحة'],
    pt: ['Do menu UMMA', 'Ver prato', 'Ler mais', 'Pausar', 'Retomar', 'Diapositivo']
  };
  const delay = 6500;
  const fallback = host.querySelector('.cafe-spotlight-fallback');
  const action = host.querySelector('.cafe-spotlight-slide');
  const eyebrow = action.querySelector('.cafe-spotlight-eyebrow');
  const title = action.querySelector('strong');
  const detail = action.querySelector('.cafe-spotlight-detail');
  const cta = action.querySelector('.cafe-spotlight-cta');
  const photo = action.querySelector('img');
  const controls = host.querySelector('.cafe-spotlight-controls');
  const dots = controls.querySelector('.cafe-spotlight-dots');
  const pause = controls.querySelector('.cafe-spotlight-pause');
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  let paused = !!reducedMotion?.matches;
  let hovered = false;
  let inView = true;
  let timer;
  let slides = [];
  let current = 0;
  let signature;
  let catalog = [];
  let direction = 'cafe';
  let leading = [];
  let announcements = [];
  let openProduct;
  let gesture;
  let lastSwipe = -Infinity;

  const labels = () => language[document.documentElement.lang.split('-')[0]] || language.en;
  function schedule() {
    clearTimeout(timer);
    if (slides.length < 2 || paused || hovered || gesture || !inView || document.hidden ||
        host.closest('[inert]') || host.contains(document.activeElement)) return;
    timer = setTimeout(() => {
      if (!host.closest('[inert]')) select(current + 1);
      else schedule();
    }, delay);
  }

  function setPauseLabel() {
    pause.setAttribute('aria-label', labels()[paused ? 4 : 3]);
    pause.dataset.paused = String(paused);
  }

  function select(index) {
    current = (index + slides.length) % slides.length;
    const card = slides[current];
    eyebrow.textContent = card.badge;
    title.textContent = card.title;
    detail.textContent = card.detail;
    cta.textContent = card.cta || labels()[card.news ? 2 : 1];
    action.setAttribute('aria-haspopup', card.news || direction==='market' ? 'false' : 'dialog');
    if (card.image && photo.src !== card.image) photo.src = card.image;
    if (!card.image) photo.removeAttribute('src');
    photo.hidden = !card.image;
    action.classList.toggle('has-photo', !!card.image);
    for (const [i, dot] of [...dots.children].entries()) {
      if (i === current) dot.setAttribute('aria-current', 'true');
      else dot.removeAttribute('aria-current');
    }
    schedule();
  }

  function render() {
    const now = Date.now();
    const dishes = featured.filter(item =>
      (!item.start || Date.parse(item.start) <= now) && (!item.end || now < Date.parse(item.end))
    ).flatMap(item => {
      const dish = catalog.find(row => row.sku === item.sku);
      return dish ? [{...dish, badge: item.badge || labels()[0]}] : [];
    });
    const activeNews = announcements.map(item => ({
      key: item.key, title: item.title, detail: item.body, news: true
    }));
    const next = direction==='market' ? catalog : [...activeNews, ...leading, ...dishes];
    const nextSignature = JSON.stringify([direction, labels(), next]);
    if (nextSignature === signature) return;
    signature = nextSignature;

    const selected = slides[current]?.key;
    slides = next;
    action.hidden = !slides.length;
    fallback.hidden = direction==='market' || !!slides.length;
    host.hidden = direction==='market' && !slides.length;
    controls.hidden = slides.length < 2;
    if (!slides.length) {
      schedule();
      return;
    }
    while (dots.children.length > slides.length) dots.lastElementChild.remove();
    for (const [i] of slides.entries()) {
      let dot = dots.children[i];
      if (!dot) {
        dot = document.createElement('button');
        dot.type = 'button';
        dot.onclick = () => select(i);
        dots.append(dot);
      }
      dot.setAttribute('aria-label', labels()[5] + ' ' + (i + 1));
    }
    setPauseLabel();
    select(Math.max(0, slides.findIndex(slide => slide.key === selected)));
  }

  window.ummaCafeSpotlight = {
    setCatalog(rows, open, options = {}) {
      direction = options.direction || 'cafe';
      leading = options.leading || [];
      catalog = rows;
      openProduct = open;
      render();
    }
  };

  window.addEventListener('umma-menu:public-news', event => {
    announcements = event.detail;
    render();
  });
  window.addEventListener('umma-menu:languagechange', render);
  action.onclick = event => {
    if (event.detail && performance.now() - lastSwipe < 450) return;
    const slide = slides[current];
    if (slide.news) {
      const article = document.getElementById(slide.key);
      article?.focus({preventScroll: true});
      article?.scrollIntoView({block: 'start'});
    } else {
      openProduct(slide.key);
    }
  };
  pause.onclick = () => {
    paused = !paused;
    setPauseLabel();
    schedule();
  };
  reducedMotion?.addEventListener('change', event => {
    paused = event.matches;
    setPauseLabel();
    schedule();
  });
  host.addEventListener('focusin', schedule);
  host.addEventListener('focusout', () => queueMicrotask(schedule));
  host.addEventListener('pointerenter', event => {
    if (event.pointerType !== 'mouse') return;
    hovered = true;
    schedule();
  });
  host.addEventListener('pointerleave', event => {
    if (event.pointerType !== 'mouse') return;
    hovered = false;
    schedule();
  });
  action.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'touch' || !event.isPrimary || slides.length < 2) return;
    gesture = {x: event.clientX, y: event.clientY};
    schedule();
  });
  action.addEventListener('pointerup', event => {
    if (!gesture || !event.isPrimary) return;
    const dx = event.clientX - gesture.x;
    const dy = event.clientY - gesture.y;
    gesture = undefined;
    if (Math.abs(dx) < 42 || Math.abs(dx) < Math.abs(dy) * 1.4) {
      schedule();
      return;
    }
    lastSwipe = performance.now();
    const direction = document.documentElement.dir === 'rtl' ? 1 : -1;
    select(current + (dx * direction > 0 ? 1 : -1));
  });
  action.addEventListener('pointercancel', () => {
    gesture = undefined;
    schedule();
  });
  document.addEventListener('visibilitychange', schedule);
  if (typeof IntersectionObserver === 'function') {
    new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      schedule();
    }, {threshold: 0.25}).observe(host);
  }
  if (typeof MutationObserver === 'function') {
    new MutationObserver(schedule).observe(host.closest('main'), {attributes: true, attributeFilter: ['inert']});
  }
  setInterval(render, 30000);
})();
