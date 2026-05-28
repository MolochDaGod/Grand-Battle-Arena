import { useRef, useEffect, useMemo, Suspense } from "react";
import { useGLTF, Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { CombatEntity } from "./types";
import { CHARACTER_MAP } from "./characterData";

const ANIM_MAP: Record<string, string[]> = {
  idle:     ["Idle", "idle", "IDLE", "Stand", "Stand.001", "Armature|Idle"],
  run:      ["Run", "run", "Walk", "walk", "Move", "Armature|Run", "Armature|Walk"],
  attack:   ["Attack", "attack", "Attack01", "Attack1", "Normal_Attack", "Slash", "Punch"],
  combo2:   ["Attack02", "Attack2", "Combo2", "attack2"],
  combo3:   ["Attack03", "Attack3", "Combo3"],
  ability1: ["Skill1", "skill1", "Special", "Ability1"],
  ability2: ["Skill2", "skill2", "Ability2"],
  ability3: ["Ultimate", "ultimate", "Skill3"],
  ability4: ["Burst", "skill4", "Ability4"],
  block:    ["Block", "block", "Guard", "guard"],
  dash:     ["Dash", "dash", "Sprint"],
  jump:     ["Jump", "jump", "JumpStart"],
  hit:      ["Hit", "hit", "Damage", "HitReaction"],
  dead:     ["Death", "death", "Die", "KO"],
};

function findAction(actions: Record<string, THREE.AnimationAction | null>, state: string): THREE.AnimationAction | null {
  const names = ANIM_MAP[state] || [];
  for (const n of names) { if (actions[n]) return actions[n]; }
  const allKeys = Object.keys(actions);
  if (allKeys.length === 0) return null;
  const idx = state === "idle" ? 0 : state === "run" ? Math.min(1, allKeys.length - 1) : Math.min(2, allKeys.length - 1);
  return actions[allKeys[idx]] || actions[allKeys[0]];
}

// ─── GLB Character (only for player to save memory) ──────────────────────────

interface GLBModelProps { entity: CombatEntity }

function GLBModel({ entity }: GLBModelProps) {
  const charDef = CHARACTER_MAP[entity.defId];
  const groupRef = useRef<THREE.Group>(null!);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const actionsRef = useRef<Record<string, THREE.AnimationAction | null>>({});
  const currentActionRef = useRef<THREE.AnimationAction | null>(null);
  const lastStateRef = useRef<string>("");

  const { scene, animations } = useGLTF(charDef.modelFile);

  const clonedScene = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        if (Array.isArray(mesh.material)) {
          mesh.material = mesh.material.map((m: THREE.Material) => m.clone());
        } else if (mesh.material) {
          mesh.material = (mesh.material as THREE.Material).clone();
        }
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });
    return clone;
  }, [scene]);

  useEffect(() => {
    if (!clonedScene || animations.length === 0) return;
    const mixer = new THREE.AnimationMixer(clonedScene);
    mixerRef.current = mixer;
    const acts: Record<string, THREE.AnimationAction | null> = {};
    for (const clip of animations) { acts[clip.name] = mixer.clipAction(clip); }
    actionsRef.current = acts;
    const idleAct = findAction(acts, "idle");
    if (idleAct) { idleAct.play(); currentActionRef.current = idleAct; lastStateRef.current = "idle"; }
    return () => { mixer.stopAllAction(); mixer.uncacheRoot(clonedScene); };
  }, [clonedScene, animations]);

  useFrame((_, delta) => {
    mixerRef.current?.update(delta);
    const state = entity.isDead ? "dead" : entity.state;
    if (state !== lastStateRef.current) {
      const newAct = findAction(actionsRef.current, state);
      if (newAct && newAct !== currentActionRef.current) {
        const isLoop = !["attack","combo2","combo3","ability1","ability2","ability3","ability4","hit","dead","dash"].includes(state);
        currentActionRef.current?.fadeOut(0.15);
        newAct.reset().setLoop(isLoop ? THREE.LoopRepeat : THREE.LoopOnce, isLoop ? Infinity : 1);
        newAct.clampWhenFinished = !isLoop;
        newAct.fadeIn(0.15).play();
        currentActionRef.current = newAct;
      }
      lastStateRef.current = state;
    }
  });

  return (
    <group ref={groupRef} scale={charDef.scale}>
      <primitive object={clonedScene} />
    </group>
  );
}

// ─── Capsule Character (for AI — no GLB loading) ─────────────────────────────

