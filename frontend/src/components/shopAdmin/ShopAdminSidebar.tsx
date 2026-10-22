import { LogOut, ShieldAlert, Store } from "lucide-react";
import { NavLink } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { useShopAdminProfile } from "../../hooks/shopAdmin/useShopAdminProfile";
import { shopAdminNavigation } from "./shopAdminNavigation";

interface ShopAdminSidebarProps {
    onLogout: () => void;
}

function ShopAdminSidebar({ onLogout }: ShopAdminSidebarProps) {
    const { data: profile, isLoading } = useShopAdminProfile();

    return (
        <aside
            aria-label="Shop Admin sidebar"
            className="fixed inset-y-0 left-0 z-40 hidden w-[250px] flex-col border-r border-[#1e293b] bg-[#172554] text-white lg:flex"
        >
            {/* Top Branding Section */}
            <div className="flex h-20 items-center gap-3 border-b border-white/10 px-5">
                <div className="rounded-xl bg-white px-3 py-1.5 shadow-xs">
                    <img
                        src="/images/branding/veecleen-logo.png"
                        alt="VeeCleen"
                        className="h-7 w-auto object-contain"
                    />
                </div>
                <div className="min-w-0">
                    <span className="block text-xs font-bold uppercase tracking-wider text-blue-200">
                        Shop Admin
                    </span>
                </div>
            </div>

            {/* Navigation Items */}
            <div className="flex flex-1 flex-col overflow-y-auto px-3.5 py-6">
                <p className="px-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Shop Workspace
                </p>

                <nav
                    aria-label="Shop Admin navigation"
                    className="mt-3.5 flex flex-col gap-1.5"
                >
                    {shopAdminNavigation.map((item) => {
                        const Icon = item.icon;

                        return (
                            <NavLink
                                key={item.path}
                                to={item.path}
                                end={item.end}
                                className={({ isActive }) =>
                                    `group flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#172554] ${
                                        isActive
                                            ? "bg-[#2563EB] text-white shadow-xs"
                                            : "text-slate-300 hover:bg-white/10 hover:text-white"
                                    }`
                                }
                            >
                                {({ isActive }) => (
                                    <>
                                        <Icon
                                            className={`h-5 w-5 shrink-0 transition ${
                                                isActive
                                                    ? "text-white"
                                                    : "text-slate-400 group-hover:text-white"
                                            }`}
                                            aria-hidden="true"
                                        />
                                        <span className="truncate">{item.label}</span>
                                    </>
                                )}
                            </NavLink>
                        );
                    })}
                </nav>
            </div>

            {/* Bottom Section: Shop Status & Account */}
            <div className="border-t border-white/10 p-4">
                <NavLink
                    to="/shop-admin/profile"
                    aria-label={`Shop Profile - ${profile?.shop_name || "My Shop"}`}
                    className={({ isActive }) =>
                        `group mb-3 block rounded-xl border p-3 backdrop-blur-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#172554] ${
                            isActive
                                ? "border-blue-400/40 bg-white/10 ring-1 ring-blue-400/30"
                                : "border-transparent bg-white/5 hover:border-white/15 hover:bg-white/10"
                        }`
                    }
                >
                    {isLoading ? (
                        <div className="space-y-1.5">
                            <div className="h-4 w-28 animate-pulse rounded bg-white/20" />
                            <div className="h-3 w-16 animate-pulse rounded bg-white/10" />
                        </div>
                    ) : profile ? (
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <Store className="h-4 w-4 shrink-0 text-blue-300 group-hover:text-blue-200 transition-colors" aria-hidden="true" />
                                <p className="truncate text-sm font-semibold text-white group-hover:text-blue-100 transition-colors">
                                    {profile.shop_name || "My Shop"}
                                </p>
                            </div>
                            <div className="mt-2 flex items-center gap-1.5">
                                {!profile.is_shop_approved ? (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/20 px-2 py-0.5 text-xs font-medium text-amber-300">
                                        <ShieldAlert className="h-3 w-3" />
                                        Pending Approval
                                    </span>
                                ) : profile.is_shop_open ? (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/20 px-2 py-0.5 text-xs font-medium text-emerald-300">
                                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                                        Open
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-400/20 px-2 py-0.5 text-xs font-medium text-slate-300">
                                        <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                                        Closed
                                    </span>
                                )}
                            </div>
                        </div>
                    ) : (
                        <p className="text-xs text-slate-400">Shop Admin Workspace</p>
                    )}
                </NavLink>

                <Button
                    type="button"
                    variant="ghost"
                    onClick={onLogout}
                    className="w-full justify-start gap-2.5 rounded-xl px-3 text-red-300 hover:bg-red-500/20 hover:text-red-200"
                >
                    <LogOut className="h-4 w-4" aria-hidden="true" />
                    <span>Log out</span>
                </Button>
            </div>
        </aside>
    );
}

export default ShopAdminSidebar;
