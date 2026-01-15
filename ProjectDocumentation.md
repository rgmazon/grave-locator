**Project Overview**

- **Name:** Grave Tracker (Grave Locator)
- **Purpose:** A map-first web application for users to submit and search graves, with an admin review workflow for submissions and edits.
- **Stack:** React (Vite) frontend; Supabase backend (Postgres + PostGIS + Auth); Mapbox GL JS for maps; Tailwind CSS for styling.

**Quick Links**

- **Main App:** [src/App.jsx](src/App.jsx)
- **Map Page:** [src/MapPage.jsx](src/MapPage.jsx)
- **Map Component:** [src/components/GraveMap.jsx](src/components/GraveMap.jsx)
- **Search:** [src/components/SearchBar.jsx](src/components/SearchBar.jsx)
- **Submission Form:** [src/assets/GraveSubmission.jsx](src/assets/GraveSubmission.jsx)
- **Admin Dashboard:** [src/components/AdminDashboard.jsx](src/components/AdminDashboard.jsx)
- **User Dashboard:** [src/components/UserDashboard.jsx](src/components/UserDashboard.jsx)
- **Supabase client helper:** [src/supabaseClient.js](src/supabaseClient.js)

**Goals & User Flows**

- Users can view a map of approved graves and search by deceased name.
- Signed-in users can pin a location and submit grave details; submissions are stored with `status = 'pending'` for admin review.
- Users may propose edits to existing graves, which create records in a `graves_edits` table for admin approval.
- Admins can approve or reject submissions and edits; approval patches the `graves` record and marks the edit as `approved`.

**Setup & Environment**

- **Requirements:** Node.js, npm, a Supabase project (Postgres + PostGIS), Mapbox access token.
- **Install:**

  ```bash
  npm install
  npm run dev
  ```

