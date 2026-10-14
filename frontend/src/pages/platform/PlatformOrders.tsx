import {
    CalendarDays,
    ChevronLeft,
    ChevronRight,
    CircleDollarSign,
    Eye,
    Filter,
    PackageCheck,
    RefreshCw,
    XCircle,
} from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";

import MetricCard from "../../components/admin/dashboard/MetricCard";
import {
    OrderStatusBadge,
    PaymentStatusBadge,
} from "../../components/admin/orders/OrderStatusBadge";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { usePlatformOrderAnalytics, usePlatformOrders } from "../../hooks/platform/usePlatformOrders";
import { getApiErrorMessage } from "../../lib/apiError";
import { formatOrderAmount, formatOrderDate } from "../../lib/orderDisplay";
import type {
    PlatformOrderDatePreset,
    PlatformOrderFilters,
    PlatformOrderStatus,
    PlatformPaymentStatus,
} from "../../types/platform/orders";

type DateFilterControl = PlatformOrderDatePreset | "custom";
type AppliedDateFilter =
    | { date_preset: PlatformOrderDatePreset }
    | { created_from: string; created_to: string };

const dateFilterOptions: { value: DateFilterControl; label: string }[] = [
    { value: "all", label: "All orders" },
    { value: "today", label: "Today" },
    { value: "this_week", label: "This week" },
    { value: "this_month", label: "This month" },
    { value: "custom", label: "Custom range" },
];

const orderStatusOptions: { value: PlatformOrderStatus; label: string }[] = [
    { value: "placed", label: "Placed" },
    { value: "accepted", label: "Accepted" },
    { value: "pickup_scheduled", label: "Pickup scheduled" },
    { value: "picked_up", label: "Picked up" },
    { value: "processing", label: "Processing" },
    { value: "ready", label: "Ready" },
    { value: "delivered", label: "Delivered" },
    { value: "cancelled", label: "Cancelled" },
];

const paymentStatusOptions: { value: PlatformPaymentStatus; label: string }[] = [
    { value: "pending", label: "Pending" },
    { value: "processing", label: "Processing" },
    { value: "success", label: "Paid" },
    { value: "failed", label: "Failed" },
    { value: "cancelled", label: "Cancelled" },
];

const numberFormatter = new Intl.NumberFormat("en-IN");
const PAGE_SIZE = 10;

function OrdersLoadingState() {
    return (
        <div className="animate-pulse space-y-6" aria-label="Loading orders">
            <div className="grid gap-4 sm:grid-cols-3">
                {["one", "two", "three"].map((key) => (
                    <div key={key} className="h-32 rounded-2xl bg-slate-200" />
                ))}
            </div>
            <div className="h-36 rounded-2xl bg-slate-200" />
            <div className="h-96 rounded-2xl bg-slate-200" />
        </div>
    );
}

function OrdersEmptyState({ filtered }: { filtered: boolean }) {
    return (
        <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                <Filter className="h-5 w-5" aria-hidden="true" />
            </div>
            <h2 className="mt-4 font-heading text-lg font-semibold text-slate-950">
                {filtered ? "No orders match these filters" : "No orders yet"}
            </h2>
            <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
                {filtered
                    ? "Try changing the date, status, payment, or shop filters."
                    : "Orders will appear here when customers place them."}
            </p>
        </div>
    );
}

function OrdersError({
    message,
    onRetry,
    retrying,
}: {
    message: string;
    onRetry: () => void;
    retrying: boolean;
}) {
    return (
        <section className="rounded-2xl border border-red-100 bg-white p-8 text-center shadow-sm" role="alert">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
                <RefreshCw className="h-6 w-6" aria-hidden="true" />
            </div>
            <h2 className="mt-4 font-heading text-xl font-semibold text-slate-950">
                Orders could not be loaded
            </h2>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">
                {message}
            </p>
            <Button type="button" className="mt-6" onClick={onRetry} disabled={retrying}>
                {retrying ? "Trying again..." : "Try again"}
            </Button>
        </section>
    );
}

