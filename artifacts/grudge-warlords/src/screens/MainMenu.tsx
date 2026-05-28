import { useEffect, useRef, useState } from "react";
import { CHARACTER_DEFS } from "@/game/characterData";

interface Props { onPlay: () => void; }

export default function MainMenu({ onPlay }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredChar, setHoveredChar] = useState<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf: number;
    const particles: { x: number; y: number; vx: number; vy: number; size: number; life: number; maxLife: number; color: string }[] = [];

    const spawn = () => {
      if (particles.length < 150) {
        const colors = ["#ff6d00","#ffd600","#e040fb","#00b0ff","#76ff03","#ff1744"];
        particles.push({
          x: Math.random() * canvas.width, y: canvas.height + 10,
          vx: (Math.random() - 0.5) * 1.5, vy: -Math.random() * 2.5 - 0.5,
          size: Math.random() * 3 + 0.5, life: 0,
          maxLife: 100 + Math.random() * 100,
          color: colors[Math.floor(Math.random() * colors.length)],
        });
      }
    };

    const draw = () => {
      canvas.width = window.innerWidth; canvas.height = window.innerHeight;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      spawn();
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx; p.y += p.vy; p.life++;
        if (p.life > p.maxLife) { particles.splice(i, 1); continue; }
        const alpha = 1 - p.life / p.maxLife;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color + Math.floor(alpha * 255).toString(16).padStart(2, "0");
        ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden scanlines">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" style={{ opacity: 0.35 }} />
      <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/30 to-black/95" />

      <div className="relative z-10 flex flex-col items-center gap-6 px-4">
        {/* Title block */}
        <div className="text-center">
          <div className="text-sm tracking-[0.5em] text-amber-400/50 mb-3 uppercase">One Piece</div>
          <h1 className="text-6xl sm:text-7xl md:text-8xl font-bold glow-gold mb-1"
              style={{ fontFamily: "'Cinzel', serif", color: "#ffd700", letterSpacing: "0.04em" }}>
            GRAND BATTLE
          </h1>
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold"
              style={{ fontFamily: "'Cinzel', serif", color: "#ff6d00", letterSpacing: "0.08em", textShadow: "0 0 30px rgba(255,109,0,0.5)" }}>
            ARENA
          </h2>
        </div>

        {/* CTA */}
        <div className="flex flex-col items-center gap-4 mt-2">
          <button
            className="menu-btn text-lg sm:text-xl px-12 sm:px-16 py-4 relative overflow-hidden group"
            onClick={onPlay}
            style={{ background: "linear-gradient(135deg, rgba(255,180,0,0.2), rgba(200,120,0,0.08))" }}
          >
            <span className="relative z-10">⚔ ENTER BATTLE</span>
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-400/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
          </button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-8 mt-4 max-w-md text-center">
          <div>
            <div className="text-amber-400 text-3xl font-bold mb-1" style={{ fontFamily: "'Cinzel',serif" }}>{CHARACTER_DEFS.length}</div>
            <div className="text-gray-500 text-xs uppercase tracking-wider">Fighters</div>
          </div>
          <div>
            <div className="text-amber-400 text-3xl font-bold mb-1" style={{ fontFamily: "'Cinzel',serif" }}>4</div>
            <div className="text-gray-500 text-xs uppercase tracking-wider">Abilities Each</div>
          </div>
          <div>
            <div className="text-amber-400 text-3xl font-bold mb-1" style={{ fontFamily: "'Cinzel',serif" }}>2</div>
            <div className="text-gray-500 text-xs uppercase tracking-wider">Battle Modes</div>
          </div>
        </div>

        {/* Character roster preview */}
        <div className="mt-4 w-full max-w-2xl">
          <div className="text-xs text-amber-400/30 tracking-widest uppercase text-center mb-2">Roster</div>
          <div className="flex flex-wrap justify-center gap-2">
            {CHARACTER_DEFS.map((c, i) => (
              <div
                key={c.id}
                className="relative cursor-default transition-all duration-200"
                style={{
                  width: 36, height: 36, borderRadius: 6,
                  background: hoveredChar === i
                    ? `linear-gradient(135deg, ${c.color}55, ${c.color}22)`
                    : `linear-gradient(135deg, ${c.color}22, ${c.color}08)`,
                  border: `1.5px solid ${hoveredChar === i ? c.color : c.color + "44"}`,
                  boxShadow: hoveredChar === i ? `0 0 12px ${c.color}66` : "none",
                  transform: hoveredChar === i ? "scale(1.15)" : "scale(1)",
                }}
                onMouseEnter={() => setHoveredChar(i)}
                onMouseLeave={() => setHoveredChar(null)}
                title={c.name}
              >
                <div className="w-full h-full flex items-center justify-center text-xs font-bold" style={{ color: c.color }}>
                  {c.name.charAt(0)}
                </div>
              </div>
            ))}
          </div>
          {hoveredChar !== null && (
            <div className="text-center mt-2 text-xs transition-all">
              <span style={{ color: CHARACTER_DEFS[hoveredChar].color }} className="font-bold">{CHARACTER_DEFS[hoveredChar].name}</span>
              <span className="text-gray-600 ml-2">{CHARACTER_DEFS[hoveredChar].title}</span>
            </div>
          )}
        </div>
      </div>

      <div className="absolute bottom-6 left-0 right-0 text-center text-xs text-gray-600">
        Click to enable mouse look · WASD to move · LMB attack · RMB block · 1-4 abilities
      </div>
    </div>
  );
}
