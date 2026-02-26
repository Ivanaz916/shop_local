/* ================================================================
   app.js — Main controller & state management
   Manages dual-renderer transitions (StreetView ↔ Pannellum),
   sidebar, info panel, URL history, and shop data loading.
   ================================================================ */

// --------------- Application State ---------------
const AppState = {
    mode: 'gallery',          // 'gallery' | 'interior'
    currentShopId: null,
    shops: [],
    sidebarOpen: false,
    activeFilter: 'all'
};

// --------------- DOM References ---------------
const DOM = {
    photoGrid:       () => document.getElementById('photo-grid'),
    pannellumView:   () => document.getElementById('pannellum-view'),
    loadingOverlay:  () => document.getElementById('loading-overlay'),
    modeBadge:       () => document.getElementById('mode-badge'),
    sidebarToggle:   () => document.getElementById('sidebar-toggle'),
    sidebar:         () => document.getElementById('sidebar'),
    shopList:        () => document.getElementById('shop-list'),
    categoryFilter:  () => document.getElementById('category-filter'),
    infoPanel:       () => document.getElementById('shop-info-panel'),
    panelName:       () => document.getElementById('panel-shop-name'),
    panelDesc:       () => document.getElementById('panel-shop-description'),
    panelCategory:   () => document.getElementById('panel-shop-category'),
    panelHours:      () => document.querySelector('#panel-shop-hours span'),
    panelWebsite:    () => document.getElementById('panel-shop-website'),
    btnBackToStreet: () => document.getElementById('btn-back-to-street'),
    panelClose:      () => document.getElementById('panel-close')
};

// --------------- Data Loading ---------------
async function loadShops() {
    try {
        const resp = await fetch('data/shops.json');
        const data = await resp.json();
        AppState.shops = data.shops;
        return data;
    } catch (err) {
        console.error('Failed to load shops.json:', err);
        return null;
    }
}

// --------------- Sidebar ---------------
function toggleSidebar() {
    AppState.sidebarOpen = !AppState.sidebarOpen;
    const sidebar = DOM.sidebar();
    sidebar.classList.toggle('sidebar-open', AppState.sidebarOpen);
    sidebar.classList.toggle('sidebar-closed', !AppState.sidebarOpen);
}

function populateSidebar(shops) {
    const list = DOM.shopList();
    const filter = DOM.categoryFilter();

    // Build category options
    const categories = [...new Set(shops.map(s => s.category))].sort();
    categories.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.textContent = cat;
        filter.appendChild(opt);
    });

    // Render shop items
    renderShopList(shops);

    // Filter handler
    filter.addEventListener('change', () => {
        AppState.activeFilter = filter.value;
        const filtered = filter.value === 'all'
            ? shops
            : shops.filter(s => s.category === filter.value);
        renderShopList(filtered);
    });
}

function renderShopList(shops) {
    const list = DOM.shopList();
    list.innerHTML = '';
    shops.forEach(shop => {
        const li = document.createElement('li');
        li.className = 'shop-item';
        li.dataset.shopId = shop.id;
        li.innerHTML = `
            <div class="shop-item-name">${shop.name}</div>
            <div class="shop-item-category">${shop.category}</div>
        `;
        li.addEventListener('click', () => enterShop(shop.id));
        list.appendChild(li);
    });
}

// --------------- Info Panel ---------------
function showInfoPanel(shop) {
    DOM.panelName().textContent = shop.name;
    DOM.panelDesc().textContent = shop.description;
    DOM.panelCategory().textContent = shop.category;
    DOM.panelHours().textContent = shop.hours;

    const webLink = DOM.panelWebsite();
    if (shop.website && shop.website !== '#') {
        webLink.href = shop.website;
        webLink.style.display = 'inline-flex';
    } else {
        webLink.style.display = 'none';
    }

    DOM.infoPanel().classList.remove('panel-hidden');
    DOM.infoPanel().classList.add('panel-visible');
}

function hideInfoPanel() {
    DOM.infoPanel().classList.remove('panel-visible');
    DOM.infoPanel().classList.add('panel-hidden');
}

// --------------- Loading Overlay ---------------
function showLoading() {
    DOM.loadingOverlay().classList.remove('hidden');
}

function hideLoading() {
    DOM.loadingOverlay().classList.add('hidden');
}

