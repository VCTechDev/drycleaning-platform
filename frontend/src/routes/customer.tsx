import { Route } from "react-router-dom";

import CustomerLayout from "../layouts/CustomerLayout";
import ShopList from "../pages/customer/ShopList";



const CustomerRoutes = (

    <>
        <Route path="customer" element={<CustomerLayout />}>
            <Route path="shop" element={<ShopList />} />
        </Route>

    </>
);



export default CustomerRoutes;