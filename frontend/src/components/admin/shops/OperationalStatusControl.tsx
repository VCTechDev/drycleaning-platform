import { usePlatformShopActions } from "../../../hooks/platform/usePlatformShopActions";

interface OperationalStatusControlProps {
    shopId: number;
    shopName: string;
    isOpen: boolean;
    compact?: boolean;
}

function OperationalStatusControl({
    shopId,
    shopName,
    isOpen,
    compact = false,
}: OperationalStatusControlProps) {
    const { statusMutation } = usePlatformShopActions(String(shopId));

    return (
        <div className={compact ? "min-w-32" : "space-y-2"}>
            <button
                type="button"
                onClick={() => statusMutation.mutate(!isOpen)}
                disabled={statusMutation.isPending}
                aria-label={`Set ${shopName} ${isOpen ? "closed" : "open"}`}
                className={`inline-flex min-h-9 items-center gap-2 rounded-full px-3 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${
                    isOpen
                        ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
            >
                <span
                    className={`h-2 w-2 rounded-full ${
                        isOpen ? "bg-emerald-500" : "bg-slate-400"
                    }`}
                    aria-hidden="true"
                />
                {statusMutation.isPending
                    ? "Updating..."
                    : isOpen
                        ? "Open"
                        : "Closed"}
            </button>
            {statusMutation.isError && (
                <p className="text-xs text-red-600" role="alert">
                    Could not update status. Try again.
                </p>
            )}
        </div>
    );
}

export default OperationalStatusControl;
