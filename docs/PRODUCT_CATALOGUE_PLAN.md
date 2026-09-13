# NEOLIFE — Product Catalogue Plan

> **PLANNING DOCUMENT ONLY — NOT IMPLEMENTED.**
> No code, database, schema, email, or production changes have been made.

## 1. Objective

Add a browsable NeoLife product catalogue to the existing NEOLIFE business platform with product-interest capture and email notification, without checkout, payment, cart, or order fulfilment.

## 2. Official Catalogue Research

**Primary source:** `https://neolifeshop.com/i/shop.html` (official NeoLife shop, Northern Europe market, UK/Ireland default).

### 2.1 Top-Level Categories (4)

| # | Official category | Official URL |
|---|---|---|
| 1 | Nutritionals | `https://neolifeshop.com/c/nutritionals/` |
| 2 | Weight Management | `https://neolifeshop.com/c/weight-management/` |
| 3 | Personal Care | `https://neolifeshop.com/c/personal-care/` |
| 4 | Home Care | `https://neolifeshop.com/c/home-care/` |

### 2.2 Subcategory Structure

**Nutritionals**
- Nutritional Products (all products)
- Core Products
- Targeted Solutions
  - Active Lifestyle and Wellness
  - Oxidative Stress
  - Nutrients to Support Your Heart
  - Women's Solutions
  - Children's Nutrition
  - For Your Bones
  - Aging
  - Herbal Alternatives
- NeoLife Accessories

**Weight Management**
- Complementary Product
- Protein
- Snacks

**Personal Care**
- Personal Care Products
- Organic Skin Care
  - Organic Certified
  - Normal to Dry Skin
  - Combination to Oily Skin
- Hair Care
- Body Care
- Nutriance Accessories

**Home Care**
- Home Care Products
- Golden Accessories

### 2.3 Product Inventory Scope

Approximately 70 unique products identified across the four categories. Each carries an official item/SKU number. Several products appear in multiple category paths (e.g. NeoLifeShake appears in Nutritionals, Weight Management, and Personal Care).

**Nutritionals (approx. 35 products):** Acidophilus Plus (560), All C (552), Aloe Vera Plus (731), Betaguard (789), Bio-Tone (935), Botanical Balance (800), Carotenoid Complex (566), Chelated Zinc (830), CoQ10 (930), Cruciferous Plus (892), Elevate (860), Fibre Tablets (850), Flavonoid Complex (790), Formula IV Plus (691), Formula IV (576), Garlic Allium Complex (555), Kal-Mag Plus D (724), Magnesium Complex (805), NeoLife Bar (608), NeoLifeBar (950), NeoLifeShake Berries n' Cream (917), NeoLifeShake Creamy Vanilla (915), NeoLifeShake Rich Chocolate (916), NeoLifeTea (920), Omega-3 Plus (929), Pro Vitality (942), Resp-X (820), Sustained Release Vitamin C (551), Tre (735), Tre-en-en (927), UpBeet (840), Vegan D (865), Vita-Squares (740), Vitamin Box Large (5001), Wheat Germ Oil with Vitamin E (562)

**Weight Management (6 products):** NeoLife Bar (608), NeoLifeBar (950), NeoLifeShake Berries n' Cream (917), NeoLifeShake Creamy Vanilla (915), NeoLifeShake Rich Chocolate (916), NeoLifeTea (920)

**Personal Care (17 products):** Aloe Vera Gel (316), Balancing Tonic (360), Cleansing Gel Combination/Oily (362), Cleansing Milk Dry/Normal (361), Enriching Conditioner (312), Hydrating Serum Combination/Oily (366), Insta-Lift Eye Gel (368), Mild Revitalizing Shampoo (311), Moisturizing Cream Combination/Oily (364), Moisturizing Hand & Body Lotion (315), Nutriance Organic Set Combination/Oily (3690), Nutriance Organic Set Normal/Dry (3670), Refreshing Bath & Shower Gel (314), Rejuvenating Rich Cream (369), Rich Revitalizing Shampoo (310), Ultra Hydrating Serum Dry/Normal (367), Ultra Moisturizing Cream Dry/Normal (365)

**Home Care (13 products):** Dispenser LDC 5L (1586), Dispenser Super 10 10L (1585), Dispenser Super 10 5L (1584), G1 Laundry Detergent (144), LDC Light Duty Cleaner 5L (25), LDC Light Duty Cleaner Hand Soap 1L (21), Mixing Bottle 500ml (308), Soft Fabric Softener (42), Spray Bottle 500ml (303), Super 10 All Purpose 1L (16), Super 10 All Purpose 10L (18), Super 10 All Purpose 25L (19), Super 10 All Purpose 5L (17)

