export type ShopApplicationStatus =
    | "draft"
    | "submitted"
    | "under_review"
    | "approved"
    | "rejected";

export interface ShopApplicationListItem {
    public_id: string;
    owner_name: string;
    email: string | null;
    phone_number: string;
    shop_name: string;
    district: string;
    city: string;
    status: ShopApplicationStatus;
    created_at: string;
    reviewed_at: string | null;
}

export interface ShopApplicationNotification {
    type: string;
    status: string;
    attempts: number;
    sent_at: string | null;
    last_error: string | null;
}

export interface ShopApplicationDetail extends ShopApplicationListItem {
    description: string;
    image: string | null;
    address_line: string;
    state: string;
    pincode: string;
    opening_time: string | null;
    closing_time: string | null;
    rejection_reason: string | null;
    reviewed_by_username: string | null;
    approved_user_username: string | null;
    created_shop_id: number | null;
    notifications: ShopApplicationNotification[];
    updated_at: string;
}

export interface PaginatedShopApplications {
    count: number;
    next: string | null;
    previous: string | null;
    results: ShopApplicationListItem[];
}

export interface ShopApplicationFilters {
    status?: ShopApplicationStatus;
    page?: number;
}

export interface ApplicationActionNotification {
    status: string;
    delivered: boolean;
    attempts: number;
}

export interface ApproveShopApplicationResponse {
    application: ShopApplicationDetail;
    shop_id: number;
    shop_admin_username: string;
    notification: ApplicationActionNotification;
}

export interface RejectShopApplicationResponse {
    application: ShopApplicationDetail;
    notification: ApplicationActionNotification;
}

export interface RejectShopApplicationData {
    rejection_reason: string;
}
