import { LogOut, ShieldAlert, Store } from "lucide-react";
import { NavLink } from "react-router-dom";

import { Button } from "@/components/ui/button";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import { useShopAdminProfile } from "../../hooks/shopAdmin/useShopAdminProfile";
import { shopAdminNavigation } from "./shopAdminNavigation";

interface ShopAdminMobileNavProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onLogout: () => void;
}

function ShopAdminMobileNav({
    open,
    onOpenChange,
    onLogout,
}: ShopAdminMobileNavProps) {
    const { data: profile } = useShopAdminProfile();

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                side="left"
                className="w-[min(20rem,85vw)] border-r border-[#1e293b] bg-[#172554] p-0 text-white"
            >
                {/* Header */}
                <SheetHeader className="border-b border-white/10 px-6 py-5 text-left">
                    <div className="flex items-center gap-3">
                        <div className="rounded-xl bg-white px-3 py-1.5 shadow-xs">
                            <img
                                src="/images/branding/veecleen-logo.png"
                                alt="VeeCleen"
                                className="h-7 w-auto object-contain"
                            />
                        </div>
                    </div>
                    <SheetTitle className="pt-2 text-left text-xs font-semibold uppercase tracking-wider text-blue-200">
                        Shop Admin Workspace
                    </SheetTitle>
                </SheetHeader>

                {/* Content */}
                <div className="flex h-full flex-col overflow-y-auto px-4 py-6">
                    <nav
                        aria-label="Shop Admin mobile navigation"
                        className="flex flex-col gap-1.5"
                    >
                        {shopAdminNavigation.map((item) => {
                            const Icon = item.icon;

                            return (
                                <NavLink
                                    key={item.path}
                                    to={item.path}
                                    end={item.end}
                                    onClick={() => onOpenChange(false)}
                                    className={({ isActive }) =>
                                        `group flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#172554] ${
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

                    {/* Shop Identity Info */}
                    {profile && (
                        <div className="mt-6 rounded-xl bg-white/5 p-3.5 border border-white/10">
                            <div className="flex items-center gap-2">
                                <Store className="h-4 w-4 shrink-0 text-blue-300" aria-hidden="true" />
                                <p className="truncate text-sm font-semibold text-white">
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
                    )}

                    {/* Logout */}
                    <div className="mt-auto border-t border-white/10 pt-5">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => {
                                onOpenChange(false);
                                onLogout();
                            }}
                            className="w-full justify-start gap-2.5 rounded-xl px-3 text-red-300 hover:bg-red-500/20 hover:text-red-200"
                        >
                            <LogOut className="h-4 w-4" aria-hidden="true" />
                            <span>Log out</span>
                        </Button>
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
}

export default ShopAdminMobileNav;
