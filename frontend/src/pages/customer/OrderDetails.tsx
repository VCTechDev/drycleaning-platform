import { useEffect, useState } from "react";
import {
    ArrowLeft,
    CheckCircle2,
    Hash,
    MapPin,
    Package,
    Store,
    XCircle,
} from "lucide-react";
import { Link, useParams } from "react-router-dom";

import { Card } from "@/components/ui/card";
import GarmentImage from "@/components/order/GarmentImage";

import {
    getOrderDetail,
    type CustomerOrderDetail,
} from "../../services/orderService";
import {
    formatOrderAmount,
    formatOrderDate,
    getOrderStatusMeta,
} from "../../lib/orderDisplay";

const getShopLocation = (order: CustomerOrderDetail) => {
    const location = [
        order.shop_city,
        order.shop_district,
        order.shop_state,
    ].filter(Boolean);

    return location.length > 0 ? location.join(", ") : "Location unavailable";
};

function OrderDetailSkeleton() {
    return (
        <div className="min-h-full bg-[#F5F9FF]">
            <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-7 sm:px-6 sm:pt-9 lg:px-8 lg:pb-20">
                <div className="h-4 w-28 animate-pulse rounded bg-[#E9EFF7]" />
                <div className="mt-5 h-9 w-56 animate-pulse rounded bg-[#E9EFF7]" />
                <div className="mt-3 h-5 w-80 animate-pulse rounded bg-[#E9EFF7]" />

                <div className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(300px,0.85fr)]">
                    <div className="space-y-5">
                        <div className="h-36 animate-pulse rounded-[22px] bg-white shadow-sm" />
                        <div className="h-[520px] animate-pulse rounded-[22px] bg-white shadow-sm" />
                    </div>
                    <div className="space-y-5">
                        <div className="h-72 animate-pulse rounded-[22px] bg-white shadow-sm" />
                        <div className="h-64 animate-pulse rounded-[22px] bg-white shadow-sm" />
                    </div>
                </div>
            </div>
        </div>
    );
}

