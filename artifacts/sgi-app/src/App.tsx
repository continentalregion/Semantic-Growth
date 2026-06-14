import { useEffect } from "react";
import { ClerkProvider, SignIn, SignUp, Show, useAuth, useUser } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { Switch, Route, useLocation, Router as WouterRouter, Redirect } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useSyncUser } from "@workspace/api-client-react";
import { setAuthTokenGetter } from "@workspace/api-client-react/custom-fetch";
import Layout from "@/components/layout";

// Pages
import Home from "@/pages/home";
import Dashboard from "@/pages/dashboard";
import Chat from "@/pages/chat";
import Leaderboard from "@/pages/leaderboard";
import MapPage from "@/pages/map";
import Profile from "@/pages/profile";
import Predictions from "@/pages/predictions";
import Recommendations from "@/pages/recommendations";
import Settings from "@/pages/settings";
import NotFound from "@/pages/not-found";

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
    colorPrimary: "hsl(199 89% 48%)",
    colorBackground: "hsl(222 47% 11%)",
    colorInputBackground: "hsl(217 33% 17%)",
    colorText: "hsl(210 40% 98%)",
    colorTextSecondary: "hsl(215 20.2% 65.1%)",
  },
  elements: {
    cardBox: "w-[440px] max-w-full bg-slate-900 border border-slate-800 rounded-xl",
    card: "bg-transparent shadow-none",
    footer: "bg-transparent",
  }
};

function SignInPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
    </div>
  );
}

function UserSync() {
  const { user, isLoaded, isSignedIn } = useUser();
  const { getToken } = useAuth();
  const syncUser = useSyncUser();

  useEffect(() => {
    setAuthTokenGetter(() => getToken());
  }, [getToken]);

  useEffect(() => {
    if (isLoaded && isSignedIn && user) {
      const email = user.primaryEmailAddress?.emailAddress;
      if (email) {
        syncUser.mutate({
          data: { clerkId: user.id, email }
        });
      }
    }
  }, [isLoaded, isSignedIn, user]);

  return null;
}

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isLoaded, isSignedIn } = useAuth();
  
  if (!isLoaded) return <div className="h-screen w-screen flex items-center justify-center">Loading...</div>;
  if (!isSignedIn) return <Redirect to="/sign-in" />;

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
        <UserSync />
        <Switch>
          <Route path="/" component={HomeRedirect} />
          <Route path="/sign-in/*?" component={SignInPage} />
          <Route path="/sign-up/*?" component={SignUpPage} />
          <Route path="/dashboard" component={() => <ProtectedRoute component={Dashboard} />} />
          <Route path="/chat" component={() => <ProtectedRoute component={Chat} />} />
          <Route path="/leaderboard" component={Leaderboard} />
          <Route path="/map" component={() => <ProtectedRoute component={MapPage} />} />
          <Route path="/profile" component={() => <ProtectedRoute component={Profile} />} />
          <Route path="/predictions" component={() => <ProtectedRoute component={Predictions} />} />
          <Route path="/recommendations" component={() => <ProtectedRoute component={Recommendations} />} />
          <Route path="/settings" component={() => <ProtectedRoute component={Settings} />} />
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
    </TooltipProvider>
  );
}

export default App;
