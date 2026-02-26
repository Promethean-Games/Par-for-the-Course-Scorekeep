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
