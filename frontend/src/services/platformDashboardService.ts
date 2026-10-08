import api from "../lib/axios";
import type {
    PlatformDashboardParams,
    PlatformDashboardResponse,
    PlatformPopularService,
    PlatformTopShop,
} from "../types/platform/dashboard";

interface BackendTopShop extends Omit<PlatformTopShop, "shop_name"> {
    shop__shop_name: string;
}

interface BackendPopularService
    extends Omit<PlatformPopularService, "service_name"> {
    service_name_snapshot: string;
}

interface BackendDashboardResponse
    extends Omit<PlatformDashboardResponse, "business"> {
    business: Omit<PlatformDashboardResponse["business"], "top_shops" | "popular_services"> & {
        top_shops: BackendTopShop[];
        popular_services: BackendPopularService[];
    };
}

const normalizeDashboardResponse = (
    data: BackendDashboardResponse
): PlatformDashboardResponse => ({
    ...data,
    business: {
        ...data.business,
        top_shops: data.business.top_shops.map(
            ({ shop__shop_name, ...shop }) => ({
                ...shop,
                shop_name: shop__shop_name,
            })
        ),
        popular_services: data.business.popular_services.map(
            ({ service_name_snapshot, ...service }) => ({
                ...service,
                service_name: service_name_snapshot,
            })
        ),
    },
});

export const getPlatformDashboard = async (
    params: PlatformDashboardParams
): Promise<PlatformDashboardResponse> => {
    const response = await api.get<BackendDashboardResponse>(
        "/platform/dashboard/",
        { params }
    );

    return normalizeDashboardResponse(response.data);
};

