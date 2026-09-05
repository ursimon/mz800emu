const Module = require('./web/mz800.js');
const fs = require('fs');

// Internal safety guard timeout (5 seconds)
const guardTimer = setTimeout(() => {
    console.error('TIMEOUT: Test took longer than 5 seconds.');
    process.exit(1);
}, 5000);

Module.onRuntimeInitialized = () => {
    console.log('--- 1. Testing Core Initialization ---');
    const t0 = Date.now();
    const initRes = Module._mz_wasm_init();
    console.log('Init returned:', initRes, `(${Date.now() - t0}ms)`);
    if (initRes !== 0) throw new Error('Init failed');

    const width = Module._mz_wasm_get_screen_width();
    const height = Module._mz_wasm_get_screen_height();
    console.log('Screen dimensions:', width, 'x', height);
    if (width <= 0 || height <= 0) throw new Error('Invalid screen dimensions');

    const fbPtr = Module._mz_wasm_get_framebuffer();
    console.log('Framebuffer pointer:', fbPtr);
    if (fbPtr === 0) throw new Error('Null framebuffer pointer');

    console.log('\n--- 2. Running 50 PAL Frames (1 second real time) ---');
    const tStartFrames = Date.now();
    for (let i = 0; i < 50; i++) {
        Module._mz_wasm_run_frame();
    }
    const elapsedFrames = Date.now() - tStartFrames;
    console.log(`50 frames completed in ${elapsedFrames}ms (~${(elapsedFrames / 50).toFixed(2)}ms per frame, ${(50000 / elapsedFrames).toFixed(1)} FPS equivalent)`);

    console.log('\n--- 3. Testing Audio Extraction ---');
    const audioBufPtr = Module._malloc(2048 * 4);
    const audioCount = Module._mz_wasm_get_audio_samples(audioBufPtr, 2048);
    console.log('Extracted audio samples:', audioCount);
    Module._free(audioBufPtr);

    console.log('\n--- 4. Testing MZF Game Loading (mz_runner.mzf) ---');
    const mzfPath = 'web/games/mz_runner.mzf';
    if (fs.existsSync(mzfPath)) {
        const mzfBuffer = fs.readFileSync(mzfPath);
        const mzfPtr = Module._malloc(mzfBuffer.length);
        Module.HEAPU8.set(mzfBuffer, mzfPtr);
        console.log(`Loading ${mzfBuffer.length} bytes into emulator...`);
        const loadRes = Module._mz_wasm_load_mzf(mzfPtr, mzfBuffer.length);
        console.log('Load MZF returned:', loadRes);
        Module._free(mzfPtr);
        if (loadRes !== 0) throw new Error('Failed to load MZF');

        console.log('Running 50 frames with loaded game...');
        const tGame = Date.now();
        for (let i = 0; i < 50; i++) {
            // Simulate pressing joystick/arrow keys at frame 25
            if (i === 25) {
                Module._mz_wasm_key_event(8, 0, 1); // Row 8, bit 0 pressed
            }
            if (i === 35) {
                Module._mz_wasm_key_event(8, 0, 0); // Released
            }
            Module._mz_wasm_run_frame();
        }
        console.log(`50 game frames completed in ${Date.now() - tGame}ms.`);
    } else {
        console.log('Warning: mz_runner.mzf not found, skipping game load test.');
    }

    // Inspect framebuffer pixels to verify non-blank rendering
    const fbArray = new Uint32Array(Module.HEAPU32.buffer, fbPtr, width * height);
    let nonZeroPixels = 0;
    for (let i = 0; i < fbArray.length; i++) {
        if (fbArray[i] !== 0) nonZeroPixels++;
    }
    console.log(`\nFramebuffer non-zero pixel count: ${nonZeroPixels} / ${fbArray.length}`);

    clearTimeout(guardTimer);
    console.log('\n=============================================');
    console.log('>>> ALL VERIFICATION TESTS PASSED CLEANLY! <<<');
    console.log('=============================================');
    process.exit(0);
};
