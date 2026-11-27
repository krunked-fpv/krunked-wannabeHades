import {
  BIOME_CONSTANTS,
  CONTRACT_VERSION,
  PLAYER_CONSTANTS,
  SIM_CONSTANTS,
  type DebugBridge,
} from './contracts/index.js';

declare global {
  interface Window {
    __KRUNKED_DEBUG__?: DebugBridge;
  }
}

function bootWave0(): void {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement | null;
  if (!canvas) {
    return;
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return;
  }

  const renderBootBanner = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.floor(window.innerWidth * dpr));
    canvas.height = Math.max(1, Math.floor(window.innerHeight * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.fillStyle = BIOME_CONSTANTS.sanctum_hub.backdropHex;
    ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

    ctx.fillStyle = BIOME_CONSTANTS.sanctum_hub.accentHex;
    ctx.font = '700 28px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('KRUNKED WANNABEHADES', window.innerWidth / 2, window.innerHeight / 2 - 12);

    ctx.fillStyle = '#c8bfb5';
    ctx.font = '500 14px system-ui, sans-serif';
    ctx.fillText(
      `Contracts v${CONTRACT_VERSION} | ${SIM_CONSTANTS.simHz}Hz Sim | Speed ${PLAYER_CONSTANTS.speed}`,
      window.innerWidth / 2,
      window.innerHeight / 2 + 18
    );
  };

  renderBootBanner();
  window.addEventListener('resize', renderBootBanner);
}

bootWave0();
