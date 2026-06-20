import { useGetLeaderboardSummary } from "@workspace/api-client-react";
import { useGetMyProfile } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, Users, Activity, TrendingUp, Lock, Star, Zap } from "lucide-react";

function RankOrb({ rank, total }: { rank: number | null | undefined; total: number }) {
  const percentile = rank && total > 0 ? ((total - rank) / total) * 100 : null;
  const pct = percentile ?? 0;

  // Colore dell'orbita in base al percentile
  const orbitColor =
    pct >= 99 ? "#f0c040" :
    pct >= 90 ? "#a89fff" :
    pct >= 75 ? "#06d6a0" :
    "#7c6bff";

  const orbitLabel =
    pct >= 99 ? "Top 1%" :
    pct >= 90 ? "Top 10%" :
    pct >= 75 ? "Top 25%" :
    pct >= 50 ? "Top 50%" :
    "In crescita";

  // Arco SVG — la porzione riempita rappresenta il percentile
  const radius = 88;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - pct / 100);

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Orbita SVG */}
      <div className="relative" style={{ width: 220, height: 220 }}>
        <svg width="220" height="220" style={{ transform: "rotate(-90deg)" }}>
          {/* Traccia sfondo */}
          <circle
            cx="110" cy="110" r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth="10"
          />
          {/* Arco progresso */}
          <circle
            cx="110" cy="110" r={radius}
            fill="none"
            stroke={orbitColor}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={rank ? dashOffset : circumference}
            style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)", filter: `drop-shadow(0 0 8px ${orbitColor}88)` }}
          />
        </svg>
        {/* Contenuto centrale */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
          {rank ? (
            <>
              <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.35)" }}>Posizione</span>
              <span className="text-5xl font-black font-mono leading-none" style={{ color: orbitColor, filter: `drop-shadow(0 0 12px ${orbitColor}66)` }}>
                #{rank}
              </span>
              {percentile !== null && (
                <span className="text-xs font-semibold mt-1" style={{ color: orbitColor }}>{orbitLabel}</span>
              )}
            </>
          ) : (
            <>
              <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.35)" }}>Posizione</span>
              <span className="text-4xl font-black font-mono leading-none text-muted-foreground">—</span>
              <span className="text-xs text-muted-foreground mt-1">non ancora classificato</span>
            </>
          )}
        </div>
      </div>

      {/* Percentile testuale */}
      {percentile !== null && rank && (
        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            Hai superato il{" "}
            <span className="font-bold" style={{ color: orbitColor }}>
              {percentile.toFixed(1)}%
            </span>{" "}
            degli utenti tracciati
          </p>
        </div>
      )}
    </div>
  );
}

function ThresholdBar({
  label,
  threshold,
  userSgi,
  color,
}: {
  label: string;
  threshold: number;
  userSgi: number;
  color: string;
}) {
  const reached = userSgi >= threshold;
  const progress = reached ? 100 : Math.min(99, (userSgi / threshold) * 100);
  const gap = threshold - userSgi;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5">
          {reached ? (
            <Star className="w-3.5 h-3.5" style={{ color }} />
          ) : (
            <Lock className="w-3.5 h-3.5 text-muted-foreground" />
          )}
          <span className={reached ? "font-semibold" : "text-muted-foreground"} style={reached ? { color } : {}}>
            {label}
          </span>
        </div>
        <span className="font-mono text-muted-foreground">
          {reached ? "✓ raggiunto" : `SGI ${threshold.toFixed(1)}+ (ti mancano ${gap.toFixed(1)})`}
        </span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
        <div
          className="h-full rounded-full transition-all duration-1000"
          style={{
            width: `${progress}%`,
            background: reached
              ? `linear-gradient(90deg, ${color}99, ${color})`
              : "rgba(255,255,255,0.15)",
          }}
        />
      </div>
    </div>
  );
}

