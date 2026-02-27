## Plan: Shop Local Arlington — Full Implementation

### Project Overview

A multi-page static website for Arlington, MA that lets visitors **browse** local shops with 360° interiors and an embedded AI chat, or **post and discover** items via a community board. Hosted on GitHub Pages with Supabase (free tier) for data and LLM queries.

**Repo:** [https://github.com/Ivanaz916/shop_local](https://github.com/Ivanaz916/shop_local)
**Live site:** [https://ivanaz916.github.io/shop_local/](https://ivanaz916.github.io/shop_local/)

---

### Architecture

```
                        index.html (Landing Page)
                       /                          \
                      /                            \
           browse.html                      requests.html
   (Gallery + 360° + Chat)            (Community Board: Wanted / For Sale)
              |                                    |
      shops.json (local)                     Supabase DB
      Pannellum 360°                      (requests table)
      Embedded Chat
        (LLM / local search)
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
├── index.html                  ← Landing page (2 cards: Browse / Looking For…)
├── browse.html                 ← Shop gallery + Pannellum 360° + embedded AI chat
├── requests.html               ← Community board: Wanted + For Sale posts
├── css/
│   ├── styles.css              ← Shared + browse + embedded chat styles
│   ├── landing.css             ← Landing page styles
│   └── requests.css            ← Request board styles
├── js/
│   ├── app.js                  ← Browse page controller (shop cards, sidebar, chat)
│   ├── interior.js             ← Pannellum 360° viewer module
│   ├── supabase-client.js      ← Supabase init + queries (requests, listings, LLM)
│   └── chat.js                 ← Embedded chat module (scope-aware, used by app.js)
├── data/
│   └── shops.json              ← Local shop directory (4 shops)
├── images/
│   ├── panos/                  ← 360° interior equirectangular JPEGs
│   ├── people/                 ← People images
│   └── town/                   ← Hero/town images
├── supabase/
│   └── functions/
│       └── chat/index.ts       ← LLM query Edge Function (future)
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

---

### Phase 6 — "Looking For…" Request Board (Blind Requests)

**Goal:** Let shoppers post what they're looking for. Shop owners see only the request text (no personal info). Site owner manually brokers matches via email.

**Status:** ✅ Frontend built — needs Supabase tables deployed.

16. **Supabase tables/views/functions:**

    ```sql
    -- Requests table (full data — private)
    CREATE TABLE requests (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      requester_name TEXT NOT NULL,
      requester_email TEXT NOT NULL,
      request_text TEXT NOT NULL CHECK (char_length(request_text) >= 10),
      flag_count INT DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT now()
    );

    ALTER TABLE requests ENABLE ROW LEVEL SECURITY;

    -- Anyone can insert (rate-limited by app logic)
    CREATE POLICY "Anyone can insert requests"
      ON requests FOR INSERT WITH CHECK (true);

    -- Public view — only exposes safe columns (no name/email)
    CREATE VIEW requests_public AS
      SELECT id, request_text, created_at
      FROM requests
      WHERE flag_count < 3
        AND created_at > now() - INTERVAL '30 days'
      ORDER BY created_at DESC;

    -- Flag function (increments flag_count)
    CREATE OR REPLACE FUNCTION flag_request(req_id UUID)
    RETURNS void AS $$
      UPDATE requests SET flag_count = flag_count + 1 WHERE id = req_id;
    $$ LANGUAGE sql SECURITY DEFINER;
    ```

17. **`requests.html`** — new page:
    - Form: first name, email, request text (honeypot for spam)
    - Public board: shows only request text + time ago (no personal info)
    - "I have this" flow: shop owners email arlingtonislocal@gmail.com referencing the request
    - Flag button: 3+ flags auto-hides request (no manual review)
    - 30-day auto-expiry via view filter
    - No auth required

18. **Landing page update (`index.html`):**
    - Third card: "Looking For…" → links to `requests.html`
    - Stats strip: added "Active Requests" counter

**Files added/modified:**
- `requests.html` (new)
- `css/requests.css` (new)
- `js/supabase-client.js` (added `submitRequest`, `fetchRequests`, `flagRequest`)
- `index.html` (third card + stats)

---

### Phase 7 — User Listings + Shop Drop-Offs (Pending Survey Validation)

**Goal:** Allow users to list their own second-hand items for sale and use participating shops as exchange/drop-off points.

**Status:** 🗳️ Survey deployed on browse page. Will build after gauging user interest.

19. **Feature interest survey** (deployed):
    - Appears on `browse.html` below marketplace
    - 3-option vote: Yes / Maybe / No
    - Optional comment field
    - Results stored in Supabase `survey_responses` table
    - Auto-hides after vote or dismiss (localStorage)
    - Results shown inline after voting

    ```sql
    CREATE TABLE survey_responses (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      survey_id TEXT NOT NULL,
      vote TEXT NOT NULL CHECK (vote IN ('yes', 'no', 'maybe')),
      comment TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    );

    ALTER TABLE survey_responses ENABLE ROW LEVEL SECURITY;

    CREATE POLICY "Anyone can insert survey votes"
      ON survey_responses FOR INSERT WITH CHECK (true);

    CREATE POLICY "Anyone can read survey results"
      ON survey_responses FOR SELECT USING (true);
    ```

20. **If survey validates interest**, build Phase A+B:
    - `list-item.html` — submission form (title, price, description, photo, seller name/email, drop-off shop picker)
    - `user_listings` Supabase table with `drop_off_shop_id` and `status` workflow
    - Supabase Storage bucket for listing photos
    - "Community" badge on browse page to distinguish user listings from FB marketplace items
    - Shops get `accepts_dropoffs` flag in `shops.json`

**Files added/modified:**
- `js/app.js` (added `initSurvey()`)
- `js/supabase-client.js` (added `submitSurveyVote`, `fetchSurveyResults`)
- `css/styles.css` (added survey styles)
- `browse.html` (added survey section)

---

### Phase 8 — Site Simplification & Chat Migration

**Goal:** Simplify the site from 3 landing cards to 2. Remove Ask a Local standalone page, FB Marketplace section, and feature survey. Embed the chat interface into the browse page (scope-aware). Expand the "Looking For…" board into a dual-purpose community board supporting both "Wanted" and "For Sale" posts.

**Status:** ✅ Implemented

21. **Landing page simplification (`index.html`):**
    - Reduced from 3 cards to 2: "Walk the Block" (→ browse.html) and "Looking For…" (→ requests.html)
    - Removed "Ask a Local" card entirely
    - Updated Walk the Block description: "Browse local shops, peek inside with 360° views, and search for what you need."
    - Updated Looking For description: "Post what you're looking for — or list something for sale. Connect with your neighbors."
    - Removed "Marketplace Listings" stat; kept Local Shops, 360° Views, Active Requests
    - Removed `fetchListings()` call from inline script

22. **Browse page — marketplace/survey removal + embedded chat (`browse.html`):**
    - Removed `<section id="marketplace-section">` entirely
    - Removed `<section id="survey-section">` entirely
    - Removed "Search" nav link from top bar
    - Added `<section id="chat-section">` after `#photo-grid` — chat messages, prompt chips, input bar
    - Chat always visible below shop cards in gallery mode
    - When inside 360° view, chat remains visible and scopes to current shop

23. **Chat behavior — scope-aware (`js/chat.js`):**
    - Refactored `ChatApp` to read `AppState.currentShopId` and `AppState.mode`
    - Gallery mode: `askQuestion(question)` searches all shops
    - Interior mode: `askQuestion(question, shopId)` scopes to current shop
    - Prompt chips update dynamically per mode
    - Chat messages cleared on mode transition

24. **App.js cleanup (`js/app.js`):**
    - Removed `renderMarketplace()`, `stringToColor()`, `initSurvey()`, survey constants
    - Added `initChat()` call in `initApp()`
    - `enterShop()` and `exitToStreet()` now call `ChatApp.setScope()` and `ChatApp.updateChips()`

25. **Supabase client updates (`js/supabase-client.js`):**
    - Updated `askQuestion(question, shopId?)` — scoped search when shopId provided
    - Updated `localSearch(question, shopId?)` — filters to single shop when scoped
    - Removed `submitSurveyVote()` and `fetchSurveyResults()` exports
    - Kept `fetchListings()` for future shop-owner inventory
    - Updated `submitRequest()` to accept `postType`, `fbLink`, `publishContact`
    - Updated `fetchRequests()` to return new columns

26. **Requests page — dual-purpose community board (`requests.html`):**
    - Added post-type toggle: "I'm looking for something" vs "I have something for sale"
    - For Sale mode: textarea label changes, optional FB Marketplace link input, submit button text updates
    - "Publish my contact info" checkbox (name + email shown on card when opted in)
    - Board shows "Wanted"/"For Sale" badge per card
    - Contact info shown when poster opted in
    - "View on Facebook" link when FB URL provided
    - Flag + 30-day expiry still functional

27. **CSS changes:**
    - Removed marketplace styles from `css/styles.css`
    - Removed survey styles from `css/styles.css`
    - Added embedded chat styles to `css/styles.css` (adapted from `css/chat.css`)
    - Updated `css/landing.css` to 2-column card grid
    - Updated `css/requests.css` with toggle, badge, and FB link styles

28. **File cleanup:**
    - Deleted `search.html` (functionality moved to browse page)
    - Deleted `css/chat.css` (styles merged into `css/styles.css`)

29. **Supabase schema migration:**
    ```sql
    ALTER TABLE requests ADD COLUMN post_type TEXT NOT NULL DEFAULT 'wanted'
      CHECK (post_type IN ('wanted', 'for_sale'));
    ALTER TABLE requests ADD COLUMN fb_link TEXT;
    ALTER TABLE requests ADD COLUMN publish_contact BOOLEAN NOT NULL DEFAULT false;
    ```
    - SELECT RLS policy returns new columns
    - `fetchRequests()` conditionally includes `requester_name`/`requester_email` when `publish_contact = true`

**Files modified:**
- `index.html` (2-card layout, updated stats)
- `browse.html` (removed marketplace/survey, added embedded chat section)
- `requests.html` (dual-purpose board with post-type toggle, FB link, publish-contact)
- `js/app.js` (removed marketplace/survey code, added chat init)
- `js/chat.js` (refactored for embedded, scope-aware usage)
- `js/supabase-client.js` (updated request functions, removed survey functions)
- `css/styles.css` (removed marketplace/survey styles, added embedded chat styles)
- `css/landing.css` (2-column card grid)
- `css/requests.css` (toggle, badge, FB link styles)

**Files deleted:**
- `search.html`
- `css/chat.css`

**Deprecated phases:**
- Phase 4 (FB Marketplace Bookmarklet) — removed, too manual
- Phase 7 (User Listings Survey) — removed, replaced by direct For Sale posts on community board

