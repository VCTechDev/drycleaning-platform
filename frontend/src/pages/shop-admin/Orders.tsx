import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
    AlertCircle,
    ChevronLeft,
    ChevronRight,
    Filter,
    RefreshCw,
    RotateCcw,
    Search,
    ShoppingCart,
    X,
} from "lucide-react";

import {
    OrderStatusBadge,
    PaymentStatusBadge,
} from "../../components/admin/orders/OrderStatusBadge";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { useShopAdminOrders } from "../../hooks/shopAdmin/useShopAdminOrders";
import { getApiErrorMessage } from "../../lib/apiError";
import {
    formatOrderAmount,
    formatOrderDate,
    formatOrderDateTime,
} from "../../lib/orderDisplay";
import type {
    ShopAdminOrderCustomer,
    ShopAdminOrderFilters,
    ShopAdminOrderStatus,
    ShopAdminPaymentStatus,
} from "../../types/shopAdmin/orders";

const PAGE_SIZE = 10;

const ORDER_STATUS_OPTIONS: { value: ShopAdminOrderStatus; label: string }[] = [
    { value: "placed", label: "Placed" },
    { value: "accepted", label: "Accepted" },
    { value: "pickup_scheduled", label: "Pickup Scheduled" },
    { value: "picked_up", label: "Picked Up" },
    { value: "processing", label: "Processing" },
    { value: "ready", label: "Ready for Delivery" },
    { value: "delivered", label: "Delivered" },
    { value: "cancelled", label: "Cancelled" },
    { value: "rejected", label: "Rejected" },
];

const PAYMENT_STATUS_OPTIONS: { value: ShopAdminPaymentStatus; label: string }[] = [
    { value: "pending", label: "Pending" },
    { value: "processing", label: "Processing" },
    { value: "success", label: "Paid" },
    { value: "failed", label: "Failed" },
    { value: "cancelled", label: "Cancelled" },
];

const getCustomerDisplayName = (customer: ShopAdminOrderCustomer): string => {
    const fullName = `${customer.first_name || ""} ${customer.last_name || ""}`.trim();
    return fullName || customer.username || "Customer";
};

