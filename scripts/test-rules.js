// Runs each Firestore rules test file against its own fresh emulator instance.
//
// Each tests/firestore-rules/*.rules.test.js file (and the legacy
// tests/firestore.rules.emulator.js) was written to run alone against a
// freshly-started emulator — every file's own header comment documents this
// exact invocation. Running several of them together inside one shared
// `firebase emulators:exec` session (all hitting one live emulator process
// concurrently, or even sequentially within its lifetime) causes
// `initializeTestEnvironment()`/`withSecurityRulesDisabled()` calls from
// different files to intermittently fail against that shared instance.
// Spawning a fresh `firebase emulators:exec` per file avoids all of that by
// construction, at the cost of paying emulator startup time per file.

const { execFileSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

// Gap between consecutive emulator invocations, letting the previous
// Firestore emulator process fully release its port before the next one
// binds it — observed intermittent "testEnv undefined" failures in CI when
// invocations ran back-to-back with no gap.
const INTER_FILE_DELAY_MS = 3000;

const rulesDir = path.resolve(__dirname, '../tests/firestore-rules');
const files = [
    // TEMP DIAGNOSTIC: event-history moved first to isolate position-vs-content.
    path.resolve(rulesDir, 'event-history.rules.test.js'),
    path.resolve(__dirname, '../tests/firestore.rules.emulator.js'),
    ...fs.readdirSync(rulesDir)
        .filter((name) => name.endsWith('.rules.test.js') && name !== 'event-history.rules.test.js')
        .sort()
        .map((name) => path.join(rulesDir, name)),
];

function sleep(ms) {
    execFileSync(process.execPath, ['-e', `setTimeout(() => {}, ${ms})`]);
}

files.forEach((file, index) => {
    if (index > 0) {
        sleep(INTER_FILE_DELAY_MS);
    }
    const relativePath = path.relative(process.cwd(), file);
    console.log(`\n=== ${relativePath} ===`);
    try {
        execFileSync(
            'firebase',
            ['emulators:exec', '--only', 'firestore', `node --test ${relativePath}`],
            { stdio: 'inherit' }
        );
    } catch (error) {
        console.error(`\nFirestore rules tests failed: ${relativePath}`);
        process.exit(error.status || 1);
    }
});

console.log('\nAll Firestore rules test files passed.');
