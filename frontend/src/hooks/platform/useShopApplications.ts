import { useQuery } from "@tanstack/react-query";

import { getShopApplications } from "../../services/platformApplicationService";
import type { ShopApplicationFilters } from "../../types/platform/applications";

export const shopApplicationKeys = {
    all: ["platform", "shopApplications"] as const,
    list: (filters: ShopApplicationFilters) =>
        [...shopApplicationKeys.all, filters] as const,
    detail: (publicId: string) =>
        ["platform", "shopApplication", publicId] as const,
};

export const useShopApplications = (filters: ShopApplicationFilters) =>
    useQuery({
        queryKey: shopApplicationKeys.list(filters),
        queryFn: () => getShopApplications(filters),
        staleTime: 30_000,
        retry: 1,
    });
