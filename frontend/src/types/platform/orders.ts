export type PlatformOrderStatus =
    | "placed"
    | "accepted"
    | "pickup_scheduled"
    | "picked_up"
    | "processing"
    | "ready"
    | "delivered"
    | "cancelled";

export type PlatformPaymentStatus =
    | "pending"
    | "processing"
    | "success"
    | "failed"
    | "cancelled";

export type PlatformOrderDatePreset =
    | "all"
    | "today"
    | "this_week"
    | "this_month";

export type PlatformOrderAmount = number | string;

export interface PlatformOrderListItem {
    id: number;
    order_number: string;
    customer_username: string;
    shop_name: string;
    total_amount: PlatformOrderAmount;
    order_status: PlatformOrderStatus;
    payment_status: PlatformPaymentStatus;
    created_at: string;
    updated_at: string;
}

export interface PlatformOrderItem {
    id: number;
    shop_service: number;
    garment_name_snapshot: string;
    service_name_snapshot: string;
    quantity: number;
    unit_price_snapshot: PlatformOrderAmount | null;
    line_total: PlatformOrderAmount;
    item_status: "active" | "cancelled" | "rejected";
}

export interface PlatformOrderStatusHistoryItem {
    status: PlatformOrderStatus;
    created_at: string;
}

export interface PlatformOrderDetail extends PlatformOrderListItem {
    customer_email: string | null;
    customer_phone: string | null;
    shop_admin_username: string | null;
    note: string;
    pickup_address_line: string;
    pickup_city: string;
    pickup_district: string;
    pickup_state: string;
    pickup_pincode: string;
    items: PlatformOrderItem[];
    status_history: PlatformOrderStatusHistoryItem[];
}

export interface PaginatedPlatformOrders {
    count: number;
    next: string | null;
    previous: string | null;
    results: PlatformOrderListItem[];
}

export interface PlatformOrderFilters {
    date_preset?: PlatformOrderDatePreset;
    created_from?: string;
    created_to?: string;
    status?: PlatformOrderStatus;
    payment_status?: PlatformPaymentStatus;
    shop?: number;
    page?: number;
}

export interface PlatformOrderAnalyticsFilters {
    date_preset: "all" | "today" | "this_week" | "this_month" | "custom";
    created_from: string | null;
    created_to: string | null;
    timezone: string;
}

export interface PlatformOrderAnalyticsResponse {
    filters: PlatformOrderAnalyticsFilters;
    summary: {
        total_orders: number;
        cancelled_orders: number;
        gross_order_value: PlatformOrderAmount;
    };
}
