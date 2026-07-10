import React, { useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  Platform,
  TextInput,
  RefreshControl,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetThreadCandidates,
  useUpdateThreadCandidate,
  useConfirmThreadCandidate,
  useDiscardThreadCandidate,
  getGetThreadCandidatesQueryKey,
  type ThreadCandidate,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { AnimatedScreen } from "@/components/ui/AnimatedScreen";
import { SkeletonBox } from "@/components/ui/SkeletonBox";

function CandidateCard({
  candidate, colors, t,
}: {
  candidate: ThreadCandidate;
  colors: ReturnType<typeof useColors>;
  t: any;
}) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [question, setQuestion] = useState(candidate.question);
  const [description, setDescription] = useState(candidate.description ?? "");

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: getGetThreadCandidatesQueryKey() });

  const update = useUpdateThreadCandidate({
    mutation: { onSuccess: () => { setEditing(false); invalidate(); } },
  });
  const confirm = useConfirmThreadCandidate({
    mutation: {
      onSuccess: (data) => {
        invalidate();
        try {
          router.push(`/(tabs)/thread/${data.threadId}` as never);
        } catch {
          // ignore navigation errors
        }
      },
    },
  });
  const discard = useDiscardThreadCandidate({
    mutation: { onSuccess: () => invalidate() },
  });

  return (
    <View style={[st.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={[st.iconWrap, { backgroundColor: colors.teal + "22" }]}>
          <Ionicons name="help-circle" size={18} color={colors.teal} />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text
            style={[st.title, { color: colors.foreground, fontFamily: colors.font.family.semibold }]}
            numberOfLines={2}
          >
            {candidate.aiTitle ?? candidate.question}
          </Text>
          {editing ? (
            <View style={{ gap: 8, marginTop: 4 }}>
              <TextInput
                value={question}
                onChangeText={setQuestion}
                multiline
                style={[st.input, { color: colors.foreground, borderColor: colors.border }]}
              />
              <TextInput
                value={description}
                onChangeText={setDescription}
                multiline
                style={[st.input, { color: colors.foreground, borderColor: colors.border }]}
              />
            </View>
          ) : (
            <>
              <Text style={[st.body, { color: colors.mutedForeground }]}>{candidate.question}</Text>
              {candidate.description ? (
                <Text style={[st.body, { color: colors.mutedForeground }]}>{candidate.description}</Text>
              ) : null}
            </>
          )}
          {candidate.motivationBlurb && !editing ? (
            <View style={[st.motivation, { backgroundColor: colors.background }]}>
              <Text style={{ color: colors.mutedForeground, fontSize: 11.5 }}>
                <Text style={{ fontFamily: colors.font.family.semibold }}>
                  {t("threads.candidate.motivationLabel")}:{" "}
                </Text>
                {candidate.motivationBlurb}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
        {editing ? (
          <>
            <Pressable
              onPress={() => update.mutate({ id: candidate.id, data: { question, description } })}
              disabled={update.isPending}
              style={[st.btnPrimary, { backgroundColor: colors.primary, flex: 1 }]}
            >
              <Ionicons name="checkmark" size={15} color="#fff" />
              <Text style={st.btnPrimaryText}>{t("threads.candidate.save")}</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setEditing(false);
                setQuestion(candidate.question);
                setDescription(candidate.description ?? "");
              }}
              style={[st.btnOutline, { borderColor: colors.border }]}
            >
              <Text style={{ color: colors.foreground, fontSize: 12.5 }}>{t("threads.candidate.cancel")}</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Pressable
              onPress={() => confirm.mutate({ id: candidate.id })}
              disabled={confirm.isPending}
              style={[st.btnPrimary, { backgroundColor: colors.teal, flex: 1 }]}
            >
              <Ionicons name="checkmark" size={15} color="#fff" />
              <Text style={st.btnPrimaryText}>{t("threads.candidate.confirmBtn")}</Text>
            </Pressable>
            <Pressable
              onPress={() => setEditing(true)}
              style={[st.btnOutline, { borderColor: colors.border }]}
            >
              <Ionicons name="pencil" size={14} color={colors.foreground} />
            </Pressable>
            <Pressable
              onPress={() => discard.mutate({ id: candidate.id })}
              disabled={discard.isPending}
              style={[st.btnOutline, { borderColor: colors.border }]}
            >
              <Ionicons name="trash-outline" size={14} color={colors.pink} />
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

export default function ThreadCandidatesScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, refetch } = useGetThreadCandidates();
  const candidates = data ?? [];

  async function handleRefresh() {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }

  return (
    <AnimatedScreen style={{ backgroundColor: colors.background }}>
      <View
        style={[
          st.header,
          {
            paddingTop: Platform.OS === "web" ? 67 : insets.top,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Pressable onPress={() => router.back()} style={st.backBtn} testID="thread-candidates-back-btn">
          <Ionicons name="chevron-back" size={22} color={colors.foreground} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[st.headerTitle, { color: colors.foreground }]}>{t("threads.candidate.title")}</Text>
          <Text style={[st.headerSubtitle, { color: colors.mutedForeground }]} numberOfLines={2}>
            {t("threads.candidate.subtitle")}
          </Text>
        </View>
      </View>

      {isLoading ? (
        <View style={{ padding: 16, gap: 10 }}>
          {[0, 1].map(i => (
            <SkeletonBox key={i} height={160} borderRadius={14} />
          ))}
        </View>
      ) : candidates.length === 0 ? (
        <View style={st.emptyWrap}>
          <Ionicons name="help-circle-outline" size={40} color={colors.mutedForeground} />
          <Text style={[st.emptyDesc, { color: colors.mutedForeground }]}>
            {t("threads.candidate.empty")}
          </Text>
        </View>
      ) : (
        <FlatList
          data={candidates}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: insets.bottom + 24 }}
          renderItem={({ item }) => <CandidateCard candidate={item} colors={colors} t={t} />}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
          }
        />
      )}
    </AnimatedScreen>
  );
}

const st = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    gap: 8,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  headerSubtitle: { fontSize: 12, marginTop: 2, lineHeight: 16 },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 14 },
  body: { fontSize: 12.5, lineHeight: 17, marginTop: 2 },
  motivation: { borderRadius: 8, padding: 8, marginTop: 6 },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
    fontSize: 13,
    minHeight: 44,
  },
  btnPrimary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  btnPrimaryText: { color: "#fff", fontSize: 12.5, fontWeight: "600" },
  btnOutline: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 10,
  },
  emptyDesc: { fontSize: 13, textAlign: "center", lineHeight: 19 },
});
