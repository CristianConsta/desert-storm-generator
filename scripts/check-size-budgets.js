#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

function resolveMax(envName, fallback) {
  const raw = process.env[envName];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function countLines(content) {
  if (!content) return 0;
  return content.split(/\r?\n/).length;
}

const budgets = [
  {
    file: 'app.js',
    maxLines: resolveMax('APP_JS_MAX_LINES', 6000),
  },
  {
    file: 'firebase-module.js',
    maxLines: resolveMax('FIREBASE_MODULE_MAX_LINES', 7500),
  },
];

let hasFailure = false;

for (const budget of budgets) {
  const targetPath = path.resolve(process.cwd(), budget.file);
  if (!fs.existsSync(targetPath)) {
    console.error(`[budget] Missing file: ${budget.file}`);
    hasFailure = true;
    continue;
  }

  const content = fs.readFileSync(targetPath, 'utf8');
  const lines = countLines(content);
  const status = lines <= budget.maxLines ? 'ok' : 'over';
  console.log(`[budget] ${budget.file}: ${lines}/${budget.maxLines} (${status})`);

  if (lines > budget.maxLines) {
    hasFailure = true;
  }
}

if (hasFailure) {
  console.error('[budget] File size budget check failed.');
  process.exit(1);
}

console.log('[budget] File size budget check passed.');
