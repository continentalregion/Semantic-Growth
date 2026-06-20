import { Link, useLocation } from "wouter";
import { useClerk } from "@clerk/react";
import { useGetMyProfile } from "@workspace/api-client-react";
import { useTranslation } from "react-i18next";
import { useState, useRef, useEffect } from "react";
import { loadLanguage, clearLangCache } from "../i18n";
import {
  Activity, MessageSquare, Trophy, Network, User,
  LineChart, Lightbulb, Settings, LogOut, Zap, Gamepad2,
  Languages, Loader2, RefreshCw, ChevronDown,
} from "lucide-react";

// Known language flags
const LANG_META: Record<string, { flag: string; name: string }> = {
  it: { flag: "🇮🇹", name: "Italiano" },
  en: { flag: "🇬🇧", name: "English" },
  es: { flag: "🇪🇸", name: "Español" },
  fr: { flag: "🇫🇷", name: "Français" },
  de: { flag: "🇩🇪", name: "Deutsch" },
  pt: { flag: "🇵🇹", name: "Português" },
  nl: { flag: "🇳🇱", name: "Nederlands" },
  ru: { flag: "🇷🇺", name: "Русский" },
  zh: { flag: "🇨🇳", name: "中文" },
  ja: { flag: "🇯🇵", name: "日本語" },
  ko: { flag: "🇰🇷", name: "한국어" },
  ar: { flag: "🇸🇦", name: "العربية" },
  hi: { flag: "🇮🇳", name: "हिन्दी" },
  tr: { flag: "🇹🇷", name: "Türkçe" },
  pl: { flag: "🇵🇱", name: "Polski" },
  sv: { flag: "🇸🇪", name: "Svenska" },
};

const PRESET_LANGS = ["it", "en", "es"];

