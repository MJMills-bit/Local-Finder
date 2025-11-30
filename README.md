# 📍 Local Finder – Mobile-First POI Discovery App

Local Finder is a mobile-optimised Next.js application that helps users quickly discover nearby points of interest (POIs) such as restaurants, pharmacies, clinics, coworking spaces, and stores.  
It uses **OpenStreetMap’s Overpass API** for live POI data and includes intelligent search, category filtering, map interactions, and geolocation.

This branch (`mobile-layout`) contains the new **mobile-first UI**, redesigned layout, and updated API behaviours.

---

## 🚀 Getting Started

### 1. Install dependencies

```bash
npm install
2. Run the development server
bash
Copy code
npm run dev
# or:
yarn dev
pnpm dev
bun dev
3. Open the app
Visit:

http://localhost:3000

File editing is hot-reloaded automatically.
Start by exploring:

bash
Copy code
app/page.tsx
🔧 Project Architecture
Framework
Next.js App Router (app/ directory)

Serverless API Routes (src/app/api/overpass, src/app/api/geocode)

Client-side state store: Zustand (useStore)

Map + Data
Leaflet for rendering maps

Overpass API for POIs

Dynamic Overpass queries for category + search

Nominatim (optional) for centering via geocode

Radius-based filtering

Mobile-first UX

UI Components
TopSearch – search bar

MapClient – controls data loading + map synchronisation

MapView – Leaflet map wrapper

CategoryAside – results list & category filtering

RadiusControl – change map search radius

PinPopup – POI info popup

Mobile drawer components

🧩 Project Notes
This project uses:

next/font for font optimisation

Geist (official Vercel font family)

TailwindCSS for styling

Dynamic imports for map performance

Intelligent caching for Overpass

Custom Overpass query builder for improved POI accuracy

🌍 API Overview
Overpass Endpoint
/api/overpass

Used for:

Category queries

Text search (name, brand, operator)

Returning POIs with lat/lng + tags

Runs with:

Fallback mirror support

Timeouts

Radius clamping

Server-side filtering

Result normalisation

Geocode Endpoint
/api/geocode

Used ONLY for:

Improving centering after a search

Not for listing POIs

📚 Useful Resources
Next.js documentation
https://nextjs.org/docs

Next.js interactive tutorial
https://nextjs.org/learn

Next.js GitHub
https://github.com/vercel/next.js

🚀 Deployment (Vercel)
The recommended way to deploy Local Finder is via Vercel:

Deployment Guide:
https://nextjs.org/docs/app/building-your-application/deploying

Once deployed:

Environment variables can be added easily

Serverless routes auto-scale

Map APIs load efficiently

Overpass requests run server-side

🛠️ Development Checklist (Next Steps)
These are the remaining improvements planned for the mobile-layout branch:

Core Fixes
Improve POI matching for stores like Clicks (expand tag patterns)

Improve fallback radius for difficult search terms

Add brand-specific text search (shop=chemist, healthcare=pharmacy, brand=*Clicks*)

Fix “Unnamed place” by combining extra tags (alt_name, operator, brand:wikidata, etc.)

UI/UX Improvements
Better mobile drawer for results

Sticky category filter bar

Show “No results in radius” with suggested radius increase

Add ability to tap a map pin to scroll to its item in the list

API Enhancements
Add optional “include raw tags” toggle

Remove unnecessary Overpass tag limits

Add more precise search weighting

Cleanup Tasks
Remove unused components (SearchBox, MobileResultsSheet)

Remove old commented logic

Remove unused imports in all files

Simplify globals.css and remove dead classes

Future Features
Save favourite locations

Recently-searched terms

Shareable location URLs

Offline fallback view

Progressive Web App (PWA) support

🤝 Contributing
Pull requests, suggestions, and improvements are welcome.
Please open an issue before making large structural changes.

yaml

