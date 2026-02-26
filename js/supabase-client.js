/* ================================================================
   supabase-client.js — Supabase connection for marketplace listings
   
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
     * Fetch active marketplace listings.
     * Falls back to mock data if Supabase isn't configured.
     */
    async function fetchListings(category, limit) {
        const sb = await getClient();

        if (!sb) {
            // Return mock data for local development
            return getMockListings(category, limit);
        }

        let query = sb.from('listings').select('*').eq('is_active', true).order('created_at', { ascending: false });

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
     * Fetch all data for the LLM context (shops + listings).
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
     */
    async function askQuestion(question) {
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
        return localSearch(question);
    }

    /**
     * Simple local keyword search as fallback when Supabase/LLM isn't available.
     */
    async function localSearch(question) {
        const { shops, listings } = await fetchAllForContext();
        const q = question.toLowerCase();
        const results = [];

        // Search shops
        shops.forEach(shop => {
            const text = `${shop.name} ${shop.category} ${shop.description}`.toLowerCase();
            if (q.split(' ').some(word => word.length > 2 && text.includes(word))) {
                results.push(`🏪 **${shop.name}** (${shop.category}) — ${shop.description} Hours: ${shop.hours}`);
            }
        });

        // Search listings
        listings.forEach(listing => {
            const text = `${listing.title} ${listing.category || ''} ${listing.description || ''}`.toLowerCase();
            if (q.split(' ').some(word => word.length > 2 && text.includes(word))) {
                const price = listing.price ? `$${listing.price}` : 'Price not listed';
                results.push(`🛍️ **${listing.title}** — ${price}${listing.description ? '. ' + listing.description : ''}`);
            }
        });

        if (results.length === 0) {
            return "I couldn't find anything matching that. Try asking about specific shops, categories like \"restaurants\" or \"books\", or check the Browse page to see everything available.";
        }

        return `Here's what I found:\n\n${results.join('\n\n')}`;
    }

    // --------------- Mock Data (for development without Supabase) ---------------
    function getMockListings(category, limit) {
        const mock = [
            {
                id: 'mock-1',
                title: 'Vintage Bicycle — Trek 820',
                price: 150.00,
                description: 'Great condition mountain bike, perfect for the Minuteman trail.',
                image_url: '',
                seller_name: 'Alex M.',
                fb_link: '#',
                category: 'Sports & Outdoors',
                created_at: '2026-02-10T12:00:00Z',
                is_active: true
            },
            {
                id: 'mock-2',
                title: 'Standing Desk — Adjustable',
                price: 200.00,
                description: 'Electric sit-stand desk, 48" wide. Moving sale!',
                image_url: '',
                seller_name: 'Jamie L.',
                fb_link: '#',
                category: 'Furniture',
                created_at: '2026-02-09T15:30:00Z',
                is_active: true
            },
            {
                id: 'mock-3',
                title: 'Kids Book Collection — 30 Books',
                price: 25.00,
                description: 'Ages 4-8. Includes Dr. Seuss, Elephant & Piggie, Dog Man.',
                image_url: '',
                seller_name: 'Priya K.',
                fb_link: '#',
                category: 'Books',
                created_at: '2026-02-08T09:00:00Z',
                is_active: true
            },
            {
                id: 'mock-4',
                title: 'KitchenAid Stand Mixer — Artisan',
                price: 175.00,
                description: 'Red, lightly used. Comes with all original attachments.',
                image_url: '',
                seller_name: 'Sarah T.',
                fb_link: '#',
                category: 'Home & Kitchen',
                created_at: '2026-02-07T18:00:00Z',
                is_active: true
            },
            {
                id: 'mock-5',
                title: 'Snow Tires — Bridgestone Blizzak 225/65R17',
                price: 300.00,
                description: 'Set of 4, used one season. Plenty of tread left.',
                image_url: '',
                seller_name: 'Mike R.',
                fb_link: '#',
                category: 'Auto',
                created_at: '2026-02-06T10:00:00Z',
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
     * Submit a "Looking For" request (blind — name/email stored but never shown publicly).
     */
    async function submitRequest({ name, email, requestText }) {
        const sb = await getClient();
        if (!sb) {
            console.warn('[SupabaseClient] Not configured — request not saved.');
            return { success: false, reason: 'not_configured' };
        }

        const { error } = await sb
            .from('requests')
            .insert([{ requester_name: name, requester_email: email, request_text: requestText }]);

        if (error) {
            console.error('[SupabaseClient] submitRequest error:', error);
            return { success: false, reason: error.message };
        }
        return { success: true };
    }

    /**
     * Fetch active requests (public view — only text + date, no personal info).
     */
    async function fetchRequests(limit) {
        const sb = await getClient();
        if (!sb) return getMockRequests(limit);

        let query = sb
            .from('requests')
            .select('id, request_text, created_at')
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
            { id: 'mock-r1', request_text: 'Looking for a standing desk under $200', created_at: '2026-02-20T10:00:00Z' },
            { id: 'mock-r2', request_text: 'Anyone have kids ice skates, size 1-2?', created_at: '2026-02-19T14:30:00Z' },
            { id: 'mock-r3', request_text: 'Need a local tailor for suit alterations', created_at: '2026-02-18T09:00:00Z' },
        ];
        return limit ? mock.slice(0, limit) : mock;
    }

    // --------------- Feature Survey ---------------

    /**
     * Submit a survey vote.
     */
    async function submitSurveyVote({ surveyId, vote, comment }) {
        const sb = await getClient();
        if (!sb) {
            console.warn('[SupabaseClient] Not configured — vote not saved.');
            return { success: false, reason: 'not_configured' };
        }

        const { error } = await sb
            .from('survey_responses')
            .insert([{ survey_id: surveyId, vote, comment: comment || null }]);

        if (error) {
            console.error('[SupabaseClient] submitSurveyVote error:', error);
            return { success: false, reason: error.message };
        }
        return { success: true };
    }

    /**
     * Fetch aggregated survey results.
     */
    async function fetchSurveyResults(surveyId) {
        const sb = await getClient();
        if (!sb) return { yes: 0, no: 0, maybe: 0, total: 0 };

        const { data, error } = await sb
            .from('survey_responses')
            .select('vote')
            .eq('survey_id', surveyId);

        if (error || !data) return { yes: 0, no: 0, maybe: 0, total: 0 };

        const counts = { yes: 0, no: 0, maybe: 0, total: data.length };
        data.forEach(r => { if (counts[r.vote] !== undefined) counts[r.vote]++; });
        return counts;
    }

    return {
        isConfigured, fetchListings, fetchAllForContext, askQuestion,
        submitRequest, fetchRequests, flagRequest,
        submitSurveyVote, fetchSurveyResults
    };
})();
