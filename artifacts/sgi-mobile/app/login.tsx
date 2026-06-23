import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
} from "react-native";
import { PressableScale } from "@/components/ui/PressableScale";
// @clerk/expo/legacy esporta useSignIn/useSignUp con la forma legacy:
//   { signIn, isLoaded, setActive }  — identica a @clerk/react/legacy
// È un pacchetto locale (sgi-mobile/node_modules/@clerk/expo), Metro lo trova.
import { useSignIn, useSignUp } from "@clerk/expo/legacy";
import { useAuth, getClerkInstance } from "@clerk/expo";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { LinearGradient } from "expo-linear-gradient";

type FieldErrors = {
  email?: string;
  password?: string;
  general?: string;
  code?: string;
};

type ClerkErrorItem = {
  code?: string;
  message?: string;
  longMessage?: string;
  paramName?: string;
};

// Mappa i codici errore Clerk in messaggi italiani per campo
function mapClerkError(e: ClerkErrorItem): { field: keyof FieldErrors; message: string } {
  switch (e.code) {
    case "form_identifier_exists":
      return { field: "email", message: "Questa email è già registrata. Prova ad accedere invece di registrarti." };
    case "form_password_pwned":
      return { field: "password", message: "Questa password è troppo diffusa o compromessa. Scegline una più sicura." };
    case "form_password_length_too_short":
      return { field: "password", message: "La password deve avere almeno 8 caratteri." };
    case "form_param_format_invalid":
      if (e.paramName?.includes("email")) return { field: "email", message: "Inserisci un indirizzo email valido." };
      return { field: "general", message: e.message ?? "Formato non valido." };
    case "form_password_incorrect":
      return { field: "password", message: "Password non corretta." };
    case "form_identifier_not_found":
      return { field: "email", message: "Nessun account trovato con questa email." };
    case "verification_failed":
      return { field: "code", message: "Codice non valido. Ricontrolla e riprova." };
    case "verification_expired":
      return { field: "code", message: "Il codice è scaduto. Richiedi un nuovo codice." };
    default: {
      const param = e.paramName ?? "";
      if (param.includes("email")) return { field: "email", message: e.message ?? "Errore email." };
      if (param.includes("password")) return { field: "password", message: e.message ?? "Errore password." };
      return { field: "general", message: e.message ?? "Si è verificato un errore. Riprova." };
    }
  }
}

function extractClerkErrors(err: unknown): ClerkErrorItem[] {
  const e = err as { errors?: ClerkErrorItem[]; message?: string; code?: string };
  if (e.errors && e.errors.length > 0) return e.errors;
  if (e.code || e.message) return [{ code: e.code, message: e.message }];
  return [{ message: "Si è verificato un errore. Riprova." }];
}

