(() => {
  'use strict';
  const overrides = new Map([
    ["UMMA-CAFE-SHURPA", "logo/assets/menu/shurpa-white-v2.webp"],
    ["UMMA-CAFE-PLOV", "logo/assets/menu/plov-white-v2.webp"],
    ["UMMA-CAFE-FLATBREAD", "logo/assets/menu/flatbread-white-v2.webp"],
    ["UMMA-CAFE-MANTI", "logo/assets/menu/manti.png"],
    ["UMMA-CAFE-SALAD", "logo/assets/menu/salad.png"],
    ["UMMA-CAFE-AYRAN", "logo/assets/menu/ayran-300.png"],
    ["UMMA-CAFE-SAMSA", "logo/assets/menu/samsa-white.webp"],
    ["UMMA-CAFE-SAMSA-CHICKEN", "logo/assets/menu/samsa-white.webp"]
  ]);

  window.ummaCafeProductPhoto = product => {
    const source = overrides.get(product.sku) || product.image_url;
    if (!source) return '';
    try {
      const url = new URL(source, document.baseURI);
      return (url.protocol === 'https:' || url.origin === location.origin) &&
        !url.username && !url.password ? url.href : '';
    } catch {
      return '';
    }
  };
})();
