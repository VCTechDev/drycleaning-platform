import api from "../lib/axios";

export interface CustomerProfile {
    username: string;
    first_name: string;
    last_name: string;
    email: string | null;
    phone_number: string | null;
}

export interface UpdateCustomerProfileData {
    username: string;
    first_name: string;
    last_name: string;
    email: string;
    phone_number: string;
}

export const getCustomerProfile = async (): Promise<CustomerProfile> => {
    const response = await api.get<CustomerProfile>("/profile/");

    return response.data;
};

export const updateCustomerProfile = async (
    data: UpdateCustomerProfileData
): Promise<CustomerProfile> => {
    const response = await api.patch<CustomerProfile>("/profile/", data);

    return response.data;
};
