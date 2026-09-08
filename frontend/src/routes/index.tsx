import { Routes } from "react-router-dom";
import PublicRoutes from "./public";
import CustomerRoutes from "./customer";



function AppRoutes(){

    return(
        <Routes>
            {PublicRoutes}
            {CustomerRoutes}
        </Routes>
    );
}



export default AppRoutes;