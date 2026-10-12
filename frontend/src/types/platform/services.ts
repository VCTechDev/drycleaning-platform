export interface PlatformService {
    id: number;
    service_name: string;
    description: string;
    image: string | null;
    is_active: boolean;
    shop_count: number;
    order_item_count: number;
    created_at: string;
    updated_at: string;
}

export interface PaginatedPlatformServices {
    count: number;
    next: string | null;
    previous: string | null;
    results: PlatformService[];
}

export interface PlatformServicesResult {
    count: number;
    results: PlatformService[];
}
