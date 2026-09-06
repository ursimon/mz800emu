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

        // Function keys (F1 - F5)
        'F1': { col: 9, bit: 7 },
        'F2': { col: 9, bit: 6 },
        'F3': { col: 9, bit: 5 },
        'F4': { col: 9, bit: 4 },
        'F5': { col: 9, bit: 3 },

        // Symbols and punctuation
        'Minus':        { col: 6, bit: 5 }, '-': { col: 6, bit: 5 },
        'Equal':        { col: 6, bit: 6 }, '=': { col: 6, bit: 6 }, // UP_ARROW / ~
        'Backslash':    { col: 6, bit: 7 }, '\\': { col: 6, bit: 7 },
        'BracketLeft':  { col: 1, bit: 4 }, '[': { col: 1, bit: 4 },
        'BracketRight': { col: 1, bit: 3 }, ']': { col: 1, bit: 3 },
        'Semicolon':    { col: 0, bit: 2 }, ';': { col: 0, bit: 2 },
        'Quote':        { col: 0, bit: 1 }, ':': { col: 0, bit: 1 }, '\'': { col: 0, bit: 1 },
        'Comma':        { col: 6, bit: 1 }, ',': { col: 6, bit: 1 },
        'Period':       { col: 6, bit: 0 }, '.': { col: 6, bit: 0 },
        'Slash':        { col: 7, bit: 0 }, '/': { col: 7, bit: 0 },
        'Backquote':    { col: 0, bit: 7 }, '`': { col: 0, bit: 7 }, // BLANK
        'CapsLock':     { col: 0, bit: 6 },                           // GRAPH mode
        'End':          { col: 8, bit: 7 },                           // BREAK
        'Home':         { col: 7, bit: 6 },                           // DEL
        'F6':           { col: 1, bit: 5 },                           // @
        'F7':           { col: 6, bit: 7 },                           // \
        'F8':           { col: 7, bit: 1 },                           // ?
        'F9':           { col: 0, bit: 5 },                           // LIBRA / DOWN_ARROW

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
            this.virtualKeyboard = new VirtualKeyboard(this);
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
            // Button B -> ARROW UP (Fire 2 / Jump)
            this.bindTouchButton('btn-act-b', 7, 5);

            // System Buttons
            // Space
            this.bindTouchButton('btn-sys-space', 6, 4);
            // CR (Enter)
            this.bindTouchButton('btn-sys-cr',    0, 0);
            // BREAK (Escape)
            this.bindTouchButton('btn-sys-break', 8, 7, 'pressed');
        }
    }

    // ASCII to Sharp MZ-800 Key Matrix Translation Table
    const ASCII_TO_MZ = {
        // Uppercase letters (Base in MZ-800 ROM)
        'A': { col: 4, bit: 7, shift: false }, 'B': { col: 4, bit: 6, shift: false },
        'C': { col: 4, bit: 5, shift: false }, 'D': { col: 4, bit: 4, shift: false },
        'E': { col: 4, bit: 3, shift: false }, 'F': { col: 4, bit: 2, shift: false },
        'G': { col: 4, bit: 1, shift: false }, 'H': { col: 4, bit: 0, shift: false },
        'I': { col: 3, bit: 7, shift: false }, 'J': { col: 3, bit: 6, shift: false },
        'K': { col: 3, bit: 5, shift: false }, 'L': { col: 3, bit: 4, shift: false },
        'M': { col: 3, bit: 3, shift: false }, 'N': { col: 3, bit: 2, shift: false },
        'O': { col: 3, bit: 1, shift: false }, 'P': { col: 3, bit: 0, shift: false },
        'Q': { col: 2, bit: 7, shift: false }, 'R': { col: 2, bit: 6, shift: false },
        'S': { col: 2, bit: 5, shift: false }, 'T': { col: 2, bit: 4, shift: false },
        'U': { col: 2, bit: 3, shift: false }, 'V': { col: 2, bit: 2, shift: false },
        'W': { col: 2, bit: 1, shift: false }, 'X': { col: 2, bit: 0, shift: false },
        'Y': { col: 1, bit: 7, shift: false }, 'Z': { col: 1, bit: 6, shift: false },

        // Lowercase letters (Shifted in MZ-800 ROM)
        'a': { col: 4, bit: 7, shift: true }, 'b': { col: 4, bit: 6, shift: true },
        'c': { col: 4, bit: 5, shift: true }, 'd': { col: 4, bit: 4, shift: true },
        'e': { col: 4, bit: 3, shift: true }, 'f': { col: 4, bit: 2, shift: true },
        'g': { col: 4, bit: 1, shift: true }, 'h': { col: 4, bit: 0, shift: true },
        'i': { col: 3, bit: 7, shift: true }, 'j': { col: 3, bit: 6, shift: true },
        'k': { col: 3, bit: 5, shift: true }, 'l': { col: 3, bit: 4, shift: true },
        'm': { col: 3, bit: 3, shift: true }, 'n': { col: 3, bit: 2, shift: true },
        'o': { col: 3, bit: 1, shift: true }, 'p': { col: 3, bit: 0, shift: true },
        'q': { col: 2, bit: 7, shift: true }, 'r': { col: 2, bit: 6, shift: true },
        's': { col: 2, bit: 5, shift: true }, 't': { col: 2, bit: 4, shift: true },
        'u': { col: 2, bit: 3, shift: true }, 'v': { col: 2, bit: 2, shift: true },
        'w': { col: 2, bit: 1, shift: true }, 'x': { col: 2, bit: 0, shift: true },
        'y': { col: 1, bit: 7, shift: true }, 'z': { col: 1, bit: 6, shift: true },

        // Digits (Base)
        '0': { col: 6, bit: 3, shift: false },
        '1': { col: 5, bit: 7, shift: false },
        '2': { col: 5, bit: 6, shift: false },
        '3': { col: 5, bit: 5, shift: false },
        '4': { col: 5, bit: 4, shift: false },
        '5': { col: 5, bit: 3, shift: false },
        '6': { col: 5, bit: 2, shift: false },
        '7': { col: 5, bit: 1, shift: false },
        '8': { col: 5, bit: 0, shift: false },
        '9': { col: 6, bit: 2, shift: false },

        // Shifted symbols
        '!': { col: 5, bit: 7, shift: true },
        '"': { col: 5, bit: 6, shift: true },
        '#': { col: 5, bit: 5, shift: true },
        '$': { col: 5, bit: 4, shift: true },
        '%': { col: 5, bit: 3, shift: true },
        '&': { col: 5, bit: 2, shift: true },
        '\'': { col: 5, bit: 1, shift: true },
        '(': { col: 5, bit: 0, shift: true },
        ')': { col: 6, bit: 2, shift: true },
        'π': { col: 6, bit: 3, shift: true },
        '=': { col: 6, bit: 5, shift: true },
        '~': { col: 6, bit: 6, shift: true },
        '}': { col: 6, bit: 7, shift: true },
        '{': { col: 1, bit: 4, shift: true },
        '+': { col: 0, bit: 2, shift: true },
        '*': { col: 0, bit: 1, shift: true },
        '|': { col: 1, bit: 3, shift: true },
        '<': { col: 6, bit: 1, shift: true },
        '>': { col: 6, bit: 0, shift: true },
        '£': { col: 0, bit: 5, shift: true },

        // Base symbols
        '-': { col: 6, bit: 5, shift: false },
        '^': { col: 6, bit: 6, shift: false },
        '\\': { col: 6, bit: 7, shift: false },
        '@': { col: 1, bit: 5, shift: false },
        '[': { col: 1, bit: 4, shift: false },
        ']': { col: 1, bit: 3, shift: false },
        ';': { col: 0, bit: 2, shift: false },
        ':': { col: 0, bit: 1, shift: false },
        ',': { col: 6, bit: 1, shift: false },
        '.': { col: 6, bit: 0, shift: false },
        '/': { col: 7, bit: 0, shift: false },
        '?': { col: 7, bit: 1, shift: false },
        '_': { col: 0, bit: 7, shift: false },
        ' ': { col: 6, bit: 4, shift: false },
        '\n': { col: 0, bit: 0, shift: false },
        '\r': { col: 0, bit: 0, shift: false },
        '\t': { col: 0, bit: 3, shift: false }
    };

    /**
     * VirtualKeyboard — Touch-first, authentic Sharp MZ-800 on-screen keyboard
     */
    class VirtualKeyboard {
        constructor(controllerManager) {
            this.manager = controllerManager;
            this.container = document.getElementById('virtual-keyboard');
            this.shiftMode = 0; // 0 = off, 1 = latched (next key), 2 = locked (caps/shift lock)
            this.ctrlMode = 0;  // 0 = off, 1 = latched
            this.graphMode = false;
            this.lastShiftTap = 0;
            this.activePointers = new Map();
            this.isTyping = false;
            this.abortTyping = false;

            if (this.container) {
                this.bindKeys();
                this.setupTypeModal();
            }
        }

        toggle() {
            if (!this.container) return;
            const willShow = this.container.classList.contains('hidden');
            if (willShow) {
                this.show();
            } else {
                this.hide();
            }
        }

        show() {
            if (!this.container) return;
            this.container.classList.remove('hidden');
            this.updateVisibility(true);
        }

        hide() {
            if (!this.container) return;
            this.container.classList.add('hidden');
            // Release any active modifiers
            if (this.shiftMode > 0) {
                this.shiftMode = 0;
                this.manager.sendKey(8, 0, false);
            }
            if (this.ctrlMode > 0) {
                this.ctrlMode = 0;
                this.manager.sendKey(8, 6, false);
            }
            this.updateModifierUI();
            this.updateVisibility(false);
        }

        updateVisibility(isVisible) {
            const btn = document.getElementById('btn-keyboard');
            if (btn) btn.classList.toggle('active', isVisible);
            if (window.MZ800 && typeof window.MZ800.onLayoutChange === 'function') {
                window.MZ800.onLayoutChange();
            }
        }

        updateModifierUI() {
            const indShift = document.getElementById('vkbd-ind-shift');
            const indCtrl = document.getElementById('vkbd-ind-ctrl');
            const indGraph = document.getElementById('vkbd-ind-graph');

            if (indShift) indShift.classList.toggle('active', this.shiftMode > 0);
            if (indCtrl) indCtrl.classList.toggle('active', this.ctrlMode > 0);
            if (indGraph) indGraph.classList.toggle('active', this.graphMode);

            if (this.container) {
                this.container.classList.toggle('vkbd-shifted', this.shiftMode > 0);

                const shiftKeys = this.container.querySelectorAll('.vk-mod-shift');
                shiftKeys.forEach(k => {
                    k.classList.toggle('latched', this.shiftMode === 1);
                    k.classList.toggle('locked', this.shiftMode === 2);
                });

                const ctrlKeys = this.container.querySelectorAll('.vk-mod-ctrl');
                ctrlKeys.forEach(k => {
                    k.classList.toggle('latched', this.ctrlMode === 1);
                });

                const graphKeys = this.container.querySelectorAll('.vk-mod-graph');
                graphKeys.forEach(k => {
                    k.classList.toggle('latched', this.graphMode);
                });
            }
        }

        bindKeys() {
            const keys = this.container.querySelectorAll('.vk-key');

            const handleDown = (e, keyEl) => {
                if (e.cancelable) e.preventDefault();

                const col = parseInt(keyEl.dataset.col, 10);
                const bit = parseInt(keyEl.dataset.bit, 10);
                if (isNaN(col) || isNaN(bit)) return;

                if (navigator.vibrate) {
                    try { navigator.vibrate(8); } catch (err) {}
                }

                // Modifier: SHIFT (col 8, bit 0)
                if (col === 8 && bit === 0) {
                    const now = Date.now();
                    if (now - this.lastShiftTap < 380 && this.shiftMode > 0) {
                        // Double tap: toggle shift lock
                        this.shiftMode = (this.shiftMode === 2) ? 0 : 2;
                    } else {
                        // Single tap: latch or release
                        this.shiftMode = (this.shiftMode === 0) ? 1 : 0;
                    }
                    this.lastShiftTap = (this.shiftMode === 0) ? 0 : now;
                    this.manager.sendKey(8, 0, this.shiftMode > 0);
                    this.updateModifierUI();
                    return;
                }

                // Modifier: CTRL (col 8, bit 6)
                if (col === 8 && bit === 6) {
                    this.ctrlMode = (this.ctrlMode === 0) ? 1 : 0;
                    this.manager.sendKey(8, 6, this.ctrlMode > 0);
                    this.updateModifierUI();
                    return;
                }

                // Modifier: GRAPH (col 0, bit 6)
                if (col === 0 && bit === 6) {
                    this.manager.sendKey(0, 6, true);
                    setTimeout(() => this.manager.sendKey(0, 6, false), 40);
                    this.graphMode = !this.graphMode;
                    this.updateModifierUI();
                    return;
                }

                // Modifier: ALPHA (col 0, bit 4)
                if (col === 0 && bit === 4) {
                    this.manager.sendKey(0, 4, true);
                    setTimeout(() => this.manager.sendKey(0, 4, false), 40);
                    this.graphMode = false;
                    this.updateModifierUI();
                    return;
                }

                // Regular key press
                const pointerId = (e.pointerId !== undefined) ? e.pointerId : ('touch-' + (e.identifier || 0));
                this.activePointers.set(pointerId, { col, bit, el: keyEl });
                keyEl.classList.add('pressed');
                this.manager.sendKey(col, bit, true);
            };

            const handleUp = (e, keyEl) => {
                if (e && e.cancelable) e.preventDefault();
                const pointerId = (e && e.pointerId !== undefined) ? e.pointerId : ('touch-' + (e && e.identifier || 0));

                let info = this.activePointers.get(pointerId);
                if (!info && keyEl) {
                    // Fallback search by element
                    for (const [pid, val] of this.activePointers.entries()) {
                        if (val.el === keyEl) {
                            info = val;
                            this.activePointers.delete(pid);
                            break;
                        }
                    }
                } else if (info) {
                    this.activePointers.delete(pointerId);
                }

                if (info) {
                    info.el.classList.remove('pressed');
                    this.manager.sendKey(info.col, info.bit, false);

                    // Auto-unlatch single-use modifiers
                    if (this.shiftMode === 1) {
                        this.shiftMode = 0;
                        this.manager.sendKey(8, 0, false);
                        this.updateModifierUI();
                    }
                    if (this.ctrlMode === 1) {
                        this.ctrlMode = 0;
                        this.manager.sendKey(8, 6, false);
                        this.updateModifierUI();
                    }
                }
            };

            keys.forEach(k => {
                // Pointer events
                k.addEventListener('pointerdown', (e) => handleDown(e, k));
                k.addEventListener('pointerup', (e) => handleUp(e, k));
                k.addEventListener('pointerleave', (e) => handleUp(e, k));
                k.addEventListener('pointercancel', (e) => handleUp(e, k));
                k.addEventListener('contextmenu', (e) => e.preventDefault());
            });

            // Global safety: pointerup on window releases all keys
            window.addEventListener('pointerup', () => {
                for (const [, info] of this.activePointers.entries()) {
                    info.el.classList.remove('pressed');
                    this.manager.sendKey(info.col, info.bit, false);
                }
                this.activePointers.clear();
            });

            // Close button
            const btnClose = document.getElementById('btn-vkbd-close');
            if (btnClose) {
                btnClose.addEventListener('click', () => this.hide());
            }
        }

        async typeString(str, onProgress) {
            if (!str) return;
            this.isTyping = true;
            this.abortTyping = false;

            for (let i = 0; i < str.length; i++) {
                if (this.abortTyping) break;

                const char = str[i];
                const mapping = ASCII_TO_MZ[char];

                if (onProgress) {
                    onProgress(i + 1, str.length);
                }

                if (mapping) {
                    if (mapping.shift) {
                        this.manager.sendKey(8, 0, true);
                        await new Promise(r => setTimeout(r, 15));
                    }

                    this.manager.sendKey(mapping.col, mapping.bit, true);
                    await new Promise(r => setTimeout(r, 25));

                    this.manager.sendKey(mapping.col, mapping.bit, false);

                    if (mapping.shift) {
                        await new Promise(r => setTimeout(r, 10));
                        this.manager.sendKey(8, 0, false);
                    }

                    await new Promise(r => setTimeout(r, 25));
                } else {
                    // Unknown character, skip quickly
                    await new Promise(r => setTimeout(r, 10));
                }
            }

            this.isTyping = false;
        }

        setupTypeModal() {
            const btnType = document.getElementById('btn-vkbd-type');
            const modal = document.getElementById('vkbd-type-modal');
            const btnClose = document.getElementById('vkbd-modal-close');
            const btnCancel = document.getElementById('vkbd-type-cancel');
            const btnSend = document.getElementById('vkbd-type-send');
            const textarea = document.getElementById('vkbd-type-textarea');
            const progress = document.getElementById('vkbd-type-progress');
            const appendCr = document.getElementById('vkbd-type-append-cr');

            if (!btnType || !modal) return;

            const openModal = () => {
                modal.classList.remove('hidden');
                modal.style.display = 'flex';
                if (textarea) {
                    textarea.value = '';
                    setTimeout(() => textarea.focus(), 100);
                }
                if (progress) progress.style.display = 'none';
                if (btnSend) btnSend.disabled = false;
            };

            const closeModal = () => {
                if (this.isTyping) {
                    this.abortTyping = true;
                }
                modal.classList.add('hidden');
                modal.style.display = 'none';
            };

            btnType.addEventListener('click', openModal);
            if (btnClose) btnClose.addEventListener('click', closeModal);
            if (btnCancel) btnCancel.addEventListener('click', closeModal);

            modal.addEventListener('click', (e) => {
                if (e.target === modal) closeModal();
            });

            if (btnSend && textarea) {
                btnSend.addEventListener('click', async () => {
                    let text = textarea.value;
                    if (!text) return;
                    if (appendCr && appendCr.checked && !text.endsWith('\n')) {
                        text += '\n';
                    }

                    btnSend.disabled = true;
                    if (progress) {
                        progress.style.display = 'inline';
                        progress.textContent = 'Sending 0/' + text.length + '...';
                    }

                    await this.typeString(text, (cur, total) => {
                        if (progress) progress.textContent = `Sending ${cur}/${total}...`;
                    });

                    closeModal();
                });
            }
        }
    }

    window.VirtualKeyboard = VirtualKeyboard;
    window.ControllerManager = ControllerManager;
})(window);

