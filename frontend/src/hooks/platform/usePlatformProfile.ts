import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
    getPlatformAdminProfile,
    updatePlatformAdminProfile,
} from "../../services/platformProfileService";
import type { UpdatePlatformAdminProfileData } from "../../types/platform/profile";

export const platformProfileKeys = {
    all: ["platform", "profile"] as const,
    detail: () => [...platformProfileKeys.all, "detail"] as const,
};

export const usePlatformProfile = () =>
    useQuery({
        queryKey: platformProfileKeys.detail(),
        queryFn: getPlatformAdminProfile,
    });

export const useUpdatePlatformProfile = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: UpdatePlatformAdminProfileData) =>
            updatePlatformAdminProfile(data),
        onSuccess: (profile) => {
            queryClient.setQueryData(platformProfileKeys.detail(), profile);
        },
    });
};
