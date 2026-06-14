import { Link, useLocation } from "wouter";
import { useClerk } from "@clerk/react";
import { 
  Activity, 
  MessageSquare, 
  Trophy, 
  Network, 
  User, 
  LineChart, 
  Lightbulb, 
  Settings,
  LogOut
} from "lucide-react";

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { signOut } = useClerk();

  const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: Activity },
    { href: "/chat", label: "Semantic Chat", icon: MessageSquare },
    { href: "/map", label: "Semantic Map", icon: Network },
    { href: "/predictions", label: "Predictions", icon: LineChart },
    { href: "/recommendations", label: "Growth Path", icon: Lightbulb },
    { href: "/profile", label: "Profile", icon: User },
    { href: "/leaderboard", label: "Global Rank", icon: Trophy },
    { href: "/settings", label: "Settings", icon: Settings },
  ];

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 flex flex-col border-r border-border bg-card/30 backdrop-blur-md">
        <div className="p-6 border-b border-border">
          <h1 className="text-xl font-bold tracking-tight text-primary flex items-center gap-2">
            <Network className="w-6 h-6" />
            SGI
          </h1>
          <p className="text-xs text-muted-foreground mt-1 tracking-wider uppercase">Semantic Growth Index</p>
        </div>
        
        <nav className="flex-1 overflow-y-auto py-4">
          <ul className="space-y-1 px-3">
            {navItems.map((item) => {
              const active = location === item.href;
              return (
                <li key={item.href}>
                  <Link 
                    href={item.href}
                    className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-sm font-medium ${
                      active 
                        ? "bg-primary/10 text-primary" 
                        : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                    }`}
                  >
                    <item.icon className={`w-4 h-4 ${active ? "text-primary" : ""}`} />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="p-4 border-t border-border">
          <button 
            onClick={() => signOut({ redirectUrl: "/" })}
            className="flex w-full items-center gap-3 px-3 py-2 rounded-md transition-colors text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOut className="w-4 h-4" />
            Disconnect
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* Subtle radial gradient background */}
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-background to-background" />
        
        <div className="flex-1 overflow-y-auto relative z-10 p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
