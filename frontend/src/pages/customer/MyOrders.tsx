import { useEffect, useMemo, useState } from "react";
import {
    ArrowRight,
    MapPin,
    Package,
    Search,
    X,
} from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import GarmentImage from "@/components/order/GarmentImage";

import {
    getMyOrders,
    type CustomerOrder,
} from "../../services/orderService";
import {
    formatOrderAmount,
    formatOrderDate,
    getOrderStatusMeta,
} from "../../lib/orderDisplay";

const STATUS_OPTIONS = [
    "placed",
    "accepted",
    "pickup_scheduled",
    "picked_up",
    "processing",
    "ready",
    "delivered",
    "cancelled",
] as const;

const getSearchableText = (order: CustomerOrder) => [
    order.order_number,
    order.shop,
    order.shop_city,
    order.shop_district,
    ...(order.items ?? []).flatMap((item) => [item.garment, item.service]),
].join(" ").toLowerCase();

function OrderCard({ order }: { order: CustomerOrder }) {
    const statusMeta = getOrderStatusMeta(order.order_status);
    const isActive = !["delivered", "cancelled"].includes(
        order.order_status
    );
    const previewItems = (order.items ?? []).slice(0, 4);
    const shopLocation = [order.shop_city, order.shop_district]
        .filter(Boolean)
        .join(", ") || "Location unavailable";
    const remainingItems = Math.max(
        (order.items ?? []).length - previewItems.length,
        0
    );

    return (
        <Card className="gap-0 rounded-[22px] border border-[#E3E8F2] bg-white py-0 shadow-sm">
            <div className="flex flex-col gap-4 border-b border-[#EEF2F7] px-5 py-5 sm:flex-row sm:items-start sm:justify-between sm:px-6">
                <div>
                    <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#647092]">
                        Order
                    </p>

                    <h2 className="mt-1 font-heading text-xl font-semibold text-[#10194A]">
                        {order.order_number}
                    </h2>

                    <p className="mt-1 text-sm text-[#647092]">
                        Placed on {formatOrderDate(order.created_at)}
                    </p>
                </div>

                <span
                    className={`w-fit rounded-full px-3 py-1.5 text-xs font-semibold ${statusMeta.badgeClass}`}
                >
                    {statusMeta.label}
                </span>
            </div>

            <div className="px-5 py-5 sm:px-6">
                <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#EDF5FF] text-primary">
                        <Package className="h-4 w-4" aria-hidden="true" />
                    </div>

                    <div className="min-w-0">
                        <h3 className="break-words font-semibold text-[#10194A]">
                            {order.shop || "Shop unavailable"}
                        </h3>

                        <p className="mt-1 flex items-center gap-1 text-sm text-[#647092]">
                            <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            {shopLocation}
                        </p>
                    </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    {previewItems.map((item, index) => (
                        <div
                            key={`${item.garment}-${item.service}-${index}`}
                            className="flex min-w-0 items-center gap-3 rounded-2xl border border-[#E8EEF7] bg-[#FAFCFF] p-2.5"
                        >
                            <GarmentImage
                                src={item.garment_image}
                                alt={item.garment || "Garment"}
                                className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-[#EDF2F8] object-cover"
                            />

                            <div className="min-w-0">
                                <p className="break-words text-sm font-semibold text-[#10194A]">
                                    {item.garment || "Garment unavailable"}
                                </p>

                                <p className="break-words text-xs text-[#647092]">
                                    {item.service || "Service unavailable"} · Qty {item.quantity ?? "Not available"}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>

                {remainingItems > 0 && (
                    <p className="mt-3 text-xs font-medium text-[#647092]">
                        +{remainingItems} more item{remainingItems === 1 ? "" : "s"}
                    </p>
                )}

                <div className="mt-5 flex flex-col gap-4 border-t border-[#EEF2F7] pt-5 sm:flex-row sm:items-end sm:justify-between">
                    <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-[#647092]">
                        <span>
                            <strong className="font-semibold text-[#10194A]">
                                {order.items_count}
                            </strong>{" "}
                            item{order.items_count === 1 ? "" : "s"}
                        </span>

                        <span>
                            <strong className="font-semibold text-[#10194A]">
                                {order.services_count}
                            </strong>{" "}
                            service{order.services_count === 1 ? "" : "s"}
                        </span>

                        <span className="font-semibold text-[#10194A]">
                            {formatOrderAmount(order.total_amount)}
                        </span>
                    </div>

                    <Link
                        to={
                            isActive
                                ? `/customer/orders/${order.id}/tracking`
                                : `/customer/orders/${order.id}`
                        }
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-primary/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                    >
                        {isActive ? "Track Order" : "View Order"}
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                </div>
            </div>
        </Card>
    );
}

function OrderSkeleton() {
    return (
        <div className="rounded-[22px] border border-[#E3E8F2] bg-white p-6 shadow-sm">
            <div className="space-y-3">
                <div className="h-3 w-16 animate-pulse rounded bg-[#E9EFF7]" />
                <div className="h-6 w-36 animate-pulse rounded bg-[#E9EFF7]" />
                <div className="h-4 w-44 animate-pulse rounded bg-[#E9EFF7]" />
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {Array.from({ length: 2 }).map((_, index) => (
                    <div
                        key={index}
                        className="h-[79px] animate-pulse rounded-2xl bg-[#F0F4FA]"
                    />
                ))}
            </div>

            <div className="mt-6 h-10 animate-pulse rounded bg-[#E9EFF7]" />
        </div>
    );
}

function MyOrders() {
    const [orders, setOrders] = useState<CustomerOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState("all");

    useEffect(() => {
        const fetchOrders = async () => {
            try {
                const data = await getMyOrders();

                setOrders(data);
            } catch (error) {
                console.error("Failed to fetch orders:", error);
                setError(
                    "Unable to load your orders right now. Please try again."
                );
            } finally {
                setLoading(false);
            }
        };

        fetchOrders();
    }, []);

    const filteredOrders = useMemo(() => {
        const normalizedSearch = search.trim().toLowerCase();

        return orders.filter((order) => {
            const matchesSearch =
                normalizedSearch.length === 0 ||
                getSearchableText(order).includes(normalizedSearch);
            const matchesStatus =
                status === "all" || order.order_status === status;

            return matchesSearch && matchesStatus;
        });
    }, [orders, search, status]);

    if (loading) {
        return (
            <div className="min-h-full bg-[#F5F9FF]">
                <div className="w-full px-4 pb-16 pt-7 sm:px-6 sm:pt-9 lg:px-8 lg:pb-20">
                    <div className="h-9 w-40 animate-pulse rounded bg-[#E9EFF7]" />
                    <div className="mt-3 h-5 w-72 animate-pulse rounded bg-[#E9EFF7]" />

                    <div className="mt-8 grid gap-4">
                        {Array.from({ length: 3 }).map((_, index) => (
                            <OrderSkeleton key={index} />
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-full bg-[#F5F9FF]">
            <div className="w-full px-4 pb-16 pt-7 sm:px-6 sm:pt-9 lg:px-8 lg:pb-20">
                <section>
                    <p className="text-sm font-medium text-primary">
                        Your activity
                    </p>

                    <h1 className="mt-1 font-heading text-3xl font-semibold tracking-tight text-[#10194A] sm:text-4xl">
                        My Orders
                    </h1>

                    <p className="mt-2 text-sm text-[#647092] sm:text-base">
                        Keep track of your dry-cleaning orders in one place.
                    </p>
                </section>

                <section className="mt-7 flex flex-col gap-3 sm:flex-row">
                    <div className="relative min-w-0 flex-1">
                        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#647092]" aria-hidden="true" />

                        <Input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Search orders, shops, garments, or services"
                            className="h-11 rounded-xl border-[#D8E4F5] bg-white pl-10 pr-10 shadow-sm placeholder:text-[#8A96AF]"
                        />

                        {search && (
                            <button
                                type="button"
                                onClick={() => setSearch("")}
                                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#647092] hover:text-[#10194A]"
                                aria-label="Clear search"
                            >
                                <X className="h-4 w-4" aria-hidden="true" />
                            </button>
                        )}
                    </div>

                    <select
                        value={status}
                        onChange={(event) => setStatus(event.target.value)}
                        aria-label="Filter orders by status"
                        className="h-11 rounded-xl border border-[#D8E4F5] bg-white px-4 text-sm text-[#10194A] shadow-sm outline-none focus:ring-2 focus:ring-primary sm:w-52"
                    >
                        <option value="all">All statuses</option>

                        {STATUS_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                                {getOrderStatusMeta(option).label}
                            </option>
                        ))}
                    </select>
                </section>

                {error && (
                    <section className="mt-6 rounded-[22px] border border-red-100 bg-white px-6 py-10 text-center shadow-sm">
                        <h2 className="font-heading text-xl font-semibold text-[#10194A]">
                            We couldn&apos;t load your orders
                        </h2>

                        <p className="mt-2 text-sm text-[#647092]">{error}</p>
                    </section>
                )}

                {!error && filteredOrders.length === 0 && (
                    <section className="mt-6 rounded-[22px] border border-dashed border-[#C9D8EC] bg-white px-6 py-14 text-center shadow-sm">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#EDF5FF] text-primary">
                            <Package className="h-5 w-5" aria-hidden="true" />
                        </div>

                        <h2 className="mt-4 font-heading text-xl font-semibold text-[#10194A]">
                            {orders.length === 0
                                ? "You haven't placed any orders yet"
                                : "No matching orders"}
                        </h2>

                        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#647092]">
                            {orders.length === 0
                                ? "Your completed and active orders will appear here."
                                : "Try a different search term or status filter."}
                        </p>

                        {orders.length > 0 && (search || status !== "all") && (
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                    setSearch("");
                                    setStatus("all");
                                }}
                                className="mt-5 rounded-xl"
                            >
                                Clear search and filter
                            </Button>
                        )}
                    </section>
                )}

                {!error && filteredOrders.length > 0 && (
                    <section className="mt-6 grid gap-4">
                        {filteredOrders.map((order) => (
                            <OrderCard key={order.id} order={order} />
                        ))}
                    </section>
                )}
            </div>
        </div>
    );
}

export default MyOrders;
