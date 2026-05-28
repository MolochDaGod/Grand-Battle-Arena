# Grudge Warlords

A full 3D One Piece battle arena game built with React Three Fiber. Fight as 14 iconic characters in a procedural Western town arena — FFA or 3v3 team mode with AI opponents.

## Run & Operate

- `pnpm --filter @workspace/grudge-warlords run dev` — run the game (port 19276, proxy → 80)
- `pnpm --filter @workspace/grudge-warlords run typecheck` — typecheck the game
- Do NOT call `restart_workflow` multiple times in rapid succession — this causes exit 137 by killing the previous instance before Vite stabilizes

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- React 18 + Vite 7
- @react-three/fiber v9 + @react-three/drei v10 + three v0.184
- Tailwind CSS v4

## Where things live

- `artifacts/grudge-warlords/` — the game artifact
  - `src/game/` — core game systems (GameScene, Character, CombatSystem, AIController, types, stats, characterData)
  - `src/ui/` — HUD (in-game overlay)
  - `src/screens/` — UI screens (MainMenu, ModeSelect, CharacterSelect)
  - `src/App.tsx` — top-level screen router with React.lazy for GameScene
  - `public/models/` — 14 character GLB models
  - `vite.config.ts` — Vite config with manual chunks for three.js

## Architecture decisions

- **Only player loads GLB**: AI opponents use capsule meshes. Prevents loading 14+ large GLB files simultaneously.
- **No useGLTF.preload**: Removed all preload calls to avoid parallel loading of 41MB+ of models at startup.
- **React.lazy for GameScene**: Three.js only initialises when the player starts a game, not on the main menu.
- **Procedural Western map**: Replaced the 41MB WesternMap.glb with a fully procedural Three.js scene.
- **`strictPort: false` in Vite**: Allows Vite to recover gracefully if port 19276 is transiently occupied on restart.
- **Port 19276 → external 80**: The `.replit` proxy maps localPort 19276 to externalPort 80. The "Grudge Warlords" workflow on port 5173 conflicts with this — never configure a secondary workflow on 5173 or any other port.

## Product

- Main menu with animated canvas background
- Mode select: Free-For-All or 3v3 Team Battle
- Character select: 14 One Piece characters with full stats (8 attributes, 8 derived stats), 4 abilities each
- 3D Western arena built from procedural geometry
- WASD + mouse FPS-style camera and movement
- LMB combo attacks, RMB block, Space jump, Shift dash
- 1-4 hotkeys for character abilities (projectile, melee, AOE, heal/buff)
- AI opponents with chase/attack/evade/ability FSM
- HUD: HP/MP/Stamina bars, timer, kill feed, ability cooldowns
- Victory/defeat screen with K/D stats

## Characters (14 total)

Luffy, Zoro, Nami, Usopp, Sanji, Chopper, Robin, Franky, Brook, Ace, Whitebeard, Shanks, Law, Hancock

## User preferences

- No Replit banner/cartographer/error-modal plugins in Vite config
- NODE_OPTIONS=--max-old-space-size=512 in dev script

## Gotchas

- Calling restart_workflow N times kills the previous instance via SIGKILL (exit 137) each time — call it once and wait
- Port 5173 is NOT wired in the Replit proxy; only port 19276 maps to external 80
- `configureWorkflow` on port 5173 will fail the health check (proxy returns 502 for that port)

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