- **Important env vars (.env / Vite):**

  - `VITE_SUPABASE_URL` — your Supabase URL (e.g. https://xyz.supabase.co)
  - `VITE_SUPABASE_ANON_KEY` — anon/public key for REST calls
  - `VITE_MAPBOX_TOKEN` — Mapbox access token

- **Tailwind:** Setup is included via `index.css` which imports Tailwind. See `vite.config.js` and `package.json` for build scripts.

**Project Structure (high level)**

- `src/` — application source
  - `App.jsx` — top-level app, view routing, auth handling
  - `MapPage.jsx` — page that renders the map, search, and submission UI
  - `components/` — re-usable UI pieces (AdminDashboard, GraveMap, SearchBar, UserDashboard, etc.)
  - `assets/GraveSubmission.jsx` — submission form component
  - `supabaseClient.js` — local supabase client (note: recent work uses direct REST `fetch` for reliability)
  - `index.css` — Tailwind import plus custom Mapbox popup styles

**Database Schema (essential tables)**

- `profiles` (uuid id)

  - stores user profile data (full_name, is_admin boolean, etc.)
  - RLS notes: policies previously blocked some queries; development has temporarily relaxed RLS. Add proper policies before production.

- `graves` (bigint id)

  - columns: `id (bigint)`, `deceased_name`, `birth_date`, `death_date`, `image_url`, `location (PostGIS point)`, `status` (`pending`|`approved`|`rejected`), `submitted_by` (uuid), `created_at`, etc.
  - PostGIS: `location` uses `POINT(lng lat)` format. Some code uses RPC `get_grave_location` to return `ST_AsText(location)`.

- `graves_edits` (bigserial id)
  - columns: `id (bigserial)`, `grave_id (bigint)`, `proposed_changes (jsonb)`, `status` (`pending`|`approved`|`rejected`), `submitted_by`, `reviewed_by`, `reviewed_at`, `created_at`.
  - Edits are applied by admin: approved edits patch the `graves` row then update the edits row to `approved`.

**SQL Utilities & Functions**

- `get_graves_by_status(text)` — returns graves with `status` and text location field (used by `MapPage` RPC attempt).
- `get_grave_location(bigint)` — returns `ST_AsText(location)` for a grave id.
- The repo includes SQL files (e.g. `sql/create-graves-edits-table.sql`, `sql/create-location-function.sql`). Keep types aligned (grave id = bigint).

**API / Data Access Patterns**

- Historically the Supabase JS client timed out/hung for some queries in this environment. Workarounds adopted:
  - Use direct REST endpoints: `fetch(`${VITE_SUPABASE_URL}/rest/v1/<table>?<filters>`, { headers: { apikey, Authorization } })` for reliable responses.
  - Include `Prefer: return=minimal` for PATCH/UPDATE where return payload isn't required.
- Auth: Some profile loading and admin checks use the user's `id` (from auth) to fetch `profiles?id=eq.<uuid>` via REST.
- RPC (stored procedures) are used when available — code falls back to direct selects when RPC isn't present.

**Frontend Behavior Notes**

- Map: Mapbox GL JS (via `react-map-gl`) renders markers from `approvedGraves`. Markers show a popup on click; popup content is rendered by `MapPage.jsx`.
- Search: `SearchBar.jsx` filters `approvedGraves` client-side by `deceased_name` and calls `onSelectGrave(grave)` to zoom and open popup.
- Submission: `GraveSubmission.jsx` collects details and inserts into `graves` with `status='pending'`. Coordinates are inserted as a POINT string.
- Admin: `AdminDashboard.jsx` fetches pending graves/edits via REST and provides Approve/Reject actions which PATCH the `graves` or `graves_edits` rows.

**Styling & UX**

- Tailwind CSS is used; `index.css` imports Tailwind and includes small custom rules (e.g., Mapbox popup close-button sizing).
- UI was migrated from emoji-heavy to a clean, professional look with neutral gray palette and SVG icons.
- Responsive: `MapPage` now collapses Search and Add Location into compact controls on mobile; panels are sized with `max-w-[calc(100vw-6rem)]` or `w-80` for larger screens.

**Development Workflow**

- Start dev server: `npm install` then `npm run dev`.
- Common issues:
  - Dev server failing: stop any running Node processes and retry (some earlier logs show esbuild failure when duplicated runs existed).
  - Supabase client hanging: use REST fallback for problematic queries.
  - RLS errors: if you see row-level security errors, run appropriate policies or temporarily disable RLS for development.

**Troubleshooting**

- If the admin panel isn't visible even though `profiles.is_admin` is true:
  - Ensure the app can fetch the profile via REST and that RLS/policies allow the query.
  - Check console logs in `App.jsx` for `Profile state changed:` and confirm `is_admin: true`.
- If edits appear not to disappear after approve:
  - `fetchEdits()` was updated to filter `status=eq.pending`. If you still see approved edits, reload and check the `graves_edits` table directly.
- If map pins are missing:
  - Confirm RPC `get_graves_by_status` exists. `MapPage.jsx` falls back to a direct query and calls `get_grave_location` RPC per grave to fetch location text.

**Security & Production Notes**

- RLS (Row Level Security): currently relaxed for debugging. Before production, add strict policies:
  - Allow users to insert `graves` (with `status='pending'`) while restricting direct updates to `approved` records to admin only.
  - Allow `profiles` SELECT only for the authenticated user or admin as appropriate.
- Keys: Never commit `service_role` keys to the repo. Use secure environment variables for CI/CD.
- Validate input server-side (e.g., ensure submitted `location` is valid geometry) — client-side validation is helpful but insufficient.

**Testing**

- Manual tests used during development:
  - Sign in as the admin user and verify admin panel visibility and approve/reject flows.
  - Submit a new grave and confirm it appears as `pending` in the DB and not on the public map until approved.
  - Test search results on both desktop and mobile viewports.

**Files To Review / Important Code Areas**

- `src/App.jsx` — auth handling and view routing.
- `src/MapPage.jsx` — core mapping logic, fetches graves and renders popups.
- `src/components/AdminDashboard.jsx` — admin controls and approve/reject logic (uses REST `fetch` for reliability).
- `src/components/SearchBar.jsx` — search UX and filtering logic.
- `src/assets/GraveSubmission.jsx` — submission form and insert logic.
- `src/index.css` — includes Tailwind import and custom popup styles.

**Next Steps & Recommendations**

- Add automated tests (unit tests for helper utilities, integration tests for REST calls) and a staging environment on Supabase.
- Harden RLS policies in the database and re-test all flows with policies enabled.
- Consider moving from anon key REST usage toward a small backend (serverless function) that proxies requests and applies server-side checks if you need stricter control than anon key + RLS.
- Add analytics/error tracking (e.g., Sentry) to capture runtime errors in production.

**Contact & Context**

- Current working environment: Windows, Vite dev server (localhost:5173), Mapbox token and Supabase project configured via Vite env.
- If you want, I can also generate a short CONTRIBUTING.md and a checklist to prepare the project for production deployment.

---

Generated on: 2026-01-15