function OrderDetails() {
    const { id } = useParams();
    const [order, setOrder] = useState<CustomerOrderDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        const fetchOrder = async () => {
            if (!id) {
                setError("This order could not be identified.");
                setLoading(false);
                return;
            }

            try {
                const data = await getOrderDetail(id);

                setOrder(data);
            } catch (orderError) {
                console.error("Failed to fetch order:", orderError);
                setError(
                    "Unable to load this order right now. Please try again."
                );
            } finally {
                setLoading(false);
            }
        };

        fetchOrder();
    }, [id]);

    if (loading) {
        return <OrderDetailSkeleton />;
    }

    if (error || !order) {
        return (
            <div className="min-h-full bg-[#F5F9FF]">
                <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-7 sm:px-6 sm:pt-9 lg:px-8 lg:pb-20">
                    <Card className="rounded-[22px] border border-red-100 bg-white px-6 py-12 text-center shadow-sm">
                        <h1 className="font-heading text-2xl font-semibold text-[#10194A]">
                            Order details unavailable
                        </h1>

                        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#647092]">
                            {error || "We could not find this order."}
                        </p>
                    </Card>
                </div>
            </div>
        );
    }

    const shopLocation = getShopLocation(order);
    const items = Array.isArray(order.items) ? order.items : [];
    const isDelivered = order.order_status === "delivered";
    const isCancelled = order.order_status === "cancelled";
    const statusMeta = getOrderStatusMeta(order.order_status);
    const pickupAddress = order.pickup_address_line?.trim() || "Address unavailable";
    const pickupDetails = [
        order.pickup_city,
        order.pickup_state,
        order.pickup_pincode,
    ].filter(Boolean);

    return (
        <div className="min-h-full bg-[#F5F9FF]">
            <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-7 sm:px-6 sm:pt-9 lg:px-8 lg:pb-20">
                <header>
                    <Link
                        to="/customer/orders"
                        className="inline-flex items-center gap-2 text-sm font-medium text-primary transition hover:text-[#10194A]"
                    >
                        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                        Back to Orders
                    </Link>

                    

                    {/* <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#647092]">
                                Order Details
                            </p>

                            <h1 className="mt-2 font-heading text-3xl font-semibold tracking-tight text-[#10194A] sm:text-4xl">
                                {order.order_number}
                            </h1>

                            <p className="mt-2 text-sm text-[#647092]">
                                Placed on {formatOrderDate(order.created_at)}
                            </p>
                        </div>

                        
                    </div> */}
                </header>

                <div className="mt-0 grid gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(300px,0.85fr)]">
                    <main className="space-y-5">
                        <Card className="gap-0 rounded-[22px] border border-[#E3E8F2] bg-white py-0 shadow-sm">
                            <div className="border-b border-[#EEF2F7] px-5 py-5 sm:px-6">
                                <h2 className="font-heading text-xl font-semibold text-[#10194A]">
                                    Shop
                                </h2>
                            </div>

                            <div className="flex items-start gap-4 px-5 py-5 sm:px-6">
                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#EDF5FF] text-primary">
                                    <Store className="h-5 w-5" aria-hidden="true" />
                                </div>

                                <div className="min-w-0">
                                    <h3 className="font-heading text-lg font-semibold text-[#10194A]">
                                        {order.shop || "Shop unavailable"}
                                    </h3>

                                    <p className="mt-1 flex items-start gap-1.5 text-sm text-[#647092]">
                                        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                                        {shopLocation}
                                    </p>
                                </div>
                            </div>
                        </Card>

                        <Card className="gap-0 rounded-[22px] border border-[#E3E8F2] bg-white py-0 shadow-sm">
                            <div className="border-b border-[#EEF2F7] px-5 py-5 sm:px-6">
                                <h2 className="font-heading text-xl font-semibold text-[#10194A]">
                                    Order Items
                                </h2>

                                <p className="mt-1 text-sm text-[#647092]">
                                    {items.length} item record
                                    {items.length === 1 ? "" : "s"}
                                </p>
                            </div>

                            <div className="divide-y divide-[#EEF2F7] px-5 sm:px-6">
                                {items.length === 0 ? (
                                    <p className="py-8 text-sm text-[#647092]">
                                        No item details available.
                                    </p>
                                ) : items.map((item, index) => (
                                    <div
                                        key={`${item.garment}-${item.service}-${index}`}
                                        className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center"
                                    >
                                        <div className="flex min-w-0 flex-1 items-center gap-3">
                                            <GarmentImage
                                                src={item.garment_image}
                                                alt={item.garment || "Garment"}
                                                className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[#EDF2F8] object-cover"
                                            />

                                            <div className="min-w-0">
                                                <p className="break-words text-sm font-semibold text-[#10194A]">
                                                    {item.service || "Service unavailable"}
                                                </p>

                                                <p className="mt-1 break-words text-sm text-[#647092]">
                                                    {item.garment || "Garment unavailable"}
                                                </p>

                                                <p className="mt-1 text-xs text-[#7B879B]">
                                                    Qty {item.quantity ?? "Not available"}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4 pl-[76px] text-sm sm:w-56 sm:shrink-0 sm:pl-0 sm:text-right">
                                            <div>
                                                <p className="text-xs text-[#7B879B]">
                                                    Unit price
                                                </p>

                                                <p className="mt-1 font-medium text-[#10194A]">
                                                    {formatOrderAmount(item.unit_price)}
                                                </p>
                                            </div>

                                            <div>
                                                <p className="text-xs text-[#7B879B]">
                                                    Line total
                                                </p>

                                                <p className="mt-1 font-semibold text-[#10194A]">
                                                    {formatOrderAmount(item.line_total)}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="space-y-3 border-t border-[#EEF2F7] px-5 py-5 sm:px-6">
                                <div className="flex items-center justify-between gap-4 text-sm text-[#647092]">
                                    <span>Items subtotal</span>
                                    <span className="font-medium text-[#10194A]">
                                        {formatOrderAmount(order.total_amount)}
                                    </span>
                                </div>

                                <div className="flex items-center justify-between gap-4 text-sm text-[#647092]">
                                    <span>Pickup &amp; Delivery</span>
                                    <span className="text-right text-xs text-[#7B879B]">
                                        Not provided
                                    </span>
                                </div>

                                <div className="flex items-center justify-between gap-4 border-t border-[#EEF2F7] pt-4">
                                    <span className="font-semibold text-[#10194A]">
                                        Total
                                    </span>
                                    <span className="text-xl font-semibold text-[#10194A]">
                                        {formatOrderAmount(order.total_amount)}
                                    </span>
                                </div>
                            </div>
                        </Card>
                    </main>

                    <aside className="space-y-5">

                        


                        <Card className="gap-0 rounded-[22px] border border-[#E3E8F2] bg-white py-0 shadow-sm">
                            <div className="border-b border-[#EEF2F7] px-5 py-5 sm:px-6">
                                <h2 className="font-heading text-xl font-semibold text-[#10194A]">
                                    Order Summary
                                </h2>
                            </div>

                            <div className="space-y-5 px-5 py-5 sm:px-6">
                                <div className="flex items-start gap-3">
                                    <Hash className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                                    <div>
                                        <p className="text-xs text-[#7B879B]">
                                            Order Number
                                        </p>
                                        <p className="mt-1 font-semibold text-[#10194A]">
                                            {order.order_number}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3">
                                    <Package className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                                    <div>
                                        <p className="text-xs text-[#7B879B]">
                                            Placed On
                                        </p>
                                        <p className="mt-1 font-semibold text-[#10194A]">
                                            {formatOrderDate(order.created_at)}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3">
                                    <Store className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                                    <div>
                                        <p className="text-xs text-[#7B879B]">
                                            Shop
                                        </p>
                                        <p className="mt-1 font-semibold text-[#10194A]">
                                            {order.shop || "Shop unavailable"}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3">
                                    {isCancelled ? (
                                        <XCircle
                                            className="mt-0.5 h-4 w-4 shrink-0 text-red-600"
                                            aria-hidden="true"
                                        />
                                    ) : (
                                        <CheckCircle2
                                            className="mt-0.5 h-4 w-4 shrink-0 text-[#278251]"
                                            aria-hidden="true"
                                        />
                                    )}
                                    <div>
                                        <p className="text-xs text-[#7B879B]">
                                            Status
                                        </p>
                                        <p className="mt-1 font-semibold text-[#278251]">
                                            {statusMeta.label}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </Card>


                        {isDelivered && (
                            <Card className="gap-0 rounded-[22px] border border-[#BFE7CC] bg-[#F2FBF5] px-5 py-7 text-center shadow-sm sm:px-6">
                                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#DDF4E5] text-[#278251]">
                                    <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
                                </div>

                                <h2 className="mt-4 font-heading text-xl font-semibold text-[#19683F]">
                                    Order Delivered
                                </h2>

                                <p className="mt-2 text-sm leading-6 text-[#4D7F63]">
                                    Your order has been delivered successfully.
                                </p>
                            </Card>
                        )}

                        {isCancelled && (
                            <Card className="gap-0 rounded-[22px] border border-red-100 bg-red-50/60 px-5 py-7 text-center shadow-sm sm:px-6">
                                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600">
                                    <XCircle
                                        className="h-6 w-6"
                                        aria-hidden="true"
                                    />
                                </div>

                                <h2 className="mt-4 font-heading text-xl font-semibold text-red-800">
                                    Order Cancelled
                                </h2>

                                <p className="mt-2 text-sm leading-6 text-red-700">
                                    This order has been cancelled.
                                </p>
                            </Card>
                        )}

                        {/* <Card className="gap-0 rounded-[22px] border border-[#E3E8F2] bg-white py-0 shadow-sm">
                            <div className="border-b border-[#EEF2F7] px-5 py-5 sm:px-6">
                                <h2 className="font-heading text-xl font-semibold text-[#10194A]">
                                    Pickup Address
                                </h2>
                            </div>

                            <div className="space-y-1 px-5 py-5 text-sm leading-6 text-[#647092] sm:px-6">
                                <p className="font-medium text-[#10194A]">
                                    {pickupAddress}
                                </p>
                                {pickupDetails.length > 0 ? (
                                    pickupDetails.map((detail) => (
                                        <p key={detail}>{detail}</p>
                                    ))
                                ) : (
                                    <p>Address details unavailable</p>
                                )}
                            </div>
                        </Card> */}

                        
                    </aside>
                </div>
            </div>
        </div>
    );
}

export default OrderDetails;
