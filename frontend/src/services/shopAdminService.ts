import api from "../lib/axios";
import type {
    ShopAdminProfile,
    ShopDetails,
    UpdateShopAdminAccountData,
    UpdateShopDetailsData,
} from "../types/shopAdmin/profile";

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
