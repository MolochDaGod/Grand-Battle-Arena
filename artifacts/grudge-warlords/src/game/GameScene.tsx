import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useRef, useEffect, useState, useCallback, useMemo } from "react";
import * as THREE from "three";
import { Sky, useGLTF } from "@react-three/drei";
import { CombatEntity, Projectile, Effect, GameMode, Team } from "./types";
import { CHARACTER_MAP, CHARACTER_DEFS } from "./characterData";
import { calcStats } from "./stats";
import { genId, dealDamage, createProjectile, triggerMeleeHit, triggerAoeHit, spawnEffect, updateProjectiles, tickRegen, respawnEntity, getSpawnPoints } from "./CombatSystem";
import { updateAI } from "./AIController";
import CharacterModel from "./Character";
import HUD from "@/ui/HUD";

export interface HUDState {
  playerHP: number; playerMaxHP: number;
  playerMana: number; playerMaxMana: number;
  playerStamina: number; playerMaxStamina: number;
  playerCharId: string;
  abilityCDs: [number, number, number, number];
  abilityMaxCDs: [number, number, number, number];
  kills: number; deaths: number;
  score: { teamA: number; teamB: number };
  timeLeft: number; isBlocking: boolean;
  mode: GameMode;
  killFeed: Array<{ killer: string; victim: string; time: number }>;
  gameOver: boolean; winner: string | null;
  mouseLocked: boolean;
  respawnTimeLeft: number;
  screenShake: number;
  leaderboard: Array<{ name: string; charId: string; kills: number; deaths: number; isPlayer: boolean }>;
}

const DEFAULT_HUD: HUDState = {
  playerHP: 100, playerMaxHP: 100, playerMana: 100, playerMaxMana: 100,
  playerStamina: 100, playerMaxStamina: 100, playerCharId: "ace",
  abilityCDs: [0, 0, 0, 0], abilityMaxCDs: [5, 8, 12, 20],
  kills: 0, deaths: 0, score: { teamA: 0, teamB: 0 },
  timeLeft: 300, isBlocking: false, mode: "ffa",
  killFeed: [], gameOver: false, winner: null, mouseLocked: false,
  respawnTimeLeft: 0, screenShake: 0, leaderboard: [],
};

function makeEntity(charId: string, team: Team, isPlayer: boolean, spawnPos: THREE.Vector3): CombatEntity {
  const def = CHARACTER_MAP[charId];
  const stats = calcStats(def.attributes);
  return {
    id: genId(), defId: charId, team, isPlayer,
    position: spawnPos.clone(), rotation: 0, velocity: new THREE.Vector3(),
    state: "idle", stateTime: 0,
    health: stats.maxHealth, mana: stats.maxMana, stamina: stats.maxStamina,
    stats, abilityCooldowns: [0, 0, 0, 0], dashCooldown: 0,
    comboCount: 0, comboTimer: 0, attackTimer: 0, blockTimer: 0,
    hitStun: 0, isBlocking: false, isGrounded: true, isDead: false,
    kills: 0, deaths: 0, aiState: "idle", aiTarget: null,
    aiTimer: 0, aiPathTimer: 0, invincible: 0, buffTimer: 0, buffType: null,
  };
}

function pickRandomChars(exclude: string, count: number): string[] {
  const pool = CHARACTER_DEFS.map(c => c.id).filter(id => id !== exclude);
  const out: string[] = [];
  while (out.length < count) {
    const idx = Math.floor(Math.random() * pool.length);
    if (!out.includes(pool[idx])) out.push(pool[idx]);
  }
  return out;
}

// ─── Effects visual rendering ─────────────────────────────────────────────────

const EFFECT_COLORS: Record<string, THREE.Color> = {};
function getColor(hex: string): THREE.Color {
  if (!EFFECT_COLORS[hex]) EFFECT_COLORS[hex] = new THREE.Color(hex);
  return EFFECT_COLORS[hex];
}

