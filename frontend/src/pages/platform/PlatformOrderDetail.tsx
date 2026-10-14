import {
    ArrowLeft,
    CalendarDays,
    ClipboardList,
    Clock3,
    FileText,
    Mail,
    MapPin,
    Phone,
    RefreshCw,
    Store,
    UserRound,
    type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { Link, useParams } from "react-router-dom";

import {
    OrderStatusBadge,
    PaymentStatusBadge,
} from "../../components/admin/orders/OrderStatusBadge";
import { Button } from "../../components/ui/button";
import { usePlatformOrder } from "../../hooks/platform/usePlatformOrders";
import { getApiErrorMessage } from "../../lib/apiError";
import {
    formatOrderAmount,
    formatOrderDate,
    formatOrderDateTime,
} from "../../lib/orderDisplay";

function OrderDetailError({
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
                Order details could not be loaded
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
    icon: LucideIcon;
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

function PlatformOrderDetail() {
    const { id } = useParams<{ id: string }>();
    const { data, isPending, isError, isFetching, error, refetch } = usePlatformOrder(id);

    if (!id) {
        return <OrderDetailError message="The order identifier is missing." />;
    }

    if (isPending) {
        return (
            <div className="animate-pulse space-y-6" aria-label="Loading order details">
                <div className="h-24 rounded-2xl bg-slate-200" />
                <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
                    <div className="space-y-6">
                        <div className="h-80 rounded-2xl bg-slate-200" />
                        <div className="h-64 rounded-2xl bg-slate-200" />
                    </div>
                    <div className="space-y-6">
                        <div className="h-56 rounded-2xl bg-slate-200" />
                        <div className="h-48 rounded-2xl bg-slate-200" />
                    </div>
                </div>
            </div>
        );
    }

    if (isError || !data) {
        return (
            <OrderDetailError
                message={getApiErrorMessage(error, "The order may no longer be available. Please try again.")}
                onRetry={() => void refetch()}
                retrying={isFetching}
            />
        );
    }

    const addressLines = [
        data.pickup_address_line,
        [data.pickup_city, data.pickup_district].filter(Boolean).join(", "),
        [data.pickup_state, data.pickup_pincode].filter(Boolean).join(" "),
    ].filter(Boolean);

    return (
        <div className="space-y-6">
            <header className="space-y-4">
                <Link
                    to="/platform/orders"
                    className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700 transition hover:text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                >
                    <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                    Back to orders
                </Link>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                        <p className="text-sm font-semibold text-blue-600">Platform order</p>
                        <h1 className="mt-1 break-words font-heading text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
                            {data.order_number}
                        </h1>
                        <p className="mt-2 flex items-center gap-2 text-sm text-slate-500">
                            <CalendarDays className="h-4 w-4 shrink-0 text-blue-500" aria-hidden="true" />
                            Created {formatOrderDate(data.created_at)}
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <OrderStatusBadge status={data.order_status} />
                        <PaymentStatusBadge status={data.payment_status} />
                    </div>
                </div>
            </header>

            <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
                <div className="space-y-6">
                    <DetailSection title="Order items" icon={ClipboardList}>
                        {data.items.length === 0 ? (
                            <p className="text-sm leading-6 text-slate-500">No order items were returned.</p>
                        ) : (
                            <div className="divide-y divide-slate-100">
                                {data.items.map((item) => (
                                    <div key={item.id} className="flex flex-col gap-4 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                                        <div className="min-w-0">
                                            <p className="break-words text-sm font-semibold text-slate-950">
                                                {item.service_name_snapshot}
                                            </p>
                                            <p className="mt-1 break-words text-sm text-slate-600">
                                                {item.garment_name_snapshot}
                                            </p>
                                            <p className="mt-1 text-xs text-slate-400">
                                                Qty {item.quantity} · Item {item.item_status}
                                            </p>
                                        </div>
                                        <div className="grid grid-cols-2 gap-5 text-sm sm:min-w-52 sm:text-right">
                                            <div>
                                                <p className="text-xs text-slate-400">Unit price</p>
                                                <p className="mt-1 font-medium text-slate-800">
                                                    {formatOrderAmount(item.unit_price_snapshot)}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-400">Subtotal</p>
                                                <p className="mt-1 font-semibold text-slate-950">
                                                    {formatOrderAmount(item.line_total)}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        <div className="mt-5 flex items-center justify-between gap-4 border-t border-slate-100 pt-5">
                            <span className="font-semibold text-slate-950">Total amount</span>
                            <span className="text-xl font-semibold text-slate-950">
                                {formatOrderAmount(data.total_amount)}
                            </span>
                        </div>
                    </DetailSection>

                    <DetailSection title="Pickup address" icon={MapPin}>
                        {addressLines.length > 0 ? (
                            <div className="space-y-1 text-sm leading-6 text-slate-600">
                                {addressLines.map((line) => <p key={line}>{line}</p>)}
                            </div>
                        ) : (
                            <p className="text-sm leading-6 text-slate-500">Address details unavailable.</p>
                        )}
                    </DetailSection>

                    {data.note && (
                        <DetailSection title="Customer note" icon={FileText}>
                            <p className="whitespace-pre-line text-sm leading-7 text-slate-600">{data.note}</p>
                        </DetailSection>
                    )}
                </div>

                <aside className="space-y-6">
                    <DetailSection title="Customer" icon={UserRound}>
                        <dl className="space-y-5">
                            <DetailField label="Username" value={data.customer_username || "Not available"} />
                            <DetailField label="Email" value={data.customer_email || "Not provided"} />
                            <DetailField label="Phone" value={data.customer_phone || "Not provided"} />
                        </dl>
                        <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-400">
                            <span className="inline-flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" aria-hidden="true" />{data.customer_email || "No email"}</span>
                            <span className="inline-flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" aria-hidden="true" />{data.customer_phone || "No phone"}</span>
                        </div>
                    </DetailSection>

                    <DetailSection title="Shop" icon={Store}>
                        <dl className="space-y-5">
                            <DetailField label="Shop" value={data.shop_name || "Not available"} />
                            <DetailField label="Shop Admin" value={data.shop_admin_username || "Not assigned"} />
                        </dl>
                    </DetailSection>

                    <DetailSection title="Order timeline" icon={Clock3}>
                        <dl className="space-y-5">
                            <DetailField label="Created" value={formatOrderDateTime(data.created_at) || "Not available"} />
                            <DetailField label="Last updated" value={formatOrderDateTime(data.updated_at) || "Not available"} />
                        </dl>
                    </DetailSection>

                    <DetailSection title="Status history" icon={Clock3}>
                        {data.status_history.length === 0 ? (
                            <p className="text-sm leading-6 text-slate-500">No status history was returned.</p>
                        ) : (
                            <ol className="space-y-4">
                                {data.status_history.map((history, index) => (
                                    <li key={`${history.status}-${history.created_at}-${index}`} className="flex items-start gap-3">
                                        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-500" aria-hidden="true" />
                                        <div className="min-w-0">
                                            <OrderStatusBadge status={history.status} />
                                            <p className="mt-1 text-xs text-slate-400">
                                                {formatOrderDateTime(history.created_at) || "Time unavailable"}
                                            </p>
                                        </div>
                                    </li>
                                ))}
                            </ol>
                        )}
                    </DetailSection>
                </aside>
            </div>
        </div>
    );
}

export default PlatformOrderDetail;
