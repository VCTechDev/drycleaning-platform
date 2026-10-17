import api from "../lib/axios";
import type {
    ShopAdminProfile,
    ShopDetails,
    UpdateShopAdminAccountData,
    UpdateShopDetailsData,
} from "../types/shopAdmin/profile";
import type {
    CreateServiceRequestPayload,
    CreateShopServicePayload,
    GarmentTypeItem,
    PaginatedResponse,
    PlatformServiceItem,
    ShopServiceItem,
    ShopServiceRequestItem,
    UpdateShopServicePayload,
} from "../types/shopAdmin/services";

export const getShopAdminProfile = async (): Promise<ShopAdminProfile> => {
    const response = await api.get<ShopAdminProfile>("/shop-admin/profile/");
    return response.data;
};

export const updateShopAdminProfile = async (
    data: UpdateShopAdminAccountData
): Promise<ShopAdminProfile> => {
    const response = await api.patch<ShopAdminProfile>("/shop-admin/profile/", data);
    return response.data;
};

export const getShopDetails = async (): Promise<ShopDetails> => {
    const response = await api.get<ShopDetails>("/shop-admin/shop/");
    return response.data;
};

export const updateShopDetails = async (
    data: FormData | UpdateShopDetailsData
): Promise<ShopDetails> => {
    let payload: FormData | UpdateShopDetailsData = data;

    if (!(data instanceof FormData)) {
        const formData = new FormData();
        Object.entries(data).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                if (key === "image" && value instanceof File) {
                    formData.append("image", value);
                } else if (key !== "image") {
                    formData.append(key, String(value));
                }
            }
        });
        payload = formData;
    }

    const response = await api.patch<ShopDetails>("/shop-admin/shop/", payload);
    return response.data;
};

export const updateOperationalStatus = async (
    isOpen: boolean
): Promise<ShopDetails> => {
    const response = await api.post<ShopDetails>(
        "/shop-admin/shop/operational-status/",
        { is_open: isOpen }
    );
    return response.data;
};

// ----------------------------------------------------------------------
// Shop Admin Services & Service Requests
// ----------------------------------------------------------------------

/**
 * Helper to fetch all records from a paginated DRF endpoint.
 * Handles both flat arrays and { count, next, previous, results: [] } shapes.
 * If multiple pages exist, it traverses ?page=N up to maxPages to prevent omissions.
 */
async function fetchAllPaginated<T>(
    endpoint: string,
    maxPages = 30
): Promise<T[]> {
    const firstResponse = await api.get<PaginatedResponse<T> | T[]>(endpoint);

    if (Array.isArray(firstResponse.data)) {
        return firstResponse.data;
    }

    const firstPageResults = firstResponse.data?.results ?? [];
    const totalCount = firstResponse.data?.count;
    const hasNext = Boolean(firstResponse.data?.next);

    // If there is only one page or no next link, return immediately
    if (
        !hasNext ||
        (typeof totalCount === "number" && firstPageResults.length >= totalCount)
    ) {
        return firstPageResults;
    }

    let accumulated = [...firstPageResults];
    let page = 2;

    while (page <= maxPages) {
        const separator = endpoint.includes("?") ? "&" : "?";
        const pageResponse = await api.get<PaginatedResponse<T> | T[]>(
            `${endpoint}${separator}page=${page}`
        );

        if (Array.isArray(pageResponse.data)) {
            accumulated = accumulated.concat(pageResponse.data);
            break;
        }

        const pageResults = pageResponse.data?.results ?? [];
        if (pageResults.length === 0) {
            break;
        }
        accumulated = accumulated.concat(pageResults);

        if (!pageResponse.data?.next) {
            break;
        }
        if (typeof totalCount === "number" && accumulated.length >= totalCount) {
            break;
        }
        page++;
    }

    return accumulated;
}

export const getGarmentTypes = async (): Promise<GarmentTypeItem[]> => {
    return fetchAllPaginated<GarmentTypeItem>("/shop-admin/garment-types/");
};

export const getPlatformServices = async (): Promise<PlatformServiceItem[]> => {
    return fetchAllPaginated<PlatformServiceItem>("/shop-admin/services/");
};

export const getShopServices = async (): Promise<ShopServiceItem[]> => {
    return fetchAllPaginated<ShopServiceItem>("/shop-admin/shop-services/");
};

export const createShopService = async (
    data: CreateShopServicePayload
): Promise<ShopServiceItem> => {
    const response = await api.post<ShopServiceItem>(
        "/shop-admin/shop-services/",
        data
    );
    return response.data;
};

export const updateShopService = async (
    id: number,
    data: UpdateShopServicePayload
): Promise<ShopServiceItem> => {
    const response = await api.patch<ShopServiceItem>(
        `/shop-admin/shop-services/${id}/`,
        data
    );
    return response.data;
};

export const getServiceRequests = async (): Promise<ShopServiceRequestItem[]> => {
    return fetchAllPaginated<ShopServiceRequestItem>("/shop-admin/service-requests/");
};

export const createServiceRequest = async (
    data: FormData | CreateServiceRequestPayload
): Promise<ShopServiceRequestItem> => {
    let payload: FormData | CreateServiceRequestPayload = data;

    if (!(data instanceof FormData)) {
        const formData = new FormData();
        formData.append("service_name", data.service_name.trim());
        if (data.description) {
            formData.append("description", data.description.trim());
        }
        if (data.image instanceof File) {
            formData.append("image", data.image);
        }
        payload = formData;
    }

    const response = await api.post<ShopServiceRequestItem>(
        "/shop-admin/service-requests/",
        payload
    );
    return response.data;
};
