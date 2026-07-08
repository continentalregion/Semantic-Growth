import { useCallback, useState } from "react";
import { Alert, Platform } from "react-native";
import { useAuth } from "@clerk/expo";
import { useQueryClient } from "@tanstack/react-query";
import { getGetMyProfileQueryKey } from "@workspace/api-client-react";

// ─── Product identifier constants ────────────────────────────────────────────
// These placeholder IDs must be replaced with the real App Store / Google Play
// product identifiers once the Apple Developer Program is approved and IAP
// products are created on App Store Connect / Google Play Console.
export const IAP_PRODUCT_IDS: Record<"premium" | "pro", string> = {
  premium: "com.sgi.mobile.premium.monthly",
  pro:     "com.sgi.mobile.pro.monthly",
};

// ─── RevenueCat entitlement identifiers (must match RevenueCat dashboard) ────
const ENTITLEMENT_PREMIUM = "premium";
const ENTITLEMENT_PRO     = "pro";

type PurchasePlan = "premium" | "pro";

interface UsePurchaseResult {
  triggerPurchase: (plan: PurchasePlan) => Promise<void>;
  isPurchasing: boolean;
}

/**
 * Hook that wraps the RevenueCat purchase flow.
 *
 * DEVELOPMENT NOTE: react-native-purchases requires a native module that is
 * NOT available in Expo Go. In Expo Go this hook logs a warning and shows an
 * "Acquisto non disponibile" alert instead of crashing.
 *
 * To test real purchases:
 *   1. Build with EAS: `eas build --profile development --platform ios`
 *   2. Configure EXPO_PUBLIC_REVENUECAT_IOS_KEY (and/or ANDROID_KEY) via
 *      Replit environment secrets.
 *   3. Create products on App Store Connect / Google Play Console and link
 *      them in the RevenueCat dashboard.
 */
export function usePurchase(): UsePurchaseResult {
  const [isPurchasing, setIsPurchasing] = useState(false);
  const { userId } = useAuth();
  const qc = useQueryClient();

  const triggerPurchase = useCallback(async (plan: PurchasePlan) => {
    if (isPurchasing) return;

    // Guard: native module not available (Expo Go or web)
    let Purchases: typeof import("react-native-purchases").default | null = null;
    try {
      const mod = await import("react-native-purchases");
      Purchases = mod.default;
    } catch {
      console.warn("[usePurchase] react-native-purchases not available (Expo Go / web)");
      Alert.alert(
        "Acquisto non disponibile",
        "Per effettuare acquisti installa l'app tramite TestFlight o Google Play. L'upgrade sarà disponibile a breve.",
        [{ text: "OK" }],
      );
      return;
    }

    setIsPurchasing(true);
    try {
      // Configure SDK on first use. The API key comes from env vars set at
      // EAS build time; in dev it will be an empty string (safe — SDK will
      // throw a handled error caught below).
      const apiKey = Platform.OS === "ios"
        ? (process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? "")
        : (process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ?? "");

      Purchases.configure({ apiKey });

      // Link RevenueCat anonymous user to the real Clerk user ID so the
      // backend webhook (WHERE users.clerkId = appUserId) can find the row.
      if (!userId) {
        Alert.alert(
          "Sessione non valida",
          "Accedi di nuovo prima di effettuare un acquisto.",
          [{ text: "OK" }],
        );
        return;
      }
      try {
        await Purchases.logIn(userId);
      } catch (loginErr) {
        console.error("[usePurchase] Purchases.logIn failed:", loginErr);
        Alert.alert(
          "Acquisto non disponibile",
          "Impossibile verificare il tuo account. Controlla la connessione e riprova.",
          [{ text: "OK" }],
        );
        return;
      }

      // Fetch available offerings from RevenueCat
      const offerings = await Purchases.getOfferings();
      const current = offerings.current;

      if (!current) {
        Alert.alert(
          "Piani non ancora disponibili",
          "I piani Premium e Pro saranno disponibili a breve. Riprova tra qualche giorno.",
          [{ text: "OK" }],
        );
        return;
      }

      // Find the package matching the requested plan by product identifier
      const targetId = IAP_PRODUCT_IDS[plan];
      const pkg = current.availablePackages.find(
        (p) => p.product.identifier === targetId,
      );

      if (!pkg) {
        Alert.alert(
          "Piano non trovato",
          `Il piano ${plan === "premium" ? "Premium" : "Pro"} non è ancora disponibile in questa regione o dispositivo.`,
          [{ text: "OK" }],
        );
        return;
      }

      // Trigger StoreKit / Google Billing purchase sheet
      const { customerInfo } = await Purchases.purchasePackage(pkg);

      // Verify entitlement granted
      const entitlement = plan === "pro" ? ENTITLEMENT_PRO : ENTITLEMENT_PREMIUM;
      const granted = customerInfo.entitlements.active[entitlement];

      if (granted) {
        // Invalidate profile so plan badge/limits update immediately
        qc.invalidateQueries({ queryKey: getGetMyProfileQueryKey() });
        Alert.alert(
          plan === "pro" ? "Benvenuto su Pro! 🚀" : "Benvenuto su Premium! ✦",
          "Il tuo piano è stato aggiornato. Goditi tutte le funzionalità sbloccate.",
          [{ text: "Perfetto" }],
        );
      }
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      // User cancelled the payment sheet — silent, no alert
      if (code === "1") return;

      console.error("[usePurchase] purchase error:", err);
      Alert.alert(
        "Acquisto non completato",
        "Si è verificato un errore durante il pagamento. Riprova o contatta il supporto.",
        [{ text: "OK" }],
      );
    } finally {
      setIsPurchasing(false);
    }
  }, [isPurchasing, userId, qc]);

  return { triggerPurchase, isPurchasing };
}
