import { Route } from "react-router-dom";

import CustomerLayout from "../layouts/CustomerLayout";
import ShopList from "../pages/customer/ShopList";
import ShopDetail from "../pages/customer/ShopDetail";
import MyOrders from "../pages/customer/MyOrders";
import OrderDetail from "../pages/customer/OrderDetails";
import OrderTracking from "../pages/customer/OrderTracking";
import Profile from "../pages/customer/Profile";

import ProtectedRoute from "../components/auth/ProtectedRoute";
import RoleRoute from "../components/auth/RoleRoute";
import Home from "@/pages/customer/Home";
import PickupDetails from "@/pages/customer/PickupDetails";

const CustomerRoutes = (
    <Route path="customer" element={<CustomerLayout />}>

        {/* Public Home */}
        <Route index element={<Home />} />

        {/* Protected Customer Pages */}
        <Route element={<ProtectedRoute />}>
            <Route element={<RoleRoute allowedRoles={["customer"]} />}>

            <Route path="shops" element={<ShopList />} />

            <Route path="shops/:id" element={<ShopDetail />} />

            <Route path="orders" element={<MyOrders />} />

            <Route path="profile" element={<Profile />} />

            <Route path="orders/:id" element={<OrderDetail />} />

            <Route
                path="orders/:id/tracking"
                element={<OrderTracking />}
            />

            <Route
                path="/customer/shops/:id/pickup"
                element={<PickupDetails />}
            />

            </Route>

        </Route>

    </Route>
);

export default CustomerRoutes;