### 2.4 Product Metadata

Each product page exposes: name, item/SKU number, price (market currency, e.g. SEK), product image, category path, "Buy Now" action. Some products have explicit size variants (Super 10: 1L/5L/10L/25L; NeoLifeShake: 3 flavours; Nutriance Organic Set: 2 skin types). These are modelled as variants, not separate products.

### 2.5 Availability

All products listed above were visible and "Buy Now" actionable at research time (2026-09-13). Availability is market-dependent; the official site supports 11 Northern European markets. The Kenyan market (KSh pricing) is NOT visible on this storefront and must be supplied by the Owner.

### 2.6 Imagery

Official product images are hosted on `neolifeshop.com` (e.g. `/thumb/.../NNN.jpg`). **No permission to reuse has been established.** Do not download or embed these images.
## 3. Content Strategy

### 3.1 Approach

- **Accurate official names:** Product names, category names, subcategory names and SKU numbers are factual data and will be reproduced exactly as they appear on the official site.
- **Original descriptions:** Descriptions will be concise, original summaries written from the official product information. We will NOT bulk-copy long copyrighted NeoLife marketing copy verbatim.
- **Claim-sensitive content:** Products with health/nutrition claims will use conservative, factual summaries only. Any claim-heavy description requires Owner review before use.
- **Imagery:** No NeoLife product images will be downloaded or embedded until the Owner confirms licensing permission. Placeholder imagery (botanical gradients/SVG, consistent with the existing visual system) will be used initially.

### 3.2 Source URLs

- Shop home: `https://neolifeshop.com/i/shop.html`
- Nutritionals: `https://neolifeshop.com/c/nutritionals/`
- Weight Management: `https://neolifeshop.com/c/weight-management/`
- Personal Care: `https://neolifeshop.com/c/personal-care/`
- Home Care: `https://neolifeshop.com/c/home-care/`
- Targeted Solutions: `https://neolifeshop.com/c/nutritionals/targeted-solutions/`
- Core Products: `https://neolifeshop.com/c/nutritionals/core-products/`
- Nutritional Products: `https://neolifeshop.com/c/nutritionals/nutritional-products/`
- NeoLife Accessories: `https://neolifeshop.com/c/nutritionals/neolife-accessories/`
- Complementary Product: `https://neolifeshop.com/c/weight-management/complementary-product/`
- Active Lifestyle and Wellness: `https://neolifeshop.com/c/nutritionals/targeted-solutions/active-lifestyle-and-wellness/`

### 3.3 Market Caveat

The official shop is the Northern Europe market (SEK pricing, EU markets). The Kenyan market catalogue (KSh pricing) is not publicly visible on this storefront. The Owner must supply the authoritative Kenyan product list and KSh price list. The data model is designed to support market-specific pricing without restructuring.
## 4. Proposed Routes

Recommended clean route structure:

```
/products                          # catalogue landing page with category tiles
/products/[category-slug]          # category page (e.g. /products/nutritionals)
/products/[category-slug]/[subcategory-slug]  # subcategory filtered view
/products/[category-slug]/[product-slug]      # product detail page
```

**Slug conventions:**
- Category slugs: lowercase, hyphenated official names (`nutritionals`, `weight-management`, `personal-care`, `home-care`)
- Subcategory slugs: lowercase, hyphenated (`core-products`, `targeted-solutions`, `active-lifestyle-and-wellness`)
- Product slugs: derived from official product URL slug (e.g. `pro-vitality-food-supplement-305`)

**Rationale:**
- Clean, SEO-friendly URLs that mirror the official site's URL structure
- Category/subcategory hierarchy supports the full depth of the official catalogue
- Product slugs are stable identifiers tied to the official product URL
- Future-proof: additional depth (e.g. `/products/[cat]/[sub]/[product]`) can be added without breaking existing routes
- Canonical URLs: the canonical is the deepest valid URL; category pages use `rel="canonical"` to avoid duplicate content

**Not included in MVP:** `/products/[category]/[subcategory]/[product]` three-level routes are optional; the MVP may render subcategory filtering client-side from the category page to avoid route proliferation. Decision deferred to Owner (see §10).
## 5. Proposed Data Architecture

### 5.1 Recommended Models

Four new models are proposed. **No Prisma changes have been made.**

