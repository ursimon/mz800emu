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
                loadMZF: (data, name) => this.loadMZF(data, name),
                loadDSK: (data, name) => this.loadDSK(data, name),
                loadData: (name, data) => this.loadData(name, data),
                loadFromUrl: (url, proxy) => this.loadFromUrl(url, proxy),
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

        async loadMZF(arrayBuffer, fileName) {
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

            const dispName = fileName ? fileName.split('/').pop().split('\\').pop() : 'MZF';
            if (status === 0) {
                console.log(`[MZ800] ${dispName} successfully injected and booted!`);
                if (this.tapeStatus) {
                    this.tapeStatus.textContent = `${dispName} Booted`;
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

        async loadDSK(arrayBuffer, fileName) {
            if (!this.module || !this.module._mz_wasm_load_dsk) {
                console.error('[MZ800] Module not ready for DSK load');
                return;
            }

            const uint8 = new Uint8Array(arrayBuffer);
            const size = uint8.length;
            const bufPtr = this.module._malloc(size);
            this.module.HEAPU8.set(uint8, bufPtr);

            console.log(`[MZ800] Mounting DSK image (${size} bytes)...`);
            const status = this.module._mz_wasm_load_dsk(bufPtr, size);
            this.module._free(bufPtr);

            const dispName = fileName ? fileName.split('/').pop().split('\\').pop() : 'DSK';
            if (status === 0) {
                console.log(`[MZ800] ${dispName} mounted and system rebooted!`);
                if (this.tapeStatus) {
                    this.tapeStatus.textContent = `${dispName} Booted`;
                    this.tapeStatus.style.color = '#54ff54';
                }
            } else {
                console.error('[MZ800] DSK mount failed with code:', status);
                if (this.tapeStatus) {
                    this.tapeStatus.textContent = 'DSK Error';
                    this.tapeStatus.style.color = '#ff4444';
                }
            }

            if (this.audioCtx && this.audioCtx.state === 'suspended') {
                this.audioCtx.resume();
            }
        }

        async extractFromZip(arrayBuffer) {
            const u8 = new Uint8Array(arrayBuffer);
            const view = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
            // Local file header signature: 0x04034b50
            if (u8.length < 30 || view.getUint32(0, true) !== 0x04034b50) {
                return null;
            }

            let offset = 0;
            while (offset + 30 <= u8.length) {
                const sig = view.getUint32(offset, true);
                if (sig !== 0x04034b50) break;

                const method = view.getUint16(offset + 8, true);
                const compSize = view.getUint32(offset + 18, true);
                const uncompSize = view.getUint32(offset + 22, true);
                const fnameLen = view.getUint16(offset + 26, true);
                const extraLen = view.getUint16(offset + 28, true);

                if (offset + 30 + fnameLen > u8.length) break;

                const nameBytes = u8.subarray(offset + 30, offset + 30 + fnameLen);
                const fileName = new TextDecoder().decode(nameBytes);
                const dataOffset = offset + 30 + fnameLen + extraLen;

                if (dataOffset + compSize > u8.length) break;

                // Skip directories and macOS metadata
                if (!fileName.endsWith('/') && !/^__MACOSX|\/\./.test(fileName)) {
                    if (/\.(mzf|m12|mzt|dsk)$/i.test(fileName)) {
                        const rawData = u8.subarray(dataOffset, dataOffset + compSize);
                        let decompressed = null;

                        if (method === 0) {
                            // Stored (no compression)
                            decompressed = rawData.slice().buffer;
                        } else if (method === 8) {
                            // Deflate
                            if (typeof DecompressionStream !== 'undefined') {
                                try {
                                    const ds = new DecompressionStream('deflate-raw');
                                    const writer = ds.writable.getWriter();
                                    writer.write(rawData);
                                    writer.close();
                                    decompressed = await new Response(ds.readable).arrayBuffer();
                                } catch (e) {
                                    console.warn('[MZ800] ZIP deflate decompression failed:', e);
                                }
                            } else {
                                console.warn('[MZ800] DecompressionStream not supported in this environment for ZIP deflate');
                            }
                        }

                        if (decompressed) {
                            console.log(`[MZ800] Extracted ${fileName} (${decompressed.byteLength} bytes) from ZIP.`);
                            return { fileName, data: decompressed };
                        }
                    }
                }

                offset = dataOffset + compSize;
            }

            return null;
        }

        async loadData(fileName, arrayBuffer) {
            // First check if it is a ZIP archive
            const zipContent = await this.extractFromZip(arrayBuffer);
            if (zipContent) {
                return await this.loadData(zipContent.fileName, zipContent.data);
            }

            const name = (fileName || '').toLowerCase();
            const uint8 = new Uint8Array(arrayBuffer);

            // If extension is DSK or floppy disk size (>= 160KB and multiple of 256/512)
            if (name.endsWith('.dsk') || (uint8.length >= 160 * 1024 && (uint8.length % 256 === 0) && !name.endsWith('.mzf') && !name.endsWith('.m12'))) {
                return await this.loadDSK(arrayBuffer, fileName);
            }

            // Otherwise load as MZF / tape
            return await this.loadMZF(arrayBuffer, fileName);
        }

        async fetchBinaryWithFallback(url, customProxy) {
            const tryFetch = async (fetchUrl) => {
                const resp = await fetch(fetchUrl, { mode: 'cors' });
                if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                return await resp.arrayBuffer();
            };

            const isAbsolute = /^https?:\/\//i.test(url);

            // 1. Relative or local URL
            if (!isAbsolute) {
                return await tryFetch(url);
            }

            // 2. Custom proxy if provided
            if (customProxy) {
                const proxyUrl = customProxy.includes('%s')
                    ? customProxy.replace('%s', encodeURIComponent(url))
                    : `${customProxy}${encodeURIComponent(url)}`;
                console.log(`[MZ800] Fetching via custom proxy: ${proxyUrl}`);
                return await tryFetch(proxyUrl);
            }

            // 3. Try direct fetch first
            try {
                return await tryFetch(url);
            } catch (directErr) {
                console.warn('[MZ800] Direct fetch failed (likely CORS). Trying fallback CORS proxies...', directErr);
            }

            // 4. Try public CORS proxy 1: corsproxy.io
            try {
                this.updateStatus('CORS Proxy 1...');
                return await tryFetch(`https://corsproxy.io/?${encodeURIComponent(url)}`);
            } catch (p1Err) {
                console.warn('[MZ800] corsproxy.io failed, trying allorigins...', p1Err);
            }

            // 5. Try public CORS proxy 2: api.allorigins.win
            try {
                this.updateStatus('CORS Proxy 2...');
                return await tryFetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`);
            } catch (p2Err) {
                console.error('[MZ800] All fetch attempts failed:', p2Err);
                throw new Error('Failed to fetch file directly or via CORS proxies.');
            }
        }

        async loadFromUrl(url, customProxy) {
            if (!url) return;

            // Extract readable filename from URL
            let fileName = 'file';
            try {
                const parsed = new URL(url, window.location.href);
                const fullStr = parsed.pathname + parsed.search;
                const match = fullStr.match(/([a-zA-Z0-9_\-.]+\.(?:mzf|m12|mzt|dsk|zip))/i);
                if (match) {
                    fileName = match[1];
                } else {
                    const segs = parsed.pathname.split('/').filter(Boolean);
                    if (segs.length > 0) fileName = segs[segs.length - 1];
                }
            } catch (e) {
                const match = url.match(/([a-zA-Z0-9_\-.]+\.(?:mzf|m12|mzt|dsk|zip))/i);
                if (match) fileName = match[1];
            }

            console.log(`[MZ800] Loading from URL: ${url} (name: ${fileName})`);
            this.updateStatus(`Loading ${fileName}...`);
            if (this.tapeStatus) this.tapeStatus.style.color = '#24ccff';

            try {
                const arrayBuffer = await this.fetchBinaryWithFallback(url, customProxy);
                await this.loadData(fileName, arrayBuffer);
            } catch (err) {
                console.error('[MZ800] Failed to load from URL:', url, err);
                if (this.tapeStatus) {
                    this.tapeStatus.textContent = 'Fetch Failed';
                    this.tapeStatus.style.color = '#ff4444';
                    this.tapeStatus.title = `Error: ${err.message}. If blocked by CORS, try downloading and using 📂 File.`;
                }
            }
        }

        async loadMZFUrl(url) {
            return this.loadFromUrl(url);
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
                    reader.onload = () => this.loadData(file.name, reader.result);
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

    /**
     * Parses URL query parameters and hash to extract file to load and emulator options.
     * Handles unencoded query strings in target URL (e.g. ?catalog/...&op=get).
     */
    function parseInitialUrl() {
        const search = window.location.search || '';
        const hash = window.location.hash || '';

        const raw = (search.length > 1) ? search.substring(1) : (hash.length > 1 ? hash.substring(1) : '');
        if (!raw) return null;

        const emuFlags = ['speed', 'aspect', 'mute', 'muted', 'sound', 'crt', 'gamepad', 'proxy', 'cors', 'turbo'];
        const options = {};

        // Parse emulator flags if present
        const flagMatches = raw.matchAll(/[?&](speed|aspect|mute|muted|sound|crt|gamepad|proxy|cors)=([^&#]+)/gi);
        for (const m of flagMatches) {
            options[m[1].toLowerCase()] = decodeURIComponent(m[2]);
        }

        // 1. Direct URL check (if raw starts with http://, https://, games/, ./, or /)
        if (/^(?:https?:\/\/|games\/|\.\/|\/)/i.test(raw)) {
            // Check if there are emulator flags appended
            const parts = raw.split('&');
            let urlParts = [parts[0]];
            for (let i = 1; i < parts.length; i++) {
                const key = parts[i].split('=')[0].toLowerCase();
                if (emuFlags.includes(key)) break;
                urlParts.push(parts[i]);
            }
            let target = urlParts.join('&');
            try { target = decodeURIComponent(target); } catch (e) {}
            options.url = target;
            return options;
        }

        // 2. Recognized loader keys: url, mzf, file, tape, dsk, load
        const match = raw.match(/(?:^|[&?])(url|mzf|file|tape|dsk|load)=([^#]+)/i);
        if (match) {
            options.type = match[1].toLowerCase();
            const remainder = match[2];

            // Retain any query parameters that belong to the remote target URL (e.g. &op=get)
            // Stop only when encountering known emulator control flags
            const parts = remainder.split('&');
            let urlParts = [parts[0]];
            for (let i = 1; i < parts.length; i++) {
                const key = parts[i].split('=')[0].toLowerCase();
                if (emuFlags.includes(key)) {
                    break;
                } else {
                    urlParts.push(parts[i]);
                }
            }

            let targetUrl = urlParts.join('&');
            try {
                targetUrl = decodeURIComponent(targetUrl);
            } catch (e) {}
            options.url = targetUrl;
        }

        if (options.cors && !options.proxy) {
            options.proxy = options.cors;
        }

        return Object.keys(options).length > 0 ? options : null;
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
                    const file = e.target.files[0];
                    const reader = new FileReader();
                    reader.onload = () => emulator.loadData(file.name, reader.result);
                    reader.readAsArrayBuffer(file);
                }
            });
        }

        const btnLoadUrl = document.getElementById('btn-load-url');
        if (btnLoadUrl) {
            btnLoadUrl.addEventListener('click', () => {
                const url = window.prompt('Enter URL to MZF, DSK, or ZIP file:');
                if (url && url.trim()) {
                    emulator.loadFromUrl(url.trim());
                }
            });
        }

        const gameSelect = document.getElementById('game-select');
        const btnLoadGame = document.getElementById('btn-load-game');
        if (btnLoadGame && gameSelect) {
            btnLoadGame.addEventListener('click', () => {
                const selected = gameSelect.value;
                if (selected) {
                    emulator.loadFromUrl(selected);
                }
            });
        }

        // Initialize emulator instance
        await emulator.init();

        // Check for URL parameters
        const initial = parseInitialUrl();
        if (initial) {
            console.log('[MZ800] Found initial URL parameters:', initial);

            if (initial.aspect && emulator.aspectModes.includes(initial.aspect)) {
                emulator.setAspectMode(initial.aspect);
            }
            if (initial.speed === 'max' || initial.speed === 'turbo' || initial.turbo === '1') {
                if (!emulator.maxSpeed) emulator.toggleSpeed();
            }
            if (initial.mute === '1' || initial.muted === '1' || initial.sound === '0') {
                if (!emulator.isMuted) emulator.toggleMute();
            }
            if (initial.crt === '0' || initial.crt === 'off') {
                if (crtContainer) crtContainer.classList.remove('crt-scanlines');
                if (btnCrt) btnCrt.classList.remove('active');
            }

            if (initial.url) {
                await emulator.loadFromUrl(initial.url, initial.proxy);
            }
        }
    });

})(window);
