import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Network, ChevronRight } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col overflow-hidden relative">
      {/* Background effects */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary/20 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-blue-600/20 blur-[120px]" />
        
        {/* Grid pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />
      </div>

      <header className="container mx-auto px-6 py-6 flex items-center justify-between relative z-10">
        <div className="flex items-center gap-2">
          <Network className="w-8 h-8 text-primary" />
          <span className="text-xl font-bold tracking-tight">SGI</span>
        </div>
        <div className="flex items-center gap-4">
          <Button variant="ghost" asChild>
            <Link href="/sign-in">Sign In</Link>
          </Button>
          <Button asChild>
            <Link href="/sign-up">Initialize Connection</Link>
          </Button>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-6 flex flex-col items-center justify-center text-center relative z-10 pb-20">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-8">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          Live cognitive telemetry online
        </div>
        
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tighter mb-6 max-w-4xl bg-clip-text text-transparent bg-gradient-to-br from-white to-gray-500">
          Track the evolution of your mind.
        </h1>
        
        <p className="text-xl text-muted-foreground max-w-2xl mb-10 leading-relaxed">
          The Semantic Growth Index (SGI) is a platform for tracking the evolution of your language, semantic exploration, and observable cognitive trajectories in conversation.
        </p>
        
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <Button size="lg" className="h-14 px-8 text-lg rounded-full" asChild>
            <Link href="/sign-up">
              Begin Tracking <ChevronRight className="ml-2 w-5 h-5" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" className="h-14 px-8 text-lg rounded-full border-primary/30 hover:bg-primary/10" asChild>
            <Link href="/sign-in">
              Access Dashboard
            </Link>
          </Button>
        </div>

        <div className="mt-24 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl text-left">
          <div className="p-6 rounded-2xl bg-card/50 border border-border backdrop-blur-sm">
            <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" /> Precision Telemetry
            </h3>
            <p className="text-muted-foreground text-sm">Real-time mapping of your conceptual complexity, semantic variety, and interdisciplinary connections.</p>
          </div>
          <div className="p-6 rounded-2xl bg-card/50 border border-border backdrop-blur-sm">
            <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
              <Network className="w-5 h-5 text-primary" /> Semantic Maps
            </h3>
            <p className="text-muted-foreground text-sm">Visualize your knowledge graph. Watch the nodes of understanding connect as you explore new domains.</p>
          </div>
          <div className="p-6 rounded-2xl bg-card/50 border border-border backdrop-blur-sm">
            <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-primary" /> Global Percentile
            </h3>
            <p className="text-muted-foreground text-sm">Anonymous ranking against thousands of other users. Measure your growth trajectory against the curve.</p>
          </div>
        </div>
      </main>
    </div>
  );
}

// Importing icons here so they are available
import { Activity, Trophy } from "lucide-react";
