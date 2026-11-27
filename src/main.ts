/**
 * Krunked WannabeHades — Browser Entrypoint
 */

import { GameApp } from './app/GameApp.js';

let activeApp: GameApp | null = null;

function boot(): void {
  if (activeApp) return;
  activeApp = new GameApp();
  activeApp.start();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    activeApp?.dispose();
    activeApp = null;
  });
}
