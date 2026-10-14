import type { PlatformUserRole } from "../../../types/platform/users";

const roleLabels: Record<PlatformUserRole, string> = {
    customer: "Customer",
    shop_admin: "Shop Admin",
    delivery_agent: "Delivery Agent",
};

const roleClasses: Record<PlatformUserRole, string> = {
    customer: "bg-blue-50 text-blue-700",
    shop_admin: "bg-violet-50 text-violet-700",
    delivery_agent: "bg-cyan-50 text-cyan-700",
};

export function UserRoleBadge({ role }: { role: PlatformUserRole }) {
    return (
        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${roleClasses[role]}`}>
            {roleLabels[role]}
        </span>
    );
}

export function UserStatusBadge({ isActive }: { isActive: boolean }) {
    return (
        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
            {isActive ? "Active" : "Inactive"}
        </span>
    );
}

