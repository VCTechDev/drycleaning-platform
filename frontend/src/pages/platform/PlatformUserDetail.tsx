import {
    ArrowLeft,
    CalendarDays,
    Mail,
    Phone,
    RefreshCw,
    Store,
    UserRound,
} from "lucide-react";
import type { ReactNode } from "react";
import { Link, useParams } from "react-router-dom";

import {
    UserRoleBadge,
    UserStatusBadge,
} from "../../components/admin/users/UserBadges";
import { Button } from "../../components/ui/button";
import { usePlatformUser } from "../../hooks/platform/usePlatformUsers";
import { getApiErrorMessage } from "../../lib/apiError";
import { formatApplicationDateTime } from "../../lib/applicationDisplay";

function UserDetailError({
    message,
    onRetry,
    retrying,
}: {
    message: string;
    onRetry?: () => void;
    retrying?: boolean;
}) {
    return (
        <section className="rounded-2xl border border-red-100 bg-white p-8 text-center shadow-sm" role="alert">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
                <RefreshCw className="h-6 w-6" aria-hidden="true" />
            </div>
            <h1 className="mt-4 font-heading text-xl font-semibold text-slate-950">
                User details could not be loaded
            </h1>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">
                {message}
            </p>
            {onRetry && (
                <Button type="button" className="mt-6" onClick={onRetry} disabled={retrying}>
                    {retrying ? "Trying again..." : "Try again"}
                </Button>
            )}
        </section>
    );
}

function DetailSection({
    title,
    icon: Icon,
    children,
}: {
    title: string;
    icon: typeof UserRound;
    children: ReactNode;
}) {
    return (
        <section className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                </div>
                <h2 className="font-heading text-base font-semibold text-slate-950">{title}</h2>
            </div>
            <div className="pt-5">{children}</div>
        </section>
    );
}

function DetailField({ label, value }: { label: string; value: string }) {
    return (
        <div className="min-w-0">
            <dt className="text-xs font-medium text-slate-400">{label}</dt>
            <dd className="mt-1 break-words text-sm font-medium text-slate-800">{value}</dd>
        </div>
    );
}

function PlatformUserDetail() {
    const { id } = useParams<{ id: string }>();
    const { data, isPending, isError, isFetching, error, refetch } =
        usePlatformUser(id);

    if (!id) {
        return <UserDetailError message="The user identifier is missing." />;
    }

    if (isPending) {
        return (
            <div className="animate-pulse space-y-6" aria-label="Loading user details">
                <div className="h-24 rounded-2xl bg-slate-200" />
                <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
                    <div className="h-64 rounded-2xl bg-slate-200" />
                    <div className="h-64 rounded-2xl bg-slate-200" />
                </div>
            </div>
        );
    }

    if (isError || !data) {
        return (
            <UserDetailError
                message={getApiErrorMessage(error, "The user may no longer be available. Please try again.")}
                onRetry={() => void refetch()}
                retrying={isFetching}
            />
        );
    }

    const fullName = [data.first_name, data.last_name]
        .filter(Boolean)
        .join(" ");

    return (
        <div className="space-y-6">
            <header className="space-y-4">
                <Link
                    to="/platform/users"
                    className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700 transition hover:text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                >
                    <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                    Back to users
                </Link>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                        <p className="text-sm font-semibold text-blue-600">Platform user</p>
                        <h1 className="mt-1 break-words font-heading text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
                            {data.username}
                        </h1>
                        <p className="mt-2 text-sm text-slate-500">
                            {fullName || "Name not provided"}
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <UserRoleBadge role={data.role} />
                        <UserStatusBadge isActive={data.is_active} />
                    </div>
                </div>
            </header>

            <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
                <div className="space-y-6">
                    <DetailSection title="Account information" icon={UserRound}>
                        <dl className="grid gap-5 sm:grid-cols-2">
                            <DetailField label="Username" value={data.username} />
                            <DetailField label="Full name" value={fullName || "Not provided"} />
                            <DetailField label="Role" value={data.role === "shop_admin" ? "Shop Admin" : data.role === "delivery_agent" ? "Delivery Agent" : "Customer"} />
                            <DetailField label="Account status" value={data.is_active ? "Active" : "Inactive"} />
                        </dl>
                    </DetailSection>

                    <DetailSection title="Contact information" icon={Mail}>
                        <dl className="grid gap-5 sm:grid-cols-2">
                            <DetailField label="Email" value={data.email || "Not provided"} />
                            <DetailField label="Phone number" value={data.phone_number || "Not provided"} />
                        </dl>
                        <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-400">
                            <span className="inline-flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" aria-hidden="true" />{data.email || "No email"}</span>
                            <span className="inline-flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" aria-hidden="true" />{data.phone_number || "No phone"}</span>
                        </div>
                    </DetailSection>
                </div>

                <aside className="space-y-6">
                    <DetailSection title="Shop association" icon={Store}>
                        <DetailField label="Shop" value={data.shop_name || "Unassigned"} />
                        {data.role === "shop_admin" && !data.shop_name && (
                            <p className="mt-4 text-sm leading-6 text-slate-500">
                                This Shop Admin is not currently associated with a shop.
                            </p>
                        )}
                    </DetailSection>

                    <DetailSection title="Account timeline" icon={CalendarDays}>
                        <DetailField label="Date joined" value={formatApplicationDateTime(data.date_joined)} />
                    </DetailSection>
                </aside>
            </div>
        </div>
    );
}

export default PlatformUserDetail;
