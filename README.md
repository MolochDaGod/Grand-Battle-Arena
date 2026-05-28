# Grand Battle Arena

**One Piece 3D Battle Arena** — Battle as 15 iconic characters in an immersive 3D Western arena. Free-for-all or 3v3 crew warfare.

## Features

- **15 Playable Fighters** — Ace, Koby, Jozu, Rob Lucci, Marco, Marine, Mr. 5, Nightmare Luffy, Page One, Ryuma, Sanji, Shiryu, Smoker, Racalvin, Law
- **4 Unique Abilities Per Character** — Projectiles, melee combos, AoE blasts, heals, buffs, and debuffs
- **2 Battle Modes** — Free-For-All (1v6 AI) and 3v3 Crew Warfare
- **Full Combat System** — Combo attacks, blocking, parrying, dashing, jumping, dodge mechanics
- **8-Attribute Stat System** — STR, INT, VIT, DEX, END, WIS, AGI, TAC with 20+ derived stats
- **AI Opponents** — Finite state machine AI with chase, attack, evade, ability, and block behaviors
- **3D Western Arena** — Procedurally generated town with buildings, water tower, barrels, and dead trees
- **Real-time HUD** — HP/MP/Stamina bars, ability cooldowns, kill feed, live leaderboard, damage numbers, screen shake

## Controls

| Key | Action |
|-----|--------|
| WASD | Move |
| Mouse | Camera |
| LMB | Attack combo |
| RMB | Block |
| Space | Jump |
| Shift | Dash / Flash / Teleport |
| 1–4 | Character abilities |
| ESC | Release mouse / Pause |

## Tech Stack

- **React 19** + **Vite 7** — Fast HMR and production builds
- **Three.js** via **@react-three/fiber** + **@react-three/drei** — 3D rendering
- **Tailwind CSS v4** — Utility-first styling
- **TypeScript 5.9** — Full type safety

## Getting Started

```bash
# Clone
git clone https://github.com/MolochDaGod/Grand-Battle-Arena.git
cd Grand-Battle-Arena/artifacts/grudge-warlords

# Install
pnpm install

# Dev
pnpm dev

# Build
pnpm build

# Preview production
pnpm preview
```

## Project Structure

```
artifacts/grudge-warlords/
├── public/models/       # 15 character GLB models
├── src/
│   ├── game/
│   │   ├── GameScene.tsx      # Main 3D scene + game loop
│   │   ├── Character.tsx      # GLB + capsule character rendering
│   │   ├── CombatSystem.ts    # Damage, projectiles, effects
│   │   ├── AIController.ts    # AI finite state machine
│   │   ├── characterData.ts   # 15 character definitions
│   │   ├── stats.ts           # 8-attribute → derived stats
│   │   └── types.ts           # TypeScript interfaces
│   ├── screens/
│   │   ├── MainMenu.tsx       # Title screen + roster preview
│   │   ├── ModeSelect.tsx     # FFA vs 3v3 mode picker
│   │   └── CharacterSelect.tsx # Character picker + stat viewer
│   ├── ui/
│   │   └── HUD.tsx            # In-game overlay (HP, abilities, leaderboard)
│   └── App.tsx                # Screen router
└── vite.config.ts
```

## Architecture

- **Only player loads GLB** — AI opponents use capsule meshes to prevent loading 14+ large models
- **React.lazy for GameScene** — Three.js only initializes when entering a match
- **Procedural Western map** — No heavy map model; fully generated with Three.js geometry
- **Camera-relative movement** — WASD is relative to the over-shoulder camera, Fortnite-style

## Deployment

Deployed on **Vercel** with automatic builds from `main` branch.

## Created By

**Racalvin The Pirate King** — [Grudge Studio](https://grudge-studio.com)

## License

MIT
