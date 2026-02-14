/* ================================================================
   interior.js — Pannellum interior 360° viewer module
   Handles shop interior panoramas with hot-spot navigation.
   ================================================================ */

const InteriorModule = (() => {
    let viewer = null;
    let currentShopId = null;

    // Set to true during development to log (pitch, yaw) on click
    // for easy hot-spot placement. Disable in production!
    const HOT_SPOT_DEBUG = true;

    /**
     * Load a shop's interior panorama into the Pannellum viewer.
     * Creates the viewer on first call; reloads scenes on subsequent calls.
     *
     * @param {Object} shop — shop object from shops.json
     * @param {Function} onReady — callback when panorama finishes loading
     */
    function loadShop(shop, onReady) {
        currentShopId = shop.id;

        // Build scene config from shop data
        const scenes = buildScenes(shop);
        const firstSceneId = Object.keys(scenes)[0];

        if (viewer) {
            // Viewer already exists — destroy and recreate with new scenes
            viewer.destroy();
            viewer = null;
        }

        viewer = pannellum.viewer('pannellum-view', {
            default: {
                firstScene: firstSceneId,
                sceneFadeDuration: 800,
                autoLoad: true,
                compass: true,
                hotSpotDebug: HOT_SPOT_DEBUG
            },
            scenes: scenes
        });

        // Fire callback when loaded
        viewer.on('load', () => {
            if (onReady) onReady();
        });

        // Also fire callback after a timeout in case the load event
        // doesn't fire (e.g., missing image falls back)
        setTimeout(() => {
            if (onReady) onReady();
        }, 3000);
    }

    /**
     * Build Pannellum scene config objects from a shop's data.
     * Injects a "Back to Street" hot spot in every scene.
     */
    function buildScenes(shop) {
        const scenes = {};

        for (const [sceneId, sceneData] of Object.entries(shop.scenes)) {
            scenes[sceneId] = {
                title: sceneData.title || shop.name,
                type: 'equirectangular',
                panorama: `images/panos/${shop.panoFile || shop.id + '/' + sceneId + '.jpg'}`,
                hfov: sceneData.hfov || 110,
                pitch: sceneData.pitch || 0,
                yaw: sceneData.yaw || 0,
                hotSpots: [
                    // "Back to Gallery" hot spot — always present
                    {
                        id: 'back-to-gallery',
                        pitch: -15,
                        yaw: 180,
                        type: 'info',
                        text: '← Back to Gallery',
                        cssClass: 'back-to-street-hotspot',
                        clickHandlerFunc: handleBackToStreet,
                        clickHandlerArgs: {}
                    },
                    // Add any scene-specific hot spots from data
                    ...(sceneData.hotSpots || [])
                ]
            };
        }

        return scenes;
    }

    /**
     * Handle the "Back to Street" hot spot click.
     */
    function handleBackToStreet(event) {
        if (event && event.preventDefault) event.preventDefault();
        exitToStreet();   // global function from app.js
    }

    /**
     * Clean up the Pannellum viewer (free WebGL context, DOM).
     */
    function destroy() {
        if (viewer) {
            viewer.destroy();
            viewer = null;
            currentShopId = null;
        }
    }

    /**
     * Trigger a resize (call after un-hiding the container).
     */
    function resize() {
        if (viewer) {
            viewer.resize();
        }
    }

    /**
     * Get the current viewer instance (for advanced use).
     */
    function getViewer() {
        return viewer;
    }

    return { loadShop, destroy, resize, getViewer };
})();
