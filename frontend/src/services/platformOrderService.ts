import api from "../lib/axios";
import type {
    PaginatedPlatformOrders,
    PlatformOrderAnalyticsResponse,
    PlatformOrderDetail,
    PlatformOrderFilters,
} from "../types/platform/orders";

const platformOrdersPath = "/platform/orders/";

export const getPlatformOrders = async (
    filters: PlatformOrderFilters
): Promise<PaginatedPlatformOrders> => {
    const response = await api.get<PaginatedPlatformOrders>(
        platformOrdersPath,
        { params: filters }
    );

    return response.data;
};

export const getPlatformOrder = async (
    orderId: number | string
): Promise<PlatformOrderDetail> => {
    const response = await api.get<PlatformOrderDetail>(
        `${platformOrdersPath}${encodeURIComponent(orderId)}/`
    );

    return response.data;
};

export const getPlatformOrderAnalytics = async (
    filters: Omit<PlatformOrderFilters, "page">
): Promise<PlatformOrderAnalyticsResponse> => {
    const response = await api.get<PlatformOrderAnalyticsResponse>(
        `${platformOrdersPath}analytics/`,
        { params: filters }
    );

    return response.data;
};
