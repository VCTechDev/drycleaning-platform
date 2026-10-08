import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
    approveShopApplication,
    markApplicationUnderReview,
    rejectShopApplication,
} from "../../services/platformApplicationService";
import type { RejectShopApplicationData } from "../../types/platform/applications";
import { shopApplicationKeys } from "./useShopApplications";

export const useShopApplicationActions = (publicId: string) => {
    const queryClient = useQueryClient();

    const invalidateApplicationData = async () => {
        await Promise.all([
            queryClient.invalidateQueries({ queryKey: shopApplicationKeys.all }),
            queryClient.invalidateQueries({
                queryKey: shopApplicationKeys.detail(publicId),
            }),
            queryClient.invalidateQueries({ queryKey: ["platform", "dashboard"] }),
        ]);
    };

    const underReviewMutation = useMutation({
        mutationFn: () => markApplicationUnderReview(publicId),
        onSuccess: invalidateApplicationData,
    });

    const approveMutation = useMutation({
        mutationFn: () => approveShopApplication(publicId),
        onSuccess: invalidateApplicationData,
    });

    const rejectMutation = useMutation({
        mutationFn: (data: RejectShopApplicationData) =>
            rejectShopApplication(publicId, data),
        onSuccess: invalidateApplicationData,
    });

    return {
        underReviewMutation,
        approveMutation,
        rejectMutation,
    };
};
