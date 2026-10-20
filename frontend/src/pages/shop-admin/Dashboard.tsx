import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
    AlertCircle,
    ArrowRight,
    BriefcaseBusiness,
    CheckCircle2,
    Clock,
    LayoutDashboard,
    Loader2,
    PackageCheck,
    Power,
    RefreshCw,
    ShieldAlert,
    ShoppingCart,
    Sparkles,
    Store,
    Wrench,
    X,
} from "lucide-react";

import {
    OrderStatusBadge,
    PaymentStatusBadge,
} from "../../components/admin/orders/OrderStatusBadge";
import { Button } from "../../components/ui/button";
import { useShopAdminOrders } from "../../hooks/shopAdmin/useShopAdminOrders";
import {
    useShopAdminProfile,
    useShopDetails,
    useUpdateOperationalStatus,
} from "../../hooks/shopAdmin/useShopAdminProfile";
import { getApiErrorMessage } from "../../lib/apiError";
import {
    formatOrderAmount,
    formatOrderDate,
} from "../../lib/orderDisplay";
import type { ShopAdminOrderCustomer } from "../../types/shopAdmin/orders";

const getCustomerDisplayName = (customer: ShopAdminOrderCustomer): string => {
    const fullName = `${customer.first_name || ""} ${customer.last_name || ""}`.trim();
    return fullName || customer.username || "Customer";
};

function MetricCardSkeleton() {
    return (
        <div className="animate-pulse rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-xs sm:p-6">
            <div className="flex items-center justify-between">
                <div className="h-4 w-28 rounded bg-slate-200" />
                <div className="h-10 w-10 rounded-xl bg-slate-200" />
            </div>
            <div className="mt-4 h-8 w-16 rounded bg-slate-200" />
            <div className="mt-2 h-3 w-36 rounded bg-slate-200" />
        </div>
    );
}

