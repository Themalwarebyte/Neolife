# NEOLIFE Landing Image Asset Manifest

Authoritative record of the self-hosted photography used on the public landing page.

All images are self-hosted under `public/images/landing/` and served at runtime only from
this origin (no hotlinking, no external requests). They are compatible with the existing
Content-Security-Policy (`img-src 'self' data: blob:`).

## License basis

All images are sourced from **Unsplash** under the **Unsplash License**, which permits free
commercial and non-commercial use, without permission or attribution required (attribution
is appreciated). They are temporary until the Owner supplies/approves final NeoLife
photography; drop-in replacements should keep the same filenames and dimensions.

> Do not claim additional rights. These are not NeoLife-branded assets and are not provided
> by NeoLife. They are placeholder photography for design review.

## Assets

| Local file | Used in | Source (photo ID) | Download URL | Selected | Size |
| --- | --- | --- | --- | --- | --- |
| `hero.webp` | Hero (right panel) | `photo-1506126613408-eca07ce68773` | `https://images.unsplash.com/photo-1506126613408-eca07ce68773` | 2026-09-10 | ~639 KB |
| `opportunity.webp` | "The Opportunity" section | `photo-1522071820081-009f0129c71c` | `https://images.unsplash.com/photo-1522071820081-009f0129c71c` | 2026-09-10 | ~232 KB |
| `wellness.webp` | "Products & Wellness" section | `photo-1512621776951-a57141f2eefd` | `https://images.unsplash.com/photo-1512621776951-a57141f2eefd` | 2026-09-10 | ~268 KB |
| `support.webp` | "Support" section | `photo-1531482615713-2afd69097998` | `https://images.unsplash.com/photo-1531482615713-2afd69097998` | 2026-09-10 | ~151 KB |
| `final-cta.webp` | Final CTA background | `photo-1441974231531-c6227db76b6e` | `https://images.unsplash.com/photo-1441974231531-c6227db76b6e` | 2026-09-10 | ~922 KB |
| `how-it-works.webp` | "How It Works" section background | `photo-1505576399279-565b52d4ac71` | `https://images.unsplash.com/photo-1505576399279-565b52d4ac71` | 2026-09-10 | ~410 KB |
| `faq.webp` | "FAQ" section background | `photo-1470071459604-3b5ec3a7fe05` | `https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05` | 2026-09-10 | ~297 KB |

- **Photographer/creator:** identifiable via each Unsplash photo page (resolve the photo ID at
  `https://unsplash.com/photos/` + slug). Attribution is appreciated but not required under the
  Unsplash License; names were not individually captured during selection.
- **Original source pages:** `https://unsplash.com/s/photos/<query>` (search results used to
  locate these photos). Individual photo pages are keyed by the IDs above.
- **Download parameters:** WebP format (`fm=webp`), quality `q=70`–`q=80`, widths `w=1280`–`w=1920`.

## Intended replacement

Drop final Owner-approved assets over these same filenames (or update the `src` props in the
landing components). Keep aspect ratios close to current values to avoid layout shift:

- `hero.webp` — ~4:3 / 5:4 wide panel
- `opportunity.webp` — wide ~16:7 banner
- `wellness.webp` — ~4:3 / tall panel
- `support.webp` — ~4:5 tall panel
- `final-cta.webp` — wide full-bleed background
- `how-it-works.webp` — wide full-bleed background (heavily overlaid)
- `faq.webp` — wide full-bleed background (heavily overlaid)
