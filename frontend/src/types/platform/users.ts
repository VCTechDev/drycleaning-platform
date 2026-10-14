export type PlatformUserRole =
    | "customer"
    | "shop_admin"
    | "delivery_agent";

export interface PlatformUserListItem {
    id: number;
    username: string;
    first_name: string;
    last_name: string;
    email: string | null;
    phone_number: string | null;
    role: PlatformUserRole;
    is_active: boolean;
    date_joined: string;
    shop_name: string | null;
}

export type PlatformUserDetail = PlatformUserListItem;

export interface PaginatedPlatformUsers {
    count: number;
    next: string | null;
    previous: string | null;
    results: PlatformUserListItem[];
}

export interface PlatformUserFilters {
    search?: string;
    role?: PlatformUserRole;
    is_active?: boolean;
    page?: number;
}
