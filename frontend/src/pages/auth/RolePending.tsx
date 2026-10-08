import { useLocation, useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { type UserRole } from "../../services/authService";
import { useAuth } from "../../hooks/useAuth";

const roleLabels: Record<UserRole, string> = {
    customer: "Customer",
    shop_admin: "Shop Admin",
    platform_admin: "Platform Admin",
    delivery_agent: "Delivery Agent",
};

function RolePending() {
    const navigate = useNavigate();
    const location = useLocation();
    const logout = useAuth().logout;
    const routeState = location.state as { role?: UserRole } | null;
    const role = routeState?.role;

    const handleLogout = () => {
        logout();
        navigate("/auth/login");
    };

    return (
        <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-10">
            <section className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-sm">
                <img
                    src="/images/branding/veecleen-logo.png"
                    alt="VeeCleen Dry Cleaning"
                    className="mx-auto h-auto w-48 max-w-full object-contain"
                />

                <h1 className="mt-8 text-2xl font-bold text-slate-900">
                    Role area coming soon
                </h1>

                <p className="mt-3 text-sm leading-6 text-slate-500">
                    {role
                        ? `${roleLabels[role]} access is authenticated, but its workspace is not available in this MVP.`
                        : "This account is authenticated, but its workspace is not available in this MVP."}
                </p>

                <Button
                    type="button"
                    onClick={handleLogout}
                    className="mt-7 rounded-full bg-blue-600 hover:bg-blue-700"
                >
                    Log out
                </Button>
            </section>
        </main>
    );
}

export default RolePending;
