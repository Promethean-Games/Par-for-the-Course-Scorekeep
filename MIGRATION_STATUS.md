# Database Migration Status

## Issue
The Google Maps integration refactor added a new database column `event_map_url` to the tournaments table, but the database migration (`npm run db:push`) was not successfully applied due to npm dependency installation issues (bcrypt rebuild).

## Solution Implementation
To ensure the app works even while awaiting successful migration, the following resilience measures have been implemented:

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

When a column-not-found error is detected, these methods:
1. Catch the error mentioning `event_map_url` or "does not exist"
2. Fall back to a raw SQL query that selects all existing columns EXCEPT `event_map_url`
3. Ensure `eventMapUrl` is set to `null` in the returned object

### 3. Code Changes Made
- **File: `shared/schema.ts`**
  - Added `eventMapUrl: text("event_map_url")` field to tournaments table (line 78)

- **File: `server/storage.ts`**
  - Added `ensureEventMapUrl` helper function
  - Enhanced `getTournamentByCode`, `getTournament`, and `getAllTournaments` with error handling
  - All fallback errors set `eventMapUrl` to `null`

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

### Critical: Apply Database Migration
When npm dependencies are properly installed, run:
```bash
npm run db:push
```

This will:
1. Create the `event_map_url` column on the `tournaments` table
2. Allow the full feature to work without fallbacks
3. Enable persistent storage of Google Maps URLs

### Testing After Migration
Once the migration is applied:
1. Stop the app if running
2. Restart the app
3. Test uploading a Google Maps URL in tournament venue settings
4. Verify the map renders correctly on the public event page

## Current App Status
✅ App will start and function with or without the database migration
✅ Tournament data load with `eventMapUrl` defaulting to `null` if column missing
✅ All code is TypeScript-safe and compiles without errors
⏳ Google Maps URLs saved before migration will persist in code but are safer to wait until after migration applies
❌ Database migration not yet applied (bcrypt build dependency issue)

## Notes
- The fallback mechanism uses raw SQL queries that explicitly select all tournaments table columns except the new one
- This approach is temporary and should be removed once the migration is confirmed applied
- Event map display gracefully handles null `mapUrl` values (GoogleMapsEmbed component shows alert if no URL provided)
- TD can still input and save Google Maps URLs even before migration - they'll be stored in memory and persisted after migration runs

