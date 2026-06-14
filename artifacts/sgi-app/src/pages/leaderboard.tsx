import { useState } from "react";
import {
  useGetLeaderboard,
  useGetLeaderboardSummary,
  getGetLeaderboardQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus, Trophy, Users, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Leaderboard() {
  const [page, setPage] = useState(0);
  const limit = 50;

  const { data: leaderboard, isLoading } = useGetLeaderboard(
    { limit, offset: page * limit },
    { query: { queryKey: getGetLeaderboardQueryKey({ limit, offset: page * limit }) } }
  );
  const { data: summary, isLoading: summaryLoading } = useGetLeaderboardSummary();

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Global Rankings</h2>
        <p className="text-muted-foreground mt-1">Anonymous semantic growth leaderboard — real users, all disciplines</p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {summaryLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)
        ) : (
          <>
            <Card className="bg-card/50 backdrop-blur">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wider mb-1">
                  <Users className="w-3 h-3" /> Total Tracked
                </div>
                <div className="text-3xl font-bold font-mono text-white">{summary?.totalUsers.toLocaleString() ?? "--"}</div>
              </CardContent>
            </Card>
            <Card className="bg-card/50 backdrop-blur">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wider mb-1">
                  <Activity className="w-3 h-3" /> Average SGI
                </div>
                <div className="text-3xl font-bold font-mono text-white">{summary?.averageSgi.toFixed(1) ?? "--"}</div>
              </CardContent>
            </Card>
            <Card className="bg-card/50 backdrop-blur">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wider mb-1">
                  <Trophy className="w-3 h-3" /> Peak SGI
                </div>
                <div className="text-3xl font-bold font-mono text-primary">{summary?.topSgi.toFixed(1) ?? "--"}</div>
              </CardContent>
            </Card>
            <Card className="bg-card/50 backdrop-blur">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wider mb-1">
                  <Activity className="w-3 h-3" /> Active (7d)
                </div>
                <div className="text-3xl font-bold font-mono text-white">{summary?.usersActive7d.toLocaleString() ?? "--"}</div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Thresholds */}
      {!summaryLoading && summary && (
        <div className="flex gap-4 text-sm">
          <div className="px-3 py-1.5 bg-yellow-500/10 border border-yellow-500/20 rounded-md text-yellow-400 font-mono">
            Top 1%: SGI {summary.top1PercentThreshold.toFixed(1)}+
          </div>
          <div className="px-3 py-1.5 bg-primary/10 border border-primary/20 rounded-md text-primary font-mono">
            Top 10%: SGI {summary.top10PercentThreshold.toFixed(1)}+
          </div>
        </div>
      )}

      {/* Leaderboard Table */}
      <Card className="bg-card/30 backdrop-blur border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">Rankings</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground text-xs uppercase tracking-wider">
                      <th className="text-left pb-3 w-16">Rank</th>
                      <th className="text-left pb-3">Participant</th>
                      <th className="text-right pb-3">SGI Score</th>
                      <th className="text-right pb-3">Percentile</th>
                      <th className="text-right pb-3">30d Change</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {leaderboard?.entries.map((entry) => (
                      <tr
                        key={entry.rank}
                        data-testid={`row-leaderboard-${entry.rank}`}
                        className={`transition-colors ${
                          entry.isCurrentUser
                            ? "bg-primary/5 border-l-2 border-l-primary"
                            : "hover:bg-white/5"
                        }`}
                      >
                        <td className="py-3 pr-4">
                          <span className={`font-mono font-bold ${
                            entry.rank === 1 ? "text-yellow-400" :
                            entry.rank === 2 ? "text-slate-300" :
                            entry.rank === 3 ? "text-amber-600" :
                            "text-muted-foreground"
                          }`}>
                            #{entry.rank}
                          </span>
                        </td>
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            <span className={entry.isCurrentUser ? "text-primary font-medium" : "text-foreground"}>
                              {entry.displayName}
                            </span>
                            {entry.isCurrentUser && (
                              <Badge variant="outline" className="text-xs border-primary/50 text-primary">You</Badge>
                            )}
                          </div>
                        </td>
                        <td className="py-3 text-right font-mono font-bold text-foreground">
                          {entry.sgiScore.toFixed(1)}
                        </td>
                        <td className="py-3 text-right text-muted-foreground font-mono">
                          {entry.percentile.toFixed(1)}%
                        </td>
                        <td className="py-3 text-right">
                          {entry.rankChange30d === null || entry.rankChange30d === undefined ? (
                            <Minus className="w-4 h-4 text-muted-foreground inline" />
                          ) : entry.rankChange30d > 0 ? (
                            <span className="text-green-500 flex items-center justify-end gap-1 font-mono text-xs">
                              <TrendingUp className="w-3 h-3" />+{entry.rankChange30d}
                            </span>
                          ) : entry.rankChange30d < 0 ? (
                            <span className="text-red-500 flex items-center justify-end gap-1 font-mono text-xs">
                              <TrendingDown className="w-3 h-3" />{entry.rankChange30d}
                            </span>
                          ) : (
                            <Minus className="w-4 h-4 text-muted-foreground inline" />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                <span className="text-sm text-muted-foreground">
                  Showing {page * limit + 1}–{Math.min((page + 1) * limit, leaderboard?.total ?? 0)} of {leaderboard?.total?.toLocaleString() ?? "--"}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={page === 0}
                    data-testid="button-leaderboard-prev"
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => p + 1)}
                    disabled={(page + 1) * limit >= (leaderboard?.total ?? 0)}
                    data-testid="button-leaderboard-next"
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
