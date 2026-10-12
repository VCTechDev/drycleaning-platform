import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
    approvePlatformServiceRequest,
    movePlatformServiceRequestToReview,
    rejectPlatformServiceRequest,
} from "../../services/platformServiceRequest";
import type { RejectPlatformServiceRequestData } from "../../types/platform/serviceRequests";
import { platformServiceKeys } from "./usePlatformServices";
import { platformServiceRequestKeys } from "./usePlatformServiceRequests";

export const usePlatformServiceRequestActions = (requestId: string) => {
    const queryClient = useQueryClient();

    const invalidateRequestData = async () => {
        await Promise.all([
            queryClient.invalidateQueries({
                queryKey: platformServiceRequestKeys.all,
            }),
            queryClient.invalidateQueries({
                queryKey: platformServiceRequestKeys.detail(requestId),
            }),
            queryClient.invalidateQueries({
                queryKey: ["platform", "dashboard"],
            }),
        ]);
    };

    const underReviewMutation = useMutation({
        mutationFn: () => movePlatformServiceRequestToReview(requestId),
        onSuccess: invalidateRequestData,
    });

    const approveMutation = useMutation({
        mutationFn: () => approvePlatformServiceRequest(requestId),
        onSuccess: async () => {
            await invalidateRequestData();
            await queryClient.invalidateQueries({
                queryKey: platformServiceKeys.all,
            });
        },
    });

    const rejectMutation = useMutation({
        mutationFn: (data: RejectPlatformServiceRequestData) =>
            rejectPlatformServiceRequest(requestId, data),
        onSuccess: invalidateRequestData,
    });

    return { underReviewMutation, approveMutation, rejectMutation };
};
