# UMMA direction illustration family

Custom images generated with the built-in ImageGen tool for the six home direction cards. The existing UMMA GLOBAL logo and hero artwork are unchanged.

Production asset: `directions-atlas-v2.webp` (1536 × 1024, approximately 81 KiB). The atlas has three columns and two rows of 512 × 512 cells. Left to right: Cafe, Market, B2B; Education, Tours, Hotel. CSS clips each cell; the browser caches one shared file. Images are decorative because each card has its own visible title, description and launch status. Existing SVG symbols remain as loading/error fallbacks.

The original generated image is retained separately from the repository. The production WebP is a format conversion of that image; its illustration content is unmodified.

## Final generation prompt

Design a SINGLE six-piece premium 3D UI illustration atlas on a completely PURE WHITE #ffffff seamless background, no dark background anywhere. Landscape 1536x1024. EXACT 3 columns x 2 rows grid of equal 512px square cells, no visible borders or grid lines. Every illustration is centered inside its own cell and fills only 65 percent of cell width and height, leaving generous clean WHITE margins. SAME STYLE for all: elegant modern simple 3D shapes, satin turquoise #087f88 and pale mint #e6f6f4, small champagne-gold #d2ae55 accents, cream secondary surfaces, soft pale grey contact shadows, front three-quarter orthographic view, diffuse bright studio illumination, strong clear silhouettes, understated upscale hospitality brand, NOT glossy hyperrealistic jewelry and NOT line icons. Row 1: left turquoise serving cloche lifted over a white plate with a small mound of rice, gold knob; center turquoise grocery tote containing a baguette and simplified vegetables; right two turquoise supply cartons with small gold sealing bands on a cream pallet. Row 2: left an open cream book with turquoise cover, gold bookmark, graduation cap; center turquoise travel suitcase with folded cream map and small gold location pin; right small welcoming turquoise hotel building with cream windows and small gold cornice, no dome, no religious imagery. All six illustrations equal size, identical rendering language, object groups fully contained WITH WIDE WHITE MARGINS. Background must be flat PURE WHITE throughout the entire canvas except beneath objects where faint contact shadows occur. No text, no lettering, no logos, no watermark. This is a production asset sheet for UMMA GLOBAL service cards on a light app.

## Cafe revision

The approved plain-rice concept was revised with built-in ImageGen: replace only the food in the top-left cafe cell with golden plov, carrot strips and prominent browned lamb pieces; preserve the cloche, plate, white background and the five other cells. The earlier plain-rice version is not shipped.

## Full catalogue

All 38 registry entries share `directionArtwork()` on home and in the directory. The six home illustrations use `directions-atlas-v2.webp`; the other 32 use eight WebP group sheets generated for the approved category concepts. `directionArt` defines source rectangles in the 1536 × 1024 sheets. CSS crops presentation headings and labels out of view, preserving the original bitmap geometry. Titles, descriptions and launch statuses remain translated DOM text. Group sheets load lazily and are reused from the browser cache; no database requests are added.

The group concepts use the same generation brief: satin turquoise 3D objects, small champagne-gold details, cream supporting surfaces, pale contact shadows and a light background, one subject per registry entry. No app logo replacement. The Quran illustration is decorative only; Quran text, daily-verse selection and reader behavior are unchanged.

`qa-home-browser.mjs` checks all 38 image loads, eight groups, directory overflow and translation coverage at eight widths in Russian, English and Vietnamese, in addition to existing home and navigation checks.

## Navigation illustration family

`navigation-atlas-v2.webp` is a separate five-symbol sheet generated with built-in ImageGen, using the approved service atlas as a material reference. Layout: 3 × 2 equal 512px cells; top row Home, Cafe, Orders; bottom row Events, More, empty. Each symbol uses simple front-facing satin turquoise forms, a small champagne-gold accent, cream detail and soft shadows on white. No text or background decorations. Navigation labels remain real translated text, and existing SVGs remain as load/error fallbacks. One shared WebP request serves all five symbols.

Final navigation polish uses satin rather than glossy highlights, softer contact shadows and per-symbol optical size adjustments. The cloche is scaled by 1.10, clipboard by 1.05 and More by 1.08. The image grid and subjects are unchanged.
