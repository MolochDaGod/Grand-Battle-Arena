import { useState } from "react";
import { CHARACTER_DEFS } from "@/game/characterData";
import { GameMode } from "@/game/types";
import { calcStats } from "@/game/stats";

interface Props {
  mode: GameMode;
  onSelect: (id: string) => void;
  onBack: () => void;
}

export default function CharacterSelect({ mode, onSelect, onBack }: Props) {
  const [selected, setSelected] = useState(CHARACTER_DEFS[0].id);
  const char = CHARACTER_DEFS.find(c => c.id === selected)!;
  const stats = calcStats(char.attributes);

  const StatBar = ({ label, value, max, color }: { label: string; value: number; max: number; color: string }) => (
    <div className="mb-2">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-400">{label}</span>
        <span style={{ color }}>{value}</span>
      </div>
      <div className="h-1.5 rounded-full bg-gray-800 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, (value / max) * 100)}%`, background: color }} />
      </div>
    </div>
  );

  const attrs = char.attributes;
  const attrEntries: [string, number, string][] = [
    ["STR", attrs.strength, "#ef4444"],
    ["INT", attrs.intellect, "#a855f7"],
    ["VIT", attrs.vitality, "#22c55e"],
    ["DEX", attrs.dexterity, "#eab308"],
    ["END", attrs.endurance, "#f97316"],
    ["WIS", attrs.wisdom, "#06b6d4"],
    ["AGI", attrs.agility, "#10b981"],
    ["TAC", attrs.tactics, "#8b5cf6"],
  ];

  return (
    <div className="relative w-full h-full flex bg-black overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-amber-950/10 to-black" />

      <div className="relative z-10 flex w-full h-full">
        {/* Character grid left */}
        <div className="w-64 flex-shrink-0 border-r border-amber-900/30 overflow-y-auto p-3" style={{ background: "rgba(0,0,0,0.7)" }}>
          <div className="text-xs text-amber-400/50 tracking-widest uppercase mb-3 px-1">Select Character</div>
          <div className="flex flex-col gap-2">
            {CHARACTER_DEFS.map((c) => {
              const s = calcStats(c.attributes);
              const isSelected = c.id === selected;
              return (
                <button
                  key={c.id}
                  onClick={() => setSelected(c.id)}
                  className="char-card rounded-lg p-3 text-left"
                  style={isSelected ? { borderColor: c.color, background: `${c.color}22`, boxShadow: `0 0 15px ${c.color}44` } : {}}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: c.color, boxShadow: `0 0 6px ${c.color}` }} />
                    <div>
                      <div className="text-sm font-bold text-white leading-tight">{c.name}</div>
                      <div className="text-xs text-gray-500">{c.faction}</div>
                    </div>
                  </div>
                  {isSelected && (
                    <div className="mt-2 text-xs" style={{ color: c.color }}>
                      HP:{s.maxHealth} · SPD:{s.movementSpeed.toFixed(1)}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Center: char details */}
        <div className="flex-1 flex flex-col p-8 overflow-y-auto">
          <div className="mb-4">
            <div className="text-xs tracking-widest text-gray-500 uppercase mb-1">{char.faction}</div>
            <h2 className="text-5xl font-bold mb-1" style={{ color: char.color, fontFamily: "'Cinzel',serif", textShadow: `0 0 30px ${char.color}88` }}>
              {char.name}
            </h2>
            <div className="text-xl text-gray-300 mb-3">{char.title}</div>
            <p className="text-gray-400 text-sm leading-relaxed max-w-lg">{char.description}</p>
          </div>

          {/* Abilities */}
          <div className="mb-6">
            <h3 className="text-sm tracking-widest text-amber-400/60 uppercase mb-3">Abilities</h3>
            <div className="grid grid-cols-2 gap-3">
              {char.abilities.map((ab, i) => (
                <div key={ab.id} className="rounded-lg p-4" style={{ background: "rgba(255,180,0,0.05)", border: "1px solid rgba(255,180,0,0.15)" }}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-7 h-7 rounded flex items-center justify-center text-xs font-bold text-black" style={{ background: char.color }}>
                      {i + 1}
                    </div>
                    <div className="text-sm font-bold text-white">{ab.name}</div>
                    <div className="ml-auto text-xs text-gray-500">{ab.cooldown}s CD</div>
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed">{ab.description}</p>
                  <div className="flex gap-3 mt-2 text-xs">
                    {ab.damage > 0 && <span className="text-red-400">⚔ {ab.damage}</span>}
                    {ab.manaCost > 0 && <span className="text-blue-400">✦ {ab.manaCost}</span>}
                    <span className="text-gray-500 capitalize">{ab.type}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Dash/Block type */}
          <div className="flex gap-4 mb-6">
            <div className="rounded-lg px-4 py-2 text-sm" style={{ background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,180,0,0.2)" }}>
              <span className="text-gray-400">Shift: </span>
              <span className="text-amber-300 capitalize">{char.dashType}</span>
            </div>
            <div className="rounded-lg px-4 py-2 text-sm" style={{ background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,180,0,0.2)" }}>
              <span className="text-gray-400">Block: </span>
              <span className="text-amber-300 capitalize">{char.blockType}</span>
            </div>
          </div>

          {/* Controls reminder */}
          <div className="mt-auto text-xs text-gray-600 flex flex-wrap gap-4">
            <span><span className="text-amber-400">LMB</span> Combo Attack</span>
            <span><span className="text-amber-400">RMB</span> Block</span>
            <span><span className="text-amber-400">Space</span> Jump</span>
            <span><span className="text-amber-400">Shift</span> {char.dashType}</span>
            <span><span className="text-amber-400">1-4</span> Abilities</span>
          </div>
        </div>

        {/* Right: stats */}
        <div className="w-64 flex-shrink-0 border-l border-amber-900/30 p-5 overflow-y-auto" style={{ background: "rgba(0,0,0,0.7)" }}>
          <div className="text-xs text-amber-400/50 tracking-widest uppercase mb-4">Character Stats</div>

          <div className="mb-5">
            <div className="text-xs text-gray-500 uppercase mb-2">Attributes</div>
            {attrEntries.map(([label, val, color]) => (
              <StatBar key={label} label={label} value={val} max={55} color={color} />
            ))}
          </div>

          <div className="mb-5">
            <div className="text-xs text-gray-500 uppercase mb-2">Derived Stats</div>
            <div className="space-y-1 text-xs">
              {[
                ["HP", stats.maxHealth, "#ef4444"],
                ["MP", stats.maxMana, "#3b82f6"],
                ["STM", stats.maxStamina, "#f59e0b"],
                ["P.DMG", stats.physicalDamage, "#f97316"],
                ["M.DMG", stats.magicDamage, "#a855f7"],
                ["P.DEF", stats.physicalDefense, "#22c55e"],
                ["CRIT", `${stats.critChance.toFixed(0)}%`, "#eab308"],
                ["SPD", stats.movementSpeed.toFixed(1), "#10b981"],
              ].map(([label, value, color]) => (
                <div key={String(label)} className="flex justify-between">
                  <span className="text-gray-400">{label}</span>
                  <span style={{ color: String(color) }}>{String(value)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3 mt-6">
            <button
              className="menu-btn w-full text-center"
              style={{ borderColor: char.color + "99", color: char.color }}
              onClick={() => onSelect(char.id)}
            >
              ⚔ FIGHT AS {char.name.toUpperCase()}
            </button>
            <button className="menu-btn w-full text-center opacity-50 hover:opacity-100" onClick={onBack}>
              ← BACK
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
