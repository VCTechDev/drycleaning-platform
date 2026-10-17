export interface ShopAdminProfile {
    id: number;
    username: string;
    first_name: string;
    last_name: string;
    email: string | null;
    phone_number: string | null;
    role: string;
    shop_id: number | null;
    shop_name: string | null;
    is_shop_approved: boolean;
    is_shop_open: boolean;
}

export interface ShopDetails {
    id: number;
    shop_name: string;
    description: string;
    image: string | null;
    contact_number: string;
    address_line: string;
    city: string;
    district: string;
    state: string;
    pincode: string;
    opening_time: string;
    closing_time: string;
    is_approved: boolean;
    is_open: boolean;
    shop_admin_username: string;
    shop_admin_email: string | null;
    active_services_count: number;
    created_at: string;
    updated_at: string;
}

export interface UpdateShopDetailsData {
    description?: string;
    contact_number?: string;
    address_line?: string;
    city?: string;
    district?: string;
    state?: string;
    pincode?: string;
    opening_time?: string;
    closing_time?: string;
    image?: File | null;
}

export interface UpdateShopAdminAccountData {
    first_name?: string;
    last_name?: string;
    email?: string | null;
    phone_number?: string | null;
}

export const KERALA_DISTRICTS = [
    "Thiruvananthapuram",
    "Kollam",
    "Pathanamthitta",
    "Alappuzha",
    "Kottayam",
    "Idukki",
    "Ernakulam",
    "Thrissur",
    "Palakkad",
    "Malappuram",
    "Kozhikode",
    "Wayanad",
    "Kannur",
    "Kasaragod",
] as const;

export type KeralaDistrict = (typeof KERALA_DISTRICTS)[number];