```prisma
model Category {
  id            String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  name          String   @unique   // official name, e.g. "Nutritionals"
  slug          String   @unique   // URL slug, e.g. "nutritionals"
  description   String?                 // original summary
  displayOrder  Int      @default(0)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  subcategories Subcategory[]
}

model Subcategory {
  id            String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  categoryId    String   @db.Uuid
  name          String                     // official name, e.g. "Core Products"
  slug          String                     // e.g. "core-products"
  description   String?
  displayOrder  Int      @default(0)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  category      Category  @relation(fields: [categoryId], references: [id], onDelete: Cascade)
  products      ProductSubcategory[]

  @@index([categoryId])
  @@unique([categoryId, slug])
}

model Product {
  id            String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  name          String                     // official product name
  slug          String   @unique             // stable, derived from official URL
  sku           String?                      // official item number, e.g. "942"
  description   String?                      // original concise summary
  imageUrl      String?                      // placeholder until licensed imagery approved
  displayOrder  Int      @default(0)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  categories    ProductCategory[]
  subcategories ProductSubcategory[]
  interests     ProductInterest[]

  @@index([slug])
}

model ProductCategory {
  productId  String @db.Uuid
  categoryId String @db.Uuid
  product    Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  category  Category @relation(fields: [categoryId], references: [id], onDelete: Cascade)
  @@unique([productId, categoryId])
}

model ProductSubcategory {
  productId      String @db.Uuid
  subcategoryIds String @db.Uuid
  product        Product      @relation(fields: [productId], references: [id], onDelete: Cascade)
  subcategory    Subcategory  @relation(fields: [subcategoryIds], references: [id], onDelete: Cascade)
  @@unique([productId, subcategoryIds])
}

model ProductInterest {
  id            String         @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  productId     String         @db.Uuid
  leadId        String?        @db.Uuid
  status        InterestStatus @default(NEW)
  message       String?
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt

  product Product     @relation(fields: [productId], references: [id], onDelete: Cascade)
  lead    Lead?       @relation(fields: [leadId], references: [id], onDelete: SetNull)

  @@index([productId])
  @@index([leadId])
  @@index([status])
  @@index([createdAt])
}

enum InterestStatus {
  NEW
  CONTACTED
  FOLLOW_UP
  CONVERTED
  NOT_INTERESTED
}
```

### 5.2 Relationship to Existing Models

- `ProductInterest.leadId` is **nullable** and references the existing `Lead` model. A product-only prospect becomes a `Lead` at submission time (see §6).
- `ProductInterest` records are created in a `$transaction` together with the `Lead` upsert and a `LeadEvent` of type `product_interest_submitted`, preserving the existing event-driven audit pattern.
- Attribution (UTM, firstTouchSource, landingPage) is inherited from the `Lead` record exactly as in the existing lead flow.

### 5.3 Future Compatibility (not implemented now)

- **KSh pricing:** add a `ProductPrice` model (productId, currency, amount, effectiveFrom, effectiveTo) or a `priceKsh` field on `Product`. The MVP deliberately leaves pricing as an Owner-supplied data file, not a schema feature.
- **Variants:** add a `ProductVariant` model (productId, name, sku, size, flavour, price). Products with visible variants (Super 10 sizes, NeoLifeShake flavours, Nutriance skin sets) are modelled as variants from day one of Phase 2.
- **Product images:** `Product.imageUrl` is a single optional field; a `ProductImage` model can replace it when a gallery is needed.
- **Orders:** a future `Order`/`OrderItem` model references `Product` and `ProductVariant`; no such models exist now.
- **Customer accounts:** a future `Customer` model would reference `Lead`; no such model exists now.
- **Availability:** add a `Product.availability` field or `ProductAvailability` model when stock control is required.

### 5.4 Minimum Architecture Now

MVP requires only: `Category`, `Subcategory`, `Product`, `ProductInterest`, the `InterestStatus` enum, and the two join tables. No pricing, variant, order, or customer models.
## 6. Product-Interest Workflow

### 6.1 Flow

```
Visitor
  -> Product detail page
  -> "I'm Interested" CTA
  -> Interest form (name, phone, email, optional message, consent)
  -> Server action: validate, rate-limit, honeypot
  -> Upsert Lead (existing phone -> reuse; else create)
  -> Create ProductInterest (productId, leadId, status=NEW)
  -> Create LeadEvent("product_interest_submitted", { productId, productName })
  -> Inherit Lead attribution (UTM, firstTouchSource, landingPage)
  -> Send email notification to office team
  -> Admin CRM shows the interest
```

### 6.2 Required Fields

- **Product:** productId (required, server-resolved from slug)
- **Visitor:** firstName, phone (required); email, city (optional) -- reuses the existing `Lead` schema
- **Message:** optional free text (max 500 chars)
- **Consent:** required checkbox (same consent wording as the existing lead form)
- **Attribution:** inherited from the Lead record (no new attribution capture needed)

### 6.3 Lead Reuse

