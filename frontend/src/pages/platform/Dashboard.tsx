import {
    Activity,
    BarChart3,
    CheckCircle2,
    ClipboardCheck,
    CircleDollarSign,
    PackageCheck,
    Store,
    Users,
} from "lucide-react";
import { useState } from "react";

import DashboardSkeleton from "../../components/admin/dashboard/DashboardSkeleton";
import MetricCard from "../../components/admin/dashboard/MetricCard";
import TrendChart from "../../components/admin/dashboard/TrendChart";
import { Button } from "../../components/ui/button";
import { usePlatformDashboard } from "../../hooks/platform/usePlatformDashboard";
import type { DashboardDecimal } from "../../types/platform/dashboard";

const TIME_RANGES = [7, 30, 90, 365] as const;
type TimeRange = (typeof TIME_RANGES)[number];

const numberFormatter = new Intl.NumberFormat("en-IN");
const currencyFormatter = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
});

const formatNumber = (value: number) => numberFormatter.format(value);

const formatCurrency = (value: DashboardDecimal) => {
    const numericValue = typeof value === "number" ? value : Number(value);

    if (!Number.isFinite(numericValue)) {
        return typeof value === "string" ? `\u20B9${value}` : "\u20B90.00";
    }

    return currencyFormatter.format(numericValue);
};

function DashboardSectionHeading({
    eyebrow,
    title,
}: {
    eyebrow: string;
    title: string;
}) {
    return (
        <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-600">
                {eyebrow}
            </p>
            <h2 className="mt-1 font-heading text-lg font-semibold text-slate-950">
                {title}
            </h2>
        </div>
    );
}

function DashboardError({ onRetry, isRetrying }: { onRetry: () => void; isRetrying: boolean }) {
    return (
        <section
            className="rounded-2xl border border-red-100 bg-white p-8 text-center shadow-sm"
            role="alert"
        >
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
                <Activity className="h-6 w-6" aria-hidden="true" />
            </div>
            <h1 className="mt-4 font-heading text-xl font-semibold text-slate-950">
                Dashboard data could not be loaded
            </h1>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                Something went wrong while retrieving the platform overview. Please try again.
            </p>
            <Button
                type="button"
                className="mt-6"
                onClick={onRetry}
                disabled={isRetrying}
            >
                {isRetrying ? "Retrying..." : "Retry"}
            </Button>
        </section>
    );
}

function DashboardListEmpty({ message }: { message: string }) {
    return (
        <div className="mt-5 flex min-h-40 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 text-center text-sm text-slate-500">
            {message}
        </div>
    );
}

