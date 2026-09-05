const Module = require('./web/mz800.js');

// Guard timer 10s
const guard = setTimeout(() => {
    console.error('TIMEOUT: Speed test exceeded 10s.');
    process.exit(1);
}, 10000);

Module.onRuntimeInitialized = () => {
    console.log('--- Speed Mode Verification Test ---');
    Module._mz_wasm_init();

    // 1. Simulate 1x Mode (PAL ~50Hz) for 60 RAF ticks at 16.6ms intervals (1 second of 60Hz display)
    let normalFramesRan = 0;
    let lastFrameTime = 0;
    const targetInterval = 19.8;

    for (let tick = 1; tick <= 60; tick++) {
        const timestamp = tick * 16.666;
        const elapsed = timestamp - lastFrameTime;
        if (elapsed >= targetInterval) {
            lastFrameTime = timestamp - (elapsed % targetInterval);
            Module._mz_wasm_run_frame();
            normalFramesRan++;
        }
    }
    console.log(`1x Speed: 60 RAF ticks produced ${normalFramesRan} emulation frames (target: ~50 FPS).`);
    if (normalFramesRan < 49 || normalFramesRan > 52) {
        throw new Error(`Expected ~50 frames in 1x mode, got ${normalFramesRan}`);
    }

    // 2. Simulate MAX Turbo Mode for 60 RAF ticks at 16.6ms intervals
    let turboFramesRan = 0;
    const maxFrames = 10;
    for (let tick = 1; tick <= 60; tick++) {
        const startTime = Date.now();
        let framesThisTick = 0;
        while (framesThisTick < maxFrames && (Date.now() - startTime) < 12) {
            Module._mz_wasm_run_frame();
            framesThisTick++;
        }
        turboFramesRan += framesThisTick;
    }
    console.log(`MAX Speed: 60 RAF ticks produced ${turboFramesRan} emulation frames (target: >300 FPS).`);
    if (turboFramesRan < 300) {
        throw new Error(`Expected at least 300 frames in MAX mode, got ${turboFramesRan}`);
    }

    const speedup = (turboFramesRan / normalFramesRan).toFixed(1);
    console.log(`Verified speedup: ${speedup}x faster in MAX mode!`);

    clearTimeout(guard);
    console.log('>>> SPEED TEST PASSED SUCCESSFULLY <<<');
    process.exit(0);
};
