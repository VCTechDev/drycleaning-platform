import { Route } from "react-router-dom";

import ProtectedRoute from "../components/auth/ProtectedRoute";
import RoleRoute from "../components/auth/RoleRoute";
import PlatformAdminLayout from "../layouts/PlatformAdminLayout";
import PlatformDashboard from "../pages/platform/Dashboard";
import PlatformServices from "../pages/platform/PlatformServices";
import PlatformServiceRequestDetail from "../pages/platform/PlatformServiceRequestDetail";
import PlatformServiceRequests from "../pages/platform/PlatformServiceRequests";
import PlatformOrderDetail from "../pages/platform/PlatformOrderDetail";
import PlatformOrders from "../pages/platform/PlatformOrders";
import PlatformProfile from "../pages/platform/PlatformProfile";
import PlatformUserDetail from "../pages/platform/PlatformUserDetail";
import PlatformUsers from "../pages/platform/PlatformUsers";
import ShopApplicationDetail from "../pages/platform/ShopApplicationDetail";
import ShopApplications from "../pages/platform/ShopApplications";
import PlatformShopDetail from "../pages/platform/PlatformShopDetail";
import PlatformShops from "../pages/platform/PlatformShops";

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
                    element={<PlatformShops />}
                />
                <Route
                    path="shops/:id"
                    element={<PlatformShopDetail />}
                />
                <Route
                    path="services"
                    element={<PlatformServices />}
                />
                <Route
                    path="service-requests"
                    element={<PlatformServiceRequests />}
                />
                <Route
                    path="service-requests/:id"
                    element={<PlatformServiceRequestDetail />}
                />
                <Route
                    path="orders"
                    element={<PlatformOrders />}
                />
                <Route
                    path="orders/:id"
                    element={<PlatformOrderDetail />}
                />
                <Route
                    path="users"
                    element={<PlatformUsers />}
                />
                <Route
                    path="users/:id"
                    element={<PlatformUserDetail />}
                />
                <Route
                    path="profile"
                    element={<PlatformProfile />}
                />
            </Route>
        </Route>
    </Route>
);

export default PlatformAdminRoutes;
