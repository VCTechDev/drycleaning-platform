import {
    keepPreviousData,
    useMutation,
    useQuery,
    useQueryClient,
} from "@tanstack/react-query";

import {
    assignDeliveryTask,
    getDeliveryTaskDetail,
    getDeliveryTasks,
    unassignDeliveryTask,
} from "../../services/shopAdminDeliveryTaskService";
import type {
    AssignDeliveryTaskPayload,
    DeliveryTaskDetail,
    DeliveryTaskFilters,
    PaginatedDeliveryTasks,
} from "../../types/shopAdmin/deliveryTasks";
import { shopAdminDeliveryAgentKeys } from "./useShopAdminDeliveryAgents";
import { shopAdminOrderKeys } from "./useShopAdminOrders";

export const shopAdminDeliveryTaskKeys = {
    all: ["shop-admin-delivery-tasks"] as const,
    lists: () => [...shopAdminDeliveryTaskKeys.all, "list"] as const,
    list: (filters: DeliveryTaskFilters = {}) =>
        [...shopAdminDeliveryTaskKeys.lists(), filters] as const,
    details: () => [...shopAdminDeliveryTaskKeys.all, "detail"] as const,
    detail: (taskId: number | string) =>
        [...shopAdminDeliveryTaskKeys.details(), String(taskId)] as const,
};

/**
 * Server-paginated delivery tasks query with filter support.
 */
export const useShopAdminDeliveryTasks = (
    filters: DeliveryTaskFilters = {}
) => {
    return useQuery<PaginatedDeliveryTasks, Error>({
        queryKey: shopAdminDeliveryTaskKeys.list(filters),
        queryFn: () => getDeliveryTasks(filters),
        placeholderData: keepPreviousData,
        staleTime: 15_000,
        retry: 1,
    });
};

/**
 * Single delivery task detail query.
 */
export const useShopAdminDeliveryTaskDetail = (
    taskId: number | string | undefined
) => {
    return useQuery<DeliveryTaskDetail, Error>({
        queryKey: shopAdminDeliveryTaskKeys.detail(taskId ?? ""),
        queryFn: () => getDeliveryTaskDetail(taskId!),
        enabled: Boolean(taskId),
        staleTime: 15_000,
        retry: 1,
    });
};

/**
 * Mutation to assign or reassign a delivery agent to a task.
 */
export const useAssignDeliveryTask = () => {
    const queryClient = useQueryClient();

    return useMutation<
        DeliveryTaskDetail,
        Error,
        { taskId: number | string; payload: AssignDeliveryTaskPayload; orderId?: number | string }
    >({
        mutationFn: ({ taskId, payload }) =>
            assignDeliveryTask(taskId, payload),
        onSuccess: (data, variables) => {
            queryClient.invalidateQueries({
                queryKey: shopAdminDeliveryTaskKeys.all,
            });
            queryClient.invalidateQueries({
                queryKey: shopAdminDeliveryAgentKeys.all,
            });
            if (variables.orderId) {
                queryClient.invalidateQueries({
                    queryKey: shopAdminOrderKeys.detail(variables.orderId),
                });
            } else if (data.order?.id) {
                queryClient.invalidateQueries({
                    queryKey: shopAdminOrderKeys.detail(data.order.id),
                });
            }
            queryClient.invalidateQueries({
                queryKey: shopAdminOrderKeys.lists(),
            });
        },
    });
};

/**
 * Mutation to unassign a delivery agent from a task.
 */
export const useUnassignDeliveryTask = () => {
    const queryClient = useQueryClient();

    return useMutation<
        DeliveryTaskDetail,
        Error,
        { taskId: number | string; orderId?: number | string }
    >({
        mutationFn: ({ taskId }) => unassignDeliveryTask(taskId),
        onSuccess: (data, variables) => {
            queryClient.invalidateQueries({
                queryKey: shopAdminDeliveryTaskKeys.all,
            });
            queryClient.invalidateQueries({
                queryKey: shopAdminDeliveryAgentKeys.all,
            });
            if (variables.orderId) {
                queryClient.invalidateQueries({
                    queryKey: shopAdminOrderKeys.detail(variables.orderId),
                });
            } else if (data.order?.id) {
                queryClient.invalidateQueries({
                    queryKey: shopAdminOrderKeys.detail(data.order.id),
                });
            }
            queryClient.invalidateQueries({
                queryKey: shopAdminOrderKeys.lists(),
            });
        },
    });
};