function EffectsRenderer({ effectsRef }: { effectsRef: React.MutableRefObject<Effect[]> }) {
  const groupRef = useRef<THREE.Group>(null!);

  useFrame(() => {
    if (!groupRef.current) return;
    const children = groupRef.current.children;
    const effects = effectsRef.current;

    for (let i = children.length - 1; i >= 0; i--) {
      const child = children[i] as THREE.Mesh;
      const eid = (child as any)._eid as string | undefined;
      if (!eid || !effects.find(e => e.id === eid)) {
        groupRef.current.remove(child);
      }
    }

    for (const effect of effects) {
      let mesh = (groupRef.current.getObjectByName(effect.id) as THREE.Mesh) || null;
      if (!mesh) {
        const geo = effect.type.includes("burst") || effect.type === "death_burst" || effect.type === "aoe_burst" || effect.type === "heal_burst"
          ? new THREE.SphereGeometry(1, 8, 8)
          : effect.type === "hit_spark" || effect.type === "block_spark"
          ? new THREE.OctahedronGeometry(0.3, 0)
          : effect.type === "impact"
          ? new THREE.TorusGeometry(0.5, 0.1, 6, 12)
          : new THREE.SphereGeometry(0.4, 6, 6);

        const mat = new THREE.MeshBasicMaterial({
          color: getColor(effect.color),
          transparent: true, opacity: 0.9,
          wireframe: effect.type.includes("burst"),
          side: THREE.DoubleSide,
        });
        mesh = new THREE.Mesh(geo, mat);
        mesh.name = effect.id;
        (mesh as any)._eid = effect.id;
        groupRef.current.add(mesh);
      }

      const t = effect.life / effect.maxLife;
      mesh.position.copy(effect.position);
      const scaleFactor = effect.type.includes("burst") ? 1 + t * 3 : 1 - t * 0.3;
      mesh.scale.setScalar(effect.scale * scaleFactor);
      (mesh.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.85;
      mesh.rotation.x += 0.05;
      mesh.rotation.y += 0.08;
    }
  });

  return <group ref={groupRef} />;
}

function ProjectilesRenderer({ projectilesRef }: { projectilesRef: React.MutableRefObject<Map<string, Projectile>> }) {
  const groupRef = useRef<THREE.Group>(null!);

  useFrame(() => {
    if (!groupRef.current) return;
    const projs = projectilesRef.current;

    const activeIds = new Set(projs.keys());
    for (const child of [...groupRef.current.children]) {
      if (!activeIds.has(child.name)) groupRef.current.remove(child);
    }

    for (const [id, proj] of projs) {
      let mesh = groupRef.current.getObjectByName(id) as THREE.Mesh | null;
      if (!mesh) {
        const geo = proj.isAoe
          ? new THREE.SphereGeometry(proj.scale * 0.6, 8, 8)
          : new THREE.CapsuleGeometry(proj.radius, proj.scale * 0.8, 4, 8);
        const mat = new THREE.MeshBasicMaterial({ color: getColor(proj.color), transparent: true, opacity: 0.9 });
        mesh = new THREE.Mesh(geo, mat);
        mesh.name = id;
        const trail = new THREE.Mesh(
          new THREE.ConeGeometry(proj.radius * 0.6, proj.scale * 1.5, 6),
          new THREE.MeshBasicMaterial({ color: getColor(proj.color), transparent: true, opacity: 0.4 })
        );
        trail.rotation.x = -Math.PI / 2;
        trail.position.z = -proj.scale * 0.8;
        mesh.add(trail);
        groupRef.current.add(mesh);
      }
      mesh.position.copy(proj.position);
      const dir = proj.velocity.clone().normalize();
      if (dir.length() > 0.01) {
        mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
      }
      const lifeRatio = proj.life / proj.maxLife;
      (mesh.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - lifeRatio * 0.3);
      mesh.scale.setScalar(1 - lifeRatio * 0.2);
      mesh.rotation.z += 0.1;
    }
  });

  return <group ref={groupRef} />;
}

function WesternMap() {
  return (
    <group>
      {/* Ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[120, 120, 8, 8]} />
        <meshStandardMaterial color="#c4955a" roughness={0.95} />
      </mesh>
      {/* Dirt road north-south */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} receiveShadow>
        <planeGeometry args={[6, 120]} />
        <meshStandardMaterial color="#a07840" roughness={1} />
      </mesh>
      {/* Dirt road east-west */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} receiveShadow>
        <planeGeometry args={[120, 6]} />
        <meshStandardMaterial color="#a07840" roughness={1} />
      </mesh>
      {/* Buildings - saloon row */}
      {[[-18,0,-22],[-8,0,-22],[2,0,-22],[12,0,-22],[22,0,-22]].map(([x,,z], i) => (
        <group key={`b${i}`} position={[x as number, 0, z as number]}>
          <mesh position={[0, 2.5, 0]} castShadow receiveShadow>
            <boxGeometry args={[7, 5, 6]} />
            <meshStandardMaterial color={["#8B4513","#A0522D","#6B3A10","#7A4520","#905030"][i]} roughness={0.9} />
          </mesh>
          {/* Roof */}
          <mesh position={[0, 5.8, 0]} castShadow>
            <boxGeometry args={[7.5, 1.2, 6.5]} />
            <meshStandardMaterial color="#5C3317" roughness={0.9} />
          </mesh>
          {/* Porch roof */}
          <mesh position={[0, 4.2, 4]} castShadow>
            <boxGeometry args={[7.2, 0.3, 2]} />
            <meshStandardMaterial color="#4A2800" roughness={0.9} />
          </mesh>
        </group>
      ))}
      {/* Buildings - opposite side */}
      {[[-20,0,20],[-8,0,22],[5,0,22],[18,0,22]].map(([x,,z], i) => (
        <group key={`c${i}`} position={[x as number, 0, z as number]}>
          <mesh position={[0, 2.2, 0]} castShadow receiveShadow>
            <boxGeometry args={[6, 4.5, 5]} />
            <meshStandardMaterial color={["#7A4520","#6B3010","#854520","#703515"][i]} roughness={0.9} />
          </mesh>
          <mesh position={[0, 4.8, 0]} castShadow>
            <boxGeometry args={[6.5, 1, 5.5]} />
            <meshStandardMaterial color="#4A2800" roughness={0.9} />
          </mesh>
        </group>
      ))}
      {/* Water tower */}
      <group position={[30, 0, -15]}>
        {[[-1.5,0,-1.5],[1.5,0,-1.5],[-1.5,0,1.5],[1.5,0,1.5]].map(([x,,z], i) => (
          <mesh key={i} position={[x as number, 3, z as number]} castShadow>
            <cylinderGeometry args={[0.1, 0.1, 6, 6]} />
            <meshStandardMaterial color="#5C3317" roughness={0.9} />
          </mesh>
        ))}
        <mesh position={[0, 7, 0]} castShadow>
          <cylinderGeometry args={[1.8, 2, 3, 12]} />
          <meshStandardMaterial color="#5C3317" roughness={0.8} />
        </mesh>
      </group>
      {/* Fence posts */}
      {[-35,-25,-15,-5,5,15,25,35].map((x, i) => (
        <mesh key={`fp${i}`} position={[x, 0.7, -40]} castShadow>
          <boxGeometry args={[0.3, 1.4, 0.3]} />
          <meshStandardMaterial color="#8B6040" roughness={0.9} />
        </mesh>
      ))}
      {/* Fence rails */}
      <mesh position={[0, 1.0, -40]} castShadow>
        <boxGeometry args={[72, 0.15, 0.15]} />
        <meshStandardMaterial color="#8B6040" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.5, -40]} castShadow>
        <boxGeometry args={[72, 0.15, 0.15]} />
        <meshStandardMaterial color="#8B6040" roughness={0.9} />
      </mesh>
      {/* Barrels */}
      {[[-25,0,5],[25,0,5],[-25,0,-10],[30,0,10],[15,0,-30]].map(([x,,z], i) => (
        <mesh key={`barrel${i}`} position={[x as number, 0.5, z as number]} castShadow>
          <cylinderGeometry args={[0.5, 0.5, 1, 10]} />
          <meshStandardMaterial color="#6B4020" roughness={0.9} />
        </mesh>
      ))}
      {/* Crates */}
      {[[-22,0,7],[23,0,7],[17,0,-28],[-28,0,-12]].map(([x,,z], i) => (
        <mesh key={`crate${i}`} position={[x as number, 0.5, z as number]} castShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#8B7040" roughness={0.9} />
        </mesh>
      ))}
      {/* Haybales */}
      {[[-32,0,8],[32,0,-8],[-32,0,-20]].map(([x,,z], i) => (
        <mesh key={`hay${i}`} position={[x as number, 0.6, z as number]} castShadow>
          <cylinderGeometry args={[0.8, 0.8, 1.2, 12]} />
          <meshStandardMaterial color="#D4A017" roughness={1} />
        </mesh>
      ))}
      {/* Well */}
      <group position={[0, 0, -8]}>
        <mesh position={[0, 0.6, 0]} castShadow>
          <cylinderGeometry args={[0.9, 0.9, 1.2, 12]} />
          <meshStandardMaterial color="#8B6040" roughness={0.9} />
        </mesh>
        <mesh position={[0, 1.2, 0]}>
          <torusGeometry args={[0.9, 0.08, 8, 16]} />
          <meshStandardMaterial color="#5C3317" roughness={0.9} />
        </mesh>
      </group>
      {/* Dead trees */}
      {[[-40,0,0],[-38,0,-18],[40,0,15],[38,0,-12]].map(([x,,z], i) => (
        <group key={`tree${i}`} position={[x as number, 0, z as number]}>
          <mesh position={[0, 4, 0]} castShadow>
            <cylinderGeometry args={[0.2, 0.35, 8, 8]} />
            <meshStandardMaterial color="#5C3010" roughness={1} />
          </mesh>
          <mesh position={[1.5, 7, 0]} castShadow>
            <cylinderGeometry args={[0.1, 0.2, 3, 6]} />
            <meshStandardMaterial color="#5C3010" roughness={1} />
          </mesh>
          <mesh position={[-1, 6, 0.5]} castShadow>
            <cylinderGeometry args={[0.08, 0.15, 2.5, 6]} />
            <meshStandardMaterial color="#5C3010" roughness={1} />
          </mesh>
        </group>
      ))}
      {/* Boundary walls (invisible collision guides) */}
      {[
        [0, 1, -50, 100, 2, 1],
        [0, 1,  50, 100, 2, 1],
        [-50, 1, 0, 1, 2, 100],
        [ 50, 1, 0, 1, 2, 100],
      ].map(([x, y, z, w, h, d], i) => (
        <mesh key={`wall${i}`} position={[x as number, y as number, z as number]} visible={false}>
          <boxGeometry args={[w as number, h as number, d as number]} />
          <meshStandardMaterial />
        </mesh>
      ))}
    </group>
  );
}

