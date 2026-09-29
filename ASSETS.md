# Image and font provenance

## Door entrance

The refined entrance uses `public/images/entrance-botanicals.webp`, created with the built-in image generator: transparent botanical cutout of ivory cosmos, pale blush garden roses, cream wildflowers and fine olive foliage; photorealistic petal texture with warm backlighting, no vase or text. Original generated PNG retains transparency; the project uses a 640px WebP. Detailed SVG butterfly wings and staggered flight paths are original code. The door opening now lasts 6.2 seconds, with botanical effects starting during the opening and fading after entry.

`public/images/entrance-door.webp` was edited from the user's supplied door poster with the built-in image generation tool. Prompt: remove all lettering, logos, stars, borders and button outlines; reconstruct the dark textured double doors and stone floor, preserving the centered narrow ivory light seam; use a symmetrical landscape composition with no text, flowers or butterflies. The door panels use this optimized local image; the blooming flowers and butterflies are animated code graphics. Each homepage entry shows the closed door. Scroll, swipe, or the entry button starts a five-second opening; flowers and butterflies begin two seconds into the reveal. At the user's explicit request, this entrance plays even when the operating system requests reduced motion; Skip intro and Escape bypass it. The remainder of the site retains reduced-motion behavior.

All product and maker records are fictional demonstration content. Placeholder portraits do not identify the fictional creators. Replace the demo media with licensed creator-owned images before a real marketplace launch.

## Generated editorial images

### Current homepage art direction

The built-in image generation tool produced three non-pottery homepage assets for the September 2026 visual-tuning pass. The final project copies are optimized WebP files in `public/images/`; the source PNGs remain in the Codex generation directory.

- `hero-handmade-v3.webp`: A sunlit maker's table with an original botanical painting, garden bouquet, wrapped gifts, a block-printed textile and hammered brass earrings. Prompted as photorealistic editorial lifestyle photography with warm ivory, olive, madder, saffron and indigo; no ceramics, text, logos or watermark.
- `creator-printmaker-v3.webp`: An independent Indian paper-and-print artist examining a fresh botanical print in her working studio. Prompted as candid documentary craft photography with indigo, natural paper and warm wood; no pottery, text, logos or watermark.
- `story-embroidery-v3.webp`: An Indian textile artist's hands embroidering a botanical motif with madder, indigo, marigold and olive thread. Prompted as an intimate photorealistic craft close-up with natural texture; no ceramics, text, logos or watermark.

### Initial generated set

The built-in image generation tool produced these nine initial assets. They are saved as optimized WebP images in `public/images/`, with original PNG files retained in the Codex generation directory. They are illustrative images, not photographs of actual merchandise or creators.

- `hero-v2.webp`: Warm ceramic still life with a matte taupe vase, dried stems, a low cream bowl, terracotta cup, linen and travertine; plaster backdrop and directional afternoon light; square editorial photo; no text or logo.
- `textile-v2.webp`: Oatmeal handwoven cotton throw with fringe over a rustic stool, cream cushion, warm plaster and stone; close editorial product photograph.
- `basket-v2.webp`: Handwoven reed basket with two handles and a shallow matching tray on a beige stone tabletop; natural side light and detailed craft texture.
- `art-v2.webp`: Small framed abstract painting with textured ochre, terracotta and off-white fields and a pale sun circle, leaning on a stone console against plaster.
- `jewellery-v2.webp`: Hand-hammered brass hoops and a fine chain with a round sun-disc pendant on ivory linen and beige stone; natural shadows; no gemstones.
- `studio-v2.webp`: Close documentary-style view of an Indian ceramic maker’s hands shaping a bowl at a wheel in a Jaipur studio; linen apron, clay-covered hands, natural window light; face outside frame.
- `creator1-v2.webp`: Fictional Indian woman ceramic artist in her early thirties in a linen apron and rust shirt, seated in a sunlit Jaipur pottery studio with bowls and pots behind her; natural editorial portrait.
- `creator2-v2.webp`: Fictional Indian woman textile artist in an off-white cotton kurta seated beside a wooden handloom in a bright Kochi studio; yarns and textiles behind her; natural editorial portrait.
- `creator3-v2.webp`: Fictional Indian male painter in an olive overshirt holding a brush and palette in a Pune art studio, with ochre paintings and an easel behind him; warm window light and natural editorial styling.

`scripts/prepare-generated-assets.mjs` reproduces format conversion from the original generated PNG directory. The hero is at most 1440px wide; the other generated assets are 800px wide.

## Unsplash placeholders

Downloaded as WebP using the Unsplash image CDN. Source identifiers:

| File | Source |
| --- | --- |
| `bowls.webp` | https://images.unsplash.com/photo-1610701596007-11502861dcfa |
| `creator1.webp` | https://images.unsplash.com/photo-1580489944761-15a19d654956 |
| `creator2.webp` | https://images.unsplash.com/photo-1534528741775-53994a69daeb |
| `creator3.webp` | https://images.unsplash.com/photo-1500648767791-00dcc994a43e |

Other initial Unsplash candidates remain as unused source assets for traceability; the centralized asset map selects the final images. `scripts/fetch-assets.mjs` records their source identifiers. Portraits are illustrative; no endorsement or identity claim is intended.

## Fonts and icons

Newsreader and Manrope are bundled through their `@fontsource` npm packages; their included license files apply. Icons are from Lucide React under the package’s ISC license.
