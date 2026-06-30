import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import {
  Network,
  ChevronRight,
  Activity,
  Trophy,
  TrendingUp,
  PenLine,
  GraduationCap,
  Megaphone,
  Menu,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";

function ScorePreview() {
  const { t } = useTranslation();
  const metrics = [
    { label: t("home.mDepth"), val: 82 },
    { label: t("home.mConnect"), val: 74 },
    { label: t("home.mRevision"), val: 91 },
  ];
  return (
    <div className="relative w-full max-w-md mx-auto">
      <div className="absolute -inset-6 bg-primary/20 blur-[80px] rounded-full pointer-events-none" aria-hidden="true" />
      <div className="relative rounded-3xl border border-border bg-card/60 backdrop-blur-xl p-7 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm text-muted-foreground font-medium">{t("home.scoreLabel")}</span>
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-chart-2 bg-chart-2/10 px-2.5 py-1 rounded-full">
            <TrendingUp className="w-3.5 h-3.5" aria-hidden="true" /> {t("home.scoreBadge")}
          </span>
        </div>
        <div className="flex items-end gap-2 mb-1">
          <span className="text-7xl font-extrabold tracking-tighter bg-clip-text text-transparent bg-gradient-to-br from-primary to-chart-2">
            {t("home.scoreValue")}
          </span>
          <span className="text-2xl text-muted-foreground font-semibold mb-2">{t("home.scoreOutOf")}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-chart-2 font-medium mb-5">
          <TrendingUp className="w-4 h-4" aria-hidden="true" /> {t("home.scoreDelta")}
        </div>
        <svg viewBox="0 0 300 70" className="w-full h-16 mb-5" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id="spark" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#7c6bff" />
              <stop offset="100%" stopColor="#06d6a0" />
            </linearGradient>
            <linearGradient id="sparkfill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#7c6bff" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#7c6bff" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d="M0,56 L43,50 L86,53 L129,40 L171,43 L214,27 L257,23 L300,9"
            fill="none"
            stroke="url(#spark)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M0,56 L43,50 L86,53 L129,40 L171,43 L214,27 L257,23 L300,9 L300,70 L0,70 Z"
            fill="url(#sparkfill)"
          />
        </svg>
        <div className="space-y-3">
          {metrics.map((m) => (
            <div key={m.label}>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted-foreground">{m.label}</span>
                <span className="text-foreground font-medium">{m.val}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-chart-2"
                  style={{ width: `${m.val}%` }}
                />
              </div>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground/70 mt-5 text-center">{t("home.scoreNote")}</p>
      </div>
    </div>
  );
}

export default function Home() {
  const { t, i18n } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    fetch("/api/healthz").catch(() => {});
  }, []);

  const handleLang = (code: string) => {
    i18n.changeLanguage(code);
    localStorage.setItem("sgi-lang", code);
  };

  const LANGS = [
    { code: "it", flag: "🇮🇹", name: "Italiano" },
    { code: "en", flag: "🇬🇧", name: "English" },
    { code: "es", flag: "🇪🇸", name: "Español" },
  ];

  const features = [
    { icon: Activity, title: t("home.telemetryTitle"), desc: t("home.telemetryDesc") },
    { icon: Network, title: t("home.mapsTitle"), desc: t("home.mapsDesc") },
    { icon: Trophy, title: t("home.rankTitle"), desc: t("home.rankDesc") },
  ];

  const useCases = [
    { icon: PenLine, title: t("home.ucWritersTitle"), desc: t("home.ucWritersDesc") },
    { icon: GraduationCap, title: t("home.ucStudentsTitle"), desc: t("home.ucStudentsDesc") },
    { icon: Megaphone, title: t("home.ucCreatorsTitle"), desc: t("home.ucCreatorsDesc") },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col overflow-hidden relative">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none" aria-hidden="true">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary/20 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-blue-600/20 blur-[120px]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />
      </div>

      <header className="container mx-auto px-6 py-5 flex items-center justify-between relative z-20">
        <Logo size={34} />
        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-x-4">
          <div className="flex items-center gap-1">
            {LANGS.map((l) => (
              <button
                key={l.code}
                onClick={() => handleLang(l.code)}
                className="px-2 py-1 rounded text-sm transition-colors hover:bg-white/10"
                style={{ opacity: i18n.language === l.code ? 1 : 0.5 }}
                aria-label={l.name}
                aria-pressed={i18n.language === l.code}
                title={l.name}
              >
                <span aria-hidden="true">{l.flag}</span>
              </button>
            ))}
          </div>
          <Button variant="ghost" asChild>
            <Link href="/how-it-works">{t("howItWorks.badge")}</Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link href="/sign-in">{t("home.signIn")}</Link>
          </Button>
          <Button asChild>
            <Link href="/sign-up">{t("home.initConnection")}</Link>
          </Button>
        </div>
        {/* Mobile nav */}
        <div className="flex md:hidden items-center gap-2">
          <div className="flex items-center gap-1">
            {LANGS.map((l) => (
              <button
                key={l.code}
                onClick={() => handleLang(l.code)}
                className="px-1.5 py-1 rounded text-sm transition-colors hover:bg-white/10"
                style={{ opacity: i18n.language === l.code ? 1 : 0.5 }}
                aria-label={l.name}
              >
                <span aria-hidden="true">{l.flag}</span>
              </button>
            ))}
          </div>
          <button
            className="p-2 rounded-md hover:bg-white/10 transition-colors text-foreground"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Menu"
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
        {/* Mobile dropdown */}
        {menuOpen && (
          <div
            className="absolute top-full left-0 right-0 z-50 flex flex-col gap-1 px-4 pb-4 md:hidden"
            style={{ background: "hsl(var(--background))", borderBottom: "1px solid rgba(255,255,255,0.1)" }}
          >
            <Button variant="ghost" className="justify-start" asChild>
              <Link href="/how-it-works" onClick={() => setMenuOpen(false)}>{t("howItWorks.badge")}</Link>
            </Button>
            <Button variant="ghost" className="justify-start" asChild>
              <Link href="/sign-in" onClick={() => setMenuOpen(false)}>{t("home.signIn")}</Link>
            </Button>
            <Button className="justify-start" asChild>
              <Link href="/sign-up" onClick={() => setMenuOpen(false)}>{t("home.initConnection")}</Link>
            </Button>
          </div>
        )}
      </header>

      {/* Hero — pitch + live score preview */}
      <section className="container mx-auto px-6 relative z-10 pt-10 md:pt-16 pb-20">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div className="text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-6">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" aria-hidden="true" />
              {t("home.live")}
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-6xl xl:text-7xl font-extrabold tracking-tighter mb-6 bg-clip-text text-transparent bg-gradient-to-br from-white to-gray-500">
              {t("home.headline")}
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-xl mx-auto lg:mx-0 mb-9 leading-relaxed">
              {t("home.sub")}
            </p>
            <div className="flex flex-col sm:flex-row items-center lg:items-start justify-center lg:justify-start gap-4">
              <Button size="lg" className="h-14 px-8 text-lg rounded-full" asChild>
                <Link href="/guest-battle">
                  {t("home.ctaGuest")} <ChevronRight className="ml-2 w-5 h-5" aria-hidden="true" />
                </Link>
              </Button>
              <Button size="lg" variant="ghost" className="h-14 px-6 text-lg rounded-full hover:bg-primary/10" asChild>
                <Link href="/sign-up">{t("home.ctaPrimary")}</Link>
              </Button>
            </div>
          </div>
          <ScorePreview />
        </div>
      </section>

      {/* Emblematic capabilities (the rest live in How It Works) */}
      <section className="container mx-auto px-6 relative z-10 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto text-left">
          {features.map((f) => (
            <div key={f.title} className="p-6 rounded-2xl bg-card/50 border border-border backdrop-blur-sm">
              <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                <f.icon className="w-5 h-5 text-primary" aria-hidden="true" /> {f.title}
              </h3>
              <p className="text-muted-foreground text-sm">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Use cases / social proof */}
      <section className="container mx-auto px-6 relative z-10 pb-20">
        <h2 className="text-3xl md:text-4xl font-bold text-center tracking-tight mb-3">
          {t("home.useCasesTitle")}
        </h2>
        <p className="text-muted-foreground text-center max-w-2xl mx-auto mb-12">
          {t("home.useCasesSub")}
        </p>
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {useCases.map((u) => (
            <div
              key={u.title}
              className="p-6 rounded-2xl bg-card/40 border border-border backdrop-blur-sm hover:border-primary/40 transition-colors"
            >
              <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
                <u.icon className="w-5 h-5 text-primary" aria-hidden="true" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{u.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{u.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="container mx-auto px-6 relative z-10 pb-24">
        <div className="rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 to-blue-600/10 p-10 md:p-16 text-center max-w-4xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">{t("home.finalCtaTitle")}</h2>
          <p className="text-muted-foreground mb-8 max-w-xl mx-auto">{t("home.finalCtaSub")}</p>
          <Button size="lg" className="h-14 px-8 text-lg rounded-full" asChild>
            <Link href="/sign-up">
              {t("home.ctaPrimary")} <ChevronRight className="ml-2 w-5 h-5" aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="container mx-auto px-6 pb-10 relative z-10">
        <div className="border-t border-border/50 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Semantic Growth Index — sgindex.work
          </p>
          <div className="flex items-center gap-5 text-xs text-muted-foreground">
            <Link href="/privacy-policy" className="hover:text-foreground transition-colors no-underline">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-foreground transition-colors no-underline">
              Termini di Servizio
            </Link>
            <a href="mailto:support@sgindex.work" className="hover:text-foreground transition-colors">
              Supporto
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
