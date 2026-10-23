import type { LucideIcon } from "lucide-react";
import {
    BriefcaseBusiness,
    LayoutDashboard,
    ShoppingCart,
    Truck,
    UserPlus,
    Users,
    Wrench,
} from "lucide-react";

export interface ShopAdminNavigationItem {
    label: string;
    path: string;
    icon: LucideIcon;
    end?: boolean;
}

export const shopAdminNavigation: readonly ShopAdminNavigationItem[] = [
    {
        label: "Dashboard",
        path: "/shop-admin",
        icon: LayoutDashboard,
        end: true,
    },
    {
        label: "Orders",
        path: "/shop-admin/orders",
        icon: ShoppingCart,
    },
    {
        label: "Services",
        path: "/shop-admin/services",
        icon: Wrench,
    },
    {
        label: "Service Requests",
        path: "/shop-admin/service-requests",
        icon: BriefcaseBusiness,
    },
    {
        label: "Delivery Tasks",
        path: "/shop-admin/delivery-tasks",
        icon: Truck,
    },
    {
        label: "Delivery Agent Management",
        path: "/shop-admin/delivery-agents",
        icon: Users,
        end: true,
    },
    {
        label: "Delivery Agent Registration",
        path: "/shop-admin/delivery-agents/register",
        icon: UserPlus,
    },
];

export const getShopAdminPageTitle = (pathname: string): string => {
    if (pathname === "/shop-admin/profile") {
        return "Shop Profile";
    }

    const matchingItem = [...shopAdminNavigation]
        .sort((first, second) => second.path.length - first.path.length)
        .find(
            (item) =>
                pathname === item.path || pathname.startsWith(`${item.path}/`)
        );

    return matchingItem?.label ?? "Shop Admin";
};
