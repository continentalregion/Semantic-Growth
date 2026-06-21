import { useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useAuth } from "@clerk/react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trophy, Share2, ArrowLeft, Network, Flame, Crown } from "lucide-react";

const API_BASE = "/api";

interface BattleCardData {
  id: string;
  threadId: string;
  createdAt: string;
  thread: { question: string; category: string };
  player1: {
    sessionId: string; username: string; scoreTotal: number;
    scoreDensity: number; scoreConnections: number; scoreDepth: number;
    scoreExplanation: string;
    connections: Array<{ concept1: string; concept2: string; description: string; strength: number }>;
    isWinner: boolean;
  };
  player2: {
    sessionId: string; username: string; scoreTotal: number;
    scoreDensity: number; scoreConnections: number; scoreDepth: number;
    scoreExplanation: string;
    connections: Array<{ concept1: string; concept2: string; description: string; strength: number }>;
    isWinner: boolean;
  };
}

function PlayerPanel({ player, side }: { player: BattleCardData["player1"]; side: "left" | "right" }) {
  const color = side === "left" ? "#7c6bff" : "#06d6a0";
  const dimColor = side === "left" ? "rgba(124,107,255,0.12)" : "rgba(6,214,160,0.1)";
  const borderColor = player.isWinner
    ? (side === "left" ? "rgba(124,107,255,0.5)" : "rgba(6,214,160,0.5)")
    : "rgba(255,255,255,0.07)";

  return (
    <div
      className="flex-1 rounded-2xl p-5 relative"
      style={{ background: dimColor, border: `1.5px solid ${borderColor}` }}
    >
      {player.isWinner && (
        <div
          className="absolute -top-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold"
          style={{ background: side === "left" ? "#7c6bff" : "#06d6a0", color: "#fff" }}
        >
          <Crown className="w-3 h-3" />
          Vincitore
        </div>
      )}

      <div className="text-center mb-4">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold mx-auto mb-2"
          style={{ background: `${color}22`, border: `2px solid ${color}55`, color }}
        >
          {player.username.charAt(0).toUpperCase()}
        </div>
        <p className="font-bold text-sm" style={{ color: "#eeeeff" }}>@{player.username}</p>
      </div>

      {/* Total score */}
      <div className="text-center mb-5">
        <span className="text-5xl font-black font-display" style={{ color }}>{player.scoreTotal}</span>
        <span className="text-sm block mt-0.5" style={{ color: "rgba(144,144,184,0.5)" }}>SGI Score</span>
      </div>

      {/* Sub-scores */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {[
          { label: "Densità", value: player.scoreDensity, icon: "⬡" },
          { label: "Conn.", value: player.scoreConnections, icon: "⟳" },
          { label: "Profondità", value: player.scoreDepth, icon: "◉" },
        ].map(item => (
          <div key={item.label} className="text-center rounded-lg py-2" style={{ background: "rgba(255,255,255,0.04)" }}>
            <div className="text-sm font-bold" style={{ color }}>{item.value}</div>
            <div className="text-[9px]" style={{ color: "rgba(144,144,184,0.5)" }}>{item.label}</div>
          </div>
        ))}
      </div>

      {/* Score explanation */}
      {player.scoreExplanation && (
        <p className="text-xs leading-relaxed mb-4 italic" style={{ color: "rgba(144,144,184,0.7)" }}>
          "{player.scoreExplanation}"
        </p>
      )}

      {/* Key connections */}
      {player.connections.length > 0 && (
        <div>
          <p className="text-[9px] uppercase tracking-widest mb-2 flex items-center gap-1" style={{ color: "rgba(144,144,184,0.4)" }}>
            <Network className="w-3 h-3" />
            Connessioni chiave
          </p>
          <div className="space-y-1.5">
            {player.connections.slice(0, 3).map((conn, i) => (
              <div key={i} className="text-[11px] rounded-lg px-2.5 py-1.5" style={{ background: `${color}0a`, border: `1px solid ${color}22` }}>
                <span style={{ color: "#a89fff" }}>{conn.concept1}</span>
                <span style={{ color: "rgba(144,144,184,0.5)" }}> ↔ </span>
                <span style={{ color }}>{conn.concept2}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function BattleCardPage() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { getToken } = useAuth();

  const { data: card, isLoading } = useQuery({
    queryKey: ["battle-card", id],
    queryFn: async () => {
      const token = await getToken();
      const r = await fetch(`${API_BASE}/battle-cards/${id}`, {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      if (!r.ok) throw new Error("Battle card non trovata");
      return r.json() as Promise<BattleCardData>;
    },
    enabled: !!id,
  });

  // Inject OG meta tags dynamically
  useEffect(() => {
    if (!card) return;
    const ogImageUrl = `${window.location.origin}/api/battle-cards/${id}/og-image`;
    const pageUrl = window.location.href;
    const title = `SGI Battle: ${card.player1.username} vs ${card.player2.username}`;
    const desc = `"${card.thread.question}" — ${card.player1.isWinner ? card.player1.username : card.player2.username} vince con ${Math.max(card.player1.scoreTotal, card.player2.scoreTotal)} punti SGI`;

    document.title = title;

    const setMeta = (property: string, content: string) => {
      let el = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement | null;
      if (!el) { el = document.createElement("meta"); el.setAttribute("property", property); document.head.appendChild(el); }
      el.content = content;
    };
    const setMetaName = (name: string, content: string) => {
      let el = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
      if (!el) { el = document.createElement("meta"); el.setAttribute("name", name); document.head.appendChild(el); }
      el.content = content;
    };

    setMeta("og:title", title);
    setMeta("og:description", desc);
    setMeta("og:image", ogImageUrl);
    setMeta("og:url", pageUrl);
    setMeta("og:type", "website");
    setMetaName("twitter:card", "summary_large_image");
    setMetaName("twitter:title", title);
    setMetaName("twitter:description", desc);
    setMetaName("twitter:image", ogImageUrl);
  }, [card, id]);

  const handleShare = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiato negli appunti!");
    } catch {
      toast.info(`Link: ${url}`);
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ background: "#08090f" }}>
        <div className="w-8 h-8 rounded-full border-2 animate-spin" style={{ borderColor: "#7c6bff", borderTopColor: "transparent" }} />
      </div>
    );
  }

  if (!card) return null;

  const winner = card.player1.isWinner ? card.player1 : card.player2;

  return (
    <div className="flex-1 overflow-y-auto" style={{ background: "#08090f" }}>
      <div className="max-w-[820px] mx-auto px-6 py-8">

        {/* Back */}
        <button
          onClick={() => setLocation(`/threads/${card.threadId}`)}
          className="flex items-center gap-2 text-sm mb-6 transition-colors"
          style={{ color: "#9090b8" }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "#eeeeff"}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "#9090b8"}
        >
          <ArrowLeft className="w-4 h-4" />
          Thread
        </button>

        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Trophy className="w-5 h-5" style={{ color: "#ffd166" }} />
              <h1 className="text-xl font-bold font-display" style={{ color: "#eeeeff" }}>Battle Card</h1>
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(255,209,102,0.12)", color: "#ffd166" }}>
                {card.thread.category}
              </span>
            </div>
            <p className="text-sm max-w-[500px]" style={{ color: "#9090b8" }}>
              "{card.thread.question}"
            </p>
          </div>
          <button
            onClick={handleShare}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#eeeeff" }}
          >
            <Share2 className="w-4 h-4" />
            Condividi
          </button>
        </div>

        {/* Winner banner */}
        <div
          className="rounded-2xl px-5 py-4 mb-6 flex items-center gap-4"
          style={{
            background: "linear-gradient(135deg, rgba(255,209,102,0.08), rgba(255,209,102,0.03))",
            border: "1px solid rgba(255,209,102,0.25)",
          }}
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(255,209,102,0.2)" }}
          >
            <Crown className="w-5 h-5" style={{ color: "#ffd166" }} />
          </div>
          <div>
            <p className="text-sm font-bold" style={{ color: "#ffd166" }}>
              @{winner.username} vince con {winner.scoreTotal} punti SGI
            </p>
            <p className="text-xs mt-0.5" style={{ color: "#9090b8" }}>
              {winner.scoreExplanation || "Eccellente performance intellettuale."}
            </p>
          </div>
        </div>

        {/* Player panels */}
        <div className="flex gap-4 mb-6">
          <PlayerPanel player={card.player1} side="left" />

          {/* VS */}
          <div className="flex items-center justify-center w-14 flex-shrink-0">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-black"
              style={{ background: "rgba(247,37,133,0.12)", border: "1px solid rgba(247,37,133,0.3)", color: "#f72585" }}
            >
              VS
            </div>
          </div>

          <PlayerPanel player={card.player2} side="right" />
        </div>

        {/* Share section */}
        <div
          className="rounded-xl p-5 text-center"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
        >
          <div className="flex items-center justify-center gap-2 mb-2">
            <Flame className="w-4 h-4" style={{ color: "#f72585" }} />
            <span className="font-semibold text-sm" style={{ color: "#eeeeff" }}>Condividi questa battaglia</span>
          </div>
          <p className="text-xs mb-4" style={{ color: "#9090b8" }}>
            Copia il link o condividi direttamente sui social. L'immagine viene generata automaticamente.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={handleShare}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all"
              style={{ background: "linear-gradient(135deg, #7c6bff, #5b4de0)", color: "#fff" }}
            >
              <Share2 className="w-4 h-4" />
              Copia link
            </button>
            <a
              href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`⚔ Ho vinto una battaglia intellettuale su SGI!\n"${card.thread.question}"\n\nScore: ${winner.scoreTotal} SGI`)}&url=${encodeURIComponent(window.location.href)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all"
              style={{ background: "rgba(29,161,242,0.12)", border: "1px solid rgba(29,161,242,0.3)", color: "#1da1f2" }}
            >
              𝕏 Twitter
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