// --------------- Photo Grid ---------------
function renderPhotoGrid(shops) {
    const grid = DOM.photoGrid();
    grid.innerHTML = '';
    
    // Colors for placeholder backgrounds
    const colors = ['#c62828', '#6a1b9a', '#1565c0', '#2e7d32', '#ef6c00', '#00838f'];
    
    shops.forEach((shop, index) => {
        const card = document.createElement('div');
        card.className = 'shop-card';
        card.dataset.shopId = shop.id;
        
        const imgPath = shop.panoFile ? `images/panos/${shop.panoFile}` : '';
        const bgColor = colors[index % colors.length];
        
        card.innerHTML = `
            <div class="shop-card-image" style="background-image: url('${imgPath}'); background-color: ${bgColor}">
                <span class="shop-card-category">${shop.category}</span>
                ${!imgPath ? `<span class="shop-card-placeholder">${shop.name.charAt(0)}</span>` : ''}
            </div>
            <div class="shop-card-content">
                <h3 class="shop-card-name">${shop.name}</h3>
                <p class="shop-card-description">${shop.description}</p>
                <button class="shop-card-btn">View 360° Tour</button>
            </div>
        `;
        
        card.querySelector('.shop-card-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            enterShop(shop.id);
        });
        
        grid.appendChild(card);
    });
}

// --------------- Mode Transitions ---------------

/**
 * Transition from gallery into a shop's interior panorama.
 */
function enterShop(shopId) {
    const shop = AppState.shops.find(s => s.id === shopId);
    if (!shop) return;

    showLoading();

    AppState.currentShopId = shopId;
    AppState.mode = 'interior';

    // Toggle views
    DOM.photoGrid().style.display = 'none';
    DOM.pannellumView().classList.remove('hidden');

    // Load the interior panorama
    InteriorModule.loadShop(shop, () => {
        hideLoading();
    });

    // Update UI
    updateModeBadge('interior');
    showInfoPanel(shop);
    highlightSidebarItem(shopId);

    // Push history state for back-button support
    history.pushState({ mode: 'interior', shopId }, '', `?shop=${shopId}`);
}

/**
 * Transition from interior back to gallery.
 */
function exitToStreet() {
    AppState.mode = 'gallery';
    AppState.currentShopId = null;

    // Toggle views
    DOM.pannellumView().classList.add('hidden');
    DOM.photoGrid().style.display = 'grid';

    // Update UI
    updateModeBadge('gallery');
    hideInfoPanel();
    highlightSidebarItem(null);

    // Push history state
    history.pushState({ mode: 'gallery' }, '', window.location.pathname);
}

function updateModeBadge(mode) {
    const badge = DOM.modeBadge();
    if (mode === 'interior') {
        badge.textContent = '360° Interior';
        badge.className = 'badge badge-interior';
    } else {
        badge.textContent = 'Gallery';
        badge.className = 'badge badge-gallery';
    }
}

function highlightSidebarItem(shopId) {
    document.querySelectorAll('.shop-item').forEach(el => {
        el.classList.toggle('active', el.dataset.shopId === shopId);
    });
}

// --------------- History (back-button support) ---------------
window.addEventListener('popstate', (e) => {
    if (e.state && e.state.mode === 'interior' && e.state.shopId) {
        enterShop(e.state.shopId);
    } else {
        if (AppState.mode === 'interior') {
            exitToStreet();
        }
    }
});

// --------------- Billing / Usage Tracking (uncomment when needed) ---------------
/*
const UsageTracker = {
    streetViewLoads: 0,

    trackStreetViewLoad() {
        this.streetViewLoads++;
        console.log(`[UsageTracker] Street View loads this session: ${this.streetViewLoads}`);

        // Optionally send to analytics endpoint:
        // fetch('/api/usage', {
        //     method: 'POST',
        //     body: JSON.stringify({ event: 'streetview_load', count: this.streetViewLoads }),
        //     headers: { 'Content-Type': 'application/json' }
        // });
    },

    getReport() {
        return {
            streetViewLoads: this.streetViewLoads,
            // Google Dynamic Street View SKU: $7 per 1000 loads
            // Free tier: $200/month credit ≈ 28,571 loads
            estimatedCost: `$${(this.streetViewLoads * 0.007).toFixed(2)}`
        };
    }
};
*/

// --------------- Init ---------------
async function initApp() {
    console.log('initApp started');
    
    // Load shop data
    const data = await loadShops();
    console.log('Shop data loaded:', data);
    
    if (!data) {
        alert('Unable to load shop data. Please try again later.');
        return;
    }

    console.log('Rendering photo grid with', AppState.shops.length, 'shops');
    
    // Render photo grid
    renderPhotoGrid(AppState.shops);

    // Render marketplace listings
    renderMarketplace();

    // Initialize feature interest survey
    initSurvey();

    // Populate sidebar
    populateSidebar(AppState.shops);

    // Wire up UI events
    DOM.sidebarToggle().addEventListener('click', toggleSidebar);
    DOM.btnBackToStreet().addEventListener('click', exitToStreet);
    DOM.panelClose().addEventListener('click', hideInfoPanel);

    // Check for deep-link on load (e.g., ?shop=capitol-theatre)
    const params = new URLSearchParams(window.location.search);
    const shopParam = params.get('shop');
    if (shopParam && AppState.shops.find(s => s.id === shopParam)) {
        setTimeout(() => enterShop(shopParam), 500);
    }

    hideLoading();
    console.log('initApp completed');
}

