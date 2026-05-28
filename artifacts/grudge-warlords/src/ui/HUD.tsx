import { useEffect, useRef, useState } from "react";
import { HUDState } from "@/game/GameScene";
import { CHARACTER_MAP } from "@/game/characterData";

interface Props {
  state: HUDState;
  onExit: () => void;
}

function requestMouseLock() {
  const canvas = document.querySelector("canvas");
  canvas?.requestPointerLock?.();
}

// ── Crosshair ─────────────────────────────────────────────────────────────────
function Crosshair() {
  return (
    <div className="crosshair">
      {/* top */}
      <div className="crosshair-line" style={{ width: 2, height: 8, top: -14, left: -1 }} />
      {/* bottom */}
      <div className="crosshair-line" style={{ width: 2, height: 8, top: 6, left: -1 }} />
      {/* left */}
      <div className="crosshair-line" style={{ width: 8, height: 2, top: -1, left: -14 }} />
      {/* right */}
      <div className="crosshair-line" style={{ width: 8, height: 2, top: -1, left: 6 }} />
      <div className="crosshair-dot" />
    </div>
  );
}

export default function HUD({ state, onExit }: Props) {
  const char = CHARACTER_MAP[state.playerCharId];
  const abilities = char?.abilities || [];

  // ── Derived ──────────────────────────────────────────────────────────────────
  const hpPct = state.playerMaxHP > 0 ? (state.playerHP / state.playerMaxHP) * 100 : 0;
  const mpPct = state.playerMaxMana > 0 ? (state.playerMana / state.playerMaxMana) * 100 : 0;
  const stPct = state.playerMaxStamina > 0 ? (state.playerStamina / state.playerMaxStamina) * 100 : 0;
  const hpColor = hpPct > 60 ? "#22c55e" : hpPct > 30 ? "#f59e0b" : "#ef4444";
  const mins = Math.floor(state.timeLeft / 60);
  const secs = Math.floor(state.timeLeft % 60);
  const isLowTime = state.timeLeft < 30;

  // ── Ability ready flash ───────────────────────────────────────────────────────
  const prevCDsRef = useRef<[number, number, number, number]>([0, 0, 0, 0]);
  const [readyFlash, setReadyFlash] = useState([false, false, false, false]);

  useEffect(() => {
    const newFlash = [false, false, false, false];
    state.abilityCDs.forEach((cd, i) => {
      if (prevCDsRef.current[i] > 0.1 && cd <= 0) newFlash[i] = true;
    });
    prevCDsRef.current = [...state.abilityCDs] as [number, number, number, number];
    let t: ReturnType<typeof setTimeout> | undefined;
    if (newFlash.some(Boolean)) {
      setReadyFlash(newFlash);
      t = setTimeout(() => setReadyFlash([false, false, false, false]), 750);
    }
    return () => { if (t !== undefined) clearTimeout(t); };
  }, [state.abilityCDs]);

  // ── Hit vignette flash ────────────────────────────────────────────────────────
  const [showVignette, setShowVignette] = useState(false);
  const vignetteKeyRef = useRef(0);
  const prevShakeRef = useRef(0);

  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    if (state.screenShake > 0.15 && prevShakeRef.current <= 0.15) {
      vignetteKeyRef.current++;
      setShowVignette(true);
      t = setTimeout(() => setShowVignette(false), 500);
    }
    prevShakeRef.current = state.screenShake;
    return () => { if (t !== undefined) clearTimeout(t); };
  }, [state.screenShake]);

  // ── Floating damage numbers ───────────────────────────────────────────────────
  const [floats, setFloats] = useState<Array<{ id: number; amount: number; x: number; big: boolean }>>([]);
  const prevHPRef = useRef(state.playerHP);
  const floatIdRef = useRef(0);

  useEffect(() => {
    const diff = prevHPRef.current - state.playerHP;
    prevHPRef.current = state.playerHP;
    let t: ReturnType<typeof setTimeout> | undefined;
    if (diff > 1) {
      const id = ++floatIdRef.current;
      const big = diff > state.playerMaxHP * 0.12;
      setFloats(prev => [
        ...prev,
        { id, amount: Math.round(diff), x: 90 + (Math.random() - 0.5) * 60, big },
      ]);
      t = setTimeout(() => setFloats(prev => prev.filter(f => f.id !== id)), 1000);
    }
    return () => { if (t !== undefined) clearTimeout(t); };
  }, [state.playerHP, state.playerMaxHP]);

  // ── Game Over: leaderboard ────────────────────────────────────────────────────
  if (state.gameOver) {
    const isVictory = state.winner === "player";
    return (
      <div className="hud-overlay flex items-center justify-center" style={{ background: "rgba(0,0,0,0.88)" }}>
        <div className="text-center px-10 py-10 rounded-2xl" style={{ background: "rgba(0,0,0,0.9)", border: `2px solid ${isVictory ? "rgba(255,180,0,0.5)" : "rgba(200,50,50,0.4)"}`, minWidth: 360 }}>
          <div className="text-xs tracking-widest uppercase mb-2" style={{ color: isVictory ? "rgba(255,200,0,0.5)" : "rgba(200,80,80,0.6)" }}>Battle Ended</div>
          <h2 className="text-5xl font-bold mb-1" style={{ fontFamily: "'Cinzel',serif", color: isVictory ? "#ffd700" : "#ef4444", textShadow: isVictory ? "0 0 30px rgba(255,200,0,0.7)" : "0 0 30px rgba(220,0,0,0.6)" }}>
            {isVictory ? "VICTORY!" : "DEFEAT"}
          </h2>
          <div className="text-xs text-gray-600 mb-6 tracking-widest">
            {state.mode === "3v3" ? "Crew Warfare" : "Free For All"}
          </div>

          {/* Leaderboard */}
          <div className="mb-6">
            <div className="text-xs text-amber-400/40 tracking-widest uppercase mb-3">Final Standings</div>
            <div className="flex flex-col gap-1.5">
              {state.leaderboard.map((entry, i) => (
                <div
                  key={`${entry.name}-${i}`}
                  className={entry.isPlayer ? "lb-row lb-row-player" : "lb-row lb-row-other"}
                >
                  <span className="text-gray-600 text-xs w-4 text-right tabular-nums">{i + 1}</span>
                  <span className="flex-1 text-left text-sm font-semibold" style={{ color: entry.isPlayer ? "#ffd700" : "#d1d5db" }}>
                    {entry.name}{entry.isPlayer ? <span className="text-amber-500/60 text-xs ml-1">(you)</span> : null}
                  </span>
                  <span className="text-amber-400 text-sm font-bold tabular-nums">{entry.kills}K</span>
                  <span className="text-red-400 text-xs tabular-nums">{entry.deaths}D</span>
                  {entry.kills > 0 && entry.deaths > 0 && (
                    <span className="text-gray-600 text-xs tabular-nums">{(entry.kills / entry.deaths).toFixed(1)}</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <button className="menu-btn pointer-events-auto text-sm" onClick={onExit}>
            ↩ RETURN TO MENU
          </button>
        </div>
      </div>
    );
  }

  // ── Pause menu (mouse not locked, in-game) ────────────────────────────────────
  if (!state.mouseLocked && state.respawnTimeLeft <= 0) {
    return (
      <div className="pause-backdrop" onClick={requestMouseLock}>
        <div
          className="text-center rounded-2xl px-10 py-8 pointer-events-auto"
          style={{ background: "rgba(6,6,10,0.97)", border: "1px solid rgba(255,180,0,0.25)", maxWidth: 400, width: "90%" }}
          onClick={e => e.stopPropagation()}
        >
          <div className="text-amber-400/40 text-xs tracking-[0.4em] uppercase mb-1">Game Paused</div>
          <h2 className="text-4xl font-bold glow-gold mb-6" style={{ fontFamily: "'Cinzel',serif", color: "#ffd700" }}>PAUSED</h2>

          <div className="mb-6">
            <div className="text-xs text-amber-400/40 tracking-widest uppercase mb-3">Controls</div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-left text-xs">
              {([
                ["WASD", "Move"],
                ["Mouse", "Camera"],
                ["LMB", "Attack combo"],
                ["RMB", "Block"],
                ["Space", "Jump"],
                ["Shift", "Dash / Flash"],
                ["1 – 4", "Abilities"],
                ["ESC", "Release mouse"],
              ] as const).map(([key, action]) => (
                <div key={key} className="flex gap-2 items-center">
                  <span className="text-amber-400 font-bold w-12 text-right shrink-0">{key}</span>
                  <span className="text-gray-500">{action}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <button
              className="menu-btn pointer-events-auto w-full"
              onClick={requestMouseLock}
            >
              ▶ RESUME
            </button>
            <button
              className="menu-btn pointer-events-auto w-full opacity-50 hover:opacity-100"
              onClick={onExit}
            >
              ✕ EXIT TO MENU
            </button>
          </div>
          <div className="mt-4 text-gray-700 text-xs">Click anywhere on the game to resume</div>
        </div>
      </div>
    );
  }

  // ── Main HUD ─────────────────────────────────────────────────────────────────
  return (
    <div className="hud-overlay">

      {/* Hit vignette */}
      {showVignette && <div key={vignetteKeyRef.current} className="hit-vignette" />}

      {/* Crosshair */}
      {state.mouseLocked && state.respawnTimeLeft <= 0 && <Crosshair />}

      {/* Respawn overlay */}
      {state.respawnTimeLeft > 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ background: "rgba(0,0,0,0.55)" }}>
          <div className="text-center">
            <div className="text-red-500 text-lg font-bold tracking-[0.3em] uppercase mb-3">Eliminated</div>
            <div
              className="respawn-countdown tabular-nums"
              style={{ fontFamily: "'Cinzel',serif", fontSize: "5rem", fontWeight: 900, color: "#ef4444", textShadow: "0 0 30px rgba(220,0,0,0.7)" }}
            >
              {Math.ceil(state.respawnTimeLeft)}
            </div>
            <div className="text-gray-500 text-sm mt-2 tracking-widest uppercase">Respawning...</div>
          </div>
        </div>
      )}

      {/* ── Top bar ── */}
      <div className="absolute top-0 left-0 right-0 flex justify-between items-center px-6 pt-3">
        {/* Score */}
        <div className="flex gap-2 items-center">
          {state.mode === "3v3" ? (
            <>
              <div className="rounded px-3 py-1 text-xs font-bold" style={{ background: "rgba(0,80,220,0.25)", border: "1px solid rgba(60,130,255,0.4)", color: "#93c5fd" }}>
                ALLIES {state.score.teamA}
              </div>
              <div className="text-gray-600 text-xs">vs</div>
              <div className="rounded px-3 py-1 text-xs font-bold" style={{ background: "rgba(200,30,30,0.25)", border: "1px solid rgba(255,80,80,0.4)", color: "#fca5a5" }}>
                ENEMIES {state.score.teamB}
              </div>
            </>
          ) : (
            <div className="rounded px-3 py-1 text-xs font-bold text-amber-300" style={{ background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,180,0,0.25)" }}>
              ⚔ Kills: {state.kills} &nbsp; ☠ Deaths: {state.deaths}
            </div>
          )}
        </div>

        {/* Timer */}
        <div
          className="text-2xl font-bold tabular-nums px-4 py-1 rounded"
          style={{
            fontFamily: "'Cinzel',serif",
            color: isLowTime ? "#ef4444" : "#ffffff",
            textShadow: isLowTime ? "0 0 12px rgba(220,0,0,0.8)" : "0 0 8px rgba(255,200,0,0.4)",
            background: "rgba(0,0,0,0.4)",
          }}
        >
          {mins}:{String(secs).padStart(2, "0")}
        </div>

        {/* K/D ratio */}
        <div className="text-xs flex items-center gap-2" style={{ color: "rgba(180,180,180,0.7)" }}>
          <span>KDA</span>
          <span className="text-amber-400 font-bold text-sm">{state.kills}</span>
          <span className="text-gray-600">/</span>
          <span className="text-red-400 font-bold text-sm">{state.deaths}</span>
          {state.kills > 0 && state.deaths > 0 && (
            <span className="text-gray-500 text-xs">({(state.kills / state.deaths).toFixed(1)})</span>
          )}
        </div>
      </div>

      {/* ── Mini leaderboard (top-left under score) ── */}
      <div className="absolute top-12 left-4" style={{ maxWidth: 180 }}>
        <div className="rounded-lg overflow-hidden" style={{ background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,180,0,0.1)" }}>
          <div className="text-xs text-amber-400/40 tracking-widest uppercase px-3 py-1.5" style={{ borderBottom: "1px solid rgba(255,180,0,0.1)" }}>
            Standings
          </div>
          {state.leaderboard.slice(0, 5).map((entry, i) => {
            const entryChar = CHARACTER_MAP[entry.charId];
            return (
              <div
                key={`lb-${entry.name}-${i}`}
                className="flex items-center gap-1.5 px-3 py-1"
                style={{ background: entry.isPlayer ? "rgba(255,180,0,0.08)" : "transparent" }}
              >
                <span className="text-gray-600 text-xs w-3 tabular-nums">{i + 1}</span>
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: entryChar?.color || "#888" }} />
                <span className="flex-1 text-xs truncate" style={{ color: entry.isPlayer ? "#ffd700" : "#aaa" }}>
                  {entry.name}
                </span>
                <span className="text-amber-400/80 text-xs tabular-nums font-bold">{entry.kills}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Bottom-left: player stats ── */}
      <div className="absolute bottom-20 left-5 w-72">
        {char && (
          <div className="mb-2 text-xs font-bold tracking-widest uppercase" style={{ color: "rgba(255,180,0,0.55)" }}>
            {char.name} <span className="text-gray-600">·</span> <span className="text-gray-600 normal-case font-normal">{char.title}</span>
          </div>
        )}

        {/* HP */}
        <div className="mb-1.5">
          <div className="flex justify-between text-xs mb-0.5">
            <span className="text-red-400">HP</span>
            <span className="text-gray-300 tabular-nums">{Math.ceil(state.playerHP)} / {state.playerMaxHP}</span>
          </div>
          <div className="health-bar-container">
            <div className="health-bar-fill" style={{ width: `${hpPct}%`, background: `linear-gradient(90deg,${hpColor}99,${hpColor})` }} />
          </div>
        </div>

        {/* MP */}
        <div className="mb-1.5">
          <div className="flex justify-between text-xs mb-0.5">
            <span className="text-blue-400">MP</span>
            <span className="text-gray-300 tabular-nums">{Math.ceil(state.playerMana)} / {state.playerMaxMana}</span>
          </div>
          <div className="health-bar-container" style={{ borderColor: "rgba(59,130,246,0.4)" }}>
            <div className="mana-bar-fill" style={{ width: `${mpPct}%` }} />
          </div>
        </div>

        {/* STM */}
        <div className="mb-1.5">
          <div className="flex justify-between text-xs mb-0.5">
            <span className="text-amber-400">STM</span>
            <span className="text-gray-300 tabular-nums">{Math.ceil(state.playerStamina)} / {state.playerMaxStamina}</span>
          </div>
          <div className="health-bar-container" style={{ borderColor: "rgba(245,158,11,0.4)" }}>
            <div className="stamina-bar-fill" style={{ width: `${stPct}%` }} />
          </div>
        </div>

        {state.isBlocking && (
          <div className="text-xs text-blue-300 font-bold tracking-wider mt-1 animate-pulse">⛊ BLOCKING</div>
        )}

        {/* Floating damage numbers */}
        <div className="relative" style={{ height: 0, overflow: "visible" }}>
          {floats.map(f => (
            <div
              key={f.id}
              className="float-dmg absolute pointer-events-none"
              style={{
                color: "#f87171",
                fontSize: f.big ? "1.5rem" : "1.1rem",
                left: f.x,
                bottom: 8,
              }}
            >
              -{f.amount}
            </div>
          ))}
        </div>
      </div>

      {/* ── Bottom-center: ability slots ── */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex gap-2 items-end">
        {abilities.map((ab, i) => {
          const cd = state.abilityCDs[i] || 0;
          const maxCd = state.abilityMaxCDs[i] || ab.cooldown;
          const cdPct = maxCd > 0 ? (cd / maxCd) * 100 : 0;
          const isReady = cd <= 0;
          const icons = ["🔥", "⚡", "💫", "🌀"];
          return (
            <div
              key={ab.id}
              title={`${ab.name}: ${ab.description}`}
              className={`ability-slot ${readyFlash[i] ? "ability-slot-ready" : ""}`}
              style={{
                borderColor: isReady ? (char?.color || "#ffcc00") : "rgba(80,80,80,0.4)",
                opacity: isReady ? 1 : 0.65,
              }}
            >
              <div className="key-hint">{i + 1}</div>
              <div className="text-2xl leading-none">{icons[i]}</div>
              <div
                className="text-center mt-1 w-full px-1 truncate"
                style={{ fontSize: "8px", color: char?.color || "#ffd700" }}
              >
                {ab.name}
              </div>
              {cd > 0 && <div className="cooldown-overlay" style={{ height: `${cdPct}%` }} />}
              {cd > 0 && (
                <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white">
                  {cd.toFixed(1)}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Kill feed ── */}
      <div className="absolute top-14 right-4 flex flex-col gap-1" style={{ maxWidth: 220 }}>
        {state.killFeed.slice(0, 5).map((kf, i) => (
          <div
            key={`${kf.killer}-${kf.time}-${i}`}
            className="kill-feed-item text-xs px-3 py-1 rounded"
            style={{ background: "rgba(0,0,0,0.7)", border: "1px solid rgba(255,180,0,0.15)" }}
          >
            <span style={{ color: "#fbbf24" }}>{kf.killer}</span>
            <span className="text-gray-600"> ✕ </span>
            <span className="text-red-400">{kf.victim}</span>
          </div>
        ))}
      </div>

      {/* ── Control hints (bottom bar) ── */}
      <div className="control-hint">
        <span><span>WASD</span> Move</span>
        <span><span>LMB</span> Attack</span>
        <span><span>RMB</span> Block</span>
        <span><span>Shift</span> Dash</span>
        <span><span>1–4</span> Abilities</span>
        <span><span>ESC</span> Pause</span>
        <button className="pointer-events-auto text-red-500/60 hover:text-red-300 ml-3 cursor-pointer text-xs" onClick={onExit}>✕ Exit</button>
      </div>
    </div>
  );
}
