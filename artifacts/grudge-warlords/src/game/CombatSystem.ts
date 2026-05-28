import * as THREE from "three";
import { CombatEntity, Projectile, Effect, Ability, Team } from "./types";
import { calcEffectiveDamage } from "./stats";
import { CHARACTER_MAP } from "./characterData";

let nextId = 1000;
export const genId = () => `e${nextId++}`;

export function dealDamage(
  attacker: CombatEntity,
  target: CombatEntity,
  rawDamage: number,
  isMagic: boolean,
  effects: Effect[],
  knockback: number = 0,
  direction?: THREE.Vector3,
): number {
  if (target.isDead || target.invincible > 0) return 0;
  const isBlocked = target.isBlocking && Math.random() * 100 < target.stats.blockChance;
  const dmg = calcEffectiveDamage(rawDamage, attacker.stats, target.stats, isMagic, isBlocked);

  const evadeRoll = Math.random() * 100;
  if (!isBlocked && evadeRoll < target.stats.evasion && target.hitStun <= 0) {
    spawnEffect(effects, target.position.clone(), "evade", "#ffffff", 1.0, 0.4);
    return 0;
  }

  target.health = Math.max(0, target.health - dmg);
  if (knockback > 0 && direction) {
    target.velocity.addScaledVector(direction.normalize(), knockback * 3);
    target.velocity.y = Math.max(target.velocity.y, knockback * 1.5);
  }
  target.hitStun = Math.max(target.hitStun, isBlocked ? 0.15 : 0.35);

  const lifestealHeal = dmg * (attacker.stats.lifesteal / 100);
  if (lifestealHeal > 0) {
    attacker.health = Math.min(attacker.stats.maxHealth, attacker.health + lifestealHeal);
  }

  spawnEffect(effects, target.position.clone().add(new THREE.Vector3(0, 1, 0)), isBlocked ? "block_spark" : "hit_spark", isBlocked ? "#88aaff" : "#ffcc00", 1.5, 0.5);

  if (target.health <= 0 && !target.isDead) {
    target.isDead = true;
    target.state = "dead";
    target.deaths++;
    attacker.kills++;
    spawnEffect(effects, target.position.clone(), "death_burst", CHARACTER_MAP[target.defId]?.color || "#ff4400", 3.0, 1.2);
  }
  return dmg;
}

export function createProjectile(
  owner: CombatEntity,
  ability: Ability,
  direction: THREE.Vector3,
): Projectile {
  const spawnPos = owner.position.clone().add(new THREE.Vector3(0, 1.2, 0)).addScaledVector(direction, 1.2);
  return {
    id: genId(),
    ownerId: owner.id,
    ownerTeam: owner.team,
    position: spawnPos,
    velocity: direction.normalize().clone().multiplyScalar(ability.range * 1.8 + 10),
    damage: ability.damage,
    radius: ability.effectScale * 0.4,
    color: ability.effectColor,
    scale: ability.effectScale * 0.5,
    life: 0,
    maxLife: ability.range / 15 + 0.5,
    hitsLeft: ability.type === "aoe" ? 99 : 1,
    isAoe: ability.type === "aoe",
    aoeRadius: ability.radius || 2,
    type: ability.id,
  };
}

export function triggerMeleeHit(
  attacker: CombatEntity,
  entities: Map<string, CombatEntity>,
  ability: Ability | null,
  effects: Effect[],
  range: number = 3.0,
): void {
  const dmg = ability ? ability.damage : attacker.stats.physicalDamage;
  const isMagic = ability?.type === "aoe" || ability?.id.includes("magic") || false;
  const kb = ability?.knockback || 1.0;
  const dir = new THREE.Vector3(Math.sin(attacker.rotation), 0, Math.cos(attacker.rotation));

  for (const [, target] of entities) {
    if (target.id === attacker.id || target.team === attacker.team || target.isDead) continue;
    const diff = target.position.clone().sub(attacker.position);
    if (diff.length() > range) continue;
    const dot = diff.normalize().dot(dir);
    if (ability?.type === "aoe" || dot > 0.2) {
      dealDamage(attacker, target, dmg, isMagic, effects, kb, dir);
    }
  }
}

export function triggerAoeHit(
  attacker: CombatEntity,
  entities: Map<string, CombatEntity>,
  ability: Ability,
  center: THREE.Vector3,
  effects: Effect[],
): void {
  const radius = ability.radius || 5;
  for (const [, target] of entities) {
    if (target.id === attacker.id || target.team === attacker.team || target.isDead) continue;
    if (target.position.distanceTo(center) <= radius) {
      const dir = target.position.clone().sub(center).normalize();
      dealDamage(attacker, target, ability.damage, true, effects, ability.knockback, dir);
    }
  }
}

