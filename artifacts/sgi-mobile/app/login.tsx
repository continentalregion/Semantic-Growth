import React, { useState, useRef, useEffect } from "react";
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
} from "react-native";
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
        // Il client Clerk non è ancora inizializzato (tipico in Expo Go senza
        // native module). Forziamo un reload dal FAPI e riproviamo una volta.
        try {
          const clerk = getClerkInstance();
          const reload = (clerk as unknown as { __internal_reloadInitialResources?: () => Promise<void> })
            .__internal_reloadInitialResources;
          if (typeof reload === "function") {
            await reload.call(clerk);
          }
          await new Promise((r) => setTimeout(r, 600));
          const retry = await signIn.create({ identifier: email, password });
          if (retry.status === "complete") {
            await setActive({ session: retry.createdSessionId });
            haptic(Haptics.NotificationFeedbackType.Success);
          } else {
            setFieldErrors({
              general: "Inizializzazione in corso. Attendi 2-3 secondi e riprova.",
            });
            haptic(Haptics.NotificationFeedbackType.Error);
          }
        } catch (retryErr: unknown) {
          setErrors(extractClerkErrors(retryErr), retryErr);
        }
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
                  onPress={() => { setMode("signin"); clearErrors(); }}
                >
                  <Text style={[s.modeTabText, mode === "signin" && s.modeTabTextActive]}>
                    Accedi
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.modeTab, mode === "signup" && s.modeTabActive]}
                  onPress={() => { setMode("signup"); clearErrors(); }}
                >
                  <Text style={[s.modeTabText, mode === "signup" && s.modeTabTextActive]}>
                    Registrati
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={[s.inputWrap, hasEmailError && s.inputWrapError]}>
                <Ionicons name="mail-outline" size={18} color={hasEmailError ? "#f87171" : colors.mutedForeground} style={s.inputIcon} />
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
                <Ionicons name="lock-closed-outline" size={18} color={hasPasswordError ? "#f87171" : colors.mutedForeground} style={s.inputIcon} />
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
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={s.eyeBtn}>
                  <Ionicons
                    name={showPassword ? "eye-off-outline" : "eye-outline"}
                    size={18}
                    color={colors.mutedForeground}
                  />
                </TouchableOpacity>
              </View>
              {fieldErrors.password ? <Text style={s.errorText}>{fieldErrors.password}</Text> : null}

              {mode === "signup" && (
                <View style={[s.inputWrap, hasPasswordError && s.inputWrapError]}>
                  <Ionicons name="lock-closed-outline" size={18} color={hasPasswordError ? "#f87171" : colors.mutedForeground} style={s.inputIcon} />
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
      borderColor: "#f87171",
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
      color: "#f87171",
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
