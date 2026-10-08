export type DashboardDecimal = number | string;

export interface PlatformOperationalMetrics {
    total_orders: number;
    pending_orders: number;
    active_orders: number;
    completed_orders: number;
    cancelled_orders: number;
    pending_shop_applications: number;
    approved_shops: number;
    pending_service_requests: number;
    active_shops: number;
}

export interface PlatformTrendPoint {
    date: string;
    count: number;
}

export interface PlatformTopShop {
    shop_id: number;
    shop_name: string;
    order_count: number;
    order_value: DashboardDecimal;
}

export interface PlatformPopularService {
    service_name: string;
    item_count: number;
    order_count: number;
}

export interface PlatformBusinessMetrics {
    gross_order_value: DashboardDecimal;
    order_count_trend: PlatformTrendPoint[];
    customer_growth: PlatformTrendPoint[];
    shop_growth: PlatformTrendPoint[];
    top_shops: PlatformTopShop[];
    popular_services: PlatformPopularService[];
}

export interface PlatformDashboardResponse {
    operational: PlatformOperationalMetrics;
    business: PlatformBusinessMetrics;
}

export interface PlatformDashboardParams {
    days: number;
}

