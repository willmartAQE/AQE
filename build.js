/**
 * AQE Light — Build Script
 *
 * Produces two artifacts from src/AQE-light.js:
 *   dist/AQE-light.cjs      CommonJS build  (require)
 *   dist/AQE-light.min.js   Minified ESM    (CDN / script tag)
 *
 * No external dependencies — runs with plain Node.js >= 16.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { performance } from 'perf_hooks';

const t0 = performance.now();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function log(label, file, srcSize, outSize) {
    const pct = ((1 - outSize / srcSize) * 100).toFixed(1);
    const kb  = (outSize / 1024).toFixed(2);
    console.log(`  ✓ ${file.padEnd(28)} ${String(outSize).padStart(6)} bytes  (${pct}% smaller, ${kb} kB)`);
}

function die(msg) {
    console.error(`\n  ✗ BUILD FAILED: ${msg}\n`);
    process.exit(1);
}

// ─── Read source ──────────────────────────────────────────────────────────────

let src;
try {
    src = readFileSync('src/AQE-light.js', 'utf8');
} catch {
    die('src/AQE-light.js not found. Run this script from the repo root.');
}

const srcSize = Buffer.byteLength(src, 'utf8');

// Extract version from banner comment or fall back to package.json
let version = '3.0.0';
try {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
    version = pkg.version ?? version;
} catch { /* non-fatal */ }

// ─── Ensure dist/ exists ──────────────────────────────────────────────────────

mkdirSync('dist', { recursive: true });

// ─── Build 1: CJS ─────────────────────────────────────────────────────────────

const cjsBanner = `\
/*!
 * AQE Light v${version} — Atomic Quantum Engine (Free Edition)
 * MIT License — https://github.com/willmartAQE/AQE
 * CommonJS build — for Node.js require() and bundlers
 */
'use strict';
`;

const cjsBody = src
    // Remove ESM export
    .replace(/\nexport\s+default\s+\w+;?\s*$/, '\n')
    // Remove existing UMD/CJS guard if present
    .replace(/\nif\s*\(typeof module[\s\S]*?$/m, '\n')
    .trimEnd();

const cjsFooter = `\n\nmodule.exports = AQELight;\n`;

const cjsOut = cjsBanner + cjsBody + cjsFooter;

// Quick sanity: class must be present
if (!cjsOut.includes('class AQELight')) die('CJS output is missing class AQELight');

writeFileSync('dist/AQE-light.cjs', cjsOut, 'utf8');
log('CJS', 'dist/AQE-light.cjs', srcSize, Buffer.byteLength(cjsOut, 'utf8'));

// ─── Build 2: Minified ESM ────────────────────────────────────────────────────

function minify(input) {
    let out = '';
    let i   = 0;
    const len = input.length;

    while (i < len) {
        // Block comment
        if (input[i] === '/' && input[i + 1] === '*') {
            i += 2;
            while (i < len && !(input[i] === '*' && input[i + 1] === '/')) i++;
            i += 2;
            continue;
        }
        // Line comment
        if (input[i] === '/' && input[i + 1] === '/') {
            while (i < len && input[i] !== '\n') i++;
            continue;
        }
        // Template literal — preserve verbatim
        if (input[i] === '`') {
            out += '`'; i++;
            while (i < len) {
                if (input[i] === '\\') { out += input[i++]; out += input[i++]; continue; }
                if (input[i] === '`')  { out += '`'; i++; break; }
                out += input[i++];
            }
            continue;
        }
        // String literals
        if (input[i] === '"' || input[i] === "'") {
            const q = input[i];
            out += q; i++;
            while (i < len) {
                if (input[i] === '\\') { out += input[i++]; out += input[i++]; continue; }
                if (input[i] === q)    { out += q; i++; break; }
                out += input[i++];
            }
            continue;
        }
        // Regex literals — detected by context
        if (input[i] === '/') {
            const prev = out.trimEnd().slice(-1);
            const isRegex = '=(!,;:[&|?{}'.includes(prev) ||
                /\b(return|typeof|instanceof|in|of|case|throw|new|delete|void)\s*$/.test(out);
            if (isRegex) {
                out += '/'; i++;
                while (i < len) {
                    if (input[i] === '\\') { out += input[i++]; out += input[i++]; continue; }
                    if (input[i] === '[') {
                        out += input[i++];
                        while (i < len && input[i] !== ']') out += input[i++];
                        out += input[i++];
                        continue;
                    }
                    if (input[i] === '/') { out += '/'; i++; break; }
                    out += input[i++];
                }
                // flags
                while (i < len && /[gimsuy]/.test(input[i])) out += input[i++];
                continue;
            }
        }
        // Whitespace — collapse and keep only where necessary
        if (/\s/.test(input[i])) {
            const prev = out.slice(-1);
            while (i < len && /\s/.test(input[i])) i++;
            const next = input[i] ?? '';
            const need = /[a-zA-Z0-9_$]/.test(prev) && /[a-zA-Z0-9_$`]/.test(next);
            if (need) out += ' ';
            continue;
        }
        out += input[i++];
    }
    return out.trim();
}

const minBanner =
    `/*! AQE Light v${version} | Atomic Quantum Engine (Free Edition) | MIT License | https://github.com/willmartAQE/AQE */\n`;

const minBody   = minify(src);
const minOut    = minBanner + minBody;

if (!minOut.includes('class AQELight')) die('Minified output is missing class AQELight');

writeFileSync('dist/AQE-light.min.js', minOut, 'utf8');
log('Minified ESM', 'dist/AQE-light.min.js', srcSize, Buffer.byteLength(minOut, 'utf8'));

// ─── Done ─────────────────────────────────────────────────────────────────────

const elapsed = (performance.now() - t0).toFixed(1);
console.log(`\n  Build complete in ${elapsed}ms\n`);
