import { useState, type FormEvent, useEffect } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import {
    AlertCircle,
    AlertTriangle,
    ArrowLeft,
    Calendar,
    Check,
    CheckCircle2,
    Clock3,
    CreditCard,
    FileText,
    Loader2,
    Mail,
    MapPin,
    PackageCheck,
    Phone,
    Play,
    RefreshCw,
    Sparkles,
    Truck,
    User,
    X,
} from "lucide-react";

import {
    OrderStatusBadge,
    PaymentStatusBadge,
} from "../../components/admin/orders/OrderStatusBadge";
import GarmentImage from "../../components/order/GarmentImage";
import { Button } from "../../components/ui/button";
import {
    useAcceptOrder,
    useReadyOrder,
    useRejectOrder,
    useShopAdminOrderDetail,
    useStartProcessingOrder,
} from "../../hooks/shopAdmin/useShopAdminOrders";
import { getApiErrorMessage } from "../../lib/apiError";
import {
    formatOrderAmount,
    formatOrderDateTime,
    getOrderStatusMeta,
} from "../../lib/orderDisplay";
import type {
    ShopAdminDeliveryTaskStatus,
    ShopAdminOrderCustomer,
} from "../../types/shopAdmin/orders";

const getCustomerDisplayName = (customer: ShopAdminOrderCustomer): string => {
    const fullName = `${customer.first_name || ""} ${customer.last_name || ""}`.trim();
    return fullName || customer.username || "Customer";
};

const getDeliveryTaskStatusBadge = (status: ShopAdminDeliveryTaskStatus | string) => {
    switch (status) {
        case "completed":
            return "bg-emerald-50 text-emerald-700 border-emerald-200";
        case "in_progress":
            return "bg-amber-50 text-amber-700 border-amber-200";
        case "assigned":
            return "bg-blue-50 text-blue-700 border-blue-200";
        case "failed":
        case "cancelled":
            return "bg-rose-50 text-rose-700 border-rose-200";
        default:
            return "bg-slate-100 text-slate-700 border-slate-200";
    }
};

function OrderDetailSkeleton() {
    return (
        <div className="animate-pulse space-y-6" aria-label="Loading order details">
            <div className="h-6 w-32 rounded bg-slate-200" />
            <div className="h-28 rounded-2xl bg-slate-200" />
            <div className="h-20 rounded-2xl bg-slate-200" />
            <div className="grid gap-6 lg:grid-cols-12">
                <div className="space-y-6 lg:col-span-8">
                    <div className="h-72 rounded-2xl bg-slate-200" />
                    <div className="h-48 rounded-2xl bg-slate-200" />
                </div>
                <div className="space-y-6 lg:col-span-4">
                    <div className="h-44 rounded-2xl bg-slate-200" />
                    <div className="h-44 rounded-2xl bg-slate-200" />
                    <div className="h-56 rounded-2xl bg-slate-200" />
                </div>
            </div>
        </div>
    );
}

interface RejectModalProps {
    orderNumber: string;
    onClose: () => void;
    onConfirm: (reason: string) => void;
    isPending: boolean;
    error: string | null;
}