export function spawnEffect(effects: Effect[], position: THREE.Vector3, type: string, color: string, scale: number, life: number): void {
  effects.push({ id: genId(), position: position.clone(), type, color, scale, life, maxLife: life });
}

export function updateProjectiles(
  projectiles: Map<string, Projectile>,
  entities: Map<string, CombatEntity>,
  effects: Effect[],
  delta: number,
): void {
  for (const [id, proj] of projectiles) {
    proj.position.addScaledVector(proj.velocity, delta);
    proj.life += delta;
    if (proj.life >= proj.maxLife) { projectiles.delete(id); continue; }

    // Check hits
    for (const [, target] of entities) {
      if (target.isDead || target.team === proj.ownerTeam) continue;
      const dist = target.position.distanceTo(proj.position);
      const hitRadius = proj.isAoe ? proj.aoeRadius : proj.radius + 0.8;
      if (dist < hitRadius) {
        const owner = entities.get(proj.ownerId);
        if (owner) {
          if (proj.isAoe) {
            // already handled elsewhere or handle here
            const dir = target.position.clone().sub(proj.position).normalize();
            dealDamage(owner, target, proj.damage, true, effects, 2, dir);
          } else {
            const dir = proj.velocity.clone().normalize();
            dealDamage(owner, target, proj.damage, false, effects, 2, dir);
          }
        }
        spawnEffect(effects, proj.position.clone(), "impact", proj.color, proj.scale * 1.5, 0.4);
        proj.hitsLeft--;
        if (proj.hitsLeft <= 0) { projectiles.delete(id); break; }
      }
    }
  }
}

export function isEnemy(a: CombatEntity, b: CombatEntity): boolean {
  if (a.team === "none" || b.team === "none") return a.id !== b.id;
  return a.team !== b.team;
}

export function findNearestEnemy(entity: CombatEntity, entities: Map<string, CombatEntity>): CombatEntity | null {
  let nearest: CombatEntity | null = null;
  let minDist = Infinity;
  for (const [, e] of entities) {
    if (e.id === entity.id || !isEnemy(entity, e) || e.isDead) continue;
    const d = e.position.distanceTo(entity.position);
    if (d < minDist) { minDist = d; nearest = e; }
  }
  return nearest;
}

export function respawnEntity(entity: CombatEntity, spawnPoints: THREE.Vector3[]): void {
  const sp = spawnPoints[Math.floor(Math.random() * spawnPoints.length)];
  entity.position.copy(sp);
  entity.velocity.set(0, 0, 0);
  entity.health = entity.stats.maxHealth;
  entity.mana = entity.stats.maxMana;
  entity.stamina = entity.stats.maxStamina;
  entity.isDead = false;
  entity.state = "idle";
  entity.stateTime = 0;
  entity.hitStun = 0;
  entity.invincible = 2.0;
  entity.abilityCooldowns = [0, 0, 0, 0];
  entity.dashCooldown = 0;
  entity.aiState = "idle";
  entity.aiTarget = null;
  entity.deaths++;
}

const SPAWN_POINTS = [
  new THREE.Vector3(10, 0.5, 10),
  new THREE.Vector3(-10, 0.5, 10),
  new THREE.Vector3(10, 0.5, -10),
  new THREE.Vector3(-10, 0.5, -10),
  new THREE.Vector3(20, 0.5, 0),
  new THREE.Vector3(-20, 0.5, 0),
  new THREE.Vector3(0, 0.5, 20),
  new THREE.Vector3(0, 0.5, -20),
];

export function getSpawnPoints(): THREE.Vector3[] {
  return SPAWN_POINTS.map(p => p.clone().add(new THREE.Vector3(
    (Math.random() - 0.5) * 4,
    0,
    (Math.random() - 0.5) * 4,
  )));
}

export function tickRegen(entity: CombatEntity, delta: number): void {
  if (entity.isDead) return;
  const regenMult = entity.buffType === "regen" ? 3 : 1;
  entity.health = Math.min(entity.stats.maxHealth, entity.health + entity.stats.healthRegen * delta * regenMult);
  entity.mana = Math.min(entity.stats.maxMana, entity.mana + entity.stats.manaRegen * delta);
  if (!entity.isBlocking && entity.state !== "attack" && entity.state !== "ability1" && entity.state !== "ability2" && entity.state !== "ability3" && entity.state !== "ability4") {
    entity.stamina = Math.min(entity.stats.maxStamina, entity.stamina + 15 * delta);
  }
}
