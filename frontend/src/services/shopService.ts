import api from "../lib/axios";

export interface ShopFilters {
    search?: string;
    open_now?: boolean;
    district?: string;
    service?: number;
    sort?: "price" | "name";
}

export interface ShopFilterOptions {
    districts: {
        value: string;
        label: string;
    }[];

    services: {
        id: number;
        service_name: string;
    }[];
}

export const getShops = async (filters: ShopFilters = {}) => {
    const params = new URLSearchParams();

    if (filters.search) {
        params.set("search", filters.search);
    }

    if (filters.open_now) {
        params.set("open_now", "true");
    }

    if (filters.district) {
        params.set("district", filters.district);
    }

    if (filters.service) {
        params.set("service", String(filters.service));
    }

    if (filters.sort) {
        params.set("sort", filters.sort);
    }

    const queryString = params.toString();

    const response = await api.get(
        queryString ? `/shops/?${queryString}` : "/shops/"
    );

    return response.data.results;
};

export const getShopFilterOptions = async (): Promise<ShopFilterOptions> => {
    const response = await api.get("/shops/filter-options/");

    return response.data;
};

export const getShopDetail = async (id: string) => {
    const response = await api.get(`/shops/${id}/`);

    return response.data;
};

export const getShopServices = async (shopId: string) => {
    const response = await api.get(`/shops/${shopId}/services/`);

    return response.data;
};