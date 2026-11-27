/**
 * Canvas2DInkCelRenderer — High-craft Painterly Ink-Cel Canvas2D Fallback Renderer.
 *
 * Gracefully renders the exact same Supergiant-style comic-ink isometric arena, parallax abyss,
 * Y-sorted entities, flowing crimson cloak, Bezier Boon-tinted slash ribbons, crisp telegraphs,
 * additive dynamic light/bloom glows, and ink-outlined damage numbers whenever WebGL2 is
 * unavailable (e.g. headless software contexts or older GPUs). Never throws!
 */

import type {
  ArenaDoor,
  ArenaObstacle,
  BiomeId,
  EnemyState,
  ProjectileState,
  RenderSettings,
  SimState,
  TelegraphShape,
} from '../contracts/index.js';
import { BIOME_CONSTANTS, PATRON_CONSTANTS } from '../contracts/index.js';
import type { BakedAtlas } from '../assets/ProceduralInkCelAtlas.js';
import {
  getBiomePillarSpriteId,
  getBiomeTileIds,
  getEnemySpriteId,
  getPatronSigilSpriteId,
  getPickupSpriteId,
  getWeaponSpriteId,
} from '../assets/ProceduralInkCelAtlas.js';
import { drawFloatingNumber2D } from '../assets/ProceduralFonts.js';
import type { ParticlesAndDecals, SlashRibbon } from './ParticlesAndDecals.js';
import { MAX_DECALS, MAX_PARTICLES, MAX_SLASH_RIBBONS } from './ParticlesAndDecals.js';
import type { CameraView, RenderBackend } from './GameRenderer.js';

type SortKind = 'obstacle' | 'brazier' | 'door' | 'pickup' | 'bloodstone' | 'enemy' | 'hero' | 'projectile';

interface SortEntry {
  kind: SortKind;
  sortY: number;
  idx: number;
  x: number;
  y: number;
}

const MAX_SORT = 512;

export class Canvas2DInkCelRenderer implements RenderBackend {
  public readonly kind = 'canvas2d' as const;

  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D | null;
  private readonly atlas: BakedAtlas;
  private atlasCanvas: HTMLCanvasElement;

  private viewW = 1;
  private viewH = 1;
  private dpr = 1;
  private drawCalls = 0;

  private readonly sortPool: SortEntry[];
  private sortCount = 0;
  private readonly braziers: { x: number; y: number }[] = [];
  private lastBrazierKey = '';

  constructor(canvas: HTMLCanvasElement, atlas: BakedAtlas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.atlas = atlas;
    this.atlasCanvas = atlas.canvas;
    this.sortPool = new Array<SortEntry>(MAX_SORT);
    for (let i = 0; i < MAX_SORT; i++) {
      this.sortPool[i] = { kind: 'hero', sortY: 0, idx: 0, x: 0, y: 0 };
    }
  }

  public setAtlasCanvas(canvas: HTMLCanvasElement): void {
    this.atlasCanvas = canvas;
  }

  public resize(width: number, height: number, dpr: number): void {
    this.viewW = Math.max(1, Math.floor(width));
    this.viewH = Math.max(1, Math.floor(height));
    this.dpr = Math.max(1, Math.min(2, dpr));
    this.canvas.width = Math.max(1, Math.floor(this.viewW * this.dpr));
    this.canvas.height = Math.max(1, Math.floor(this.viewH * this.dpr));
  }

  private wxToSx(wx: number, cam: CameraView): number {
    return cam.viewW * 0.5 + (wx - cam.camX + cam.shakeX) * cam.zoom;
  }

  private wyToSy(wy: number, wz: number, cam: CameraView): number {
    return cam.viewH * 0.5 + (wy - cam.camY + cam.shakeY) * cam.isoScaleY * cam.zoom - wz * cam.zoom;
  }

  private drawSprite(
    ctx: CanvasRenderingContext2D,
    id: string,
    sx: number,
    sy: number,
    scaleX: number,
    scaleY: number,
    rot = 0,
    alpha = 1
  ): void {
    const rect = this.atlas.sprites.get(id);
    if (!rect) return;
    ctx.save();
    if (alpha < 0.999) ctx.globalAlpha *= alpha;
    ctx.translate(sx, sy);
    if (rot !== 0) ctx.rotate(rot);
    ctx.scale(scaleX, scaleY);
    ctx.drawImage(
      this.atlasCanvas,
      rect.x,
      rect.y,
      rect.w,
      rect.h,
      -rect.w * rect.anchorX,
      -rect.h * rect.anchorY,
      rect.w,
      rect.h
    );
    ctx.restore();
    this.drawCalls++;
  }

  private ensureBraziers(state: SimState): void {
    const b = state.room.bounds;
    const key = `${state.room.biome}:${state.room.depth}:${b.minX}:${b.maxX}:${b.minY}:${b.maxY}`;
    if (key === this.lastBrazierKey) return;
    this.lastBrazierKey = key;
    this.braziers.length = 0;
    const inset = 62;
    this.braziers.push(
      { x: b.minX + inset, y: b.minY + inset },
      { x: b.maxX - inset, y: b.minY + inset },
      { x: b.minX + inset, y: b.maxY - inset },
      { x: b.maxX - inset, y: b.maxY - inset }
    );
  }

