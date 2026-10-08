import { useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";

import AdminHeader from "../components/admin/AdminHeader";
import AdminMobileNav from "../components/admin/AdminMobileNav";
import AdminSidebar from "../components/admin/AdminSidebar";
import { getPlatformAdminPageTitle } from "../components/admin/adminNavigation";
import { useAuth } from "../hooks/useAuth";

function PlatformAdminLayout() {
    const navigate = useNavigate();
    const location = useLocation();
    const { logout, user } = useAuth();
    const [mobileNavOpen, setMobileNavOpen] = useState(false);

    const handleLogout = () => {
        logout();
        navigate("/auth/login", { replace: true });
    };

    const username = user?.username || "Platform Admin";

    return (
        <div className="min-h-screen bg-slate-50">
            <AdminSidebar onLogout={handleLogout} />
            <AdminMobileNav
                open={mobileNavOpen}
                onOpenChange={setMobileNavOpen}
                onLogout={handleLogout}
            />

            <div className="lg:pl-72">
                <AdminHeader
                    title={getPlatformAdminPageTitle(location.pathname)}
                    username={username}
                    email={user?.email ?? null}
                    onMenuOpen={() => setMobileNavOpen(true)}
                    onLogout={handleLogout}
                />

                <main className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
                    <div className="mx-auto w-full max-w-[1600px]">
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    );
}

export default PlatformAdminLayout;