export default function Leaderboard() {
  const { data: profile, isLoading: profileLoading } = useGetMyProfile();
  const { data: summary, isLoading: summaryLoading } = useGetLeaderboardSummary();

  const isLoading = profileLoading || summaryLoading;

  const userSgi    = profile?.sgiScore ?? 0;
  const userRank   = profile?.globalRank ?? null;
  const totalUsers = summary?.totalUsers ?? 0;

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-2xl mx-auto">

      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Il tuo Rank</h2>
        <p className="text-muted-foreground mt-1">
          La tua posizione nell'ecosistema semantico globale — solo tu puoi vedere questo dato.
        </p>
      </div>

      {/* Orbita principale */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Skeleton className="w-[220px] h-[220px] rounded-full" />
        </div>
      ) : (
        <div className="flex justify-center py-4">
          <RankOrb rank={userRank} total={totalUsers} />
        </div>
      )}

      {/* SGI personale + stats aggregate */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {/* SGI score */}
          <div
            className="rounded-2xl p-5 flex flex-col gap-1"
            style={{ background: "rgba(124,107,255,0.08)", border: "1px solid rgba(124,107,255,0.2)" }}
          >
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider" style={{ color: "#a89fff" }}>
              <Zap className="w-3.5 h-3.5" /> Il tuo SGI
            </div>
            <div className="text-4xl font-black font-mono mt-1" style={{ color: "#a89fff" }}>
              {userSgi > 0 ? userSgi.toFixed(1) : "—"}
            </div>
            <div className="text-xs text-muted-foreground">indice di crescita semantica</div>
          </div>

          {/* Media community */}
          <div
            className="rounded-2xl p-5 flex flex-col gap-1"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Activity className="w-3.5 h-3.5" /> Media community
            </div>
            <div className="text-4xl font-black font-mono mt-1 text-foreground">
              {summary?.averageSgi.toFixed(1) ?? "—"}
            </div>
            {userSgi > 0 && summary?.averageSgi && (
              <div className="text-xs" style={{ color: userSgi >= summary.averageSgi ? "#06d6a0" : "#f72585" }}>
                {userSgi >= summary.averageSgi
                  ? `+${(userSgi - summary.averageSgi).toFixed(1)} sopra la media`
                  : `${(userSgi - summary.averageSgi).toFixed(1)} sotto la media`}
              </div>
            )}
          </div>

          {/* Utenti totali */}
          <div
            className="rounded-2xl p-5 flex flex-col gap-1"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Users className="w-3.5 h-3.5" /> Utenti tracciati
            </div>
            <div className="text-4xl font-black font-mono mt-1 text-foreground">
              {totalUsers > 0 ? totalUsers.toLocaleString("it-IT") : "—"}
            </div>
            <div className="text-xs text-muted-foreground">nella rete SGI</div>
          </div>

          {/* Picco assoluto */}
          <div
            className="rounded-2xl p-5 flex flex-col gap-1"
            style={{ background: "rgba(240,192,64,0.06)", border: "1px solid rgba(240,192,64,0.2)" }}
          >
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider" style={{ color: "#f0c040" }}>
              <Trophy className="w-3.5 h-3.5" /> Picco assoluto
            </div>
            <div className="text-4xl font-black font-mono mt-1" style={{ color: "#f0c040" }}>
              {summary?.topSgi.toFixed(1) ?? "—"}
            </div>
            <div className="text-xs text-muted-foreground">SGI più alto registrato</div>
          </div>
        </div>
      )}

      {/* Soglie di eccellenza */}
      {!isLoading && summary && (
        <div
          className="rounded-2xl p-6 space-y-5"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold">Soglie di eccellenza</span>
          </div>
          <ThresholdBar
            label="Top 10%"
            threshold={summary.top10PercentThreshold}
            userSgi={userSgi}
            color="#a89fff"
          />
          <ThresholdBar
            label="Top 1%"
            threshold={summary.top1PercentThreshold}
            userSgi={userSgi}
            color="#f0c040"
          />
          <ThresholdBar
            label="Picco assoluto"
            threshold={summary.topSgi}
            userSgi={userSgi}
            color="#06d6a0"
          />
        </div>
      )}

      {/* Privacy notice */}
      <div
        className="rounded-2xl p-5 flex items-start gap-3"
        style={{ background: "rgba(124,107,255,0.05)", border: "1px solid rgba(124,107,255,0.15)" }}
      >
        <Lock className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#a89fff" }} />
        <div className="space-y-1">
          <p className="text-sm font-medium" style={{ color: "#a89fff" }}>Classifica privata</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            La classifica completa non è pubblica. Ogni utente vede solo la propria posizione.
            Il tuo rank è calcolato in forma anonima rispetto alla community senza esporre i dati degli altri.
          </p>
        </div>
      </div>

      {/* Nessun rank ancora */}
      {!isLoading && !userRank && (
        <div className="text-center py-4">
          <p className="text-sm text-muted-foreground">
            Il tuo rank apparirà dopo le prime conversazioni. Inizia a esplorare per essere classificato.
          </p>
        </div>
      )}

    </div>
  );
}
