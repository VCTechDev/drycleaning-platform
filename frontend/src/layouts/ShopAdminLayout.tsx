import { useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";

import ShopAdminHeader from "../components/shopAdmin/ShopAdminHeader";
import ShopAdminMobileNav from "../components/shopAdmin/ShopAdminMobileNav";
import ShopAdminSidebar from "../components/shopAdmin/ShopAdminSidebar";
import { getShopAdminPageTitle } from "../components/shopAdmin/shopAdminNavigation";
import { useAuth } from "../hooks/useAuth";

function ShopAdminLayout() {
    const navigate = useNavigate();
    const location = useLocation();
    const { logout, user } = useAuth();
    const [mobileNavOpen, setMobileNavOpen] = useState(false);

    const handleLogout = () => {
        logout();
        navigate("/auth/login", { replace: true });
    };

    const username = user?.username || "Shop Admin";

    return (
        <div className="min-h-screen bg-[#F8FAFC]">
            {/* Desktop Persistent Navy Sidebar */}
            <ShopAdminSidebar onLogout={handleLogout} />

            {/* Mobile Navigation Drawer */}
            <ShopAdminMobileNav
                open={mobileNavOpen}
                onOpenChange={setMobileNavOpen}
                onLogout={handleLogout}
            />

            {/* Main Area (offset by 250px on desktop) */}
            <div className="lg:pl-[250px]">
                <ShopAdminHeader
                    title={getShopAdminPageTitle(location.pathname)}
                    username={username}
                    email={user?.email ?? null}
                    onMenuOpen={() => setMobileNavOpen(true)}
                    onLogout={handleLogout}
                />

                <main className="px-4 py-6 sm:px-6 lg:px-8">
                    <div className="mx-auto w-full max-w-[1600px]">
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    );
}

export default ShopAdminLayout;
