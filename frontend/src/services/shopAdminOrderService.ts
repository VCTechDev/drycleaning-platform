import api from "../lib/axios";
import type {
    PaginatedShopAdminOrders,
    RejectOrderPayload,
    ShopAdminOrderDetail,
    ShopAdminOrderFilters,
} from "../types/shopAdmin/orders";

const BASE_ORDERS_PATH = "/shop-admin/orders/";

/**
 * Fetch a single paginated page of shop-admin orders with optional filters.
 */
export const getShopAdminOrders = async (
    filters?: ShopAdminOrderFilters
): Promise<PaginatedShopAdminOrders> => {
    const params: Record<string, string | number> = {};

    if (filters?.status) {
        params.status = filters.status;
    }
    if (filters?.payment_status) {
        params.payment_status = filters.payment_status;
    }
    if (filters?.search && filters.search.trim()) {
        params.search = filters.search.trim();
    }
    if (typeof filters?.page === "number" && filters.page > 0) {
        params.page = filters.page;
    }

    const response = await api.get<PaginatedShopAdminOrders>(BASE_ORDERS_PATH, {
        params,
    });
    return response.data;
};

/**
 * Fetch detailed information for a single shop-admin order by ID.
 */
export const getShopAdminOrderDetail = async (
    orderId: number | string
): Promise<ShopAdminOrderDetail> => {
    const response = await api.get<ShopAdminOrderDetail>(
        `${BASE_ORDERS_PATH}${encodeURIComponent(orderId)}/`
    );
    return response.data;
};

/**
 * Transition a 'placed' order to 'accepted'.
 * Creates a logistics pickup task on the backend.
 */
export const acceptShopAdminOrder = async (
    orderId: number | string
): Promise<ShopAdminOrderDetail> => {
    const response = await api.post<ShopAdminOrderDetail>(
        `${BASE_ORDERS_PATH}${encodeURIComponent(orderId)}/accept/`
    );
    return response.data;
};

/**
 * Transition a 'placed' order to 'rejected' with a required non-empty reason.
 */
export const rejectShopAdminOrder = async (
    orderId: number | string,
    payload: RejectOrderPayload
): Promise<ShopAdminOrderDetail> => {
    const response = await api.post<ShopAdminOrderDetail>(
        `${BASE_ORDERS_PATH}${encodeURIComponent(orderId)}/reject/`,
        { reason: payload.reason.trim() }
    );
    return response.data;
};

/**
 * Transition a 'picked_up' order to 'processing'.
 */
export const startProcessingShopAdminOrder = async (
    orderId: number | string
): Promise<ShopAdminOrderDetail> => {
    const response = await api.post<ShopAdminOrderDetail>(
        `${BASE_ORDERS_PATH}${encodeURIComponent(orderId)}/start-processing/`
    );
    return response.data;
};

/**
 * Transition a 'processing' order to 'ready'.
 * Creates a logistics delivery task on the backend.
 */
export const readyShopAdminOrder = async (
    orderId: number | string
): Promise<ShopAdminOrderDetail> => {
    const response = await api.post<ShopAdminOrderDetail>(
        `${BASE_ORDERS_PATH}${encodeURIComponent(orderId)}/ready/`
    );
    return response.data;
};
