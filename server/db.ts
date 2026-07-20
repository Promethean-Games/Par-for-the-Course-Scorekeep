import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });

// Auto-create tables on startup if they don't exist
export async function initializeDatabase() {
  console.log("Checking database tables...");
  
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS universal_players (
        id SERIAL PRIMARY KEY,
        unique_code TEXT UNIQUE,
        name TEXT NOT NULL,
        email TEXT,
        contact_info TEXT,
        pin TEXT,
        handicap REAL,
        is_provisional BOOLEAN NOT NULL DEFAULT true,
        completed_tournaments INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      );
      
      -- Add pin column if it doesn't exist (for existing tables)
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'universal_players' AND column_name = 'pin') THEN
          ALTER TABLE universal_players ADD COLUMN pin TEXT;
        END IF;
      END $$;

      CREATE TABLE IF NOT EXISTS tournaments (
        id SERIAL PRIMARY KEY,
        room_code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        event_venue TEXT,
        event_start_at TIMESTAMP,
        event_details_url TEXT,
        event_registration_url TEXT,
        event_hero_image_url TEXT,
        event_max_players INTEGER NOT NULL DEFAULT 24,
        event_director_name TEXT,
        event_director_email TEXT,
        event_director_phone TEXT,
        event_rules_text TEXT,
        event_rules_url TEXT,
        event_youtube_url TEXT,
        event_gallery_images JSONB,
        event_entry_fee REAL,
        event_entry_fee_details TEXT,
        is_active BOOLEAN NOT NULL DEFAULT true,
        is_started BOOLEAN NOT NULL DEFAULT false,
        is_handicapped BOOLEAN NOT NULL DEFAULT false,
        director_pin TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS player_tournament_history (
        id SERIAL PRIMARY KEY,
        universal_player_id INTEGER NOT NULL REFERENCES universal_players(id),
        tournament_id INTEGER NOT NULL REFERENCES tournaments(id),
        tournament_name TEXT NOT NULL,
        total_strokes INTEGER NOT NULL,
        total_par INTEGER NOT NULL,
        holes_played INTEGER NOT NULL,
        relative_to_par INTEGER NOT NULL,
        completed_at TIMESTAMP DEFAULT NOW() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS tournament_players (
        id SERIAL PRIMARY KEY,
        tournament_id INTEGER NOT NULL REFERENCES tournaments(id),
        player_name TEXT NOT NULL,
        device_id TEXT,
        group_name TEXT,
        universal_id TEXT,
        universal_player_id INTEGER REFERENCES universal_players(id),
        contact_info TEXT,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS tournament_scores (
        id SERIAL PRIMARY KEY,
        tournament_player_id INTEGER NOT NULL REFERENCES tournament_players(id),
        hole INTEGER NOT NULL,
        par INTEGER NOT NULL,
        strokes INTEGER NOT NULL,
        scratches INTEGER NOT NULL DEFAULT 0,
        penalties INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS tournament_sponsors (
        id SERIAL PRIMARY KEY,
        tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
        sponsor_name TEXT NOT NULL,
        donation_type TEXT,
        blurb TEXT,
        logo_url TEXT,
        is_active BOOLEAN NOT NULL DEFAULT true,
        display_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS tournament_registrations (
        id SERIAL PRIMARY KEY,
        tournament_id INTEGER NOT NULL REFERENCES tournaments(id),
        stripe_session_id TEXT UNIQUE,
        stripe_payment_intent_id TEXT,
        customer_email TEXT,
        amount_total INTEGER,
        currency TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS director_content_defaults (
        director_pin TEXT PRIMARY KEY,
        rules_text TEXT,
        faq_items JSONB NOT NULL DEFAULT '[]'::jsonb,
        faq_items_customized BOOLEAN NOT NULL DEFAULT false,
        director_name TEXT,
        director_email TEXT,
        director_phone TEXT,
        hero_image_url TEXT,
        youtube_url TEXT,
        gallery_images JSONB NOT NULL DEFAULT '[]'::jsonb,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS tournament_payouts (
        id SERIAL PRIMARY KEY,
        tournament_id INTEGER NOT NULL UNIQUE REFERENCES tournaments(id),
        num_players INTEGER NOT NULL,
        entry_fee REAL NOT NULL,
        green_fee REAL NOT NULL DEFAULT 0,
        added_prize REAL NOT NULL DEFAULT 0,
        num_spots INTEGER NOT NULL,
        percentages JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id SERIAL PRIMARY KEY,
        endpoint TEXT NOT NULL UNIQUE,
        p256dh TEXT NOT NULL,
        auth TEXT NOT NULL,
        device_id TEXT,
        tournament_room_code TEXT,
        universal_player_id INTEGER REFERENCES universal_players(id),
        is_director BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      );

      DO $$
      BEGIN
        -- tournaments columns
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tournaments' AND column_name = 'sponsor_pages_enabled') THEN
          ALTER TABLE tournaments ADD COLUMN sponsor_pages_enabled BOOLEAN NOT NULL DEFAULT false;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tournaments' AND column_name = 'event_venue') THEN
          ALTER TABLE tournaments ADD COLUMN event_venue TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tournaments' AND column_name = 'event_start_at') THEN
          ALTER TABLE tournaments ADD COLUMN event_start_at TIMESTAMP;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tournaments' AND column_name = 'event_details_url') THEN
          ALTER TABLE tournaments ADD COLUMN event_details_url TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tournaments' AND column_name = 'event_registration_url') THEN
          ALTER TABLE tournaments ADD COLUMN event_registration_url TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tournaments' AND column_name = 'event_hero_image_url') THEN
          ALTER TABLE tournaments ADD COLUMN event_hero_image_url TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tournaments' AND column_name = 'event_max_players') THEN
          ALTER TABLE tournaments ADD COLUMN event_max_players INTEGER NOT NULL DEFAULT 24;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tournaments' AND column_name = 'event_director_name') THEN
          ALTER TABLE tournaments ADD COLUMN event_director_name TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tournaments' AND column_name = 'event_director_email') THEN
          ALTER TABLE tournaments ADD COLUMN event_director_email TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tournaments' AND column_name = 'event_director_phone') THEN
          ALTER TABLE tournaments ADD COLUMN event_director_phone TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tournaments' AND column_name = 'event_rules_text') THEN
          ALTER TABLE tournaments ADD COLUMN event_rules_text TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tournaments' AND column_name = 'event_rules_url') THEN
          ALTER TABLE tournaments ADD COLUMN event_rules_url TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tournaments' AND column_name = 'event_youtube_url') THEN
          ALTER TABLE tournaments ADD COLUMN event_youtube_url TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tournaments' AND column_name = 'event_gallery_images') THEN
          ALTER TABLE tournaments ADD COLUMN event_gallery_images JSONB;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tournaments' AND column_name = 'event_entry_fee') THEN
          ALTER TABLE tournaments ADD COLUMN event_entry_fee REAL;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tournaments' AND column_name = 'event_entry_fee_details') THEN
          ALTER TABLE tournaments ADD COLUMN event_entry_fee_details TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tournaments' AND column_name = 'started_at') THEN
          ALTER TABLE tournaments ADD COLUMN started_at TIMESTAMP;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tournaments' AND column_name = 'completed_at') THEN
          ALTER TABLE tournaments ADD COLUMN completed_at TIMESTAMP;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tournaments' AND column_name = 'group_starting_holes') THEN
          ALTER TABLE tournaments ADD COLUMN group_starting_holes JSONB;
        END IF;
        -- director_content_defaults columns
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'director_content_defaults' AND column_name = 'faq_items_customized') THEN
          ALTER TABLE director_content_defaults ADD COLUMN faq_items_customized BOOLEAN NOT NULL DEFAULT false;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'director_content_defaults' AND column_name = 'director_name') THEN
          ALTER TABLE director_content_defaults ADD COLUMN director_name TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'director_content_defaults' AND column_name = 'director_email') THEN
          ALTER TABLE director_content_defaults ADD COLUMN director_email TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'director_content_defaults' AND column_name = 'director_phone') THEN
          ALTER TABLE director_content_defaults ADD COLUMN director_phone TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'director_content_defaults' AND column_name = 'hero_image_url') THEN
          ALTER TABLE director_content_defaults ADD COLUMN hero_image_url TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'director_content_defaults' AND column_name = 'youtube_url') THEN
          ALTER TABLE director_content_defaults ADD COLUMN youtube_url TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'director_content_defaults' AND column_name = 'gallery_images') THEN
          ALTER TABLE director_content_defaults ADD COLUMN gallery_images JSONB NOT NULL DEFAULT '[]'::jsonb;
        END IF;
        -- tournament_players columns
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tournament_players' AND column_name = 'is_dnf') THEN
          ALTER TABLE tournament_players ADD COLUMN is_dnf BOOLEAN NOT NULL DEFAULT false;
        END IF;
        -- player_tournament_history columns
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'player_tournament_history' AND column_name = 'course_name') THEN
          ALTER TABLE player_tournament_history ADD COLUMN course_name TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'player_tournament_history' AND column_name = 'total_scratches') THEN
          ALTER TABLE player_tournament_history ADD COLUMN total_scratches INTEGER DEFAULT 0;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'player_tournament_history' AND column_name = 'total_penalties') THEN
          ALTER TABLE player_tournament_history ADD COLUMN total_penalties INTEGER DEFAULT 0;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'player_tournament_history' AND column_name = 'is_manual_entry') THEN
          ALTER TABLE player_tournament_history ADD COLUMN is_manual_entry BOOLEAN DEFAULT false;
        END IF;
        -- universal_players columns
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'universal_players' AND column_name = 'phone_number') THEN
          ALTER TABLE universal_players ADD COLUMN phone_number TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'universal_players' AND column_name = 't_shirt_size') THEN
          ALTER TABLE universal_players ADD COLUMN t_shirt_size TEXT;
        END IF;
        -- Make player_tournament_history.tournament_id nullable for manual entries
        ALTER TABLE player_tournament_history ALTER COLUMN tournament_id DROP NOT NULL;
      END $$;
    `);
    
    console.log("Database tables ready!");
    
    // Migrate existing players without unique codes
    await migrateUniqueCodes();
  } catch (error) {
    console.error("Failed to initialize database tables:", error);
    throw error;
  }
}

// Migration: Populate unique codes for existing players that don't have them
async function migrateUniqueCodes() {
  try {
    const result = await pool.query(`
      SELECT id FROM universal_players WHERE unique_code IS NULL ORDER BY id
    `);
    
    if (result.rows.length === 0) {
      return; // No migration needed
    }
    
    console.log(`Migrating ${result.rows.length} players without unique codes...`);
    
    // Get the highest existing unique code number
    const maxResult = await pool.query(`
      SELECT MAX(CAST(SUBSTRING(unique_code FROM 3) AS INTEGER)) as max_num 
      FROM universal_players 
      WHERE unique_code IS NOT NULL AND unique_code ~ '^PC[0-9]+$'
    `);
    
    let nextNum = (maxResult.rows[0]?.max_num || 7000) + 1;
    
    for (const row of result.rows) {
      const uniqueCode = `PC${nextNum}`;
      await pool.query(
        `UPDATE universal_players SET unique_code = $1 WHERE id = $2`,
        [uniqueCode, row.id]
      );
      console.log(`  Assigned ${uniqueCode} to player ${row.id}`);
      nextNum++;
    }
    
    console.log("Unique code migration complete!");
  } catch (error) {
    console.error("Error migrating unique codes:", error);
  }
}
