import api from "../lib/axios";



export const getShops = async () => {
    const response = await api.get("/shops/");
    return response.data.results;
};


export const getShopDetail = async(id:string)=>{
    const response = await api.get(`/shops/${id}/`);
    return response.data;
};


export const getShopServices = async (shopId: string) => {
    const response = await api.get(`/shops/${shopId}/services/`);

    console.log("SHOP SERVICES API:", response.data);

    return response.data;
};