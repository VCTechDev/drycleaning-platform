import api from "../lib/axios";

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
    } catch (error: any) {
        console.log("ORDER DATA:", orderData);
        console.log("ORDER API ERROR:", error.response?.data);

        throw error;
    }
};


export const getMyOrders = async () =>{
    const response = await api.get("/orders/");
    return response.data.results;
}


export const getOrderDetail = async (id: string) => {
    const response = await api.get(`/orders/${id}/`);

    console.log("ORDER DETAILS API:",response.data);
    return response.data;
};


export const getOrderTracking = async (id: string) => {
    const response = await api.get(`/orders/${id}/tracking/`);
    return response.data;
};