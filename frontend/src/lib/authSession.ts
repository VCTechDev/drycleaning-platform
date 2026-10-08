export const ACCESS_TOKEN_STORAGE_KEY = "access_token";
export const REFRESH_TOKEN_STORAGE_KEY = "refresh_token";
export const AUTH_USER_STORAGE_KEY = "auth_user";
export const AUTH_ROLE_STORAGE_KEY = "auth_role";

interface PersistedMetadataResult {
    exists: boolean;
    value: unknown;
}

let sessionGeneration = 0;
let resetAuthState: () => void = () => undefined;

export const getSessionGeneration = () => sessionGeneration;

export const markSessionChanged = () => {
    sessionGeneration += 1;
};

export const registerAuthStateReset = (reset: () => void) => {
    resetAuthState = reset;
};

export const readPersistedAuthMetadata = (): PersistedMetadataResult => {
    const rawMetadata = localStorage.getItem(AUTH_USER_STORAGE_KEY);

    if (rawMetadata === null) {
        return { exists: false, value: null };
    }

    try {
        return {
            exists: true,
            value: JSON.parse(rawMetadata) as unknown,
        };
    } catch {
        return { exists: true, value: null };
    }
};

export const persistAuthMetadata = (metadata: unknown) => {
    localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(metadata));
    localStorage.removeItem(AUTH_ROLE_STORAGE_KEY);
};

export const setStoredTokens = (accessToken: string, refreshToken: string) => {
    localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, refreshToken);
};

export const getStoredAccessToken = () =>
    localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);

export const getStoredRefreshToken = () =>
    localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY);

export const setStoredAccessToken = (accessToken: string) => {
    localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, accessToken);
};

export const clearAuthSession = () => {
    sessionGeneration += 1;

    localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
    localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
    localStorage.removeItem(AUTH_USER_STORAGE_KEY);
    localStorage.removeItem(AUTH_ROLE_STORAGE_KEY);

    resetAuthState();
};
