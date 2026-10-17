import { Routes } from "react-router-dom";
import PublicRoutes from "./public";
import CustomerRoutes from "./customer";
import PlatformAdminRoutes from "./platform";
import ShopAdminRoutes from "./shopAdmin";

function AppRoutes(){

    return(
        <Routes>
            {PublicRoutes}
            {CustomerRoutes}
            {PlatformAdminRoutes}
            {ShopAdminRoutes}
        </Routes>
    );
}



export default AppRoutes;
