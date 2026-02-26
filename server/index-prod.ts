import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { type Server } from "node:http";

import express, { type Express } from "express";
import runApp from "./app";
import { initializeDatabase } from "./db";

export async function serveStatic(app: Express, _server: Server) {
  // Get directory of this file (works after esbuild bundling)
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  
  // Try multiple possible paths for the built public folder
  const possiblePaths = [
    path.resolve(__dirname, "public"),           // dist/public (relative to dist/index.js)
    path.resolve(process.cwd(), "dist/public"),  // from project root
  ];
  
  let distPath = possiblePaths.find(p => fs.existsSync(p));
  
  if (!distPath) {
    console.error("Tried paths:", possiblePaths);
    throw new Error(
      `Could not find the build directory. Tried: ${possiblePaths.join(", ")}`,
    );
  }
  
  console.log(`Serving static files from: ${distPath}`);

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath!, "index.html"));
  });
}

(async () => {
  // Initialize database tables before starting the app
  await initializeDatabase();
  await runApp(serveStatic);
})();
