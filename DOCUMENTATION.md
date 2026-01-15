Grave Locator System Documentation

1. Project Overview
   A web-based geospatial application designed to help families locate the graves of their loved ones. Users can pin locations on a satellite map, which are then reviewed and approved by an administrator before becoming visible to the public.

2. Tech Stack
   Frontend: React (Vite)

Styling: Tailwind CSS

Database & Auth: Supabase (PostgreSQL)

Geospatial Engine: PostGIS (PostgreSQL extension)

Map Provider: Mapbox GL JS (Satellite view)

3. Database Schema (Supabase/PostgreSQL)

   **profiles Table**

   Stores user information and roles. Linked to Supabase Auth.

   | Column     | Type        | Description                          |
   | :--------- | :---------- | :----------------------------------- |
   | id         | uuid        | Primary Key (links to auth.users.id) |
   | full_name  | text        | User's display name                  |
   | is_admin   | boolean     | Toggle for admin dashboard access    |
   | updated_at | timestamptz | Last update timestamp                |

   **graves Table**

   Stores the geospatial coordinates and deceased details.

   | Column        | Type        | Description                           |
   | :------------ | :---------- | :------------------------------------ |
   | id            | int8        | Primary Key (Auto-increment)          |
   | deceased_name | text        | Name of the person buried             |
   | birth_date    | date        | Birth date of the deceased (optional) |
   | death_date    | date        | Death date of the deceased (optional) |
   | location      | geography   | PostGIS POINT (Longitude, Latitude)   |
   | status        | text        | Enum: pending, approved, rejected     |
   | submitted_by  | uuid        | Foreign Key to auth.users.id          |
   | image_url     | text        | URL to grave photo (optional)         |
   | created_at    | timestamptz | Entry creation timestamp              |

   Note: The schema also supports additional optional fields like `burial_plot`, `epitaph`, and `notes` for comprehensive grave information.

4. Key Features
   A. User Map & Submission
   Interactive Map: Users view a high-resolution satellite map of the cemetery.

Location Pinning: Clicking the map captures precise GPS coordinates.

Submission Form: A comprehensive Tailwind-styled sidebar form that collects detailed grave information:

- Deceased Name (required)
- Birth Date (optional)
- Death Date (optional)
- Burial Plot/Section (optional) - e.g., "Block A, Lot 12"
- Epitaph (optional) - inscription on the gravestone
- Additional Notes (optional) - any other relevant information
- GPS Coordinates display (automatically captured from map click)

Authentication: Users must be signed in to submit grave locations. The form prompts unauthenticated users to sign in.

PostGIS Integration: Coordinates are saved as a GEOGRAPHY type to ensure global accuracy.

B. Admin Dashboard
Approval Queue: A private view for administrators listing all pending submissions.

One-Click Actions: Admins can "Approve" (making the pin public) or "Reject" (removing it from the queue).

Real-time Updates: Using React state, the list updates instantly upon action without page reloads.

C. Public Viewing
Filtered Fetching: The public map only queries and displays pins where status = 'approved'.

Visual Markers: Approved graves are marked with persistent pins that users can click to see details.

5. Security & Rules (RLS)
   The system uses Row Level Security (RLS) to protect data:

Select Policy: Everyone can read rows where status = 'approved'.

Insert Policy: Authenticated users can insert rows, but the status defaults to pending.

Update Policy: Only users with is_admin = true can change the status column.

6. Setup Instructions
   Environment: Set up a Vite project and install tailwindcss, @supabase/supabase-js, and react-map-gl.

Database: Enable the postgis extension in Supabase and run the provided SQL migration scripts.

API Keys: Configure .env with VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, and VITE_MAPBOX_ACCESS_TOKEN.

Deployment: The system is ready to be hosted on platforms like Vercel or Netlify.
