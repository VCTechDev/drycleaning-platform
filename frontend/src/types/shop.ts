export interface Shop {
    id: number;
    shop_name: string;
    city: string;
    district: string;
    description: string;
    image: string | null;
    is_open: boolean;
}