/**
 * emulator.js — Sharp MZ-800 WebAssembly Runtime Coordinator
 *
 * Drives the single-threaded emulation loop, WebGL / 2D Canvas blitter,
 * Web Audio API streaming pipeline, and MZF binary loading.
 */

(function(window) {
    'use strict';

    class MZ800Emulator {
        constructor() {
            this.canvas = document.getElementById('mz-canvas');
            this.ctx = null;
            this.gl = null;
            this.glProgram = null;
            this.glTex = null;
            this.module = null;
            this.isRunning = false;
            this.isPaused = false;
            this.isMuted = false;
            this.maxSpeed = false;

            // Display buffer management
            this.screenWidth = 928;
            this.screenHeight = 288;
            this.imageData = null;
            this.quadBuffer = null;
            this.offscreenCanvas = null;
            this.offscreenCtx = null;
            this.resizeObserver = null;

            // Supported aspect modes:
            // 'crt-43': Full 928x288 frame displayed in 4:3 (authentic PAL CRT with borders)
            // 'zoom-43': 640x200 active area cropped to 4:3 (no borders, maximal game visibility)
            // 'square': 1:1 square pixels (3.22:1 ratio)
            // 'stretch': Ignore aspect ratio, fill the available space
            this.aspectModes = ['crt-43', 'zoom-43', 'square', 'stretch'];
            let savedMode = null;
            try {
                savedMode = localStorage.getItem('mz800_aspect_mode');
            } catch (e) {}
            this.aspectMode = this.aspectModes.includes(savedMode) ? savedMode : 'crt-43';

            // Audio pipeline
            this.audioCtx = null;
            this.audioBufferQueue = [];
            this.audioSampleRate = 44100;
            this.audioBufferSize = 2048;
            this.audioNode = null;
            this.wasmAudioBufferPtr = 0;
            this.wasmAudioBufferSize = 4096;

            // Performance tracking
            this.fpsCounter = document.getElementById('stat-fps');
            this.tapeStatus = document.getElementById('stat-tape');
            this.audioStatus = document.getElementById('stat-audio');
            this.frameCount = 0;
            this.lastFpsUpdate = performance.now();

            // Setup drag-and-drop
            this.setupFileDrop();
        }

        initRenderer() {
            try {
                this.gl = this.canvas.getContext('webgl', { alpha: false, depth: false, antialias: false });
            } catch (e) {
                this.gl = null;
            }

            if (this.gl) {
                const gl = this.gl;
                const vs = gl.createShader(gl.VERTEX_SHADER);
                gl.shaderSource(vs, `
                    attribute vec2 a_pos;
                    attribute vec2 a_tex;
                    varying vec2 v_tex;
                    void main() {
                        gl_Position = vec4(a_pos, 0.0, 1.0);
                        v_tex = a_tex;
                    }
                `);
                gl.compileShader(vs);

                const fs = gl.createShader(gl.FRAGMENT_SHADER);
                gl.shaderSource(fs, `
                    precision mediump float;
                    uniform sampler2D u_image;
                    varying vec2 v_tex;
                    void main() {
                        gl_FragColor = texture2D(u_image, v_tex);
                    }
                `);
                gl.compileShader(fs);

                this.glProgram = gl.createProgram();
                gl.attachShader(this.glProgram, vs);
                gl.attachShader(this.glProgram, fs);
                gl.linkProgram(this.glProgram);
                gl.useProgram(this.glProgram);

                this.quadBuffer = gl.createBuffer();
                gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
                gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
                    -1,  1,  0, 0,
                    -1, -1,  0, 1,
                     1,  1,  1, 0,
                     1, -1,  1, 1,
                ]), gl.DYNAMIC_DRAW);

                const aPos = gl.getAttribLocation(this.glProgram, 'a_pos');
                const aTex = gl.getAttribLocation(this.glProgram, 'a_tex');
                gl.enableVertexAttribArray(aPos);
                gl.enableVertexAttribArray(aTex);
                gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 16, 0);
                gl.vertexAttribPointer(aTex, 2, gl.FLOAT, false, 16, 8);

                this.glTex = gl.createTexture();
                gl.bindTexture(gl.TEXTURE_2D, this.glTex);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.screenWidth, this.screenHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

                gl.viewport(0, 0, this.screenWidth, this.screenHeight);
                this.updateQuadCoords(this.aspectMode === 'zoom-43');

                console.log('[MZ800] WebGL GPU hardware acceleration active.');
            } else {
                this.ctx = this.canvas.getContext('2d', { alpha: false });
                this.imageData = this.ctx.createImageData(this.screenWidth, this.screenHeight);
                console.log('[MZ800] Canvas 2D fallback blitter active.');
            }
        }

        updateQuadCoords(isZoomed) {
            if (!this.gl || !this.quadBuffer) return;
            const gl = this.gl;
            let u0 = 0, u1 = 1, v0 = 0, v1 = 1;
            if (isZoomed) {
                // Active area: X 154..794 (640px), Y 46..246 (200px)
                u0 = 154 / 928;
                u1 = 794 / 928;
                v0 = 46 / 288;
                v1 = 246 / 288;
            }
            const vertices = new Float32Array([
                -1,  1,  u0, v0,
                -1, -1,  u0, v1,
                 1,  1,  u1, v0,
                 1, -1,  u1, v1,
            ]);
            gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.DYNAMIC_DRAW);
        }

        updateDisplaySize() {
            const viewport = document.getElementById('screen-viewport');
            const container = document.querySelector('.crt-container');
            if (!viewport || !container) return;

            const availW = viewport.clientWidth - 12;
            const availH = viewport.clientHeight - 12;
            if (availW <= 0 || availH <= 0) return;

            let targetRatio = 4 / 3;
            if (this.aspectMode === 'square') {
                targetRatio = 928 / 288;
            } else if (this.aspectMode === 'stretch') {
                targetRatio = availW / availH;
            }

            let dispW, dispH;
            if (availW / availH > targetRatio) {
                dispH = availH;
                dispW = Math.round(dispH * targetRatio);
            } else {
                dispW = availW;
                dispH = Math.round(dispW / targetRatio);
            }

            container.style.width = `${dispW}px`;
            container.style.height = `${dispH}px`;
        }

        setupResponsiveDisplay() {
            const viewport = document.getElementById('screen-viewport');
            if (viewport && window.ResizeObserver) {
                this.resizeObserver = new ResizeObserver(() => {
                    this.updateDisplaySize();
                });
                this.resizeObserver.observe(viewport);
            }
            window.addEventListener('resize', () => this.updateDisplaySize());
            window.addEventListener('orientationchange', () => {
                setTimeout(() => this.updateDisplaySize(), 150);
            });
            this.updateDisplaySize();
        }

        setAspectMode(mode) {
            if (!this.aspectModes.includes(mode)) return;
            this.aspectMode = mode;
            try {
                localStorage.setItem('mz800_aspect_mode', mode);
            } catch (e) {}

            const isZoomed = (mode === 'zoom-43');
            this.updateQuadCoords(isZoomed);
            this.updateDisplaySize();

            const btnAspect = document.getElementById('btn-aspect');
            if (btnAspect) {
                if (mode === 'crt-43') {
                    btnAspect.textContent = '📺 4:3 CRT';
                    btnAspect.title = 'Aspect: 4:3 CRT Full (authentic with PAL borders). Click to switch.';
                } else if (mode === 'zoom-43') {
                    btnAspect.textContent = '🔍 4:3 Zoom';
                    btnAspect.title = 'Aspect: 4:3 Zoom (Active screen cropped, full 4:3). Click to switch.';
                } else if (mode === 'square') {
                    btnAspect.textContent = '⏹️ 1:1 Pixel';
                    btnAspect.title = 'Aspect: 1:1 Square Pixels. Click to switch.';
                } else if (mode === 'stretch') {
                    btnAspect.textContent = '↔️ Stretch';
                    btnAspect.title = 'Aspect: Stretch to Window. Click to switch.';
                }
            }
            console.log(`[MZ800] Aspect ratio switched to: ${mode}`);
        }

        toggleAspectMode() {
            const nextIdx = (this.aspectModes.indexOf(this.aspectMode) + 1) % this.aspectModes.length;
            this.setAspectMode(this.aspectModes[nextIdx]);
        }

        renderFrame(srcU8) {
            if (this.gl) {
                const gl = this.gl;
                gl.bindTexture(gl.TEXTURE_2D, this.glTex);
                gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, this.screenWidth, this.screenHeight, gl.RGBA, gl.UNSIGNED_BYTE, srcU8);
                gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
            } else if (this.ctx && this.imageData) {
                this.imageData.data.set(srcU8);
                if (this.aspectMode === 'zoom-43') {
                    if (!this.offscreenCanvas) {
                        this.offscreenCanvas = document.createElement('canvas');
                        this.offscreenCanvas.width = this.screenWidth;
                        this.offscreenCanvas.height = this.screenHeight;
                        this.offscreenCtx = this.offscreenCanvas.getContext('2d');
                    }
                    this.offscreenCtx.putImageData(this.imageData, 0, 0);
                    this.ctx.drawImage(this.offscreenCanvas, 154, 46, 640, 200, 0, 0, this.canvas.width, this.canvas.height);
                } else {
                    this.ctx.putImageData(this.imageData, 0, 0);
                }
            }
        }

        async init() {
            console.log('[MZ800] Initializing WebAssembly Module...');
            this.updateStatus('Loading Wasm...');

            if (typeof createMZ800Module !== 'function') {
                // If compiled without MODULARIZE=1, Module is already global
                if (typeof Module !== 'undefined') {
                    this.module = Module;
                } else {
                    console.error('[MZ800] Module is not defined. Ensure mz800.js is loaded.');
                    return;
                }
            } else {
                this.module = await createMZ800Module();
            }

            // Wait for WebAssembly asynchronous compilation if needed
            if (!this.module._mz_wasm_init) {
                await new Promise((resolve) => {
                    const prevInit = this.module.onRuntimeInitialized;
                    this.module.onRuntimeInitialized = () => {
                        if (typeof prevInit === 'function') prevInit();
                        resolve();
                    };
                });
            }

            // Initialize emulator core
            const res = this.module._mz_wasm_init();
            console.log('[MZ800] Core initialized with status:', res);

            this.screenWidth = this.module._mz_wasm_get_screen_width();
            this.screenHeight = this.module._mz_wasm_get_screen_height();
            console.log(`[MZ800] Native resolution: ${this.screenWidth}x${this.screenHeight}`);

            this.canvas.width = this.screenWidth;
            this.canvas.height = this.screenHeight;
            this.initRenderer();

            // Allocate audio buffer in Wasm heap
            this.wasmAudioBufferPtr = this.module._malloc(this.wasmAudioBufferSize * 4);

            // Setup responsive layout and apply aspect ratio mode
            this.setupResponsiveDisplay();
            this.setAspectMode(this.aspectMode);

            // Ready to run
            this.isRunning = true;
            this.updateStatus('Running (50Hz)');

            // Hook global API
            window.MZ800 = {
                sendKey: (col, bit, pressed) => this.sendKey(col, bit, pressed),
                loadMZF: (data) => this.loadMZF(data),
                reset: () => this.reset(),
                toggleSpeed: () => this.toggleSpeed(),
                toggleMute: () => this.toggleMute(),
                setAspectMode: (mode) => this.setAspectMode(mode),
                toggleAspectMode: () => this.toggleAspectMode()
            };

            // Start loop
            this.lastFrameTime = performance.now();
            requestAnimationFrame((ts) => this.loop(ts));
        }

        initAudio() {
            if (this.audioCtx) return;
            try {
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                this.audioCtx = new AudioContext({ sampleRate: this.audioSampleRate });
                
                // Using ScriptProcessorNode for wide browser compatibility without worklet CORS
                this.audioNode = this.audioCtx.createScriptProcessor(this.audioBufferSize, 0, 2);
                this.audioNode.onaudioprocess = (e) => this.processAudio(e);
                this.audioNode.connect(this.audioCtx.destination);

                if (this.audioStatus) this.audioStatus.classList.add('active');
                console.log('[MZ800] Web Audio API initialized at', this.audioCtx.sampleRate, 'Hz');
            } catch (err) {
                console.warn('[MZ800] Web Audio initialization error:', err);
            }
        }

        processAudio(audioProcessingEvent) {
            const outputL = audioProcessingEvent.outputBuffer.getChannelData(0);
            const outputR = audioProcessingEvent.outputBuffer.getChannelData(1);
            const bufferLen = outputL.length;

            if (this.isMuted || this.audioBufferQueue.length === 0) {
                outputL.fill(0);
                outputR.fill(0);
                return;
            }

            let outIdx = 0;
            while (outIdx < bufferLen && this.audioBufferQueue.length > 0) {
                const chunk = this.audioBufferQueue[0];
                const availablePairs = chunk.length / 2;
                const neededPairs = bufferLen - outIdx;
                const copyPairs = Math.min(availablePairs, neededPairs);

                for (let i = 0; i < copyPairs; i++) {
                    outputL[outIdx + i] = chunk[i * 2];
                    outputR[outIdx + i] = chunk[i * 2 + 1];
                }

                outIdx += copyPairs;

                if (copyPairs >= availablePairs) {
                    this.audioBufferQueue.shift();
                } else {
                    this.audioBufferQueue[0] = chunk.subarray(copyPairs * 2);
                }
            }

            // Fill remaining if queue underrun
            while (outIdx < bufferLen) {
                outputL[outIdx] = 0;
                outputR[outIdx] = 0;
                outIdx++;
            }
        }

        loop(timestamp) {
            if (!this.isRunning) return;

            if (this.maxSpeed) {
                // MAX Turbo mode: burst multiple frames per RAF tick within safe execution budget
                const maxFrames = 10;
                const startTime = performance.now();
                let framesRan = 0;

                while (framesRan < maxFrames && (performance.now() - startTime) < 12) {
                    this.module._mz_wasm_run_frame();
                    framesRan++;
                }

                // Blit only the final rendered frame to Canvas / WebGL
                const fbPtr = this.module._mz_wasm_get_framebuffer();
                if (fbPtr) {
                    const pixelCount = this.screenWidth * this.screenHeight;
                    const srcU8 = new Uint8Array(this.module.HEAPU8.buffer, fbPtr, pixelCount * 4);
                    this.renderFrame(srcU8);
                }

                // Discard audio samples during turbo mode to prevent queue overflow and harsh screeching
                this.audioBufferQueue = [];

                // FPS Counter
                this.frameCount += framesRan;
                if (timestamp - this.lastFpsUpdate >= 1000) {
                    const fps = Math.round((this.frameCount * 1000) / (timestamp - this.lastFpsUpdate));
                    if (this.fpsCounter) {
                        this.fpsCounter.textContent = `${fps} FPS`;
                    }
                    this.frameCount = 0;
                    this.lastFpsUpdate = timestamp;
                }

                this.lastFrameTime = timestamp;
            } else {
                // Target PAL ~50Hz (20ms)
                const elapsed = timestamp - this.lastFrameTime;
                const targetInterval = 19.8;

                if (elapsed >= targetInterval) {
                    this.lastFrameTime = timestamp - (elapsed % targetInterval);

                    // Run 1 video frame in Wasm core
                    this.module._mz_wasm_run_frame();

                    // Blit Framebuffer to Canvas (WebGL or 2D)
                    const fbPtr = this.module._mz_wasm_get_framebuffer();
                    if (fbPtr) {
                        const pixelCount = this.screenWidth * this.screenHeight;
                        const srcU8 = new Uint8Array(this.module.HEAPU8.buffer, fbPtr, pixelCount * 4);
                        this.renderFrame(srcU8);
                    }

                    // Collect Audio Samples
                    if (this.audioCtx && !this.isMuted) {
                        const samplesCount = this.module._mz_wasm_get_audio_samples(
                            this.wasmAudioBufferPtr, 
                            this.wasmAudioBufferSize
                        );
                        if (samplesCount > 0) {
                            const samples = new Float32Array(
                                this.module.HEAPF32.buffer,
                                this.wasmAudioBufferPtr,
                                samplesCount
                            );
                            // Prevent queue overflow
                            if (this.audioBufferQueue.length < 15) {
                                this.audioBufferQueue.push(new Float32Array(samples));
                            }
                        }
                    }

                    // FPS Counter
                    this.frameCount++;
                    if (timestamp - this.lastFpsUpdate >= 1000) {
                        const fps = Math.round((this.frameCount * 1000) / (timestamp - this.lastFpsUpdate));
                        if (this.fpsCounter) {
                            this.fpsCounter.textContent = `${fps} FPS`;
                        }
                        this.frameCount = 0;
                        this.lastFpsUpdate = timestamp;
                    }
                }
            }

            requestAnimationFrame((ts) => this.loop(ts));
        }

        sendKey(col, bit, pressed) {
            if (this.module && this.module._mz_wasm_key_event) {
                this.module._mz_wasm_key_event(col, bit, pressed ? 1 : 0);
            }
            // Auto-start audio context on first user interaction
            if (!this.audioCtx) {
                this.initAudio();
            } else if (this.audioCtx.state === 'suspended') {
                this.audioCtx.resume();
            }
        }

        reset() {
            if (this.module && this.module._mz_wasm_reset) {
                console.log('[MZ800] Performing system reset...');
                this.module._mz_wasm_reset();
                this.updateStatus('Reset');
                setTimeout(() => this.updateStatus('Running (50Hz)'), 1500);
            }
        }

        toggleSpeed() {
            this.maxSpeed = !this.maxSpeed;
            this.lastFrameTime = performance.now();
            this.audioBufferQueue = [];
            const btn = document.getElementById('btn-speed');
            if (btn) {
                btn.classList.toggle('active', this.maxSpeed);
                btn.textContent = this.maxSpeed ? 'Speed: MAX' : 'Speed: 1x';
            }
        }

        toggleMute() {
            this.isMuted = !this.isMuted;
            if (!this.audioCtx) this.initAudio();
            const btn = document.getElementById('btn-mute');
            if (btn) {
                btn.classList.toggle('active', this.isMuted);
                btn.textContent = this.isMuted ? 'Unmute' : 'Mute';
            }
        }

        async loadMZF(arrayBuffer) {
            if (!this.module || !this.module._mz_wasm_load_mzf) {
                console.error('[MZ800] Module not ready for MZF load');
                return;
            }

            const uint8 = new Uint8Array(arrayBuffer);
            const size = uint8.length;
            const bufPtr = this.module._malloc(size);
            this.module.HEAPU8.set(uint8, bufPtr);

            console.log(`[MZ800] Injecting MZF image (${size} bytes)...`);
            const status = this.module._mz_wasm_load_mzf(bufPtr, size);
            this.module._free(bufPtr);

            if (status === 0) {
                console.log('[MZ800] MZF successfully injected and booted!');
                if (this.tapeStatus) {
                    this.tapeStatus.textContent = 'MZF Booted';
                    this.tapeStatus.style.color = '#54ff54';
                }
            } else {
                console.error('[MZ800] MZF load failed with code:', status);
                if (this.tapeStatus) {
                    this.tapeStatus.textContent = 'MZF Error';
                    this.tapeStatus.style.color = '#ff4444';
                }
            }

            // Ensure AudioContext is active
            if (this.audioCtx && this.audioCtx.state === 'suspended') {
                this.audioCtx.resume();
            }
        }

        async loadMZFUrl(url) {
            try {
                if (this.tapeStatus) this.tapeStatus.textContent = 'Loading...';
                const resp = await fetch(url);
                if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                const data = await resp.arrayBuffer();
                await this.loadMZF(data);
            } catch (err) {
                console.error('[MZ800] Failed to load MZF from URL:', url, err);
                if (this.tapeStatus) {
                    this.tapeStatus.textContent = 'Fetch Failed';
                    this.tapeStatus.style.color = '#ff4444';
                }
            }
        }

        setupFileDrop() {
            const viewport = document.getElementById('screen-viewport');
            if (!viewport) return;

            viewport.addEventListener('dragover', (e) => {
                e.preventDefault();
                viewport.style.outline = '2px dashed var(--accent-blue)';
            });

            viewport.addEventListener('dragleave', (e) => {
                e.preventDefault();
                viewport.style.outline = 'none';
            });

            viewport.addEventListener('drop', (e) => {
                e.preventDefault();
                viewport.style.outline = 'none';
                if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    const file = e.dataTransfer.files[0];
                    const reader = new FileReader();
                    reader.onload = () => this.loadMZF(reader.result);
                    reader.readAsArrayBuffer(file);
                }
            });
        }

        updateStatus(text) {
            if (this.tapeStatus) {
                this.tapeStatus.textContent = text;
            }
        }
    }

    // Startup bootstrap when DOM is ready
    window.addEventListener('DOMContentLoaded', async () => {
        const emulator = new MZ800Emulator();
        const controller = new window.ControllerManager();

        // Bind Toolbar actions
        const btnReset = document.getElementById('btn-reset');
        if (btnReset) btnReset.addEventListener('click', () => emulator.reset());

        const btnSpeed = document.getElementById('btn-speed');
        if (btnSpeed) btnSpeed.addEventListener('click', () => emulator.toggleSpeed());

        const btnMute = document.getElementById('btn-mute');
        if (btnMute) btnMute.addEventListener('click', () => emulator.toggleMute());

        const btnFullscreen = document.getElementById('btn-fullscreen');
        if (btnFullscreen) {
            btnFullscreen.addEventListener('click', () => {
                const elem = document.getElementById('app-container');
                if (!document.fullscreenElement) {
                    elem.requestFullscreen().catch(err => console.log(err));
                } else {
                    document.exitFullscreen();
                }
            });
        }

        const btnAspect = document.getElementById('btn-aspect');
        if (btnAspect) {
            btnAspect.addEventListener('click', () => emulator.toggleAspectMode());
        }

        const btnGamepad = document.getElementById('btn-gamepad');
        if (btnGamepad) {
            btnGamepad.addEventListener('click', () => {
                document.body.classList.toggle('hide-controls');
                btnGamepad.classList.toggle('active');
                emulator.updateDisplaySize();
            });
        }

        const btnCrt = document.getElementById('btn-crt');
        const crtContainer = document.querySelector('.crt-container');
        if (btnCrt && crtContainer) {
            btnCrt.addEventListener('click', () => {
                crtContainer.classList.toggle('crt-scanlines');
                btnCrt.classList.toggle('active');
            });
        }

        const fileInput = document.getElementById('file-input');
        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                if (e.target.files && e.target.files.length > 0) {
                    const reader = new FileReader();
                    reader.onload = () => emulator.loadMZF(reader.result);
                    reader.readAsArrayBuffer(e.target.files[0]);
                }
            });
        }

        const gameSelect = document.getElementById('game-select');
        const btnLoadGame = document.getElementById('btn-load-game');
        if (btnLoadGame && gameSelect) {
            btnLoadGame.addEventListener('click', () => {
                const selected = gameSelect.value;
                if (selected) {
                    emulator.loadMZFUrl(selected);
                }
            });
        }

        // Initialize emulator instance
        await emulator.init();
    });

})(window);
