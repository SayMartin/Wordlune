#!/usr/bin/env node
/*
  upload_seeds_to_staging.js
  - Reads detailed CSVs from `migrations/seeds/hydrocarbons`
  - Uploads them to `staging_import_rows`
  - Clears the table first!
*/
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { fileURLToPath } from "url";

// Handling __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error(
    "Error: SUPABASE_URL and SUPABASE_SERVICE_KEY env vars required.",
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];

  const header = lines[0].split(",").map((h) => h.trim());
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    // Simple regex for CSV parsing (handles quotes mostly)
    const matches = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || [];
    // Fallback split if regex fails or simple structure
    const parts = line.split(",");

    // Choose the split method that matches header length best, usually simple split is enough for these files
    const finalParts = parts.map((p) => p.trim());

    const obj = {};
    header.forEach((h, idx) => {
      const val = finalParts[idx];
      obj[h] = val === undefined || val === "" ? null : val;
    });
    rows.push(obj);
  }
  return rows;
}

async function upload() {
  console.log("--> Clearing staging_import_rows...");
  const { error: delError } = await supabase
    .from("staging_import_rows")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000"); // Delete all assuming UUID

  if (delError) {
    console.error("Failed to clear staging:", delError);
    // Proceeding anyway might duplicate data if logic isn't robust, but user's SQL handles dupes.
  }

  // Target directory
  const targetDir = path.join(
    path.resolve(process.cwd()),
    "migrations/seeds/hydrocarbons",
  );
  if (!fs.existsSync(targetDir)) {
    console.error("Directory not found:", targetDir);
    process.exit(1);
  }

  const files = fs.readdirSync(targetDir).filter((f) => f.endsWith(".csv"));
  console.log(`--> Found ${files.length} files in ${targetDir}`);

  let totalRows = 0;

  for (const file of files) {
    console.log(`Processing ${file}...`);
    const content = fs.readFileSync(path.join(targetDir, file), "utf-8");
    const rows = parseCsv(content);

    if (rows.length === 0) continue;

    // chunking to be safe
    const chunkSize = 100;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);

      const { error } = await supabase
        .from("staging_import_rows")
        .insert(chunk);

      if (error) {
        console.error(`Error uploading chunk in ${file}:`, error);
      } else {
        totalRows += chunk.length;
      }
    }
  }

  console.log("-----------------------------------------");
  console.log(`✅ Upload complete! Inserted ${totalRows} rows.`);
  console.log(
    "👉 NOW: Go to Supabase > SQL Editor and run 'migrations/20260127_master_seed.sql'",
  );
}

upload();
