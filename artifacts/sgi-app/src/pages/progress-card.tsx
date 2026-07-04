import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { useAuth } from "@clerk/react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { TrendingUp, Share2, ArrowLeft, Download, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { generateProgressStoryCard, shareOrDownloadCanvas } from "@/lib/progressStoryCard";

const API_BASE = "/api";

interface ProgressCardData {
  id: string;
  createdAt: string;
  username: string;
  conversationTitle: string;
  earlyAvg: number;
  lateAvg: number;
  deltaPct: number;
  isPositive: boolean;
  highlightMetric: string;
  highlightMetricLabel: string;
  highlightDeltaPct: number;
  insightText: string | null;
}

export default function ProgressCardPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { getToken } = useAuth();
  const [exporting, setExporting] = useState(false);

  const { data: card, isLoading } = useQuery({
    queryKey: ["progress-card", id],
    queryFn: async () => {
      const token = await getToken();
      const r = await fetch(`${API_BASE}/progress-cards/${id}`, {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      if (!r.ok) throw new Error(t("progressCard.notFound"));
      return r.json() as Promise<ProgressCardData>;
    },
    enabled: !!id,
  });

  useEffect(() => {
    if (!card || !card.isPositive) return;
    const ogImageUrl = `${window.location.origin}/api/progress-cards/${id}/og-image`;
    const pageUrl = window.location.href;
    const title = `SGI Progress: +${card.deltaPct}%`;
    const desc = `${card.username} — ${card.highlightMetricLabel} +${card.highlightDeltaPct}% in "${card.conversationTitle}"`;
    document.title = title;

    const setMeta = (property: string, content: string) => {
      let el = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement | null;
      if (!el) { el = document.createElement("meta"); el.setAttribute("property", property); document.head.appendChild(el); }
      el.content = content;
    };
    setMeta("og:title", title);
    setMeta("og:description", desc);
    setMeta("og:image", ogImageUrl);
    setMeta("og:url", pageUrl);
    setMeta("og:type", "website");
  }, [card, id]);

  const handleShareOrDownload = async () => {
    if (!card) return;
    setExporting(true);
    try {
      await new Promise((r) => setTimeout(r, 30));
      const canvas = generateProgressStoryCard({
        username: card.username,
        conversationTitle: card.conversationTitle,
        deltaPct: card.deltaPct,
        highlightMetricLabel: card.highlightMetricLabel,
        highlightDeltaPct: card.highlightDeltaPct,
        insightText: card.insightText,
      });
      const result = await shareOrDownloadCanvas(canvas, `sgi-progress-${card.username}.png`, {
        title: "SGI Progress Card",
        text: `+${card.deltaPct}% — ${card.highlightMetricLabel}`,
      });
      if (result === "downloaded") toast.success(t("progressCard.downloaded"));
    } catch {
      toast.error(t("progressCard.cardError"));
    } finally {
      setExporting(false);
    }
  };

  const handleCopyLink = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t("chat.linkCopied", "Link copied!"));
    } catch {
      toast.info(url);
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ background: "#08090f" }}>
        <div className="w-8 h-8 rounded-full border-2 animate-spin" style={{ borderColor: "#06d6a0", borderTopColor: "transparent" }} />
      </div>
    );
  }

  if (!card) return null;

  return (
    <div className="flex-1 overflow-y-auto" style={{ background: "#08090f" }}>
      <div className="max-w-[680px] mx-auto px-6 py-8">
        <button
          onClick={() => setLocation("/chat")}
          className="flex items-center gap-2 text-sm mb-6 transition-colors"
          style={{ color: "#9090b8" }}
        >
          <ArrowLeft className="w-4 h-4" />
          Chat
        </button>

        <div className="flex items-center gap-2 mb-2">
          <TrendingUp className="w-5 h-5" style={{ color: "#06d6a0" }} />
          <h1 className="text-xl font-bold font-display" style={{ color: "#eeeeff" }}>
            {t("progressCard.title")}
          </h1>
        </div>
        <p className="text-sm mb-6" style={{ color: "#9090b8" }}>@{card.username} — "{card.conversationTitle}"</p>

        <div
          className="rounded-2xl p-8 mb-6 text-center"
          style={{
            background: "linear-gradient(135deg, rgba(6,214,160,0.1), rgba(6,214,160,0.02))",
            border: "1px solid rgba(6,214,160,0.35)",
          }}
        >
          <p className="text-xs uppercase tracking-widest mb-3" style={{ color: "rgba(168,255,220,0.7)" }}>
            {t("chat.trendWindow", "Early → Late trend")}
          </p>
          <p className="text-6xl font-black font-display mb-3" style={{ color: "#06d6a0" }}>
            {card.deltaPct > 0 ? "+" : ""}{card.deltaPct}%
          </p>
          <p className="text-sm" style={{ color: "#eeeeff" }}>
            {card.highlightMetricLabel} {card.highlightDeltaPct > 0 ? "+" : ""}{card.highlightDeltaPct}%
          </p>
          {card.insightText && (
            <p className="text-xs italic mt-3 leading-relaxed" style={{ color: "rgba(200,200,224,0.8)" }}>
              {card.insightText}
            </p>
          )}
        </div>

        {card.isPositive ? (
          <div className="flex gap-2">
            <button
              onClick={handleShareOrDownload}
              disabled={exporting}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-semibold transition-all"
              style={{
                background: "linear-gradient(135deg, rgba(6,214,160,0.22), rgba(6,214,160,0.1))",
                border: "1px solid rgba(6,214,160,0.5)",
                color: "#4eeec0",
                opacity: exporting ? 0.6 : 1,
              }}
            >
              {exporting
                ? <div className="w-4 h-4 rounded-full border-2 animate-spin" style={{ borderColor: "#4eeec0", borderTopColor: "transparent" }} />
                : <Download className="w-4 h-4" />}
              {t("progressCard.shareCard")}
            </button>
            <button
              onClick={handleCopyLink}
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-semibold transition-all"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#eeeeff" }}
            >
              <Share2 className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div
            className="flex items-center gap-3 rounded-xl px-4 py-3"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
          >
            <Sparkles className="w-4 h-4 flex-shrink-0" style={{ color: "#9090b8" }} />
            <p className="text-xs" style={{ color: "#9090b8" }}>{t("progressCard.viewInDashboard")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
