import { useEffect, useState } from "react";
import { AlertCircle, AlertTriangle, Loader2, RefreshCw, X } from "lucide-react";

import { useUnassignDeliveryTask } from "../../hooks/shopAdmin/useShopAdminDeliveryTasks";
import type { DeliveryTaskType } from "../../types/shopAdmin/deliveryTasks";

interface UnassignDeliveryTaskDialogProps {
    taskId: number | null;
    orderId?: number | string;
    orderNumber?: string;
    taskType?: DeliveryTaskType;
    agentName?: string | null;
    isOpen: boolean;
    onClose: () => void;
}

function UnassignDeliveryTaskDialogContent({
    taskId,
    orderId,
    orderNumber,
    taskType,
    agentName,
    onClose,
}: {
    taskId: number;
    orderId?: number | string;
    orderNumber?: string;
    taskType?: DeliveryTaskType;
    agentName?: string | null;
    onClose: () => void;
}) {
    const unassignMutation = useUnassignDeliveryTask();
    const [formError, setFormError] = useState<string | null>(null);
    const [isConflict, setIsConflict] = useState(false);

    // Handle Escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape" && !unassignMutation.isPending) {
                onClose();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [onClose, unassignMutation.isPending]);

    const handleConfirm = async () => {
        setFormError(null);
        setIsConflict(false);

        try {
            await unassignMutation.mutateAsync({
                taskId,
                orderId,
            });
            onClose();
        } catch (err: unknown) {
            const error = err as { response?: { status?: number; data?: Record<string, unknown> } };
            const status = error.response?.status;
            const data = error.response?.data;

            if (status === 409) {
                setIsConflict(true);
                setFormError(
                    "A concurrent update conflict occurred. Another action modified this task or order. Please refresh and retry."
                );
            } else if (data && typeof data === "object") {
                const messages = Object.entries(data)
                    .map(([key, val]) => {
                        const valStr = Array.isArray(val) ? val.join(" ") : String(val);
                        return `${key}: ${valStr}`;
                    })
                    .join(" | ");
                setFormError(messages || "Failed to unassign delivery task.");
            } else {
                setFormError("An unexpected error occurred while unassigning the task.");
            }
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-xs transition-opacity animate-in fade-in duration-150"
            role="dialog"
            aria-modal="true"
            aria-labelledby="unassign-task-dialog-title"
        >
            <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl sm:p-7">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                            <AlertTriangle className="h-5 w-5" />
                        </div>
                        <div>
                            <h3 id="unassign-task-dialog-title" className="text-lg font-bold text-slate-900">
                                Unassign Delivery Agent
                            </h3>
                            <p className="text-xs text-slate-500">
                                Order <span className="font-semibold text-slate-800">#{orderNumber || taskId}</span>
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={unassignMutation.isPending}
                        className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                        aria-label="Close dialog"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="mt-5 space-y-4">
                    {formError && (
                        <div
                            className={`flex items-start gap-2.5 rounded-xl border p-3.5 text-xs ${
                                isConflict
                                    ? "border-amber-300 bg-amber-50 text-amber-800"
                                    : "border-rose-200 bg-rose-50 text-rose-700"
                            }`}
                        >
                            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                            <div className="space-y-1">
                                <span>{formError}</span>
                                {isConflict && (
                                    <div>
                                        <button
                                            type="button"
                                            onClick={onClose}
                                            className="inline-flex items-center gap-1 font-semibold underline text-amber-900 hover:text-amber-950 mt-1"
                                        >
                                            <RefreshCw className="h-3 w-3" />
                                            Close & Refresh View
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    <p className="text-sm text-slate-600">
                        Are you sure you want to remove{" "}
                        <span className="font-semibold text-slate-800">
                            {agentName || "the assigned driver"}
                        </span>{" "}
                        from this <span className="font-semibold text-slate-800">{taskType || "delivery"}</span> task?
                    </p>

                    <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 text-xs text-amber-800">
                        The task will return to <span className="font-bold">Unassigned</span> status, making it available for reassignment to another active driver in your shop.
                    </div>

                    {/* Dialog Actions */}
                    <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={unassignMutation.isPending}
                            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleConfirm}
                            disabled={unassignMutation.isPending}
                            className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-5 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-amber-700 transition-colors disabled:opacity-60"
                        >
                            {unassignMutation.isPending ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Unassigning...
                                </>
                            ) : (
                                "Yes, Unassign Driver"
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function UnassignDeliveryTaskDialog({
    taskId,
    orderId,
    orderNumber,
    taskType,
    agentName,
    isOpen,
    onClose,
}: UnassignDeliveryTaskDialogProps) {
    if (!isOpen || !taskId) return null;

    return (
        <UnassignDeliveryTaskDialogContent
            key={taskId}
            taskId={taskId}
            orderId={orderId}
            orderNumber={orderNumber}
            taskType={taskType}
            agentName={agentName}
            onClose={onClose}
        />
    );
}