// ─── Main Game World (inside Canvas) ─────────────────────────────────────────

interface GameWorldProps {
  mode: GameMode;
  playerCharacterId: string;
  onHUDUpdate: (s: HUDState) => void;
}

function GameWorld({ mode, playerCharacterId, onHUDUpdate }: GameWorldProps) {
  const { camera, gl } = useThree();

  const entitiesRef = useRef<Map<string, CombatEntity>>(new Map());
  const projectilesRef = useRef<Map<string, Projectile>>(new Map());
  const effectsRef = useRef<Effect[]>([]);
  const killFeedRef = useRef<Array<{ killer: string; victim: string; time: number }>>([]);
  const playerIdRef = useRef<string>("");
  const spawnPointsRef = useRef<THREE.Vector3[]>(getSpawnPoints());

  const camRef = useRef({ yaw: 0, pitch: 0.45, distance: 7.5, targetYaw: 0, targetPitch: 0.45 });
  const keysRef = useRef(new Set<string>());
  const mouseRef = useRef({ dx: 0, dy: 0, leftDown: false, rightDown: false, locked: false });

  const hudTimerRef = useRef(0);
  const timeRef = useRef(mode === "ffa" ? 300 : 240);
  const gameOverRef = useRef(false);
  const scoreRef = useRef({ teamA: 0, teamB: 0 });
  const prevKillsRef = useRef(new Map<string, number>());
  const respawnTimerRef = useRef(new Map<string, number>());
  const glRef = useRef(gl);
  glRef.current = gl;

  const shakeRef = useRef(0);
  const prevPlayerHPRef = useRef(-1);

  const [entityIds, setEntityIds] = useState<string[]>([]);

  // ── Initialize ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const spawns = getSpawnPoints();
    spawnPointsRef.current = spawns;
    const entities = entitiesRef.current;
    entities.clear();

    if (mode === "ffa") {
      const player = makeEntity(playerCharacterId, "player", true, spawns[0]);
      entities.set(player.id, player);
      playerIdRef.current = player.id;
      const aiChars = pickRandomChars(playerCharacterId, 6);
      aiChars.forEach((charId, i) => {
        const ai = makeEntity(charId, `ai${i}` as Team, false, spawns[i + 1]);
        ai.rotation = Math.random() * Math.PI * 2;
        entities.set(ai.id, ai);
      });
    } else {
      const player = makeEntity(playerCharacterId, "team_a", true, spawns[0]);
      entities.set(player.id, player);
      playerIdRef.current = player.id;
      const allChars = pickRandomChars(playerCharacterId, 5);
      for (let i = 0; i < 2; i++) {
        const ally = makeEntity(allChars[i], "team_a", false, spawns[i + 1]);
        entities.set(ally.id, ally);
      }
      for (let i = 2; i < 5; i++) {
        const enemy = makeEntity(allChars[i], "team_b", false, spawns[i + 1]);
        entities.set(enemy.id, enemy);
      }
    }

    setEntityIds([...entities.keys()]);
  }, [mode, playerCharacterId]);

  // ── Input setup ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const el = glRef.current.domElement;

    const onKeyDown = (e: KeyboardEvent) => { keysRef.current.add(e.code); };
    const onKeyUp = (e: KeyboardEvent) => { keysRef.current.delete(e.code); };
    const onMouseMove = (e: MouseEvent) => {
      if (mouseRef.current.locked) {
        mouseRef.current.dx += e.movementX;
        mouseRef.current.dy += e.movementY;
      }
    };
    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 0) mouseRef.current.leftDown = true;
      if (e.button === 2) mouseRef.current.rightDown = true;
      if (!mouseRef.current.locked) {
        el.requestPointerLock?.();
      }
    };
    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 0) mouseRef.current.leftDown = false;
      if (e.button === 2) mouseRef.current.rightDown = false;
    };
    const onPointerLockChange = () => {
      mouseRef.current.locked = document.pointerLockElement === el;
    };
    const onContextMenu = (e: Event) => e.preventDefault();

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("keyup", onKeyUp);
    document.addEventListener("mousemove", onMouseMove);
    el.addEventListener("mousedown", onMouseDown as EventListener);
    document.addEventListener("mouseup", onMouseUp);
    document.addEventListener("pointerlockchange", onPointerLockChange);
    el.addEventListener("contextmenu", onContextMenu);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("keyup", onKeyUp);
      document.removeEventListener("mousemove", onMouseMove);
      el.removeEventListener("mousedown", onMouseDown as EventListener);
      document.removeEventListener("mouseup", onMouseUp);
      document.removeEventListener("pointerlockchange", onPointerLockChange);
      el.removeEventListener("contextmenu", onContextMenu);
      if (document.pointerLockElement) document.exitPointerLock?.();
    };
  }, []);

  const lastAttackTimeRef = useRef(0);
  const attackQueueRef = useRef(false);

  // Track left mouse click for attack
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (e.button === 0 && mouseRef.current.locked) attackQueueRef.current = true;
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  // ── Game Loop ────────────────────────────────────────────────────────────────
  useFrame((state, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05);
    if (gameOverRef.current) return;

    timeRef.current = Math.max(0, timeRef.current - delta);
    const entities = entitiesRef.current;
    const player = entities.get(playerIdRef.current);
    const charDef = player ? CHARACTER_MAP[player.defId] : null;

    // ── Update effects lifetime ──────────────────────────────────────
    for (let i = effectsRef.current.length - 1; i >= 0; i--) {
      effectsRef.current[i].life = Math.max(0, effectsRef.current[i].life - delta);
      if (effectsRef.current[i].life <= 0) effectsRef.current.splice(i, 1);
    }

    // ── Respawn timers ───────────────────────────────────────────────
    for (const [id, timer] of respawnTimerRef.current) {
      const newTimer = timer - delta;
      if (newTimer <= 0) {
        const e = entities.get(id);
        if (e) {
          respawnEntity(e, spawnPointsRef.current);
          respawnTimerRef.current.delete(id);
        }
      } else {
        respawnTimerRef.current.set(id, newTimer);
      }
    }

    // ── Player input ────────────────────────────────────────────────
    if (player && !player.isDead) {
      const keys = keysRef.current;
      const mouse = mouseRef.current;

      // Camera rotation from mouse
      const sensitivity = 0.003;
      camRef.current.targetYaw -= mouse.dx * sensitivity;
      camRef.current.targetPitch = Math.max(0.1, Math.min(1.0, camRef.current.targetPitch - mouse.dy * sensitivity));
      mouse.dx = 0; mouse.dy = 0;

      // Spring follow
      camRef.current.yaw += (camRef.current.targetYaw - camRef.current.yaw) * 0.25;
      camRef.current.pitch += (camRef.current.targetPitch - camRef.current.pitch) * 0.25;

      // Movement direction (camera-relative)
      const yaw = camRef.current.yaw;
      const fwd = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
      const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
      const moveDir = new THREE.Vector3();
      if (keys.has("KeyW") || keys.has("ArrowUp"))    moveDir.addScaledVector(fwd, 1);
      if (keys.has("KeyS") || keys.has("ArrowDown"))  moveDir.addScaledVector(fwd, -1);
      if (keys.has("KeyA") || keys.has("ArrowLeft"))  moveDir.addScaledVector(right, -1);
      if (keys.has("KeyD") || keys.has("ArrowRight")) moveDir.addScaledVector(right, 1);

      const isMoving = moveDir.lengthSq() > 0.01;
      if (isMoving) {
        moveDir.normalize();
        player.rotation = Math.atan2(moveDir.x, moveDir.z);
      }

      const spd = player.stats.movementSpeed;
      const accel = 60;
      const friction = Math.pow(0.005, delta);

      if (isMoving && !player.isBlocking && player.hitStun <= 0) {
        player.velocity.x += moveDir.x * accel * delta;
        player.velocity.z += moveDir.z * accel * delta;
        const xzSpeed = Math.sqrt(player.velocity.x ** 2 + player.velocity.z ** 2);
        if (xzSpeed > spd) {
          player.velocity.x = (player.velocity.x / xzSpeed) * spd;
          player.velocity.z = (player.velocity.z / xzSpeed) * spd;
        }
      }
      player.velocity.x *= friction;
      player.velocity.z *= friction;

      // Jump
      if (keys.has("Space") && player.isGrounded && player.hitStun <= 0) {
        player.velocity.y = 9;
        player.isGrounded = false;
        player.state = "jump";
        player.stateTime = 0;
        keys.delete("Space");
      }

      // Dash/flash
      if (keys.has("ShiftLeft") && player.dashCooldown <= 0 && player.stamina >= 20 && player.hitStun <= 0) {
        const dashDir = isMoving ? moveDir : fwd;
        const dashMult = charDef?.dashType === "teleport" ? 14 : charDef?.dashType === "flash" ? 12 : 8;
        player.velocity.x = dashDir.x * dashMult;
        player.velocity.z = dashDir.z * dashMult;
        if (charDef?.dashType !== "teleport") player.velocity.y = Math.max(player.velocity.y, 3);
        player.dashCooldown = 3.0;
        player.stamina -= 20;
        player.state = "dash";
        player.stateTime = 0;
        player.invincible = charDef?.dashType === "teleport" ? 0.5 : 0.25;
        spawnEffect(effectsRef.current, player.position.clone(), "dash_trail", charDef?.color || "#ffffff", 1.0, 0.3);
        keys.delete("ShiftLeft");
      }

      // Block (RMB)
      if (mouse.rightDown && player.stamina > 5 && player.hitStun <= 0) {
        player.isBlocking = true;
        player.state = "block";
        player.stamina -= 8 * delta;
        player.velocity.x *= 0.3;
        player.velocity.z *= 0.3;
      } else {
        player.isBlocking = false;
      }

      // Attack (LMB click)
      if (attackQueueRef.current && !player.isBlocking && player.hitStun <= 0) {
        attackQueueRef.current = false;
        const now = state.clock.elapsedTime;
        const timeSinceLast = now - lastAttackTimeRef.current;
        if (timeSinceLast > 0.1 && player.attackTimer <= 0) {
          lastAttackTimeRef.current = now;
          player.comboTimer = timeSinceLast < 1.2 ? player.comboTimer : 0;
          player.comboCount = (player.comboCount + 1) % (charDef?.comboCount || 3);
          const st = player.comboCount === 0 ? "attack" : player.comboCount === 1 ? "combo2" : "combo3";
          player.state = st as typeof player.state;
          player.stateTime = 0;
          player.attackTimer = 0.55 / player.stats.attackSpeed;
          player.stamina -= 5;
          triggerMeleeHit(player, entities, null, effectsRef.current, 3.2);
          const atkDir = new THREE.Vector3(Math.sin(player.rotation), 0, Math.cos(player.rotation));
          spawnEffect(effectsRef.current, player.position.clone().addScaledVector(atkDir, 1.5).add(new THREE.Vector3(0, 1.2, 0)), "hit_spark", charDef?.color || "#ffcc00", 1.2, 0.4);
        }
      }

      // Abilities (1-4)
      const abilityKeys = ["Digit1", "Digit2", "Digit3", "Digit4"];
      for (let i = 0; i < 4; i++) {
        if (keys.has(abilityKeys[i])) {
          keys.delete(abilityKeys[i]);
          const ab = charDef?.abilities[i];
          if (!ab || !player) continue;
          if (player.abilityCooldowns[i] > 0) continue;
          if (player.mana < ab.manaCost || player.stamina < ab.staminaCost) continue;

          player.mana -= ab.manaCost;
          player.stamina = Math.max(0, player.stamina - ab.staminaCost);
          player.abilityCooldowns[i] = ab.cooldown;
          player.state = `ability${i + 1}` as typeof player.state;
          player.stateTime = 0;

          const atkDir = new THREE.Vector3(Math.sin(player.rotation), 0.1, Math.cos(player.rotation)).normalize();

          if (ab.type === "projectile") {
            const proj = createProjectile(player, ab, atkDir);
            projectilesRef.current.set(proj.id, proj);
            spawnEffect(effectsRef.current, player.position.clone().add(new THREE.Vector3(0, 1.2, 0)), "ability_cast", ab.effectColor, ab.effectScale * 0.8, 0.5);
          } else if (ab.type === "melee") {
            triggerMeleeHit(player, entities, ab, effectsRef.current, ab.range);
            spawnEffect(effectsRef.current, player.position.clone().add(new THREE.Vector3(0, 1, 0)).addScaledVector(atkDir, 1.5), "hit_spark", ab.effectColor, ab.effectScale, 0.6);
          } else if (ab.type === "aoe") {
            triggerAoeHit(player, entities, ab, player.position.clone(), effectsRef.current);
            spawnEffect(effectsRef.current, player.position.clone(), "aoe_burst", ab.effectColor, ab.effectScale, 0.9);
          } else if (ab.type === "heal") {
            const amt = player.stats.maxHealth * 0.3;
            player.health = Math.min(player.stats.maxHealth, player.health + amt);
            spawnEffect(effectsRef.current, player.position.clone().add(new THREE.Vector3(0, 1, 0)), "heal_burst", ab.effectColor, ab.effectScale, 1.0);
          } else if (ab.type === "buff") {
            player.buffType = ab.id;
            player.buffTimer = ab.duration || 3;
            player.invincible = Math.max(player.invincible, ab.duration && ab.duration > 1 ? 0.5 : 0);
            spawnEffect(effectsRef.current, player.position.clone(), "aoe_burst", ab.effectColor, ab.effectScale, 0.8);
          }
        }
      }

      // State time-out for action states
      player.stateTime += delta;
      const actionDuration = 0.6 / player.stats.attackSpeed;
      const ps = player.state as string;
      if (["attack", "combo2", "combo3", "ability1", "ability2", "ability3", "ability4", "dash", "hit"].includes(ps)) {
        if (player.stateTime > actionDuration) {
          player.state = isMoving ? "run" : "idle";
          player.stateTime = 0;
        }
      } else if (ps === "jump" && player.isGrounded && player.stateTime > 0.3) {
        player.state = isMoving ? "run" : "idle";
      } else if (!["idle", "run", "block", "dead", "jump", "dash"].includes(ps)) {
        if (!isMoving) player.state = "idle";
        else player.state = "run";
      } else if (isMoving && !player.isBlocking && ps === "idle") {
        player.state = "run";
      } else if (!isMoving && !player.isBlocking && ps === "run") {
        player.state = "idle";
      }
    }

    // ── Update AIs ──────────────────────────────────────────────────
    for (const [, e] of entities) {
      if (!e.isPlayer && !e.isDead) {
        updateAI(e, entities, projectilesRef.current, effectsRef.current, delta);

        // AI state timeout for action states
        e.stateTime += delta;
        const aiActionDuration = 0.65 / e.stats.attackSpeed;
        if (["attack", "combo2", "combo3", "ability1", "ability2", "ability3", "ability4", "hit"].includes(e.state)) {
          if (e.stateTime > aiActionDuration) {
            e.state = "idle";
            e.stateTime = 0;
          }
        }
      }
    }

    // ── Projectiles ─────────────────────────────────────────────────
    updateProjectiles(projectilesRef.current, entities, effectsRef.current, delta);

    // ── Physics ─────────────────────────────────────────────────────
    const GRAVITY = -22;
    const GROUND_Y = 0.1;
    for (const [, e] of entities) {
      if (e.isDead) continue;

      // Gravity
      e.velocity.y += GRAVITY * delta;

      // Apply velocity
      e.position.x += e.velocity.x * delta;
      e.position.y += e.velocity.y * delta;
      e.position.z += e.velocity.z * delta;

      // Ground collision
      if (e.position.y <= GROUND_Y) {
        e.position.y = GROUND_Y;
        e.velocity.y = 0;
        e.isGrounded = true;
      } else {
        e.isGrounded = false;
      }

      // Map boundary
      const BOUND = 45;
      e.position.x = Math.max(-BOUND, Math.min(BOUND, e.position.x));
      e.position.z = Math.max(-BOUND, Math.min(BOUND, e.position.z));

      // Cooldowns
      for (let i = 0; i < 4; i++) if (e.abilityCooldowns[i] > 0) e.abilityCooldowns[i] = Math.max(0, e.abilityCooldowns[i] - delta);
      if (e.dashCooldown > 0) e.dashCooldown = Math.max(0, e.dashCooldown - delta);
      if (e.attackTimer > 0) e.attackTimer = Math.max(0, e.attackTimer - delta);
      if (e.hitStun > 0) {
        e.hitStun = Math.max(0, e.hitStun - delta);
        if (e.hitStun > 0.1 && e.state !== "dead") e.state = "hit";
      }
      if (e.invincible > 0) e.invincible = Math.max(0, e.invincible - delta);
      if (e.buffTimer > 0) { e.buffTimer = Math.max(0, e.buffTimer - delta); if (e.buffTimer <= 0) e.buffType = null; }

      // Regen
      tickRegen(e, delta);

      // Check death -> schedule respawn
      if (e.health <= 0 && !e.isDead) {
        e.isDead = true;
        e.state = "dead";
        if (!respawnTimerRef.current.has(e.id)) {
          respawnTimerRef.current.set(e.id, 5.0);
        }
      }

      // Kill feed
      const prevKills = prevKillsRef.current.get(e.id) || 0;
      if (e.kills > prevKills) {
        const killDiff = e.kills - prevKills;
        for (let k = 0; k < killDiff; k++) {
          // Find who was killed (most recently dead entity that was killed by this entity)
          const victims = [...entities.values()].filter(v => v.isDead && v.id !== e.id);
          const victim = victims[victims.length - 1];
          if (victim) {
            killFeedRef.current.unshift({
              killer: CHARACTER_MAP[e.defId]?.name || "?",
              victim: CHARACTER_MAP[victim.defId]?.name || "?",
              time: state.clock.elapsedTime,
            });
            if (killFeedRef.current.length > 8) killFeedRef.current.pop();
          }
        }
        prevKillsRef.current.set(e.id, e.kills);
      }

      // Score update
      if (mode === "3v3") {
        if (e.kills > (prevKillsRef.current.get(e.id + "_score") || 0)) {
          if (e.team === "team_a") scoreRef.current.teamA += e.kills - (prevKillsRef.current.get(e.id + "_score") || 0);
          else if (e.team === "team_b") scoreRef.current.teamB += e.kills - (prevKillsRef.current.get(e.id + "_score") || 0);
          prevKillsRef.current.set(e.id + "_score", e.kills);
        }
      }
    }

    // ── Screen shake: detect player damage ──────────────────────
    if (player && !player.isDead) {
      if (prevPlayerHPRef.current >= 0 && player.health < prevPlayerHPRef.current) {
        const damagePct = (prevPlayerHPRef.current - player.health) / player.stats.maxHealth;
        shakeRef.current = Math.min(1.0, shakeRef.current + damagePct * 5);
      }
      prevPlayerHPRef.current = player.health;
    }
    shakeRef.current = Math.max(0, shakeRef.current - delta * 4);

    // ── Camera ──────────────────────────────────────────────────────
    if (player && !player.isDead) {
      const { yaw, pitch, distance } = camRef.current;
      const target = player.position.clone().add(new THREE.Vector3(0, 1.6, 0));
      const camOffset = new THREE.Vector3(
        distance * Math.sin(yaw) * Math.cos(pitch),
        distance * Math.sin(pitch),
        distance * Math.cos(yaw) * Math.cos(pitch),
      );
      camera.position.lerp(target.clone().add(camOffset), 0.2);
      camera.lookAt(target);
      if (shakeRef.current > 0.05) {
        const s = shakeRef.current * 0.35;
        camera.position.x += (Math.random() - 0.5) * s;
        camera.position.y += (Math.random() - 0.5) * s * 0.5;
        camera.position.z += (Math.random() - 0.5) * s * 0.3;
      }
    } else if (player && player.isDead) {
      // Slow orbit around death position
      camRef.current.targetYaw += delta * 0.3;
    }

    // ── HUD Update (throttled) ────────────────────────────────────────
    hudTimerRef.current += delta;
    if (hudTimerRef.current > 0.05 && player) {
      hudTimerRef.current = 0;

      // Check game over conditions
      let gameOver = false;
      let winner: string | null = null;
      if (timeRef.current <= 0) {
        gameOver = true;
        if (mode === "ffa") {
          const sorted = [...entities.values()].sort((a, b) => b.kills - a.kills);
          winner = sorted[0]?.isPlayer ? "player" : "ai";
        } else {
          winner = scoreRef.current.teamA >= scoreRef.current.teamB ? "player" : "enemy";
        }
      } else if (mode === "ffa") {
        const alive = [...entities.values()].filter(e => !e.isDead);
        if (alive.length <= 1) {
          gameOver = true;
          winner = alive[0]?.isPlayer ? "player" : "ai";
        }
      } else {
        const teamADead = [...entities.values()].filter(e => e.team === "team_a" && !e.isDead).length === 0;
        const teamBDead = [...entities.values()].filter(e => e.team === "team_b" && !e.isDead).length === 0;
        if (teamADead) { gameOver = true; winner = "enemy"; }
        if (teamBDead) { gameOver = true; winner = "player"; }
      }
      if (gameOver && !gameOverRef.current) gameOverRef.current = true;

      const def = CHARACTER_MAP[player.defId];
      onHUDUpdate({
        playerHP: player.health,
        playerMaxHP: player.stats.maxHealth,
        playerMana: player.mana,
        playerMaxMana: player.stats.maxMana,
        playerStamina: player.stamina,
        playerMaxStamina: player.stats.maxStamina,
        playerCharId: player.defId,
        abilityCDs: [...player.abilityCooldowns] as [number, number, number, number],
        abilityMaxCDs: def ? def.abilities.map(a => a.cooldown) as [number, number, number, number] : [5, 8, 12, 20],
        kills: player.kills,
        deaths: player.deaths,
        score: { ...scoreRef.current },
        timeLeft: timeRef.current,
        isBlocking: player.isBlocking,
        mode,
        killFeed: [...killFeedRef.current].slice(0, 5),
        gameOver: gameOverRef.current,
        winner: gameOverRef.current ? winner : null,
        mouseLocked: mouseRef.current.locked,
        respawnTimeLeft: respawnTimerRef.current.get(playerIdRef.current) || 0,
        screenShake: shakeRef.current,
        leaderboard: [...entities.values()]
          .map(e => ({ name: CHARACTER_MAP[e.defId]?.name || "?", charId: e.defId, kills: e.kills, deaths: e.deaths, isPlayer: e.isPlayer }))
          .sort((a, b) => b.kills - a.kills),
      });
    }
  });

  return (
    <>
      <Sky sunPosition={[100, 50, 50]} rayleigh={0.5} turbidity={6} />
      <ambientLight intensity={0.5} color="#ffe8c0" />
      <directionalLight position={[60, 80, 40]} intensity={1.8} castShadow shadow-mapSize={[2048, 2048]} color="#fff8e0" />
      <directionalLight position={[-40, 20, -20]} intensity={0.4} color="#a0c0ff" />
      <fog attach="fog" args={["#d4b896", 80, 160]} />

      <Suspense fallback={null}>
        <WesternMap />
      </Suspense>

      {/* Ground fallback */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[100, 100, 1, 1]} />
        <meshStandardMaterial color="#c4955a" roughness={0.9} />
      </mesh>

      {/* Character models */}
      <Suspense fallback={null}>
        {entityIds.map(id => {
          const entity = entitiesRef.current.get(id);
          if (!entity) return null;
          return (
            <CharacterModel
              key={id}
              entity={entity}
              isPlayer={entity.isPlayer}
            />
          );
        })}
      </Suspense>

      <EffectsRenderer effectsRef={effectsRef} />
      <ProjectilesRenderer projectilesRef={projectilesRef} />
    </>
  );
}

// ─── Main exported component ──────────────────────────────────────────────────

interface Props {
  mode: GameMode;
  playerCharacterId: string;
  onExit: () => void;
}

export default function GameScene({ mode, playerCharacterId, onExit }: Props) {
  const [hudState, setHudState] = useState<HUDState>({ ...DEFAULT_HUD, playerCharId: playerCharacterId, mode });
  const onHUDUpdate = useCallback((s: HUDState) => setHudState(s), []);

  return (
    <div className="w-full h-full relative" style={{ background: "#0a0a0a" }}>
      <Canvas
        shadows
        gl={{ antialias: true, powerPreference: "high-performance" }}
        camera={{ fov: 60, near: 0.1, far: 300, position: [0, 8, 12] }}
        style={{ position: "absolute", inset: 0 }}
      >
        <Suspense fallback={null}>
          <GameWorld
            mode={mode}
            playerCharacterId={playerCharacterId}
            onHUDUpdate={onHUDUpdate}
          />
        </Suspense>
      </Canvas>

      <HUD state={hudState} onExit={onExit} />
    </div>
  );
}
