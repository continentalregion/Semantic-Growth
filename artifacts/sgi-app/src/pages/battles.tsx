import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Trophy, Clock, Zap, Network, Layers, Crown, Share2, ExternalLink } from "lucide-react";
import { toast } from "sonner";

const API_BASE = "/api";

const CATEGORY_META: Record<string, { label: string; color: string }> = {
  philosophy:    { label: "Filosofia",   color: "#7c6bff" },
  science:       { label: "Scienza",     color: "#06d6a0" },
  ethics:        { label: "Etica",       color: "#f72585" },
  technology:    { label: "Tecnologia",  color: "#a89fff" },
  society:       { label: "Società",     color: "#ffd166" },
  knowledge:     { label: "Conoscenza",  color: "#06d6a0" },
  consciousness: { label: "Coscienza",   color: "#7c6bff" },
};

interface PlayerData {
  username: string;
  scoreTotal: number;
  scoreDensity: number;
  scoreConnections: number;
  scoreDepth: number;
  connections: Array<{ concept1: string; concept2: string; description: string; strength: number }>;
  durationSeconds: number;
  isWinner: boolean;
}

interface BattleCard {
  id: string;
  createdAt: string;
  thread: { id: string; question: string; category: string };
  player1: PlayerData;
  player2: PlayerData;
}

function timeAgo(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `${diff}s fa`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m fa`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h fa`;
  return `${Math.floor(diff / 86400)}g fa`;
}

function formatDuration(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function ScorePip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="text-[10px] font-bold" style={{ color }}>{value}</div>
      <div className="text-[9px] opacity-50">{label}</div>
    </div>
  );
}

