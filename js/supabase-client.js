/* ================================================================
   supabase-client.js — Supabase connection for shop listings & community data
   
   SETUP: Replace the placeholder URL and anon key below with your
   actual Supabase project credentials. Get them from:
   https://app.supabase.com → Your Project → Settings → API
   ================================================================ */

const SupabaseClient = (() => {
    // ---- CONFIGURATION ----
    // Replace these with your Supabase project values
    const SUPABASE_URL = 'https://weztjgtyudpvxtyktpfu.supabase.co';      // e.g., 'https://abc123.supabase.co'
    const SUPABASE_ANON_KEY = 'sb_publishable_r92Rj1RhiVElDJNLlo4Rcw_m2gHqsga'; // e.g., 'eyJhbGciOiJIUzI1NiIs...'

    let client = null;

    /**
     * Check if Supabase credentials are configured.
     */
    function isConfigured() {
        return SUPABASE_URL !== '' && SUPABASE_ANON_KEY !== '';
    }

    /**
     * Initialize the Supabase client (lazy, once).
     * Loads the Supabase JS library from CDN if not already present.
     */
    async function getClient() {
        if (client) return client;
        if (!isConfigured()) {
            console.warn('[SupabaseClient] Not configured — using mock data. Set SUPABASE_URL and SUPABASE_ANON_KEY in supabase-client.js');
            return null;
        }

        // Dynamically load Supabase JS if not bundled
        if (typeof supabase === 'undefined') {
            await loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js');
        }

        client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        return client;
    }

    /**
     * Fetch active shop listings (featured items from partner shops).
     * Falls back to mock data if Supabase isn't configured.
     */
    async function fetchListings(category, limit) {
        const sb = await getClient();

        if (!sb) {
            // Return mock data for local development
            return getMockListings(category, limit);
        }

        let query = sb.from('shop_listing').select('*').eq('is_active', true).order('created_at', { ascending: false });

        if (category && category !== 'all') {
            query = query.eq('category', category);
        }
        if (limit) {
            query = query.limit(limit);
        }

        const { data, error } = await query;

        if (error) {
            console.error('[SupabaseClient] fetch error:', error);
            return getMockListings(category, limit);
        }

        return data || [];
    }

    /**
     * Fetch all data for the LLM context (shops + featured listings).
     * shops.json provides departments, brands, and price ranges.
     * shop_listing provides optional featured items.
     */
    async function fetchAllForContext() {
        const listings = await fetchListings(null, 200);

        // Also load shops.json for complete context
        let shops = [];
        try {
            const resp = await fetch('data/shops.json');
            const data = await resp.json();
            shops = data.shops || [];
        } catch (e) {
            console.warn('[SupabaseClient] Could not load shops.json:', e);
        }

        return { shops, listings };
    }

    /**
     * Send a question to the Supabase Edge Function for LLM processing.
     * Falls back to local keyword search if Edge Function isn't deployed.
     * @param {string} question
     * @param {string} [shopId] - Optional shop ID to scope the search to
     */
    async function askQuestion(question, shopId) {
        const sb = await getClient();

        if (sb) {
            try {
                const { data, error } = await sb.functions.invoke('chat', {
                    body: { question }
                });

                if (!error && data && data.answer) {
                    return data.answer;
                }
            } catch (e) {
                console.warn('[SupabaseClient] Edge Function call failed, falling back to local:', e);
            }
        }

        // Fallback: local keyword-based search
        return localSearch(question, shopId);
    }

    /**
     * Simple local keyword search as fallback when Supabase/LLM isn't available.
     * @param {string} question
     * @param {string} [shopId] - Optional shop ID to scope the search to
     */
    async function localSearch(question, shopId) {
        const { shops, listings } = await fetchAllForContext();
        const q = question.toLowerCase();
        const words = q.split(' ').filter(w => w.length > 2);
        const results = [];

        // Filter shops if scoped
        const targetShops = shopId ? shops.filter(s => s.id === shopId) : shops;

        // Search shops — match against name, category, description, departments, and brands
        targetShops.forEach(shop => {
            const depts = (shop.departments || []).join(' ');
            const brands = (shop.brands || []).join(' ');
            const priceInfo = Object.entries(shop.priceRanges || {}).map(([k, v]) => `${k}: ${v}`).join(', ');
            const text = `${shop.name} ${shop.category} ${shop.description} ${depts} ${brands}`.toLowerCase();
            if (words.some(word => text.includes(word))) {
                const hoursArr = Array.isArray(shop.hours) ? shop.hours : (shop.hours ? [shop.hours] : []);
                const hoursText = hoursArr.join('; ');
                const daysText = Array.isArray(shop.days_open) ? shop.days_open.join(', ') : (shop.days_open || '');
                let info = `🏪 **${shop.name}** (${shop.category}) — ${shop.description}`;
                if (hoursText) info += `\nHours: ${hoursText}`;
                if (daysText) info += `\nOpen: ${daysText}`;
                if (depts) info += `\n📂 Departments: ${(shop.departments || []).join(', ')}`;
                if (brands) info += `\n🏷️ Brands: ${(shop.brands || []).join(', ')}`;
                if (priceInfo) info += `\n💰 Prices: ${priceInfo}`;
                results.push(info);
            }
        });

        // Search featured listings from shop_listing (scoped to shop if applicable)
        const targetListings = shopId ? listings.filter(l => l.shop_id === shopId) : listings;
        targetListings.forEach(listing => {
            const text = `${listing.title} ${listing.category || ''} ${listing.description || ''}`.toLowerCase();
            if (words.some(word => text.includes(word))) {
                const price = listing.price ? `$${listing.price}` : 'Price not listed';
                results.push(`🛍️ **${listing.title}** — ${price}${listing.description ? '. ' + listing.description : ''}`);
            }
        });

        if (results.length === 0) {
            if (shopId) {
                const shop = targetShops[0];
                if (shop) {
                    const hoursArr = Array.isArray(shop.hours) ? shop.hours : (shop.hours ? [shop.hours] : []);
                    const hoursText = hoursArr.join('; ');
                    const daysText = Array.isArray(shop.days_open) ? shop.days_open.join(', ') : (shop.days_open || '');
                    let resp = `Here's what I know about **${shop.name}**:\n\n🏪 **${shop.name}** (${shop.category})\n${shop.description}`;
                    if (hoursText) resp += `\n⏰ Hours: ${hoursText}`;
                    if (daysText) resp += `\nOpen: ${daysText}`;
                    if (shop.website && shop.website !== '#') resp += `\n🌐 ${shop.website}`;
                    return resp;
                }
            }
            return "I couldn't find anything matching that. Try asking about specific shops, categories like \"restaurants\" or \"books\", or check the Browse page to see everything available.";
        }

        return `Here's what I found:\n\n${results.join('\n\n')}`;
    }

    // --------------- Mock Data (for development without Supabase) ---------------
    function getMockListings(category, limit) {
        const mock = [
            {
                id: 'mock-1',
                shop_id: 'book-rack',
                title: 'Signed First Edition — Hemingway',
                price: 150.00,
                description: 'The Old Man and the Sea, first edition with dust jacket.',
                image_url: '',
                category: 'Rare & Collectible',
                created_at: '2026-02-10T12:00:00Z',
                is_active: true
            },
            {
                id: 'mock-2',
                shop_id: 'arlington-cafe',
                title: 'House-Made Croissant Box (6 ct)',
                price: 18.00,
                description: 'Freshly baked butter croissants — pre-order by 4pm for next-day pickup.',
                image_url: '',
                category: 'Pastries & Baked Goods',
                created_at: '2026-02-09T15:30:00Z',
                is_active: true
            },
            {
                id: 'mock-3',
                shop_id: 'menotomy-grill',
                title: 'Menotomy Burger',
                price: 16.00,
                description: 'Half-pound Angus patty, cheddar, house pickles, brioche bun. A local favorite.',
                image_url: '',
                category: 'Burgers & Sandwiches',
                created_at: '2026-02-08T09:00:00Z',
                is_active: true
            }
        ];

        let result = mock;
        if (category && category !== 'all') {
            result = result.filter(l => l.category === category);
        }
        if (limit) {
            result = result.slice(0, limit);
        }
        return result;
    }

    // --------------- Utility ---------------
    function loadScript(src) {
        return new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = src;
            s.onload = resolve;
            s.onerror = reject;
            document.head.appendChild(s);
        });
    }

    // --------------- Request Board ---------------

    /**
     * Submit a "Looking For" or "For Sale" post.
     */
    async function submitRequest({ name, email, requestText, postType, fbLink, publishContact, photoUrl }) {
        const sb = await getClient();
        if (!sb) {
            console.warn('[SupabaseClient] Not configured — request not saved.');
            return { success: false, reason: 'not_configured' };
        }

        const row = {
            requester_name: name,
            requester_email: email,
            request_text: requestText,
            post_type: postType || 'wanted',
            fb_link: fbLink || null,
            publish_contact: publishContact || false,
            photo_url: photoUrl || null
        };

        const { error } = await sb
            .from('requests')
            .insert([row]);

        if (error) {
            console.error('[SupabaseClient] submitRequest error:', error);
            return { success: false, reason: error.message };
        }
        return { success: true };
    }

    /**
     * Upload a photo to Supabase Storage and return its public URL.
     */
    async function uploadPhoto(file) {
        const sb = await getClient();
        if (!sb) {
            console.warn('[SupabaseClient] Not configured — photo not uploaded.');
            return { url: null };
        }

        const ext = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const filePath = `request-photos/${fileName}`;

        const { error } = await sb.storage
            .from('photos')
            .upload(filePath, file, { cacheControl: '3600', upsert: false });

        if (error) {
            console.error('[SupabaseClient] uploadPhoto error:', error);
            return { url: null };
        }

        const { data: urlData } = sb.storage
            .from('photos')
            .getPublicUrl(filePath);

        console.log('[SupabaseClient] uploadPhoto success, publicUrl:', urlData?.publicUrl);
        return { url: urlData?.publicUrl || null };
    }

    /**
     * Fetch active requests/posts (public view).
     * Returns post_type, fb_link, publish_contact, and conditionally name/email.
     */
    async function fetchRequests(limit) {
        const sb = await getClient();
        if (!sb) return getMockRequests(limit);

        let query = sb
            .from('requests')
            .select('id, request_text, created_at, post_type, fb_link, publish_contact, requester_name, requester_email, photo_url')
            .order('created_at', { ascending: false });

        if (limit) query = query.limit(limit);

        const { data, error } = await query;
        console.log('[SupabaseClient] fetchRequests result:', { data, error });
        if (error) {
            console.error('[SupabaseClient] fetchRequests error:', error);
            return [];
        }

        return data || [];
    }

    /**
     * Flag a request as inappropriate (increment flag_count).
     */
    async function flagRequest(requestId) {
        const sb = await getClient();
        if (!sb) return { success: false };

        const { error } = await sb.rpc('flag_request', { req_id: requestId });
        if (error) {
            console.error('[SupabaseClient] flagRequest error:', error);
            return { success: false };
        }
        return { success: true };
    }

    function getMockRequests(limit) {
        const mock = [
            { id: 'mock-r1', request_text: 'Looking for a standing desk under $200', created_at: '2026-02-20T10:00:00Z', post_type: 'wanted', fb_link: null, publish_contact: false, requester_name: null, requester_email: null, photo_url: null },
            { id: 'mock-r2', request_text: 'Selling kids ice skates, size 1-2, great condition!', created_at: '2026-02-19T14:30:00Z', post_type: 'for_sale', fb_link: 'https://facebook.com/marketplace/item/123', publish_contact: true, requester_name: 'Jamie', requester_email: 'jamie@example.com', photo_url: null },
            { id: 'mock-r3', request_text: 'Need a local tailor for suit alterations', created_at: '2026-02-18T09:00:00Z', post_type: 'wanted', fb_link: null, publish_contact: false, requester_name: null, requester_email: null, photo_url: null },
        ];
        return limit ? mock.slice(0, limit) : mock;
    }

    // --------------- Replies ---------------

    async function submitReply({ requestId, name, text }) {
        const sb = await getClient();
        if (!sb) {
            console.warn('[SupabaseClient] Not configured — reply not saved.');
            return { success: false, reason: 'not_configured' };
        }
        const { error } = await sb
            .from('request_replies')
            .insert([{ request_id: requestId, author_name: name, reply_text: text }]);
        if (error) {
            console.error('[SupabaseClient] submitReply error:', error);
            return { success: false, reason: error.message };
        }
        return { success: true };
    }

    async function fetchReplies(requestId) {
        const sb = await getClient();
        if (!sb) return [];
        const { data, error } = await sb
            .from('request_replies')
            .select('id, author_name, reply_text, created_at')
            .eq('request_id', requestId)
            .order('created_at', { ascending: true });
        if (error) {
            console.error('[SupabaseClient] fetchReplies error:', error);
            return [];
        }
        return data || [];
    }

    return {
        isConfigured, fetchListings, fetchAllForContext, askQuestion,
        submitRequest, fetchRequests, flagRequest, uploadPhoto,
        submitReply, fetchReplies
    };
})();
