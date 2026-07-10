import { useState } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronLeft, MessageCircleQuestion, Check, Pencil, Trash2, X } from "lucide-react";
import {
  useGetThreadCandidates,
  useUpdateThreadCandidate,
  useConfirmThreadCandidate,
  useDiscardThreadCandidate,
  getGetThreadCandidatesQueryKey,
  type ThreadCandidate,
} from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";

function CandidateCard({ candidate }: { candidate: ThreadCandidate }) {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [question, setQuestion] = useState(candidate.question);
  const [description, setDescription] = useState(candidate.description ?? "");

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getGetThreadCandidatesQueryKey() });

  const update = useUpdateThreadCandidate({
    mutation: {
      onSuccess: () => {
        toast.success(t("threads.candidate.savedToast"));
        setEditing(false);
        invalidate();
      },
    },
  });
  const confirm = useConfirmThreadCandidate({
    mutation: {
      onSuccess: (data) => {
        toast.success(t("threads.candidate.confirmedToast"));
        invalidate();
        navigate(`/threads/${data.threadId}`);
      },
    },
  });
  const discard = useDiscardThreadCandidate({
    mutation: {
      onSuccess: () => {
        toast.success(t("threads.candidate.discardedToast"));
        invalidate();
      },
    },
  });

  const metrics = (candidate.metricsSnapshot ?? {}) as Record<string, number | null>;

  return (
    <div
      className="rounded-xl p-4 space-y-3"
      style={{ border: "1px solid hsl(var(--sidebar-border))", background: "hsl(var(--card))" }}
    >
      <div className="flex items-start gap-2.5">
        <div
          className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center"
          style={{ background: "var(--sgi-teal, #06d6a0)22" }}
        >
          <MessageCircleQuestion className="w-4 h-4" style={{ color: "var(--sgi-teal, #06d6a0)" }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-foreground">
            {candidate.aiTitle ?? candidate.question}
          </p>
          {editing ? (
            <div className="mt-2 space-y-2">
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                className="w-full text-[13px] p-2 rounded-md bg-transparent resize-none"
                style={{ border: "1px solid hsl(var(--sidebar-border))" }}
                rows={2}
              />
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full text-[12px] p-2 rounded-md bg-transparent resize-none"
                style={{ border: "1px solid hsl(var(--sidebar-border))" }}
                rows={2}
              />
            </div>
          ) : (
            <>
              <p className="text-[13px] mt-1" style={{ color: "hsl(var(--muted-foreground))" }}>
                {candidate.question}
              </p>
              {candidate.description && (
                <p className="text-[12px] mt-1" style={{ color: "hsl(var(--muted-foreground))" }}>
                  {candidate.description}
                </p>
              )}
            </>
          )}
          {candidate.motivationBlurb && !editing && (
            <div className="mt-2 text-[11.5px] rounded-md p-2" style={{ background: "hsl(var(--sidebar-accent))" }}>
              <span className="font-semibold">{t("threads.candidate.motivationLabel")}: </span>
              {candidate.motivationBlurb}
            </div>
          )}
        </div>
      </div>

      {metrics && Object.keys(metrics).length > 0 && !editing && (
        <div className="flex gap-3 text-[10.5px] flex-wrap" style={{ color: "hsl(var(--muted-foreground))" }}>
          {Object.entries(metrics)
            .filter(([, v]) => v != null)
            .slice(0, 4)
            .map(([k, v]) => (
              <span key={k}>{k}: {typeof v === "number" ? v.toFixed(1) : String(v)}</span>
            ))}
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        {editing ? (
          <>
            <button
              onClick={() => update.mutate({ id: candidate.id, data: { question, description } })}
              disabled={update.isPending}
              className="flex-1 flex items-center justify-center gap-1.5 text-[12.5px] font-medium py-2 rounded-lg"
              style={{ background: "var(--sgi-purple)", color: "white" }}
            >
              <Check className="w-3.5 h-3.5" /> {t("threads.candidate.save")}
            </button>
            <button
              onClick={() => { setEditing(false); setQuestion(candidate.question); setDescription(candidate.description ?? ""); }}
              className="flex items-center justify-center gap-1.5 text-[12.5px] font-medium py-2 px-3 rounded-lg"
              style={{ border: "1px solid hsl(var(--sidebar-border))" }}
            >
              <X className="w-3.5 h-3.5" /> {t("threads.candidate.cancel")}
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => confirm.mutate({ id: candidate.id })}
              disabled={confirm.isPending}
              className="flex-1 flex items-center justify-center gap-1.5 text-[12.5px] font-medium py-2 rounded-lg"
              style={{ background: "var(--sgi-teal, #06d6a0)", color: "white" }}
            >
              <Check className="w-3.5 h-3.5" /> {t("threads.candidate.confirmBtn")}
            </button>
            <button
              onClick={() => setEditing(true)}
              className="flex items-center justify-center gap-1.5 text-[12.5px] font-medium py-2 px-3 rounded-lg"
              style={{ border: "1px solid hsl(var(--sidebar-border))" }}
            >
              <Pencil className="w-3.5 h-3.5" /> {t("threads.candidate.edit")}
            </button>
            <button
              onClick={() => discard.mutate({ id: candidate.id })}
              disabled={discard.isPending}
              className="flex items-center justify-center gap-1.5 text-[12.5px] font-medium py-2 px-3 rounded-lg"
              style={{ border: "1px solid hsl(var(--sidebar-border))", color: "var(--sgi-pink)" }}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function ThreadCandidatesPage() {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const { data, isLoading } = useGetThreadCandidates();
  const candidates = data ?? [];

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-2 mb-5">
        <button
          onClick={() => navigate("/dashboard")}
          className="p-1.5 rounded-md hover:bg-black/5 transition-colors"
          aria-label="Back"
        >
          <ChevronLeft className="w-5 h-5 text-foreground" />
        </button>
        <div className="flex-1">
          <h1 className="font-display text-[18px] font-semibold text-foreground">
            {t("threads.candidate.title")}
          </h1>
          <p className="text-[12px]" style={{ color: "hsl(var(--muted-foreground))" }}>
            {t("threads.candidate.subtitle")}
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1].map((i) => <Skeleton key={i} className="h-[160px] w-full rounded-xl" />)}
        </div>
      ) : candidates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
          <MessageCircleQuestion className="w-9 h-9" style={{ color: "hsl(var(--muted-foreground))" }} />
          <p className="text-[13px] max-w-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
            {t("threads.candidate.empty")}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {candidates.map((c) => <CandidateCard key={c.id} candidate={c} />)}
        </div>
      )}
    </div>
  );
}
