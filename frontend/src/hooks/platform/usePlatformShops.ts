import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { getPlatformShops } from "../../services/platformShopService";
import type { PlatformShopFilters } from "../../types/platform/shops";

export const platformShopKeys = {
    all: ["platform", "shops"] as const,
    lists: () => [...platformShopKeys.all, "list"] as const,
    list: (filters: PlatformShopFilters) =>
        [...platformShopKeys.lists(), filters] as const,
    detail: (shopId: string) =>
        [...platformShopKeys.all, "detail", shopId] as const,
};

export const usePlatformShops = (filters: PlatformShopFilters) =>
    useQuery({
        queryKey: platformShopKeys.list(filters),
        queryFn: () => getPlatformShops(filters),
        placeholderData: keepPreviousData,
        staleTime: 30_000,
        retry: 1,
    });