function CapsuleCharacter({ entity }: { entity: CombatEntity }) {
  const charDef = CHARACTER_MAP[entity.defId];
  const color = charDef?.color || "#888888";
  const bodyRef = useRef<THREE.Mesh>(null!);

  useFrame(() => {
    if (!bodyRef.current) return;
    const mat = bodyRef.current.material as THREE.MeshStandardMaterial;
    if (entity.hitStun > 0) {
      mat.emissive.set(0xff2222);
      mat.emissiveIntensity = 0.8;
    } else if (entity.buffTimer > 0) {
      mat.emissive.set(color);
      mat.emissiveIntensity = 0.4;
    } else {
      mat.emissive.set(0x000000);
      mat.emissiveIntensity = 0;
    }
    if (entity.isDead) {
      mat.opacity = Math.max(0, (mat.opacity || 1) - 0.005);
      mat.transparent = true;
    }

    // Animate based on state
    const t = Date.now() / 1000;
    const ps = entity.state as string;
    if (ps === "run") {
      bodyRef.current.rotation.x = Math.sin(t * 12) * 0.1;
    } else if (ps === "attack" || ps === "combo2" || ps === "combo3") {
      bodyRef.current.rotation.x = Math.sin(t * 20) * 0.2;
    } else {
      bodyRef.current.rotation.x *= 0.8;
    }
  });

  const h = (charDef?.height || 1.8) * 0.9;
  const isAlly = entity.team === "team_a";
  const teamColor = isAlly ? "#3b82f6" : "#ef4444";

  return (
    <group>
      {/* Body capsule */}
      <mesh ref={bodyRef} position={[0, h * 0.5, 0]} castShadow>
        <capsuleGeometry args={[0.35, h * 0.5, 8, 16]} />
        <meshStandardMaterial color={color} roughness={0.6} metalness={0.3} />
      </mesh>
      {/* Head sphere */}
      <mesh position={[0, h * 1.05, 0]} castShadow>
        <sphereGeometry args={[0.28, 12, 12]} />
        <meshStandardMaterial color={color} roughness={0.5} metalness={0.2} />
      </mesh>
      {/* Team indicator ring */}
      <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.5, 0.65, 16]} />
        <meshBasicMaterial color={teamColor} transparent opacity={0.7} side={THREE.DoubleSide} />
      </mesh>
      {/* Character color accent */}
      <mesh position={[0, h * 0.6, 0]} castShadow>
        <torusGeometry args={[0.38, 0.05, 8, 16]} />
        <meshBasicMaterial color={color} />
      </mesh>
    </group>
  );
}

// ─── HP Bar above head ────────────────────────────────────────────────────────

function HPBar({ entity, height }: { entity: CombatEntity; height: number }) {
  const hpPct = entity.stats.maxHealth > 0 ? entity.health / entity.stats.maxHealth : 0;
  const charDef = CHARACTER_MAP[entity.defId];
  const isAlly = entity.team === "team_a";
  const barColor = isAlly ? "#60a5fa" : "#ef4444";

  return (
    <Html position={[0, height + 0.3, 0]} center distanceFactor={18} style={{ pointerEvents: "none", userSelect: "none" }}>
      <div style={{ width: 64, fontFamily: "sans-serif" }}>
        <div style={{ fontSize: 9, color: "#ddd", textAlign: "center", marginBottom: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {charDef?.name || "?"}
        </div>
        <div style={{ height: 4, background: "rgba(0,0,0,0.7)", borderRadius: 2, overflow: "hidden", border: `1px solid ${barColor}44` }}>
          <div style={{ height: "100%", width: `${hpPct * 100}%`, background: barColor, transition: "width 0.1s", borderRadius: 2 }} />
        </div>
      </div>
    </Html>
  );
}

// ─── Main CharacterModel component ───────────────────────────────────────────

interface Props {
  entity: CombatEntity;
  isPlayer: boolean;
}

export default function CharacterModel({ entity, isPlayer }: Props) {
  const charDef = CHARACTER_MAP[entity.defId];
  const groupRef = useRef<THREE.Group>(null!);

  useFrame(() => {
    if (!groupRef.current) return;
    groupRef.current.position.set(entity.position.x, entity.position.y, entity.position.z);
    groupRef.current.rotation.y = entity.rotation;
  });

  if (!charDef) return null;

  return (
    <group ref={groupRef}>
      {isPlayer ? (
        <Suspense fallback={<CapsuleCharacter entity={entity} />}>
          <GLBModel entity={entity} />
        </Suspense>
      ) : (
        <CapsuleCharacter entity={entity} />
      )}
      {!entity.isDead && <HPBar entity={entity} height={(charDef.height || 1.8) * (isPlayer ? charDef.scale : 1)} />}
      {isPlayer && (
        <pointLight position={[0, 1.5, 0]} color={charDef.color} intensity={2} distance={5} />
      )}
    </group>
  );
}
