import { Routes } from "react-router-dom";
import PublicRoutes from "./public";
import CustomerRoutes from "./customer";
import PlatformAdminRoutes from "./platform";



function AppRoutes(){

    return(
        <Routes>
            {PublicRoutes}
            {CustomerRoutes}
            {PlatformAdminRoutes}
        </Routes>
    );
}



export default AppRoutes;
