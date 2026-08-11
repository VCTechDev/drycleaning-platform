import { Outlet } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import { logout } from "../services/authService";




function CustomerLayout() {

    const navigate = useNavigate();

    const handleLogout = () => {
        logout();

        // After removing the tokens, send the customer to login.
        navigate("/auth/login", { replace: true });
    };

    return (
        <>
            <h2>Customer Navbar</h2>
            <button onClick={handleLogout}>
                Logout
            </button>

            <Outlet />

            <h2>Customer Footer</h2>
        </>
    );
}


export default CustomerLayout;