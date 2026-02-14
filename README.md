# 🏘️ Shop Local Arlington — Simplified Gallery Version

Explore **Massachusetts Avenue** in Arlington Center, MA. Browse local shops in a photo gallery and step inside with immersive 360° interior views.

🔗 **Live site:** [https://ivanaz916.github.io/shop_local/](https://ivanaz916.github.io/shop_local/)

---

## ✨ What's New - Simplified Version

This version **removes the Google Maps Street View dependency** for a simpler, API-free experience:

- ✅ **No API key required** - works completely offline
- ✅ **Photo gallery view** - browse shops with beautiful cards
- ✅ **360° panorama tours** - still includes immersive interior views
- ✅ **Faster loading** - no external API calls
- ✅ **Zero cost** - no usage limits or billing concerns

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Gallery view | HTML/CSS Grid | Browse shops with photos and descriptions |
| Indoor 360° views | [Pannellum](https://pannellum.org/) (free, MIT) | Immersive shop interiors |
| Shop data | `data/shops.json` | Names, descriptions, hours, panorama files |
| Hosting | GitHub Pages | Free static site hosting |

---

## Quick Start (Local Development)

1. **Clone the repo:**
   ```bash
   git clone https://github.com/Ivanaz916/shop_local.git
   cd shop_local
   ```

2. **Serve locally** (you need a local server):
   ```bash
   # Python 3
   python -m http.server 8000

   # Or use VS Code Live Server extension
   ```

3. **Open** `http://localhost:8000` in your browser.

4. **Optional: Generate placeholder images**
   - Open `http://localhost:8000/placeholder-generator.html`
   - Click "Generate Placeholder Images"
   - Move the downloaded images to the correct folders (see instructions)

---

## Adding a New Shop

### Step 1 — Capture 360° Photos (Phone Only)

Since Google's standalone Street View photosphere app has been retired, use one of these free alternatives:

| App | Platform | Notes |
|-----|----------|-------|
| **Google Maps** (built-in photosphere) | Android | Open Google Maps → Contribute → tap camera → "Photo Sphere" |
| **Panorama 360 Camera** | iOS / Android | Free app, exports equirectangular JPEGs |
| **Google Street View APK** (sideload) | Android | Old version still works for photosphere capture |

**Tips for great interior shots:**
- Stand in the center of the room
- Hold phone at chest height
- Follow the on-screen guide dots slowly and steadily
- Avoid moving objects (people walking, fans spinning)
- Take multiple shots — pick the best stitch
- **Minimum resolution:** 3840 × 1920 px (2:1 aspect ratio)

### Step 2 — Add the Image

1. Create a folder: `images/panos/{shop-id}/`
2. Place the equirectangular JPEG inside it, named `entrance.jpg`
   ```
   images/panos/my-new-shop/entrance.jpg
   ```

### Step 3 — Register in `shops.json`

Add an entry to the `shops` array in `data/shops.json`:

```json
{
  "id": "my-new-shop",
  "name": "My New Shop",
  "category": "Retail",
  "lat": 42.4155,
  "lng": -71.1560,
  "description": "A wonderful local shop on Mass Ave.",
  "hours": "Mon–Sat 10am–6pm",
  "website": "https://mynewshop.com",
  "panoFile": "my-new-shop/entrance.jpg",
  "scenes": {
    "entrance": {
      "title": "My New Shop — Entrance",
      "hfov": 110,
      "pitch": 0,
      "yaw": 0
    }
  }
}
```

### Step 4 — (Optional) Multi-Room Tours

For shops with multiple rooms, add extra scenes and link them with hot spots:

```json
"scenes": {
  "entrance": {
    "title": "Entrance",
    "hfov": 110,
    "pitch": 0,
    "yaw": 0,
    "hotSpots": [
      {
        "pitch": -5,
        "yaw": 45,
        "type": "scene",
        "text": "Go to Back Room",
        "sceneId": "back-room"
      }
    ]
  },
  "back-room": {
    "title": "Back Room",
    "hfov": 100,
    "pitch": 0,
    "yaw": 180,
    "hotSpots": [
      {
        "pitch": -5,
        "yaw": 0,
        "type": "scene",
        "text": "Return to Entrance",
        "sceneId": "entrance"
      }
    ]
  }
}
```

Place the panorama images as:
```
images/panos/my-new-shop/entrance.jpg
images/panos/my-new-shop/back-room.jpg
```

### Step 5 — (Optional) Tiling Large Panoramas

For panoramas wider than 8192 px, use Pannellum's tiling script for faster loading:

```bash
# Install dependencies
pip install Pillow numpy

# Generate tiles (requires Hugin's 'nona' tool on PATH)
python pannellum/utils/multires/generate.py images/panos/my-shop/entrance.jpg \
    -o images/panos/my-shop/tiles \
    -s 512 -q 85
```

Then update the scene config to use `type: "multires"` — see [Pannellum docs](https://pannellum.org/documentation/overview/).

---

## Deploying to GitHub Pages

1. Commit and push to `main`:
   ```bash
   git add .
   git commit -m "Add new shop: My New Shop"
   git push origin main
   ```

2. In the GitHub repo → **Settings → Pages → Source:** select `main` branch, `/ (root)` folder → Save.

3. Site will be live at `https://ivanaz916.github.io/shop_local/` within a few minutes.

---

## Project Structure

```
shop_local/
├── index.html                  ← Main page (gallery + 360° viewer)
├── placeholder-generator.html  ← Tool to create test panoramas
├── SETUP.md                    ← Detailed setup instructions
├── css/
│   └── styles.css              ← All styles
├── js/
│   ├── app.js                  ← Controller, state, gallery view
│   └── interior.js             ← Pannellum 360° viewer module
├── data/
│   └── shops.json              ← Participating shop directory
├── images/
│   └── panos/                  ← 360° interior photos (equirectangular JPEGs)
│       ├── capitol-theatre/
│       │   └── entrance.jpg
│       ├── arlington-cafe/
│       │   └── entrance.jpg
│       └── ...
└── README.md
```

---

## Migrating from Google Maps Version

If you previously had the Google Maps Street View version, this simplified version:
- Removes all Google Maps API dependencies
- Replaces the street view with a photo gallery
- Keeps all the 360° panorama functionality
- No longer requires an API key or billing setup

---

## License

MIT — built with ❤️ for the Arlington, MA community.
