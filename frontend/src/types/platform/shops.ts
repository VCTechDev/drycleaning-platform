export interface PlatformShopListItem {
    id: number;
    shop_name: string;
    shop_admin_username: string | null;
    city: string;
    district: string;
    state: string;
    is_approved: boolean;
    is_open: boolean;
    created_at: string;
}

export interface PlatformShopDetail extends PlatformShopListItem {
    description: string;
    image: string | null;
    contact_number: string;
    address_line: string;
    pincode: string;
    opening_time: string;
    closing_time: string;
    updated_at: string;
    shop_admin_id: number | null;
    shop_admin_email: string | null;
    shop_admin_phone: string | null;
}

export interface PaginatedPlatformShops {
    count: number;
    next: string | null;
    previous: string | null;
    results: PlatformShopListItem[];
}

export type PlatformShopOrdering =
    | "shop_name"
    | "-shop_name"
    | "created_at"
    | "-created_at";

export interface PlatformShopFilters {
    search?: string;
    is_open?: boolean;
    district?: string;
    city?: string;
    ordering?: PlatformShopOrdering;
    page?: number;
}
