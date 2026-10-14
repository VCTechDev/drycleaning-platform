import { keepPreviousData, useQuery } from "@tanstack/react-query";

import {
    getPlatformOrder,
    getPlatformOrderAnalytics,
    getPlatformOrders,
} from "../../services/platformOrderService";
import type { PlatformOrderFilters } from "../../types/platform/orders";

export const platformOrderKeys = {
    all: ["platform", "orders"] as const,
    lists: () => [...platformOrderKeys.all, "list"] as const,
    list: (filters: PlatformOrderFilters) =>
        [...platformOrderKeys.lists(), filters] as const,
    analytics: (filters: Omit<PlatformOrderFilters, "page">) =>
        [...platformOrderKeys.all, "analytics", filters] as const,
    detail: (orderId: string) =>
        [...platformOrderKeys.all, "detail", orderId] as const,
};

export const usePlatformOrders = (filters: PlatformOrderFilters) =>
    useQuery({
        queryKey: platformOrderKeys.list(filters),
        queryFn: () => getPlatformOrders(filters),
        placeholderData: keepPreviousData,
        staleTime: 30_000,
        retry: 1,
    });

export const usePlatformOrderAnalytics = (
    filters: Omit<PlatformOrderFilters, "page">
) =>
    useQuery({
        queryKey: platformOrderKeys.analytics(filters),
        queryFn: () => getPlatformOrderAnalytics(filters),
        placeholderData: keepPreviousData,
        staleTime: 30_000,
        retry: 1,
    });

export const usePlatformOrder = (orderId: string | undefined) =>
    useQuery({
        queryKey: platformOrderKeys.detail(orderId ?? ""),
        queryFn: () => getPlatformOrder(orderId ?? ""),
        enabled: Boolean(orderId),
        staleTime: 30_000,
        retry: 1,
    });
