import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
  Alert,
} from "react-native";
import { useSignIn, useSignUp, useClerk } from "@clerk/expo";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { LinearGradient } from "expo-linear-gradient";

export default function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { setActive } = useClerk();
  // Use isLoaded from the specific hooks — authLoaded alone doesn't mean signUp/signIn are ready
  const { signIn, isLoaded: signInLoaded } = useSignIn() as unknown as {
    signIn: {
      create: (params: { identifier: string; password: string }) => Promise<{ status: string; createdSessionId: string | null }>;
      status?: string;
      createdSessionId?: string | null;
    } | null | undefined;
    isLoaded: boolean;
  };
  const { signUp, isLoaded: signUpLoaded } = useSignUp() as unknown as {
    signUp: {
      create: (params: { emailAddress: string; password: string }) => Promise<void>;
      prepareEmailAddressVerification: (params: { strategy: string }) => Promise<void>;
      attemptEmailAddressVerification: (params: { code: string }) => Promise<{ status: string; createdSessionId: string | null }>;
    } | null | undefined;
    isLoaded: boolean;
  };

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [code, setCode] = useState("");
  const [pendingVerification, setPendingVerification] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  const s = makeStyles(colors, insets);

  const haptic = (type: Haptics.NotificationFeedbackType) =>
    Haptics.notificationAsync(type).catch(() => {});

  async function handleSignIn() {
    if (!signInLoaded || !signIn) return;
    setLoading(true);
    try {
      const result = await signIn.create({ identifier: email, password });
      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        haptic(Haptics.NotificationFeedbackType.Success);
      }
    } catch (err: unknown) {
      const e = err as { errors?: { message: string }[]; message?: string };
      console.error("[SGI] signIn.create error:", JSON.stringify(err));
      Alert.alert("Errore", e.errors?.[0]?.message ?? e.message ?? "Accesso fallito");
      haptic(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSignUp() {
    if (!signUpLoaded || !signUp) return;
    if (password !== confirmPassword) {
      Alert.alert("Errore", "Le password non coincidono");
      return;
    }
    setLoading(true);
    try {
      await signUp.create({ emailAddress: email, password });
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setPendingVerification(true);
    } catch (err: unknown) {
      const e = err as { errors?: { message: string }[]; message?: string };
      console.error("[SGI] signUp.create error:", JSON.stringify(err));
      Alert.alert("Errore", e.errors?.[0]?.message ?? e.message ?? "Registrazione fallita");
      haptic(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify() {
    if (!signUpLoaded || !signUp) return;
    setLoading(true);
    try {
      const result = await signUp.attemptEmailAddressVerification({ code });
      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        haptic(Haptics.NotificationFeedbackType.Success);
      }
    } catch (err: unknown) {
      const e = err as { errors?: { message: string }[]; message?: string };
      console.error("[SGI] signUp.verify error:", JSON.stringify(err));
      Alert.alert("Errore", e.errors?.[0]?.message ?? e.message ?? "Verifica fallita");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={["#1a0d4a", "#08090f", "#08090f"]}
        style={StyleSheet.absoluteFill}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={[
            s.scroll,
            {
              paddingTop: Platform.OS === "web" ? 67 + 40 : insets.top + 40,
              paddingBottom: Platform.OS === "web" ? 34 + 24 : insets.bottom + 24,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={s.brand}>
            <View style={s.logoRing}>
              <Ionicons name="trending-up" size={32} color={colors.primary} />
            </View>
            <Text style={s.title}>Semantic Growth Index</Text>
            <Text style={s.subtitle}>Analisi semantica della tua intelligenza</Text>
          </View>

          {pendingVerification ? (
            <View style={s.card}>
              <Text style={s.cardTitle}>Verifica email</Text>
              <Text style={s.cardHint}>
                Inserisci il codice inviato a {email}
              </Text>
              <View style={s.inputWrap}>
                <TextInput
                  style={s.input}
                  placeholder="Codice a 6 cifre"
                  placeholderTextColor={colors.mutedForeground}
                  value={code}
                  onChangeText={setCode}
                  keyboardType="number-pad"
                  maxLength={6}
                  textAlign="center"
                  returnKeyType="done"
                  onSubmitEditing={handleVerify}
                />
              </View>
              <TouchableOpacity
                style={[s.btn, loading && s.btnDisabled]}
                onPress={handleVerify}
                disabled={loading || code.length < 6}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={s.btnText}>Verifica</Text>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <View style={s.card}>
              <View style={s.modeTabs}>
                <TouchableOpacity
                  style={[s.modeTab, mode === "signin" && s.modeTabActive]}
                  onPress={() => setMode("signin")}
                >
                  <Text style={[s.modeTabText, mode === "signin" && s.modeTabTextActive]}>
                    Accedi
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.modeTab, mode === "signup" && s.modeTabActive]}
                  onPress={() => setMode("signup")}
                >
                  <Text style={[s.modeTabText, mode === "signup" && s.modeTabTextActive]}>
                    Registrati
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={s.inputWrap}>
                <Ionicons name="mail-outline" size={18} color={colors.mutedForeground} style={s.inputIcon} />
                <TextInput
                  style={s.input}
                  placeholder="Email"
                  placeholderTextColor={colors.mutedForeground}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                  onSubmitEditing={() => passwordRef.current?.focus()}
                />
              </View>

              <View style={s.inputWrap}>
                <Ionicons name="lock-closed-outline" size={18} color={colors.mutedForeground} style={s.inputIcon} />
                <TextInput
                  ref={passwordRef}
                  style={[s.input, { flex: 1 }]}
                  placeholder="Password"
                  placeholderTextColor={colors.mutedForeground}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  returnKeyType={mode === "signup" ? "next" : "done"}
                  onSubmitEditing={() => {
                    if (mode === "signup") confirmRef.current?.focus();
                    else handleSignIn();
                  }}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={s.eyeBtn}>
                  <Ionicons
                    name={showPassword ? "eye-off-outline" : "eye-outline"}
                    size={18}
                    color={colors.mutedForeground}
                  />
                </TouchableOpacity>
              </View>

              {mode === "signup" && (
                <View style={s.inputWrap}>
                  <Ionicons name="lock-closed-outline" size={18} color={colors.mutedForeground} style={s.inputIcon} />
                  <TextInput
                    ref={confirmRef}
                    style={s.input}
                    placeholder="Conferma password"
                    placeholderTextColor={colors.mutedForeground}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showPassword}
                    returnKeyType="done"
                    onSubmitEditing={handleSignUp}
                  />
                </View>
              )}

              <TouchableOpacity
                style={[s.btn, (loading || !email || !password) && s.btnDisabled]}
                onPress={mode === "signin" ? handleSignIn : handleSignUp}
                disabled={loading || !email || !password}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={s.btnText}>
                    {mode === "signin" ? "Accedi" : "Crea account"}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof import("@/hooks/useColors").useColors>, insets: ReturnType<typeof import("react-native-safe-area-context").useSafeAreaInsets>) {
  return StyleSheet.create({
    root: { flex: 1 },
    scroll: {
      flexGrow: 1,
      paddingHorizontal: 24,
      justifyContent: "center",
    },
    brand: {
      alignItems: "center",
      marginBottom: 40,
    },
    logoRing: {
      width: 72,
      height: 72,
      borderRadius: 36,
      borderWidth: 1.5,
      borderColor: colors.primary + "55",
      backgroundColor: colors.primary + "15",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 16,
    },
    title: {
      color: colors.foreground,
      fontSize: 22,
      fontFamily: "Inter_700Bold",
      textAlign: "center",
      letterSpacing: -0.3,
    },
    subtitle: {
      color: colors.mutedForeground,
      fontSize: 14,
      fontFamily: "Inter_400Regular",
      textAlign: "center",
      marginTop: 6,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 20,
      gap: 12,
    },
    cardTitle: {
      color: colors.foreground,
      fontSize: 18,
      fontFamily: "Inter_600SemiBold",
      marginBottom: 4,
    },
    cardHint: {
      color: colors.mutedForeground,
      fontSize: 14,
      fontFamily: "Inter_400Regular",
      marginBottom: 8,
    },
    modeTabs: {
      flexDirection: "row",
      backgroundColor: colors.muted,
      borderRadius: 8,
      padding: 3,
      marginBottom: 4,
    },
    modeTab: {
      flex: 1,
      paddingVertical: 8,
      borderRadius: 6,
      alignItems: "center",
    },
    modeTabActive: {
      backgroundColor: colors.secondary,
    },
    modeTabText: {
      color: colors.mutedForeground,
      fontSize: 14,
      fontFamily: "Inter_500Medium",
    },
    modeTabTextActive: {
      color: colors.foreground,
    },
    inputWrap: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.muted,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      height: 48,
    },
    inputIcon: {
      marginRight: 8,
    },
    input: {
      flex: 1,
      color: colors.foreground,
      fontSize: 15,
      fontFamily: "Inter_400Regular",
    },
    eyeBtn: {
      padding: 4,
    },
    btn: {
      backgroundColor: colors.primary,
      borderRadius: 10,
      height: 50,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 4,
    },
    btnDisabled: {
      opacity: 0.5,
    },
    btnText: {
      color: "#fff",
      fontSize: 15,
      fontFamily: "Inter_600SemiBold",
    },
  });
}