function ShopDashboard() {
    const navigate = useNavigate();

    // Feedback state for operational status toggle
    const [statusFeedback, setStatusFeedback] = useState<{
        type: "success" | "error";
        message: string;
    } | null>(null);

    // Profile & Shop Details queries
    const { data: profile } = useShopAdminProfile();
    const {
        data: shopDetails,
        isLoading: isShopLoading,
        isError: isShopError,
    } = useShopDetails();

    const updateStatusMutation = useUpdateOperationalStatus();

    // KPI 1: Orders Awaiting Action (status: placed)
    const {
        data: placedOrdersData,
        isLoading: isPlacedLoading,
        isError: isPlacedError,
    } = useShopAdminOrders({ status: "placed", page: 1 });

    // KPI 2: In Cleaning / Processing (status: picked_up + processing)
    const {
        data: pickedUpOrdersData,
        isLoading: isPickedUpLoading,
        isError: isPickedUpError,
    } = useShopAdminOrders({ status: "picked_up", page: 1 });

    const {
        data: processingOrdersData,
        isLoading: isProcessingLoading,
        isError: isProcessingError,
    } = useShopAdminOrders({ status: "processing", page: 1 });

    // KPI 3: Ready for Delivery (status: ready)
    const {
        data: readyOrdersData,
        isLoading: isReadyLoading,
        isError: isReadyError,
    } = useShopAdminOrders({ status: "ready", page: 1 });

    // Recent Orders (page 1 sorted newest first by backend default)
    const {
        data: recentOrdersData,
        isLoading: isRecentOrdersLoading,
        isError: isRecentOrdersError,
        error: recentOrdersError,
        refetch: refetchRecentOrders,
        isFetching: isRecentOrdersFetching,
    } = useShopAdminOrders({ page: 1 });

    const shopName = shopDetails?.shop_name || profile?.shop_name || "Your Shop";
    const isApproved = shopDetails?.is_approved ?? profile?.is_shop_approved ?? false;
    const isOpen = shopDetails?.is_open ?? profile?.is_shop_open ?? false;
    const activeServicesCount = shopDetails?.active_services_count ?? 0;

    // Aggregate In-Cleaning / Processing count
    const inProcessingCount =
        (pickedUpOrdersData?.count ?? 0) + (processingOrdersData?.count ?? 0);
    const isInProcessingLoading = isPickedUpLoading || isProcessingLoading;
    const isInProcessingError = isPickedUpError || isProcessingError;

    // Up to 5 latest orders
    const recentOrders = recentOrdersData?.results.slice(0, 5) ?? [];

    const handleToggleOperationalStatus = () => {
        if (!shopDetails || updateStatusMutation.isPending) return;
        setStatusFeedback(null);
        const nextState = !isOpen;

        updateStatusMutation.mutate(nextState, {
            onSuccess: (updated) => {
                setStatusFeedback({
                    type: "success",
                    message: updated.is_open
                        ? "Shop is now open and actively accepting customer orders."
                        : "Shop is now closed. New customer orders are paused.",
                });
            },
            onError: (err) => {
                setStatusFeedback({
                    type: "error",
                    message: getApiErrorMessage(
                        err,
                        "Failed to update operational status. Please try again."
                    ),
                });
            },
        });
    };

    return (
        <div className="space-y-6">
            {/* Top Operational Command Header */}
            <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-xs sm:p-8">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                    {/* Left: Shop Identity and Address */}
                    <div className="space-y-2">
                        <div className="flex items-center gap-3">
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-[#2563EB]">
                                <Store className="h-6 w-6" />
                            </div>
                            <div>
                                <h1 className="font-heading text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                                    {shopName}
                                </h1>
                                <p className="text-xs text-slate-500 sm:text-sm">
                                    Shop Admin Operational Command Center
                                </p>
                            </div>
                        </div>

                        {shopDetails && (
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 sm:text-sm pt-1">
                                <span>
                                    {shopDetails.city}, {shopDetails.district}
                                </span>
                                {shopDetails.opening_time && shopDetails.closing_time && (
                                    <>
                                        <span className="text-slate-300 hidden sm:inline">•</span>
                                        <span className="flex items-center gap-1 text-slate-600">
                                            <Clock className="h-3.5 w-3.5 text-slate-400" />
                                            Hours: {shopDetails.opening_time.slice(0, 5)} -{" "}
                                            {shopDetails.closing_time.slice(0, 5)}
                                        </span>
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Right: Operational Status & Toggle Control */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 shrink-0 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                        <div className="space-y-1">
                            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                                Operational Status
                            </div>
                            <div className="flex items-center gap-2">
                                {!isApproved ? (
                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-600/20">
                                        <ShieldAlert className="h-3.5 w-3.5 text-amber-600" />
                                        Pending Admin Approval
                                    </span>
                                ) : isOpen ? (
                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-600/20">
                                        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                                        Open for Business
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">
                                        <span className="h-2 w-2 rounded-full bg-slate-400" />
                                        Currently Closed
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Operational Toggle Button */}
                        {isApproved && (
                            <Button
                                type="button"
                                variant={isOpen ? "outline" : "default"}
                                size="sm"
                                onClick={handleToggleOperationalStatus}
                                disabled={
                                    updateStatusMutation.isPending ||
                                    (!isOpen && activeServicesCount === 0)
                                }
                                className={
                                    isOpen
                                        ? "border-rose-200 text-rose-700 hover:bg-rose-50 hover:border-rose-300"
                                        : "bg-emerald-600 text-white hover:bg-emerald-700"
                                }
                            >
                                {updateStatusMutation.isPending ? (
                                    <>
                                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                        Updating...
                                    </>
                                ) : (
                                    <>
                                        <Power className="mr-1.5 h-3.5 w-3.5" />
                                        {isOpen ? "Close Shop" : "Open Shop"}
                                    </>
                                )}
                            </Button>
                        )}
                    </div>
                </div>

                {/* Unapproved Shop Advisory Notice */}
                {!isApproved && (
                    <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 text-xs text-amber-800">
                        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                        <div>
                            <span className="font-semibold">Shop pending verification:</span> Your shop
                            profile is awaiting platform administrator review. Service publishing and customer
                            order intake will activate once approved.
                        </div>
                    </div>
                )}

                {/* Active Services Warning if approved but has 0 services */}
                {isApproved && !isOpen && activeServicesCount === 0 && (
                    <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 text-xs text-amber-800">
                        <div className="flex items-center gap-2">
                            <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
                            <span>
                                At least one active service is required before your shop can be opened.
                            </span>
                        </div>
                        <Link
                            to="/shop-admin/services"
                            className="font-bold text-[#2563EB] hover:underline shrink-0"
                        >
                            Add Services →
                        </Link>
                    </div>
                )}

                {/* Inline Status Mutation Feedback Banner */}
                {statusFeedback && (
                    <div
                        className={`mt-4 flex items-start justify-between gap-3 rounded-xl p-3.5 text-xs ${
                            statusFeedback.type === "success"
                                ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
                                : "border border-rose-200 bg-rose-50 text-rose-800"
                        }`}
                        role="alert"
                    >
                        <div className="flex items-start gap-2">
                            {statusFeedback.type === "success" ? (
                                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                            ) : (
                                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                            )}
                            <span className="font-medium">{statusFeedback.message}</span>
                        </div>
                        <button
                            type="button"
                            onClick={() => setStatusFeedback(null)}
                            className="text-slate-400 hover:text-slate-600"
                            aria-label="Dismiss message"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                )}
            </div>

            {/* KPI Cards Grid */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 sm:gap-6">
                {/* KPI 1: Orders Awaiting Action */}
                {isPlacedLoading ? (
                    <MetricCardSkeleton />
                ) : isPlacedError ? (
                    <div className="rounded-2xl border border-rose-200 bg-rose-50/40 p-5 shadow-xs sm:p-6">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-rose-700">Awaiting Action</span>
                            <AlertCircle className="h-5 w-5 text-rose-500" />
                        </div>
                        <div className="mt-3 text-sm text-rose-600">Failed to load count</div>
                    </div>
                ) : (
                    <Link
                        to="/shop-admin/orders"
                        className="group rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-xs transition hover:border-[#2563EB]/50 hover:shadow-sm sm:p-6"
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                Awaiting Action
                            </span>
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600 transition group-hover:scale-105">
                                <Clock className="h-5 w-5" />
                            </div>
                        </div>
                        <div className="mt-2 flex items-baseline gap-2">
                            <span className="text-3xl font-bold tracking-tight text-slate-900 tabular-nums">
                                {placedOrdersData?.count ?? 0}
                            </span>
                            {(placedOrdersData?.count ?? 0) > 0 && (
                                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-bold text-amber-800">
                                    Action Required
                                </span>
                            )}
                        </div>
                        <p className="mt-2 text-xs text-slate-500">
                            Orders in placed status needing confirmation
                        </p>
                    </Link>
                )}

                {/* KPI 2: In Cleaning / Processing */}
                {isInProcessingLoading ? (
                    <MetricCardSkeleton />
                ) : isInProcessingError ? (
                    <div className="rounded-2xl border border-rose-200 bg-rose-50/40 p-5 shadow-xs sm:p-6">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-rose-700">In Cleaning</span>
                            <AlertCircle className="h-5 w-5 text-rose-500" />
                        </div>
                        <div className="mt-3 text-sm text-rose-600">Failed to load count</div>
                    </div>
                ) : (
                    <Link
                        to="/shop-admin/orders"
                        className="group rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-xs transition hover:border-[#2563EB]/50 hover:shadow-sm sm:p-6"
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                In Cleaning
                            </span>
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-[#2563EB] transition group-hover:scale-105">
                                <Sparkles className="h-5 w-5" />
                            </div>
                        </div>
                        <div className="mt-2 flex items-baseline gap-2">
                            <span className="text-3xl font-bold tracking-tight text-slate-900 tabular-nums">
                                {inProcessingCount}
                            </span>
                        </div>
                        <p className="mt-2 text-xs text-slate-500">
                            {pickedUpOrdersData?.count ?? 0} collected · {processingOrdersData?.count ?? 0} processing
                        </p>
                    </Link>
                )}

                {/* KPI 3: Ready for Delivery */}
                {isReadyLoading ? (
                    <MetricCardSkeleton />
                ) : isReadyError ? (
                    <div className="rounded-2xl border border-rose-200 bg-rose-50/40 p-5 shadow-xs sm:p-6">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-rose-700">Ready for Delivery</span>
                            <AlertCircle className="h-5 w-5 text-rose-500" />
                        </div>
                        <div className="mt-3 text-sm text-rose-600">Failed to load count</div>
                    </div>
                ) : (
                    <Link
                        to="/shop-admin/orders"
                        className="group rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-xs transition hover:border-[#2563EB]/50 hover:shadow-sm sm:p-6"
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                Ready for Delivery
                            </span>
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 transition group-hover:scale-105">
                                <PackageCheck className="h-5 w-5" />
                            </div>
                        </div>
                        <div className="mt-2 flex items-baseline gap-2">
                            <span className="text-3xl font-bold tracking-tight text-slate-900 tabular-nums">
                                {readyOrdersData?.count ?? 0}
                            </span>
                        </div>
                        <p className="mt-2 text-xs text-slate-500">
                            Packaged & awaiting delivery drop-off
                        </p>
                    </Link>
                )}

                {/* KPI 4: Active Services */}
                {isShopLoading ? (
                    <MetricCardSkeleton />
                ) : isShopError ? (
                    <div className="rounded-2xl border border-rose-200 bg-rose-50/40 p-5 shadow-xs sm:p-6">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-rose-700">Active Services</span>
                            <AlertCircle className="h-5 w-5 text-rose-500" />
                        </div>
                        <div className="mt-3 text-sm text-rose-600">Failed to load count</div>
                    </div>
                ) : (
                    <Link
                        to="/shop-admin/services"
                        className="group rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-xs transition hover:border-[#2563EB]/50 hover:shadow-sm sm:p-6"
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                Active Services
                            </span>
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 transition group-hover:scale-105">
                                <Wrench className="h-5 w-5" />
                            </div>
                        </div>
                        <div className="mt-2 flex items-baseline gap-2">
                            <span className="text-3xl font-bold tracking-tight text-slate-900 tabular-nums">
                                {activeServicesCount}
                            </span>
                        </div>
                        <p className="mt-2 text-xs text-slate-500">
                            {activeServicesCount === 1 ? "1 service live in shop" : `${activeServicesCount} services live in shop`}
                        </p>
                    </Link>
                )}
            </div>

            {/* Main Content Grid: Recent Orders (8 cols) & Quick Actions (4 cols) */}
            <div className="grid gap-6 lg:grid-cols-12">
                {/* Left: Recent Orders Section */}
                <div className="space-y-4 lg:col-span-8">
                    <div className="rounded-2xl border border-[#E2E8F0] bg-white shadow-xs">
                        {/* Section Header */}
                        <div className="flex items-center justify-between border-b border-slate-100 p-6">
                            <div className="flex items-center gap-2.5">
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-[#2563EB]">
                                    <ShoppingCart className="h-4 w-4" />
                                </div>
                                <div>
                                    <h2 className="text-base font-bold text-slate-900">Recent Orders</h2>
                                    <p className="text-xs text-slate-500">
                                        Latest customer orders requiring fulfillment
                                    </p>
                                </div>
                            </div>
                            <Link
                                to="/shop-admin/orders"
                                className="inline-flex items-center gap-1 text-xs font-semibold text-[#2563EB] hover:text-blue-700"
                            >
                                <span>View all</span>
                                <ArrowRight className="h-3.5 w-3.5" />
                            </Link>
                        </div>

                        {/* Recent Orders Body */}
                        {isRecentOrdersLoading ? (
                            <div className="p-6 space-y-4" aria-label="Loading recent orders">
                                {[1, 2, 3].map((i) => (
                                    <div
                                        key={i}
                                        className="animate-pulse flex items-center justify-between border-b border-slate-100 pb-3"
                                    >
                                        <div className="space-y-1.5">
                                            <div className="h-4 w-24 rounded bg-slate-200" />
                                            <div className="h-3 w-32 rounded bg-slate-200" />
                                        </div>
                                        <div className="h-6 w-20 rounded-full bg-slate-200" />
                                        <div className="h-4 w-16 rounded bg-slate-200" />
                                    </div>
                                ))}
                            </div>
                        ) : isRecentOrdersError ? (
                            <div className="p-8 text-center" role="alert">
                                <AlertCircle className="mx-auto h-8 w-8 text-rose-500" />
                                <p className="mt-2 text-sm font-semibold text-slate-900">
                                    Failed to load recent orders
                                </p>
                                <p className="mt-1 text-xs text-slate-500">
                                    {getApiErrorMessage(
                                        recentOrdersError,
                                        "Could not retrieve recent orders from the server."
                                    )}
                                </p>
                                <Button
                                    type="button"
                                    size="sm"
                                    onClick={() => void refetchRecentOrders()}
                                    disabled={isRecentOrdersFetching}
                                    className="mt-4 bg-[#2563EB] text-white hover:bg-blue-700"
                                >
                                    <RefreshCw
                                        className={`mr-1.5 h-3.5 w-3.5 ${
                                            isRecentOrdersFetching ? "animate-spin" : ""
                                        }`}
                                    />
                                    Retry
                                </Button>
                            </div>
                        ) : recentOrders.length === 0 ? (
                            <div className="p-10 text-center">
                                <ShoppingCart className="mx-auto h-10 w-10 text-slate-300" />
                                <p className="mt-3 text-sm font-bold text-slate-900">No orders yet</p>
                                <p className="mt-1 text-xs text-slate-500">
                                    When customers place orders with your shop, they will appear here.
                                </p>
                            </div>
                        ) : (
                            <div>
                                {/* Desktop Table View */}
                                <div className="hidden overflow-x-auto md:block">
                                    <table className="w-full text-left text-sm text-slate-600">
                                        <thead className="border-b border-slate-100 bg-slate-50/75 text-xs font-semibold uppercase tracking-wider text-slate-500">
                                            <tr>
                                                <th scope="col" className="px-6 py-3">
                                                    Order #
                                                </th>
                                                <th scope="col" className="px-6 py-3">
                                                    Customer
                                                </th>
                                                <th scope="col" className="px-6 py-3">
                                                    Date
                                                </th>
                                                <th scope="col" className="px-6 py-3">
                                                    Status
                                                </th>
                                                <th scope="col" className="px-6 py-3">
                                                    Payment
                                                </th>
                                                <th scope="col" className="px-6 py-3 text-right">
                                                    Total
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {recentOrders.map((order) => {
                                                const customerName = getCustomerDisplayName(order.customer);
                                                return (
                                                    <tr
                                                        key={order.id}
                                                        onClick={() =>
                                                            navigate(`/shop-admin/orders/${order.id}`)
                                                        }
                                                        className="group cursor-pointer transition-colors hover:bg-slate-50/80"
                                                    >
                                                        <td className="whitespace-nowrap px-6 py-3.5 font-bold text-[#2563EB] group-hover:underline">
                                                            {order.order_number}
                                                        </td>
                                                        <td className="px-6 py-3.5">
                                                            <div
                                                                className="max-w-[180px] truncate font-medium text-slate-900"
                                                                title={customerName}
                                                            >
                                                                {customerName}
                                                            </div>
                                                        </td>
                                                        <td className="whitespace-nowrap px-6 py-3.5 text-xs text-slate-500">
                                                            {formatOrderDate(order.created_at)}
                                                        </td>
                                                        <td className="whitespace-nowrap px-6 py-3.5">
                                                            <OrderStatusBadge status={order.order_status} />
                                                        </td>
                                                        <td className="whitespace-nowrap px-6 py-3.5">
                                                            <PaymentStatusBadge status={order.payment_status} />
                                                        </td>
                                                        <td className="whitespace-nowrap px-6 py-3.5 text-right font-bold text-slate-900 tabular-nums">
                                                            {formatOrderAmount(order.total_amount)}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Mobile List View */}
                                <div className="divide-y divide-slate-100 md:hidden">
                                    {recentOrders.map((order) => {
                                        const customerName = getCustomerDisplayName(order.customer);
                                        return (
                                            <div
                                                key={order.id}
                                                onClick={() => navigate(`/shop-admin/orders/${order.id}`)}
                                                className="cursor-pointer p-4 transition-colors hover:bg-slate-50/80 space-y-2"
                                            >
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="font-bold text-[#2563EB]">
                                                        {order.order_number}
                                                    </span>
                                                    <div className="flex items-center gap-1.5">
                                                        <OrderStatusBadge status={order.order_status} />
                                                        <PaymentStatusBadge status={order.payment_status} />
                                                    </div>
                                                </div>
                                                <div className="flex items-center justify-between text-xs text-slate-500">
                                                    <span className="max-w-[180px] truncate text-slate-900 font-medium">
                                                        {customerName}
                                                    </span>
                                                    <span>{formatOrderDate(order.created_at)}</span>
                                                </div>
                                                <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-50">
                                                    <span className="text-slate-500">
                                                        {order.items_count}{" "}
                                                        {order.items_count === 1 ? "item" : "items"}
                                                    </span>
                                                    <span className="font-bold text-slate-900">
                                                        {formatOrderAmount(order.total_amount)}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Card Footer */}
                        <div className="border-t border-slate-100 p-4 text-center">
                            <Link
                                to="/shop-admin/orders"
                                className="text-xs font-semibold text-[#2563EB] hover:underline"
                            >
                                Go to Orders Management →
                            </Link>
                        </div>
                    </div>
                </div>

                {/* Right: Quick Actions & Operational Shortcuts */}
                <div className="space-y-6 lg:col-span-4">
                    {/* Quick Navigation Card */}
                    <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-xs">
                        <div className="flex items-center gap-2.5 border-b border-slate-100 pb-4">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-[#2563EB]">
                                <LayoutDashboard className="h-4 w-4" />
                            </div>
                            <div>
                                <h2 className="text-base font-bold text-slate-900">Quick Actions</h2>
                                <p className="text-xs text-slate-500">Operational shortcuts</p>
                            </div>
                        </div>

                        <div className="mt-4 space-y-2.5">
                            {/* Action 1: View New Orders */}
                            <Link
                                to="/shop-admin/orders"
                                className="group flex items-center justify-between rounded-xl border border-slate-100 p-3.5 transition hover:border-[#2563EB]/40 hover:bg-blue-50/30"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-600 transition group-hover:scale-105">
                                        <Clock className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <div className="text-sm font-semibold text-slate-900 group-hover:text-[#2563EB]">
                                            View New Orders
                                        </div>
                                        <div className="text-xs text-slate-500">
                                            {placedOrdersData?.count ?? 0} orders awaiting action
                                        </div>
                                    </div>
                                </div>
                                <ArrowRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-[#2563EB]" />
                            </Link>

                            {/* Action 2: Manage Services */}
                            <Link
                                to="/shop-admin/services"
                                className="group flex items-center justify-between rounded-xl border border-slate-100 p-3.5 transition hover:border-[#2563EB]/40 hover:bg-blue-50/30"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 transition group-hover:scale-105">
                                        <Wrench className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <div className="text-sm font-semibold text-slate-900 group-hover:text-[#2563EB]">
                                            Manage Services
                                        </div>
                                        <div className="text-xs text-slate-500">
                                            Pricing & garment availability
                                        </div>
                                    </div>
                                </div>
                                <ArrowRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-[#2563EB]" />
                            </Link>

                            {/* Action 3: View Service Requests */}
                            <Link
                                to="/shop-admin/service-requests"
                                className="group flex items-center justify-between rounded-xl border border-slate-100 p-3.5 transition hover:border-[#2563EB]/40 hover:bg-blue-50/30"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 transition group-hover:scale-105">
                                        <BriefcaseBusiness className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <div className="text-sm font-semibold text-slate-900 group-hover:text-[#2563EB]">
                                            Service Requests
                                        </div>
                                        <div className="text-xs text-slate-500">
                                            Request custom services
                                        </div>
                                    </div>
                                </div>
                                <ArrowRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-[#2563EB]" />
                            </Link>

                            {/* Action 4: View All Orders */}
                            <Link
                                to="/shop-admin/orders"
                                className="group flex items-center justify-between rounded-xl border border-slate-100 p-3.5 transition hover:border-[#2563EB]/40 hover:bg-blue-50/30"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-700 transition group-hover:scale-105">
                                        <ShoppingCart className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <div className="text-sm font-semibold text-slate-900 group-hover:text-[#2563EB]">
                                            All Orders
                                        </div>
                                        <div className="text-xs text-slate-500">
                                            {recentOrdersData?.count ?? 0} total orders recorded
                                        </div>
                                    </div>
                                </div>
                                <ArrowRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-[#2563EB]" />
                            </Link>
                        </div>
                    </div>

                    {/* Operational Guidelines Summary Card */}
                    <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-xs">
                        <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3.5">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-[#2563EB]">
                                <Store className="h-4 w-4" />
                            </div>
                            <h3 className="text-base font-bold text-slate-900">Shop Summary</h3>
                        </div>

                        <div className="mt-4 space-y-3 text-xs text-slate-600">
                            <div className="flex items-center justify-between py-1 border-b border-slate-50">
                                <span className="text-slate-400">Approval State:</span>
                                <span
                                    className={`font-semibold ${
                                        isApproved ? "text-emerald-700" : "text-amber-700"
                                    }`}
                                >
                                    {isApproved ? "Approved by Platform" : "Pending Approval"}
                                </span>
                            </div>
                            <div className="flex items-center justify-between py-1 border-b border-slate-50">
                                <span className="text-slate-400">Storefront Status:</span>
                                <span
                                    className={`font-semibold ${
                                        isOpen ? "text-emerald-700" : "text-slate-700"
                                    }`}
                                >
                                    {isOpen ? "Open" : "Closed"}
                                </span>
                            </div>
                            <div className="flex items-center justify-between py-1 border-b border-slate-50">
                                <span className="text-slate-400">Active Services:</span>
                                <span className="font-semibold text-slate-900">
                                    {activeServicesCount} services
                                </span>
                            </div>
                            <div className="flex items-center justify-between py-1">
                                <span className="text-slate-400">Total Orders:</span>
                                <span className="font-semibold text-slate-900">
                                    {recentOrdersData?.count ?? 0}
                                </span>
                            </div>

                            <div className="pt-2">
                                <Link
                                    to="/shop-admin/profile"
                                    className="block w-full rounded-xl border border-slate-200 py-2 text-center text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                                >
                                    Manage Shop Profile →
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default ShopDashboard;