  public render(
    state: SimState,
    prevState: SimState | null,
    cam: CameraView,
    vfx: ParticlesAndDecals,
    settings: RenderSettings,
    nowMs: number
  ): number {
    const ctx = this.ctx;
    if (!ctx) return 0;

    this.drawCalls = 0;
    const timeSec = nowMs * 0.001;
    this.ensureBraziers(state);

    ctx.save();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    // 1. Deep Parallax Abyss & Underworld Mist Backdrop
    this.drawAbyssBackdrop(ctx, state.room.biome, cam, timeSec);

    // 2. Isometric Stone Chamber Floor, Cliff Drop, Meander Trim, Pits & Decals
    this.drawChamberFloor(ctx, state, cam, vfx, timeSec);

    // 3. Razor-Sharp Crimson & Gold Combat Telegraphs
    this.drawTelegraphs(ctx, state.room.telegraphs, cam);

    // 4. Y-Sorted Entities, Props, Braziers, Doors, Cloak, Hero, Enemies & Projectiles
    this.drawYSortedWorld(ctx, state, prevState, cam, settings, timeSec);

    // 5. Painterly Bezier Weapon Slash Ribbons & Particles
    this.drawSlashRibbons(ctx, vfx, cam);
    this.drawParticles(ctx, vfx, cam);

    // 6. Additive Dynamic Glows (braziers, hero embers, open doors, bloom halos)
    this.drawAdditiveLights(ctx, state, prevState, cam, timeSec);

    // 7. Atmospheric Vignette & Hit-Flash / Death-Defiance Pulses
    this.drawPostOverlay(ctx, vfx, settings);

    // 8. Crisp Comic-Ink Floating Damage Numbers
    if (settings.showDamageNumbers) {
      for (let i = 0; i < state.floatingNumbers.length; i++) {
        const fn = state.floatingNumbers[i];
        drawFloatingNumber2D(ctx, fn, this.wxToSx(fn.pos.x, cam), this.wyToSy(fn.pos.y, 64, cam));
        this.drawCalls++;
      }
    }

    ctx.restore();
    return this.drawCalls;
  }

  private drawAbyssBackdrop(
    ctx: CanvasRenderingContext2D,
    biome: BiomeId,
    cam: CameraView,
    timeSec: number
  ): void {
    const def = BIOME_CONSTANTS[biome] ?? BIOME_CONSTANTS.obsidian_pit;
    const g = ctx.createLinearGradient(0, 0, 0, this.viewH);
    g.addColorStop(0, def.backdropHex);
    g.addColorStop(0.55, def.floorHex);
    g.addColorStop(1, '#06050b');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.viewW, this.viewH);

    // Parallax abyssal chasm pillars
    ctx.fillStyle = 'rgba(6, 5, 12, 0.58)';
    const offset = (-cam.camX * 0.14) % 190;
    for (let x = offset - 190; x < this.viewW + 190; x += 190) {
      ctx.fillRect(x, this.viewH * 0.18, 62, this.viewH * 0.85);
    }