function OrdersLoadingSkeleton() {
    return (
        <div className="space-y-4" aria-label="Loading orders">
            {/* Desktop Table Skeleton */}
            <div className="hidden overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-xs md:block">
                <div className="animate-pulse space-y-4">
                    <div className="h-6 w-1/4 rounded bg-slate-200" />
                    <div className="space-y-3 pt-4">
                        {[1, 2, 3, 4, 5].map((index) => (
                            <div
                                key={index}
                                className="flex items-center justify-between border-b border-slate-100 pb-3"
                            >
                                <div className="h-5 w-24 rounded bg-slate-200" />
                                <div className="h-5 w-32 rounded bg-slate-200" />
                                <div className="h-5 w-36 rounded bg-slate-200" />
                                <div className="h-5 w-24 rounded bg-slate-200" />
                                <div className="h-5 w-20 rounded bg-slate-200" />
                                <div className="h-6 w-20 rounded-full bg-slate-200" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Mobile Card Skeleton */}
            <div className="space-y-3 md:hidden">
                {[1, 2, 3].map((index) => (
                    <div
                        key={index}
                        className="animate-pulse rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-xs"
                    >
                        <div className="flex items-center justify-between pb-3">
                            <div className="h-5 w-28 rounded bg-slate-200" />
                            <div className="h-5 w-20 rounded-full bg-slate-200" />
                        </div>
                        <div className="space-y-2 py-3">
                            <div className="h-4 w-3/4 rounded bg-slate-200" />
                            <div className="h-4 w-1/2 rounded bg-slate-200" />
                        </div>
                        <div className="flex items-center justify-between pt-3">
                            <div className="h-5 w-16 rounded bg-slate-200" />
                            <div className="h-7 w-20 rounded-lg bg-slate-200" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function ShopOrders() {
    const navigate = useNavigate();

    const [searchInput, setSearchInput] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [status, setStatus] = useState<ShopAdminOrderStatus | "">("");
    const [paymentStatus, setPaymentStatus] = useState<ShopAdminPaymentStatus | "">("");
    const [page, setPage] = useState(1);

    // 400ms debounce for search input
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchInput.trim());
            setPage(1);
        }, 400);

        return () => clearTimeout(timer);
    }, [searchInput]);

    const handleSearchSubmit = (e: FormEvent) => {
        e.preventDefault();
        setDebouncedSearch(searchInput.trim());
        setPage(1);
    };

    const handleStatusChange = (newStatus: ShopAdminOrderStatus | "") => {
        setStatus(newStatus);
        setPage(1);
    };

    const handlePaymentStatusChange = (newPaymentStatus: ShopAdminPaymentStatus | "") => {
        setPaymentStatus(newPaymentStatus);
        setPage(1);
    };

    const handleResetFilters = () => {
        setSearchInput("");
        setDebouncedSearch("");
        setStatus("");
        setPaymentStatus("");
        setPage(1);
    };

    const hasActiveFilters = Boolean(debouncedSearch || status || paymentStatus);

    const filters = useMemo<ShopAdminOrderFilters>(
        () => ({
            search: debouncedSearch || undefined,
            status: status || undefined,
            payment_status: paymentStatus || undefined,
            page,
        }),
        [debouncedSearch, status, paymentStatus, page]
    );

    const { data, isPending, isError, isFetching, error, refetch } =
        useShopAdminOrders(filters);

    const totalOrders = data?.count ?? 0;
    const totalPages = Math.max(1, Math.ceil(totalOrders / PAGE_SIZE));
    const startRecord = totalOrders > 0 ? (page - 1) * PAGE_SIZE + 1 : 0;
    const endRecord = Math.min(page * PAGE_SIZE, totalOrders);
    const orders = data?.results ?? [];

    return (
        <div className="space-y-6">
            {/* Header Card */}
            <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-xs sm:p-8">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-[#2563EB]">
                            <ShoppingCart className="h-6 w-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">
                                Order Management
                            </h2>
                            <p className="text-sm text-slate-500">
                                Track customer orders, monitor fulfillment stages, and update garment readiness.
                            </p>
                        </div>
                    </div>
                    {data && (
                        <div className="flex items-center gap-2 self-start rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 py-2 text-sm sm:self-auto">
                            <span className="text-slate-500">Total Orders:</span>
                            <span className="font-bold text-slate-900">{totalOrders}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Search and Filters Card */}
            <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-xs sm:p-6">
                <form onSubmit={handleSearchSubmit} className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-12">
                        {/* Search Bar */}
                        <div className="relative sm:col-span-2 lg:col-span-5">
                            <label htmlFor="order-search" className="sr-only">
                                Search orders
                            </label>
                            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <Input
                                id="order-search"
                                type="text"
                                placeholder="Search by order #, customer name, phone..."
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value)}
                                className="h-10 border-slate-200 pl-10 pr-9 text-sm focus-visible:ring-[#2563EB]"
                            />
                            {searchInput && (
                                <button
                                    type="button"
                                    onClick={() => setSearchInput("")}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                                    aria-label="Clear search input"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            )}
                        </div>

                        {/* Order Status Select */}
                        <div className="lg:col-span-3">
                            <label htmlFor="order-status-filter" className="sr-only">
                                Filter by order status
                            </label>
                            <select
                                id="order-status-filter"
                                value={status}
                                onChange={(e) =>
                                    handleStatusChange(
                                        e.target.value as ShopAdminOrderStatus | ""
                                    )
                                }
                                className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-[#2563EB] focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
                            >
                                <option value="">All Order Statuses</option>
                                {ORDER_STATUS_OPTIONS.map((opt) => (
                                    <option key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Payment Status Select */}
                        <div className="lg:col-span-3">
                            <label htmlFor="payment-status-filter" className="sr-only">
                                Filter by payment status
                            </label>
                            <select
                                id="payment-status-filter"
                                value={paymentStatus}
                                onChange={(e) =>
                                    handlePaymentStatusChange(
                                        e.target.value as ShopAdminPaymentStatus | ""
                                    )
                                }
                                className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-[#2563EB] focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
                            >
                                <option value="">All Payment Statuses</option>
                                {PAYMENT_STATUS_OPTIONS.map((opt) => (
                                    <option key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Reset Button */}
                        <div className="flex items-center sm:col-span-2 lg:col-span-1">
                            {hasActiveFilters && (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={handleResetFilters}
                                    className="h-10 w-full px-2.5 text-xs font-semibold text-slate-500 hover:text-slate-900"
                                >
                                    <RotateCcw className="mr-1 h-3.5 w-3.5" />
                                    Reset
                                </Button>
                            )}
                        </div>
                    </div>
                </form>
            </div>

            {/* Content Area */}
            {isPending ? (
                <OrdersLoadingSkeleton />
            ) : isError ? (
                <div
                    className="rounded-2xl border border-rose-200 bg-rose-50/50 p-8 text-center"
                    role="alert"
                >
                    <AlertCircle className="mx-auto h-8 w-8 text-rose-500" />
                    <h3 className="mt-3 text-base font-semibold text-slate-900">
                        Failed to load orders
                    </h3>
                    <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
                        {getApiErrorMessage(
                            error,
                            "An unexpected error occurred while fetching orders. Please try again."
                        )}
                    </p>
                    <Button
                        type="button"
                        onClick={() => void refetch()}
                        disabled={isFetching}
                        className="mt-4 bg-[#2563EB] hover:bg-blue-700"
                    >
                        <RefreshCw
                            className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`}
                        />
                        {isFetching ? "Retrying..." : "Try Again"}
                    </Button>
                </div>
            ) : totalOrders === 0 ? (
                hasActiveFilters ? (
                    /* No Results matching current filters */
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center shadow-xs">
                        <Filter className="mx-auto h-10 w-10 text-slate-300" />
                        <h3 className="mt-3 text-base font-bold text-slate-900">
                            No matching orders found
                        </h3>
                        <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
                            No orders match your current search or filter criteria. Try adjusting your query or filters.
                        </p>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleResetFilters}
                            className="mt-4 border-slate-200 text-slate-700 hover:bg-slate-50"
                        >
                            Clear All Filters
                        </Button>
                    </div>
                ) : (
                    /* Empty State: zero orders in shop */
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center shadow-xs">
                        <ShoppingCart className="mx-auto h-12 w-12 text-slate-300" />
                        <h3 className="mt-4 text-base font-bold text-slate-900">
                            No orders yet
                        </h3>
                        <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
                            Orders will appear here once customers place requests for dry cleaning services with your shop.
                        </p>
                    </div>
                )
            ) : (
                <div className="space-y-4">
                    {/* Desktop Table View */}
                    <div className="hidden overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-xs md:block">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm text-slate-600">
                                <thead className="border-b border-slate-200 bg-slate-50/75 text-xs font-semibold uppercase tracking-wider text-slate-500">
                                    <tr>
                                        <th scope="col" className="whitespace-nowrap px-6 py-3.5">
                                            Order #
                                        </th>
                                        <th scope="col" className="whitespace-nowrap px-6 py-3.5">
                                            Date
                                        </th>
                                        <th scope="col" className="px-6 py-3.5">
                                            Customer
                                        </th>
                                        <th scope="col" className="whitespace-nowrap px-6 py-3.5">
                                            Items Summary
                                        </th>
                                        <th scope="col" className="whitespace-nowrap px-6 py-3.5 text-right">
                                            Total Amount
                                        </th>
                                        <th scope="col" className="whitespace-nowrap px-6 py-3.5">
                                            Payment
                                        </th>
                                        <th scope="col" className="whitespace-nowrap px-6 py-3.5">
                                            Status
                                        </th>
                                        <th scope="col" className="whitespace-nowrap px-6 py-3.5 text-right">
                                            Action
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {orders.map((order) => {
                                        const customerName = getCustomerDisplayName(order.customer);
                                        return (
                                            <tr
                                                key={order.id}
                                                onClick={() => navigate(`/shop-admin/orders/${order.id}`)}
                                                className="group cursor-pointer transition-colors hover:bg-slate-50/80"
                                            >
                                                <td className="whitespace-nowrap px-6 py-4 font-bold text-[#2563EB] group-hover:underline">
                                                    {order.order_number}
                                                </td>
                                                <td className="whitespace-nowrap px-6 py-4 text-slate-600">
                                                    <div className="font-medium text-slate-900">
                                                        {formatOrderDate(order.created_at)}
                                                    </div>
                                                    {/* <div className="text-xs text-slate-400">
                                                        {formatOrderTime(order.created_at)}
                                                    </div> */}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div
                                                        className="max-w-[220px] truncate font-semibold text-slate-900"
                                                        title={customerName}
                                                    >
                                                        {customerName}
                                                    </div>
                                                </td>
                                                <td className="whitespace-nowrap px-6 py-4 text-slate-600">
                                                    <div className="font-medium text-slate-800">
                                                        {order.items_count}{" "}
                                                        {order.items_count === 1 ? "garment" : "garments"}
                                                    </div>
                                                    {/* <div className="text-xs text-slate-400">
                                                        {order.services_count}{" "}
                                                        {order.services_count === 1 ? "service" : "services"}
                                                    </div> */}
                                                </td>
                                                <td className="whitespace-nowrap px-6 py-4 text-right font-bold text-slate-900 tabular-nums">
                                                    {formatOrderAmount(order.total_amount)}
                                                </td>
                                                <td className="whitespace-nowrap px-6 py-4">
                                                    <PaymentStatusBadge status={order.payment_status} />
                                                </td>
                                                <td className="whitespace-nowrap px-6 py-4">
                                                    <OrderStatusBadge status={order.order_status} />
                                                </td>
                                                <td className="whitespace-nowrap px-6 py-4 text-right">
                                                    <Link
                                                        to={`/shop-admin/orders/${order.id}`}
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-[#2563EB] hover:bg-blue-50 hover:text-[#2563EB]"
                                                    >
                                                        <span>View</span>
                                                        <ChevronRight className="h-3.5 w-3.5" />
                                                    </Link>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Desktop Pagination */}
                        <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-100 px-6 py-4 sm:flex-row">
                            <div className="text-xs text-slate-500">
                                Showing{" "}
                                <span className="font-semibold text-slate-800">{startRecord}</span> to{" "}
                                <span className="font-semibold text-slate-800">{endRecord}</span> of{" "}
                                <span className="font-semibold text-slate-800">{totalOrders}</span> orders
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    disabled={page <= 1 || isFetching}
                                    onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                                    className="h-8 border-slate-200 text-xs"
                                >
                                    <ChevronLeft className="mr-1 h-3.5 w-3.5" />
                                    Previous
                                </Button>
                                <span className="px-2 text-xs font-medium text-slate-600">
                                    Page {page} of {totalPages}
                                </span>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    disabled={!data?.next || page >= totalPages || isFetching}
                                    onClick={() => setPage((prev) => prev + 1)}
                                    className="h-8 border-slate-200 text-xs"
                                >
                                    Next
                                    <ChevronRight className="ml-1 h-3.5 w-3.5" />
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Mobile Card View */}
                    <div className="space-y-3 md:hidden">
                        {orders.map((order) => (
                            <div
                                key={order.id}
                                onClick={() => navigate(`/shop-admin/orders/${order.id}`)}
                                className="cursor-pointer rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-xs transition hover:border-slate-300"
                            >
                                <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
                                    <div>
                                        <span className="font-bold text-[#2563EB]">
                                            {order.order_number}
                                        </span>
                                        <div className="text-xs text-slate-400">
                                            {formatOrderDateTime(order.created_at)}
                                        </div>
                                    </div>
                                    <OrderStatusBadge status={order.order_status} />
                                </div>

                                <div className="mt-3 space-y-2 text-xs text-slate-600">
                                    <div className="flex items-center justify-between gap-3">
                                        <span className="text-slate-400">Customer:</span>
                                        <span className="max-w-[200px] truncate font-medium text-slate-900">
                                            {getCustomerDisplayName(order.customer)}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-slate-400">Garments:</span>
                                        <span className="font-medium text-slate-700">
                                            {order.items_count} items ({order.services_count}{" "}
                                            {order.services_count === 1 ? "service" : "services"})
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-slate-400">Payment:</span>
                                        <PaymentStatusBadge status={order.payment_status} />
                                    </div>
                                </div>

                                <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
                                    <div>
                                        <span className="text-xs text-slate-400">Total:</span>{" "}
                                        <span className="text-base font-bold text-slate-900">
                                            {formatOrderAmount(order.total_amount)}
                                        </span>
                                    </div>
                                    <Link
                                        to={`/shop-admin/orders/${order.id}`}
                                        onClick={(e) => e.stopPropagation()}
                                        className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-bold text-[#2563EB] hover:bg-blue-100"
                                    >
                                        <span>Details</span>
                                        <ChevronRight className="h-3.5 w-3.5" />
                                    </Link>
                                </div>
                            </div>
                        ))}

                        {/* Mobile Pagination */}
                        <div className="flex flex-col items-center justify-between gap-3 rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-xs">
                            <div className="text-xs text-slate-500">
                                Showing{" "}
                                <span className="font-semibold text-slate-800">{startRecord}</span> to{" "}
                                <span className="font-semibold text-slate-800">{endRecord}</span> of{" "}
                                <span className="font-semibold text-slate-800">{totalOrders}</span> orders
                            </div>
                            <div className="flex w-full items-center justify-between gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    disabled={page <= 1 || isFetching}
                                    onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                                    className="flex-1 border-slate-200 text-xs"
                                >
                                    <ChevronLeft className="mr-1 h-3.5 w-3.5" />
                                    Previous
                                </Button>
                                <span className="px-2 text-xs font-medium text-slate-600">
                                    {page} / {totalPages}
                                </span>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    disabled={!data?.next || page >= totalPages || isFetching}
                                    onClick={() => setPage((prev) => prev + 1)}
                                    className="flex-1 border-slate-200 text-xs"
                                >
                                    Next
                                    <ChevronRight className="ml-1 h-3.5 w-3.5" />
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default ShopOrders;