- **Yes, reuse the existing `Lead` model.** The product-interest form is a lead-capture form scoped to a product.
- If the phone matches an existing active lead, the lead is **reused** (no duplicate) and the interest is linked to it.
- If no lead exists, a new `Lead` is created with `interestType=PRODUCT` (or `BOTH` if the lead also has business interest).
- This preserves the existing funnel: `AD -> LANDING -> LEAD -> QUALIFICATION -> OFFICE PIPELINE`.

### 6.4 ProductInterest Relationship

- `ProductInterest.leadId` is nullable to support the brief window between interest submission and lead creation in a transaction.
- One lead can have **multiple** ProductInterest records (multiple products, multiple times).
- A lead can express interest in the same product more than once; duplicate detection is by (leadId, productId, status IN [NEW, CONTACTED, FOLLOW_UP]). Repeated clicks on the same product update the existing record's `updatedAt` rather than creating a duplicate.

### 6.5 Status Lifecycle

`NEW` -> `CONTACTED` -> `FOLLOW_UP` -> `CONVERTED` / `NOT_INTERESTED`

Admins change status from the CRM; each change records a `LeadEvent`.

### 6.6 Timestamps

- `ProductInterest.createdAt`: submission time
- `ProductInterest.updatedAt`: last status change
- `Lead.consentAt`: consent timestamp (existing field, reused)
## 7. Email Architecture

### 7.1 Recommended Approach

**Use the existing Next.js Server Action + a transactional email provider API.** No new SMTP server, no new infrastructure. The notification is sent from the product-interest server action after the database transaction commits.

### 7.2 Options Considered

| Option | Reliability | Cost | Complexity | Recommendation |
|---|---|---|---|---|
| **A. Transactional email API (e.g. SendGrid, Mailgun, Amazon SES, Postmark)** | High | Low (free tiers) | Low | **RECOMMENDED** |
| B. Self-hosted SMTP (e.g. Postfix) | Medium | Free | High | Not recommended for MVP |
| C. Resend / EmailJS / similar | High | Low | Low | Acceptable alternative to A |

### 7.3 Environment Variables (names only -- no values)

```
EMAIL_PROVIDER=sendgrid|mailgun|resend|ses
EMAIL_API_KEY=...            # provider API key, secret
EMAIL_FROM=office@neolife... # verified sender
EMAIL_TO=office@neolife...   # recipient(s)
```

### 7.4 Architecture

- Server Action calls `sendEmail()` after the Prisma transaction commits.
- `sendEmail()` is a thin wrapper in `src/lib/email.ts` with a provider-agnostic interface: `sendMail({ to, subject, html, text })`.
- Provider implementation is selected by `EMAIL_PROVIDER` and loaded lazily so the default build does not require a provider key.
- Failure handling: email failure must NOT roll back the product interest. Log the failure (server-side, no PII) and return a generic "Interest recorded; notification may be delayed" message.

### 7.5 Retry Strategy

- Immediate attempt; on failure, queue for a single retry after 5 minutes (in-memory for MVP; a BullMQ/worker-based queue in Phase 8).
- Persistent failure is logged with a correlation ID; no PII is included in logs.

### 7.6 Security

- API key is an environment variable, never committed (mirrors `BETTER_AUTH_SECRET` handling).
- Recipient and sender are server-side constants, not user-controllable.
- Email body is HTML-escaped; the visitor's message is rendered as plain text.
- No attachment, no redirect, no tracking pixel (D-013 first-party only).

### 7.7 Local Development

- Use a provider sandbox/dev mode or a dummy provider that logs the email to the console. No local SMTP server required.
## 8. Pricing

### 8.1 Current State

The Owner will supply the authoritative KSh price list later. **No prices have been invented.**

### 8.2 Recommended Display Before Prices Are Available

**Option C: "Contact us" / "Price on request" -- RECOMMENDED for the MVP.**

| Option | Tradeoff |
|---|---|
| A. No price | Cleanest but gives no commercial signal; visitors cannot gauge affordability |
| B. "Price coming soon" | Honest but creates a dead-end; suggests incompleteness |
| **C. "Contact us" / "Request a quote"** | **Best balance: signals commercial availability, directs to the interest flow, no misleading pricing** |
| D. "Price on request" | Similar to C, slightly more formal |

**Recommendation: Option C.** The product card shows "Contact us" and the product detail page shows "Request a quote -- the office team will provide current KSh pricing and any applicable distributor pricing on request." This converts the pricing gap into a product-interest opportunity.

### 8.3 Architecture for Future KSh Prices

