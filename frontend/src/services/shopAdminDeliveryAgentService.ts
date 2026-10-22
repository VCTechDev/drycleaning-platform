import api from "../lib/axios";
import type {
    DeliveryAgent,
    DeliveryAgentFilters,
    PaginatedDeliveryAgents,
    RegisterDeliveryAgentPayload,
    UpdateDeliveryAgentPayload,
} from "../types/shopAdmin/deliveryAgents";

const BASE_AGENTS_PATH = "/shop-admin/delivery-agents/";

/**
 * Fetch a paginated list of delivery agents for the authenticated shop with optional filtering.
 */
export const getDeliveryAgents = async (
    filters?: DeliveryAgentFilters
): Promise<PaginatedDeliveryAgents> => {
    const params: Record<string, string | number> = {};

    if (filters?.search && filters.search.trim()) {
        params.search = filters.search.trim();
    }
    if (filters?.is_active !== undefined && filters.is_active !== "") {
        params.is_active = String(filters.is_active);
    }
    if (filters?.is_online !== undefined && filters.is_online !== "") {
        params.is_online = String(filters.is_online);
    }
    if (typeof filters?.page === "number" && filters.page > 0) {
        params.page = filters.page;
    }

    const response = await api.get<PaginatedDeliveryAgents>(BASE_AGENTS_PATH, {
        params,
    });
    return response.data;
};

/**
 * Fetch a single delivery agent by ID.
 */
export const getDeliveryAgentDetail = async (
    agentId: number | string
): Promise<DeliveryAgent> => {
    const response = await api.get<DeliveryAgent>(
        `${BASE_AGENTS_PATH}${encodeURIComponent(agentId)}/`
    );
    return response.data;
};

/**
 * Register a new delivery agent for the authenticated shop.
 */
export const registerDeliveryAgent = async (
    payload: RegisterDeliveryAgentPayload
): Promise<DeliveryAgent> => {
    const response = await api.post<DeliveryAgent>(BASE_AGENTS_PATH, payload);
    return response.data;
};

/**
 * Update an existing delivery agent (shift hours, active status, name, phone).
 */
export const updateDeliveryAgent = async (
    agentId: number | string,
    payload: UpdateDeliveryAgentPayload
): Promise<DeliveryAgent> => {
    const response = await api.patch<DeliveryAgent>(
        `${BASE_AGENTS_PATH}${encodeURIComponent(agentId)}/`,
        payload
    );
    return response.data;
};
