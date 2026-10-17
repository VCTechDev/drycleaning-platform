import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
    getShopAdminProfile,
    getShopDetails,
    updateOperationalStatus,
    updateShopAdminProfile,
    updateShopDetails,
} from "../../services/shopAdminService";
import type {
    UpdateShopAdminAccountData,
    UpdateShopDetailsData,
} from "../../types/shopAdmin/profile";

export const shopAdminKeys = {
    all: ["shop-admin"] as const,
    profile: () => [...shopAdminKeys.all, "profile"] as const,
    shop: () => [...shopAdminKeys.all, "shop"] as const,
};

export const useShopAdminProfile = () => {
    return useQuery({
        queryKey: shopAdminKeys.profile(),
        queryFn: getShopAdminProfile,
        staleTime: 30_000,
        retry: 1,
    });
};

export const useUpdateShopAdminProfile = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: UpdateShopAdminAccountData) =>
            updateShopAdminProfile(data),
        onSuccess: (updatedProfile) => {
            queryClient.setQueryData(shopAdminKeys.profile(), updatedProfile);
            queryClient.invalidateQueries({ queryKey: shopAdminKeys.all });
        },
    });
};

export const useShopDetails = () => {
    return useQuery({
        queryKey: shopAdminKeys.shop(),
        queryFn: getShopDetails,
        staleTime: 30_000,
        retry: 1,
    });
};

export const useUpdateShopDetails = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: FormData | UpdateShopDetailsData) =>
            updateShopDetails(data),
        onSuccess: (updatedShop) => {
            queryClient.setQueryData(shopAdminKeys.shop(), updatedShop);
            queryClient.invalidateQueries({ queryKey: shopAdminKeys.all });
        },
    });
};

export const useUpdateOperationalStatus = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (isOpen: boolean) => updateOperationalStatus(isOpen),
        onSuccess: (updatedShop) => {
            queryClient.setQueryData(shopAdminKeys.shop(), updatedShop);
            queryClient.invalidateQueries({ queryKey: shopAdminKeys.all });
        },
    });
};
