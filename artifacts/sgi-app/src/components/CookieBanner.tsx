import { useState, useEffect } from "react";
import { Link } from "wouter";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";

export function CookieBanner() {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem("sgi-cookie-consent");
    if (!consent) {
      const timer = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, []);

  const accept = (type: "all" | "essential") => {
    localStorage.setItem("sgi-cookie-consent", type);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 animate-in slide-in-from-bottom-4 duration-300"
      style={{ background: "hsl(var(--sidebar))", borderTop: "1px solid rgba(255,255,255,0.1)" }}
    >
      <div className="container mx-auto px-4 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <p className="text-xs text-muted-foreground flex-1 leading-relaxed">
          {t("cookie.text")}{" "}
          <Link href="/privacy-policy" className="text-primary underline hover:opacity-80 transition-opacity">
            Privacy Policy
          </Link>
        </p>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => accept("essential")}
            className="px-3 py-1.5 rounded-md text-xs border border-border text-muted-foreground hover:bg-white/5 transition-colors"
          >
            {t("cookie.essential")}
          </button>
          <button
            onClick={() => accept("all")}
            className="px-4 py-1.5 rounded-md text-xs font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: "hsl(var(--primary))" }}
          >
            {t("cookie.acceptAll")}
          </button>
          <button
            onClick={() => accept("essential")}
            className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
            aria-label={t("cookie.close")}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
