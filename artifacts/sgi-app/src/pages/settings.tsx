import { useState } from "react";
import { useUser } from "@clerk/react";
import { useGetMyProfile } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Crown, User, Shield, CheckCircle2 } from "lucide-react";

export default function Settings() {
  const { user } = useUser();
  const { data: profile, isLoading } = useGetMyProfile();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const isPremium = profile?.plan === "premium";

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-2xl">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
        <p className="text-muted-foreground mt-1">Account configuration and subscription management</p>
      </div>

      {/* Account Card */}
      <Card className="bg-card/40 backdrop-blur border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><User className="w-5 h-5 text-primary" /> Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium">Email</p>
              <p className="text-sm text-muted-foreground" data-testid="text-account-email">
                {user?.primaryEmailAddress?.emailAddress ?? profile?.email ?? "—"}
              </p>
            </div>
          </div>
          <Separator />
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium">Plan</p>
              <p className="text-sm text-muted-foreground">Your current subscription tier</p>
            </div>
            <Badge
              variant="outline"
              className={isPremium ? "border-yellow-500/50 text-yellow-400 bg-yellow-500/10" : "border-muted"}
              data-testid="badge-plan"
            >
              {isPremium ? (
                <><Crown className="w-3 h-3 mr-1" /> Premium</>
              ) : "Free"}
            </Badge>
          </div>
          <Separator />
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium">Member since</p>
              <p className="text-sm text-muted-foreground font-mono">
                {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString() : "—"}
              </p>
            </div>
          </div>
          <Separator />
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium">SGI Score</p>
              <p className="text-sm text-muted-foreground font-mono">Current semantic growth index</p>
            </div>
            <span className="text-2xl font-bold font-mono text-primary" data-testid="text-settings-sgi">
              {profile?.sgiScore?.toFixed(1) ?? "—"}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Plan Card */}
      {!isPremium && (
        <Card className="bg-gradient-to-br from-primary/5 to-transparent border-primary/20 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-primary">
              <Crown className="w-5 h-5" /> Upgrade to Premium
            </CardTitle>
            <CardDescription>Unlock the full semantic growth toolkit</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-2">
              {[
                "Predictive growth simulation (30/90/180 day)",
                "Advanced semantic domain network visualization",
                "Priority AI scoring and analysis",
                "Extended SGI history (90 days)",
                "Monthly detailed growth report",
              ].map(feature => (
                <li key={feature} className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
            <Button
              className="w-full gap-2 mt-2"
              data-testid="button-upgrade-premium"
              onClick={() => setShowUpgradeModal(true)}
            >
              <Crown className="w-4 h-4" />
              Upgrade Plan
            </Button>
          </CardContent>
        </Card>
      )}

      {isPremium && (
        <Card className="bg-card/40 backdrop-blur border-yellow-500/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-yellow-400">
              <Crown className="w-5 h-5" /> Premium Active
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">You have full access to all premium features including predictions, advanced maps, and extended history.</p>
          </CardContent>
        </Card>
      )}

      {/* Privacy */}
      <Card className="bg-card/40 backdrop-blur border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Shield className="w-5 h-5 text-primary" /> Privacy</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium">Leaderboard Listing</p>
              <p className="text-xs text-muted-foreground">Your display name is anonymized on the public leaderboard</p>
            </div>
            <Badge variant="outline" className="text-muted-foreground">Anonymous</Badge>
          </div>
          <Separator />
          <p className="text-xs text-muted-foreground leading-relaxed">
            SGI tracks your semantic and linguistic patterns across conversations. No personally identifiable content is stored. Conversation text is processed to generate growth indices and is not retained for purposes other than your own scoring history.
          </p>
        </CardContent>
      </Card>

      {/* Upgrade Modal */}
      {showUpgradeModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md bg-card border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-primary">
                <Crown className="w-5 h-5" /> Premium Upgrade
              </CardTitle>
              <CardDescription>Payment processing coming soon. Premium features are currently in beta.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">The payment integration is in development. Premium features will be available once billing is configured.</p>
              <Button variant="outline" className="w-full" onClick={() => setShowUpgradeModal(false)} data-testid="button-close-upgrade-modal">
                Close
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
