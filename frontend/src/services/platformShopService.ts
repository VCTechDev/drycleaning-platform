import api from "../lib/axios";
import type {
    PaginatedPlatformShops,
    PlatformShopDetail,
    PlatformShopFilters,
} from "../types/platform/shops";

export const getPlatformShops = async (
    filters: PlatformShopFilters
): Promise<PaginatedPlatformShops> => {
    const response = await api.get<PaginatedPlatformShops>(
        "/platform/shops/",
        { params: filters }
    );

    return response.data;
};

export const getPlatformShop = async (
    shopId: number | string
): Promise<PlatformShopDetail> => {
    const response = await api.get<PlatformShopDetail>(
        `/platform/shops/${encodeURIComponent(shopId)}/`
    );

    return response.data;
};

export const updatePlatformShopOperationalStatus = async (
    shopId: number | string,
    isOpen: boolean
): Promise<PlatformShopDetail> => {
    const response = await api.post<PlatformShopDetail>(
        `/platform/shops/${encodeURIComponent(shopId)}/operational-status/`,
        { is_open: isOpen }
    );

    return response.data;
};
