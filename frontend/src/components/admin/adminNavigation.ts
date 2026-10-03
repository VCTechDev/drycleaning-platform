import type { LucideIcon } from "lucide-react";
import {
    BriefcaseBusiness,
    ClipboardCheck,
    LayoutDashboard,
    ShoppingCart,
    Store,
    Users,
    Wrench,
} from "lucide-react";

export interface PlatformAdminNavigationItem {
    label: string;
    path: string;
    icon: LucideIcon;
    end?: boolean;
}

export const platformAdminNavigation: readonly PlatformAdminNavigationItem[] = [
    {
        label: "Dashboard",
        path: "/platform",
        icon: LayoutDashboard,
        end: true,
    },
    {
        label: "Shop Applications",
        path: "/platform/applications",
        icon: ClipboardCheck,
    },
    {
        label: "Shops",
        path: "/platform/shops",
        icon: Store,
    },
    {
        label: "Services",
        path: "/platform/services",
        icon: Wrench,
    },
    {
        label: "Service Requests",
        path: "/platform/service-requests",
        icon: BriefcaseBusiness,
    },
    {
        label: "Orders",
        path: "/platform/orders",
        icon: ShoppingCart,
    },
    {
        label: "Users",
        path: "/platform/users",
        icon: Users,
    },
];

export const getPlatformAdminPageTitle = (pathname: string) => {
    const matchingItem = [...platformAdminNavigation]
        .sort((first, second) => second.path.length - first.path.length)
        .find(
            (item) =>
                pathname === item.path || pathname.startsWith(`${item.path}/`)
        );

    return matchingItem?.label ?? "Platform Admin";
};
