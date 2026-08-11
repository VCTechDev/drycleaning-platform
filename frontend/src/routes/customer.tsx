import { Route } from "react-router-dom";

import CustomerLayout from "../layouts/CustomerLayout";
import ShopList from "../pages/customer/ShopList";
import ShopDetail from "../pages/customer/ShopDetail";
import MyOrders from "../pages/customer/MyOrders";
import OrderDetail from "../pages/customer/OrderDetails";
import OrderTracking from "../pages/customer/OrderTracking";

import ProtectedRoute from "../components/auth/ProtectedRoute";

const CustomerRoutes = (
    <Route element={<ProtectedRoute />}>
        {/* Everything inside this route requires login */}
        <Route path="customer" element={<CustomerLayout />}>

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