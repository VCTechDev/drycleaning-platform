import { create } from "zustand";

import type {
    AuthenticatedUser,
    LoginResponse,
    UserRole,
} from "../services/authService";
import {
    clearAuthSession,
    getSessionGeneration,
    getStoredAccessToken,
    getStoredRefreshToken,
    markSessionChanged,
    persistAuthMetadata,
    readPersistedAuthMetadata,
    registerAuthStateReset,
    setStoredTokens,
} from "../lib/authSession";
import { refreshAccessToken } from "../lib/tokenRefresh";

interface PersistedAuthUser {
    user: AuthenticatedUser;
    role: UserRole;
}

type PersistedAuthResult =
    | { status: "missing" }
    | { status: "invalid" }
    | { status: "valid"; value: PersistedAuthUser };

const userRoles: readonly UserRole[] = [
    "customer",
    "platform_admin",
    "shop_admin",
    "delivery_agent",
];

let restorationPromise: Promise<void> | null = null;

const isUserRole = (value: unknown): value is UserRole =>
    typeof value === "string" && userRoles.includes(value as UserRole);

const isAuthenticatedUser = (
    value: unknown
): value is AuthenticatedUser => {
    if (!value || typeof value !== "object") {
        return false;
    }

    const user = value as Record<string, unknown>;

    return (
        typeof user.id === "number" &&
        Number.isFinite(user.id) &&
        typeof user.username === "string" &&
        (typeof user.email === "string" || user.email === null) &&
        isUserRole(user.role)
    );
};

const readPersistedAuthUser = (): PersistedAuthResult => {
    const persistedMetadata = readPersistedAuthMetadata();

    if (!persistedMetadata.exists) {
        return { status: "missing" };
    }

    if (
        !persistedMetadata.value ||
        typeof persistedMetadata.value !== "object"
    ) {
        return { status: "invalid" };
    }

    const metadata = persistedMetadata.value as Record<string, unknown>;
    const user = metadata.user;
    const role = metadata.role;

    if (
        !isAuthenticatedUser(user) ||
        !isUserRole(role) ||
        user.role !== role
    ) {
        return { status: "invalid" };
    }

    return {
        status: "valid",
        value: { user, role },
    };
};

const readRoleFromAccessToken = (accessToken: string | null): UserRole | null => {
    if (!accessToken) {
        return null;
    }

    try {
        const payload = accessToken.split(".")[1];
        const decodedPayload = JSON.parse(atob(payload)) as { role?: unknown };

        return isUserRole(decodedPayload.role) ? decodedPayload.role : null;
    } catch {
        return null;
    }
};

export interface AuthState {
    user: AuthenticatedUser | null;
    role: UserRole | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    hasRestoredSession: boolean;
    setSession: (loginResponse: LoginResponse) => void;
    restoreSession: () => Promise<void>;
    logout: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => {
    registerAuthStateReset(() => {
        set({
            user: null,
            role: null,
            isAuthenticated: false,
            isLoading: false,
            hasRestoredSession: true,
        });
    });

    return {
        user: null,
        role: null,
        isAuthenticated: false,
        isLoading: true,
        hasRestoredSession: false,

        setSession: ({ access, refresh, user, role }) => {
            if (
                !isAuthenticatedUser(user) ||
                !isUserRole(role) ||
                user.role !== role
            ) {
                clearAuthSession();
                throw new Error("Invalid authentication response.");
            }

            markSessionChanged();
            setStoredTokens(access, refresh);
            persistAuthMetadata({ user, role });

            set({
                user,
                role,
                isAuthenticated: true,
                isLoading: false,
                hasRestoredSession: true,
            });
        },

        restoreSession: async () => {
            if (get().hasRestoredSession) {
                return;
            }

            if (restorationPromise) {
                return restorationPromise;
            }

            const restoreGeneration = getSessionGeneration();
            const startingRefreshToken = getStoredRefreshToken();
            const persistedAuth = readPersistedAuthUser();

            restorationPromise = (async () => {
                try {
                    let accessToken = getStoredAccessToken();

                    if (!accessToken && !startingRefreshToken) {
                        clearAuthSession();
                        return;
                    }

                    if (persistedAuth.status === "invalid") {
                        clearAuthSession();
                        return;
                    }

                    if (!accessToken && startingRefreshToken) {
                        accessToken = await refreshAccessToken();
                    }

                    const sessionIsCurrent =
                        getSessionGeneration() === restoreGeneration &&
                        getStoredRefreshToken() === startingRefreshToken;

                    if (!sessionIsCurrent) {
                        return;
                    }

                    const restoredRole =
                        persistedAuth.status === "valid"
                            ? persistedAuth.value.role
                            : readRoleFromAccessToken(accessToken);

                    if (!restoredRole) {
                        clearAuthSession();
                        return;
                    }

                    set({
                        user:
                            persistedAuth.status === "valid"
                                ? persistedAuth.value.user
                                : null,
                        role: restoredRole,
                        isAuthenticated: true,
                    });
                } catch {
                    if (getSessionGeneration() === restoreGeneration) {
                        clearAuthSession();
                    }
                } finally {
                    if (getSessionGeneration() === restoreGeneration) {
                        set({
                            isLoading: false,
                            hasRestoredSession: true,
                        });
                    }
                }
            })();

            try {
                await restorationPromise;
            } finally {
                restorationPromise = null;
            }
        },

        logout: () => {
            clearAuthSession();
        },
    };
});
