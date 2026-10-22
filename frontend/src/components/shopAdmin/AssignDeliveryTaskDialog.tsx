import { useEffect, useState, type FormEvent } from "react";
import {
    AlertCircle,
    Calendar,
    Loader2,
    RefreshCw,
    Truck,
    UserCheck,
    X,
} from "lucide-react";

import { useShopAdminDeliveryAgents } from "../../hooks/shopAdmin/useShopAdminDeliveryAgents";
import { useAssignDeliveryTask } from "../../hooks/shopAdmin/useShopAdminDeliveryTasks";
import type { DeliveryTaskType } from "../../types/shopAdmin/deliveryTasks";

interface AssignDeliveryTaskDialogProps {
    taskId: number | null;
    orderId?: number | string;
    orderNumber?: string;
    taskType?: DeliveryTaskType;
    currentAgentId?: number | null;
    currentScheduledAt?: string | null;
    isOpen: boolean;
    onClose: () => void;
}

// Format ISO string to datetime-local input "YYYY-MM-DDTHH:mm"
const formatForDatetimeInput = (isoStr?: string | null) => {
    if (!isoStr) return "";
    try {
        const date = new Date(isoStr);
        const pad = (n: number) => String(n).padStart(2, "0");
        const y = date.getFullYear();
        const m = pad(date.getMonth() + 1);
        const d = pad(date.getDate());
        const h = pad(date.getHours());
        const min = pad(date.getMinutes());
        return `${y}-${m}-${d}T${h}:${min}`;
    } catch {
        return "";
    }
};

