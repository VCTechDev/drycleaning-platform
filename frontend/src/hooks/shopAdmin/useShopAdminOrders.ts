import {
    keepPreviousData,
    useMutation,
    useQuery,
    useQueryClient,
} from "@tanstack/react-query";

import {
    acceptShopAdminOrder,
    getShopAdminOrderDetail,
    getShopAdminOrders,
    readyShopAdminOrder,
    rejectShopAdminOrder,
    startProcessingShopAdminOrder,
} from "../../services/shopAdminOrderService";
import type {
    ShopAdminOrderDetail,
    ShopAdminOrderFilters,
} from "../../types/shopAdmin/orders";

export const shopAdminOrderKeys = {
    all: ["shop-admin-orders"] as const,
    lists: () => [...shopAdminOrderKeys.all, "list"] as const,
    list: (filters: ShopAdminOrderFilters = {}) =>
        [...shopAdminOrderKeys.lists(), filters] as const,
    details: () => [...shopAdminOrderKeys.all, "detail"] as const,
    detail: (orderId: number | string) =>
        [...shopAdminOrderKeys.details(), String(orderId)] as const,
};

/**
 * Server-paginated orders list query with filter support.
 */
export const useShopAdminOrders = (filters: ShopAdminOrderFilters = {}) => {
    return useQuery({
        queryKey: shopAdminOrderKeys.list(filters),
        queryFn: () => getShopAdminOrders(filters),
        placeholderData: keepPreviousData,
        staleTime: 15_000,
        retry: 1,
    });
};

/**
 * Single order details query by order ID.
 */
export const useShopAdminOrderDetail = (
    orderId: number | string | undefined
) => {
    return useQuery({
        queryKey: shopAdminOrderKeys.detail(orderId ?? ""),
        queryFn: () => getShopAdminOrderDetail(orderId!),
        enabled: Boolean(orderId),
        staleTime: 15_000,
        retry: 1,
    });
};

/**
 * Mutation hook to accept a 'placed' order.
 */
export const useAcceptOrder = () => {
    const queryClient = useQueryClient();

    return useMutation<ShopAdminOrderDetail, Error, number | string>({
        mutationFn: (orderId: number | string) => acceptShopAdminOrder(orderId),
        onSuccess: (_data, orderId) => {
            queryClient.invalidateQueries({
                queryKey: shopAdminOrderKeys.lists(),
            });
            queryClient.invalidateQueries({
                queryKey: shopAdminOrderKeys.detail(orderId),
            });
        },
    });
};

/**
 * Mutation hook to reject a 'placed' order with a required reason.
 */
export const useRejectOrder = () => {
    const queryClient = useQueryClient();

    return useMutation<
        ShopAdminOrderDetail,
        Error,
        { orderId: number | string; reason: string }
    >({
        mutationFn: ({
            orderId,
            reason,
        }: {
            orderId: number | string;
            reason: string;
        }) => rejectShopAdminOrder(orderId, { reason }),
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({
                queryKey: shopAdminOrderKeys.lists(),
            });
            queryClient.invalidateQueries({
                queryKey: shopAdminOrderKeys.detail(variables.orderId),
            });
        },
    });
};

/**
 * Mutation hook to start processing a 'picked_up' order.
 */
export const useStartProcessingOrder = () => {
    const queryClient = useQueryClient();

    return useMutation<ShopAdminOrderDetail, Error, number | string>({
        mutationFn: (orderId: number | string) =>
            startProcessingShopAdminOrder(orderId),
        onSuccess: (_data, orderId) => {
            queryClient.invalidateQueries({
                queryKey: shopAdminOrderKeys.lists(),
            });
            queryClient.invalidateQueries({
                queryKey: shopAdminOrderKeys.detail(orderId),
            });
        },
    });
};

/**
 * Mutation hook to mark a 'processing' order as 'ready'.
 */
export const useReadyOrder = () => {
    const queryClient = useQueryClient();

    return useMutation<ShopAdminOrderDetail, Error, number | string>({
        mutationFn: (orderId: number | string) => readyShopAdminOrder(orderId),
        onSuccess: (_data, orderId) => {
            queryClient.invalidateQueries({
                queryKey: shopAdminOrderKeys.lists(),
            });
            queryClient.invalidateQueries({
                queryKey: shopAdminOrderKeys.detail(orderId),
            });
        },
    });
};
