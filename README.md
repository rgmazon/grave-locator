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
- Row Level Security (RLS) is enforced at the database level, including on `profiles.is_admin` (only an existing admin can grant admin, never the user themselves) and on `graves_edits`. See `sql/fix-profiles-privilege-escalation.sql`, `sql/fix-graves-rpc-bypass.sql`, and `sql/fix-graves-edits-rls.sql` — run these (after the base `supabase-rls-policies.sql`) in the Supabase SQL Editor before going to production.
- `graves.image_url` is restricted to `http(s)://` at the DB level (`sql/fix-image-url-scheme.sql`) to prevent a `javascript:` URI submission from executing in an admin's session when reviewing a submission. The frontend also validates this client-side, but the DB constraint is what actually enforces it.
- Grave submissions are rate-limited to 5 per user per rolling hour via a DB trigger (`sql/fix-graves-rate-limit.sql`), in addition to a client-side submit cooldown.
- A scheduled GitHub Action (`.github/workflows/keep-supabase-awake.yml`) pings the Supabase REST API every 3 days so the free-tier project doesn't auto-pause from inactivity. Requires `SUPABASE_URL` and `SUPABASE_ANON_KEY` repo secrets (same values as the `.env` vars).
- Do not commit service role keys. Use env vars and secure secrets in CI/CD.
- Basic SEO/AEO: `index.html` has meta description, canonical URL, Open Graph/Twitter cards, and JSON-LD `WebSite` schema; `public/robots.txt`, `public/sitemap.xml`, and `public/llms.txt` are also included. All of these hardcode `https://grave-locator.pages.dev/` — update that domain in `index.html`, `public/robots.txt`, and `public/sitemap.xml` if the deployment URL changes. Note this app is a client-rendered SPA with no per-page routes, so this only covers the site shell — individual grave records aren't independently indexable without adding routing + SSR/prerendering.

## License & contribution

This repository is a personal project. Feel free to open issues or PRs for improvements.
