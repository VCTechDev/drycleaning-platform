import { useState, useRef, useEffect } from "react";
import { ChevronDown, LogOut, Menu, ShieldAlert, Store, User as UserIcon } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { useShopAdminProfile } from "../../hooks/shopAdmin/useShopAdminProfile";

interface ShopAdminHeaderProps {
    title: string;
    username: string;
    email: string | null;
    onMenuOpen: () => void;
    onLogout: () => void;
}

function ShopAdminHeader({
    title,
    username,
    email,
    onMenuOpen,
    onLogout,
}: ShopAdminHeaderProps) {
    const { data: profile, isLoading } = useShopAdminProfile();
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setMenuOpen(false);
            }
        };

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setMenuOpen(false);
            }
        };

        if (menuOpen) {
            document.addEventListener("mousedown", handleClickOutside);
            document.addEventListener("keydown", handleKeyDown);
        }

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [menuOpen]);

    const fullName =
        profile?.first_name || profile?.last_name
            ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim()
            : profile?.username || username;

    return (
        <header className="sticky top-0 z-30 border-b border-[#E2E8F0] bg-white/95 backdrop-blur">
            <div className="flex min-h-20 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
                {/* Left: Mobile menu button & page title */}
                <div className="flex min-w-0 items-center gap-3">
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={onMenuOpen}
                        className="shrink-0 rounded-xl text-slate-700 hover:bg-slate-100 lg:hidden"
                        aria-label="Open Shop Admin navigation"
                    >
                        <Menu className="h-5 w-5" aria-hidden="true" />
                    </Button>

                    <div className="min-w-0">
                        <h1 className="truncate text-lg font-bold text-slate-900 sm:text-xl">
                            {title}
                        </h1>
                        <p className="hidden truncate text-xs text-slate-500 sm:block">
                            Shop Admin Workspace
                        </p>
                    </div>
                </div>

                {/* Right: Operational Status, Shop/User Dropdown Menu */}
                <div className="flex shrink-0 items-center gap-2.5 sm:gap-4">
                    {/* Operational Status Pill */}
                    {!isLoading && profile && (
                        <div className="flex items-center">
                            {!profile.is_shop_approved ? (
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-600/20">
                                    <ShieldAlert className="h-3.5 w-3.5 text-amber-600" />
                                    <span className="hidden sm:inline">Pending Approval</span>
                                    <span className="sm:hidden">Pending</span>
                                </span>
                            ) : profile.is_shop_open ? (
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-600/20">
                                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                                    <span>Open</span>
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-400/20">
                                    <span className="h-2 w-2 rounded-full bg-slate-400" />
                                    <span>Closed</span>
                                </span>
                            )}
                        </div>
                    )}

                    {/* Profile & Avatar Menu Container */}
                    <div className="relative" ref={menuRef}>
                        <button
                            type="button"
                            onClick={() => setMenuOpen((prev) => !prev)}
                            aria-haspopup="menu"
                            aria-expanded={menuOpen}
                            aria-label="User account and profile menu"
                            className="group flex items-center gap-2.5 rounded-xl p-1.5 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                        >
                            <div className="hidden min-w-0 text-right sm:block">
                                <p className="max-w-44 truncate text-sm font-semibold text-slate-900 transition group-hover:text-blue-600">
                                    {profile?.shop_name || fullName}
                                </p>
                                <p className="max-w-44 truncate text-xs text-slate-500">
                                    {email || "Shop Admin"}
                                </p>
                            </div>

                            <div
                                className="flex h-10 w-10 items-center justify-center rounded-full bg-[#172554] text-sm font-semibold text-white shadow-xs transition group-hover:bg-[#2563EB]"
                                aria-hidden="true"
                            >
                                {profile?.shop_name ? (
                                    <Store className="h-4 w-4" />
                                ) : (
                                    (username.slice(0, 1).toUpperCase() || "S")
                                )}
                            </div>

                            <ChevronDown
                                className={`hidden h-4 w-4 text-slate-400 transition-transform duration-150 sm:block ${
                                    menuOpen ? "rotate-180" : ""
                                }`}
                                aria-hidden="true"
                            />
                        </button>

                        {/* Dropdown Menu Popup */}
                        {menuOpen && (
                            <div
                                role="menu"
                                aria-orientation="vertical"
                                className="absolute right-0 top-full mt-2 w-72 rounded-2xl border border-[#E2E8F0] bg-white p-2 shadow-xl ring-1 ring-black/5 z-50 transition animate-in fade-in zoom-in-95 duration-100"
                            >
                                {/* Account Overview Header */}
                                <div className="rounded-xl bg-slate-50 p-3 mb-1">
                                    <div className="flex items-center gap-2.5">
                                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[#2563EB]">
                                            <UserIcon className="h-4 w-4" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-semibold text-slate-900">
                                                {fullName}
                                            </p>
                                            <p className="truncate text-xs text-slate-500">
                                                @{profile?.username || username}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="mt-2.5 space-y-1 border-t border-slate-200/60 pt-2 text-xs text-slate-600">
                                        <div className="flex items-center justify-between">
                                            <span className="text-slate-400">Shop:</span>
                                            <span className="font-medium truncate max-w-36">
                                                {profile?.shop_name || "Unlinked"}
                                            </span>
                                        </div>
                                        {profile?.email && (
                                            <div className="flex items-center justify-between">
                                                <span className="text-slate-400">Email:</span>
                                                <span className="font-medium truncate max-w-36">
                                                    {profile.email}
                                                </span>
                                            </div>
                                        )}
                                        {profile?.phone_number && (
                                            <div className="flex items-center justify-between">
                                                <span className="text-slate-400">Phone:</span>
                                                <span className="font-medium">
                                                    {profile.phone_number}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Menu Item: Shop Profile */}
                                <Link
                                    to="/shop-admin/profile"
                                    role="menuitem"
                                    onClick={() => setMenuOpen(false)}
                                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 hover:text-blue-600"
                                >
                                    <Store className="h-4 w-4 text-slate-400" aria-hidden="true" />
                                    <div>
                                        <p className="font-medium">Shop Profile</p>
                                        <p className="text-xs text-slate-400">
                                            Hours, address & operating status
                                        </p>
                                    </div>
                                </Link>

                                <div className="my-1 border-t border-slate-100" />

                                {/* Menu Item: Logout */}
                                <button
                                    type="button"
                                    role="menuitem"
                                    onClick={() => {
                                        setMenuOpen(false);
                                        onLogout();
                                    }}
                                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-50 hover:text-red-700 text-left"
                                >
                                    <LogOut className="h-4 w-4 text-red-500" aria-hidden="true" />
                                    <span>Log out</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
}

export default ShopAdminHeader;
