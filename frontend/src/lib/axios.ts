import axios from "axios";

import { getStoredAccessToken } from "./authSession";
import {
    refreshAccessToken,
    SessionChangedError,
} from "./tokenRefresh";

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL,
    headers: {
        "Content-Type": "application/json",
    },
});

api.interceptors.request.use(
    (config) => {
        const accessToken = getStoredAccessToken();

        if (accessToken) {
            config.headers.Authorization = `Bearer ${accessToken}`;
        }

        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

api.interceptors.response.use(
    (response) => {
        return response;
    },
    async (error) => {
        const originalRequest = error.config;

        if (
            error.response?.status === 401 &&
            originalRequest &&
            !originalRequest._retry
        ) {
            originalRequest._retry = true;

            try {
                const newAccessToken = await refreshAccessToken();

                originalRequest.headers.Authorization =
                    `Bearer ${newAccessToken}`;

                return api(originalRequest);
            } catch (refreshError) {
                if (!(refreshError instanceof SessionChangedError)) {
                    window.location.href = "/auth/login";
                }

                return Promise.reject(refreshError);
            }
        }

        return Promise.reject(error);
    }
);

export default api;
