import { AttributeSet, DerivedStats } from "./types";

const BASE = {
  health: 250, mana: 100, stamina: 100,
  damage: 0, defense: 0, block: 0, blockEffect: 0,
  evasion: 0, accuracy: 0, critChance: 0, critDamage: 0,
  attackSpeed: 0, movementSpeed: 0, resistance: 0,
  drainHealth: 0, manaRegen: 0, healthRegen: 0,
  cooldownReduction: 0, abilityCost: 0, armorPenetration: 0,
  damageReduction: 0, armor: 0, stamina_: 100,
};

export function calcStats(attr: AttributeSet): DerivedStats {
  let hp = BASE.health;
  let mana = BASE.mana;
  let stam = BASE.stamina;
  let physDmg = 0;
  let magDmg = 0;
  let physDef = 0;
  let magDef = 0;
  let blk = 0;
  let blkEff = 0;
  let eva = 0;
  let crit = 0;
  let critDmg = 0;
  let atkSpd = 0;
  let mvSpd = 0;
  let hpReg = 0;
  let mnReg = 0;
  let cdr = 0;
  let arPen = 0;
  let dmgRed = 0;
  let lifesteal = 0;

  const s = attr.strength;
  const i = attr.intellect;
  const v = attr.vitality;
  const d = attr.dexterity;
  const e = attr.endurance;
  const w = attr.wisdom;
  const a = attr.agility;
  const t = attr.tactics;

  hp += s * 5 + v * 25 + e * 8 + w * 4 + d * 3 + a * 3 + t * 3 + i * 3;
  mana += i * 9 + w * 6 + t * 1.5 + e * 1 + v * 1.5;
  stam += e * 6 + t * 3 + a * 1 + d * 0.6 + s * 0.8 + w * 0.5;
  physDmg = s * 1.25 + d * 0.9 + t * 0.4 + a * 0.3;
  magDmg = i * 1.5 + t * 0.4;
  physDef = s * 4 + e * 5 + d * 1.2 + t * 1 + v * 1.5;
  magDef = i * 2 + w * 5.5;
  blk = s * 0.2 + e * 0.12;
  blkEff = e * 0.175;
  eva = d * 0.125 + a * 0.225 + w * 0;
  crit = d * 0.3;
  critDmg = d * 0.2;
  atkSpd = d * 0.2 + a * 0.05;
  mvSpd = a * 0.15 + d * 0.08;
  hpReg = v * 0.06 + s * 0.02 + e * 0.02;
  mnReg = i * 0.04;
  cdr = i * 0.075 + t * 0.05;
  arPen = t * 0.2;
  dmgRed = v * 0.04 + w * 0.03 + s * 0.02;
  lifesteal = s * 0.075;

  if (t > 0) {
    const tb = t * 0.5;
    physDmg *= (1 + tb / 100);
    magDmg *= (1 + tb / 100);
    atkSpd *= (1 + tb / 100);
    mvSpd *= (1 + tb / 100);
    crit *= (1 + tb / 100);
  }

  const baseSpeed = 4.5;
  const baseDmg = 15;

  return {
    maxHealth: Math.floor(hp),
    maxMana: Math.floor(mana),
    maxStamina: Math.floor(stam),
    physicalDamage: Math.floor(baseDmg + physDmg),
    magicDamage: Math.floor(baseDmg + magDmg),
    physicalDefense: Math.floor(physDef),
    magicDefense: Math.floor(magDef),
    blockChance: Math.min(75, blk),
    blockEffectiveness: Math.min(85, blkEff + 15),
    evasion: Math.min(60, eva),
    critChance: Math.min(80, crit),
    critDamage: 150 + critDmg,
    attackSpeed: 1 + atkSpd / 100,
    movementSpeed: baseSpeed + mvSpd,
    healthRegen: hpReg,
    manaRegen: mnReg,
    cooldownReduction: Math.min(50, cdr),
    armorPenetration: arPen,
    damageReduction: Math.min(50, dmgRed),
    lifesteal,
  };
}

export function calcEffectiveDamage(
  raw: number,
  attacker: DerivedStats,
  defender: DerivedStats,
  isMagic: boolean,
  isBlocked: boolean,
): number {
  const def = isMagic ? defender.magicDefense : defender.physicalDefense;
  const pen = attacker.armorPenetration;
  const effDef = Math.max(0, def * (1 - pen / 100));
  let dmg = raw * (100 / (100 + effDef));
  dmg *= (1 - defender.damageReduction / 100);
  if (isBlocked) {
    dmg *= (1 - defender.blockEffectiveness / 100);
  }
  const isCrit = Math.random() * 100 < attacker.critChance;
  if (isCrit) dmg *= attacker.critDamage / 100;
  return Math.max(1, Math.floor(dmg));
}
