## Plan: Shop Local Arlington — Full Implementation

### Project Overview

A multi-page static website for Arlington, MA that lets visitors **browse** local shops and marketplace listings or **search** via an AI-powered chat. Hosted on GitHub Pages with Supabase (free tier) for marketplace data and LLM queries.

**Repo:** [https://github.com/Ivanaz916/shop_local](https://github.com/Ivanaz916/shop_local)
**Live site:** [https://ivanaz916.github.io/shop_local/](https://ivanaz916.github.io/shop_local/)

---

### Architecture

```
                        index.html (Landing Page)
                       /                          \
                      /                            \
           browse.html                        search.html
      (Gallery + Marketplace)              (LLM Chat Interface)
              |                                    |
      shops.json (local)                  Supabase Edge Function
      Supabase listings                     /            \
      Pannellum 360°                  LLM API         Supabase DB
                                   (Groq/OpenAI)    (listings + shops)
```

| Layer | Technology | Cost |
|-------|-----------|------|
| Static hosting | GitHub Pages | Free |
| Shop data | `data/shops.json` | Free |
| Marketplace DB | Supabase Postgres (free tier: 500 MB, 50K rows) | Free |
| 360° interiors | Pannellum 2.5.6 (CDN, MIT license) | Free |
| LLM search | Supabase Edge Function → Groq Llama 3 or OpenAI GPT-4o-mini | $0–12/mo |
| Fonts | Google Fonts Inter (CDN) | Free |

---

### File Structure (after implementation)

```
shop_local/
├── index.html                  ← Landing page ("Browse" or "Search?")
├── browse.html                 ← Shop gallery + marketplace cards + Pannellum 360°
├── search.html                 ← LLM chat interface
├── css/
│   ├── styles.css              ← Shared + browse styles
│   ├── landing.css             ← Landing page styles
│   └── chat.css                ← Chat interface styles
├── js/
│   ├── app.js                  ← Browse page controller (shop cards, sidebar, modal)
│   ├── interior.js             ← Pannellum 360° viewer module
│   ├── supabase-client.js      ← Supabase init + listing queries
│   └── chat.js                 ← Search page / LLM chat controller
├── data/
│   └── shops.json              ← Local shop directory (4 shops)
├── images/
│   ├── neighborhood.jpg        ← Hero banner (Mass Ave photo)
│   ├── storefronts/            ← Storefront photos per shop
│   └── panos/                  ← 360° interior equirectangular JPEGs
├── supabase/
│   └── functions/
│       ├── chat/index.ts       ← LLM query Edge Function
│       └── add-listing/index.ts ← Bookmarklet insert endpoint
├── .gitignore
└── README.md
```

---

### Phase 1 — Landing Page

**Goal:** A welcoming entry point that splits visitors into Browse or Search.

1. **Rename current `index.html` → `browse.html`**
   - No logic changes — just rename the file
   - `browse.html` keeps everything: shop cards grid, sidebar, category filter, Pannellum 360° modal, info panel, all existing `app.js` + `interior.js` logic

2. **Create new `index.html`** — landing page with:
   - Same `#top-bar` header ("Shop Local Arlington" branding)
   - Hero section with neighborhood background image
   - Two large clickable cards side by side:
     - **Left: "Walk the Block"** — shop icon, subtitle "Browse local shops & marketplace finds", links to `browse.html`
     - **Right: "Ask a Local"** — chat icon, subtitle "Search for anything — our AI knows what's in stock", links to `search.html`
   - Responsive: stacks vertically on mobile
   - Footer with community tagline

3. **Create `css/landing.css`** — landing-specific styles:
   - Two-card hero layout (flexbox, equal width)
   - Hover animations (lift + shadow)
   - Gradient overlays on cards
   - Mobile stacking at 768px breakpoint
   - Shared CSS variables from `:root` (green/gold palette)

---

### Phase 2 — Supabase Database

**Goal:** Store marketplace listings in a free hosted Postgres database with a REST API.

4. **Create Supabase project** (free tier) with a `listings` table:

   ```sql
   CREATE TABLE listings (
     id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
     title TEXT NOT NULL,
     price NUMERIC(10, 2),
     description TEXT,
     image_url TEXT,
     seller_name TEXT,
     fb_link TEXT,
     category TEXT,
     created_at TIMESTAMPTZ DEFAULT now(),
     is_active BOOLEAN DEFAULT true
   );

   -- Public read access (RLS)
   ALTER TABLE listings ENABLE ROW LEVEL SECURITY;
   CREATE POLICY "Anyone can read active listings"
     ON listings FOR SELECT
     USING (is_active = true);
   ```

5. **Create `js/supabase-client.js`**
   - Load Supabase JS client via CDN (`@supabase/supabase-js@2`)
   - Initialize with project URL + public anon key (safe to expose — RLS controls access)
   - Export helper: `fetchListings(category?, limit?)` → queries `listings` table, returns array

6. **Add marketplace section to `browse.html`**
   - After the shop cards grid, add a `<section id="marketplace-grid">` with heading "Marketplace Finds"
   - `app.js` calls `fetchListings()` on load
   - Renders listing cards in the same grid style: image, title, price, category tag, "View on Facebook" button
   - Gold border accent to visually distinguish from shop cards
   - Graceful fallback if Supabase is unreachable (hide section, no error)

---

### Phase 3 — LLM Search Page

**Goal:** A conversational AI that answers questions about shops and listings using real data.

7. **Create `search.html`** — chat interface page:
   - `#top-bar` header with "← Home" link back to `index.html`
   - Centered chat container (max-width 720px)
   - Scrollable message area (user bubbles right-aligned, AI bubbles left-aligned)
   - Input bar at bottom: text input + send button
   - Sample prompt chips above input: "Bikes under $200", "Best coffee shop", "Any bookstores?"
   - Welcome message from AI: "Hi! I know what's happening on Mass Ave. Ask me about local shops, marketplace finds, or anything Arlington."

8. **Create Supabase Edge Function `chat`** (`supabase/functions/chat/index.ts`):
   - Receives: `POST { question: string }`
   - Fetches all active listings + shop data from Supabase DB
   - Builds prompt with system message + data context + user question
   - System prompt: *"You are a helpful local assistant for Arlington, MA. Answer based only on the shop and listing data provided. If you don't have relevant data, say so honestly. Be friendly and concise."*
   - Calls LLM API (Groq Llama 3 free tier, or OpenAI GPT-4o-mini)
   - Returns: `{ answer: string }`
   - **API key stays in Edge Function env vars — never exposed to browser**
   - Context stuffing approach (all data in prompt) — works for <500 listings
   - Can upgrade to RAG with pgvector later if listings exceed 500

9. **Create `js/chat.js`** — search page controller:
   - On submit: POST to `https://{project}.supabase.co/functions/v1/chat`
   - Display user message immediately (optimistic UI)
   - Show typing indicator while waiting
   - Render AI response as formatted message
   - If response references specific listings/shops, render clickable mini-cards below the message
   - Handle errors gracefully ("Sorry, I'm having trouble connecting. Try again in a moment.")

10. **Create `css/chat.css`** — chat interface styles:
    - Message bubbles (user: green, AI: white/gray)
    - Typing indicator animation
    - Input bar fixed to bottom
    - Prompt chips (pill buttons)
    - Responsive at all breakpoints

---

### Phase 4 — FB Marketplace Bookmarklet

**Goal:** Semi-automated curation of Facebook Marketplace listings into Supabase.

11. **Create `bookmarklet.html`** (gitignored — local tool only):
    - Contains a draggable bookmarklet link
    - When clicked on a Facebook Marketplace listing page, the bookmarklet:
      - Reads page DOM for title, price, first image URL
      - Opens a small popup/prompt pre-filled with extracted data
      - On confirm, POSTs to Supabase Edge Function `add-listing` with a secret token
    - Instructions for dragging the bookmarklet to your bookmarks bar

12. **Create Supabase Edge Function `add-listing`** (`supabase/functions/add-listing/index.ts`):
    - Receives: `POST { title, price, description, image_url, seller_name, fb_link, category, token }`
    - Validates the secret token (stored in env vars)
    - Inserts row into `listings` table
    - Returns: `{ success: true, id }`
    - Only you can insert — token-gated, not public

**Weekly workflow:**
1. Browse FB Marketplace for Arlington (10-15 min)
2. Click bookmarklet on interesting listings → auto-inserts to Supabase
3. Listings appear on `browse.html` and are queryable via `search.html` immediately

---

### Phase 5 — Polish & Deploy

13. **Add navigation links** across all pages:
    - `index.html`: two cards (Browse / Search)
    - `browse.html`: header links to Home and Search
    - `search.html`: header links to Home and Browse

14. **Update `README.md`** — document:
    - New multi-page architecture
    - Supabase setup instructions (project creation, table schema, Edge Function deployment)
    - LLM API key configuration (Edge Function env vars)
    - Bookmarklet usage guide
    - Local development instructions for all three pages

15. **Update `.gitignore`** — ensure `bookmarklet.html` and dev-only files are excluded

16. **Deploy:**
    - `git add . && git commit -m "Add landing page, marketplace, AI search" && git push`
    - GitHub Pages auto-deploys from `main` branch
    - Configure Supabase Edge Functions via `supabase functions deploy chat` and `supabase functions deploy add-listing`

---

### Verification Checklist

- [ ] **Landing page:** `index.html` shows two cards, both link correctly
- [ ] **Browse:** `browse.html` shows shop cards + marketplace listings from Supabase + Pannellum 360° works on "Walk Inside" click
- [ ] **Search:** `search.html` — type a question, get AI answer referencing real data
- [ ] **Bookmarklet:** Navigate to FB Marketplace listing, click bookmarklet, confirm data appears in Supabase dashboard and on `browse.html`
- [ ] **Mobile:** All three pages responsive at 768px and 480px breakpoints
- [ ] **Deep linking:** `browse.html?shop=capitol-theatre` opens directly into 360° view
- [ ] **Back button:** Browser back works across all page transitions

---

### Cost Summary

| Component | Monthly cost |
|-----------|-------------|
| GitHub Pages (hosting) | $0 |
| Supabase free tier (DB + Edge Functions) | $0 |
| LLM API (Groq free tier or ~100 queries/day on GPT-4o-mini) | $0–$12 |
| Pannellum (CDN) | $0 |
| Google Fonts (CDN) | $0 |
| **Total** | **$0–$12/mo** |

---

### Future Enhancements (not in initial scope)

- **RAG with pgvector** — upgrade from context stuffing when listings exceed 500; embed listings into vectors for semantic search
- **Google Maps re-integration** — if API billing issues resolve, add optional Street View walking layer back to browse page
- **Shop owner portal** — authenticated page where shop owners can update their own hours, descriptions, and panorama images
- **Push notifications** — notify subscribers when new marketplace listings match their interests
- **Analytics dashboard** — track page views, search queries, and popular listings using Supabase or a free analytics tool (Plausible, Umami)
