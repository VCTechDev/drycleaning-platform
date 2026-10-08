import { LogOut } from "lucide-react";
import { NavLink } from "react-router-dom";

import { Button } from "@/components/ui/button";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import { platformAdminNavigation } from "./adminNavigation";

interface AdminMobileNavProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onLogout: () => void;
}

function AdminMobileNav({
    open,
    onOpenChange,
    onLogout,
}: AdminMobileNavProps) {
    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                side="left"
                className="w-[min(20rem,85vw)] border-r border-blue-100 bg-white p-0"
            >
                <SheetHeader className="border-b border-blue-100 px-6 py-5 text-left">
                    <img
                        src="/images/branding/veecleen-logo.png"
                        alt="VeeCleen"
                        className="h-auto w-40 object-contain"
                    />
                    <SheetTitle className="pt-2 text-left text-sm font-medium text-slate-500">
                        Platform Admin workspace
                    </SheetTitle>
                </SheetHeader>

                <div className="flex h-full flex-col overflow-y-auto px-4 py-6">
                    <nav
                        aria-label="Platform Admin mobile navigation"
                        className="flex flex-col gap-1.5"
                    >
                        {platformAdminNavigation.map((item) => {
                            const Icon = item.icon;

                            return (
                                <NavLink
                                    key={item.path}
                                    to={item.path}
                                    end={item.end}
                                    onClick={() => onOpenChange(false)}
                                    className={({ isActive }) =>
                                        `group flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
                                            isActive
                                                ? "bg-blue-50 text-blue-700"
                                                : "text-slate-600 hover:bg-slate-50 hover:text-blue-700"
                                        }`
                                    }
                                >
                                    {({ isActive }) => (
                                        <>
                                            <Icon
                                                className={`h-5 w-5 shrink-0 ${
                                                    isActive
                                                        ? "text-blue-600"
                                                        : "text-slate-400 group-hover:text-blue-600"
                                                }`}
                                                aria-hidden="true"
                                            />
                                            <span>{item.label}</span>
                                        </>
                                    )}
                                </NavLink>
                            );
                        })}
                    </nav>

                    <div className="mt-auto border-t border-slate-100 pt-5">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={onLogout}
                            className="w-full justify-start gap-3 rounded-xl px-3 text-red-600 hover:bg-red-50 hover:text-red-700"
                        >
                            <LogOut className="h-4 w-4" aria-hidden="true" />
                            Log out
                        </Button>
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
}

export default AdminMobileNav;