// Initialize on page load
console.log('app.js loaded');
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOMContentLoaded fired');
    initApp();
});

// ── Marketplace ──
async function renderMarketplace() {
    const grid = document.getElementById('marketplace-grid');
    const section = document.getElementById('marketplace-section');
    if (!grid || !section) return;

    try {
        const listings = await SupabaseClient.fetchListings(null, 8);
        if (!listings || listings.length === 0) {
            section.style.display = 'none';
            return;
        }
        grid.innerHTML = listings.map(listing => `
            <div class="marketplace-card">
                <div class="marketplace-img" style="background-color: ${stringToColor(listing.title)};">
                    ${listing.image_url
                        ? `<img src="${listing.image_url}" alt="${listing.title}" loading="lazy">`
                        : `<span class="marketplace-placeholder">${listing.title.charAt(0)}</span>`
                    }
                </div>
                <div class="marketplace-info">
                    <h4>${listing.title}</h4>
                    <span class="marketplace-price">${listing.price ? '$' + listing.price.toFixed(0) : 'Free'}</span>
                    <p class="marketplace-desc">${listing.description || ''}</p>
                    <span class="marketplace-seller">Posted by ${listing.seller_name || 'Neighbor'}</span>
                </div>
            </div>
        `).join('');
    } catch (e) {
        console.warn('Marketplace unavailable:', e);
        section.style.display = 'none';
    }
}

function stringToColor(str) {
    const colors = ['#e8d5c4', '#c4d8e8', '#d5e8c4', '#e8c4d5', '#e8e4c4', '#c4e8e0'];
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
}

// ── Feature Interest Survey ──
const SURVEY_ID = 'user-listings-dropoff-v1';
const SURVEY_STORAGE_KEY = 'survey_voted_' + SURVEY_ID;

function initSurvey() {
    const section = document.getElementById('survey-section');
    const dismissBtn = document.getElementById('survey-dismiss');
    const buttons = document.getElementById('survey-buttons');
    const commentArea = document.getElementById('survey-comment-area');
    const commentInput = document.getElementById('survey-comment');
    const submitComment = document.getElementById('survey-submit-comment');
    const resultsEl = document.getElementById('survey-results');
    const thanksEl = document.getElementById('survey-thanks');

    if (!section) return;

    // Check if already voted or dismissed
    const stored = localStorage.getItem(SURVEY_STORAGE_KEY);
    if (stored === 'dismissed' || stored === 'voted') {
        section.classList.add('hidden');
        return;
    }

    // Show the survey
    section.classList.remove('hidden');

    // Dismiss
    dismissBtn.addEventListener('click', () => {
        localStorage.setItem(SURVEY_STORAGE_KEY, 'dismissed');
        section.classList.add('hidden');
    });

    let selectedVote = null;

    // Vote buttons
    buttons.querySelectorAll('.survey-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            selectedVote = btn.dataset.vote;
            // Highlight selected
            buttons.querySelectorAll('.survey-btn').forEach(b => b.style.opacity = '0.5');
            btn.style.opacity = '1';
            btn.style.border = '2px solid var(--color-primary)';
            // Show comment input
            commentArea.classList.remove('hidden');
            commentInput.focus();
        });
    });

    // Submit (with optional comment)
    async function submitVote() {
        if (!selectedVote) return;

        const comment = commentInput.value.trim();
        submitComment.disabled = true;
        submitComment.textContent = '…';

        await SupabaseClient.submitSurveyVote({
            surveyId: SURVEY_ID,
            vote: selectedVote,
            comment: comment || null
        });

        localStorage.setItem(SURVEY_STORAGE_KEY, 'voted');

        // Hide form, show results
        buttons.style.display = 'none';
        commentArea.classList.add('hidden');

        // Fetch and show results
        const results = await SupabaseClient.fetchSurveyResults(SURVEY_ID);
        if (results.total > 0) {
            resultsEl.innerHTML = ['yes', 'maybe', 'no'].map(key => {
                const pct = Math.round((results[key] / results.total) * 100);
                const label = key === 'yes' ? '👍 Yes' : key === 'maybe' ? '🤔 Maybe' : '👎 No';
                return `
                    <div class="survey-result-bar">
                        <span class="survey-result-label">${label}</span>
                        <div class="survey-result-track">
                            <div class="survey-result-fill survey-result-fill-${key}" style="width: ${pct}%"></div>
                        </div>
                        <span class="survey-result-count">${results[key]}</span>
                    </div>
                `;
            }).join('');
            resultsEl.classList.remove('hidden');
        }

        thanksEl.classList.remove('hidden');
    }

    submitComment.addEventListener('click', submitVote);
    commentInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            submitVote();
        }
    });
}
