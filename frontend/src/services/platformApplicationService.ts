import api from "../lib/axios";
import type {
    ApproveShopApplicationResponse,
    PaginatedShopApplications,
    RejectShopApplicationData,
    RejectShopApplicationResponse,
    ShopApplicationDetail,
    ShopApplicationFilters,
} from "../types/platform/applications";

export const getShopApplications = async (
    filters: ShopApplicationFilters
): Promise<PaginatedShopApplications> => {
    const response = await api.get<PaginatedShopApplications>(
        "/platform/shop-applications/",
        { params: filters }
    );

    return response.data;
};
export const getShopApplication = async (
    publicId: string
): Promise<ShopApplicationDetail> => {
    const response = await api.get<ShopApplicationDetail>(
        `/platform/shop-applications/${encodeURIComponent(publicId)}/`
    );

    return response.data;
};

export const markApplicationUnderReview = async (
    publicId: string
): Promise<ShopApplicationDetail> => {
    const response = await api.post<ShopApplicationDetail>(
        `/platform/shop-applications/${encodeURIComponent(publicId)}/under-review/`
    );

    return response.data;
};

export const approveShopApplication = async (
    publicId: string
): Promise<ApproveShopApplicationResponse> => {
    const response = await api.post<ApproveShopApplicationResponse>(
        `/platform/shop-applications/${encodeURIComponent(publicId)}/approve/`
    );

    return response.data;
};

export const rejectShopApplication = async (
    publicId: string,
    data: RejectShopApplicationData
): Promise<RejectShopApplicationResponse> => {
    const response = await api.post<RejectShopApplicationResponse>(
        `/platform/shop-applications/${encodeURIComponent(publicId)}/reject/`,
        data
    );

    return response.data;
};
