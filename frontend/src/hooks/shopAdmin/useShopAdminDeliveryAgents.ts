import {
    keepPreviousData,
    useMutation,
    useQuery,
    useQueryClient,
} from "@tanstack/react-query";

import {
    getDeliveryAgentDetail,
    getDeliveryAgents,
    registerDeliveryAgent,
    updateDeliveryAgent,
} from "../../services/shopAdminDeliveryAgentService";
import type {
    DeliveryAgent,
    DeliveryAgentFilters,
    PaginatedDeliveryAgents,
    RegisterDeliveryAgentPayload,
    UpdateDeliveryAgentPayload,
} from "../../types/shopAdmin/deliveryAgents";

export const shopAdminDeliveryAgentKeys = {
    all: ["shop-admin-delivery-agents"] as const,
    lists: () => [...shopAdminDeliveryAgentKeys.all, "list"] as const,
    list: (filters: DeliveryAgentFilters = {}) =>
        [...shopAdminDeliveryAgentKeys.lists(), filters] as const,
    details: () => [...shopAdminDeliveryAgentKeys.all, "detail"] as const,
    detail: (agentId: number | string) =>
        [...shopAdminDeliveryAgentKeys.details(), String(agentId)] as const,
};

/**
 * Server-paginated delivery agents query with filter support.
 */
export const useShopAdminDeliveryAgents = (
    filters: DeliveryAgentFilters = {}
) => {
    return useQuery<PaginatedDeliveryAgents, Error>({
        queryKey: shopAdminDeliveryAgentKeys.list(filters),
        queryFn: () => getDeliveryAgents(filters),
        placeholderData: keepPreviousData,
        staleTime: 15_000,
        retry: 1,
    });
};

/**
 * Single delivery agent detail query.
 */
export const useShopAdminDeliveryAgentDetail = (
    agentId: number | string | undefined
) => {
    return useQuery<DeliveryAgent, Error>({
        queryKey: shopAdminDeliveryAgentKeys.detail(agentId ?? ""),
        queryFn: () => getDeliveryAgentDetail(agentId!),
        enabled: Boolean(agentId),
        staleTime: 15_000,
        retry: 1,
    });
};

/**
 * Mutation to register a new delivery agent.
 */
export const useRegisterDeliveryAgent = () => {
    const queryClient = useQueryClient();

    return useMutation<DeliveryAgent, Error, RegisterDeliveryAgentPayload>({
        mutationFn: (payload: RegisterDeliveryAgentPayload) =>
            registerDeliveryAgent(payload),
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: shopAdminDeliveryAgentKeys.lists(),
            });
        },
    });
};

/**
 * Mutation to update an existing delivery agent.
 */
export const useUpdateDeliveryAgent = () => {
    const queryClient = useQueryClient();

    return useMutation<
        DeliveryAgent,
        Error,
        { agentId: number | string; payload: UpdateDeliveryAgentPayload }
    >({
        mutationFn: ({
            agentId,
            payload,
        }: {
            agentId: number | string;
            payload: UpdateDeliveryAgentPayload;
        }) => updateDeliveryAgent(agentId, payload),
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({
                queryKey: shopAdminDeliveryAgentKeys.lists(),
            });
            queryClient.invalidateQueries({
                queryKey: shopAdminDeliveryAgentKeys.detail(variables.agentId),
            });
            // Also invalidate task lists because agent information is embedded in tasks
            queryClient.invalidateQueries({
                queryKey: ["shop-admin-delivery-tasks"],
            });
        },
    });
};
