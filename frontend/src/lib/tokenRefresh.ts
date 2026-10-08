import axios from "axios";

import {
    clearAuthSession,
    getSessionGeneration,
    getStoredRefreshToken,
    setStoredAccessToken,
} from "./authSession";

let refreshPromise: Promise<string> | null = null;

export class SessionChangedError extends Error {
    constructor() {
        super("Session changed during token refresh.");
        this.name = "SessionChangedError";
    }
}

export const refreshAccessToken = async (): Promise<string> => {
    if (refreshPromise) {
        return refreshPromise;
    }

    const refreshToken = getStoredRefreshToken();

    if (!refreshToken) {
        clearAuthSession();
        throw new Error("No refresh token available.");
    }

    const refreshGeneration = getSessionGeneration();

    refreshPromise = (async () => {
        try {
            const response = await axios.post(
                `${import.meta.env.VITE_API_URL}/token/refresh/`,
                { refresh: refreshToken }
            );

            const newAccessToken = response.data.access as unknown;

            if (typeof newAccessToken !== "string" || !newAccessToken) {
                throw new Error("Refresh response did not include an access token.");
            }

            if (
                getSessionGeneration() !== refreshGeneration ||
                getStoredRefreshToken() !== refreshToken
            ) {
                throw new SessionChangedError();
            }

            setStoredAccessToken(newAccessToken);
            return newAccessToken;
        } catch (error) {
            if (
                getSessionGeneration() === refreshGeneration &&
                getStoredRefreshToken() === refreshToken
            ) {
                clearAuthSession();
            }
            throw error;
        } finally {
            refreshPromise = null;
        }
    })();

    return refreshPromise;
};