function AssignDeliveryTaskDialogContent({
    taskId,
    orderId,
    orderNumber,
    taskType,
    currentAgentId,
    currentScheduledAt,
    onClose,
}: {
    taskId: number;
    orderId?: number | string;
    orderNumber?: string;
    taskType?: DeliveryTaskType;
    currentAgentId?: number | null;
    currentScheduledAt?: string | null;
    onClose: () => void;
}) {
    const assignMutation = useAssignDeliveryTask();

    // Query active agents only
    const {
        data: agentsData,
        isLoading: isAgentsLoading,
        isError: isAgentsError,
        refetch: refetchAgents,
    } = useShopAdminDeliveryAgents({ is_active: true });

    const [selectedAgentId, setSelectedAgentId] = useState<string>(
        currentAgentId ? String(currentAgentId) : ""
    );
    const [scheduledAt, setScheduledAt] = useState<string>(
        formatForDatetimeInput(currentScheduledAt)
    );
    const [formError, setFormError] = useState<string | null>(null);
    const [isConflict, setIsConflict] = useState(false);

    // Minimum allowed datetime is now
    const nowLocalString = formatForDatetimeInput(new Date().toISOString());

    // Handle Escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape" && !assignMutation.isPending) {
                onClose();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [onClose, assignMutation.isPending]);

    const agents = agentsData?.results || [];

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setFormError(null);
        setIsConflict(false);

        if (!selectedAgentId) {
            setFormError("Please select an eligible delivery agent from the list.");
            return;
        }

        let isoScheduled: string | null | undefined = undefined;
        if (scheduledAt) {
            const scheduledDate = new Date(scheduledAt);
            if (scheduledDate.getTime() < Date.now() - 60_000) {
                // allow 1-minute buffer for form completion
                setFormError("Scheduled time cannot be in the past.");
                return;
            }
            isoScheduled = scheduledDate.toISOString();
        }

        try {
            await assignMutation.mutateAsync({
                taskId,
                orderId,
                payload: {
                    delivery_agent_id: Number(selectedAgentId),
                    scheduled_at: isoScheduled,
                },
            });
            onClose();
        } catch (err: unknown) {
            const error = err as { response?: { status?: number; data?: Record<string, unknown> } };
            const status = error.response?.status;
            const data = error.response?.data;

            if (status === 409) {
                setIsConflict(true);
                setFormError(
                    "A concurrent update conflict occurred. This order or task was modified by another operation. Please refresh and retry."
                );
            } else if (data && typeof data === "object") {
                const messages = Object.entries(data)
                    .map(([key, val]) => {
                        const valStr = Array.isArray(val) ? val.join(" ") : String(val);
                        return `${key}: ${valStr}`;
                    })
                    .join(" | ");
                setFormError(messages || "Failed to assign delivery task.");
            } else {
                setFormError("An unexpected error occurred while assigning the task. Please try again.");
            }
        }
    };

    const isReassign = Boolean(currentAgentId);

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-xs transition-opacity animate-in fade-in duration-150"
            role="dialog"
            aria-modal="true"
            aria-labelledby="assign-task-dialog-title"
        >
            <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl sm:p-7">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-[#2563EB]">
                            <Truck className="h-5 w-5" />
                        </div>
                        <div>
                            <h3 id="assign-task-dialog-title" className="text-lg font-bold text-slate-900">
                                {isReassign ? "Reassign Delivery Task" : "Assign Delivery Task"}
                            </h3>
                            <p className="text-xs text-slate-500">
                                {taskType === "pickup" ? "Pickup" : "Delivery"} Task for Order{" "}
                                <span className="font-semibold text-slate-800">
                                    #{orderNumber || taskId}
                                </span>
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={assignMutation.isPending}
                        className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                        aria-label="Close dialog"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="mt-5 space-y-4">
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
                                            onClick={() => {
                                                refetchAgents();
                                                onClose();
                                            }}
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

                    {/* Agent Selection */}
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <label className="block text-xs font-semibold text-slate-700">
                                Select Active Delivery Agent <span className="text-rose-500">*</span>
                            </label>
                            {isAgentsLoading && (
                                <span className="text-[11px] text-slate-400 flex items-center gap-1">
                                    <Loader2 className="h-3 w-3 animate-spin" /> Loading agents...
                                </span>
                            )}
                        </div>

                        {isAgentsError ? (
                            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
                                Failed to load agents.{" "}
                                <button
                                    type="button"
                                    onClick={() => refetchAgents()}
                                    className="font-semibold underline"
                                >
                                    Retry
                                </button>
                            </div>
                        ) : agents.length === 0 && !isAgentsLoading ? (
                            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                                No active delivery agents found in your shop. Please activate or register an agent first.
                            </div>
                        ) : (
                            <select
                                required
                                value={selectedAgentId}
                                onChange={(e) => setSelectedAgentId(e.target.value)}
                                disabled={assignMutation.isPending || isAgentsLoading}
                                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-blue-100"
                            >
                                <option value="">-- Choose an active agent --</option>
                                {agents.map((agent) => {
                                    const fullName = `${agent.user.first_name || ""} ${agent.user.last_name || ""}`.trim();
                                    const label = fullName ? `${fullName} (@${agent.user.username})` : `@${agent.user.username}`;
                                    const onlineStatus = agent.is_online ? "🟢 Online" : "⚪ Offline";
                                    return (
                                        <option key={agent.id} value={agent.id}>
                                            {label} — {onlineStatus} ({agent.active_tasks_count} active tasks)
                                        </option>
                                    );
                                })}
                            </select>
                        )}
                        <p className="mt-1 text-[11px] text-slate-400">
                            Only active agents registered to your shop are eligible for assignment.
                        </p>
                    </div>

                    {/* Schedule Date & Time */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Scheduled Pickup/Delivery Time <span className="text-slate-400 font-normal">(Optional)</span>
                        </label>
                        <div className="relative">
                            <Calendar className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <input
                                type="datetime-local"
                                min={nowLocalString}
                                value={scheduledAt}
                                onChange={(e) => setScheduledAt(e.target.value)}
                                disabled={assignMutation.isPending}
                                className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3.5 py-2.5 text-sm text-slate-800 focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-blue-100"
                            />
                        </div>
                        <p className="mt-1 text-[11px] text-slate-400">
                            Must be set in the future. If left blank, existing schedule is preserved or set when driver begins task.
                        </p>
                    </div>

                    {/* Information Box */}
                    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 text-xs text-slate-600 space-y-1">
                        <div className="flex items-center gap-2 font-semibold text-slate-800">
                            <UserCheck className="h-4 w-4 text-[#2563EB]" />
                            Task Assignment Rule
                        </div>
                        <p>
                            Tasks in progress or terminal statuses cannot be reassigned. The assigned driver will be notified and can begin the task during their scheduled shift.
                        </p>
                    </div>

                    {/* Dialog Actions */}
                    <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={assignMutation.isPending}
                            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={assignMutation.isPending || agents.length === 0}
                            className="inline-flex items-center gap-2 rounded-xl bg-[#2563EB] px-5 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 transition-colors disabled:opacity-60"
                        >
                            {assignMutation.isPending ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Assigning...
                                </>
                            ) : (
                                isReassign ? "Confirm Reassignment" : "Confirm Assignment"
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default function AssignDeliveryTaskDialog({
    taskId,
    orderId,
    orderNumber,
    taskType,
    currentAgentId,
    currentScheduledAt,
    isOpen,
    onClose,
}: AssignDeliveryTaskDialogProps) {
    if (!isOpen || !taskId) return null;

    return (
        <AssignDeliveryTaskDialogContent
            key={`${taskId}-${currentAgentId ?? "none"}`}
            taskId={taskId}
            orderId={orderId}
            orderNumber={orderNumber}
            taskType={taskType}
            currentAgentId={currentAgentId}
            currentScheduledAt={currentScheduledAt}
            onClose={onClose}
        />
    );
}
