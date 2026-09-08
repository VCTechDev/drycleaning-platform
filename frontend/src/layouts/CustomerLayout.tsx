import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { UserRound, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet";
import { logout } from "../services/authService";
import { useState } from "react";

function CustomerLayout() {

    const [profileOpen, setProfileOpen] = useState(false);
    const navigate = useNavigate();

    const isAuthenticated = Boolean(
        localStorage.getItem("access_token")
    );

    const handleLogout = () => {
        logout();
        navigate("/auth/login", { replace: true });
    };





    return (
        <div className="min-h-screen w-full bg-white">

            {/* ================= HEADER ================= */}
            <header className="w-full">

                <div className="flex h-24 w-full items-center justify-between bg-white px-6 sm:px-8 md:h-20 md:border-b md:border-blue-100 md:shadow-sm">

                    {/* Logo */}
                    <NavLink
                        to="/customer"
                        className="flex items-center"
                    >
                        <img
                            src="/images/branding/veecleen-logo.png"
                            alt="VeeCleen"
                            className="h-16 w-auto object-contain sm:h-[68px] md:h-14"
                        />
                    </NavLink>


                    {/* Desktop Navigation */}
                    <nav className="hidden items-center gap-8 md:flex">

                        <NavLink
                            to="/customer"
                            end
                            className={({ isActive }) =>
                                `relative px-2 py-2 font-medium transition ${isActive
                                    ? "text-blue-600"
                                    : "text-slate-700 hover:text-blue-600"
                                }`
                            }
                        >
                            {({ isActive }) => (
                                <>
                                    Home

                                    {isActive && (
                                        <span className="absolute -bottom-2 left-1/2 h-0.5 w-6 -translate-x-1/2 rounded-full bg-blue-600" />
                                    )}
                                </>
                            )}
                        </NavLink>


                        <NavLink
                            to="/customer/shops"
                            className={({ isActive }) =>
                                `px-2 py-2 font-medium transition ${isActive
                                    ? "text-blue-600"
                                    : "text-slate-700 hover:text-blue-600"
                                }`
                            }
                        >
                            Shops
                        </NavLink>


                        <NavLink
                            to="/customer/shops"
                            className="px-2 py-2 font-medium text-slate-700 transition hover:text-blue-600"
                        >
                            Services
                        </NavLink>


                        <NavLink
                            to="/customer"
                            className="px-2 py-2 font-medium text-slate-700 transition hover:text-blue-600"
                        >
                            How It Works
                        </NavLink>


                        <NavLink
                            to="/customer/orders"
                            className={({ isActive }) =>
                                `px-2 py-2 font-medium transition ${isActive
                                    ? "text-blue-600"
                                    : "text-slate-700 hover:text-blue-600"
                                }`
                            }
                        >
                            Orders
                        </NavLink>

                    </nav>


                    {/* ================= DESKTOP PROFILE ================= */}
                    <div className="relative hidden md:block">

                        {!isAuthenticated ? (

                            <button
                                type="button"
                                onClick={() => navigate("/auth/login")}
                                title="Login"
                                aria-label="Login"
                                className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-blue-600 transition hover:bg-blue-100"
                            >
                                <UserRound
                                    className="h-7 w-7"
                                    strokeWidth={2}
                                />
                            </button>

                        ) : (

                            <>
                                {/* Profile Icon */}
                                <button
                                    type="button"
                                    onClick={() => setProfileOpen((open) => !open)}
                                    title="Profile"
                                    aria-label="Open profile menu"
                                    className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-blue-600 transition hover:bg-blue-100"
                                >
                                    <UserRound
                                        className="h-7 w-7"
                                        strokeWidth={2}
                                    />
                                </button>


                                {/* Profile Dropdown */}
                                {profileOpen && (
                                    <div className="absolute right-0 top-[68px] z-50 w-64 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_12px_40px_rgba(15,23,42,0.12)]">

                                        {/* Customer Profile */}
                                        <div className="border-b border-slate-100 px-5 py-4">

                                            <div className="flex items-center gap-3">

                                                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                                                    <UserRound
                                                        className="h-5 w-5"
                                                        strokeWidth={2}
                                                    />
                                                </div>

                                                <div className="min-w-0">

                                                    <p className="text-sm font-semibold text-slate-950">
                                                        Customer
                                                    </p>

                                                    <p className="mt-0.5 text-xs text-slate-500">
                                                        VeeCleen Customer
                                                    </p>

                                                </div>

                                            </div>

                                        </div>


                                        {/* Logout */}
                                        <div className="p-2">

                                            <button
                                                type="button"
                                                onClick={handleLogout}
                                                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-50"
                                            >
                                                <LogOut className="h-4 w-4" />

                                                Logout
                                            </button>

                                        </div>

                                    </div>
                                )}

                            </>

                        )}

                    </div>


                    {/* Mobile Profile */}
                    <div className="md:hidden">

                        {!isAuthenticated ? (

                            /* Not logged in → Login */
                            <button
                                type="button"
                                onClick={() => navigate("/auth/login")}
                                title="Login"
                                aria-label="Login"
                                className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-blue-600 transition hover:bg-blue-100"
                            >
                                <UserRound className="h-7 w-7" strokeWidth={2} />
                            </button>

                        ) : (

                            /* Logged in → Navigation Menu */
                            <Sheet>

                                <SheetTrigger >
                                    <button
                                        type="button"
                                        title="Open navigation"
                                        aria-label="Open navigation"
                                        className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-blue-600 transition hover:bg-blue-100"
                                    >
                                        <UserRound
                                            className="h-7 w-7"
                                            strokeWidth={2}
                                        />
                                    </button>
                                </SheetTrigger>

                                <SheetContent side="right">

                                    <SheetHeader>
                                        <SheetTitle>
                                            VeeCleen
                                        </SheetTitle>
                                    </SheetHeader>

                                    <nav className="mt-8 flex flex-col gap-2">

                                        <NavLink to="/customer" end>
                                            {({ isActive }) => (
                                                <Button
                                                    variant={isActive ? "secondary" : "ghost"}
                                                    className="w-full justify-start"
                                                >
                                                    Home
                                                </Button>
                                            )}
                                        </NavLink>


                                        <NavLink to="/customer/shops">
                                            {({ isActive }) => (
                                                <Button
                                                    variant={isActive ? "secondary" : "ghost"}
                                                    className="w-full justify-start"
                                                >
                                                    Shops
                                                </Button>
                                            )}
                                        </NavLink>


                                        <NavLink to="/customer/shops">
                                            <Button
                                                variant="ghost"
                                                className="w-full justify-start"
                                            >
                                                Services
                                            </Button>
                                        </NavLink>


                                        <NavLink to="/customer">
                                            <Button
                                                variant="ghost"
                                                className="w-full justify-start"
                                            >
                                                How It Works
                                            </Button>
                                        </NavLink>


                                        <NavLink to="/customer/orders">
                                            {({ isActive }) => (
                                                <Button
                                                    variant={isActive ? "secondary" : "ghost"}
                                                    className="w-full justify-start"
                                                >
                                                    Orders
                                                </Button>
                                            )}
                                        </NavLink>


                                        <div className="my-4 border-t" />


                                        <Button
                                            variant="ghost"
                                            onClick={handleLogout}
                                            className="w-full justify-start gap-2 text-red-600 hover:text-red-600"
                                        >
                                            <LogOut className="h-4 w-4" />
                                            Logout
                                        </Button>

                                    </nav>

                                </SheetContent>

                            </Sheet>

                        )}

                    </div>

                </div>

            </header>


            {/* ================= PAGE CONTENT ================= */}
            <main className="w-full">
                <Outlet />
            </main>


            {/* ================= FOOTER ================= */}
            <footer className="w-full border-t border-blue-100 bg-blue-50/40">

                <div className="flex w-full flex-col items-center justify-between gap-4 px-6 py-6 text-sm text-slate-600 sm:flex-row sm:px-8">

                    <p>
                        © {new Date().getFullYear()} VeeCleen. All rights reserved.
                    </p>

                    <div className="flex items-center gap-6">
                        <span className="cursor-pointer hover:text-blue-600">
                            Privacy Policy
                        </span>

                        <span className="cursor-pointer hover:text-blue-600">
                            Terms & Conditions
                        </span>

                        <span className="cursor-pointer hover:text-blue-600">
                            Help & Support
                        </span>
                    </div>

                </div>

            </footer>

        </div>
    );
}

export default CustomerLayout;