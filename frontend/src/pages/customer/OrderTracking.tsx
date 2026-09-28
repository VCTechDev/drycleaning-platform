import { useEffect, useState } from "react";
import { Check, Clock3, MapPin, Package, XCircle } from "lucide-react";
import { useParams } from "react-router-dom";

import { Card } from "@/components/ui/card";

import {
    getOrderDetail,
    getOrderTracking,
    type CustomerOrderDetail,
    type CustomerOrderTracking,
    type OrderTrackingItem,
} from "../../services/orderService";
import {
    formatOrderDateTime,
    getOrderStatusMeta,
} from "../../lib/orderDisplay";

function TrackingSkeleton() {
    return (
        <div className="min-h-full bg-[#F5F9FF]">
            <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-7 sm:px-6 sm:pt-9 lg:px-8 lg:pb-20">
                <div className="h-9 w-52 animate-pulse rounded bg-[#E9EFF7]" />
                <div className="mt-3 h-5 w-72 animate-pulse rounded bg-[#E9EFF7]" />

                <div className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(300px,0.85fr)]">
                    <div className="h-[520px] animate-pulse rounded-[22px] bg-white shadow-sm" />
                    <div className="h-[360px] animate-pulse rounded-[22px] bg-white shadow-sm" />
                </div>
            </div>
        </div>
    );
}

