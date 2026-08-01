import { Route } from "react-router-dom";
import Login from "../pages/auth/Login";



const PublicRoutes = (
    <>
        <Route path="/auth/login" element={<Login />} />
    </>
);



export default PublicRoutes;