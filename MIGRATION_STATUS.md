# Database Migration Status

## Issue
The Google Maps integration refactor added a new database column `event_map_url` to the tournaments table, but the database migration (`npm run db:push`) was not successfully applied due to npm dependency installation issues (bcrypt rebuild).

## Solution Implementation
To ensure the app works even while awaiting a manual `db:push`, the following resilience measures have been implemented:

### 1. Helper Function (`server/storage.ts`)
```typescript
function ensureEventMapUrl(tournament: any): Tournament {
  if (!tournament) return undefined;
  return {
    ...tournament,
    eventMapUrl: tournament.eventMapUrl ?? null,
  };
}
```

### 2. Error Handling in Key Methods
The following methods in `DatabaseStorage` now have try-catch blocks that handle the case where the `event_map_url` column doesn't exist:

- `getTournamentByCode(roomCode: string)`
- `getTournament(id: number)`
- `getAllTournaments()`
- `updateTournamentEventDetails(id, data)`

When a column-not-found error is detected, these methods:
1. Catch the error mentioning `event_map_url` or "does not exist"
2. Fall back to a raw SQL query that selects all existing columns EXCEPT `event_map_url`
3. Normalize raw SQL snake_case fields back to the app's camelCase shape (`roomCode`, `isActive`, `createdAt`, etc.)
4. Ensure `eventMapUrl` is set to `null` in the returned object

### 3. Startup Database Repair
`server/db.ts` now adds `event_map_url` during app startup, both for fresh table creation and for existing databases missing that column. After a server restart, the DB should self-heal without requiring `drizzle-kit`.

### 3. Code Changes Made
- **File: `shared/schema.ts`**
  - Added `eventMapUrl: text("event_map_url")` field to tournaments table (line 78)

- **File: `server/storage.ts`**
  - Added `normalizeTournamentRecord` helper function
  - Enhanced `getTournamentByCode`, `getTournament`, and `getAllTournaments` with error handling
  - Fixed `getAllTournaments()` to `await` the DB query so missing-column errors are actually caught
  - Normalized fallback rows so TD Dashboard receives correct `roomCode`, `isActive`, `createdAt`, etc.
  - Added fallback handling for `updateTournamentEventDetails()` so saves still work before restart

- **File: `server/db.ts`**
  - Added `event_map_url` to the startup `CREATE TABLE` definition
  - Added startup `ALTER TABLE` guard to create `event_map_url` automatically on existing DBs

- **File: `server/routes.ts**
  - Added `eventMapUrl` to updateEventDetailsSchema validation
  - Added `mapUrl: tournament.eventMapUrl || null` to public event response (line 844)
  - Added `eventMapUrl: null` to new tournament defaults (line 1238)
  - Added `eventMapUrl: eventMapUrl?.trim() ? eventMapUrl.trim() : null` to update handler (line 1486)

- **File: `client/src/features/events/types/event.ts`**
  - Added `mapUrl: string | null` field to PublicTournamentEvent interface

- **File: `client/src/components/GoogleMapsEmbed.tsx`** (completely rewritten)
  - Removed API key dependency
  - Added `toEmbedUrl()` function to convert Google Maps share URLs to embed URLs
  - Component now accepts `mapUrl` prop instead of fetching API key

- **File: `client/src/features/events/components/TournamentDetailsSections.tsx`**
  - Updated VenueSection to render map only when `event.mapUrl` exists via GoogleMapsEmbed component

- **File: `client/src/components/TournamentManagementTab.tsx`**
  - Added Google Maps Link input field for TDs to paste map URLs

## Pending Actions

### Optional Follow-up: Apply Database Migration
When npm dependencies are properly installed, you can still run:
```bash
npm run db:push
```

This will align Drizzle's migration state with the live database, but the app no longer depends on it for tournament visibility.

### Testing After Migration
Once the migration is applied:
1. Stop the app if running
2. Restart the app
3. Test uploading a Google Maps URL in tournament venue settings
4. Verify the map renders correctly on the public event page

## Current App Status
✅ TD Dashboard tournament lists should render again
✅ App startup now auto-adds `event_map_url` on restart
✅ Tournament data loads with `eventMapUrl` defaulting to `null` if column is still temporarily missing
✅ Event detail saves can succeed even before restart
✅ All edited files are TypeScript-safe according to in-editor checks
⏳ Manual `db:push` is still optional cleanup once the dependency environment is fixed

## Notes
- The fallback mechanism uses raw SQL queries that explicitly select all tournaments table columns except the new one
- This approach is temporary and should be removed once the migration is confirmed applied
- Event map display gracefully handles null `mapUrl` values (GoogleMapsEmbed component shows alert if no URL provided)
- TD can still input and save Google Maps URLs even before migration - they'll be stored in memory and persisted after migration runs