function PlayerColumn({ p, side, t }: { p: PlayerData; side: "left" | "right"; t: (k: string) => string }) {
  const isLeft = side === "left";
  return (
    <div
      className={`flex-1 flex flex-col gap-3 p-4 rounded-xl relative overflow-hidden ${isLeft ? "items-start" : "items-end"}`}
      style={{
        background: p.isWinner
          ? "linear-gradient(135deg, rgba(124,107,255,0.12), rgba(6,214,160,0.06))"
          : "rgba(255,255,255,0.02)",
        border: p.isWinner ? "1px solid rgba(124,107,255,0.25)" : "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {p.isWinner && (
        <div
          className={`absolute top-2 ${isLeft ? "right-2" : "left-2"} flex items-center gap-1`}
          style={{ color: "#ffd166" }}
        >
          <Crown className="w-3.5 h-3.5" />
          <span className="text-[10px] font-bold">{t("battles.winner")}</span>
        </div>
      )}

      <div className={`flex flex-col ${isLeft ? "items-start" : "items-end"} gap-0.5 mt-3`}>
        <span className="text-sm font-bold" style={{ color: p.isWinner ? "#a89fff" : "#eeeeff" }}>
          {p.username}
        </span>
        <div className="flex items-center gap-1.5">
          <span className="text-2xl font-black" style={{ color: p.isWinner ? "#7c6bff" : "#888" }}>
            {p.scoreTotal}
          </span>
          <span className="text-xs opacity-40 font-medium">{t("battles.pts")}</span>
        </div>
      </div>

      <div className={`flex gap-3 ${isLeft ? "" : "flex-row-reverse"}`}>
        <ScorePip label={t("battles.density")} value={p.scoreDensity} color="#06d6a0" />
        <ScorePip label={t("battles.connLabel")} value={p.scoreConnections} color="#7c6bff" />
        <ScorePip label={t("battles.depth")} value={p.scoreDepth} color="#f72585" />
      </div>

      <div className="flex items-center gap-1 opacity-40">
        <Clock className="w-3 h-3" />
        <span className="text-[10px]">{formatDuration(p.durationSeconds)}</span>
      </div>

      {p.connections.length > 0 && (
        <div className={`flex flex-col gap-1 w-full ${isLeft ? "" : "items-end"}`}>
          <span className="text-[9px] font-semibold opacity-40 uppercase tracking-wider">{t("battles.threadOpen")}</span>
          {p.connections.slice(0, 2).map((c, i) => (
            <div
              key={i}
              className={`flex items-center gap-1 text-[10px] opacity-60 ${isLeft ? "" : "flex-row-reverse"}`}
            >
              <span className="font-semibold" style={{ color: "#7c6bff" }}>{c.concept1}</span>
              <span className="opacity-40">↔</span>
              <span className="font-semibold" style={{ color: "#06d6a0" }}>{c.concept2}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BattleCardItem({ card, t }: { card: BattleCard; t: (k: string) => string }) {
  const cat = CATEGORY_META[card.thread.category] ?? { label: card.thread.category, color: "#888" };
  const shareUrl = `${window.location.origin}${import.meta.env.BASE_URL}battle-cards/${card.id}`;

  function handleShare() {
    navigator.clipboard.writeText(shareUrl).then(() => {
      toast.success(t("battles.copied"));
    });
  }

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.02)" }}
    >
      <div
        className="px-4 py-3 flex items-start justify-between gap-3"
        style={{ background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style={{ background: `${cat.color}18`, color: cat.color }}
            >
              {cat.label}
            </span>
            <span className="text-[10px] opacity-30">{timeAgo(card.createdAt)}</span>
          </div>
          <p className="text-sm font-semibold leading-snug" style={{ color: "#eeeeff" }}>
            {card.thread.question}
          </p>
        </div>
        <button
          onClick={handleShare}
          className="flex items-center gap-1.5 text-[11px] font-medium px-3 py-1.5 rounded-lg transition-all hover:opacity-80 flex-shrink-0"
          style={{ background: "rgba(124,107,255,0.15)", color: "#a89fff", border: "1px solid rgba(124,107,255,0.2)" }}
        >
          <Share2 className="w-3 h-3" />
          {t("battles.share")}
        </button>
      </div>

      <div className="p-3 flex items-stretch gap-2">
        <PlayerColumn p={card.player1} side="left" t={t} />

        <div className="flex flex-col items-center justify-center gap-2 flex-shrink-0 px-1">
          <div className="w-px flex-1" style={{ background: "rgba(255,255,255,0.07)" }} />
          <div
            className="text-xs font-black px-2 py-1 rounded"
            style={{ background: "rgba(247,37,133,0.1)", color: "#f72585", border: "1px solid rgba(247,37,133,0.2)" }}
          >
            VS
          </div>
          <div className="w-px flex-1" style={{ background: "rgba(255,255,255,0.07)" }} />
        </div>

        <PlayerColumn p={card.player2} side="right" t={t} />
      </div>

      <div
        className="px-4 py-2 flex items-center gap-4"
        style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
      >
        <div className="flex items-center gap-1.5 text-[10px] opacity-40">
          <Zap className="w-3 h-3" />
          <span>{t("battles.scoreDelta")}: {Math.abs(card.player1.scoreTotal - card.player2.scoreTotal)} pt</span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] opacity-40">
          <Network className="w-3 h-3" />
          <span>{card.player1.connections.length + card.player2.connections.length} {t("battles.totalConns")}</span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] opacity-40">
          <Layers className="w-3 h-3" />
          <span>{t("battles.threadOpen")}</span>
        </div>
        <a
          href={`${import.meta.env.BASE_URL}battle-cards/${card.id}`.replace("//", "/")}
          className="ml-auto flex items-center gap-1 text-[10px] opacity-40 hover:opacity-70 transition-opacity"
        >
          <ExternalLink className="w-3 h-3" />
          {t("battles.detail")}
        </a>
      </div>
    </div>
  );
}

export default function BattlesPage() {
  const { t } = useTranslation();

  const { data: cards = [], isLoading } = useQuery<BattleCard[]>({
    queryKey: ["battles-public"],
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/battles/public`);
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    refetchInterval: 30000,
  });

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div
        className="flex-shrink-0 px-6 py-5 flex items-center justify-between"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
      >
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <Trophy className="w-5 h-5" style={{ color: "#ffd166" }} />
            <h1 className="text-lg font-bold" style={{ color: "#eeeeff" }}>{t("battles.title")}</h1>
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse"
              style={{ background: "rgba(247,37,133,0.15)", color: "#f72585", border: "1px solid rgba(247,37,133,0.25)" }}
            >
              {t("battles.liveBadge")}
            </span>
          </div>
          <p className="text-xs opacity-40">{t("battles.subtitle")}</p>
        </div>
        <div className="text-right">
          <div className="text-lg font-black" style={{ color: "#7c6bff" }}>{cards.length}</div>
          <div className="text-[10px] opacity-40">{t("battles.count")}</div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {isLoading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-48 rounded-2xl animate-pulse" style={{ background: "rgba(255,255,255,0.04)" }} />
            ))}
          </div>
        ) : cards.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3 opacity-40">
            <Trophy className="w-10 h-10" />
            <p className="text-sm">{t("battles.empty")}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4 pb-6">
            {cards.map(card => (
              <BattleCardItem key={card.id} card={card} t={t} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