function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const current = i18n.language;
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "ok" | "error">("idle");
  const inputRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close popover on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const switchTo = async (code: string) => {
    const c = code.toLowerCase().trim();
    if (!c) return;
    if (c === current) { setOpen(false); return; }

    setLoading(true);
    setStatus("idle");

    const result = await loadLanguage(c);

    if (result === "error") {
      setStatus("error");
      setLoading(false);
      return;
    }

    await i18n.changeLanguage(c);
    localStorage.setItem("sgi-lang", c);
    setLoading(false);
    setStatus("ok");
    setOpen(false);
    setInput("");
  };

  const handleRefetch = async (code: string) => {
    clearLangCache(code);
    await switchTo(code);
  };

  const currentMeta = LANG_META[current];

  return (
    <div className="relative" ref={popoverRef}>
      {/* Trigger */}
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 w-full px-2.5 py-2 rounded-lg text-[11px] font-semibold transition-all"
        style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.07)",
          color: "rgba(144,144,184,0.9)",
        }}
      >
        <Languages className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#7c6bff" }} />
        <span className="flex-1 text-left">
          {currentMeta
            ? `${currentMeta.flag} ${currentMeta.name}`
            : `🌐 ${current.toUpperCase()}`}
        </span>
        {loading
          ? <Loader2 className="w-3 h-3 animate-spin" style={{ color: "#7c6bff" }} />
          : <ChevronDown className="w-3 h-3 opacity-50" />}
      </button>

      {/* Popover */}
      {open && (
        <div
          className="absolute bottom-full mb-2 left-0 w-[210px] rounded-xl overflow-hidden z-50 shadow-2xl"
          style={{ background: "#0d0f1f", border: "1px solid rgba(255,255,255,0.1)" }}
        >
          {/* Preset languages */}
          <div className="p-1.5">
            {PRESET_LANGS.map(code => {
              const meta = LANG_META[code]!;
              const isCurrent = current === code;
              return (
                <button
                  key={code}
                  onClick={() => switchTo(code)}
                  className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm transition-colors hover:bg-white/5"
                  style={{ color: isCurrent ? "#a89fff" : "rgba(144,144,184,0.8)" }}
                >
                  <span className="text-base">{meta.flag}</span>
                  <span className="flex-1 text-left text-[12px]">{meta.name}</span>
                  {isCurrent && <span className="text-[10px] text-[#7c6bff]">✓</span>}
                </button>
              );
            })}
          </div>

          <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }} />

          {/* More languages */}
          <div className="p-1.5">
            <div className="text-[9px] uppercase tracking-widest px-3 py-1" style={{ color: "rgba(74,74,106,1)" }}>
              Altre lingue (auto-traduzione AI)
            </div>
            {Object.entries(LANG_META)
              .filter(([code]) => !PRESET_LANGS.includes(code))
              .map(([code, meta]) => {
                const isCurrent = current === code;
                return (
                  <div key={code} className="flex items-center gap-1 px-1">
                    <button
                      onClick={() => switchTo(code)}
                      className="flex items-center gap-2 flex-1 px-2 py-1.5 rounded-lg text-sm transition-colors hover:bg-white/5"
                      style={{ color: isCurrent ? "#a89fff" : "rgba(144,144,184,0.6)" }}
                      disabled={loading}
                    >
                      <span className="text-base">{meta.flag}</span>
                      <span className="flex-1 text-left text-[11px]">{meta.name}</span>
                      {isCurrent && <span className="text-[10px] text-[#7c6bff]">✓</span>}
                    </button>
                    {isCurrent && (
                      <button
                        onClick={() => handleRefetch(code)}
                        title="Ricarica traduzione"
                        className="p-1 rounded-md hover:bg-white/5 transition-colors"
                        style={{ color: "rgba(74,74,106,1)" }}
                        disabled={loading}
                      >
                        <RefreshCw className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                );
              })}
          </div>

          <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }} />

          {/* Custom language input */}
          <div className="p-2">
            <div className="text-[9px] uppercase tracking-widest px-1 pb-1" style={{ color: "rgba(74,74,106,1)" }}>
              Qualsiasi lingua (codice ISO)
            </div>
            <div className="flex items-center gap-1">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={e => { setInput(e.target.value); setStatus("idle"); }}
                onKeyDown={e => {
                  if (e.key === "Enter") switchTo(input);
                  if (e.key === "Escape") setOpen(false);
                }}
                placeholder="fr, de, ja, ar, hi…"
                className="flex-1 px-2.5 py-1.5 rounded-lg text-[11px] outline-none"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: status === "error"
                    ? "1px solid rgba(247,37,133,0.5)"
                    : "1px solid rgba(255,255,255,0.1)",
                  color: "#eeeeff",
                }}
                maxLength={5}
              />
              <button
                onClick={() => switchTo(input)}
                disabled={loading || !input.trim()}
                className="flex items-center justify-center w-7 h-7 rounded-lg transition-colors"
                style={{
                  background: "rgba(124,107,255,0.2)",
                  border: "1px solid rgba(124,107,255,0.3)",
                  color: "#a89fff",
                  opacity: (!input.trim() || loading) ? 0.4 : 1,
                }}
              >
                {loading
                  ? <Loader2 className="w-3 h-3 animate-spin" />
                  : <span className="text-[10px] font-bold">→</span>}
              </button>
            </div>
            {status === "error" && (
              <p className="text-[10px] mt-1 px-1" style={{ color: "#f72585" }}>
                Traduzione fallita. Controlla il codice.
              </p>
            )}
            {status === "ok" && (
              <p className="text-[10px] mt-1 px-1" style={{ color: "#06d6a0" }}>
                ✓ Traduzione completata
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { signOut } = useClerk();
  const { data: profile } = useGetMyProfile();
  const { t } = useTranslation();

  const sgi = profile?.sgiScore ?? null;
  const isPremium = profile?.plan === "premium" || profile?.plan === "pro";

  const NAV_SECTIONS = [
    {
      label: t("nav.core"),
      items: [
        { href: "/dashboard", label: t("nav.dashboard"), icon: Activity },
        { href: "/chat", label: t("nav.chat"), icon: MessageSquare },
      ],
    },
    {
      label: t("nav.explore"),
      items: [
        { href: "/leaderboard", label: t("nav.rank"), icon: Trophy },
        { href: "/map", label: t("nav.map"), icon: Network },
        { href: "/predictions", label: t("nav.predictions"), icon: LineChart },
        { href: "/recommendations", label: t("nav.growthPath"), icon: Lightbulb },
      ],
    },
    {
      label: t("nav.game"),
      items: [
        { href: "/gamification", label: t("nav.progress"), icon: Gamepad2 },
        { href: "/profile", label: t("nav.profile"), icon: User },
        { href: "/settings", label: t("nav.settings"), icon: Settings },
      ],
    },
  ];

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      {/* Sidebar */}
      <aside
        className="w-[214px] flex flex-col border-r flex-shrink-0"
        style={{ background: "hsl(var(--sidebar))", borderColor: "rgba(255,255,255,0.07)" }}
      >
        {/* Logo */}
        <div className="px-[18px] pt-[18px] pb-[22px]">
          <div
            className="font-display text-[15px] font-bold"
            style={{
              background: "linear-gradient(135deg, #7c6bff, #06d6a0)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            SGI
          </div>
          <span
            className="text-[9px] font-normal tracking-[0.6px] uppercase block mt-0.5"
            style={{ color: "rgba(144,144,184,0.6)" }}
          >
            Semantic Growth Index
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto">
          {NAV_SECTIONS.map((section) => (
            <div key={section.label}>
              <div
                className="px-[18px] pt-3 pb-[5px] text-[9px] font-medium uppercase tracking-[1px]"
                style={{ color: "rgba(74,74,106,1)" }}
              >
                {section.label}
              </div>
              {section.items.map((item) => {
                const active = location === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-center gap-[10px] px-[18px] py-[9px] text-[12.5px] my-[1px] transition-all duration-150 no-underline"
                    style={{
                      color: active ? "#fff" : "rgba(144,144,184,1)",
                      borderLeft: active ? "2px solid #7c6bff" : "2px solid transparent",
                      background: active
                        ? "linear-gradient(90deg, rgba(124,107,255,0.12), transparent)"
                        : "transparent",
                      fontWeight: active ? 500 : 400,
                    }}
                    onMouseEnter={(e) => {
                      if (!active) {
                        e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                        e.currentTarget.style.color = "#eeeeff";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!active) {
                        e.currentTarget.style.background = "transparent";
                        e.currentTarget.style.color = "rgba(144,144,184,1)";
                      }
                    }}
                  >
                    <item.icon
                      className="flex-shrink-0"
                      style={{ width: 15, height: 15, opacity: active ? 1 : 0.7 }}
                    />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-[14px] space-y-2">
          {/* Language Switcher */}
          <LanguageSwitcher />

          {/* Upgrade box (free users only) */}
          {!isPremium && (
            <div
              className="rounded-xl p-[14px]"
              style={{
                background: "linear-gradient(135deg, rgba(124,107,255,0.15), rgba(6,214,160,0.08))",
                border: "1px solid rgba(124,107,255,0.3)",
              }}
            >
              <div className="text-[12px] font-semibold text-foreground mb-[3px]">{t("nav.premiumPlan")}</div>
              <div className="text-[10px] mb-[10px] leading-[1.5]" style={{ color: "rgba(144,144,184,1)" }}>
                {t("nav.premiumDesc")}
              </div>
              <Link
                href="/settings"
                className="block w-full py-2 text-center text-[11px] font-semibold text-white rounded-lg no-underline transition-opacity hover:opacity-85"
                style={{ background: "linear-gradient(135deg, #7c6bff, #5b4de0)" }}
              >
                {t("nav.upgrade")}
              </Link>
            </div>
          )}

          {/* Disconnect */}
          <button
            onClick={() => signOut({ redirectUrl: "/" })}
            className="flex w-full items-center gap-3 px-3 py-2 rounded-md transition-colors text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOut className="w-4 h-4" />
            {t("nav.disconnect")}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* Topbar */}
        <header
          className="flex items-center justify-between px-6 py-3 flex-shrink-0 z-10"
          style={{
            background: "hsl(var(--sidebar))",
            borderBottom: "1px solid rgba(255,255,255,0.07)",
          }}
        >
          <div className="font-display text-[14px] font-semibold text-foreground">
            {NAV_SECTIONS.flatMap((s) => s.items).find((i) => i.href === location)?.label ?? "SGI"}
          </div>

          <div className="flex items-center gap-3">
            {sgi !== null && (
              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-full"
                style={{
                  background: "rgba(255,255,255,0.07)",
                  border: "1px solid rgba(255,255,255,0.13)",
                }}
              >
                <Zap className="w-3.5 h-3.5" style={{ color: "#7c6bff" }} />
                <span
                  className="font-display text-[15px] font-bold leading-none"
                  style={{
                    background: "linear-gradient(135deg, #7c6bff, #06d6a0)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                  }}
                >
                  {sgi.toFixed(1)}
                </span>
                <span className="text-[9px] tracking-[0.5px] uppercase" style={{ color: "rgba(74,74,106,1)" }}>
                  SGI
                </span>
                {(profile?.sgiDailyDelta ?? 0) !== 0 && (
                  <span
                    className="text-[11px] font-semibold"
                    style={{ color: (profile?.sgiDailyDelta ?? 0) >= 0 ? "#06d6a0" : "#f72585" }}
                  >
                    {(profile?.sgiDailyDelta ?? 0) > 0 ? "+" : ""}
                    {(profile?.sgiDailyDelta ?? 0).toFixed(1)}
                  </span>
                )}
              </div>
            )}
            {isPremium && (
              <span
                className="px-2.5 py-1 rounded-full text-[10px] font-semibold tracking-wide"
                style={{
                  background: "rgba(6,214,160,0.12)",
                  border: "1px solid rgba(6,214,160,0.25)",
                  color: "#4eeec0",
                }}
              >
                PREMIUM ✦
              </span>
            )}
          </div>
        </header>

        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(ellipse at 85% 15%, rgba(124,107,255,0.08) 0%, transparent 55%), radial-gradient(ellipse at 15% 85%, rgba(6,214,160,0.05) 0%, transparent 50%)",
          }}
        />

        <div className="flex-1 overflow-y-auto relative z-10 p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