- Add a `priceKsh` field (optional, decimal) to `Product` in Phase 2, or a separate `ProductPrice` model supporting multiple currencies and effective dates.
- The catalogue data should be supplied as a structured file (CSV/JSON) mapping official SKU -> KSh price, so prices can be updated by re-importing data without code changes.
- The UI reads `product.priceKsh` and renders it only when present; the "Contact us" state is the fallback, not a hard-coded branch.
## 9. UX / Design Plan

### 9.1 Visual Direction

Use the already approved direction: **Semrush-inspired UX quality + NeoLife botanical/wellness visual identity** (D-018). Do not copy Semrush. Extend the existing system: `brand-*`/`forest-*`/`cream-*`/`ink` tokens, `Botanical` SVG motifs, `Photo` component, `Reveal` scroll animation, `botanical-grid` texture.

### 9.2 Layout

- **`/products` landing:** category tiles with botanical photo backgrounds, one per top-level category (Nutritionals, Weight Management, Personal Care, Home Care). Deep forest-green section with cream text for the catalogue hero.
- **Category page:** subcategory chips/filters, product grid (2-4 columns responsive), product cards with image, name, SKU, "Contact us" price, "I'm Interested" CTA.
- **Product detail:** hero image (placeholder until licensed imagery approved), product name, SKU, original description, subcategory breadcrumbs, "I'm Interested" sticky CTA on mobile.
- **Interest form:** reuse the existing `LeadForm` component pattern (honeypot, consent, server action, success state), scoped to the product.

### 9.3 Product Cards

- Image (placeholder botanical gradient if no licensed image), name, SKU, subcategory tags, "Contact us" price, "I'm Interested" button.
- Hover lift (subtle), consistent with existing card interactions.
- Lazy-load images via Next `Image` with reserved dimensions (no layout shift).

### 9.4 Responsive / Mobile

- Single-column stack on mobile; sticky "I'm Interested" bar on the product detail page.
- Mobile menu extends the existing `SiteHeader` `<details>` pattern to include "Products".
- Touch targets >= 44px.

### 9.5 Imagery Strategy

- **MVP:** Use placeholder imagery (botanical gradient + SVG via the existing `Photo`/`BotanicalImage` components). No NeoLife product images.
- **Phase 2:** Swap in licensed product imagery only after Owner confirms licensing.
- Self-hosted only; CSP `img-src 'self'` unchanged.

### 9.6 States

- **Loading:** skeleton cards matching the grid layout.
- **Empty:** "No products in this category yet" with a link back to all products.
- **Error:** "Something went wrong loading the catalogue. Please try again." (generic, no internal details).
- **404:** existing Next.js not-found for unknown slugs.

### 9.7 Accessibility

- Semantic landmarks, single h1 per page, heading order, `#main-content` skip target.
- Visible `:focus-visible` (existing global rule).
- Alt text on all images; decorative SVG `aria-hidden`.
- Contrast >= 4.5:1 (cream-on-forest verified per existing acceptance criteria).
- `prefers-reduced-motion` honoured on all animations.
## 10. SEO Plan

### 10.1 URLs

- `/products`, `/products/[category]`, `/products/[category]/[subcategory]`, `/products/[category]/[product]`
- Slugs derived from official names (lowercase, hyphenated). Product slugs include the official SKU for stability (e.g. `pro-vitality-food-supplement-305`).

### 10.2 Metadata

- **Title:** "NeoLife Products | NEOLIFE" on catalogue pages; "{Product Name} | NEOLIFE" on product pages; "{Category} | NEOLIFE" on category pages.
- **Description:** 1-2 original sentences per page, no copied marketing copy.
- **Canonical:** the deepest valid URL; category pages canonicalise to themselves to avoid duplicate-content issues across category/subcategory views.
- **Open Graph:** og:title, og:description, og:image (placeholder or licensed image), og:type=website/product.

### 10.3 Sitemap & Robots

- Static routes (`/products`) and all category/subcategory/product routes are included in the sitemap.
- `robots.txt`: allow indexing of `/products*`; no sensitive admin routes are indexed.
- No third-party tracking (D-013).

### 10.4 Structured Data

- `Product` schema.org (name, image, sku, category, brand=NeoLife) on product pages -- only when pricing/availability data is present; omitted otherwise to avoid invalid markup.
- `BreadcrumbList` schema on category and product pages.

### 10.5 Deferred

- Sitemap generation: add `@sitemaps/next` or a custom generator in Phase 2.
- hreflang: not needed for the single Kenyan market MVP.
## 11. Admin CRM

### 11.1 Changes to Existing CRM

Product interests integrate into the existing CRM without creating a parallel system.

### 11.2 Lead List (`/admin/leads`)

