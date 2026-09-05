/**
 * pwa.js — Progressive Web App Controller for Sharp MZ-800
 *
 * Handles Service Worker registration with zero-stale caching policy:
 * - updateViaCache: 'none' bypasses HTTP cache on SW updates
 * - Auto-activation: self.skipWaiting() on install keeps workers fresh
 * - Guaranteed update reload: clicking 'Update Now' triggers skip-waiting and reloads
 * - Foreground checks on visibilitychange, online, and interval
 * - Manual 'Check Update' and emergency 'Clear Cache & Reload' buttons
 * - PWA beforeinstallprompt handler
 */

(function(window) {
    'use strict';

    let swRegistration = null;
    let deferredInstallPrompt = null;
    let isReloading = false;

    function initPWA() {
        setupInstallPrompt();

        if (!('serviceWorker' in navigator)) {
            console.log('[PWA] Service Worker not supported in this browser.');
            return;
        }

        window.addEventListener('load', async () => {
            try {
                // Register service worker with updateViaCache: 'none'
                const registration = await navigator.serviceWorker.register('./sw.js', {
                    updateViaCache: 'none'
                });
                swRegistration = registration;
                console.log('[PWA] ServiceWorker registered with scope:', registration.scope);

                // Listen for controller changes: when a new SW activates, reload automatically
                navigator.serviceWorker.addEventListener('controllerchange', () => {
                    if (!isReloading) {
                        isReloading = true;
                        console.log('[PWA] Controller changed. Reloading page...');
                        window.location.reload();
                    }
                });

                // If a waiting worker already exists (e.g. from previous visit), check if dismissed
                if (registration.waiting) {
                    if (sessionStorage.getItem('mz800_update_dismissed') !== '1') {
                        showUpdateBanner(registration.waiting);
                    }
                }

                // Listen for new updates installed in the background
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    if (!newWorker) return;

                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed') {
                            if (navigator.serviceWorker.controller) {
                                // A new version is ready in the background
                                console.log('[PWA] New version installed and waiting.');
                                showUpdateBanner(newWorker);
                            } else {
                                console.log('[PWA] App shell cached for offline use.');
                            }
                        }
                    });
                });

                // Proactively check for updates on return to tab/app
                document.addEventListener('visibilitychange', () => {
                    if (document.visibilityState === 'visible' && navigator.onLine) {
                        checkForUpdates(false);
                    }
                });

                // Check on reconnect
                window.addEventListener('online', () => {
                    console.log('[PWA] Reconnected to internet, checking for updates...');
                    checkForUpdates(false);
                });

                // Periodic check every 30 minutes
                setInterval(() => {
                    if (navigator.onLine) {
                        checkForUpdates(false);
                    }
                }, 30 * 60 * 1000);

                // Setup manual toolbar update check & clear cache buttons
                setupManualControls();

            } catch (err) {
                console.error('[PWA] ServiceWorker registration error:', err);
            }
        });
    }

    /**
     * Checks for service worker updates.
     */
    async function checkForUpdates(manual = false) {
        if (!swRegistration) return;
        try {
            await swRegistration.update();
            if (manual && swRegistration.waiting) {
                showUpdateBanner(swRegistration.waiting);
            }
        } catch (e) {
            console.warn('[PWA] Update check failed:', e);
        }
    }

    /**
     * Displays the sleek update notification banner.
     */
    function showUpdateBanner(worker) {
        const banner = document.getElementById('update-banner');
        const btnUpdate = document.getElementById('btn-update-now');
        const btnDismiss = document.getElementById('btn-update-dismiss');

        if (!banner) return;

        banner.classList.remove('hidden');

        const triggerUpdate = (e) => {
            if (e) e.preventDefault();
            if (btnUpdate) {
                btnUpdate.textContent = 'Updating...';
                btnUpdate.disabled = true;
            }

            sessionStorage.removeItem('mz800_update_dismissed');

            // Send SKIP_WAITING to all available targets
            try {
                if (worker) worker.postMessage({ type: 'SKIP_WAITING' });
                if (swRegistration && swRegistration.waiting) {
                    swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
                }
                if (swRegistration && swRegistration.installing) {
                    swRegistration.installing.postMessage({ type: 'SKIP_WAITING' });
                }
            } catch (err) {
                console.warn('[PWA] postMessage error:', err);
            }

            // Guaranteed reload fallback after 300ms
            setTimeout(() => {
                if (!isReloading) {
                    isReloading = true;
                    window.location.reload();
                }
            }, 300);
        };

        if (btnUpdate) {
            btnUpdate.onclick = triggerUpdate;
        }

        if (btnDismiss) {
            btnDismiss.onclick = (e) => {
                e.preventDefault();
                banner.classList.add('hidden');
                sessionStorage.setItem('mz800_update_dismissed', '1');
            };
        }
    }

    /**
     * Configures the "Check for Updates" and "Clear Cache" buttons in toolbar.
     */
    function setupManualControls() {
        const btnCheck = document.getElementById('btn-check-update');
        const btnForce = document.getElementById('btn-force-reload');

        if (btnCheck) {
            btnCheck.addEventListener('click', async () => {
                const originalText = btnCheck.textContent;
                btnCheck.textContent = '⏳ Checking...';
                btnCheck.disabled = true;

                try {
                    if (!swRegistration) {
                        btnCheck.textContent = '✅ Up to Date!';
                        setTimeout(() => {
                            btnCheck.textContent = originalText;
                            btnCheck.disabled = false;
                        }, 2000);
                        return;
                    }

                    await swRegistration.update();

                    setTimeout(() => {
                        if (swRegistration.waiting) {
                            btnCheck.textContent = '⚡ Update Found!';
                            sessionStorage.removeItem('mz800_update_dismissed');
                            showUpdateBanner(swRegistration.waiting);
                            setTimeout(() => {
                                btnCheck.textContent = originalText;
                                btnCheck.disabled = false;
                            }, 2000);
                        } else {
                            btnCheck.textContent = '✅ Up to Date!';
                            setTimeout(() => {
                                btnCheck.textContent = originalText;
                                btnCheck.disabled = false;
                            }, 2000);
                        }
                    }, 600);
                } catch (err) {
                    console.warn('[PWA] Manual check error:', err);
                    btnCheck.textContent = '⚠️ Offline / Error';
                    setTimeout(() => {
                        btnCheck.textContent = originalText;
                        btnCheck.disabled = false;
                    }, 2000);
                }
            });
        }

        if (btnForce) {
            btnForce.addEventListener('click', async () => {
                btnForce.textContent = '🧹 Purging...';
                btnForce.disabled = true;
                await window.mz800ClearCacheAndReload();
            });
        }
    }

    /**
     * Intercepts and captures PWA beforeinstallprompt event.
     */
    function setupInstallPrompt() {
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredInstallPrompt = e;

            const btnInstall = document.getElementById('btn-pwa-install');
            if (btnInstall) {
                btnInstall.style.display = 'inline-flex';
                btnInstall.onclick = async () => {
                    if (deferredInstallPrompt) {
                        deferredInstallPrompt.prompt();
                        const choice = await deferredInstallPrompt.userChoice;
                        console.log('[PWA] User install choice:', choice.outcome);
                        deferredInstallPrompt = null;
                        btnInstall.style.display = 'none';
                    }
                };
            }
        });

        window.addEventListener('appinstalled', () => {
            console.log('[PWA] App successfully installed!');
            const btnInstall = document.getElementById('btn-pwa-install');
            if (btnInstall) btnInstall.style.display = 'none';
        });
    }

    /**
     * Emergency hard cache wipe and reload helper.
     */
    window.mz800ClearCacheAndReload = async function() {
        sessionStorage.removeItem('mz800_update_dismissed');
        try {
            if ('serviceWorker' in navigator) {
                const regs = await navigator.serviceWorker.getRegistrations();
                for (const r of regs) await r.unregister();
            }
            if ('caches' in window) {
                const keys = await caches.keys();
                for (const k of keys) await caches.delete(k);
            }
        } catch (e) {
            console.warn('[PWA] Cache purge error:', e);
        }
        window.location.reload(true);
    };

    initPWA();
})(window);
