# Krunked WannabeHades

A fast, deterministic 60Hz isometric mythic ink-cel action-roguelite built with TypeScript, a 6-pass WebGL2 ink-cel renderer (with automatic Canvas 2D fallback), and a 6-stem Greek-metal Web Audio synthesizer. Ships 100% self-contained in Built-In procedural mode with zero external assets required—playable on Desktop (Keyboard + Mouse), Xbox / Tesla Gamepad (with dual-rumble), and Mobile / Tesla Touchscreens.

## Shipped Highlights
- **Deterministic 60Hz Simulation**: Fixed-timestep movement (`540` speed, `2000` accel, `1000` grip), swept octagonal corner-sliding, pit-crossing `0.21s` Blink Dash with attack-recovery cancel, `0.4s` Dash-Strike, `16s` lodging Bloodstone Casts, `3.0x` Crits, `+50%` Backstabs, `1.0s` Armor-Break stuns, biome Wall-Slams, `3.0x` Deflects, hitstop, and `0.6s` Final-Kill Slow-Mo.
- **Full Arsenal**: **6 Infernal Arms** (Stygian Blade, Eternal Spear, Aegis of Ruin, Heart-Seeking Bow, Twin Gauntlets, Adamant Rail), **24 distinct Aspects**, and **36 Forge Hammers**.
- **Full Pantheon**: **10 Patrons** (Voltaris, Tidebreaker, Aegira, Velouris, Sylvara, Bellum, Bacchion, Glaciera, Veloce, Abyssos), **92 Boons**, **14 Duo Boons**, and **10 Status Curses**.
- **5 Biomes + Sanctum Hub & 8 Multi-Phase Bosses**: Training Courtyard, Obsidian Pit (Warden Malice / Fury / Murder), Cinder Mire (molten lava islands & Bone Leviathan), Verdant Colosseum (regenerating Soul-Eyes & Dual Champions Bull + Spearlord), Crypt of Bile (5-wing hub, poison & curing basins, optional Ferryman secret boss), and Frozen Summit (2-phase Sovereign Lord w/ pillar-blocked Brimstone Beams, plus Extreme Measures 4 3-phase finale).
- **Deep Hub Meta Progression**: 12 paired **Mirror of Dusk** talents (24 A/B sides + full refund), 16 **Shrine of Torment** Heat Vows (`0..64` Heat, Tight Deadline `9m/7m/5m`, EM1–4), 16 **Keepsakes**, Sanctum Codex, and optional **God Mode** (`20% -> 80%` DR).
- **6-Pass WebGL2 Ink-Cel Visuals & 6-Stem Greek-Metal Audio**: 121-sprite `2048×2048` ink-cel atlas, 12 `360×480` 3/4 comic-ink portraits, dynamic lightmap FBO, separable Gaussian bloom, biome color grading, `30/60/120` FPS pacing + optional `60Hz` Classic Snap, 15 adaptive music tracks, and 54 combat SFX.

## Quick Start

```bash
npm install
npm run play
```

Open `http://127.0.0.1:5173` in your browser.

## Omnidevice Controls
- **Keyboard + Mouse**: `WASD` / Arrows move, Mouse aims (inverted 2:1 isometric), `LMB` / `J` Attack, `RMB` / `K` Special, `Space` Dash, `Q` / `L` Cast, `F` / `U` Patron Call, `R` Reload, `E` Interact, `Tab` Codex, `1–4` Hub Quick-Dock, `Esc` Pause, `F9` Playtest Drawer.
- **Xbox / Tesla Gamepad**: Left Stick 360° analog move, Right Stick aim, `X` Attack, `Y` Special, `A` Dash / Confirm, `B` Cast / Back, `RT` Patron Call, `RB` Interact / Next Tab, `LT` Reload, `LB` Codex / Prev Tab, `Start` Pause, `D-Pad` full menu navigation, plus dual-rumble haptics.
- **Mobile & Tesla Transparent Touch**: Touch controls stay **100% invisible on desktop** and automatically appear as translucent glass-ink rings only on touch input (or when set to `Always` in Options), hiding automatically when keyboard, mouse, or gamepad resumes. Dynamic floating left thumbstick + ergonomic right `ATK / DASH / SPC / CAST / USE / CALL` arc with `>= 48px` tap targets.

## Dual-Mode Art Packs (Built-In vs. Optional Local Custom Pack)
- **Built-In Mode (Default)**: Ships zero external binaries; renders full procedural comic-ink atlases, portraits, and Web Audio synthesis everywhere (including GitHub Pages).
- **Optional Local Custom Pack**:
  - Developers with a compatible local install can run `npm run extract` to generate a gitignored local pack in `.wannabehades-assets/` (strictly read-only, never committed). `vite dev` / `vite preview` auto-serves `/.wannabehades-assets/*`.
  - In any browser, click **LOAD CUSTOM PACK** on the Title or Options screen to select a local pack folder (`manifest.json` + PNG sheets). Packs are validated, stored locally in `IndexedDB`, and hot-swapped live between `BUILT-IN` and `CUSTOM_PACK`.

## NPM Scripts
- `npm run dev` — Start Vite development server
- `npm run play` — Start Vite server at `http://127.0.0.1:5173`
- `npm run typecheck` — Strict TypeScript check (`tsc --noEmit`)
- `npm run test` — Run 112 Vitest unit & integration tests
- `npm run verify:assets` — Gate A: asset manifest, oracle parity, sim purity, and IP hygiene checks
- `npm run verify:sim` — Gate B: headless 5-biome soak, EM4 Sovereign Lord, 6-weapon, and determinism checks
- `npm run verify` — Run full verification pipeline (`typecheck`, `test`, `verify:assets`, `verify:sim`)
- `npm run build` — Build production static bundle into `dist/`
- `npm run oracle` — Optional read-only local ground-truth check (exits `0` cleanly when absent)
- `npm run extract` — Optional local custom pack generator (exits `0` cleanly when absent)
