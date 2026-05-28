import * as THREE from "three";
import { CombatEntity, AIState, CharacterState } from "./types";
import { CHARACTER_MAP } from "./characterData";
import { findNearestEnemy, triggerMeleeHit, createProjectile, triggerAoeHit, spawnEffect, isEnemy } from "./CombatSystem";
import { Projectile, Effect } from "./types";

const CHASE_RANGE = 22;
const ATTACK_RANGE = 3.5;
const ABILITY_RANGE_MULT = 1.1;
const EVADE_HP_THRESH = 0.25;
const BLOCK_CHANCE = 0.25;

function randomAIVariant(): number {
  return 0.8 + Math.random() * 0.4;
}

export function updateAI(
  entity: CombatEntity,
  entities: Map<string, CombatEntity>,
  projectiles: Map<string, Projectile>,
  effects: Effect[],
  delta: number,
): void {
  if (entity.isDead || entity.isPlayer) return;

  entity.aiTimer += delta;
  entity.aiPathTimer += delta;

  // Decay cooldowns
  for (let i = 0; i < 4; i++) {
    if (entity.abilityCooldowns[i] > 0) entity.abilityCooldowns[i] = Math.max(0, entity.abilityCooldowns[i] - delta);
  }
  if (entity.dashCooldown > 0) entity.dashCooldown = Math.max(0, entity.dashCooldown - delta);

  const target = entity.aiTarget ? entities.get(entity.aiTarget) : null;
  const validTarget = target && !target.isDead && isEnemy(entity, target);

  // Find new target if needed
  if (!validTarget || entity.aiPathTimer > 2.0) {
    const nearest = findNearestEnemy(entity, entities);
    entity.aiTarget = nearest?.id || null;
    entity.aiPathTimer = 0;
  }

  const currentTarget = entity.aiTarget ? entities.get(entity.aiTarget) : null;
  if (!currentTarget || currentTarget.isDead) {
    entity.aiState = "idle";
    entity.state = "idle";
    entity.velocity.x *= 0.85;
    entity.velocity.z *= 0.85;
    return;
  }

  const dist = entity.position.distanceTo(currentTarget.position);
  const hpRatio = entity.health / entity.stats.maxHealth;
  const charDef = CHARACTER_MAP[entity.defId];

  // State transitions
  switch (entity.aiState) {
    case "idle":
      if (dist < CHASE_RANGE) entity.aiState = "chase";
      break;

    case "chase":
      if (dist <= ATTACK_RANGE * ABILITY_RANGE_MULT) {
        entity.aiState = "attack";
        entity.aiTimer = 0;
      } else if (hpRatio < EVADE_HP_THRESH && entity.dashCooldown <= 0) {
        entity.aiState = "evade";
        entity.aiTimer = 0;
      } else if (dist > CHASE_RANGE + 5) {
        entity.aiState = "idle";
      }
      break;

    case "attack":
      if (dist > ATTACK_RANGE * 1.8) {
        entity.aiState = "chase";
      } else if (hpRatio < EVADE_HP_THRESH) {
        entity.aiState = "evade";
      } else if (entity.aiTimer > 3.0 * randomAIVariant()) {
        // Try ability
        const ab = pickAbility(entity, currentTarget, dist);
        if (ab !== -1) {
          entity.aiState = "ability";
          (entity as any)._pendingAbility = ab;
          entity.aiTimer = 0;
        } else {
          entity.aiTimer = 0;
        }
      }
      break;

    case "evade":
      if (hpRatio > 0.45 || entity.aiTimer > 2.5) {
        entity.aiState = "chase";
        entity.aiTimer = 0;
      }
      break;

    case "ability":
      if (entity.aiTimer > 0.4) {
        entity.aiState = "attack";
        entity.aiTimer = 0;
      }
      break;

    case "dead":
      return;
  }

  // Execute state behavior
  const toTarget = currentTarget.position.clone().sub(entity.position);
  toTarget.y = 0;
  const dirNorm = toTarget.length() > 0.01 ? toTarget.clone().normalize() : new THREE.Vector3(1, 0, 0);
  const speed = entity.stats.movementSpeed;

  // Occasionally block incoming attacks
  if (currentTarget.state === "attack" || currentTarget.state === "combo2" || currentTarget.state === "combo3") {
    if (Math.random() < BLOCK_CHANCE && entity.stamina > 20) {
      entity.isBlocking = true;
      entity.stamina -= 5;
    } else {
      entity.isBlocking = false;
    }
  } else {
    entity.isBlocking = false;
  }

  switch (entity.aiState) {
    case "chase": {
      entity.rotation = Math.atan2(dirNorm.x, dirNorm.z);
      entity.velocity.x = dirNorm.x * speed;
      entity.velocity.z = dirNorm.z * speed;
      entity.state = "run";
      break;
    }

    case "attack": {
      entity.rotation = Math.atan2(dirNorm.x, dirNorm.z);
      entity.velocity.x *= 0.7;
      entity.velocity.z *= 0.7;

      const attackInterval = 1.0 / entity.stats.attackSpeed;
      if (entity.attackTimer <= 0 && dist < ATTACK_RANGE * 1.3) {
        entity.attackTimer = attackInterval;
        entity.comboCount = (entity.comboCount + 1) % (charDef?.comboCount || 3);
        const st: CharacterState = entity.comboCount === 0 ? "attack" : entity.comboCount === 1 ? "combo2" : "combo3";
        entity.state = st;
        entity.stateTime = 0;
        triggerMeleeHit(entity, entities, null, effects, ATTACK_RANGE);
        spawnEffect(effects, entity.position.clone().add(new THREE.Vector3(0, 1.2, 0)).addScaledVector(dirNorm, 1.5), "hit_spark", charDef?.color || "#ffcc00", 0.8, 0.3);
      }

      // Move slightly to stay in range
      if (dist > ATTACK_RANGE) {
        entity.velocity.x = dirNorm.x * speed * 0.5;
        entity.velocity.z = dirNorm.z * speed * 0.5;
      }
      break;
    }

    case "evade": {
      // Move away and slightly sideways
      const away = dirNorm.clone().negate();
      const strafe = new THREE.Vector3(-dirNorm.z, 0, dirNorm.x);
      const evadeDir = away.add(strafe.multiplyScalar(0.5)).normalize();
      entity.rotation = Math.atan2(-evadeDir.x, -evadeDir.z);
      entity.velocity.x = evadeDir.x * speed * 1.3;
      entity.velocity.z = evadeDir.z * speed * 1.3;
      entity.state = "run";

      // Use dash to escape
      if (entity.dashCooldown <= 0) {
        entity.dashCooldown = 3.0;
        entity.velocity.addScaledVector(evadeDir, speed * 4);
        entity.velocity.y = 4;
        entity.state = "dash";
        entity.invincible = 0.4;
      }
      break;
    }

    case "ability": {
      entity.rotation = Math.atan2(dirNorm.x, dirNorm.z);
      entity.velocity.x *= 0.5;
      entity.velocity.z *= 0.5;

      const abIdx = (entity as any)._pendingAbility as number;
      if (abIdx !== undefined && charDef && entity.abilityCooldowns[abIdx] <= 0) {
        const ab = charDef.abilities[abIdx];
        if (ab && entity.mana >= ab.manaCost && entity.stamina >= ab.staminaCost) {
          entity.mana -= ab.manaCost;
          entity.stamina = Math.max(0, entity.stamina - ab.staminaCost);
          entity.abilityCooldowns[abIdx] = ab.cooldown;

          const stName = `ability${abIdx + 1}` as CharacterState;
          entity.state = stName;
          entity.stateTime = 0;

          if (ab.type === "projectile" && currentTarget) {
            const dir = currentTarget.position.clone().sub(entity.position).normalize();
            const proj = createProjectile(entity, ab, dir);
            projectiles.set(proj.id, proj);
          } else if (ab.type === "melee") {
            triggerMeleeHit(entity, entities, ab, effects, ab.range);
          } else if (ab.type === "aoe") {
            triggerAoeHit(entity, entities, ab, entity.position.clone(), effects);
            spawnEffect(effects, entity.position.clone(), "aoe_burst", ab.effectColor, ab.effectScale, 0.8);
          } else if (ab.type === "heal" || ab.type === "buff") {
            const healAmt = entity.stats.maxHealth * 0.25;
            entity.health = Math.min(entity.stats.maxHealth, entity.health + healAmt);
            entity.invincible = ab.duration || 2.0;
            spawnEffect(effects, entity.position.clone().add(new THREE.Vector3(0, 1, 0)), "heal_burst", ab.effectColor, 2.0, 0.8);
          }
        }
      }
      break;
    }

    case "idle":
    default:
      entity.velocity.x *= 0.85;
      entity.velocity.z *= 0.85;
      entity.state = "idle";
      // Wander slightly
      if (entity.aiTimer > 3.0) {
        const angle = Math.random() * Math.PI * 2;
        entity.velocity.x = Math.sin(angle) * speed * 0.3;
        entity.velocity.z = Math.cos(angle) * speed * 0.3;
        entity.rotation = angle;
        entity.state = "run";
        entity.aiTimer = 0;
      }
      break;
  }
}

function pickAbility(entity: CombatEntity, target: CombatEntity, dist: number): number {
  const charDef = CHARACTER_MAP[entity.defId];
  if (!charDef) return -1;

  // Try abilities 0-3 in order, pick first available that's in range
  const shuffled = [0, 1, 2, 3].sort(() => Math.random() - 0.5);
  for (const i of shuffled) {
    const ab = charDef.abilities[i];
    if (!ab) continue;
    if (entity.abilityCooldowns[i] > 0) continue;
    if (entity.mana < ab.manaCost) continue;
    if (ab.type === "buff" || ab.type === "heal") {
      if (entity.health / entity.stats.maxHealth < 0.6 || ab.type === "buff") return i;
      continue;
    }
    if (dist <= ab.range * 1.5) return i;
  }
  return -1;
}
