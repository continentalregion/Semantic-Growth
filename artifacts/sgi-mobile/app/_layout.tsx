import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { ClerkProvider, useAuth } from "@clerk/expo";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Redirect, Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import * as SecureStore from "expo-secure-store";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { I18nextProvider } from "react-i18next";
import { setBaseUrl, setAuthTokenGetter } from "@workspace/api-client-react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import i18n, { initLanguage } from "@/i18n";

setBaseUrl(`https://${process.env.EXPO_PUBLIC_DOMAIN}`);

SplashScreen.preventAutoHideAsync();

const CACHE_MAX_AGE = 5 * 60_000;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: CACHE_MAX_AGE,
    },
  },
});

const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: "sgi-mobile-query-cache",
});

// Persist Clerk client token using SecureStore so FAPI recognises
// the client as trusted across app launches (prevents needs_client_trust).
const tokenCache = {
  async getToken(key: string) {
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  async saveToken(key: string, value: string) {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch {}
  },
  async clearToken(key: string) {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch {}
  },
};

function AuthGuard() {
  const { isSignedIn, isLoaded, getToken } = useAuth();

  // Register synchronously (not in useEffect) so the Bearer token
  // is attached to the very first React Query fetch that fires on mount.
  // useEffect runs after the render, causing a race where tabs make API
  // calls before the getter is registered — resulting in unauthenticated
  // requests that trigger Clerk's handshake 307 redirect.
  setAuthTokenGetter(async () => {
    try {
      return await getToken();
    } catch {
      return null;
    }
  });

  if (!isLoaded) return null;
  if (!isSignedIn) return <Redirect href="/login" />;
  return null;
}

function RootLayoutNav() {
  return (
    <>
      <AuthGuard />
      <Stack screenOptions={{ headerShown: false, animation: "fade", animationDuration: 200 }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="settings" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    initLanguage();
  }, []);

  if (!fontsLoaded && !fontError) return null;

  return (
    <I18nextProvider i18n={i18n}>
      <ClerkProvider
        publishableKey={process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? ""}
        tokenCache={tokenCache}
      >
        <SafeAreaProvider>
          <ErrorBoundary>
            <PersistQueryClientProvider
              client={queryClient}
              persistOptions={{ persister: asyncStoragePersister, maxAge: CACHE_MAX_AGE }}
            >
              <GestureHandlerRootView style={{ flex: 1 }}>
                <KeyboardProvider>
                  <RootLayoutNav />
                </KeyboardProvider>
              </GestureHandlerRootView>
            </PersistQueryClientProvider>
          </ErrorBoundary>
        </SafeAreaProvider>
      </ClerkProvider>
    </I18nextProvider>
  );
}
