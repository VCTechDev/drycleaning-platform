import { LogOut } from "lucide-react";
import { NavLink } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { platformAdminNavigation } from "./adminNavigation";

interface AdminSidebarProps {
    onLogout: () => void;
}

function AdminSidebar({ onLogout }: AdminSidebarProps) {
    return (
        <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 flex-col border-r border-blue-100 bg-white lg:flex">
            <div className="flex h-20 items-center border-b border-blue-100 px-7">
                <img
                    src="/images/branding/veecleen-logo.png"
                    alt="VeeCleen"
                    className="h-auto w-44 object-contain"
                />
            </div>

            <div className="flex flex-1 flex-col overflow-y-auto px-4 py-6">
                <p className="px-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Platform workspace
                </p>

                <nav
                    aria-label="Platform Admin navigation"
                    className="mt-4 flex flex-col gap-1.5"
                >
                    {platformAdminNavigation.map((item) => {
                        const Icon = item.icon;

                        return (
                            <NavLink
                                key={item.path}
                                to={item.path}
                                end={item.end}
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
            </div>

            <div className="border-t border-blue-100 p-4">
                <div className="mb-3 rounded-xl bg-slate-50 px-3 py-3">
                    <p className="text-sm font-semibold text-slate-900">
                        Platform Admin
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                        Administrative workspace
                    </p>
                </div>

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
        </aside>
    );
}

export default AdminSidebar;
