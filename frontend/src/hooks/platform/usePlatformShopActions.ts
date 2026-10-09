import { useMutation, useQueryClient } from "@tanstack/react-query";

import { updatePlatformShopOperationalStatus } from "../../services/platformShopService";
import type { PaginatedPlatformShops } from "../../types/platform/shops";
import { platformShopKeys } from "./usePlatformShops";

export const usePlatformShopActions = (shopId: string) => {
    const queryClient = useQueryClient();

    const statusMutation = useMutation({
        mutationFn: (isOpen: boolean) =>
            updatePlatformShopOperationalStatus(shopId, isOpen),
        onSuccess: (shop) => {
            queryClient.setQueryData(
                platformShopKeys.detail(shopId),
                shop
            );
            queryClient.setQueriesData<PaginatedPlatformShops>(
                { queryKey: platformShopKeys.lists() },
                (current) => {
                    if (!current) {
                        return current;
                    }

                    return {
                        ...current,
                        results: current.results.map((item) =>
                            item.id === shop.id
                                ? { ...item, is_open: shop.is_open }
                                : item
                        ),
                    };
                }
            );
            void queryClient.invalidateQueries({
                queryKey: platformShopKeys.lists(),
            });
            void queryClient.invalidateQueries({
                queryKey: ["platform", "dashboard"],
            });
        },
    });

    return { statusMutation };
};