- New column: **"Product interests"** -- count of `ProductInterest` records with status IN [NEW, CONTACTED, FOLLOW_UP]. Leads with new product interests appear at the top of the list.
- New filter: **"Product interest"** dropdown (New / Contacted / Follow-up / None).

### 11.3 Lead Detail (`/admin/leads/[id]`)

- New section: **"Product interests"** listing each interest: product name, category, subcategory, status, submitted date, source/campaign (from Lead attribution), notification status.
- Each interest row links to the product detail page.
- Status change per interest (NEW -> CONTACTED -> FOLLOW_UP -> CONVERTED / NOT_INTERESTED) via a server action, recording a `LeadEvent`.

### 11.4 Notification Status

- A `ProductInterest.notificationSent` boolean (or a `notificationSentAt` timestamp) tracks whether the email notification was sent, so the admin can see if the office team was alerted.

### 11.5 Scope

- Keep this proportional: one list column, one filter, one detail section, per-interest status. Do not build a full e-commerce admin.
## 12. Security / Privacy

### 12.1 Server-Side Validation

- Product interest input validated with Zod (mirrors the existing `leadSchema` pattern): name min 2/max 80, phone regex + normalization, email optional, message max 500, consent required literal true.
- Product ID validated as UUID before any query; slug validated with a safe charset regex before lookup.
- No raw user input is rendered without React escaping (XSS safe).

### 12.2 Rate Limiting & Bot Protection

- Reuse the existing in-memory rate limiter (`src/lib/rateLimit.ts`): 5 submissions/min per IP for product interest.
- Honeypot field (hidden "Website" field) on the interest form, same as `LeadForm`.
- Next.js Server Action origin checks provide CSRF mitigation.

### 12.3 Consent & PII

- Consent checkbox required before submission; `consentAt` timestamp recorded.
- PII minimization: only name, phone, email, city, message. No unnecessary fields.
- Privacy context documented (existing Privacy Notice covers lead data; extend it to note product-interest data).

### 12.4 Authorization & IDOR

- Product interest is written by anonymous visitors (no auth required).
- Admin access to product interests is gated by the existing `requireAdmin` guard; non-admin users cannot read interests.
- Interest records are accessed only via the lead detail page (admin-only); there is no direct `/admin/interests/[id]` route, preventing IDOR via enumeration.

### 12.5 Email Security

- API key in environment variable, never committed.
- Recipient/sender are server-side constants.
- Visitor message is HTML-escaped before insertion.
- No tracking pixels, no external links in emails (D-013).

### 12.6 Retention

- Product interests follow the same retention policy as leads (documented in the existing data-protection baseline, D-006).
- Auditability: every interest submission and status change records a `LeadEvent`.

### 12.7 Tracking

- **D-013 first-party tracking only.** No Meta Pixel, GA4, fingerprinting, or advertising cookies. Attribution is inherited from the Lead record (UTM, firstTouchSource, landingPage).
## 13. Test Plan

### 13.1 Unit / Integration

- Catalogue data: category/subcategory/product lookup, slug validation, slug -> product resolution.
- Product-interest validation: valid, missing consent, short/oversized name, invalid phone, invalid email, honeypot, message length cap.
- Duplicate handling: same product + same lead + active status updates, does not create duplicate.
- Lead association: existing phone reused; new phone creates a lead; attribution (UTM, firstTouchSource, landingPage) inherited from the lead.
- Notification behavior: provider wrapper called after commit; failure does not roll back the interest.

### 13.2 E2E

- Browse catalogue: `/products` -> category -> product detail.
- Express interest: fill form, submit, see confirmation.
- Admin sees interest: sign in, open lead detail, see product interest with status NEW.
- Status change: admin changes interest status, sees updated status.

### 13.3 Security

- Invalid input: malformed UUID product ID -> 404; invalid slug -> 404; oversized fields -> rejected.
- Unauthorized access: unauthenticated admin cannot reach interest management.
- IDOR: direct access to an interest via a fabricated route -> 404 (no direct interest route).
- Rate limiting: 6th submission in a minute -> rate-limited response.
- Malformed product IDs/slugs: rejected before any query.

### 13.4 Do Not Weaken Existing Tests

Existing 43 tests (lead validation, attribution, persistence, auth, meetings, rate limit) remain untouched.
## 14. MVP Scope

### 14.1 MUST HAVE (first catalogue release)

