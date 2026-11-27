# Krunked WannabeHades

A fast, deterministic 60Hz isometric action-roguelite built with TypeScript, HTML5 Canvas 2D, and procedural Web Audio. Playable directly in the browser with Keyboard + Mouse, Gamepad (with haptics), or Touch virtual twin-stick controls—zero external assets required.

## Features
- **Deterministic 60Hz Simulation**: Fixed-timestep physics, octagonal hero movement, dash-strikes, backstabs, wall slams, deflects, hitstop, and seeded PRNG.
- **6 Infernal Arms, 24 Aspects, 36 Hammers**: Distinct melee, ranged, shield, and rapid-fire playstyles.
- **10 Patrons & 10 Status Curses**: Boons, rarity scaling, Poms, Duos, Legendaries, and Chaos curses.
- **5 Biomes + Sanctum Hub**: Obsidian Pit, Cinder Mire, Verdant Colosseum, Crypt of Bile, and Frozen Summit with multi-phase bosses.
- **Deep Meta Progression**: 12 paired Mirror talents, 16 Shrine of Punishment vows (Heat), 16 Keepsakes, and optional God Mode.
- **Multi-Modal Input**: Seamless switching across Keyboard+Mouse, Gamepad, and Touch controls, plus 30/60/120 FPS pacing and optional 60Hz classic snap.

## Quick Start

```bash
npm install
npm run play
```

Open `http://127.0.0.1:5173` in your browser.

## Scripts
- `npm run dev` — Start Vite development server
- `npm run play` — Start Vite server bound to `127.0.0.1:5173`
- `npm run typecheck` — Run strict TypeScript typechecking (`tsc --noEmit`)
- `npm run test` — Run Vitest unit & integration tests
- `npm run verify:assets` — Validate asset registry and built-in pack integrity
- `npm run verify:sim` — Run headless deterministic simulation verification
- `npm run verify` — Run full verification suite (`typecheck`, `test`, `verify:assets`, `verify:sim`)
- `npm run build` — Build production static bundle into `dist/`
- `npm run oracle` — Optional local ground-truth check (safely skips if local reference files are absent)
- `npm run extract` — Optional local custom asset pack generator (local-only, never committed)

## Controls
- **Keyboard + Mouse**: `WASD` / Arrows move, `Space` dash, `LMB` / `J` attack, `RMB` / `K` special, `Q` / `L` cast, `F` / `U` Patron Call, `R` reload, `E` interact, `Esc` pause.
- **Gamepad**: Left Stick move, Right Stick aim, `A` dash, `X` attack, `Y` special, `B` cast, `RT` Patron Call, `RB` interact, `Start` pause.
- **Touch**: Dynamic left movement stick + right aim/action cluster (auto-activates on touch input or via Settings).
