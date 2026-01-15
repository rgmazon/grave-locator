# Grave Tracker (Grave Locator)

## Short description

Grave Tracker is a map-first web app that lets users locate and submit graves, search for deceased individuals, and manage submissions via an admin review workflow. The app focuses on a clean, responsive UI and a lightweight backend built on Supabase.

## Key features

- Browse an interactive Mapbox map of approved graves
- Search graves by deceased name (client-side filter)
- Signed-in users can pin locations and submit grave details for admin review
- Users may propose edits to existing graves; edits go through an admin approval flow
- Admin dashboard to review, approve, or reject submissions and edits

## Tech stack

- Frontend: React + Vite
- Styling: Tailwind CSS
- Map: Mapbox GL JS (via react-map-gl)
- Backend: Supabase (Postgres + PostGIS + Auth)
- Deployment: Vite build (static site) + Supabase hosting / serverless functions (optional)

## Quick start

1. Install dependencies

```bash
npm install
```

2. Set environment variables (Vite `.env` or system env)

- `VITE_SUPABASE_URL` — your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` — public anon key for REST calls
- `VITE_MAPBOX_TOKEN` — Mapbox access token

3. Run the dev server

```bash
npm run dev
```

## Where to look in the code

- `src/App.jsx` — top-level app, routing and auth handling
- `src/MapPage.jsx` — map page, search and submission UI
- `src/components/SearchBar.jsx` — search component
- `src/assets/GraveSubmission.jsx` — submission form
- `src/components/AdminDashboard.jsx` — admin operations (approve/reject)
- `src/supabaseClient.js` — Supabase client helper
- `src/index.css` — Tailwind import + small custom styles (Mapbox popup fix)

## Notes & recommendations

- Some queries use direct Supabase REST fetch calls (instead of the JS client) to avoid timeout/hang issues observed in the environment.
- Row Level Security (RLS) policies need to be configured before production. During development RLS was relaxed for debugging.
- Do not commit service role keys. Use env vars and secure secrets in CI/CD.

## License & contribution

This repository is a personal project. Feel free to open issues or PRs for improvements.