export default function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // Legacy hooks: { signIn/signUp resource, isLoaded: boolean, setActive }
  // @clerk/expo/legacy è un pacchetto locale — Metro lo risolve correttamente.
  const { signIn, isLoaded: signInLoaded, setActive } = useSignIn() as {
    signIn: {
      create: (params: { identifier: string; password: string }) => Promise<{ status: string; createdSessionId: string | null }>;
    } | undefined;
    isLoaded: boolean;
    setActive: (params: { session: string | null }) => Promise<void>;
  };
  const { signUp, isLoaded: signUpLoaded } = useSignUp() as {
    signUp: {
      create: (params: { emailAddress: string; password: string }) => Promise<void>;
      prepareEmailAddressVerification: (params: { strategy: string }) => Promise<void>;
      attemptEmailAddressVerification: (params: { code: string }) => Promise<{ status: string; createdSessionId: string | null }>;
    } | undefined;
    isLoaded: boolean;
  };

  const { isLoaded: authLoaded, isSignedIn } = useAuth();

  // Se già autenticato, vai direttamente alla schermata principale
  useEffect(() => {
    if (authLoaded && isSignedIn) {
      router.replace("/");
    }
  }, [authLoaded, isSignedIn]);

  // Pre-inizializza il client Clerk dalla FAPI al mount.
  // In Expo Go (senza native module reale), refreshJsClientFromServer viene
  // chiamato dal mock solo DOPO che configure() ha restituito il placeholder.
  // Questo useEffect forza un reload aggiuntivo per assicurarsi che il client
  // JS sia pronto prima del primo tentativo di login.
  useEffect(() => {
    const clerk = getClerkInstance();
    const reload = (clerk as unknown as { __internal_reloadInitialResources?: () => Promise<void> })
      .__internal_reloadInitialResources;
    if (typeof reload === "function") {
      reload.call(clerk).catch(() => {});
    }
  }, []);

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [code, setCode] = useState("");
  const [pendingVerification, setPendingVerification] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  const s = makeStyles(colors, insets);

  const haptic = (type: Haptics.NotificationFeedbackType) =>
    Haptics.notificationAsync(type).catch(() => {});

  function clearErrors() {
    setFieldErrors({});
  }

  function setErrors(errs: ClerkErrorItem[], _rawErr?: unknown) {
    const next: FieldErrors = {};
    for (const e of errs) {
      const { field, message } = mapClerkError(e);
      if (!next[field]) next[field] = message;
    }
    setFieldErrors(next);
    haptic(Haptics.NotificationFeedbackType.Error);
  }

  // BFF fallback per Expo Go: il backend Clerk Admin API verifica le credenziali
  // e restituisce un sign-in token one-time. Lo usiamo con strategy:"ticket"
  // che bypassa il trust check di FAPI (needs_client_trust).
  async function handleMobileSignInFallback() {
    if (!signIn || !setActive) return;
    const base = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;
    try {
      const bffResp = await fetch(`${base}/api/auth/mobile-signin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const bffData = (await bffResp.json()) as { token?: string; error?: string };
      if (!bffResp.ok || !bffData.token) {
        setFieldErrors({ general: bffData.error ?? "Errore di autenticazione. Riprova." });
        haptic(Haptics.NotificationFeedbackType.Error);
        return;
      }
      // Usa il sign-in token con strategy:"ticket" — bypassa il trust check FAPI
      const ticketResult = await (signIn as unknown as {
        create: (p: { strategy: string; ticket: string }) => Promise<{ status: string; createdSessionId: string | null }>;
      }).create({ strategy: "ticket", ticket: bffData.token });
      if (ticketResult.status === "complete") {
        await setActive({ session: ticketResult.createdSessionId });
        haptic(Haptics.NotificationFeedbackType.Success);
      } else if ((ticketResult as { status: string }).status === "needs_client_trust") {
        // Il trust non si può stabilire in Expo Go dev: mostra messaggio chiaro
        setFieldErrors({
          general: "Login non disponibile in anteprima. Usa la versione web oppure installa l'app completa.",
        });
        haptic(Haptics.NotificationFeedbackType.Error);
      } else {
        setFieldErrors({ general: "Accesso non completato (status: " + ticketResult.status + "). Riprova." });
        haptic(Haptics.NotificationFeedbackType.Error);
      }
    } catch (err: unknown) {
      setErrors(extractClerkErrors(err));
    }
  }

  async function handleSignIn() {
    if (!signInLoaded || !signIn) {
      setFieldErrors({ general: "Autenticazione non pronta. Attendi un momento e riprova." });
      return;
    }
    clearErrors();
    setLoading(true);
    try {
      const result = await signIn.create({ identifier: email, password });
      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        haptic(Haptics.NotificationFeedbackType.Success);
      } else if ((result as { status: string }).status === "needs_client_trust") {
        // Expo Go non può stabilire il trust del client Clerk (nessun native module).
        // Fallback BFF: il backend verifica email/password tramite Clerk Admin API
        // e restituisce un sign-in token che usiamo con strategy:"ticket",
        // bypassando il trust check di FAPI.
        await handleMobileSignInFallback();
      } else {
        setFieldErrors({ general: "Accesso non completato. Riprova." });
        haptic(Haptics.NotificationFeedbackType.Error);
      }
    } catch (err: unknown) {
      setErrors(extractClerkErrors(err), err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSignUp() {
    if (!signUpLoaded || !signUp) {
      setFieldErrors({ general: "Autenticazione non pronta. Attendi un momento e riprova." });
      return;
    }
    clearErrors();
    if (password !== confirmPassword) {
      setFieldErrors({ password: "Le password non coincidono." });
      haptic(Haptics.NotificationFeedbackType.Error);
      return;
    }
    setLoading(true);
    try {
      await signUp.create({ emailAddress: email, password });
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setPendingVerification(true);
    } catch (err: unknown) {
      const clerkErrs = extractClerkErrors(err);
      if (clerkErrs.some((e) => e.code === "session_exists")) {
        router.replace("/");
        return;
      }
      setErrors(clerkErrs, err);
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify() {
    if (!signUpLoaded || !signUp) {
      setFieldErrors({ general: "Autenticazione non pronta. Attendi un momento e riprova." });
      return;
    }
    clearErrors();
    setLoading(true);
    try {
      const result = await signUp.attemptEmailAddressVerification({ code });
      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        haptic(Haptics.NotificationFeedbackType.Success);
      } else {
        setFieldErrors({ code: "Verifica non completata. Riprova." });
        haptic(Haptics.NotificationFeedbackType.Error);
      }
    } catch (err: unknown) {
      const clerkErrs = extractClerkErrors(err);
      if (clerkErrs.some((e) => e.code === "session_exists")) {
        router.replace("/");
        return;
      }
      setErrors(clerkErrs, err);
    } finally {
      setLoading(false);
    }
  }

  const hasEmailError = !!fieldErrors.email;
  const hasPasswordError = !!fieldErrors.password;
  const hasCodeError = !!fieldErrors.code;

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={[colors.primary + "3a", colors.background, colors.background]}
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
              <View style={[s.inputWrap, hasCodeError && s.inputWrapError]}>
                <TextInput
                  style={s.input}
                  placeholder="Codice a 6 cifre"
                  placeholderTextColor={colors.mutedForeground}
                  value={code}
                  onChangeText={(v) => { setCode(v); if (fieldErrors.code) setFieldErrors((p) => ({ ...p, code: undefined })); }}
                  keyboardType="number-pad"
                  maxLength={6}
                  textAlign="center"
                  returnKeyType="done"
                  onSubmitEditing={handleVerify}
                />
              </View>
              {fieldErrors.code ? <Text style={s.errorText}>{fieldErrors.code}</Text> : null}
              {fieldErrors.general ? <Text style={s.errorText}>{fieldErrors.general}</Text> : null}
              <PressableScale
                style={[s.btn, (loading || code.length < 6) && s.btnDisabled]}
                onPress={handleVerify}
                disabled={loading || code.length < 6}
                haptic={false}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={s.btnText}>Verifica</Text>
                )}
              </PressableScale>
            </View>
          ) : (
            <View style={s.card}>
              <View style={s.modeTabs}>
                <PressableScale
                  style={[s.modeTab, mode === "signin" && s.modeTabActive]}
                  onPress={() => { setMode("signin"); clearErrors(); }}
                  scaleTarget={0.96}
                >
                  <Text style={[s.modeTabText, mode === "signin" && s.modeTabTextActive]}>
                    Accedi
                  </Text>
                </PressableScale>
                <PressableScale
                  style={[s.modeTab, mode === "signup" && s.modeTabActive]}
                  onPress={() => { setMode("signup"); clearErrors(); }}
                  scaleTarget={0.96}
                >
                  <Text style={[s.modeTabText, mode === "signup" && s.modeTabTextActive]}>
                    Registrati
                  </Text>
                </PressableScale>
              </View>

              <View style={[s.inputWrap, hasEmailError && s.inputWrapError]}>
                <Ionicons name="mail-outline" size={18} color={hasEmailError ? colors.destructive : colors.mutedForeground} style={s.inputIcon} />
                <TextInput
                  style={s.input}
                  placeholder="Email"
                  placeholderTextColor={colors.mutedForeground}
                  value={email}
                  onChangeText={(v) => { setEmail(v); if (fieldErrors.email) setFieldErrors((p) => ({ ...p, email: undefined })); }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                  onSubmitEditing={() => passwordRef.current?.focus()}
                />
              </View>
              {fieldErrors.email ? <Text style={s.errorText}>{fieldErrors.email}</Text> : null}

              <View style={[s.inputWrap, hasPasswordError && s.inputWrapError]}>
                <Ionicons name="lock-closed-outline" size={18} color={hasPasswordError ? colors.destructive : colors.mutedForeground} style={s.inputIcon} />
                <TextInput
                  ref={passwordRef}
                  style={[s.input, { flex: 1 }]}
                  placeholder="Password"
                  placeholderTextColor={colors.mutedForeground}
                  value={password}
                  onChangeText={(v) => { setPassword(v); if (fieldErrors.password) setFieldErrors((p) => ({ ...p, password: undefined })); }}
                  secureTextEntry={!showPassword}
                  returnKeyType={mode === "signup" ? "next" : "done"}
                  onSubmitEditing={() => {
                    if (mode === "signup") confirmRef.current?.focus();
                    else handleSignIn();
                  }}
                />
                <PressableScale
                  onPress={() => setShowPassword(!showPassword)}
                  style={s.eyeBtn}
                  scaleTarget={0.88}
                  haptic={false}
                >
                  <Ionicons
                    name={showPassword ? "eye-off-outline" : "eye-outline"}
                    size={18}
                    color={colors.mutedForeground}
                  />
                </PressableScale>
              </View>
              {fieldErrors.password ? <Text style={s.errorText}>{fieldErrors.password}</Text> : null}

              {mode === "signup" && (
                <View style={[s.inputWrap, hasPasswordError && s.inputWrapError]}>
                  <Ionicons name="lock-closed-outline" size={18} color={hasPasswordError ? colors.destructive : colors.mutedForeground} style={s.inputIcon} />
                  <TextInput
                    ref={confirmRef}
                    style={s.input}
                    placeholder="Conferma password"
                    placeholderTextColor={colors.mutedForeground}
                    value={confirmPassword}
                    onChangeText={(v) => { setConfirmPassword(v); if (fieldErrors.password) setFieldErrors((p) => ({ ...p, password: undefined })); }}
                    secureTextEntry={!showPassword}
                    returnKeyType="done"
                    onSubmitEditing={handleSignUp}
                  />
                </View>
              )}

              {fieldErrors.general ? <Text style={s.errorText}>{fieldErrors.general}</Text> : null}

              <PressableScale
                style={[s.btn, (loading || !email || !password) && s.btnDisabled]}
                onPress={mode === "signin" ? handleSignIn : handleSignUp}
                disabled={loading || !email || !password}
                haptic={false}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={s.btnText}>
                    {mode === "signin" ? "Accedi" : "Crea account"}
                  </Text>
                )}
              </PressableScale>
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
      gap: 8,
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
    inputWrapError: {
      borderColor: colors.destructive,
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
    errorText: {
      color: colors.destructive,
      fontSize: 12,
      fontFamily: "Inter_400Regular",
      marginTop: -4,
      marginLeft: 4,
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
