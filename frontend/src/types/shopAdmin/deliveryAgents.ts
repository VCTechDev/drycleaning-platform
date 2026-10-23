export interface DeliveryAgentUser {
    id: number;
    username: string;
    email: string | null;
    first_name: string;
    last_name: string;
    phone_number: string | null;
    role: string;
    date_joined: string;
}

export interface DeliveryAgent {
    id: number;
    user: DeliveryAgentUser;
    shop: number;
    shop_name: string;
    shift_starts_at: string;
    shift_ends_at: string;
    is_active: boolean;
    is_online: boolean;
    active_tasks_count: number;
    created_at: string;
    updated_at: string;
}

export interface PaginatedDeliveryAgents {
    count: number;
    next: string | null;
    previous: string | null;
    results: DeliveryAgent[];
}

export interface DeliveryAgentFilters {
    search?: string;
    is_active?: boolean | "";
    is_online?: boolean | "";
    page?: number;
}

export interface RegisterDeliveryAgentPayload {
    username: string;
    email: string;
    password: string;
    password_confirm?: string;
    first_name?: string;
    last_name?: string;
    phone_number?: string;
    shift_starts_at: string;
    shift_ends_at: string;
    is_active?: boolean;
}

export interface UpdateDeliveryAgentPayload {
    first_name?: string;
    last_name?: string;
    phone_number?: string;
    shift_starts_at?: string;
    shift_ends_at?: string;
    is_active?: boolean;
}
