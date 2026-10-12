import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
    createPlatformService,
    updatePlatformService,
} from "../../services/platformService";
import { platformServiceKeys } from "./usePlatformServices";

export const usePlatformServiceActions = () => {
    const queryClient = useQueryClient();

    const invalidateServiceData = async () => {
        await queryClient.invalidateQueries({
            queryKey: platformServiceKeys.all,
        });
    };

    const createMutation = useMutation({
        mutationFn: createPlatformService,
        onSuccess: invalidateServiceData,
    });

    const updateMutation = useMutation({
        mutationFn: ({ serviceId, data }: { serviceId: number; data: FormData }) =>
            updatePlatformService(serviceId, data),
        onSuccess: invalidateServiceData,
    });

    return { createMutation, updateMutation };
};
