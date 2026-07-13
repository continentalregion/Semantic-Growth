import { useEffect, useState } from "react";
import { IAP_PRODUCT_IDS } from "./usePurchase";

interface OfferingsState {
  premiumPrice: string | null;
  proPrice: string | null;
  isLoading: boolean;
}

export function useOfferings(): OfferingsState {
  const [state, setState] = useState<OfferingsState>({
    premiumPrice: null,
    proPrice: null,
    isLoading: true,
  });

  useEffect(() => {
    let cancelled = false;

    async function fetchOfferings() {
      let Purchases: typeof import("react-native-purchases").default | null = null;
      try {
        const mod = await import("react-native-purchases");
        Purchases = mod.default;
      } catch {
        if (!cancelled) setState((s) => ({ ...s, isLoading: false }));
        return;
      }

      try {
        const offerings = await Purchases.getOfferings();
        const packages = offerings.current?.availablePackages ?? [];

        const premiumPkg = packages.find(
          (p) => p.product.identifier === IAP_PRODUCT_IDS["premium"],
        );
        const proPkg = packages.find(
          (p) => p.product.identifier === IAP_PRODUCT_IDS["pro"],
        );

        if (!cancelled) {
          setState({
            premiumPrice: premiumPkg?.product.priceString ?? null,
            proPrice: proPkg?.product.priceString ?? null,
            isLoading: false,
          });
        }
      } catch {
        if (!cancelled) setState((s) => ({ ...s, isLoading: false }));
      }
    }

    fetchOfferings();
    return () => { cancelled = true; };
  }, []);

  return state;
}
