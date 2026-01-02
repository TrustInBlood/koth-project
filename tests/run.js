#!/usr/bin/env node

/**
 * Test Runner
 * Runs all *.test.js files in the tests directory
 */

import { spawn } from 'child_process';
import { readdir } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function runTests() {
    const files = await readdir(__dirname);
    const testFiles = files.filter(f => f.endsWith('.test.js'));

    if (testFiles.length === 0) {
        console.log('No test files found.');
        process.exit(0);
    }

    console.log(`Found ${testFiles.length} test file(s)\n`);

    let allPassed = true;

    for (const file of testFiles) {
        const testPath = join(__dirname, file);

        const result = await new Promise((resolve) => {
            const child = spawn('node', [testPath], {
                stdio: 'inherit',
                env: process.env
            });

            child.on('close', (code) => {
                resolve(code === 0);
            });
        });

        if (!result) {
            allPassed = false;
        }
    }

    process.exit(allPassed ? 0 : 1);
}

runTests();
