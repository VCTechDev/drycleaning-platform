import { useEffect, useState, type FormEvent } from "react";
import { AlertCircle, Clock, Loader2, Phone, User, X } from "lucide-react";

import { useUpdateDeliveryAgent } from "../../hooks/shopAdmin/useShopAdminDeliveryAgents";
import type { DeliveryAgent, UpdateDeliveryAgentPayload } from "../../types/shopAdmin/deliveryAgents";

interface EditDeliveryAgentDialogProps {
    agent: DeliveryAgent | null;
    isOpen: boolean;
    onClose: () => void;
}

// Format backend "HH:MM:SS" to "HH:MM" for time inputs
const formatTimeForInput = (timeStr?: string) => {
    if (!timeStr) return "";
    return timeStr.slice(0, 5);
};

function EditDeliveryAgentDialogContent({
    agent,
    onClose,
}: {
    agent: DeliveryAgent;
    onClose: () => void;
}) {
    const updateMutation = useUpdateDeliveryAgent();

    const [firstName, setFirstName] = useState(agent.user.first_name || "");
    const [lastName, setLastName] = useState(agent.user.last_name || "");
    const [phoneNumber, setPhoneNumber] = useState(agent.user.phone_number || "");
    const [shiftStartsAt, setShiftStartsAt] = useState(formatTimeForInput(agent.shift_starts_at));
    const [shiftEndsAt, setShiftEndsAt] = useState(formatTimeForInput(agent.shift_ends_at));
    const [isActive, setIsActive] = useState(agent.is_active);
    const [formError, setFormError] = useState<string | null>(null);

    // Handle Escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape" && !updateMutation.isPending) {
                onClose();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [onClose, updateMutation.isPending]);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setFormError(null);

        if (!shiftStartsAt || !shiftEndsAt) {
            setFormError("Both shift start and shift end times are required.");
            return;
        }

        if (shiftStartsAt === shiftEndsAt) {
            setFormError("Shift start time and end time cannot be identical.");
            return;
        }

        // Format to "HH:MM:00" for backend TimeField
        const formattedStart = shiftStartsAt.length === 5 ? `${shiftStartsAt}:00` : shiftStartsAt;
        const formattedEnd = shiftEndsAt.length === 5 ? `${shiftEndsAt}:00` : shiftEndsAt;

        const payload: UpdateDeliveryAgentPayload = {
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            phone_number: phoneNumber.trim(),
            shift_starts_at: formattedStart,
            shift_ends_at: formattedEnd,
            is_active: isActive,
        };

        try {
            await updateMutation.mutateAsync({
                agentId: agent.id,
                payload,
            });
            onClose();
        } catch (err: unknown) {
            const error = err as { response?: { data?: Record<string, unknown> } };
            const data = error.response?.data;
            if (data && typeof data === "object") {
                const messages = Object.entries(data)
                    .map(([key, val]) => {
                        const valStr = Array.isArray(val) ? val.join(", ") : String(val);
                        return `${key}: ${valStr}`;
                    })
                    .join(" | ");
                setFormError(messages || "Failed to update delivery agent.");
            } else {
                setFormError("A network or server error occurred. Please try again.");
            }
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-xs transition-opacity animate-in fade-in duration-150"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-agent-dialog-title"
        >
            <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl sm:p-7">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-[#2563EB]">
                            <User className="h-5 w-5" />
                        </div>
                        <div>
                            <h3 id="edit-agent-dialog-title" className="text-lg font-bold text-slate-900">
                                Edit Delivery Agent
                            </h3>
                            <p className="text-xs text-slate-500">
                                Update profile and shift details for <span className="font-semibold text-slate-700">@{agent.user.username}</span>
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={updateMutation.isPending}
                        className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                        aria-label="Close dialog"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="mt-5 space-y-4">
                    {formError && (
                        <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-700">
                            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                            <span>{formError}</span>
                        </div>
                    )}

                    {/* Name Fields */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                                First Name
                            </label>
                            <input
                                type="text"
                                value={firstName}
                                onChange={(e) => setFirstName(e.target.value)}
                                maxLength={150}
                                disabled={updateMutation.isPending}
                                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-blue-100"
                                placeholder="First name"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                                Last Name
                            </label>
                            <input
                                type="text"
                                value={lastName}
                                onChange={(e) => setLastName(e.target.value)}
                                maxLength={150}
                                disabled={updateMutation.isPending}
                                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-blue-100"
                                placeholder="Last name"
                            />
                        </div>
                    </div>

                    {/* Phone Number */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Phone Number
                        </label>
                        <div className="relative">
                            <Phone className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <input
                                type="tel"
                                value={phoneNumber}
                                onChange={(e) => setPhoneNumber(e.target.value)}
                                maxLength={15}
                                disabled={updateMutation.isPending}
                                className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3.5 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-blue-100"
                                placeholder="e.g. 9876543210"
                            />
                        </div>
                    </div>

                    {/* Shift Times */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                                Shift Starts At <span className="text-rose-500">*</span>
                            </label>
                            <div className="relative">
                                <Clock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="time"
                                    required
                                    value={shiftStartsAt}
                                    onChange={(e) => setShiftStartsAt(e.target.value)}
                                    disabled={updateMutation.isPending}
                                    className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm text-slate-800 focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-blue-100"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                                Shift Ends At <span className="text-rose-500">*</span>
                            </label>
                            <div className="relative">
                                <Clock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="time"
                                    required
                                    value={shiftEndsAt}
                                    onChange={(e) => setShiftEndsAt(e.target.value)}
                                    disabled={updateMutation.isPending}
                                    className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm text-slate-800 focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-blue-100"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Active Status Toggle */}
                    <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
                        <div>
                            <p className="text-sm font-semibold text-slate-800">Active Account</p>
                            <p className="text-xs text-slate-500">
                                Deactivating automatically forces the agent offline and prevents new assignments.
                            </p>
                        </div>
                        <input
                            type="checkbox"
                            checked={isActive}
                            onChange={(e) => setIsActive(e.target.checked)}
                            disabled={updateMutation.isPending}
                            className="h-5 w-5 rounded border-slate-300 text-[#2563EB] focus:ring-blue-500"
                        />
                    </div>

                    {/* Dialog Actions */}
                    <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={updateMutation.isPending}
                            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={updateMutation.isPending}
                            className="inline-flex items-center gap-2 rounded-xl bg-[#2563EB] px-5 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 transition-colors disabled:opacity-60"
                        >
                            {updateMutation.isPending ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                "Save Changes"
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default function EditDeliveryAgentDialog({
    agent,
    isOpen,
    onClose,
}: EditDeliveryAgentDialogProps) {
    if (!isOpen || !agent) return null;

    return <EditDeliveryAgentDialogContent key={agent.id} agent={agent} onClose={onClose} />;
}
