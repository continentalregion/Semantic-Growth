const PROJECT_ID = "xg4z0cgp0w";
let injected = false;

type ClarityFn = ((...args: unknown[]) => void) & { q?: unknown[][] };

function inject(): void {
  if (injected) return;
  injected = true;

  const w = window as Window & { clarity?: ClarityFn };
  w.clarity =
    w.clarity ||
    (function (...args: unknown[]) {
      (w.clarity!.q = w.clarity!.q || []).push(args);
    } as ClarityFn);

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.clarity.ms/tag/${PROJECT_ID}`;
  const first = document.getElementsByTagName("script")[0];
  first.parentNode?.insertBefore(script, first);
}

export function loadClarityIfConsented(): void {
  if (localStorage.getItem("sgi-cookie-consent") === "all") {
    inject();
  }
}

export function activateClarity(): void {
  inject();
}
