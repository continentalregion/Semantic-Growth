import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Network, ChevronRight, Sparkles, Layers, Gauge, Swords, Trophy } from "lucide-react";
import { Logo } from "@/components/Logo";
import { useTranslation } from "react-i18next";

type NameDesc = { name: string; desc: string };
type Macro = { name: string; formula: string; desc: string };

export default function HowItWorks() {
  const { t, i18n } = useTranslation();

  const handleLang = (code: string) => {
    i18n.changeLanguage(code);
    localStorage.setItem("sgi-lang", code);
  };

  const LANGS = [
    { code: "it", flag: "🇮🇹" },
    { code: "en", flag: "🇬🇧" },
    { code: "es", flag: "🇪🇸" },
  ];

  const metrics = t("howItWorks.metrics", { returnObjects: true }) as NameDesc[];
  const macros = t("howItWorks.macros", { returnObjects: true }) as Macro[];
  const scorePoints = t("howItWorks.scorePoints", { returnObjects: true }) as string[];
  const battleSteps = t("howItWorks.battleSteps", { returnObjects: true }) as string[];
  const gamPoints = t("howItWorks.gamPoints", { returnObjects: true }) as string[];
  const sections = t("howItWorks.sections", { returnObjects: true }) as NameDesc[];

  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-hidden">
      {/* Decorative background */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary/20 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-blue-600/20 blur-[120px]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />
      </div>

      {/* Header */}
      <header className="container mx-auto px-6 py-6 flex items-center justify-between relative z-10">
        <Link href="/" className="flex items-center gap-2 hover-elevate rounded-lg px-1 py-1 -ml-1">
          <Logo size={32} />
        </Link>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            {LANGS.map((l) => (
              <button
                key={l.code}
                onClick={() => handleLang(l.code)}
                className="px-2 py-1 rounded text-sm transition-colors hover:bg-white/10"
                style={{ opacity: i18n.language === l.code ? 1 : 0.5 }}
                title={l.code.toUpperCase()}
              >
                {l.flag}
              </button>
            ))}
          </div>
          <Button variant="ghost" asChild size="sm">
            <Link href="/sign-in">{t("home.signIn")}</Link>
          </Button>
          <Button asChild>
            <Link href="/sign-up">{t("howItWorks.startCta")}</Link>
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-6 relative z-10 pb-24 max-w-5xl">
        {/* Hero */}
        <section className="text-center py-12 md:py-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-8">
            <Sparkles className="w-3.5 h-3.5" />
            {t("howItWorks.badge")}
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tighter mb-6 font-display bg-clip-text text-transparent bg-gradient-to-br from-white to-gray-500">
            {t("howItWorks.title")}
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            {t("howItWorks.subtitle")}
          </p>
        </section>

        {/* 11 metrics */}
        <Section icon={<Gauge className="w-5 h-5 text-primary" />} title={t("howItWorks.metricsTitle")} intro={t("howItWorks.metricsIntro")}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {metrics.map((m, i) => (
              <div key={m.name} className="p-5 rounded-2xl bg-card/50 border border-border backdrop-blur-sm flex gap-4">
                <div className="shrink-0 w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary text-sm font-bold font-display">
                  {String(i + 1).padStart(2, "0")}
                </div>
                <div>
                  <h3 className="font-semibold mb-1">{m.name}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{m.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* 4 macros */}
        <Section icon={<Layers className="w-5 h-5 text-primary" />} title={t("howItWorks.macrosTitle")} intro={t("howItWorks.macrosIntro")}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {macros.map((m) => (
              <div key={m.name} className="p-6 rounded-2xl card-glow border backdrop-blur-sm">
                <h3 className="text-lg font-semibold mb-2 font-display">{m.name}</h3>
                <code className="inline-block text-xs text-primary/90 bg-primary/10 border border-primary/20 rounded-md px-2 py-1 mb-3">
                  {m.formula}
                </code>
                <p className="text-sm text-muted-foreground leading-relaxed">{m.desc}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* SGI score */}
        <Section icon={<Sparkles className="w-5 h-5 text-primary" />} title={t("howItWorks.scoreTitle")} intro={t("howItWorks.scoreIntro")}>
          <ul className="space-y-3">
            {scorePoints.map((p, i) => (
              <li key={i} className="p-5 rounded-2xl bg-card/50 border border-border backdrop-blur-sm flex gap-3">
                <ChevronRight className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <p className="text-sm text-muted-foreground leading-relaxed">{p}</p>
              </li>
            ))}
          </ul>
        </Section>

        {/* Battle */}
        <Section icon={<Swords className="w-5 h-5 text-primary" />} title={t("howItWorks.battleTitle")} intro={t("howItWorks.battleIntro")}>
          <ol className="space-y-3">
            {battleSteps.map((s, i) => (
              <li key={i} className="p-5 rounded-2xl bg-card/50 border border-border backdrop-blur-sm flex gap-4">
                <div className="shrink-0 w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary text-sm font-bold font-display">
                  {i + 1}
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed self-center">{s}</p>
              </li>
            ))}
          </ol>
        </Section>

        {/* Gamification */}
        <Section icon={<Trophy className="w-5 h-5 text-primary" />} title={t("howItWorks.gamTitle")} intro={t("howItWorks.gamIntro")}>
          <ul className="space-y-3 mb-5">
            {gamPoints.map((p, i) => (
              <li key={i} className="p-5 rounded-2xl bg-card/50 border border-border backdrop-blur-sm flex gap-3">
                <ChevronRight className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <p className="text-sm text-muted-foreground leading-relaxed">{p}</p>
              </li>
            ))}
          </ul>
          <div
            className="p-5 rounded-2xl border text-sm leading-relaxed"
            style={{ background: "rgba(6,214,160,0.08)", borderColor: "rgba(6,214,160,0.25)", color: "#9fe9d3" }}
          >
            {t("howItWorks.xpIndependent")}
          </div>
        </Section>

        {/* Platform sections */}
        <Section icon={<Network className="w-5 h-5 text-primary" />} title={t("howItWorks.sectionsTitle")} intro={t("howItWorks.sectionsIntro")}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {sections.map((s) => (
              <div key={s.name} className="p-4 rounded-xl bg-card/50 border border-border backdrop-blur-sm">
                <h3 className="font-semibold text-sm mb-1">{s.name}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* CTA */}
        <section className="mt-16 text-center p-10 rounded-3xl card-glow border backdrop-blur-sm">
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight mb-3 font-display">
            {t("howItWorks.ctaTitle")}
          </h2>
          <p className="text-muted-foreground mb-8 max-w-xl mx-auto">{t("howItWorks.ctaSub")}</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" className="h-13 px-8 text-base rounded-full" asChild>
              <Link href="/sign-up">
                {t("howItWorks.startCta")} <ChevronRight className="ml-2 w-5 h-5" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="h-13 px-8 text-base rounded-full border-primary/30 hover:bg-primary/10" asChild>
              <Link href="/">{t("howItWorks.backHome")}</Link>
            </Button>
          </div>
        </section>
      </main>
    </div>
  );
}

function Section({
  icon,
  title,
  intro,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  intro: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-14">
      <div className="flex items-center gap-2 mb-2">
        <span className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
          {icon}
        </span>
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight font-display">{title}</h2>
      </div>
      <p className="text-muted-foreground mb-6 max-w-3xl leading-relaxed">{intro}</p>
      {children}
    </section>
  );
}
