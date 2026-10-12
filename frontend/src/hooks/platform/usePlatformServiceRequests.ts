import { useQuery } from "@tanstack/react-query";

import {
    getPlatformServiceRequest,
    getPlatformServiceRequests,
} from "../../services/platformServiceRequest";
import type { PlatformServiceRequestFilters } from "../../types/platform/serviceRequests";

export const platformServiceRequestKeys = {
    all: ["platform", "service-requests"] as const,
    lists: () => [...platformServiceRequestKeys.all, "list"] as const,
    list: (filters: PlatformServiceRequestFilters) =>
        [...platformServiceRequestKeys.lists(), filters] as const,
    details: () => [...platformServiceRequestKeys.all, "detail"] as const,
    detail: (requestId: string) =>
        [...platformServiceRequestKeys.details(), requestId] as const,
};

export const usePlatformServiceRequests = (
    filters: PlatformServiceRequestFilters = {}
) =>
    useQuery({
        queryKey: platformServiceRequestKeys.list(filters),
        queryFn: () => getPlatformServiceRequests(filters),
        staleTime: 30_000,
        retry: 1,
    });

export const usePlatformServiceRequest = (requestId: string) =>
    useQuery({
        queryKey: platformServiceRequestKeys.detail(requestId),
        queryFn: () => getPlatformServiceRequest(requestId),
        enabled: Boolean(requestId),
        staleTime: 30_000,
        retry: 1,
    });
