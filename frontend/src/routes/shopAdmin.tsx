import { Route } from "react-router-dom";

import ProtectedRoute from "../components/auth/ProtectedRoute";
import RoleRoute from "../components/auth/RoleRoute";
import ShopAdminLayout from "../layouts/ShopAdminLayout";
import ShopDashboard from "../pages/shop-admin/Dashboard";
import ShopOrders from "../pages/shop-admin/Orders";
import ShopOrderDetail from "../pages/shop-admin/OrderDetail";
import ShopServices from "../pages/shop-admin/Services";
import ShopServiceRequests from "../pages/shop-admin/ServiceRequests";
import ShopDeliveryAgents from "../pages/shop-admin/DeliveryAgents";
import ShopDeliveryAgentRegister from "../pages/shop-admin/DeliveryAgentRegister";
import ShopProfile from "../pages/shop-admin/ShopProfile";

const ShopAdminRoutes = (
    <Route element={<ProtectedRoute />}>
        <Route element={<RoleRoute allowedRoles={["shop_admin"]} />}>
            <Route path="shop-admin" element={<ShopAdminLayout />}>
                <Route index element={<ShopDashboard />} />
                <Route path="orders" element={<ShopOrders />} />
                <Route path="orders/:id" element={<ShopOrderDetail />} />
                <Route path="services" element={<ShopServices />} />
                <Route path="service-requests" element={<ShopServiceRequests />} />
                <Route path="delivery-agents" element={<ShopDeliveryAgents />} />
                <Route path="delivery-agents/register" element={<ShopDeliveryAgentRegister />} />
                <Route path="profile" element={<ShopProfile />} />
            </Route>
        </Route>
    </Route>
);

export default ShopAdminRoutes;
