export interface GarmentTypeItem {
    id: number;
    garment_name: string;
    description: string;
    image: string | null;
    is_active: boolean;
}

export interface PlatformServiceItem {
    id: number;
    service_name: string;
    description: string;
    image: string | null;
    is_active: boolean;
}

export interface ShopServiceItem {
    id: number;
    service: number;
    service_name: string;
    garment_type: number;
    garment_name: string;
    price: string;
    estimated_days: number;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface CreateShopServicePayload {
    service: number;
    garment_type: number;
    price: string | number;
    estimated_days: number;
    is_active?: boolean;
}

export interface UpdateShopServicePayload {
    price?: string | number;
    estimated_days?: number;
    is_active?: boolean;
}

export type ServiceRequestStatus =
    | "pending"
    | "under_review"
    | "approved"
    | "rejected";

export interface ShopServiceRequestItem {
    id: number;
    service_name: string;
    description: string;
    image: string | null;
    status: ServiceRequestStatus;
    rejection_reason: string | null;
    approved_service: number | null;
    reviewed_at: string | null;
    created_at: string;
    updated_at: string;
}

export interface CreateServiceRequestPayload {
    service_name: string;
    description?: string;
    image?: File | null;
}

export interface PaginatedResponse<T> {
    count: number;
    next: string | null;
    previous: string | null;
    results: T[];
}
