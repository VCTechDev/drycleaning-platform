import { Navigate, Outlet } from "react-router-dom";

import { useAuth } from "../../hooks/useAuth";
import type { UserRole } from "../../services/authService";

interface RoleRouteProps {
    allowedRoles: readonly UserRole[];
}

const roleDestinations: Record<UserRole, string> = {
    customer: "/customer/shops",
    platform_admin: "/platform",
    shop_admin: "/auth/role-pending",
    delivery_agent: "/auth/role-pending",
};

function RoleRoute({ allowedRoles }: RoleRouteProps) {
    const { isAuthenticated, isLoading, role } = useAuth();

    if (isLoading) {
        return <h2>Checking authentication...</h2>;
    }

    if (!isAuthenticated) {
        return <Navigate to="/auth/login" replace />;
    }

    if (!role || !allowedRoles.includes(role)) {
        return (
            <Navigate
                to={role ? roleDestinations[role] : "/auth/role-pending"}
                replace
            />
        );
    }

    return <Outlet />;
}

export default RoleRoute;
