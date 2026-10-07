import { Route } from "react-router-dom";

import ProtectedRoute from "../components/auth/ProtectedRoute";
import RoleRoute from "../components/auth/RoleRoute";
import PlatformAdminLayout from "../layouts/PlatformAdminLayout";
import PlatformDashboard from "../pages/platform/Dashboard";
import PlatformPlaceholder from "../pages/platform/Placeholder";
import ShopApplicationDetail from "../pages/platform/ShopApplicationDetail";
import ShopApplications from "../pages/platform/ShopApplications";

const PlatformAdminRoutes = (
    <Route element={<ProtectedRoute />}>
        <Route element={<RoleRoute allowedRoles={["platform_admin"]} />}>
            <Route path="platform" element={<PlatformAdminLayout />}>
                <Route
                    index
                    element={<PlatformDashboard />}
                />
                <Route
                    path="applications"
                    element={<ShopApplications />}
                />
                <Route
                    path="applications/:publicId"
                    element={<ShopApplicationDetail />}
                />
                <Route
                    path="shops"
                    element={
                        <PlatformPlaceholder
                            title="Shops"
                            description="Shop management functionality will be introduced in a future phase."
                        />
                    }
                />
                <Route
                    path="services"
                    element={
                        <PlatformPlaceholder
                            title="Services"
                            description="Service management functionality will be introduced in a future phase."
                        />
                    }
                />
                <Route
                    path="service-requests"
                    element={
                        <PlatformPlaceholder
                            title="Service Requests"
                            description="Service request workflows will be introduced in a future phase."
                        />
                    }
                />
                <Route
                    path="orders"
                    element={
                        <PlatformPlaceholder
                            title="Orders"
                            description="Order management functionality will be introduced in a future phase."
                        />
                    }
                />
                <Route
                    path="users"
                    element={
                        <PlatformPlaceholder
                            title="Users"
                            description="User management functionality will be introduced in a future phase."
                        />
                    }
                />
            </Route>
        </Route>
    </Route>
);

export default PlatformAdminRoutes;
