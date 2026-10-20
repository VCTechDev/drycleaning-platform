export type ShopAdminOrderStatus =
    | "placed"
    | "accepted"
    | "pickup_scheduled"
    | "picked_up"
    | "processing"
    | "ready"
    | "delivered"
    | "cancelled"
    | "rejected";

export type ShopAdminPaymentStatus =
    | "pending"
    | "processing"
    | "success"
    | "failed"
    | "cancelled";

export type ShopAdminOrderItemStatus = "active" | "cancelled" | "rejected";

export type ShopAdminDeliveryTaskType = "pickup" | "delivery";

export type ShopAdminDeliveryTaskStatus =
    | "unassigned"
    | "assigned"
    | "in_progress"
    | "completed"
    | "failed"
    | "cancelled";

export interface ShopAdminOrderCustomer {
    id: number;
    username: string;
    first_name: string;
    last_name: string;
    email: string | null;
    phone_number: string | null;
}

export interface ShopAdminOrderItem {
    id: number;
    garment: string;
    service: string;
    quantity: number;
    unit_price: string;
    line_total: string;
    item_status: ShopAdminOrderItemStatus;
    garment_image: string | null;
}

export interface ShopAdminOrderDeliveryTask {
    id: number;
    task_type: ShopAdminDeliveryTaskType;
    status: ShopAdminDeliveryTaskStatus;
    delivery_agent_username: string | null;
    delivery_agent_phone: string | null;
    scheduled_at: string | null;
    completed_at: string | null;
    created_at: string;
    updated_at: string;
}

export interface ShopAdminOrderStatusHistoryItem {
    status: ShopAdminOrderStatus;
    created_at: string;
}

export interface ShopAdminOrderListItem {
    id: number;
    order_number: string;
    customer: ShopAdminOrderCustomer;
    pickup_address_line: string;
    pickup_city: string;
    pickup_district: string;
    total_amount: string;
    order_status: ShopAdminOrderStatus;
    rejection_reason: string | null;
    payment_status: ShopAdminPaymentStatus;
    items_count: number;
    services_count: number;
    created_at: string;
    updated_at: string;
}

export interface ShopAdminOrderDetail {
    id: number;
    order_number: string;
    customer: ShopAdminOrderCustomer;
    note: string;
    pickup_address_line: string;
    pickup_city: string;
    pickup_district: string;
    pickup_state: string;
    pickup_pincode: string;
    total_amount: string;
    order_status: ShopAdminOrderStatus;
    rejection_reason: string | null;
    payment_status: ShopAdminPaymentStatus;
    created_at: string;
    updated_at: string;
    items: ShopAdminOrderItem[];
    status_history: ShopAdminOrderStatusHistoryItem[];
    delivery_tasks: ShopAdminOrderDeliveryTask[];
}

export interface PaginatedShopAdminOrders {
    count: number;
    next: string | null;
    previous: string | null;
    results: ShopAdminOrderListItem[];
}

export interface ShopAdminOrderFilters {
    status?: ShopAdminOrderStatus | "";
    payment_status?: ShopAdminPaymentStatus | "";
    search?: string;
    page?: number;
}

export interface RejectOrderPayload {
    reason: string;
}
