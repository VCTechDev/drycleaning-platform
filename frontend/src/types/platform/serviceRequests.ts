export type ServiceRequestStatus =
    | "pending"
    | "under_review"
    | "approved"
    | "rejected";

export interface PlatformServiceRequestListItem {
    id: number;
    shop_name: string;
    requested_by_username: string;
    service_name: string;
    status: ServiceRequestStatus;
    created_at: string;
    reviewed_at: string | null;
}

export interface PlatformServiceRequestDetail
    extends PlatformServiceRequestListItem {
    description: string;
    image: string | null;
    rejection_reason: string | null;
    approved_service_id: number | null;
    reviewed_by_username: string | null;
    updated_at: string;
}

export interface PaginatedPlatformServiceRequests {
    count: number;
    next: string | null;
    previous: string | null;
    results: PlatformServiceRequestListItem[];
}

export interface PlatformServiceRequestFilters {
    status?: ServiceRequestStatus;
    shop?: number;
    page?: number;
}

export interface RejectPlatformServiceRequestData {
    rejection_reason: string;
}

export interface ApprovePlatformServiceRequestResponse {
    request: PlatformServiceRequestDetail;
    service_id: number;
}
