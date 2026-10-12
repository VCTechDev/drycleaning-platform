import { useQuery } from "@tanstack/react-query";

import { getPlatformServices } from "../../services/platformService";

export const platformServiceKeys = {
    all: ["platform", "services"] as const,
    lists: () => [...platformServiceKeys.all, "list"] as const,
    detail: (serviceId: string) =>
        [...platformServiceKeys.all, "detail", serviceId] as const,
};

export const usePlatformServices = () =>
    useQuery({
        queryKey: platformServiceKeys.lists(),
        queryFn: getPlatformServices,
        staleTime: 30_000,
        retry: 1,
    });
