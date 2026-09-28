export interface ShopService {
    id: number;
    service: string;
    garment_type: string;
    garment_image: string | null;
    price: string;
    estimated_days: number;
}

export interface ShopFilters {
    search?: string;
    open_now?: boolean;
    district?: string;
    service?: number;
}