function Dashboard() {
    const [days, setDays] = useState<TimeRange>(30);
    const { data, isPending, isError, isFetching, refetch } =
        usePlatformDashboard(days);

    if (isPending) {
        return <DashboardSkeleton />;
    }

    if (isError || !data) {
        return <DashboardError onRetry={() => void refetch()} isRetrying={isFetching} />;
    }

    const { operational, business } = data;

    return (
        <div className="space-y-8">
            <header className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
                <div>
                    <p className="text-sm font-semibold text-blue-600">Platform overview</p>
                    <h1 className="mt-1 font-heading text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
                        Dashboard
                    </h1>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                        Monitor orders, shops, applications, and platform growth in one place.
                    </p>
                </div>

                <div
                    className="flex flex-wrap gap-2"
                    role="group"
                    aria-label="Dashboard time range"
                >
                    {TIME_RANGES.map((range) => (
                        <button
                            key={range}
                            type="button"
                            aria-pressed={days === range}
                            onClick={() => setDays(range)}
                            className={`min-h-10 rounded-xl border px-3 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
                                days === range
                                    ? "border-blue-600 bg-blue-600 text-white"
                                    : "border-blue-100 bg-white text-slate-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                            }`}
                        >
                            {range} days
                        </button>
                    ))}
                </div>
            </header>

            {isFetching && (
                <p className="-mt-4 text-right text-xs text-slate-400" role="status">
                    Refreshing dashboard data...
                </p>
            )}

            <section>
                <DashboardSectionHeading eyebrow="At a glance" title="Primary metrics" />
                <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <MetricCard
                        label="Total Orders"
                        value={formatNumber(operational.total_orders)}
                        icon={PackageCheck}
                        tone="blue"
                    />
                    <MetricCard
                        label="Active Orders"
                        value={formatNumber(operational.active_orders)}
                        icon={Activity}
                        tone="indigo"
                    />
                    <MetricCard
                        label="Completed Orders"
                        value={formatNumber(operational.completed_orders)}
                        icon={CheckCircle2}
                        tone="emerald"
                    />
                    <MetricCard
                        label="Gross Order Value"
                        value={formatCurrency(business.gross_order_value)}
                        icon={CircleDollarSign}
                        tone="violet"
                    />
                </div>
            </section>

            <section>
                <DashboardSectionHeading eyebrow="Operations" title="Platform activity" />
                <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <MetricCard
                        label="Pending Shop Applications"
                        value={formatNumber(operational.pending_shop_applications)}
                        icon={ClipboardCheck}
                        tone="amber"
                    />
                    <MetricCard
                        label="Approved Shops"
                        value={formatNumber(operational.approved_shops)}
                        icon={Store}
                        tone="blue"
                    />
                    <MetricCard
                        label="Pending Service Requests"
                        value={formatNumber(operational.pending_service_requests)}
                        icon={BarChart3}
                        tone="violet"
                    />
                    <MetricCard
                        label="Active Shops"
                        value={formatNumber(operational.active_shops)}
                        icon={Store}
                        tone="emerald"
                    />
                </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-[1.5fr_1fr]" aria-label="Order and customer trends">
                <TrendChart
                    title="Order trend"
                    description="Order count by recorded date"
                    data={business.order_count_trend}
                    accent="blue"
                />
                <TrendChart
                    title="Customer growth"
                    description="New customer count by recorded date"
                    data={business.customer_growth}
                    accent="indigo"
                />
            </section>

            <section className="grid gap-6 lg:grid-cols-2" aria-label="Growth and rankings">
                <TrendChart
                    title="Shop growth"
                    description="New shop count by recorded date"
                    data={business.shop_growth}
                    accent="violet"
                />

                <section className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm sm:p-6">
                    <DashboardSectionHeading eyebrow="Rankings" title="Top shops" />
                    {business.top_shops.length === 0 ? (
                        <DashboardListEmpty message="No shop order activity for this period." />
                    ) : (
                        <ol className="mt-5 divide-y divide-slate-100">
                            {business.top_shops.map((shop, index) => (
                                <li
                                    key={shop.shop_id}
                                    className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 py-3 first:pt-0 last:pb-0"
                                >
                                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-sm font-semibold text-blue-700">
                                        {index + 1}
                                    </span>
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-semibold text-slate-900">
                                            {shop.shop_name}
                                        </p>
                                        <p className="mt-1 text-xs text-slate-500">
                                            {formatNumber(shop.order_count)} orders
                                        </p>
                                    </div>
                                    <p className="text-right text-sm font-semibold text-slate-900">
                                        {formatCurrency(shop.order_value)}
                                    </p>
                                </li>
                            ))}
                        </ol>
                    )}
                </section>
            </section>

            <section className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm sm:p-6">
                <div className="flex items-end justify-between gap-4">
                    <DashboardSectionHeading eyebrow="Demand" title="Popular services" />
                    <Users className="h-5 w-5 shrink-0 text-blue-500" aria-hidden="true" />
                </div>
                {business.popular_services.length === 0 ? (
                    <DashboardListEmpty message="No service activity for this period." />
                ) : (
                    <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {business.popular_services.map((service) => (
                            <article
                                key={service.service_name}
                                className="rounded-xl border border-slate-100 bg-slate-50 p-4"
                            >
                                <h3 className="truncate text-sm font-semibold text-slate-900">
                                    {service.service_name}
                                </h3>
                                <div className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-500">
                                    <span>{formatNumber(service.item_count)} items</span>
                                    <span>{formatNumber(service.order_count)} orders</span>
                                </div>
                            </article>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}

export default Dashboard;

