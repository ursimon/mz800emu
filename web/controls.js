/**
 * controls.js — Sharp MZ-800 Keyboard & Touch Controller Driver
 *
 * Maps touch controls and physical keyboard to Sharp MZ-800 8255 PPI Matrix
 * (columns 0..9, bits 0..7).
 */

(function(window) {
    'use strict';

    // Sharp MZ-800 Keyboard Matrix Table: [col, bit, optional_shift]
    const KEY_MATRIX = {
        // Cursor / Direction keys
        'ArrowUp':    { col: 7, bit: 5 },
        'ArrowDown':  { col: 7, bit: 4 },
        'ArrowLeft':  { col: 7, bit: 2 },
        'ArrowRight': { col: 7, bit: 3 },

        // System & Special keys
        'Enter':      { col: 0, bit: 0 },  // CR
        'NumpadEnter':{ col: 0, bit: 0 },
        'Space':      { col: 6, bit: 4 },
        ' ':          { col: 6, bit: 4 },
        'Backspace':  { col: 7, bit: 6 },  // DEL
        'Delete':     { col: 7, bit: 6 },
        'Insert':     { col: 7, bit: 7 },
        'Escape':     { col: 8, bit: 7 },  // BREAK
        'Tab':        { col: 0, bit: 3 },
        'ShiftLeft':  { col: 8, bit: 0 },
        'ShiftRight': { col: 8, bit: 0 },
        'ControlLeft':{ col: 8, bit: 6 },
        'ControlRight':{ col: 8, bit: 6 },

        // Numbers
        'Digit1': { col: 5, bit: 7 }, '1': { col: 5, bit: 7 },
        'Digit2': { col: 5, bit: 6 }, '2': { col: 5, bit: 6 },
        'Digit3': { col: 5, bit: 5 }, '3': { col: 5, bit: 5 },
        'Digit4': { col: 5, bit: 4 }, '4': { col: 5, bit: 4 },
        'Digit5': { col: 5, bit: 3 }, '5': { col: 5, bit: 3 },
        'Digit6': { col: 5, bit: 2 }, '6': { col: 5, bit: 2 },
        'Digit7': { col: 5, bit: 1 }, '7': { col: 5, bit: 1 },
        'Digit8': { col: 5, bit: 0 }, '8': { col: 5, bit: 0 },
        'Digit9': { col: 6, bit: 2 }, '9': { col: 6, bit: 2 },
        'Digit0': { col: 6, bit: 3 }, '0': { col: 6, bit: 3 },

        // Letters
        'KeyA': { col: 4, bit: 7 }, 'a': { col: 4, bit: 7 }, 'A': { col: 4, bit: 7 },
        'KeyB': { col: 4, bit: 6 }, 'b': { col: 4, bit: 6 }, 'B': { col: 4, bit: 6 },
        'KeyC': { col: 4, bit: 5 }, 'c': { col: 4, bit: 5 }, 'C': { col: 4, bit: 5 },
        'KeyD': { col: 4, bit: 4 }, 'd': { col: 4, bit: 4 }, 'D': { col: 4, bit: 4 },
        'KeyE': { col: 4, bit: 3 }, 'e': { col: 4, bit: 3 }, 'E': { col: 4, bit: 3 },
        'KeyF': { col: 4, bit: 2 }, 'f': { col: 4, bit: 2 }, 'F': { col: 4, bit: 2 },
        'KeyG': { col: 4, bit: 1 }, 'g': { col: 4, bit: 1 }, 'G': { col: 4, bit: 1 },
        'KeyH': { col: 4, bit: 0 }, 'h': { col: 4, bit: 0 }, 'H': { col: 4, bit: 0 },
        'KeyI': { col: 3, bit: 7 }, 'i': { col: 3, bit: 7 }, 'I': { col: 3, bit: 7 },
        'KeyJ': { col: 3, bit: 6 }, 'j': { col: 3, bit: 6 }, 'J': { col: 3, bit: 6 },
        'KeyK': { col: 3, bit: 5 }, 'k': { col: 3, bit: 5 }, 'K': { col: 3, bit: 5 },
        'KeyL': { col: 3, bit: 4 }, 'l': { col: 3, bit: 4 }, 'L': { col: 3, bit: 4 },
        'KeyM': { col: 3, bit: 3 }, 'm': { col: 3, bit: 3 }, 'M': { col: 3, bit: 3 },
        'KeyN': { col: 3, bit: 2 }, 'n': { col: 3, bit: 2 }, 'N': { col: 3, bit: 2 },
        'KeyO': { col: 3, bit: 1 }, 'o': { col: 3, bit: 1 }, 'O': { col: 3, bit: 1 },
        'KeyP': { col: 3, bit: 0 }, 'p': { col: 3, bit: 0 }, 'P': { col: 3, bit: 0 },
        'KeyQ': { col: 2, bit: 7 }, 'q': { col: 2, bit: 7 }, 'Q': { col: 2, bit: 7 },
        'KeyR': { col: 2, bit: 6 }, 'r': { col: 2, bit: 6 }, 'R': { col: 2, bit: 6 },
        'KeyS': { col: 2, bit: 5 }, 's': { col: 2, bit: 5 }, 'S': { col: 2, bit: 5 },
        'KeyT': { col: 2, bit: 4 }, 't': { col: 2, bit: 4 }, 'T': { col: 2, bit: 4 },
        'KeyU': { col: 2, bit: 3 }, 'u': { col: 2, bit: 3 }, 'U': { col: 2, bit: 3 },
        'KeyV': { col: 2, bit: 2 }, 'v': { col: 2, bit: 2 }, 'V': { col: 2, bit: 2 },
        'KeyW': { col: 2, bit: 1 }, 'w': { col: 2, bit: 1 }, 'W': { col: 2, bit: 1 },
        'KeyX': { col: 2, bit: 0 }, 'x': { col: 2, bit: 0 }, 'X': { col: 2, bit: 0 },
        'KeyY': { col: 1, bit: 7 }, 'y': { col: 1, bit: 7 }, 'Y': { col: 1, bit: 7 },
        'KeyZ': { col: 1, bit: 6 }, 'z': { col: 1, bit: 6 }, 'Z': { col: 1, bit: 6 },
    };

    class ControllerManager {
        constructor() {
            this.activeKeys = new Set();
            this.setupPhysicalKeyboard();
            this.setupTouchControls();
        }

        sendKey(col, bit, pressed) {
            if (window.MZ800 && typeof window.MZ800.sendKey === 'function') {
                window.MZ800.sendKey(col, bit, pressed);
            }
        }

        setupPhysicalKeyboard() {
            window.addEventListener('keydown', (e) => {
                // Prevent scrolling with arrows/space on the page
                if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', ' '].includes(e.key) ||
                    ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
                    e.preventDefault();
                }

                const mapping = KEY_MATRIX[e.code] || KEY_MATRIX[e.key];
                if (mapping) {
                    const keyId = `${mapping.col}:${mapping.bit}`;
                    if (!this.activeKeys.has(keyId)) {
                        this.activeKeys.add(keyId);
                        this.sendKey(mapping.col, mapping.bit, true);
                    }
                }
            });

            window.addEventListener('keyup', (e) => {
                const mapping = KEY_MATRIX[e.code] || KEY_MATRIX[e.key];
                if (mapping) {
                    const keyId = `${mapping.col}:${mapping.bit}`;
                    if (this.activeKeys.has(keyId)) {
                        this.activeKeys.delete(keyId);
                        this.sendKey(mapping.col, mapping.bit, false);
                    }
                }
            });
        }

        bindTouchButton(elementId, col, bit, visualClass = 'pressed') {
            const el = document.getElementById(elementId);
            if (!el) return;

            let isPressed = false;

            const press = (e) => {
                if (e.cancelable) e.preventDefault();
                if (!isPressed) {
                    isPressed = true;
                    el.classList.add(visualClass);
                    this.sendKey(col, bit, true);
                }
            };

            const release = (e) => {
                if (e && e.cancelable) e.preventDefault();
                if (isPressed) {
                    isPressed = false;
                    el.classList.remove(visualClass);
                    this.sendKey(col, bit, false);
                }
            };

            // Touch events
            el.addEventListener('touchstart', press, { passive: false });
            el.addEventListener('touchend', release, { passive: false });
            el.addEventListener('touchcancel', release, { passive: false });

            // Pointer / Mouse fallback
            el.addEventListener('pointerdown', press);
            el.addEventListener('pointerup', release);
            el.addEventListener('pointerleave', release);
            el.addEventListener('pointercancel', release);
            el.addEventListener('contextmenu', (e) => e.preventDefault());
        }

        setupTouchControls() {
            // Enhanced D-Pad with sliding/rolling thumb gestures
            const dpadContainer = document.querySelector('.dpad-container');
            const dpadBtns = {
                up:    { el: document.getElementById('btn-up'),    col: 7, bit: 5, active: false },
                down:  { el: document.getElementById('btn-down'),  col: 7, bit: 4, active: false },
                left:  { el: document.getElementById('btn-left'),  col: 7, bit: 2, active: false },
                right: { el: document.getElementById('btn-right'), col: 7, bit: 3, active: false }
            };

            if (dpadContainer) {
                let dpadActiveTouchId = null;

                const updateDpadFromCoords = (clientX, clientY) => {
                    const rect = dpadContainer.getBoundingClientRect();
                    const centerX = rect.left + rect.width / 2;
                    const centerY = rect.top + rect.height / 2;
                    const dx = clientX - centerX;
                    const dy = clientY - centerY;
                    const dist = Math.hypot(dx, dy);

                    const deadzone = rect.width * 0.12;
                    let wantUp = false, wantDown = false, wantLeft = false, wantRight = false;

                    if (dist >= deadzone) {
                        const angle = Math.atan2(dy, dx) * (180 / Math.PI); // -180 to 180
                        // Up: -157.5 to -22.5
                        if (angle > -157.5 && angle < -22.5) wantUp = true;
                        // Down: 22.5 to 157.5
                        if (angle > 22.5 && angle < 157.5) wantDown = true;
                        // Right: -67.5 to 67.5
                        if (angle > -67.5 && angle < 67.5) wantRight = true;
                        // Left: > 112.5 or < -112.5
                        if (angle > 112.5 || angle < -112.5) wantLeft = true;
                    }

                    const setBtn = (key, want) => {
                        const b = dpadBtns[key];
                        if (b && b.active !== want) {
                            b.active = want;
                            if (b.el) b.el.classList.toggle('pressed', want);
                            this.sendKey(b.col, b.bit, want);
                        }
                    };

                    setBtn('up', wantUp);
                    setBtn('down', wantDown);
                    setBtn('left', wantLeft);
                    setBtn('right', wantRight);
                };

                const resetDpad = () => {
                    dpadActiveTouchId = null;
                    Object.keys(dpadBtns).forEach(k => {
                        const b = dpadBtns[k];
                        if (b.active) {
                            b.active = false;
                            if (b.el) b.el.classList.remove('pressed');
                            this.sendKey(b.col, b.bit, false);
                        }
                    });
                };

                dpadContainer.addEventListener('touchstart', (e) => {
                    if (e.cancelable) e.preventDefault();
                    if (dpadActiveTouchId === null && e.changedTouches.length > 0) {
                        const touch = e.changedTouches[0];
                        dpadActiveTouchId = touch.identifier;
                        updateDpadFromCoords(touch.clientX, touch.clientY);
                    }
                }, { passive: false });

                window.addEventListener('touchmove', (e) => {
                    if (dpadActiveTouchId !== null) {
                        for (let i = 0; i < e.touches.length; i++) {
                            if (e.touches[i].identifier === dpadActiveTouchId) {
                                if (e.cancelable) e.preventDefault();
                                updateDpadFromCoords(e.touches[i].clientX, e.touches[i].clientY);
                                break;
                            }
                        }
                    }
                }, { passive: false });

                const endTouch = (e) => {
                    if (dpadActiveTouchId !== null) {
                        for (let i = 0; i < e.changedTouches.length; i++) {
                            if (e.changedTouches[i].identifier === dpadActiveTouchId) {
                                resetDpad();
                                break;
                            }
                        }
                    }
                };

                window.addEventListener('touchend', endTouch, { passive: false });
                window.addEventListener('touchcancel', endTouch, { passive: false });
            }

            // Desktop Mouse Click bindings for D-Pad
            this.bindTouchButton('btn-up',    7, 5);
            this.bindTouchButton('btn-down',  7, 4);
            this.bindTouchButton('btn-left',  7, 2);
            this.bindTouchButton('btn-right', 7, 3);

            // Action Buttons
            // Button A -> SPACE (Fire 1)
            this.bindTouchButton('btn-act-a', 6, 4);
            // Button B -> ARROW UP or ENTER (Fire 2 / Jump)
            this.bindTouchButton('btn-act-b', 7, 5);
            // Button C -> SHIFT
            this.bindTouchButton('btn-act-c', 8, 0);

            // System Buttons
            // Space
            this.bindTouchButton('btn-sys-space', 6, 4);
            // CR (Enter)
            this.bindTouchButton('btn-sys-cr',    0, 0);
            // BREAK (Escape)
            this.bindTouchButton('btn-sys-break', 8, 7, 'pressed');
        }
    }

    window.ControllerManager = ControllerManager;
})(window);
