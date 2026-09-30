export interface OrderStatusMeta {
    label: string;
    badgeClass: string;
}

const ORDER_STATUS_META: Record<string, OrderStatusMeta> = {
    placed: {
        label: "Placed",
        badgeClass: "bg-blue-50 text-blue-700",
    },
    accepted: {
        label: "Accepted",
        badgeClass: "bg-indigo-50 text-indigo-700",
    },
    pickup_scheduled: {
        label: "Pickup Scheduled",
        badgeClass: "bg-violet-50 text-violet-700",
    },
    picked_up: {
        label: "Picked Up",
        badgeClass: "bg-cyan-50 text-cyan-700",
    },
    processing: {
        label: "Processing",
        badgeClass: "bg-amber-50 text-amber-700",
    },
    ready: {
        label: "Ready for Delivery",
        badgeClass: "bg-emerald-50 text-emerald-700",
    },
    delivered: {
        label: "Delivered",
        badgeClass: "bg-green-50 text-green-700",
    },
    cancelled: {
        label: "Cancelled",
        badgeClass: "bg-red-50 text-red-700",
    },
};

const fallbackStatusLabel = (status: string) => {
    if (!status.trim()) {
        return "Status unavailable";
    }

    return status
        .replaceAll("_", " ")
        .replace(/\b\w/g, (character) => character.toUpperCase());
};

export const getOrderStatusMeta = (status: string | null | undefined) => {
    const normalizedStatus = status ?? "";

    return (
        ORDER_STATUS_META[normalizedStatus] ?? {
            label: fallbackStatusLabel(normalizedStatus),
            badgeClass: "bg-slate-100 text-slate-700",
        }
    );
};

const PAYMENT_STATUS_META: Record<string, OrderStatusMeta> = {
    pending: {
        label: "Pending",
        badgeClass: "bg-amber-50 text-amber-700",
    },
    processing: {
        label: "Processing",
        badgeClass: "bg-blue-50 text-blue-700",
    },
    success: {
        label: "Paid",
        badgeClass: "bg-green-50 text-green-700",
    },
    failed: {
        label: "Failed",
        badgeClass: "bg-red-50 text-red-700",
    },
    cancelled: {
        label: "Cancelled",
        badgeClass: "bg-red-50 text-red-700",
    },
};

export const getPaymentStatusMeta = (
    status: string | null | undefined
) => {
    const normalizedStatus = status ?? "";

    return (
        PAYMENT_STATUS_META[normalizedStatus] ?? {
            label: fallbackStatusLabel(normalizedStatus),
            badgeClass: "bg-slate-100 text-slate-700",
        }
    );
};

const getValidDate = (value: string | null | undefined) => {
    if (!value) {
        return null;
    }

    const date = new Date(value);

    return Number.isNaN(date.getTime()) ? null : date;
};

export const formatOrderDate = (value: string | null | undefined) => {
    const date = getValidDate(value);

    if (!date) {
        return "Date unavailable";
    }

    return new Intl.DateTimeFormat("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
    }).format(date);
};

export const formatOrderDateTime = (
    value: string | null | undefined
) => {
    const date = getValidDate(value);

    if (!date) {
        return null;
    }

    return new Intl.DateTimeFormat("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
    }).format(date);
};

export const formatOrderAmount = (
    value: string | null | undefined
) => {
    if (!value || !value.trim() || !Number.isFinite(Number(value))) {
        return "Amount unavailable";
    }

    return `\u20B9${value}`;
};