- Category listing page (`/products`) with category tiles
- Category pages with subcategory navigation
- Product grid with cards (name, SKU, subcategory tags, "Contact us" price, "I'm Interested" CTA)
- Product detail page with original description and interest form
- Product-interest capture (form, server-side validation, honeypot, rate limit)
- ProductInterest persisted to database
- Lead upsert/reuse with attribution inheritance
- Email notification to office team on new interest
- Admin CRM: product-interest column, filter, detail section, status management
- Mobile responsive
- Botanical/wellness visual identity consistent with the existing site
- SEO basics (titles, descriptions, canonical, sitemap inclusion)
- Security: validation, rate limit, consent, IDOR protection, XSS/SQLi protection
- Loading/empty/error states

### 14.2 SHOULD HAVE (immediately after launch)

- Product variants (flavours, sizes, skin types) modelled as variant records
- Product images (after licensing confirmed)
- KSh pricing display (after Owner supplies price list)
- Catalogue search/filter (name, category, subcategory)
- Product structured data (schema.org Product)
- Sitemap generation automation
- Email template branding

### 14.3 DEFERRED (explicitly not part of this release)

- Checkout
- Payment processing
- Shopping cart
- Order fulfilment
- Customer accounts / portal
- Online distributor registration
- Commission calculations
- Downline / team functionality
- Advanced inventory management
- Self-service calendar booking
- Mobile app
- Advanced analytics / BI
## 15. Future Compatibility

This MVP is designed to evolve into commerce without implementing commerce now.

- **Pricing:** `Product.priceKsh` (optional decimal) or a `ProductPrice` model (multi-currency, effective dates) added in Phase 2. The UI renders price only when present; "Contact us" is the fallback.
- **Variants:** `ProductVariant` model (productId, name, sku, size, flavour, price). Products with visible variants (Super 10 sizes, NeoLifeShake flavours, Nutriance skin sets) are flagged for variant modelling.
- **Product images:** `Product.imageUrl` is a single optional field; a `ProductImage` gallery model can replace it later.
- **Orders:** future `Order`/`OrderItem` models reference `Product` and `ProductVariant`. No order models exist now.
- **Customer accounts:** a future `Customer` model would reference `Lead`. No customer model exists now.
- **Availability:** a `Product.availability` field or `ProductAvailability` model when stock control is required.
- **Search/filter:** a lightweight name+category+subcategory filter on the existing product data; a full search engine (e.g. Meilisearch/Algolia) is deferred.

The data model boundaries (Category/Subcategory/Product/ProductInterest) are stable and do not need restructuring when these features are added.
## 16. Owner Decisions Required

### 🟨 DECISION 1 -- Initial price display

- **Decision:** What should the catalogue show before the KSh price list is supplied?
- **Option A:** No price
- **Option B:** "Price coming soon"
- **Option C:** "Contact us" / "Request a quote"
- **Recommendation:** Option C
- **Reason:** Signals commercial availability, directs visitors into the product-interest flow, and avoids misleading pricing. Option A gives no commercial signal; Option B creates a dead-end suggesting incompleteness.
- **Impact:** Affects product cards, product detail, and the interest-form framing. The data model already supports a future `priceKsh` field.

### 🟨 DECISION 2 -- Product imagery / licensing

- **Decision:** May we use NeoLife product images in the catalogue?
- **Option A:** Owner supplies licensed imagery
- **Option B:** Use placeholder imagery (botanical gradients/SVG) until licensed imagery is approved
- **Option C:** Reuse official site images (NOT recommended -- no permission established)
- **Recommendation:** Option B now, Option A when ready
- **Reason:** We have not established permission to reuse official NeoLife product images. Downloading them would risk copyright infringement. The existing `Photo`/`BotanicalImage` components already provide acceptable placeholders consistent with the visual identity.
- **Impact:** Affects product card and detail imagery. Self-hosted only; CSP unchanged.

### 🟨 DECISION 3 -- Email provider

- **Decision:** Which transactional email provider should send product-interest notifications?
- **Option A:** SendGrid
- **Option B:** Mailgun
- **Option C:** Amazon SES
- **Option D:** Resend
- **Recommendation:** Any of A-D; the architecture is provider-agnostic via a `src/lib/email.ts` wrapper selected by `EMAIL_PROVIDER`. Recommend SendGrid or Mailgun for free tiers and ease of local dev (sandbox mode).
- **Reason:** All four are reliable, low-cost, API-based, and compatible with the existing Next.js Server Action architecture. The wrapper isolates the provider so it can be swapped without code changes.
- **Impact:** Requires an `EMAIL_API_KEY` secret (never committed) and a verified sender domain.

### 🟨 DECISION 4 -- Product description / content approach

