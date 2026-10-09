import {
    ArrowLeft,
    Building2,
    CalendarDays,
    Clock3,
    Mail,
    MapPin,
    Phone,
    RefreshCw,
    Store,
    UserRound,
    type LucideIcon,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";

import OperationalStatusControl from "../../components/admin/shops/OperationalStatusControl";
import PlatformShopDetailSkeleton from "../../components/admin/shops/PlatformShopDetailSkeleton";
import { Button } from "../../components/ui/button";
import { usePlatformShop } from "../../hooks/platform/usePlatformShop";
import {
    formatApplicationDateTime,
    formatApplicationLocation,
    formatApplicationTime,
} from "../../lib/applicationDisplay";

function DetailError({
    onRetry,
    retrying,
}: {
    onRetry?: () => void;
    retrying?: boolean;
}) {
    return (
        <section
            className="rounded-2xl border border-red-100 bg-white p-8 text-center shadow-sm"
            role="alert"
        >
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
                <RefreshCw className="h-6 w-6" aria-hidden="true" />
            </div>
            <h1 className="mt-4 font-heading text-xl font-semibold text-slate-950">
                Shop details could not be loaded
            </h1>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                The shop may no longer be available, or the request failed. Please try again.
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
    icon: LucideIcon;
    children: ReactNode;
}) {
    return (
        <section className="min-w-0 rounded-2xl border border-blue-100 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                    <Icon className="h-4.5 w-4.5" aria-hidden="true" />
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

function ShopImage({ image, shopName }: { image: string | null; shopName: string }) {
    const [failed, setFailed] = useState(false);

    if (!image || failed) {
        return (
            <div className="flex h-64 items-center justify-center rounded-xl bg-slate-100 text-slate-400 sm:h-72">
                <div className="text-center">
                    <Store className="mx-auto h-9 w-9" aria-hidden="true" />
                    <p className="mt-2 text-sm">No shop image available</p>
                </div>
            </div>
        );
    }

    return (
        <img
            src={image}
            alt={shopName}
            onError={() => setFailed(true)}
            className="h-64 w-full rounded-xl object-cover sm:h-72"
        />
    );
}

function PlatformShopDetail() {
    const { id } = useParams<{ id: string }>();
    const { data, isPending, isError, isFetching, refetch } = usePlatformShop(id);

    if (!id) {
        return <DetailError />;
    }

    if (isPending) {
        return <PlatformShopDetailSkeleton />;
    }

    if (isError || !data) {
        return <DetailError onRetry={() => void refetch()} retrying={isFetching} />;
    }

    const location = formatApplicationLocation(
        data.city,
        data.district,
        data.state
    );
    const fullAddress = [data.address_line, location, data.pincode]
        .filter(Boolean)
        .join(", ");

    return (
        <div className="space-y-6">
            <header className="space-y-4">
                <Link
                    to="/platform/shops"
                    className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700 transition hover:text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                >
                    <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                    Back to shops
                </Link>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                        <p className="text-sm font-semibold text-blue-600">Approved shop</p>
                        <h1 className="mt-1 break-words font-heading text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
                            {data.shop_name}
                        </h1>
                        <p className="mt-2 flex items-center gap-2 text-sm text-slate-500">
                            <MapPin className="h-4 w-4 shrink-0 text-blue-500" aria-hidden="true" />
                            {location}
                        </p>
                    </div>
                    <span
                        className={`inline-flex min-h-9 items-center gap-2 self-start rounded-full px-3 text-xs font-semibold ${
                            data.is_open
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-slate-100 text-slate-600"
                        }`}
                    >
                        <span
                            className={`h-2 w-2 rounded-full ${
                                data.is_open ? "bg-emerald-500" : "bg-slate-400"
                            }`}
                            aria-hidden="true"
                        />
                        {data.is_open ? "Open" : "Closed"}
                    </span>
                </div>
            </header>

            <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
                <div className="space-y-6">
                    <DetailSection title="Shop overview" icon={Building2}>
                        <ShopImage image={data.image} shopName={data.shop_name} />
                        <p className="mt-5 whitespace-pre-line text-sm leading-7 text-slate-600">
                            {data.description || "No description provided."}
                        </p>
                    </DetailSection>

                    <DetailSection title="Address and contact" icon={MapPin}>
                        <dl className="grid gap-5 sm:grid-cols-2">
                            <DetailField label="Full address" value={fullAddress || "Address unavailable"} />
                            <DetailField label="Contact number" value={data.contact_number || "Not provided"} />
                            <DetailField label="Opening time" value={formatApplicationTime(data.opening_time)} />
                            <DetailField label="Closing time" value={formatApplicationTime(data.closing_time)} />
                        </dl>
                    </DetailSection>
                </div>

                <aside className="space-y-6">
                    <DetailSection title="Shop Admin" icon={UserRound}>
                        {data.shop_admin_id || data.shop_admin_username || data.shop_admin_email ? (
                            <dl className="space-y-5">
                                <DetailField label="Username" value={data.shop_admin_username || "Not available"} />
                                <DetailField label="Email" value={data.shop_admin_email || "Not available"} />
                                <DetailField label="Phone" value={data.shop_admin_phone || "Not available"} />
                            </dl>
                        ) : (
                            <p className="text-sm leading-6 text-slate-500">
                                No Shop Admin is currently assigned.
                            </p>
                        )}
                    </DetailSection>

                    <DetailSection title="Shop timeline" icon={CalendarDays}>
                        <dl className="space-y-5">
                            <DetailField label="Created" value={formatApplicationDateTime(data.created_at)} />
                            <DetailField label="Last updated" value={formatApplicationDateTime(data.updated_at)} />
                        </dl>
                    </DetailSection>

                    <section className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm sm:p-6">
                        <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                                <Clock3 className="h-4.5 w-4.5" aria-hidden="true" />
                            </div>
                            <div>
                                <h2 className="font-heading text-base font-semibold text-slate-950">Operational status</h2>
                                <p className="mt-1 text-xs text-slate-500">This controls whether the shop is currently open.</p>
                            </div>
                        </div>
                        <div className="mt-5 flex flex-wrap items-center gap-3">
                            <OperationalStatusControl
                                shopId={data.id}
                                shopName={data.shop_name}
                                isOpen={data.is_open}
                            />
                            <span className="text-xs text-slate-500">
                                Open/Closed only; this does not suspend the shop.
                            </span>
                        </div>
                    </section>
                </aside>
            </div>

            <div className="flex flex-wrap gap-4 text-xs text-slate-400">
                <span className="inline-flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                    {data.contact_number || "No contact number"}
                </span>
                <span className="inline-flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                    {data.shop_admin_email || "No admin email"}
                </span>
            </div>
        </div>
    );
}

export default PlatformShopDetail;
