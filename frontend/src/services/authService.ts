import axios from "axios";
import api from "../lib/axios";

interface LoginData {
    username: string;
    password: string;
}

interface LoginResponse {
    access: string;
    refresh: string;
}

export const login = async (
    credentials: LoginData
): Promise<LoginResponse> => {
    const response = await api.post("/token/", credentials);

    return response.data;
};




interface RegisterData {
    username: string;
    email: string;
    phone_number: string;
    password: string;
    password_confirm: string;
}

interface RegisterResponse {
    message: string;
}

export const register = async (
    data: RegisterData
): Promise<RegisterResponse> => {
    const response = await api.post("/register/", data);

    return response.data;
};




// This request must bypass our authenticated Axios instance.
// Otherwise a failed refresh could trigger the refresh interceptor again.
export const refreshAccessToken = async (refreshToken: string) => {
    const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/token/refresh/`,
        {
            refresh: refreshToken,
        }
    );

    return response.data.access;
};


export const logout = () => {
    // Remove both JWT tokens from the browser.
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
};


