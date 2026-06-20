import { Link, useLocation } from "wouter";
import { useClerk } from "@clerk/react";
import { useGetMyProfile } from "@workspace/api-client-react";
import { useTranslation } from "react-i18next";
import {
  Activity,
  MessageSquare,
  Trophy,
  Network,
  User,
  LineChart,
  Lightbulb,
  Settings,
  LogOut,
  Zap,
  Gamepad2,
} from "lucide-react";

const LANGS = [
  { code: "it", flag: "🇮🇹", label: "IT" },
  { code: "en", flag: "🇬🇧", label: "EN" },
  { code: "es", flag: "🇪🇸", label: "ES" },
];

function LanguageSwitcher() {
  const { i18n: i18nHook } = useTranslation();
  const current = i18nHook.language;

  const handleChange = (code: string) => {
    i18nHook.changeLanguage(code);
    localStorage.setItem("sgi-lang", code);
  };

  return (
    <div className="flex items-center gap-1 px-1 py-1 rounded-lg" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
      {LANGS.map((lang) => (
        <button
          key={lang.code}
          onClick={() => handleChange(lang.code)}
          className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold transition-all duration-150"
          style={{
            background: current === lang.code ? "rgba(124,107,255,0.25)" : "transparent",
            color: current === lang.code ? "#a89fff" : "rgba(144,144,184,0.6)",
            border: current === lang.code ? "1px solid rgba(124,107,255,0.4)" : "1px solid transparent",
          }}
          title={lang.label}
        >
          <span>{lang.flag}</span>
          <span>{lang.label}</span>
        </button>
      ))}
    </div>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { signOut } = useClerk();
  const { data: profile } = useGetMyProfile();
  const { t } = useTranslation();

  const sgi = profile?.sgiScore ?? null;
  const isPremium = profile?.plan === "premium";

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
            {/* SGI Score Pill */}
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

            {/* Premium badge */}
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

        {/* Radial gradient background */}
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
