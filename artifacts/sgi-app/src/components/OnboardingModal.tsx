import { useState, useEffect } from "react";
import { useAuth } from "@clerk/react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";

export function OnboardingModal() {
  const { t } = useTranslation();
  const { isSignedIn } = useAuth();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  const STEPS = [
    { icon: "◈", title: t("onboarding.s1Title"), desc: t("onboarding.s1Desc") },
    { icon: "◉", title: t("onboarding.s2Title"), desc: t("onboarding.s2Desc") },
    { icon: "◆", title: t("onboarding.s3Title"), desc: t("onboarding.s3Desc") },
  ];

  useEffect(() => {
    if (isSignedIn && !localStorage.getItem("sgi-onboarded")) {
      const timer = setTimeout(() => setOpen(true), 1500);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isSignedIn]);

  const dismiss = () => {
    localStorage.setItem("sgi-onboarded", "1");
    setOpen(false);
  };

  if (!open) return null;

  const current = STEPS[step]!;
  const isLast = step === STEPS.length - 1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-300"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)" }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-8 relative animate-in zoom-in-95 duration-200"
        style={{ background: "#0d0f1f", border: "1px solid rgba(124,107,255,0.3)" }}
      >
        {/* Close */}
        <button
          onClick={dismiss}
          className="absolute top-4 right-4 w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors text-lg"
          aria-label={t("onboarding.skip")}
        >
          ✕
        </button>

        {/* Progress dots */}
        <div className="flex gap-1.5 mb-8 justify-center">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className="h-1 rounded-full transition-all duration-300"
              style={{
                width: i === step ? 24 : 8,
                background: i <= step ? "hsl(var(--primary))" : "rgba(255,255,255,0.15)",
              }}
            />
          ))}
        </div>

        {/* Icon */}
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 text-2xl font-bold"
          style={{
            background: "rgba(124,107,255,0.12)",
            border: "1px solid rgba(124,107,255,0.25)",
            color: "#7c6bff",
          }}
        >
          {current.icon}
        </div>

        <h2 className="text-xl font-bold text-center mb-3 text-foreground">{current.title}</h2>
        <p className="text-sm text-muted-foreground text-center leading-relaxed mb-8">{current.desc}</p>

        {isLast ? (
          <Link href="/chat?start=1" onClick={dismiss}>
            <button
              className="w-full py-3 rounded-xl font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: "linear-gradient(135deg, #7c6bff, #06d6a0)" }}
            >
              {t("onboarding.start")}
            </button>
          </Link>
        ) : (
          <button
            onClick={() => setStep((s) => s + 1)}
            className="w-full py-3 rounded-xl font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: "linear-gradient(135deg, #7c6bff, #5b4de0)" }}
          >
            {t("onboarding.next")}
          </button>
        )}

        {!isLast && (
          <button onClick={dismiss} className="w-full mt-3 text-xs text-muted-foreground hover:text-foreground transition-colors">
            {t("onboarding.skip")}
          </button>
        )}
      </div>
    </div>
  );
}
