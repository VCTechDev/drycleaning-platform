import { Route } from "react-router-dom";
import Login from "../pages/auth/Login";
import Register from "@/pages/auth/Register";



const PublicRoutes = (
    <>
        <Route path="/register" element={<Register />} />
        <Route path="/auth/login" element={<Login />} />
    </>
);



export default PublicRoutes;