import { useEffect, useRef, useState } from "react";
import { ClerkProvider, SignIn, SignUp, Show, useAuth, useUser, useClerk } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { Switch, Route, useLocation, Router as WouterRouter, Redirect } from "wouter";
import { QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useSyncUser, useGetMyProfile } from "@workspace/api-client-react";
import Layout from "@/components/layout";
import { Logo } from "@/components/Logo";

// Pages
import Home from "@/pages/home";
import HowItWorks from "@/pages/how-it-works";
import Dashboard from "@/pages/dashboard";
import Chat from "@/pages/chat";
import Leaderboard from "@/pages/leaderboard";
import MapPage from "@/pages/map";
import Profile from "@/pages/profile";
import Predictions from "@/pages/predictions";
import Recommendations from "@/pages/recommendations";
import Gamification from "@/pages/gamification";
import Settings from "@/pages/settings";
import NotFound from "@/pages/not-found";
import ThreadsPage from "@/pages/threads";
import ThreadDetailPage from "@/pages/thread-detail";
import BattleSessionPage from "@/pages/battle-session";
import BattleCardPage from "@/pages/battle-card";
import BattlesPage from "@/pages/battles";
import AdminPage from "@/pages/admin";

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY in .env file");
}

const clerkAppearance = {
  cssLayerName: "clerk",
  variables: {
    colorPrimary: "#7c6bff",
    colorBackground: "transparent",
    colorInput: "rgba(124,107,255,0.07)",
    colorInputForeground: "#eeeeff",
    colorForeground: "#eeeeff",
    colorMutedForeground: "#9090b8",
    colorDanger: "#f72585",
    colorNeutral: "rgba(124,107,255,0.3)",
    borderRadius: "10px",
    fontFamily: "'Space Grotesk', 'Inter', sans-serif",
  },
  elements: {
    cardBox: {
      style: {
        width: "100%",
        maxWidth: "420px",
        boxShadow: "none",
        border: "none",
        background: "transparent",
      },
    },
    card: { style: { background: "transparent", boxShadow: "none", padding: "0" } },
    footer: { style: { background: "transparent" } },
    formFieldInput: { className: "sgi-clerk-input" },
    formButtonPrimary: { className: "sgi-clerk-btn" },
    socialButtonsBlockButton: { className: "sgi-clerk-social" },
  },
};

const AUTH_FEATURES = [
  { icon: "◈", label: "Cognitive telemetry", desc: "13 semantic dimensions tracked in real time" },
  { icon: "◉", label: "Global leaderboard", desc: "Rank your growth among thousands of thinkers" },
  { icon: "◆", label: "Predictive simulation", desc: "AI forecast of your semantic growth curve" },
];

function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] bg-background">
      <div
        className="hidden lg:flex flex-col justify-between w-[44%] shrink-0 px-14 py-12 relative overflow-hidden"
        style={{
          background: "linear-gradient(145deg, #0d0c1f 0%, #12103a 55%, #0e1a2e 100%)",
          borderRight: "1px solid rgba(124,107,255,0.15)",
        }}
      >
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute top-[-15%] left-[-10%] w-[60%] h-[60%] rounded-full blur-[120px]"
            style={{ background: "rgba(124,107,255,0.18)" }}
          />
          <div
            className="absolute bottom-[-10%] right-[-15%] w-[50%] h-[50%] rounded-full blur-[120px]"
            style={{ background: "rgba(6,214,160,0.1)" }}
          />
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                "linear-gradient(rgba(124,107,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(124,107,255,0.04) 1px, transparent 1px)",
              backgroundSize: "32px 32px",
            }}
          />
        </div>

        <div className="relative z-10">
          <Logo size={36} className="mb-16" />

          <h2
            className="text-4xl font-extrabold leading-tight mb-5 font-display"
            style={{ color: "#eeeeff" }}
          >
            Track the evolution
            <br />
            <span
              style={{
                background: "linear-gradient(90deg,#7c6bff,#06d6a0)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              of your mind.
            </span>
          </h2>
          <p className="text-sm leading-relaxed mb-12" style={{ color: "#9090b8" }}>
            A platform for measuring cognitive growth across 13 semantic dimensions — in real time.
          </p>

          <div className="flex flex-col gap-5">
            {AUTH_FEATURES.map((f) => (
              <div key={f.label} className="flex items-start gap-4">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-base font-bold"
                  style={{
                    background: "rgba(124,107,255,0.12)",
                    border: "1px solid rgba(124,107,255,0.25)",
                    color: "#7c6bff",
                  }}
                >
                  {f.icon}
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: "#eeeeff" }}>{f.label}</p>
                  <p className="text-xs mt-0.5" style={{ color: "#9090b8" }}>{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-1.5 mb-3">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="w-2 h-2 rounded-full"
                style={{ background: i < 4 ? "#7c6bff" : "rgba(124,107,255,0.3)" }}
              />
            ))}
          </div>
          <p className="text-xs italic leading-relaxed" style={{ color: "#9090b8" }}>
            "SGI made me realize how narrow my thinking was — now I actively seek out new domains."
          </p>
          <p className="text-xs mt-1.5 font-semibold" style={{ color: "#7c6bff" }}>
            — Community member, Level 12
          </p>
        </div>
      </div>

      <div
        className="flex flex-1 items-center justify-center px-6 py-12 relative"
        style={{ background: "#0a0b18" }}
      >
        <div
          className="absolute top-0 right-0 w-[40%] h-[40%] rounded-full blur-[100px] pointer-events-none"
          style={{ background: "rgba(124,107,255,0.07)" }}
        />
        <div className="w-full max-w-[420px] relative z-10">
          {children}
        </div>
      </div>
    </div>
  );
}

