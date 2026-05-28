import { useState, useCallback, lazy, Suspense, Component, ReactNode } from "react";
import MainMenu from "@/screens/MainMenu";
import ModeSelect from "@/screens/ModeSelect";
import CharacterSelect from "@/screens/CharacterSelect";
import { GameMode } from "@/game/types";

const GameScene = lazy(() => import("@/game/GameScene"));

export type AppScreen = "menu" | "mode_select" | "char_select" | "game";

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(e: Error) { return { error: e }; }
  render() {
    if (this.state.error) {
      return (
        <div className="w-full h-full flex items-center justify-center bg-black">
          <div className="text-center p-10 max-w-md rounded-xl" style={{ border: "1px solid rgba(220,50,50,0.3)", background: "rgba(0,0,0,0.9)" }}>
            <div className="text-5xl mb-4">⚠</div>
            <h2 className="text-xl font-bold text-red-400 mb-3 tracking-widest uppercase" style={{ fontFamily: "'Cinzel',serif" }}>
              Battle Interrupted
            </h2>
            <p className="text-gray-500 text-xs font-mono mb-6 break-all">{this.state.error.message}</p>
            <button className="menu-btn" onClick={() => window.location.reload()}>↺ RESTART GAME</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function LoadingArena() {
  return (
    <div className="w-full h-full flex items-center justify-center bg-black">
      <div className="text-center">
        <div className="text-amber-400/40 text-xs tracking-[0.4em] uppercase mb-5">One Piece</div>
        <h1 className="text-5xl font-bold glow-gold mb-1" style={{ fontFamily: "'Cinzel',serif", color: "#ffd700" }}>
          GRAND BATTLE
        </h1>
        <h2 className="text-3xl font-bold mb-6" style={{ fontFamily: "'Cinzel',serif", color: "#ff6d00", textShadow: "0 0 20px rgba(255,109,0,0.5)" }}>
          ARENA
        </h2>
        <div className="text-amber-400/40 text-xs tracking-widest uppercase mb-8">Preparing the arena...</div>
        <div className="w-64 h-1.5 rounded-full mx-auto overflow-hidden" style={{ background: "rgba(255,180,0,0.1)", border: "1px solid rgba(255,180,0,0.2)" }}>
          <div className="loading-bar h-full rounded-full bg-gradient-to-r from-amber-700 to-amber-400" />
        </div>
        <div className="mt-4 text-gray-700 text-xs">Loading 3D battle engine...</div>
      </div>
    </div>
  );
}

export default function App() {
  const [screen, setScreen] = useState<AppScreen>("menu");
  const [mode, setMode] = useState<GameMode>("ffa");
  const [characterId, setCharacterId] = useState<string>("ace");

  const handleSelectMode = useCallback((m: GameMode) => {
    setMode(m);
    setScreen("char_select");
  }, []);

  const handleSelectChar = useCallback((id: string) => {
    setCharacterId(id);
    setScreen("game");
  }, []);

  const handleBack = useCallback(() => {
    setScreen(prev => {
      if (prev === "game") return "menu";
      if (prev === "char_select") return "mode_select";
      if (prev === "mode_select") return "menu";
      return "menu";
    });
  }, []);

  return (
    <ErrorBoundary>
      <div className="w-full h-full relative overflow-hidden bg-black">
        {screen === "menu" && <MainMenu onPlay={() => setScreen("mode_select")} />}
        {screen === "mode_select" && <ModeSelect onSelect={handleSelectMode} onBack={() => setScreen("menu")} />}
        {screen === "char_select" && <CharacterSelect mode={mode} onSelect={handleSelectChar} onBack={() => setScreen("mode_select")} />}
        {screen === "game" && (
          <Suspense fallback={<LoadingArena />}>
            <GameScene mode={mode} playerCharacterId={characterId} onExit={handleBack} />
          </Suspense>
        )}
      </div>
    </ErrorBoundary>
  );
}