    // Drifting underworld mist bands
    const mistGrad = ctx.createLinearGradient(0, this.viewH * 0.55, 0, this.viewH);
    mistGrad.addColorStop(0, 'rgba(0,0,0,0)');
    mistGrad.addColorStop(1, def.accentHex);
    ctx.save();
    ctx.globalAlpha = 0.12 + 0.04 * Math.sin(timeSec * 1.4);
    ctx.fillStyle = mistGrad;
    ctx.fillRect(0, this.viewH * 0.55, this.viewW, this.viewH * 0.45);
    ctx.restore();
    this.drawCalls += 3;
  }

  private drawChamberFloor(
    ctx: CanvasRenderingContext2D,
    state: SimState,
    cam: CameraView,
    vfx: ParticlesAndDecals,
    timeSec: number
  ): void {
    const b = state.room.bounds;
    const x0 = this.wxToSx(b.minX, cam);
    const x1 = this.wxToSx(b.maxX, cam);
    const y0 = this.wyToSy(b.minY, 0, cam);
    const y1 = this.wyToSy(b.maxY, 0, cam);

    // Southern 3D cliff face
    const rimRect = this.atlas.sprites.get('prop_chasm_rim');
    if (rimRect) {
      const cliffH = 88 * cam.zoom;
      const segs = Math.max(1, Math.ceil((x1 - x0) / (200 * cam.zoom)));
      const sw = (x1 - x0) / segs;
      for (let i = 0; i < segs; i++) {
        ctx.drawImage(this.atlas.canvas, rimRect.x, rimRect.y, rimRect.w, rimRect.h, x0 + i * sw, y1 - 2, sw + 1, cliffH);
      }
      this.drawCalls += segs;
    }

    // Clip flagstones to chamber floor
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, y0, x1 - x0, y1 - y0);
    ctx.clip();
    ctx.fillStyle = '#0f1619';
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);

    const tileWorldW = 210;
    const tileWorldH = 210;
    const halfW = tileWorldW * 0.5;
    const halfH = tileWorldH * 0.5;
    const tileIds = getBiomeTileIds(state.room.biome);
    const sxScale = (tileWorldW / 252) * cam.zoom;
    const syScale = ((tileWorldH * cam.isoScaleY) / 124) * cam.zoom;

    const startRow = Math.floor(b.minY / halfH) - 1;
    const endRow = Math.ceil(b.maxY / halfH) + 1;
    const startCol = Math.floor(b.minX / tileWorldW) - 1;
    const endCol = Math.ceil(b.maxX / tileWorldW) + 1;

    for (let row = startRow; row <= endRow; row++) {
      const wy = row * halfH;
      const xShift = (row & 1) !== 0 ? halfW : 0;
      for (let col = startCol; col <= endCol; col++) {
        const wx = col * tileWorldW + xShift;
        if (wx + halfW < b.minX || wx - halfW > b.maxX || wy + halfH < b.minY || wy - halfH > b.maxY) {
          continue;
        }
        const hash = Math.abs((col * 73856093) ^ (row * 19349663)) % 13;
        const tileId =
          hash === 0 ? tileIds[3] : hash < 3 ? tileIds[2] : hash % 2 === 0 ? tileIds[0] : tileIds[1];
        this.drawSprite(ctx, tileId, this.wxToSx(wx, cam), this.wyToSy(wy, 0, cam), sxScale, syScale);
      }
    }
    ctx.restore();

    // Greek meander border strip top & bottom + gold ink edges
    const trimRect = this.atlas.sprites.get('trim_meander');
    if (trimRect) {
      const th = 24 * cam.zoom;
      const segs = Math.max(1, Math.ceil((x1 - x0) / (140 * cam.zoom)));
      const sw = (x1 - x0) / segs;
      for (let i = 0; i < segs; i++) {
        ctx.drawImage(this.atlas.canvas, trimRect.x, trimRect.y, trimRect.w, trimRect.h, x0 + i * sw, y0 - th * 0.5, sw + 1, th);
        ctx.drawImage(this.atlas.canvas, trimRect.x, trimRect.y, trimRect.w, trimRect.h, x0 + i * sw, y1 - th * 0.5, sw + 1, th);
      }
      this.drawCalls += segs * 2;
    }
    ctx.strokeStyle = '#d4a348';
    ctx.lineWidth = 4 * cam.zoom;
    ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);

    // Chasm pits (beveled octagonal isometric stone chasms!)
    for (let i = 0; i < state.room.obstacles.length; i++) {
      const obs = state.room.obstacles[i];
      if (obs.kind !== 'pit') continue;
      const cx = this.wxToSx(obs.pos.x, cam);
      const cy = this.wyToSy(obs.pos.y, 0, cam);
      const hw = obs.halfW * cam.zoom;
      const hh = obs.halfH * cam.isoScaleY * cam.zoom;
      const cxOff = hw * 0.36;
      const cyOff = hh * 0.42;
      ctx.beginPath();
      ctx.moveTo(cx - hw + cxOff, cy - hh);
      ctx.lineTo(cx + hw - cxOff, cy - hh);
      ctx.lineTo(cx + hw, cy - hh + cyOff);
      ctx.lineTo(cx + hw, cy + hh - cyOff);
      ctx.lineTo(cx + hw - cxOff, cy + hh);
      ctx.lineTo(cx - hw + cxOff, cy + hh);
      ctx.lineTo(cx - hw, cy + hh - cyOff);
      ctx.lineTo(cx - hw, cy - hh + cyOff);
      ctx.closePath();
      ctx.fillStyle = '#060c0e';
      ctx.fill();
      ctx.strokeStyle = '#08060e';
      ctx.lineWidth = 5 * cam.zoom;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(130, 175, 145, 0.55)';
      ctx.lineWidth = 2 * cam.zoom;
      ctx.stroke();
    }

    // Floor hazards
    for (let i = 0; i < state.room.hazards.length; i++) {
      const h = state.room.hazards[i];
      const sx = this.wxToSx(h.pos.x, cam);
      const sy = this.wyToSy(h.pos.y, 0, cam);
      if (h.kind === 'spike_trap') {
        const id = h.active ? 'prop_spike_active' : h.armed ? 'prop_spike_armed' : 'prop_spike_idle';
        const sc = Math.max(0.72, (h.radius * 2) / 110) * cam.zoom;
        this.drawSprite(ctx, id, sx, sy, sc, sc);
      } else if (h.kind === 'lava_pool' || h.kind === 'poison_pool') {
        ctx.beginPath();
        ctx.ellipse(sx, sy, h.radius * cam.zoom, h.radius * cam.isoScaleY * cam.zoom, 0, 0, Math.PI * 2);
        ctx.fillStyle = h.kind === 'lava_pool' ? 'rgba(255, 92, 24, 0.82)' : 'rgba(138, 218, 44, 0.68)';
        ctx.fill();
        ctx.strokeStyle = '#08060e';
        ctx.lineWidth = 3 * cam.zoom;
        ctx.stroke();
      }
    }

    // Floor decals
    for (let i = 0; i < MAX_DECALS; i++) {
      const d = vfx.decals[i];
      if (!d.active) continue;
      const fade = Math.min(1, d.life / Math.min(2, d.maxLife * 0.35));
      const id = d.kind === 'ichor' ? 'vfx_decal_ichor' : d.kind === 'crack' ? 'vfx_decal_crack' : 'vfx_decal_scorch';
      this.drawSprite(ctx, id, this.wxToSx(d.x, cam), this.wyToSy(d.y, 0, cam), d.scaleX * cam.zoom, d.scaleY * cam.zoom, d.angle, d.alpha * fade);
    }

    void timeSec;
  }

  private drawTelegraphs(
    ctx: CanvasRenderingContext2D,
    telegraphs: readonly TelegraphShape[],
    cam: CameraView
  ): void {
    for (let i = 0; i < telegraphs.length; i++) {
      const t = telegraphs[i];
      const prog = Math.max(0, Math.min(1, t.progress));
      const sx = this.wxToSx(t.pos.x, cam);
      const sy = this.wyToSy(t.pos.y, 0, cam);
      const color = prog > 0.82 ? '#ffd24c' : t.dangerColor || '#ff2e4c';

      ctx.save();
      if (t.kind === 'circle' || t.kind === 'ring') {
        const rx = t.radius * cam.zoom;
        const ry = t.radius * cam.isoScaleY * cam.zoom;
        ctx.beginPath();
        ctx.ellipse(sx, sy, rx, ry, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 36, 68, 0.2)';
        ctx.fill();
        ctx.lineWidth = 3.5 * cam.zoom;
        ctx.strokeStyle = color;
        ctx.stroke();

        ctx.beginPath();
        ctx.ellipse(sx, sy, rx * prog, ry * prog, 0, 0, Math.PI * 2);
        ctx.fillStyle = prog > 0.82 ? 'rgba(255, 212, 76, 0.42)' : 'rgba(255, 42, 76, 0.36)';
        ctx.fill();
      } else if (t.kind === 'cone') {
        const halfArc = ((t.arcDeg ?? 65) * Math.PI) / 360;
        ctx.translate(sx, sy);
        ctx.scale(1, cam.isoScaleY);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, t.radius * cam.zoom, t.angle - halfArc, t.angle + halfArc);
        ctx.closePath();
        ctx.fillStyle = 'rgba(255, 38, 72, 0.22)';
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 3.5 * cam.zoom;
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, t.radius * prog * cam.zoom, t.angle - halfArc, t.angle + halfArc);
        ctx.closePath();
        ctx.fillStyle = 'rgba(255, 76, 86, 0.38)';
        ctx.fill();
      } else {
        const len = t.length ?? t.radius;
        const hw = (t.width ?? 44) * 0.5;
        const c = Math.cos(t.angle);
        const s = Math.sin(t.angle);
        const px = -s * hw;
        const py = c * hw;
        ctx.beginPath();
        ctx.moveTo(this.wxToSx(t.pos.x + px, cam), this.wyToSy(t.pos.y + py, 0, cam));
        ctx.lineTo(this.wxToSx(t.pos.x - px, cam), this.wyToSy(t.pos.y - py, 0, cam));
        ctx.lineTo(this.wxToSx(t.pos.x + c * len - px, cam), this.wyToSy(t.pos.y + s * len - py, 0, cam));
        ctx.lineTo(this.wxToSx(t.pos.x + c * len + px, cam), this.wyToSy(t.pos.y + s * len + py, 0, cam));
        ctx.closePath();
        ctx.fillStyle = 'rgba(255, 38, 72, 0.24)';
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 3 * cam.zoom;
        ctx.stroke();
      }
      ctx.restore();
      this.drawCalls++;
    }
  }

  private pushSort(kind: SortKind, sortY: number, idx: number, x: number, y: number): void {
    if (this.sortCount >= MAX_SORT) return;
    const s = this.sortPool[this.sortCount++];
    s.kind = kind;
    s.sortY = sortY;
    s.idx = idx;
    s.x = x;
    s.y = y;
  }

  private drawYSortedWorld(
    ctx: CanvasRenderingContext2D,
    state: SimState,
    prevState: SimState | null,
    cam: CameraView,
    settings: RenderSettings,
    timeSec: number
  ): void {
    this.sortCount = 0;

    for (let i = 0; i < state.room.obstacles.length; i++) {
      const obs = state.room.obstacles[i];
      if (obs.kind === 'pit') continue;
      this.pushSort('obstacle', obs.pos.y + obs.halfH * 0.4, i, obs.pos.x, obs.pos.y);
    }
    for (let i = 0; i < this.braziers.length; i++) {
      this.pushSort('brazier', this.braziers[i].y, i, this.braziers[i].x, this.braziers[i].y);
    }
    for (let i = 0; i < state.room.doors.length; i++) {
      this.pushSort('door', state.room.doors[i].pos.y - 10, i, state.room.doors[i].pos.x, state.room.doors[i].pos.y);
    }
    for (let i = 0; i < state.room.pickups.length; i++) {
      const pk = state.room.pickups[i];
      if (!pk.collected) this.pushSort('pickup', pk.pos.y, i, pk.pos.x, pk.pos.y);
    }
    for (let i = 0; i < state.room.bloodstones.length; i++) {
      const bs = state.room.bloodstones[i];
      this.pushSort('bloodstone', bs.pos.y, i, bs.pos.x, bs.pos.y);
    }
    for (let i = 0; i < state.enemies.length; i++) {
      const e = state.enemies[i];
      if (e.aiState !== 'dead') {
        const ep = this.interpPos(e.pos, prevState?.enemies.find((p) => p.id === e.id)?.pos ?? null, cam.interpAlpha);
        this.pushSort('enemy', ep.y, i, ep.x, ep.y);
      }
    }
    const heroPos = this.interpPos(state.player.pos, prevState?.player.pos ?? null, cam.interpAlpha);
    this.pushSort('hero', heroPos.y, 0, heroPos.x, heroPos.y);
    for (let i = 0; i < state.projectiles.length; i++) {
      const pr = state.projectiles[i];
      this.pushSort('projectile', pr.pos.y + 8, i, pr.pos.x, pr.pos.y);
    }

    for (let i = 1; i < this.sortCount; i++) {
      const cur = this.sortPool[i];
      let j = i - 1;
      while (j >= 0 && this.sortPool[j].sortY > cur.sortY) {
        this.sortPool[j + 1] = this.sortPool[j];
        j--;
      }
      this.sortPool[j + 1] = cur;
    }

    // Dash ghosts
    for (let i = 0; i < state.player.dashGhosts.length; i++) {
      const g = state.player.dashGhosts[i];
      const flip = Math.cos(g.angle) < -0.15 ? -1 : 1;
      this.drawSprite(
        ctx,
        this.selectHeroPose(g.angle),
        this.wxToSx(g.x, cam),
        this.wyToSy(g.y, 0, cam),
        0.8 * cam.zoom * flip,
        0.8 * cam.zoom,
        0,
        g.alpha * 0.48
      );
    }

    for (let i = 0; i < this.sortCount; i++) {
      const item = this.sortPool[i];
      switch (item.kind) {
        case 'obstacle':
          this.drawObstacle(ctx, state.room.obstacles[item.idx], state.room.biome, cam);
          break;
        case 'brazier':
          this.drawSprite(ctx, 'prop_brazier', this.wxToSx(item.x, cam), this.wyToSy(item.y, 0, cam), 0.72 * cam.zoom, 0.72 * cam.zoom);
          this.drawSprite(
            ctx,
            'vfx_flame_tongue',
            this.wxToSx(item.x, cam),
            this.wyToSy(item.y, 32, cam),
            0.54 * cam.zoom,
            (0.62 + 0.1 * Math.sin(timeSec * 12 + item.idx)) * cam.zoom
          );
          break;
        case 'door':
          this.drawDoor(ctx, state.room.doors[item.idx], cam, timeSec);
          break;
        case 'pickup': {
          const pk = state.room.pickups[item.idx];
          const bob = Math.sin(timeSec * 4 + pk.pos.x * 0.03) * 7 * cam.zoom;
          this.drawSprite(
            ctx,
            getPickupSpriteId(pk.kind, pk.patronId),
            this.wxToSx(pk.pos.x, cam),
            this.wyToSy(pk.pos.y, 28, cam) + bob,
            0.78 * cam.zoom,
            0.78 * cam.zoom
          );
          break;
        }
        case 'bloodstone':
          this.drawSprite(ctx, 'vfx_bloodstone', this.wxToSx(item.x, cam), this.wyToSy(item.y, 14, cam), 0.54 * cam.zoom, 0.54 * cam.zoom);
          break;
        case 'enemy':
          this.drawEnemy(ctx, state.enemies[item.idx], item.x, item.y, cam, settings, timeSec);
          break;
        case 'hero':
          this.drawHero(ctx, state, item.x, item.y, cam, timeSec);
          break;
        case 'projectile':
          this.drawProjectile(ctx, state.projectiles[item.idx], cam);
          break;
      }
    }
  }

  private drawObstacle(ctx: CanvasRenderingContext2D, obs: ArenaObstacle, biome: BiomeId, cam: CameraView): void {
    const sx = this.wxToSx(obs.pos.x, cam);
    const sy = this.wyToSy(obs.pos.y, 0, cam);
    this.drawSprite(ctx, 'vfx_shadow_blob', sx, sy + 4 * cam.zoom, 0.72 * cam.zoom, 0.68 * cam.zoom, 0, 0.75);
    const id =
      obs.kind === 'destructible_urn'
        ? 'prop_urn'
        : obs.kind === 'statue'
          ? 'prop_statue'
          : getBiomePillarSpriteId(biome);
    const sc = (obs.kind === 'destructible_urn' ? 0.74 : 0.88) * cam.zoom;
    this.drawSprite(ctx, id, sx, sy, sc, sc);
  }

  private drawDoor(ctx: CanvasRenderingContext2D, door: ArenaDoor, cam: CameraView, timeSec: number): void {
    const sx = this.wxToSx(door.pos.x, cam);
    const sy = this.wyToSy(door.pos.y, 0, cam);
    this.drawSprite(ctx, door.locked ? 'prop_exit_door_locked' : 'prop_exit_door_open', sx, sy, 0.86 * cam.zoom, 0.86 * cam.zoom);
    const sigilId = door.reward.isBoss
      ? 'vfx_skull_badge'
      : door.reward.patronId
        ? getPatronSigilSpriteId(door.reward.patronId)
        : getPickupSpriteId(door.reward.kind);
    const bob = Math.sin(timeSec * 3.4) * 6 * cam.zoom;
    this.drawSprite(ctx, sigilId, sx, sy - 116 * cam.zoom + bob, 0.74 * cam.zoom, 0.74 * cam.zoom, 0, door.locked ? 0.72 : 1);
  }

  private drawHero(ctx: CanvasRenderingContext2D, state: SimState, wx: number, wy: number, cam: CameraView, timeSec: number): void {
    const p = state.player;
    const sx = this.wxToSx(wx, cam);
    const sy = this.wyToSy(wy, 0, cam);
    const speed = Math.hypot(p.vel.x, p.vel.y);
    const runBob = speed > 40 ? Math.abs(Math.sin(timeSec * 15)) * 6 * cam.zoom : 0;

    this.drawSprite(ctx, 'vfx_shadow_blob', sx, sy, 0.65 * cam.zoom, 0.62 * cam.zoom, 0, 0.78);

    // Flowing crimson cloak tail
    const dirX = speed > 30 ? -p.vel.x / speed : -Math.cos(p.facingAngle);
    const dirY = speed > 30 ? (-p.vel.y / speed) * cam.isoScaleY : -Math.sin(p.facingAngle) * cam.isoScaleY;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(sx - 10 * cam.zoom, sy - 56 * cam.zoom - runBob);
    ctx.quadraticCurveTo(
      sx + dirX * 36 * cam.zoom,
      sy - 30 * cam.zoom + dirY * 22 * cam.zoom,
      sx + dirX * 56 * cam.zoom,
      sy - 8 * cam.zoom + dirY * 32 * cam.zoom
    );
    ctx.lineTo(sx + dirX * 34 * cam.zoom + 16 * cam.zoom, sy - 12 * cam.zoom + dirY * 22 * cam.zoom);
    ctx.lineTo(sx + 10 * cam.zoom, sy - 54 * cam.zoom - runBob);
    ctx.closePath();
    ctx.fillStyle = '#c41e2e';
    ctx.fill();
    ctx.strokeStyle = '#08060e';
    ctx.lineWidth = 3 * cam.zoom;
    ctx.stroke();
    ctx.restore();

    const flip = Math.cos(p.facingAngle) < -0.12 ? -1 : 1;
    this.drawSprite(ctx, this.selectHeroPose(p.facingAngle), sx, sy - runBob, 0.82 * cam.zoom * flip, 0.82 * cam.zoom);

    // Weapon (heroic side poise when idle, dynamic aim swing when attacking!)
    const isSwinging = p.attackTimer > 0;
    const facingLeft = Math.cos(p.facingAngle) < -0.12;
    const wepAngle = isSwinging
      ? p.facingAngle + (p.attackComboStep % 2 === 1 ? -1.1 : 1.1)
      : facingLeft
        ? Math.PI - 0.38
        : 0.38;
    const handX = isSwinging ? sx + Math.cos(p.facingAngle) * 20 * cam.zoom : sx + (facingLeft ? -22 : 22) * cam.zoom;
    const handY = isSwinging
      ? sy - 44 * cam.zoom - runBob + Math.sin(p.facingAngle) * 10 * cam.zoom
      : sy - 36 * cam.zoom - runBob;
    this.drawSprite(
      ctx,
      getWeaponSpriteId(p.weaponId),
      handX,
      handY,
      0.72 * cam.zoom,
      0.72 * cam.zoom * (Math.cos(wepAngle) < 0 ? -1 : 1),
      wepAngle
    );
  }

  private drawEnemy(
    ctx: CanvasRenderingContext2D,
    e: EnemyState,
    wx: number,
    wy: number,
    cam: CameraView,
    settings: RenderSettings,
    timeSec: number
  ): void {
    const sx = this.wxToSx(wx, cam);
    const sy = this.wyToSy(wy, 0, cam);
    const flip = Math.cos(e.facingAngle) < -0.15 ? -1 : 1;
    const scale = e.isBoss ? 0.96 * cam.zoom : Math.max(0.68, (e.radius * 2.5) / 115) * cam.zoom;
    this.drawSprite(ctx, 'vfx_shadow_blob', sx, sy, scale * 0.8, scale * 0.72, 0, 0.75);
    this.drawSprite(
      ctx,
      getEnemySpriteId(e.archetype, e.isBoss),
      sx,
      sy - (e.isBoss ? Math.sin(timeSec * 4) * 5 * cam.zoom : 0),
      scale * flip,
      scale
    );

    if (settings.hitFlash && e.hitFlashTimer > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.beginPath();
      ctx.arc(sx, sy - 46 * cam.zoom, e.radius * cam.zoom, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    if (!e.isBoss && (e.hp < e.maxHp || e.armor > 0) && e.archetype !== 'rattlebones_dummy') {
      const bw = 54 * cam.zoom;
      const bh = 6.5 * cam.zoom;
      const bx = sx - bw * 0.5;
      const by = sy - 98 * cam.zoom;
      ctx.fillStyle = '#09060e';
      ctx.fillRect(bx - 2, by - 2, bw + 4, bh + 4);
      ctx.fillStyle = '#eb2f42';
      ctx.fillRect(bx, by, bw * Math.max(0, e.hp / Math.max(1, e.maxHp)), bh);
      if (e.armor > 0 && e.maxArmor > 0) {
        ctx.fillStyle = '#ffcb38';
        ctx.fillRect(bx, by - 5 * cam.zoom, bw * Math.max(0, e.armor / e.maxArmor), 3.5 * cam.zoom);
      }
    }
  }

  private drawProjectile(ctx: CanvasRenderingContext2D, pr: ProjectileState, cam: CameraView): void {
    const sx = this.wxToSx(pr.pos.x, cam);
    const sy = this.wyToSy(pr.pos.y, 20, cam);
    if (pr.kind === 'cast') {
      this.drawSprite(ctx, 'vfx_bloodstone', sx, sy, 0.54 * cam.zoom, 0.54 * cam.zoom, pr.angle);
    } else if (pr.kind === 'arrow' || pr.kind === 'dart' || pr.kind === 'bullet') {
      this.drawSprite(ctx, 'vfx_projectile_arrow', sx, sy, 0.7 * cam.zoom, 0.7 * cam.zoom, pr.angle);
    } else {
      ctx.beginPath();
      ctx.arc(sx, sy, Math.max(7, pr.radius) * cam.zoom, 0, Math.PI * 2);
      ctx.fillStyle = pr.deflected ? '#6cf4ff' : pr.colorHex || (pr.owner === 'player' ? '#ff5442' : '#ff40ba');
      ctx.fill();
      ctx.strokeStyle = '#08060e';
      ctx.lineWidth = 2.5 * cam.zoom;
      ctx.stroke();
    }
    this.drawCalls++;
  }

  private drawSlashRibbons(ctx: CanvasRenderingContext2D, vfx: ParticlesAndDecals, cam: CameraView): void {
    for (let i = 0; i < MAX_SLASH_RIBBONS; i++) {
      const rb = vfx.ribbons[i];
      if (!rb.active) continue;
      this.drawSingleRibbon2D(ctx, rb, cam);
    }
  }

  private drawSingleRibbon2D(ctx: CanvasRenderingContext2D, rb: SlashRibbon, cam: CameraView): void {
    const prog = 1 - Math.max(0, Math.min(1, rb.life / Math.max(0.001, rb.maxLife)));
    const alpha = Math.pow(1 - prog, 0.7);
    const sx = this.wxToSx(rb.x, cam);
    const sy = this.wyToSy(rb.y, 24, cam);
    const col = `rgba(${Math.round(rb.r * 255)}, ${Math.round(rb.g * 255)}, ${Math.round(rb.b * 255)}, ${alpha})`;
    const core = `rgba(${Math.round(rb.coreR * 255)}, ${Math.round(rb.coreG * 255)}, ${Math.round(rb.coreB * 255)}, ${alpha})`;

    ctx.save();
    ctx.translate(sx, sy);
    ctx.scale(1, cam.isoScaleY);
    if (rb.kind === 'nova' || rb.kind === 'whip') {
      const rad = rb.radius * (0.35 + 0.75 * Math.pow(prog, 0.45)) * cam.zoom;
      ctx.beginPath();
      ctx.arc(0, 0, rad, 0, Math.PI * 2);
      ctx.strokeStyle = '#08060e';
      ctx.lineWidth = (rb.thickness * 0.75 + 8) * cam.zoom;
      ctx.stroke();
      ctx.strokeStyle = col;
      ctx.lineWidth = rb.thickness * 0.65 * cam.zoom;
      ctx.stroke();
      ctx.strokeStyle = core;
      ctx.lineWidth = rb.thickness * 0.25 * cam.zoom;
      ctx.stroke();
    } else {
      const half = rb.arcSpan * 0.5;
      const rad = rb.radius * cam.zoom;
      ctx.beginPath();
      ctx.arc(0, 0, rad, rb.angle - half, rb.angle + half);
      ctx.strokeStyle = '#08060e';
      ctx.lineWidth = (rb.thickness + 8) * (1 - prog * 0.4) * cam.zoom;
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.strokeStyle = col;
      ctx.lineWidth = rb.thickness * (1 - prog * 0.4) * cam.zoom;
      ctx.stroke();
      ctx.strokeStyle = core;
      ctx.lineWidth = rb.thickness * 0.36 * (1 - prog * 0.4) * cam.zoom;
      ctx.stroke();
    }
    ctx.restore();
    this.drawCalls++;
  }

  private drawParticles(ctx: CanvasRenderingContext2D, vfx: ParticlesAndDecals, cam: CameraView): void {
    ctx.save();
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = vfx.particles[i];
      if (!p.active) continue;
      const t = 1 - p.life / Math.max(0.001, p.maxLife);
      const sz = (p.size + (p.endSize - p.size) * t) * cam.zoom;
      const sx = this.wxToSx(p.x, cam);
      const sy = this.wyToSy(p.y, p.z, cam);
      const alpha = p.alpha * (1 - t);
      ctx.globalCompositeOperation = p.emissive > 1.1 ? 'lighter' : 'source-over';
      ctx.fillStyle = `rgba(${Math.round(p.r * 255)}, ${Math.round(p.g * 255)}, ${Math.round(p.b * 255)}, ${alpha})`;
      if (p.kind === 'shockwave' || p.kind === 'deflect_ring') {
        ctx.strokeStyle = ctx.fillStyle;
        ctx.lineWidth = 4 * cam.zoom;
        ctx.beginPath();
        ctx.ellipse(sx, sy, sz, sz * cam.isoScaleY, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(sx, sy, Math.max(2, sz * 0.4), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
    this.drawCalls++;
  }

  private drawAdditiveLights(
    ctx: CanvasRenderingContext2D,
    state: SimState,
    prevState: SimState | null,
    cam: CameraView,
    timeSec: number
  ): void {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < this.braziers.length; i++) {
      const br = this.braziers[i];
      const sx = this.wxToSx(br.x, cam);
      const sy = this.wyToSy(br.y, 26, cam);
      const rad = (135 + 18 * Math.sin(timeSec * 10 + i)) * cam.zoom;
      const g = ctx.createRadialGradient(sx, sy, 4, sx, sy, rad);
      g.addColorStop(0, 'rgba(255, 168, 66, 0.34)');
      g.addColorStop(1, 'rgba(255, 100, 20, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(sx, sy, rad, 0, Math.PI * 2);
      ctx.fill();
    }

    const hp = this.interpPos(state.player.pos, prevState?.player.pos ?? null, cam.interpAlpha);
    const hx = this.wxToSx(hp.x, cam);
    const hy = this.wyToSy(hp.y, 20, cam);
    const hRad = 120 * cam.zoom;
    const hg = ctx.createRadialGradient(hx, hy, 4, hx, hy, hRad);
    hg.addColorStop(0, 'rgba(255, 120, 62, 0.22)');
    hg.addColorStop(1, 'rgba(255, 60, 20, 0)');
    ctx.fillStyle = hg;
    ctx.beginPath();
    ctx.arc(hx, hy, hRad, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    this.drawCalls += 2;
  }

  private drawPostOverlay(ctx: CanvasRenderingContext2D, vfx: ParticlesAndDecals, settings: RenderSettings): void {
    const vig = ctx.createRadialGradient(
      this.viewW * 0.5,
      this.viewH * 0.5,
      this.viewH * 0.25,
      this.viewW * 0.5,
      this.viewH * 0.5,
      Math.hypot(this.viewW, this.viewH) * 0.62
    );
    vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vig.addColorStop(1, 'rgba(6, 4, 12, 0.52)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, this.viewW, this.viewH);

    if (settings.hitFlash && vfx.hitFlashPulse > 0.01) {
      ctx.fillStyle = `rgba(255, 28, 42, ${vfx.hitFlashPulse * 0.26})`;
      ctx.fillRect(0, 0, this.viewW, this.viewH);
    }
    if (vfx.deathDefiancePulse > 0.01) {
      ctx.fillStyle = `rgba(255, 210, 140, ${vfx.deathDefiancePulse * 0.22})`;
      ctx.fillRect(0, 0, this.viewW, this.viewH);
    }
  }

  private interpPos(
    cur: { x: number; y: number },
    prev: { x: number; y: number } | null,
    alpha: number
  ): { x: number; y: number } {
    if (!prev || alpha >= 0.999) return cur;
    const dx = cur.x - prev.x;
    const dy = cur.y - prev.y;
    if (dx * dx + dy * dy > 220 * 220) return cur;
    return { x: prev.x + dx * alpha, y: prev.y + dy * alpha };
  }

  private selectHeroPose(angle: number): string {
    const s = Math.sin(angle);
    const c = Math.abs(Math.cos(angle));
    if (s < -0.78) return 'hero_up';
    if (s > 0.78) return 'hero_down';
    if (c > 0.85) return 'hero_side';
    return s < 0 ? 'hero_diag_up' : 'hero_diag_down';
  }

  public dispose(): void {
    // Canvas2D context requires no manual GPU frees
  }
}
