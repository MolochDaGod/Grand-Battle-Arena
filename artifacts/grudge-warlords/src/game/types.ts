import * as THREE from "three";

export type GameMode = "ffa" | "3v3";
export type GamePhase = "menu" | "mode_select" | "character_select" | "playing" | "game_over";
export type Team = "player" | "team_a" | "team_b" | "none" | `ai${number}` | string;
export type AIState = "idle" | "chase" | "attack" | "evade" | "ability" | "dead" | "block";
export type CharacterState = "idle" | "run" | "attack" | "combo2" | "combo3" | "ability1" | "ability2" | "ability3" | "ability4" | "block" | "dodge" | "jump" | "hit" | "dead" | "dash";

export interface AttributeSet {
  strength: number;
  intellect: number;
  vitality: number;
  dexterity: number;
  endurance: number;
  wisdom: number;
  agility: number;
  tactics: number;
}

export interface DerivedStats {
  maxHealth: number;
  maxMana: number;
  maxStamina: number;
  physicalDamage: number;
  magicDamage: number;
  physicalDefense: number;
  magicDefense: number;
  blockChance: number;
  blockEffectiveness: number;
  evasion: number;
  critChance: number;
  critDamage: number;
  attackSpeed: number;
  movementSpeed: number;
  healthRegen: number;
  manaRegen: number;
  cooldownReduction: number;
  armorPenetration: number;
  damageReduction: number;
  lifesteal: number;
}

export interface Ability {
  id: string;
  name: string;
  description: string;
  cooldown: number;
  manaCost: number;
  staminaCost: number;
  damage: number;
  range: number;
  type: "melee" | "projectile" | "aoe" | "buff" | "debuff" | "heal";
  effectColor: string;
  effectScale: number;
  castTime: number;
  knockback: number;
  duration?: number;
  radius?: number;
  icon: string;
}

export interface CharacterDef {
  id: string;
  name: string;
  title: string;
  description: string;
  modelFile: string;
  faction: string;
  color: string;
  attributes: AttributeSet;
  abilities: [Ability, Ability, Ability, Ability];
  comboCount: number;
  dashType: "dash" | "flash" | "teleport" | "dodge";
  blockType: "block" | "parry" | "intangible";
  scale: number;
  height: number;
}

export interface CombatEntity {
  id: string;
  defId: string;
  team: Team;
  isPlayer: boolean;
  position: THREE.Vector3;
  rotation: number;
  velocity: THREE.Vector3;
  state: CharacterState;
  stateTime: number;
  health: number;
  mana: number;
  stamina: number;
  stats: DerivedStats;
  abilityCooldowns: [number, number, number, number];
  dashCooldown: number;
  comboCount: number;
  comboTimer: number;
  attackTimer: number;
  blockTimer: number;
  hitStun: number;
  isBlocking: boolean;
  isGrounded: boolean;
  isDead: boolean;
  kills: number;
  deaths: number;
  aiState: AIState;
  aiTarget: string | null;
  aiTimer: number;
  aiPathTimer: number;
  invincible: number;
  buffTimer: number;
  buffType: string | null;
}

export interface Projectile {
  id: string;
  ownerId: string;
  ownerTeam: Team;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  damage: number;
  radius: number;
  color: string;
  scale: number;
  life: number;
  maxLife: number;
  hitsLeft: number;
  isAoe: boolean;
  aoeRadius: number;
  type: string;
}

export interface Effect {
  id: string;
  position: THREE.Vector3;
  type: string;
  color: string;
  scale: number;
  life: number;
  maxLife: number;
  velocity?: THREE.Vector3;
}

export interface GameState {
  phase: GamePhase;
  mode: GameMode;
  playerCharacterId: string;
  teamPlayerCharacterIds: string[];
  score: { teamA: number; teamB: number; player: number };
  timeLeft: number;
  entities: Map<string, CombatEntity>;
  projectiles: Map<string, Projectile>;
  effects: Effect[];
  winner: string | null;
}
