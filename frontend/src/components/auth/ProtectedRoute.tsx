import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";

import { refreshAccessToken } from "../../services/authService";

function ProtectedRoute() {
    const [checkingAuth, setCheckingAuth] = useState(true);
    const [authenticated, setAuthenticated] = useState(false);

    useEffect(() => {
        const checkAuthentication = async () => {
            const accessToken = localStorage.getItem("access_token");
            const refreshToken = localStorage.getItem("refresh_token");

            // Access token exists → allow immediately.
            if (accessToken) {
                setAuthenticated(true);
                setCheckingAuth(false);
                return;
            }

            // No access token, but refresh token exists.
            // Try to get a new access token before sending the
            // customer to the login page.
            if (refreshToken) {
                try {
                    const newAccessToken =
                        await refreshAccessToken(refreshToken);

                    localStorage.setItem(
                        "access_token",
                        newAccessToken
                    );

                    setAuthenticated(true);
                } catch (error) {
                    // Refresh token is invalid/expired.
                    localStorage.removeItem("access_token");
                    localStorage.removeItem("refresh_token");

                    setAuthenticated(false);
                } finally {
                    setCheckingAuth(false);
                }

                return;
            }

            // Neither token exists.
            setAuthenticated(false);
            setCheckingAuth(false);
        };

        checkAuthentication();
    }, []);

    // Don't redirect while we're checking/refreshing authentication.
    if (checkingAuth) {
        return <h2>Checking authentication...</h2>;
    }

    if (!authenticated) {
        return <Navigate to="/auth/login" replace />;
    }

    return <Outlet />;
}

export default ProtectedRoute;