function TrackingTimeline({
    items,
}: {
    items: OrderTrackingItem[];
}) {
    return (
        <div className="mt-7">
            {items.map((item, index) => {
                const timestamp = formatOrderDateTime(item.created_at);
                const isLast = index === items.length - 1;

                return (
                    <div
                        key={`${item.status}-${index}`}
                        className="relative flex gap-4 pb-8 last:pb-0"
                    >
                        {!isLast && (
                            <div
                                className={`absolute left-[15px] top-8 h-[calc(100%-8px)] w-px ${item.completed ? "bg-[#A9D6C0]" : "bg-[#DCE5F0]"}`}
                            />
                        )}

                        <div
                            className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 ${item.current
                                    ? "border-primary bg-primary text-white ring-4 ring-[#DCEEFF]"
                                    : item.completed
                                        ? "border-[#5DB483] bg-[#E8F7EE] text-[#278251]"
                                        : item.status === "cancelled"
                                            ? "border-red-300 bg-red-50 text-red-600"
                                            : "border-[#DCE5F0] bg-white text-[#9AA7BB]"
                                }`}
                        >
                            {item.status === "cancelled" ? (
                                <XCircle className="h-4 w-4" aria-hidden="true" />
                            ) : item.completed ? (
                                <Check className="h-4 w-4" aria-hidden="true" />
                            ) : (
                                <Clock3 className="h-4 w-4" aria-hidden="true" />
                            )}
                        </div>

                        <div className="min-w-0 flex-1 pt-0.5">
                            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                                <h3
                                    className={`font-semibold ${item.current ? "text-primary" : item.completed ? "text-[#10194A]" : "text-[#7B879B]"}`}
                                >
                                    {getOrderStatusMeta(item.status).label}
                                </h3>

                                {timestamp && (
                                    <time className="text-xs text-[#7B879B] sm:text-right">
                                        {timestamp}
                                    </time>
                                )}
                            </div>

                            <p className="mt-1 text-sm text-[#7B879B]">
                                {item.current
                                    ? "Current status"
                                    : item.completed
                                        ? "Completed"
                                        : "Upcoming"}
                            </p>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function OrderInformation({
    tracking,
    order,
}: {
    tracking: CustomerOrderTracking;
    order: CustomerOrderDetail | null;
}) {
    const placedDate = formatOrderDateTime(order?.created_at ?? null);
    const pickupLocation = order
        ? [order.pickup_city, order.pickup_district]
            .filter(Boolean)
            .join(", ") || "Location unavailable"
        : "Location unavailable";

    return (
        <Card className="gap-0 rounded-[22px] border border-[#E3E8F2] bg-white py-0 shadow-sm">
            <div className="border-b border-[#EEF2F7] px-5 py-5 sm:px-6">
                <h2 className="font-heading text-xl font-semibold text-[#10194A]">
                    Order Information
                </h2>

                <p className="mt-1 text-sm text-[#647092]">
                    Details for this order
                </p>
            </div>

            <div className="space-y-5 px-5 py-5 sm:px-6">
                <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#EDF5FF] text-primary">
                        <Package className="h-4 w-4" aria-hidden="true" />
                    </div>

                    <div>
                        <p className="text-xs font-medium uppercase tracking-[0.14em] text-[#7B879B]">
                            Order number
                        </p>

                        <p className="mt-1 font-semibold text-[#10194A]">
                            {tracking.order_number}
                        </p>
                    </div>
                </div>

                <div className="grid gap-4 border-t border-[#EEF2F7] pt-5 sm:grid-cols-2 lg:grid-cols-1">
                    <div>
                        <p className="text-xs font-medium uppercase tracking-[0.14em] text-[#7B879B]">
                            Status
                        </p>

                        <p className="mt-1 font-semibold text-primary">
                            {getOrderStatusMeta(tracking.order_status).label}
                        </p>
                    </div>

                    <div>
                        <p className="text-xs font-medium uppercase tracking-[0.14em] text-[#7B879B]">
                            Shop
                        </p>

                        <p className="mt-1 font-semibold text-[#10194A]">
                            {order?.shop ?? "Not available"}
                        </p>
                    </div>

                    <div>
                        <p className="text-xs font-medium uppercase tracking-[0.14em] text-[#7B879B]">
                            Pickup location
                        </p>

                        <p className="mt-1 flex items-start gap-1.5 font-semibold text-[#10194A]">
                            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                            {pickupLocation}
                        </p>
                    </div>

                    <div>
                        <p className="text-xs font-medium uppercase tracking-[0.14em] text-[#7B879B]">
                            Total amount
                        </p>

                        <p className="mt-1 font-semibold text-[#10194A]">
                            {order ? `₹${order.total_amount}` : "Not available"}
                        </p>
                    </div>

                    <div>
                        <p className="text-xs font-medium uppercase tracking-[0.14em] text-[#7B879B]">
                            Placed on
                        </p>

                        <p className="mt-1 font-semibold text-[#10194A]">
                            {placedDate ?? "Not available"}
                        </p>
                    </div>
                </div>
            </div>
        </Card>
    );
}

function OrderTracking() {
    const { id } = useParams();
    const [tracking, setTracking] = useState<CustomerOrderTracking | null>(
        null
    );
    const [order, setOrder] = useState<CustomerOrderDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        const fetchTracking = async () => {
            if (!id) {
                setError("This order could not be identified.");
                setLoading(false);
                return;
            }

            try {
                const trackingData = await getOrderTracking(id);

                if (
                    !trackingData ||
                    !Array.isArray(trackingData.tracking) ||
                    trackingData.tracking.length === 0
                ) {
                    throw new Error("Tracking data is unavailable.");
                }

                setTracking(trackingData);

                try {
                    const orderData = await getOrderDetail(id);

                    setOrder(orderData);
                } catch (detailError) {
                    console.error(
                        "Failed to fetch order information:",
                        detailError
                    );
                }
            } catch (trackingError) {
                console.error("Failed to fetch tracking:", trackingError);
                setError(
                    "Unable to load tracking information right now. Please try again."
                );
            } finally {
                setLoading(false);
            }
        };

        fetchTracking();
    }, [id]);

    if (loading) {
        return <TrackingSkeleton />;
    }

    if (error || !tracking) {
        return (
            <div className="min-h-full bg-[#F5F9FF]">
                <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-7 sm:px-6 sm:pt-9 lg:px-8 lg:pb-20">
                    <Card className="rounded-[22px] border border-red-100 bg-white px-6 py-12 text-center shadow-sm">
                        <h1 className="font-heading text-2xl font-semibold text-[#10194A]">
                            Tracking information unavailable
                        </h1>

                        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#647092]">
                            {error || "We could not find this order."}
                        </p>
                    </Card>
                </div>
            </div>
        );
    }

    const isCancelled =
        tracking.order_status === "cancelled" ||
        tracking.tracking.some((item) => item.status === "cancelled");
    const timelineItems = isCancelled
        ? tracking.tracking.filter((item) => item.status === "cancelled")
        : tracking.tracking.filter((item) => item.status !== "cancelled");

    return (
        <div className="min-h-full bg-[#F5F9FF]">
            <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-7 sm:px-6 sm:pt-9 lg:px-8 lg:pb-20">
                <div>
                    <p className="text-sm font-medium text-primary">
                        Order tracking
                    </p>

                    <h1 className="mt-1 font-heading text-3xl font-semibold tracking-tight text-[#10194A] sm:text-4xl">
                        {tracking.order_number}
                    </h1>

                    <p className="mt-2 text-sm text-[#647092] sm:text-base">
                        Follow the progress of your order.
                    </p>
                </div>

                <div className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(300px,0.85fr)]">
                    <Card className="gap-0 rounded-[22px] border border-[#E3E8F2] bg-white py-0 shadow-sm">
                        <div className="border-b border-[#EEF2F7] px-5 py-5 sm:px-6">
                            <h2 className="font-heading text-xl font-semibold text-[#10194A]">
                                Order Progress
                            </h2>

                            <p className="mt-1 text-sm text-[#647092]">
                                {isCancelled
                                    ? "This order was cancelled."
                                    : "Your order status from placement to delivery."}
                            </p>
                        </div>

                        <div className="px-5 py-5 sm:px-6">
                            <TrackingTimeline items={timelineItems} />
                        </div>
                    </Card>

                    <OrderInformation tracking={tracking} order={order} />
                </div>
            </div>
        </div>
    );
}

export default OrderTracking;
