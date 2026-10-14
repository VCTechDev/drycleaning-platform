import { keepPreviousData, useQuery } from "@tanstack/react-query";

import {
    getPlatformUser,
    getPlatformUsers,
} from "../../services/platformUserService";
import type { PlatformUserFilters } from "../../types/platform/users";

export const platformUserKeys = {
    all: ["platform", "users"] as const,
    lists: () => [...platformUserKeys.all, "list"] as const,
    list: (filters: PlatformUserFilters) =>
        [...platformUserKeys.lists(), filters] as const,
    detail: (userId: string) =>
        [...platformUserKeys.all, "detail", userId] as const,
};

export const usePlatformUsers = (filters: PlatformUserFilters) =>
    useQuery({
        queryKey: platformUserKeys.list(filters),
        queryFn: () => getPlatformUsers(filters),
        placeholderData: keepPreviousData,
        staleTime: 30_000,
        retry: 1,
    });

export const usePlatformUser = (userId: string | undefined) =>
    useQuery({
        queryKey: platformUserKeys.detail(userId ?? ""),
        queryFn: () => getPlatformUser(userId ?? ""),
        enabled: Boolean(userId),
        staleTime: 30_000,
        retry: 1,
    });
