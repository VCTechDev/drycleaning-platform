import {
    getOrderStatusMeta,
    getPaymentStatusMeta,
} from "../../../lib/orderDisplay";

interface StatusBadgeProps {
    status: string;
}

export function OrderStatusBadge({ status }: StatusBadgeProps) {
    const meta = getOrderStatusMeta(status);

    return (
        <span
            className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${meta.badgeClass}`}
        >
            {meta.label}
        </span>
    );
}

export function PaymentStatusBadge({ status }: StatusBadgeProps) {
    const meta = getPaymentStatusMeta(status);

    return (
        <span
            className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${meta.badgeClass}`}
        >
            {meta.label}
        </span>
    );
}
