import { useQuery } from "@tanstack/react-query";

import { getPlatformShop } from "../../services/platformShopService";
import { platformShopKeys } from "./usePlatformShops";

export const usePlatformShop = (shopId: string | undefined) =>
    useQuery({
        queryKey: platformShopKeys.detail(shopId ?? ""),
        queryFn: () => getPlatformShop(shopId ?? ""),
        enabled: Boolean(shopId),
        staleTime: 30_000,
        retry: 1,
    });
