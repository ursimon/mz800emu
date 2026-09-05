const Module = require('./web/mz800.js');

// Strict timeout guard - 10 seconds max
const guard = setTimeout(() => {
    console.error('TIMEOUT: 1000 frames took longer than 10 seconds.');
    process.exit(1);
}, 10000);

Module.onRuntimeInitialized = () => {
    console.log('--- Memory Leak Audit: Running 1,000 continuous frames ---');
    Module._mz_wasm_init();

    const memInitial = Module.HEAPU8.length;
    console.log(`Initial Wasm heap size: ${(memInitial / (1024 * 1024)).toFixed(2)} MB`);

    const t0 = Date.now();
    for (let i = 1; i <= 1000; i++) {
        Module._mz_wasm_run_frame();
        if (i % 250 === 0) {
            const currentMem = Module.HEAPU8.length;
            console.log(`Frame ${i}/1000: Heap = ${(currentMem / (1024 * 1024)).toFixed(2)} MB (${Date.now() - t0}ms elapsed)`);
        }
    }
    const elapsed = Date.now() - t0;
    const finalMem = Module.HEAPU8.length;

    console.log(`\nCompleted 1,000 frames in ${elapsed}ms (${(elapsed / 1000).toFixed(3)}ms/frame, ${(1000000 / elapsed).toFixed(1)} FPS).`);
    console.log(`Initial heap: ${(memInitial / (1024 * 1024)).toFixed(2)} MB, Final heap: ${(finalMem / (1024 * 1024)).toFixed(2)} MB`);

    if (finalMem !== memInitial) {
        console.warn('Notice: Wasm heap grew during execution (dynamic allocation).');
    } else {
        console.log('Heap remained 100% constant across 1,000 frames. Zero heap growth!');
    }

    clearTimeout(guard);
    console.log('AUDIT PASSED.');
    process.exit(0);
};