function ConnectingScreen() {
  return (
    <div
      className="h-screen w-screen flex flex-col items-center justify-center gap-6"
      style={{ background: "#08090f" }}
    >
      <div className="relative flex items-center justify-center w-16 h-16">
        <div
          className="absolute inset-0 rounded-full animate-ping"
          style={{ background: "rgba(124,107,255,0.25)" }}
        />
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center"
          style={{ background: "linear-gradient(135deg,#7c6bff,#06d6a0)" }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
            <path d="M3 17 L9 11 L13 14.5 L21 6" />
            <circle cx="3" cy="17" r="1.7" fill="white" stroke="none" />
            <circle cx="9" cy="11" r="1.7" fill="white" stroke="none" />
            <circle cx="13" cy="14.5" r="1.7" fill="white" stroke="none" />
            <circle cx="21" cy="6" r="2.4" fill="white" stroke="none" />
          </svg>
        </div>
      </div>
      <div className="text-center space-y-2">
        <p className="text-sm font-semibold tracking-widest uppercase" style={{ color: "#7c6bff", letterSpacing: "0.18em" }}>
          SGI
        </p>
        <p className="text-xs" style={{ color: "rgba(144,144,184,0.7)" }}>
          Connecting to intelligence engine…
        </p>
      </div>
      <div className="flex gap-1.5 mt-2">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="typing-dot"
            style={{ animationDelay: `${i * 0.18}s`, background: "#7c6bff" }}
          />
        ))}
      </div>
    </div>
  );
}

function SignInPage() {
  return (
    <AuthLayout>
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
    </AuthLayout>
  );
}

function SignUpPage() {
  return (
    <AuthLayout>
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
    </AuthLayout>
  );
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        qc.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, qc]);

  return null;
}

function UserSync() {
  const { user, isLoaded, isSignedIn } = useUser();
  const syncUser = useSyncUser();
  const attemptRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user) return;
    const email = user.primaryEmailAddress?.emailAddress;
    if (!email) return;

    attemptRef.current = 0;

    const trySync = () => {
      syncUser.mutate(
        { data: { clerkId: user.id, email } },
        {
          onSuccess: () => {
            attemptRef.current = 0;
          },
          onError: () => {
            if (attemptRef.current < 5) {
              attemptRef.current += 1;
              const delay = Math.min(1000 * 2 ** attemptRef.current, 12000);
              timerRef.current = setTimeout(trySync, delay);
            }
          },
        }
      );
    };

    trySync();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isLoaded, isSignedIn, user?.id]);

  return null;
}

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isLoaded, isSignedIn } = useAuth();
  const { data: profile, isLoading: profileLoading } = useGetMyProfile();
  const [splashExpired, setSplashExpired] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setSplashExpired(true), 8000);
    return () => clearTimeout(t);
  }, []);

  if (!isLoaded) return <ConnectingScreen />;
  if (!isSignedIn) return <Redirect to="/sign-in" />;

  if (!profile && profileLoading && !splashExpired) return <ConnectingScreen />;

  return (
    <Layout>
      <Component />
    </Layout>
  );
}

function HomeRedirect() {
  return (
    <>
      <Show when="signed-in">
        <Redirect to="/dashboard" />
      </Show>
      <Show when="signed-out">
        <Home />
      </Show>
    </>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <UserSync />
        <Switch>
          <Route path="/" component={HomeRedirect} />
          <Route path="/sign-in/*?" component={SignInPage} />
          <Route path="/sign-up/*?" component={SignUpPage} />
          <Route path="/how-it-works" component={HowItWorks} />
          <Route path="/dashboard" component={() => <ProtectedRoute component={Dashboard} />} />
          <Route path="/chat" component={() => <ProtectedRoute component={Chat} />} />
          <Route path="/leaderboard" component={Leaderboard} />
          <Route path="/map" component={() => <ProtectedRoute component={MapPage} />} />
          <Route path="/profile" component={() => <ProtectedRoute component={Profile} />} />
          <Route path="/predictions" component={() => <ProtectedRoute component={Predictions} />} />
          <Route path="/recommendations" component={() => <ProtectedRoute component={Recommendations} />} />
          <Route path="/gamification" component={() => <ProtectedRoute component={Gamification} />} />
          <Route path="/settings" component={() => <ProtectedRoute component={Settings} />} />
          <Route path="/battles" component={() => <ProtectedRoute component={BattlesPage} />} />
          <Route path="/threads" component={() => <ProtectedRoute component={ThreadsPage} />} />
          <Route path="/threads/:id/battle" component={() => <ProtectedRoute component={BattleSessionPage} />} />
          <Route path="/threads/:id" component={() => <ProtectedRoute component={ThreadDetailPage} />} />
          <Route path="/battle-cards/:id" component={() => <ProtectedRoute component={BattleCardPage} />} />
          <Route path="/admin" component={() => <ProtectedRoute component={AdminPage} />} />
          <Route component={NotFound} />
        </Switch>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <TooltipProvider>
      <WouterRouter base={basePath}>
        <ClerkProviderWithRoutes />
      </WouterRouter>
      <Toaster />
      <Sonner theme="dark" position="top-right" richColors />
    </TooltipProvider>
  );
}

export default App;
