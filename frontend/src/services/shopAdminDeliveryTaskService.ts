import api from "../lib/axios";
import type {
    AssignDeliveryTaskPayload,
    DeliveryTaskDetail,
    DeliveryTaskFilters,
    PaginatedDeliveryTasks,
} from "../types/shopAdmin/deliveryTasks";

const BASE_TASKS_PATH = "/shop-admin/delivery-tasks/";

/**
 * Fetch a paginated list of delivery tasks for the authenticated shop with optional filtering.
 */
export const getDeliveryTasks = async (
    filters?: DeliveryTaskFilters
): Promise<PaginatedDeliveryTasks> => {
    const params: Record<string, string | number> = {};

    if (filters?.task_type) {
        params.task_type = filters.task_type;
    }
    if (filters?.status) {
        params.status = filters.status;
    }
    if (filters?.delivery_agent_id !== undefined && filters.delivery_agent_id !== "") {
        params.delivery_agent_id = filters.delivery_agent_id;
    }
    if (filters?.is_assigned !== undefined && filters.is_assigned !== "") {
        params.is_assigned = String(filters.is_assigned);
    }
    if (filters?.search && filters.search.trim()) {
        params.search = filters.search.trim();
    }
    if (typeof filters?.page === "number" && filters.page > 0) {
        params.page = filters.page;
    }

    const response = await api.get<PaginatedDeliveryTasks>(BASE_TASKS_PATH, {
        params,
    });
    return response.data;
};

/**
 * Fetch detailed delivery task information by ID.
 */
export const getDeliveryTaskDetail = async (
    taskId: number | string
): Promise<DeliveryTaskDetail> => {
    const response = await api.get<DeliveryTaskDetail>(
        `${BASE_TASKS_PATH}${encodeURIComponent(taskId)}/`
    );
    return response.data;
};

/**
 * Assign or reassign a delivery agent to a delivery task.
 * Accepts only `delivery_agent_id` and optional `scheduled_at`.
 */
export const assignDeliveryTask = async (
    taskId: number | string,
    payload: AssignDeliveryTaskPayload
): Promise<DeliveryTaskDetail> => {
    const requestData: Record<string, unknown> = {
        delivery_agent_id: payload.delivery_agent_id,
    };
    if (payload.scheduled_at !== undefined) {
        requestData.scheduled_at = payload.scheduled_at;
    }

    const response = await api.post<DeliveryTaskDetail>(
        `${BASE_TASKS_PATH}${encodeURIComponent(taskId)}/assign/`,
        requestData
    );
    return response.data;
};

/**
 * Unassign a delivery agent from a delivery task.
 * Backend requires an empty JSON object `{}`.
 */
export const unassignDeliveryTask = async (
    taskId: number | string
): Promise<DeliveryTaskDetail> => {
    const response = await api.post<DeliveryTaskDetail>(
        `${BASE_TASKS_PATH}${encodeURIComponent(taskId)}/unassign/`,
        {}
    );
    return response.data;
};
