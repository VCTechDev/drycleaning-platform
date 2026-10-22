export type DeliveryTaskType = "pickup" | "delivery";

export type DeliveryTaskStatus =
    | "unassigned"
    | "assigned"
    | "in_progress"
    | "completed"
    | "failed"
    | "cancelled";

export interface DeliveryTaskOrderSummary {
    id: number;
    order_number: string;
    order_status: string;
    total_amount: string;
    customer_name: string;
    customer_phone: string | null;
    customer_email: string | null;
    pickup_address_line: string;
    pickup_city: string;
    pickup_district: string;
    pickup_state: string;
    pickup_pincode: string;
    note: string;
}

export interface DeliveryTaskAgentSummary {
    id: number;
    username: string;
    first_name: string;
    last_name: string;
    phone_number: string | null;
    is_active: boolean;
    is_online: boolean;
    shift_starts_at: string;
    shift_ends_at: string;
}

export interface DeliveryTaskDetail {
    id: number;
    order: DeliveryTaskOrderSummary;
    order_number: string;
    task_type: DeliveryTaskType;
    status: DeliveryTaskStatus;
    delivery_agent: DeliveryTaskAgentSummary | null;
    delivery_agent_id: number | null;
    scheduled_at: string | null;
    completed_at: string | null;
    created_at: string;
    updated_at: string;
}

export interface PaginatedDeliveryTasks {
    count: number;
    next: string | null;
    previous: string | null;
    results: DeliveryTaskDetail[];
}

export interface DeliveryTaskFilters {
    task_type?: DeliveryTaskType | "";
    status?: DeliveryTaskStatus | "";
    delivery_agent_id?: number | "";
    is_assigned?: boolean | "";
    search?: string;
    page?: number;
}

export interface AssignDeliveryTaskPayload {
    delivery_agent_id: number;
    scheduled_at?: string | null;
}
