import { GameMode } from "@/game/types";

interface Props {
  onSelect: (mode: GameMode) => void;
  onBack: () => void;
}

const modes = [
  {
    id: "ffa" as GameMode,
    name: "FREE FOR ALL",
    subtitle: "Every Pirate for Themselves",
    desc: "Fight 6 AI opponents in a battle royale. Last one standing wins. No allies — only enemies.",
    players: "1 vs 6 AI",
    icon: "⚔️",
    color: "#ff6d00",
    glow: "rgba(255,109,0,0.4)",
  },
  {
    id: "3v3" as GameMode,
    name: "3 vs 3",
    subtitle: "Crew Warfare",
    desc: "Team up with 2 AI allies against 3 enemy AI. Work together to defeat the opposing crew.",
    players: "3 vs 3",
    icon: "🏴‍☠️",
    color: "#00b0ff",
    glow: "rgba(0,176,255,0.4)",
  },
];

export default function ModeSelect({ onSelect, onBack }: Props) {
  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center bg-black overflow-hidden">
      <div className="absolute inset-0 bg-gradient-radial from-amber-950/20 to-transparent" />

      <div className="relative z-10 w-full max-w-4xl px-8">
        <div className="text-center mb-12">
          <div className="text-amber-400/50 text-xs tracking-[0.5em] uppercase mb-3">Grand Battle Arena</div>
          <h2 className="text-5xl font-bold glow-gold" style={{ color: "#ffd700", fontFamily: "'Cinzel',serif" }}>
            CHOOSE YOUR BATTLE
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          {modes.map((m) => (
            <button
              key={m.id}
              onClick={() => onSelect(m.id)}
              className="group relative overflow-hidden rounded-xl p-8 text-left transition-all duration-300 hover:scale-105"
              style={{
                background: `linear-gradient(135deg, rgba(0,0,0,0.8), rgba(0,0,0,0.6))`,
                border: `2px solid ${m.color}33`,
                boxShadow: `0 0 0 rgba(0,0,0,0)`,
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.borderColor = m.color;
                (e.currentTarget as HTMLElement).style.boxShadow = `0 0 40px ${m.glow}`;
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.borderColor = m.color + "33";
                (e.currentTarget as HTMLElement).style.boxShadow = "none";
              }}
            >
              <div className="text-5xl mb-4">{m.icon}</div>
              <div className="text-2xl font-bold mb-1" style={{ color: m.color, fontFamily: "'Cinzel',serif" }}>
                {m.name}
              </div>
              <div className="text-sm text-gray-400 mb-3">{m.subtitle}</div>
              <p className="text-gray-300 text-sm leading-relaxed mb-4">{m.desc}</p>
              <div className="flex items-center gap-3">
                <span className="text-xs px-3 py-1 rounded-full" style={{ background: m.color + "22", color: m.color, border: `1px solid ${m.color}44` }}>
                  {m.players}
                </span>
              </div>
            </button>
          ))}
        </div>

        <div className="text-center">
          <button className="menu-btn opacity-60 hover:opacity-100" onClick={onBack}>
            ← BACK
          </button>
        </div>
      </div>
    </div>
  );
}
