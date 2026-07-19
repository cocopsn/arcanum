#!/usr/bin/env node
// LOC counter for the ARCANUM repo. Zero dependencies (Node built-ins only). Counts lines of every
// TRACKED text file (via `git ls-files`, so node_modules/.next/build artifacts are excluded by .gitignore
// automatically) and buckets each into: code · tests · docs · content · config. Prints a table sorted by
// size (by category, and by top-level directory), plus the grand total. `--json` emits the full breakdown.
//
// Usage:  node scripts/loc.mjs          # human table
//         node scripts/loc.mjs --json   # machine-readable
//         npm run loc

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

// only these extensions are counted as text (binaries — images, fonts, audio — are skipped and tallied)
const TEXT_EXT = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json", ".md", ".css", ".html", ".yml", ".yaml", ".toml", ".txt", ".sh"]);

/** bucket a repo-relative path into one of the reporting categories */
function categorize(rel) {
  const p = rel.replace(/\\/g, "/");
  const ext = path.extname(p).toLowerCase();
  if (p.startsWith("content/")) return "content"; // learning content: mini-books + exercise banks (.md)
  if (/\.test\.(ts|tsx|js|mjs)$/.test(p)) return "tests";
  if (ext === ".md") return "docs"; // documentation (root + docs/); content .md handled above
  if (p.startsWith("src/") || p.startsWith("supabase/functions/") || p.startsWith("scripts/")) {
    return ext === ".css" ? "code" : "code"; // app source, edge functions, tooling, styles
  }
  if ([".json", ".mjs", ".cjs", ".js", ".yml", ".yaml", ".toml"].includes(ext) || /(^|\/)\.[a-z]+rc(\.|$)/.test(p)) return "config";
  if (ext === ".css") return "code";
  return "other";
}

function topDir(rel) {
  const p = rel.replace(/\\/g, "/");
  const i = p.indexOf("/");
  return i === -1 ? "(root)" : p.slice(0, i);
}

function countLines(abs) {
  try {
    const buf = fs.readFileSync(abs);
    if (buf.length === 0) return 0;
    let n = 0;
    for (let i = 0; i < buf.length; i++) if (buf[i] === 0x0a) n++;
    if (buf[buf.length - 1] !== 0x0a) n++; // last line has no trailing newline
    return n;
  } catch {
    return 0;
  }
}

function listFiles() {
  try {
    const out = execSync("git ls-files", { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
    return out.split(/\r?\n/).filter(Boolean);
  } catch {
    console.error("(!) not a git repo or git unavailable — LOC needs `git ls-files`. Run inside the repo.");
    process.exit(1);
  }
}

const files = listFiles();
const byCategory = {};
const byDir = {};
let totalLoc = 0;
let totalFiles = 0;
let skippedBinary = 0;

for (const rel of files) {
  const ext = path.extname(rel).toLowerCase();
  if (!TEXT_EXT.has(ext)) {
    skippedBinary++;
    continue;
  }
  const loc = countLines(path.join(ROOT, rel));
  const cat = categorize(rel);
  const dir = topDir(rel);
  (byCategory[cat] ??= { files: 0, loc: 0 }).files++;
  byCategory[cat].loc += loc;
  (byDir[dir] ??= { files: 0, loc: 0 }).files++;
  byDir[dir].loc += loc;
  totalLoc += loc;
  totalFiles++;
}

const report = {
  total: { files: totalFiles, loc: totalLoc },
  byCategory,
  byDirectory: byDir,
  skippedBinaryFiles: skippedBinary,
};

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
}

const fmt = (n) => n.toLocaleString("en-US");
const pad = (s, w) => String(s).padEnd(w);
const padN = (s, w) => String(s).padStart(w);
const rows = (obj) =>
  Object.entries(obj)
    .sort((a, b) => b[1].loc - a[1].loc)
    .map(([k, v]) => `  ${pad(k, 14)} ${padN(fmt(v.loc), 10)} loc  ${padN(fmt(v.files), 6)} files  ${padN(((v.loc / totalLoc) * 100).toFixed(1) + "%", 7)}`);

console.log("\n  ARCANUM — lines of code (tracked text files; build artifacts excluded via .gitignore)\n");
console.log("  BY CATEGORY");
console.log(rows(byCategory).join("\n"));
console.log("\n  BY DIRECTORY");
console.log(rows(byDir).join("\n"));
console.log("\n  " + pad("TOTAL", 14) + padN(fmt(totalLoc), 10) + " loc  " + padN(fmt(totalFiles), 6) + " files");
console.log(`  (${skippedBinary} binary/asset files skipped)\n`);