- **Decision:** How should product descriptions be written?
- **Option A:** Copy official marketing descriptions verbatim (NOT recommended -- copyright risk)
- **Option B:** Concise original summaries based on official product information
- **Option C:** Owner supplies/licensed descriptions
- **Recommendation:** Option B as the default; Option C if the Owner has licensed copy
- **Reason:** Factual names, categories and SKUs are reproduced accurately. Descriptions are original and concise to avoid copyright infringement. Claim-heavy descriptions (health/nutrition claims) require Owner review before use.
- **Impact:** Affects all product detail pages. Compliance-safe wording required (no medical/cure claims, no income guarantees).

### 🟨 DECISION 5 -- Catalogue search / filter scope

- **Decision:** Should the MVP include search and filtering?
- **Option A:** Name + category + subcategory filter only (lightweight, on existing data)
- **Option B:** Full-text search engine (e.g. Meilisearch/Algolia)
- **Option C:** No search/filter
- **Recommendation:** Option A for MVP
- **Reason:** ~70 products is navigable by category/subcategory; a lightweight filter adds real value without infrastructure. Option B is deferred to Phase 2.
- **Impact:** Affects the category page UI and a possible `/products` search box.

### 🟨 DECISION 6 -- Route structure for subcategories

- **Decision:** Should subcategory pages have their own routes, or filter client-side?
- **Option A:** Dedicated routes `/products/[category]/[subcategory]`
- **Option B:** Filter client-side on the category page
- **Recommendation:** Option A
- **Reason:** Clean URLs, better SEO, and the official site uses dedicated subcategory URLs. The join-table data model already supports it. Client-side filtering (Option B) is simpler but weaker for SEO and breadcrumbs.
- **Impact:** Affects route count and sitemap entries. No hard technical cost.

### 🟨 DECISION 7 -- Kenyan product list and KSh price list

- **Decision:** The official shop shows the Northern Europe market (SEK). The Kenyan catalogue is not publicly visible.
- **Option A:** Use the Northern Europe product list as the catalogue scope, with KSh prices supplied later by the Owner
- **Option B:** Owner supplies the authoritative Kenyan product list before the catalogue is built
- **Recommendation:** Option B (preferred) -- the data model is market-agnostic, so Option A is acceptable as an interim
- **Reason:** The Kenyan market may have a different product assortment. The Owner must confirm the authoritative product list and supply the KSh price list. The architecture supports market-specific pricing without restructuring.
- **Impact:** Affects the product inventory content and all pricing displays.

### 🟨 DECISION 8 -- ProductInterest vs Lead data model

- **Decision:** Should product interest be a separate `ProductInterest` entity, or an attribute on `Lead`?
- **Option A:** Separate `ProductInterest` entity (recommended in §5)
- **Option B:** A `Lead` field (e.g. `interestedProducts` JSON array)
- **Recommendation:** Option A
- **Reason:** One lead can have multiple interests over time; a separate entity supports the full history, status lifecycle, timestamps per interest, and future orders/customers. Option B cannot represent this cleanly.
- **Impact:** Affects the schema (4 new models + 1 enum). No Prisma changes have been made; this decision must be confirmed before the migration is written.
## 17. Implementation Phases

### Phase C1 -- Catalogue data & data layer (planning only; no code yet)

- Confirm the authoritative Kenyan product list with the Owner (Decision 7).
- Finalise the Prisma migration (Category, Subcategory, Product, ProductInterest, InterestStatus, join tables).
- Seed catalogue data from the official source (names, SKUs, slugs, category/subcategory mapping).

### Phase C2 -- Public catalogue UI

- `/products` landing page with category tiles.
- Category pages with subcategory navigation and product grid.
- Product detail page with original description and interest form.
- Reuse existing `Photo`, `Botanical`, `Section`, `CtaLink`, `Reveal` components.
- Placeholder imagery until licensing is confirmed (Decision 2).

### Phase C3 -- Product interest workflow

- Server action: validate, rate-limit, honeypot, upsert Lead, create ProductInterest, create LeadEvent.
- Attribution inheritance from the Lead record.
- Email notification via `src/lib/email.ts` wrapper (Decision 3).
- Admin CRM: list column, filter, detail section, status management.

### Phase C4 -- SEO, security hardening, tests

- Metadata, canonical, Open Graph, sitemap, structured data.
- Security review: validation, rate limit, consent, IDOR, XSS/SQLi.
- Unit, integration, E2E, and security tests per §13.
- Lint, typecheck, build verification.

### Phase C5 -- Owner review & launch

- Owner reviews the catalogue content, descriptions, and imagery.
- Owner supplies the KSh price list (Decision 1).
- Paid-traffic launch gate (§11.6 of PROJECT_PLAN.md) applies only if the catalogue is promoted via ads.

**Status:** All phases are PLANNED. None have been implemented.
