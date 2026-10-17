import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
    createServiceRequest,
    createShopService,
    getGarmentTypes,
    getPlatformServices,
    getServiceRequests,
    getShopServices,
    updateShopService,
} from "../../services/shopAdminService";
import type {
    CreateServiceRequestPayload,
    CreateShopServicePayload,
    UpdateShopServicePayload,
} from "../../types/shopAdmin/services";
import { shopAdminKeys } from "./useShopAdminProfile";

export const shopServicesKeys = {
    all: ["shop-admin-services"] as const,
    garmentTypes: () => [...shopServicesKeys.all, "garment-types"] as const,
    platformServices: () => [...shopServicesKeys.all, "platform-services"] as const,
    shopServices: () => [...shopServicesKeys.all, "shop-services"] as const,
    serviceRequests: () => [...shopServicesKeys.all, "service-requests"] as const,
};

export const useGarmentTypes = () => {
    return useQuery({
        queryKey: shopServicesKeys.garmentTypes(),
        queryFn: getGarmentTypes,
        staleTime: 60_000,
        retry: 1,
    });
};

export const usePlatformServices = () => {
    return useQuery({
        queryKey: shopServicesKeys.platformServices(),
        queryFn: getPlatformServices,
        staleTime: 60_000,
        retry: 1,
    });
};

export const useShopServices = () => {
    return useQuery({
        queryKey: shopServicesKeys.shopServices(),
        queryFn: getShopServices,
        staleTime: 15_000,
        retry: 1,
    });
};

export const useCreateShopService = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: CreateShopServicePayload) => createShopService(data),
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: shopServicesKeys.shopServices(),
            });
            // Refresh shop profile so active services count and open/closed status sync
            queryClient.invalidateQueries({
                queryKey: shopAdminKeys.all,
            });
        },
    });
};

export const useUpdateShopService = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({
            id,
            data,
        }: {
            id: number;
            data: UpdateShopServicePayload;
        }) => updateShopService(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: shopServicesKeys.shopServices(),
            });
            // If deactivating the last active service automatically closes shop,
            // this ensures header and shop profile sync immediately
            queryClient.invalidateQueries({
                queryKey: shopAdminKeys.all,
            });
        },
    });
};

export const useServiceRequests = () => {
    return useQuery({
        queryKey: shopServicesKeys.serviceRequests(),
        queryFn: getServiceRequests,
        staleTime: 15_000,
        retry: 1,
    });
};

export const useCreateServiceRequest = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: FormData | CreateServiceRequestPayload) =>
            createServiceRequest(data),
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: shopServicesKeys.serviceRequests(),
            });
        },
    });
};
