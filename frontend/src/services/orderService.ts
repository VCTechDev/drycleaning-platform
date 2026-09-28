import api from "../lib/axios";
import { isAxiosError } from "axios";

export interface OrderItem {
    garment: string;
    service: string;
    quantity: number;
    garment_image: string | null;
}

export interface CustomerOrder {
    id: number;
    order_number: string;
    shop: string;
    shop_city: string;
    shop_district: string;
    items: OrderItem[];
    services_count: number;
    items_count: number;
    total_amount: string;
    order_status: string;
    created_at: string;
}

export interface OrderTrackingItem {
    status: string;
    completed: boolean;
    current: boolean;
    created_at: string | null;
}

export interface CustomerOrderTracking {
    order_number: string;
    order_status: string;
    tracking: OrderTrackingItem[];
}

export interface CustomerOrderDetailItem {
    garment: string;
    service: string;
    quantity: number;
    unit_price: string;
    line_total: string;
    garment_image?: string | null;
}

export interface CustomerOrderDetail {
    order_number: string;
    shop: string;
    shop_city?: string;
    shop_district?: string;
    shop_state?: string;
    note: string;
    pickup_address_line: string;
    pickup_city: string;
    pickup_district: string;
    pickup_state: string;
    pickup_pincode: string;
    total_amount: string;
    order_status: string;
    payment_status: string;
    created_at: string;
    items: CustomerOrderDetailItem[];
}

interface OrderListResponse {
    count: number;
    next: string | null;
    previous: string | null;
    results: CustomerOrder[];
}

export interface CreateOrderData {
    shop: number;
    note: string;
    pickup_address_line: string;
    pickup_city: string;
    pickup_district: string;
    pickup_state: string;
    pickup_pincode: string;
    items: {
        shop_service: number;
        quantity: number;
    }[];
}

export const createOrder = async (orderData: CreateOrderData) => {
    try {
        const response = await api.post("/orders/", orderData);
        return response.data;
    } catch (error: unknown) {
        console.log("ORDER DATA:", orderData);
        console.log(
            "ORDER API ERROR:",
            isAxiosError(error) ? error.response?.data : error
        );

        throw error;
    }
};


export const getMyOrders = async (): Promise<CustomerOrder[]> => {
    const response = await api.get<OrderListResponse>("/orders/");
    return response.data.results;
};


export const getOrderDetail = async (
    id: string
): Promise<CustomerOrderDetail> => {
    const response = await api.get<CustomerOrderDetail>(`/orders/${id}/`);

    console.log("ORDER DETAILS API:",response.data);
    return response.data;
};


export const getOrderTracking = async (
    id: string
): Promise<CustomerOrderTracking> => {
    const response = await api.get<CustomerOrderTracking>(
        `/orders/${id}/tracking/`
    );
    return response.data;
};
