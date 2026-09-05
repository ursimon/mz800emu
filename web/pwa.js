/**
 * pwa.js — Progressive Web App Controller for Sharp MZ-800
 *
 * Handles Service Worker registration with zero-stale caching policy:
 * - updateViaCache: 'none' bypasses HTTP cache on SW updates
 * - Immediate update detection via registration.onupdatefound
 * - Foreground checks on visibilitychange, online, and interval
 * - Interactive Update Banner with SKIP_WAITING signal
 * - Emergency hard cache reset function (window.mz800ClearCacheAndReload)
 * - PWA beforeinstallprompt handler
 */

(function(window) {
    'use strict';

    let swRegistration = null;
    let deferredInstallPrompt = null;

    function initPWA() {
        setupInstallPrompt();

        if (!('serviceWorker' in navigator)) {
            console.log('[PWA] Service Worker not supported in this browser.');
            return;
        }

        window.addEventListener('load', async () => {
            try {
                // Register service worker with updateViaCache: 'none'
                // This guarantees the browser checks the server directly for sw.js changes.
                const registration = await navigator.serviceWorker.register('./sw.js', {
                    updateViaCache: 'none'
                });
                swRegistration = registration;
                console.log('[PWA] ServiceWorker registered with scope:', registration.scope);

                // Check if an updated worker is already waiting to activate
                if (registration.waiting) {
                    showUpdateBanner(registration.waiting);
                }

                // Listen for updates found during registration/lifecycle checks
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    if (!newWorker) return;

                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed') {
                            if (navigator.serviceWorker.controller) {
                                // A new version is installed in the background and waiting!
                                console.log('[PWA] New version ready in background.');
                                showUpdateBanner(newWorker);
                            } else {
                                console.log('[PWA] App shell cached for offline use.');
                            }
                        }
                    });
                });

                // Listen for controller changes (when new SW claims the page)
                let isReloading = false;
                navigator.serviceWorker.addEventListener('controllerchange', () => {
                    if (!isReloading) {
                        isReloading = true;
                        console.log('[PWA] New controller active. Reloading page...');
                        window.location.reload();
                    }
                });

                // Proactively check for updates when returning to the app
                document.addEventListener('visibilitychange', () => {
                    if (document.visibilityState === 'visible' && navigator.onLine) {
                        checkForUpdates(false);
                    }
                });

                // Check when connection restored
                window.addEventListener('online', () => {
                    console.log('[PWA] Connection restored, checking for updates...');
                    checkForUpdates(false);
                });

                // Periodic check every 30 minutes
                setInterval(() => {
                    if (navigator.onLine) {
                        checkForUpdates(false);
                    }
                }, 30 * 60 * 1000);

                // Setup manual toolbar update check
                setupManualUpdateCheck();

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
            if (manual) {
                setTimeout(() => {
                    if (swRegistration.waiting) {
                        showUpdateBanner(swRegistration.waiting);
                    }
                }, 800);
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

        if (btnUpdate) {
            btnUpdate.onclick = () => {
                btnUpdate.textContent = 'Updating...';
                btnUpdate.disabled = true;

                if (worker) {
                    worker.postMessage({ type: 'SKIP_WAITING' });
                } else if (swRegistration && swRegistration.waiting) {
                    swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
                } else {
                    window.location.reload();
                }
            };
        }

        if (btnDismiss) {
            btnDismiss.onclick = () => {
                banner.classList.add('hidden');
            };
        }
    }

    /**
     * Configures the "Check for Updates" button in toolbar / settings.
     */
    function setupManualUpdateCheck() {
        const btnCheck = document.getElementById('btn-check-update');
        if (!btnCheck) return;

        btnCheck.addEventListener('click', async () => {
            const originalText = btnCheck.textContent;
            btnCheck.textContent = '⏳ Checking...';
            btnCheck.disabled = true;

            try {
                await swRegistration.update();

                setTimeout(() => {
                    if (swRegistration.waiting) {
                        btnCheck.textContent = '⚡ Update Found!';
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
                }, 1000);
            } catch (err) {
                console.warn('[PWA] Manual check error:', err);
                btnCheck.textContent = '⚠️ Error / Offline';
                setTimeout(() => {
                    btnCheck.textContent = originalText;
                    btnCheck.disabled = false;
                }, 2000);
            }
        });
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
     * Accessible from devtools or UI failsafe.
     */
    window.mz800ClearCacheAndReload = async function() {
        if ('serviceWorker' in navigator) {
            const regs = await navigator.serviceWorker.getRegistrations();
            for (const r of regs) await r.unregister();
        }
        if ('caches' in window) {
            const keys = await caches.keys();
            for (const k of keys) await caches.delete(k);
        }
        window.location.reload(true);
    };

    initPWA();
})(window);