function RejectOrderDialog({
    orderNumber,
    onClose,
    onConfirm,
    isPending,
    error,
}: RejectModalProps) {
    const [reason, setReason] = useState("");
    const [localError, setLocalError] = useState<string | null>(null);

    // Handle Escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape" && !isPending) {
                onClose();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [onClose, isPending]);

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        const trimmed = reason.trim();
        if (!trimmed) {
            setLocalError("A rejection reason is required and cannot be blank.");
            return;
        }
        if (trimmed.length > 500) {
            setLocalError("Rejection reason cannot exceed 500 characters.");
            return;
        }
        setLocalError(null);
        onConfirm(trimmed);
    };

    const displayError = localError || error;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-xs transition-opacity animate-in fade-in duration-150"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reject-order-title"
        >
            <div
                className="w-full max-w-lg rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-xl sm:p-8"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-start justify-between border-b border-slate-100 pb-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
                            <AlertTriangle className="h-5 w-5" />
                        </div>
                        <div>
                            <h2
                                id="reject-order-title"
                                className="text-lg font-bold text-slate-900"
                            >
                                Reject Order {orderNumber}
                            </h2>
                            <p className="text-xs text-slate-500">
                                This action will reject the order and notify the customer.
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isPending}
                        className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
                        aria-label="Close dialog"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="mt-5 space-y-4">
                    {displayError && (
                        <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-800">
                            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                            <span>{displayError}</span>
                        </div>
                    )}

                    <div>
                        <label
                            htmlFor="rejection-reason"
                            className="block text-xs font-semibold text-slate-700"
                        >
                            Reason for rejection <span className="text-rose-500">*</span>
                        </label>
                        <textarea
                            id="rejection-reason"
                            rows={4}
                            maxLength={500}
                            value={reason}
                            disabled={isPending}
                            onChange={(e) => {
                                setReason(e.target.value);
                                setLocalError(null);
                            }}
                            placeholder="Explain why this order cannot be accepted (e.g. capacity exceeded, unsupported garment type, scheduling conflict)..."
                            className="mt-1.5 w-full rounded-xl border border-slate-200 p-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#2563EB] focus:outline-none focus:ring-1 focus:ring-[#2563EB] disabled:bg-slate-50"
                            autoFocus
                        />
                        <div className="mt-1 flex justify-between text-xs text-slate-400">
                            <span>Maximum 500 characters</span>
                            <span className={reason.length > 480 ? "font-semibold text-amber-600" : ""}>
                                {reason.length} / 500
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onClose}
                            disabled={isPending}
                            className="border-slate-200 text-slate-700"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={isPending || !reason.trim()}
                            className="bg-rose-600 font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
                        >
                            {isPending ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Rejecting...
                                </>
                            ) : (
                                "Confirm Rejection"
                            )}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function ShopOrderDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const {
        data: order,
        isPending,
        isError,
        isFetching,
        error,
        refetch,
    } = useShopAdminOrderDetail(id);

    // Mutation hooks
    const acceptMutation = useAcceptOrder();
    const rejectMutation = useRejectOrder();
    const startProcessingMutation = useStartProcessingOrder();
    const readyMutation = useReadyOrder();

    const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
    const [actionErrorMessage, setActionErrorMessage] = useState<string | null>(null);

    const isAnyActionPending =
        acceptMutation.isPending ||
        rejectMutation.isPending ||
        startProcessingMutation.isPending ||
        readyMutation.isPending;

    const handleAccept = () => {
        if (!order || isAnyActionPending) return;
        setActionErrorMessage(null);
        acceptMutation.mutate(order.id, {
            onError: (err) => {
                setActionErrorMessage(
                    getApiErrorMessage(err, "Failed to accept order. Please try again.")
                );
            },
        });
    };

    const handleRejectConfirm = (reason: string) => {
        if (!order || isAnyActionPending) return;
        setActionErrorMessage(null);
        rejectMutation.mutate(
            { orderId: order.id, reason },
            {
                onSuccess: () => {
                    setIsRejectModalOpen(false);
                },
                onError: (err) => {
                    setActionErrorMessage(
                        getApiErrorMessage(err, "Failed to reject order. Please check the reason and try again.")
                    );
                },
            }
        );
    };

    const handleStartProcessing = () => {
        if (!order || isAnyActionPending) return;
        setActionErrorMessage(null);
        startProcessingMutation.mutate(order.id, {
            onError: (err) => {
                setActionErrorMessage(
                    getApiErrorMessage(err, "Failed to start processing order. Please try again.")
                );
            },
        });
    };

    const handleMarkReady = () => {
        if (!order || isAnyActionPending) return;
        setActionErrorMessage(null);
        readyMutation.mutate(order.id, {
            onError: (err) => {
                setActionErrorMessage(
                    getApiErrorMessage(err, "Failed to mark order as ready. Please try again.")
                );
            },
        });
    };

    if (!id) {
        return (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center">
                <AlertCircle className="mx-auto h-8 w-8 text-rose-500" />
                <h2 className="mt-3 text-lg font-bold text-slate-900">Invalid Order URL</h2>
                <p className="mt-1 text-sm text-slate-500">The order ID is missing from the URL.</p>
                <Button
                    type="button"
                    onClick={() => navigate("/shop-admin/orders")}
                    className="mt-4 bg-[#2563EB] text-white hover:bg-blue-700"
                >
                    Back to Orders
                </Button>
            </div>
        );
    }

    if (isPending) {
        return <OrderDetailSkeleton />;
    }

    if (isError || !order) {
        return (
            <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-8 text-center" role="alert">
                <AlertCircle className="mx-auto h-8 w-8 text-rose-500" />
                <h2 className="mt-3 text-lg font-bold text-slate-900">
                    Order details could not be loaded
                </h2>
                <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
                    {getApiErrorMessage(
                        error,
                        "The order may have been removed or does not belong to your shop."
                    )}
                </p>
                <div className="mt-4 flex items-center justify-center gap-3">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => navigate("/shop-admin/orders")}
                        className="border-slate-200 text-slate-700"
                    >
                        Back to Orders
                    </Button>
                    <Button
                        type="button"
                        onClick={() => void refetch()}
                        disabled={isFetching}
                        className="bg-[#2563EB] text-white hover:bg-blue-700"
                    >
                        <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
                        {isFetching ? "Retrying..." : "Try Again"}
                    </Button>
                </div>
            </div>
        );
    }

    const customerName = getCustomerDisplayName(order.customer);
    const addressLine2 = [order.pickup_city, order.pickup_district].filter(Boolean).join(", ");
    const addressLine3 = [order.pickup_state, order.pickup_pincode].filter(Boolean).join(" - ");

    return (
        <div className="space-y-6">
            {/* Top Navigation Bar */}
            <div className="flex items-center justify-between">
                <Link
                    to="/shop-admin/orders"
                    className="inline-flex items-center gap-2 text-sm font-semibold text-[#2563EB] hover:text-blue-700 transition-colors"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Back to Orders
                </Link>
            </div>

            {/* Header Card */}
            <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-xs sm:p-8">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-2.5 min-w-0">
                        <div className="flex flex-wrap items-center gap-3">
                            <h1 className="break-all font-heading text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                                {order.order_number}
                            </h1>
                            <div className="flex flex-wrap items-center gap-2">
                                <OrderStatusBadge status={order.order_status} />
                                <PaymentStatusBadge status={order.payment_status} />
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-slate-500 sm:text-sm">
                            <span className="flex items-center gap-1.5 font-medium text-slate-700">
                                <User className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                <span className="max-w-[240px] truncate">{customerName}</span>
                            </span>
                            <span className="text-slate-300 hidden sm:inline">•</span>
                            <span className="flex items-center gap-1.5 text-slate-500">
                                <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                <span>Placed on {formatOrderDateTime(order.created_at)}</span>
                            </span>
                        </div>
                    </div>

                    {/* Authoritative Total Box */}
                    <div className="shrink-0 self-start rounded-xl border border-slate-200 bg-slate-50/80 px-5 py-3 sm:self-auto sm:text-right">
                        <div className="text-xs font-medium text-slate-500">Authoritative Total</div>
                        <div className="text-xl font-bold text-slate-900 sm:text-2xl tabular-nums">
                            {formatOrderAmount(order.total_amount)}
                        </div>
                    </div>
                </div>
            </div>

            {/* Action Failure Banner */}
            {actionErrorMessage && (
                <div
                    className="flex items-start justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"
                    role="alert"
                >
                    <div className="flex items-start gap-2.5">
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                        <div>
                            <p className="font-semibold">Action could not be completed</p>
                            <p className="mt-0.5 text-xs text-rose-700">{actionErrorMessage}</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => setActionErrorMessage(null)}
                        className="text-rose-600 hover:text-rose-800"
                        aria-label="Dismiss error"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
            )}

            {/* Workflow Action Control Banner */}
            <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-xs">
                {order.order_status === "placed" && (
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h3 className="text-base font-bold text-slate-900">
                                Order Awaiting Shop Confirmation
                            </h3>
                            <p className="text-xs text-slate-500 sm:text-sm">
                                Review items and customer pickup details, then accept or reject this request.
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setIsRejectModalOpen(true)}
                                disabled={isAnyActionPending}
                                className="border-rose-200 text-rose-700 hover:bg-rose-50 hover:border-rose-300"
                            >
                                <X className="mr-1.5 h-4 w-4 text-rose-500" />
                                Reject Order
                            </Button>
                            <Button
                                type="button"
                                onClick={handleAccept}
                                disabled={isAnyActionPending}
                                className="bg-[#2563EB] font-semibold text-white hover:bg-blue-700"
                            >
                                {acceptMutation.isPending ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Accepting...
                                    </>
                                ) : (
                                    <>
                                        <Check className="mr-1.5 h-4 w-4" />
                                        Accept Order
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                )}

                {order.order_status === "accepted" && (
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#2563EB]">
                            <Truck className="h-5 w-5" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-slate-900 sm:text-base">
                                Order Accepted — Pickup Pending
                            </h3>
                            <p className="text-xs text-slate-500 sm:text-sm">
                                A logistics pickup task has been created. Awaiting delivery agent to collect garments from the customer.
                            </p>
                        </div>
                    </div>
                )}

                {order.order_status === "pickup_scheduled" && (
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                            <Clock3 className="h-5 w-5" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-slate-900 sm:text-base">
                                Pickup Scheduled with Agent
                            </h3>
                            <p className="text-xs text-slate-500 sm:text-sm">
                                A delivery agent has been assigned to collect garments. Cleaning controls will become active once items are picked up.
                            </p>
                        </div>
                    </div>
                )}

                {order.order_status === "picked_up" && (
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                                <Sparkles className="h-5 w-5" />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-slate-900">
                                    Garments Collected — Ready to Process
                                </h3>
                                <p className="text-xs text-slate-500 sm:text-sm">
                                    Garments have arrived from the customer. Start processing when dry cleaning or laundering commences.
                                </p>
                            </div>
                        </div>
                        <Button
                            type="button"
                            onClick={handleStartProcessing}
                            disabled={isAnyActionPending}
                            className="bg-amber-600 font-semibold text-white hover:bg-amber-700"
                        >
                            {startProcessingMutation.isPending ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Starting...
                                </>
                            ) : (
                                <>
                                    <Play className="mr-1.5 h-4 w-4 fill-white" />
                                    Start Processing
                                </>
                            )}
                        </Button>
                    </div>
                )}

                {order.order_status === "processing" && (
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                                <PackageCheck className="h-5 w-5" />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-slate-900">
                                    Garments Under Processing
                                </h3>
                                <p className="text-xs text-slate-500 sm:text-sm">
                                    Cleaning is underway. When garments are pressed, inspected, and packed, mark the order as ready.
                                </p>
                            </div>
                        </div>
                        <Button
                            type="button"
                            onClick={handleMarkReady}
                            disabled={isAnyActionPending}
                            className="bg-emerald-600 font-semibold text-white hover:bg-emerald-700"
                        >
                            {readyMutation.isPending ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Marking Ready...
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 className="mr-1.5 h-4 w-4" />
                                    Mark Ready for Delivery
                                </>
                            )}
                        </Button>
                    </div>
                )}

                {order.order_status === "ready" && (
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
                            <Truck className="h-5 w-5" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-slate-900 sm:text-base">
                                Order Ready for Customer Delivery
                            </h3>
                            <p className="text-xs text-slate-500 sm:text-sm">
                                Garments are packaged and ready. A delivery drop-off task has been generated for a delivery agent.
                            </p>
                        </div>
                    </div>
                )}

                {order.order_status === "delivered" && (
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-green-50 text-green-600">
                            <CheckCircle2 className="h-5 w-5" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-slate-900 sm:text-base">
                                Order Delivered
                            </h3>
                            <p className="text-xs text-slate-500 sm:text-sm">
                                All garments have been delivered to the customer. This order is complete.
                            </p>
                        </div>
                    </div>
                )}

                {order.order_status === "cancelled" && (
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                            <X className="h-5 w-5" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-slate-900 sm:text-base">
                                Order Cancelled by Customer
                            </h3>
                            <p className="text-xs text-slate-500 sm:text-sm">
                                The customer cancelled this order prior to physical garment pickup. No further action is required.
                            </p>
                        </div>
                    </div>
                )}

                {order.order_status === "rejected" && (
                    <div className="space-y-2">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
                                <AlertTriangle className="h-5 w-5" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-rose-900 sm:text-base">
                                    Order Rejected
                                </h3>
                                <p className="text-xs text-rose-700 sm:text-sm">
                                    This order was rejected and cannot be transitioned further.
                                </p>
                            </div>
                        </div>
                        {order.rejection_reason && (
                            <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50/60 p-3.5 text-xs text-rose-900 sm:text-sm">
                                <span className="font-semibold">Rejection reason:</span>{" "}
                                {order.rejection_reason}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Main Content Grid */}
            <div className="grid gap-6 lg:grid-cols-12">
                {/* Left Column (Items, Note, History) */}
                <div className="space-y-6 lg:col-span-8">
                    {/* Order Items Table */}
                    <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-xs">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
                            <div className="flex items-center gap-2.5">
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-[#2563EB]">
                                    <PackageCheck className="h-4 w-4" />
                                </div>
                                <h2 className="text-base font-bold text-slate-900">
                                    Order Items & Services
                                </h2>
                            </div>
                            <span className="rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-semibold text-[#2563EB]">
                                {order.items.length} {order.items.length === 1 ? "line item" : "line items"}
                            </span>
                        </div>

                        {order.items.length === 0 ? (
                            <p className="py-8 text-center text-sm text-slate-500">
                                No items were recorded for this order.
                            </p>
                        ) : (
                            <div className="divide-y divide-slate-100">
                                {order.items.map((item) => (
                                    <div
                                        key={item.id}
                                        className="flex items-center justify-between gap-4 py-4 first:pt-4 last:pb-0"
                                    >
                                        <div className="flex items-center gap-3.5 min-w-0">
                                            <GarmentImage
                                                src={item.garment_image}
                                                alt={item.garment}
                                                className="h-12 w-12 shrink-0 rounded-xl border border-slate-100 bg-slate-50 object-cover"
                                            />
                                            <div className="min-w-0">
                                                <h3 className="truncate text-sm font-bold text-slate-900">
                                                    {item.garment}
                                                </h3>
                                                <p className="truncate text-xs font-medium text-[#2563EB]">
                                                    {item.service}
                                                </p>
                                                <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
                                                    <span>Qty: {item.quantity}</span>
                                                    <span>•</span>
                                                    <span>
                                                        Unit: {formatOrderAmount(item.unit_price)}
                                                    </span>
                                                    {item.item_status !== "active" && (
                                                        <>
                                                            <span>•</span>
                                                            <span className="rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-600 uppercase">
                                                                {item.item_status}
                                                            </span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="text-right shrink-0">
                                            <div className="text-sm font-bold text-slate-900 tabular-nums">
                                                {formatOrderAmount(item.line_total)}
                                            </div>
                                            <div className="text-[11px] text-slate-400">
                                                Line total
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
                            <span className="text-sm font-medium text-slate-500">
                                Order Total
                            </span>
                            <span className="text-lg font-bold text-slate-900 tabular-nums">
                                {formatOrderAmount(order.total_amount)}
                            </span>
                        </div>
                    </div>

                    {/* Customer Note */}
                    {order.note && order.note.trim() && (
                        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-xs">
                            <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3.5">
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-[#2563EB]">
                                    <FileText className="h-4 w-4" />
                                </div>
                                <h3 className="text-base font-bold text-slate-900">
                                    Customer Note
                                </h3>
                            </div>
                            <div className="mt-3.5 rounded-xl border border-slate-100 bg-slate-50/70 p-4 text-sm text-slate-700 italic">
                                "{order.note}"
                            </div>
                        </div>
                    )}

                    {/* Fulfilment Timeline & Status History */}
                    <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-xs">
                        <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3.5">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-[#2563EB]">
                                <Clock3 className="h-4 w-4" />
                            </div>
                            <h3 className="text-base font-bold text-slate-900">
                                Status Transition History
                            </h3>
                        </div>

                        {order.status_history.length === 0 ? (
                            <p className="pt-4 text-sm text-slate-500">
                                No history records recorded yet.
                            </p>
                        ) : (
                            <div className="relative mt-6 space-y-6 pl-6 before:absolute before:bottom-2 before:left-2 before:top-2 before:w-0.5 before:bg-slate-200">
                                {order.status_history.map((history, idx) => (
                                    <div key={idx} className="relative">
                                        <div className="absolute -left-6 top-1 h-3.5 w-3.5 rounded-full border-2 border-white bg-[#2563EB] shadow-xs" />
                                        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-bold text-slate-900">
                                                    {getOrderStatusMeta(history.status).label}
                                                </span>
                                                <OrderStatusBadge status={history.status} />
                                            </div>
                                            <span className="text-xs text-slate-500">
                                                {formatOrderDateTime(history.created_at)}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Column (Customer, Pickup, Payment, Logistics) */}
                <div className="space-y-6 lg:col-span-4">
                    {/* Customer Information Card */}
                    <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-xs">
                        <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3.5">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-[#2563EB]">
                                <User className="h-4 w-4" />
                            </div>
                            <h3 className="text-base font-bold text-slate-900">Customer Details</h3>
                        </div>

                        <div className="mt-4 space-y-3.5 text-sm">
                            {/* Full Name & Username */}
                            <div>
                                <div className="text-xs font-medium text-slate-400">Customer</div>
                                <div className="mt-0.5 text-base font-bold text-slate-900 break-words">
                                    {customerName}
                                </div>
                                {order.customer.username && (
                                    <div className="text-xs text-slate-500 break-all">
                                        @{order.customer.username}
                                    </div>
                                )}
                            </div>

                            {/* Phone */}
                            <div className="border-t border-slate-100 pt-3">
                                <div className="text-xs font-medium text-slate-400">Phone Number</div>
                                {order.customer.phone_number ? (
                                    <a
                                        href={`tel:${order.customer.phone_number}`}
                                        className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-slate-800 hover:text-[#2563EB] transition-colors"
                                    >
                                        <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                        <span>{order.customer.phone_number}</span>
                                    </a>
                                ) : (
                                    <div className="mt-0.5 text-xs text-slate-400 italic">Not provided</div>
                                )}
                            </div>

                            {/* Email */}
                            <div className="border-t border-slate-100 pt-3">
                                <div className="text-xs font-medium text-slate-400">Email Address</div>
                                {order.customer.email ? (
                                    <a
                                        href={`mailto:${order.customer.email}`}
                                        className="mt-1 flex items-start gap-1.5 text-sm font-medium text-slate-800 hover:text-[#2563EB] transition-colors break-all"
                                    >
                                        <Mail className="mt-0.5 h-3.5 w-3.5 text-slate-400 shrink-0" />
                                        <span>{order.customer.email}</span>
                                    </a>
                                ) : (
                                    <div className="mt-0.5 text-xs text-slate-400 italic">Not provided</div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Pickup Address Card */}
                    <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-xs">
                        <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3.5">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-[#2563EB]">
                                <MapPin className="h-4 w-4" />
                            </div>
                            <h3 className="text-base font-bold text-slate-900">Pickup Address</h3>
                        </div>
                        <div className="mt-4 space-y-1 text-sm text-slate-700">
                            <div className="font-semibold text-slate-900 break-words">
                                {order.pickup_address_line}
                            </div>
                            {addressLine2 && <div className="text-slate-600">{addressLine2}</div>}
                            {addressLine3 && <div className="text-slate-600">{addressLine3}</div>}
                        </div>
                    </div>

                    {/* Payment Summary Card */}
                    <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-xs">
                        <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3.5">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-[#2563EB]">
                                <CreditCard className="h-4 w-4" />
                            </div>
                            <h3 className="text-base font-bold text-slate-900">Payment Summary</h3>
                        </div>
                        <div className="mt-4 flex items-center justify-between">
                            <span className="text-xs font-medium text-slate-500">Payment Status</span>
                            <PaymentStatusBadge status={order.payment_status} />
                        </div>
                        <div className="mt-3.5 flex items-center justify-between border-t border-slate-100 pt-3.5">
                            <span className="text-xs font-medium text-slate-500">Authoritative Total</span>
                            <span className="text-lg font-bold text-slate-900 tabular-nums">
                                {formatOrderAmount(order.total_amount)}
                            </span>
                        </div>
                    </div>

                    {/* Logistics & Delivery Tasks Card */}
                    <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-xs">
                        <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3.5">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-[#2563EB]">
                                <Truck className="h-4 w-4" />
                            </div>
                            <h3 className="text-base font-bold text-slate-900">
                                Logistics & Delivery Tasks
                            </h3>
                        </div>

                        {order.delivery_tasks.length === 0 ? (
                            <p className="pt-4 text-xs text-slate-500">
                                No logistics tasks generated yet for this order. Tasks are created when an order is accepted (for pickup) or marked ready (for delivery).
                            </p>
                        ) : (
                            <div className="mt-4 divide-y divide-slate-100">
                                {order.delivery_tasks.map((task) => (
                                    <div key={task.id} className="py-3.5 first:pt-0 last:pb-0 space-y-2">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                                                {task.task_type === "pickup" ? "Pickup Task" : "Delivery Task"}
                                            </span>
                                            <span
                                                className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold capitalize ${getDeliveryTaskStatusBadge(
                                                    task.status
                                                )}`}
                                            >
                                                {task.status.replace("_", " ")}
                                            </span>
                                        </div>

                                        <div className="space-y-1.5 text-xs text-slate-600">
                                            <div className="flex items-center justify-between">
                                                <span className="text-slate-400">Agent:</span>
                                                <span className="font-medium text-slate-800">
                                                    {task.delivery_agent_username || "Unassigned"}
                                                </span>
                                            </div>
                                            {task.delivery_agent_phone && (
                                                <div className="flex items-center justify-between">
                                                    <span className="text-slate-400">Phone:</span>
                                                    <span className="text-slate-700">
                                                        {task.delivery_agent_phone}
                                                    </span>
                                                </div>
                                            )}
                                            {task.scheduled_at && (
                                                <div className="flex items-center justify-between">
                                                    <span className="text-slate-400">Scheduled:</span>
                                                    <span className="text-slate-700">{formatOrderDateTime(task.scheduled_at)}</span>
                                                </div>
                                            )}
                                            {task.completed_at && (
                                                <div className="flex items-center justify-between">
                                                    <span className="text-slate-400">Completed:</span>
                                                    <span className="text-slate-700">{formatOrderDateTime(task.completed_at)}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Rejection Confirmation Dialog */}
            {isRejectModalOpen && (
                <RejectOrderDialog
                    orderNumber={order.order_number}
                    onClose={() => setIsRejectModalOpen(false)}
                    onConfirm={handleRejectConfirm}
                    isPending={rejectMutation.isPending}
                    error={
                        rejectMutation.isError
                            ? getApiErrorMessage(
                                  rejectMutation.error,
                                  "Rejection failed. Please try again."
                              )
                            : null
                    }
                />
            )}
        </div>
    );
}

export default ShopOrderDetail;