function PlatformOrders() {
    const [dateFilter, setDateFilter] = useState<DateFilterControl>("all");
    const [appliedDateFilter, setAppliedDateFilter] = useState<AppliedDateFilter>({
        date_preset: "all",
    });
    const [createdFrom, setCreatedFrom] = useState("");
    const [createdTo, setCreatedTo] = useState("");
    const [dateFilterError, setDateFilterError] = useState<string | null>(null);
    const [status, setStatus] = useState<PlatformOrderStatus | "">("");
    const [paymentStatus, setPaymentStatus] = useState<PlatformPaymentStatus | "">("");
    const [shopInput, setShopInput] = useState("");
    const [shopId, setShopId] = useState<number | undefined>();
    const [shopFilterError, setShopFilterError] = useState<string | null>(null);
    const [page, setPage] = useState(1);

    const commonFilters = useMemo<PlatformOrderFilters>(
        () => ({
            ...appliedDateFilter,
            ...(status ? { status } : {}),
            ...(paymentStatus ? { payment_status: paymentStatus } : {}),
            ...(shopId ? { shop: shopId } : {}),
        }),
        [appliedDateFilter, paymentStatus, shopId, status]
    );
    const listFilters = useMemo(
        () => ({ ...commonFilters, page }),
        [commonFilters, page]
    );
    const analyticsFilters = commonFilters;

    const listQuery = usePlatformOrders(listFilters);
    const analyticsQuery = usePlatformOrderAnalytics(analyticsFilters);

    const handlePresetChange = (value: DateFilterControl) => {
        setDateFilter(value);
        setDateFilterError(null);

        if (value !== "custom") {
            setAppliedDateFilter({ date_preset: value });
            setPage(1);
        }
    };

    const applyCustomDateFilter = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (!createdFrom || !createdTo) {
            setDateFilterError("Select both a start date and an end date.");
            return;
        }

        if (createdFrom > createdTo) {
            setDateFilterError("The end date must be on or after the start date.");
            return;
        }

        setDateFilterError(null);
        setAppliedDateFilter({
            created_from: createdFrom,
            created_to: createdTo,
        });
        setPage(1);
    };

    const applyShopFilter = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const value = shopInput.trim();

        if (value && (!/^\d+$/.test(value) || Number(value) < 1)) {
            setShopFilterError("Enter a positive shop ID.");
            return;
        }

        setShopFilterError(null);
        setShopId(value ? Number(value) : undefined);
        setPage(1);
    };

    const clearFilters = () => {
        setDateFilter("all");
        setAppliedDateFilter({ date_preset: "all" });
        setCreatedFrom("");
        setCreatedTo("");
        setDateFilterError(null);
        setStatus("");
        setPaymentStatus("");
        setShopInput("");
        setShopId(undefined);
        setShopFilterError(null);
        setPage(1);
    };

    const retry = () => {
        void Promise.all([listQuery.refetch(), analyticsQuery.refetch()]);
    };

    if (listQuery.isPending && analyticsQuery.isPending) {
        return <OrdersLoadingState />;
    }

    const queryError = listQuery.error ?? analyticsQuery.error;
    const errorMessage = queryError
        ? getApiErrorMessage(queryError, "Please check the filters and try again.")
        : null;
    const data = listQuery.data;
    const analytics = analyticsQuery.data;
    const totalPages = Math.max(1, Math.ceil((data?.count ?? 0) / PAGE_SIZE));
    const firstResult = !data || data.count === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
    const lastResult = data ? Math.min(page * PAGE_SIZE, data.count) : 0;
    const hasActiveFilters =
        dateFilter !== "all" ||
        Boolean(status) ||
        Boolean(paymentStatus) ||
        Boolean(shopId);

    return (
        <div className="space-y-6">
            <header className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
                <div>
                    <p className="text-sm font-semibold text-blue-600">Platform workspace</p>
                    <h1 className="mt-1 font-heading text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
                        Orders
                    </h1>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                        Monitor orders across every shop. This view is read-only.
                    </p>
                </div>
                {listQuery.isFetching && (
                    <p className="inline-flex items-center gap-2 text-xs text-slate-400" role="status">
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                        Updating orders...
                    </p>
                )}
            </header>

            {errorMessage && (
                <div className="flex items-start gap-3 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-800" role="alert">
                    <XCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                    <div>
                        <p className="font-semibold">Could not refresh order data</p>
                        <p className="mt-1">{errorMessage}</p>
                    </div>
                </div>
            )}

            <section aria-labelledby="order-summary-heading">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-600">At a glance</p>
                        <h2 id="order-summary-heading" className="mt-1 font-heading text-lg font-semibold text-slate-950">
                            Order summary
                        </h2>
                    </div>
                    {analytics && (
                        <p className="text-xs text-slate-400">
                            {analytics.filters.created_from && analytics.filters.created_to
                                ? `${analytics.filters.created_from} to ${analytics.filters.created_to} · ${analytics.filters.timezone}`
                                : `All dates · ${analytics.filters.timezone}`}
                        </p>
                    )}
                </div>
                <div className="mt-4 grid gap-4 sm:grid-cols-3">
                    <MetricCard
                        label="Total Orders"
                        value={analytics ? numberFormatter.format(analytics.summary.total_orders) : "—"}
                        icon={PackageCheck}
                        tone="blue"
                    />
                    <MetricCard
                        label="Cancelled Orders"
                        value={analytics ? numberFormatter.format(analytics.summary.cancelled_orders) : "—"}
                        icon={XCircle}
                        tone="amber"
                    />
                    <MetricCard
                        label="Gross Order Value"
                        value={analytics ? formatOrderAmount(analytics.summary.gross_order_value) : "—"}
                        icon={CircleDollarSign}
                        tone="violet"
                    />
                </div>
                <p className="mt-3 text-xs leading-5 text-slate-500">
                    Gross order value excludes cancelled orders. It is not platform earnings, commission, or profit.
                </p>
            </section>

            <section className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm sm:p-5" aria-labelledby="order-filters-heading">
                <div className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-blue-600" aria-hidden="true" />
                    <h2 id="order-filters-heading" className="text-sm font-semibold text-slate-800">Filters</h2>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-4">
                    <label className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">
                        Date range
                        <select
                            value={dateFilter}
                            onChange={(event) => handlePresetChange(event.target.value as DateFilterControl)}
                            className="mt-2 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal normal-case tracking-normal text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        >
                            {dateFilterOptions.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                    </label>

                    <label className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">
                        Order status
                        <select
                            value={status}
                            onChange={(event) => {
                                setStatus(event.target.value as PlatformOrderStatus | "");
                                setPage(1);
                            }}
                            className="mt-2 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal normal-case tracking-normal text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        >
                            <option value="">All statuses</option>
                            {orderStatusOptions.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                    </label>

                    <label className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">
                        Payment status
                        <select
                            value={paymentStatus}
                            onChange={(event) => {
                                setPaymentStatus(event.target.value as PlatformPaymentStatus | "");
                                setPage(1);
                            }}
                            className="mt-2 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal normal-case tracking-normal text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        >
                            <option value="">All payment statuses</option>
                            {paymentStatusOptions.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                    </label>

                    <form onSubmit={applyShopFilter}>
                        <label htmlFor="platform-order-shop" className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">
                            Shop ID
                        </label>
                        <div className="mt-2 flex gap-2">
                            <Input
                                id="platform-order-shop"
                                value={shopInput}
                                onChange={(event) => setShopInput(event.target.value)}
                                inputMode="numeric"
                                placeholder="All shops"
                                aria-invalid={Boolean(shopFilterError)}
                                aria-describedby={shopFilterError ? "platform-order-shop-error" : undefined}
                            />
                            <Button type="submit" variant="outline">Apply</Button>
                        </div>
                        {shopFilterError && <p id="platform-order-shop-error" className="mt-1 text-xs font-normal normal-case tracking-normal text-red-600">{shopFilterError}</p>}
                    </form>
                </div>

                {dateFilter === "custom" && (
                    <form className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-end" onSubmit={applyCustomDateFilter}>
                        <label htmlFor="platform-order-created-from" className="flex-1 text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">
                            Start date
                            <Input id="platform-order-created-from" type="date" value={createdFrom} onChange={(event) => setCreatedFrom(event.target.value)} className="mt-2" aria-invalid={Boolean(dateFilterError)} />
                        </label>
                        <label htmlFor="platform-order-created-to" className="flex-1 text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">
                            End date
                            <Input id="platform-order-created-to" type="date" value={createdTo} onChange={(event) => setCreatedTo(event.target.value)} className="mt-2" aria-invalid={Boolean(dateFilterError)} />
                        </label>
                        <Button type="submit" className="sm:min-w-32">Apply dates</Button>
                    </form>
                )}
                {dateFilterError && <p className="mt-2 text-xs text-red-600" role="alert">{dateFilterError}</p>}

                {(hasActiveFilters || shopInput) && (
                    <Button type="button" variant="ghost" className="mt-3 px-0 text-blue-700 hover:bg-transparent hover:text-blue-800" onClick={clearFilters}>
                        Clear filters
                    </Button>
                )}
            </section>

            {listQuery.isError || !data ? (
                <OrdersError
                    message={getApiErrorMessage(listQuery.error, "Please try again.")}
                    onRetry={retry}
                    retrying={listQuery.isFetching}
                />
            ) : data.results.length === 0 ? (
                <OrdersEmptyState filtered={hasActiveFilters} />
            ) : (
                <>
                    <div className="hidden overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm md:block">
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[980px] text-left text-sm">
                                <caption className="sr-only">Platform orders</caption>
                                <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-[0.12em] text-slate-500">
                                    <tr>
                                        <th scope="col" className="px-6 py-4 font-semibold">Order</th>
                                        <th scope="col" className="px-6 py-4 font-semibold">Customer</th>
                                        <th scope="col" className="px-6 py-4 font-semibold">Shop</th>
                                        <th scope="col" className="px-6 py-4 font-semibold">Created</th>
                                        <th scope="col" className="px-6 py-4 font-semibold">Amount</th>
                                        <th scope="col" className="px-6 py-4 font-semibold">Status</th>
                                        <th scope="col" className="px-6 py-4 font-semibold">Payment</th>
                                        <th scope="col" className="px-6 py-4 text-right font-semibold">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {data.results.map((order) => (
                                        <tr key={order.id} className="align-middle transition hover:bg-blue-50/40">
                                            <td className="px-6 py-4"><Link to={`/platform/orders/${order.id}`} className="font-semibold text-slate-900 hover:text-blue-700">{order.order_number}</Link><p className="mt-1 text-xs text-slate-500">Order #{order.id}</p></td>
                                            <td className="max-w-44 truncate px-6 py-4 text-slate-700">{order.customer_username}</td>
                                            <td className="max-w-44 truncate px-6 py-4 text-slate-700">{order.shop_name}</td>
                                            <td className="whitespace-nowrap px-6 py-4 text-slate-600">{formatOrderDate(order.created_at)}</td>
                                            <td className="whitespace-nowrap px-6 py-4 font-semibold text-slate-900">{formatOrderAmount(order.total_amount)}</td>
                                            <td className="px-6 py-4"><OrderStatusBadge status={order.order_status} /></td>
                                            <td className="px-6 py-4"><PaymentStatusBadge status={order.payment_status} /></td>
                                            <td className="px-6 py-4 text-right"><Link to={`/platform/orders/${order.id}`} className="inline-flex min-h-9 items-center justify-center gap-2 rounded-xl border border-blue-100 bg-white px-3 text-sm font-semibold text-blue-700 transition hover:border-blue-200 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"><Eye className="h-4 w-4" aria-hidden="true" />View</Link></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="space-y-3 md:hidden">
                        {data.results.map((order) => (
                            <article key={order.id} className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <Link to={`/platform/orders/${order.id}`} className="font-heading text-base font-semibold text-slate-950 hover:text-blue-700">{order.order_number}</Link>
                                        <p className="mt-1 truncate text-sm text-slate-500">{order.shop_name}</p>
                                    </div>
                                    <OrderStatusBadge status={order.order_status} />
                                </div>
                                <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-slate-100 pt-4 text-sm">
                                    <div><dt className="text-xs font-medium text-slate-400">Customer</dt><dd className="mt-1 truncate font-medium text-slate-700">{order.customer_username}</dd></div>
                                    <div><dt className="text-xs font-medium text-slate-400">Created</dt><dd className="mt-1 font-medium text-slate-700">{formatOrderDate(order.created_at)}</dd></div>
                                    <div><dt className="text-xs font-medium text-slate-400">Amount</dt><dd className="mt-1 font-semibold text-slate-900">{formatOrderAmount(order.total_amount)}</dd></div>
                                    <div><dt className="text-xs font-medium text-slate-400">Payment</dt><dd className="mt-1"><PaymentStatusBadge status={order.payment_status} /></dd></div>
                                </dl>
                                <Link to={`/platform/orders/${order.id}`} className="mt-5 inline-flex min-h-9 w-full items-center justify-center gap-2 rounded-xl border border-blue-100 px-3 text-sm font-semibold text-blue-700 hover:bg-blue-50"><Eye className="h-4 w-4" aria-hidden="true" />View order</Link>
                            </article>
                        ))}
                    </div>

                    <nav className="flex flex-col gap-4 rounded-2xl border border-blue-100 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between" aria-label="Order pagination">
                        <p className="text-sm text-slate-500">Showing <span className="font-semibold text-slate-700">{firstResult}-{lastResult}</span> of <span className="font-semibold text-slate-700">{data.count}</span></p>
                        <div className="flex items-center gap-2">
                            <Button type="button" variant="outline" size="sm" onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))} disabled={!data.previous || listQuery.isFetching}><ChevronLeft className="h-4 w-4" aria-hidden="true" />Previous</Button>
                            <span className="min-w-20 text-center text-sm font-medium text-slate-600">Page {page} of {totalPages}</span>
                            <Button type="button" variant="outline" size="sm" onClick={() => setPage((currentPage) => currentPage + 1)} disabled={!data.next || listQuery.isFetching}>Next<ChevronRight className="h-4 w-4" aria-hidden="true" /></Button>
                        </div>
                    </nav>
                </>
            )}
        </div>
    );
}

export default PlatformOrders;
