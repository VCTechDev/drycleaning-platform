import { Route } from "react-router-dom";
import Login from "../pages/auth/Login";
import Register from "@/pages/auth/Register";
import ForgotPassword from "@/pages/auth/ForgotPassword";
import RolePending from "@/pages/auth/RolePending";



const PublicRoutes = (
    <>
        <Route path="/register" element={<Register />} />
        <Route path="/auth/login" element={<Login />} />
        <Route path="/auth/forgot-password" element={<ForgotPassword />} />
        <Route path="/auth/role-pending" element={<RolePending />} />
    </>
);



export default PublicRoutes;
