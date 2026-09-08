import { Route } from "react-router-dom";

import CustomerLayout from "../layouts/CustomerLayout";
import ShopList from "../pages/customer/ShopList";
import ShopDetail from "../pages/customer/ShopDetail";
import MyOrders from "../pages/customer/MyOrders";
import OrderDetail from "../pages/customer/OrderDetails";
import OrderTracking from "../pages/customer/OrderTracking";

import ProtectedRoute from "../components/auth/ProtectedRoute";
import Home from "@/pages/customer/Home";

const CustomerRoutes = (
    <Route path="customer" element={<CustomerLayout />}>

        {/* Public Home */}
        <Route index element={<Home />} />

        {/* Protected Customer Pages */}
        <Route element={<ProtectedRoute />}>

            <Route path="shops" element={<ShopList />} />

            <Route path="shops/:id" element={<ShopDetail />} />

            <Route path="orders" element={<MyOrders />} />

            <Route path="orders/:id" element={<OrderDetail />} />

            <Route
                path="orders/:id/tracking"
                element={<OrderTracking />}
            />

        </Route>

    </Route>
);

export default CustomerRoutes;