import axios from "axios";
import api from "../lib/axios";

export type UserRole =
    | "customer"
    | "shop_admin"
    | "platform_admin"
    | "delivery_agent";

export interface LoginData {
    username: string;
    password: string;
}

export interface AuthenticatedUser {
    id: number;
    username: string;
    email: string | null;
    role: UserRole;
}

export interface LoginResponse {
    access: string;
    refresh: string;
    role: UserRole;
    user: AuthenticatedUser;
}

export const login = async (
    credentials: LoginData
): Promise<LoginResponse> => {
    const response = await api.post("/token/", credentials);

    return response.data;
};




export interface RegisterData {
    username: string;
    email: string;
    phone_number: string;
    password: string;
    password_confirm: string;
}

export interface RegisterResponse {
    message: string;
}

export const register = async (
    data: RegisterData
): Promise<RegisterResponse> => {
    const response = await api.post("/register/", data);

    return response.data;
};

export interface AuthMessageResponse {
    message: string;
}

export interface ForgotPasswordData {
    identifier: string;
}

export interface VerifyOTPData extends ForgotPasswordData {
    otp: string;
}

export interface VerifyOTPResponse extends AuthMessageResponse {
    reset_token: string;
}

export interface ResetPasswordData extends ForgotPasswordData {
    reset_token: string;
    new_password: string;
    password_confirm: string;
}

export interface ChangePasswordData {
    current_password: string;
    new_password: string;
    password_confirm: string;
}

export const forgotPassword = async (
    data: ForgotPasswordData
): Promise<AuthMessageResponse> => {
    const response = await api.post<AuthMessageResponse>(
        "/auth/forgot-password/",
        data
    );

    return response.data;
};

export const verifyOTP = async (
    data: VerifyOTPData
): Promise<VerifyOTPResponse> => {
    const response = await api.post<VerifyOTPResponse>(
        "/auth/verify-otp/",
        data
    );

    return response.data;
};

export const resetPassword = async (
    data: ResetPasswordData
): Promise<AuthMessageResponse> => {
    const response = await api.post<AuthMessageResponse>(
        "/auth/reset-password/",
        data
    );

    return response.data;
};

export const changePassword = async (
    data: ChangePasswordData
): Promise<AuthMessageResponse> => {
    const response = await api.post<AuthMessageResponse>(
        "/auth/change-password/",
        data
    );

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


