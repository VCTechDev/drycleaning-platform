export interface Shop {
    id: number;
    shop_name: string;
    city: string;
    district: string;
    description: string;
    image: string | null;
    address_line: string;
    opening_time: string;
    closing_time: string;
    is_open: boolean;
    starting_price: string | null;
}