import { Menu, LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";

interface AdminHeaderProps {
    title: string;
    username: string;
    email: string | null;
    onMenuOpen: () => void;
    onLogout: () => void;
}

function AdminHeader({
    title,
    username,
    email,
    onMenuOpen,
    onLogout,
}: AdminHeaderProps) {
    return (
        <header className="sticky top-0 z-30 border-b border-blue-100 bg-white/95 backdrop-blur">
            <div className="flex min-h-20 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
                <div className="flex min-w-0 items-center gap-3">
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={onMenuOpen}
                        className="shrink-0 rounded-xl text-slate-600 hover:bg-blue-50 hover:text-blue-700 lg:hidden"
                        aria-label="Open Platform Admin navigation"
                    >
                        <Menu className="h-5 w-5" aria-hidden="true" />
                    </Button>

                    <div className="min-w-0">
                        <p className="truncate text-lg font-semibold text-slate-950 sm:text-xl">
                            {title}
                        </p>
                        <p className="hidden truncate text-sm text-slate-500 sm:block">
                            Platform Admin workspace
                        </p>
                    </div>
                </div>

                <div className="flex shrink-0 items-center gap-3">
                    <div className="hidden text-right sm:block">
                        <p className="text-sm font-semibold text-slate-900">
                            {username}
                        </p>
                        <p className="max-w-52 truncate text-xs text-slate-500">
                            {email ?? "Platform Admin"}
                        </p>
                    </div>

                    <div
                        className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-sm font-semibold text-blue-700"
                        aria-hidden="true"
                    >
                        {username.slice(0, 1).toUpperCase() || "P"}
                    </div>

                    <Button
                        type="button"
                        variant="ghost"
                        onClick={onLogout}
                        className="hidden gap-2 rounded-xl text-slate-600 hover:bg-red-50 hover:text-red-700 md:inline-flex"
                    >
                        <LogOut className="h-4 w-4" aria-hidden="true" />
                        Log out
                    </Button>
                </div>
            </div>
        </header>
    );
}

export default AdminHeader;
