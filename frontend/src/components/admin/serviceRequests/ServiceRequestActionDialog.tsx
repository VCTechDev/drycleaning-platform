import { AlertTriangle, X } from "lucide-react";

import { Button } from "../../ui/button";

interface ServiceRequestActionDialogProps {
    mode: "approve" | "reject";
    open: boolean;
    pending: boolean;
    rejectionReason: string;
    rejectionError: string | null;
    onClose: () => void;
    onConfirm: () => void;
    onRejectionReasonChange: (value: string) => void;
}

function ServiceRequestActionDialog({
    mode,
    open,
    pending,
    rejectionReason,
    rejectionError,
    onClose,
    onConfirm,
    onRejectionReasonChange,
}: ServiceRequestActionDialogProps) {
    if (!open) {
        return null;
    }

    const isApprove = mode === "approve";
    const title = isApprove
        ? "Approve service request?"
        : "Reject service request?";

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-4 sm:items-center">
            <div
                className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"
                role="dialog"
                aria-modal="true"
                aria-labelledby="service-request-action-title"
                aria-describedby="service-request-action-description"
            >
                <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
                            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
                        </div>
                        <div>
                            <h2
                                id="service-request-action-title"
                                className="font-heading text-lg font-semibold text-slate-950"
                            >
                                {title}
                            </h2>
                            <p
                                id="service-request-action-description"
                                className="mt-1 text-sm leading-6 text-slate-500"
                            >
                                {isApprove
                                    ? "Approving creates or reactivates the matching global service. Existing global services are reused."
                                    : "Rejecting closes this request permanently. Provide a clear reason for the shop administrator."}
                            </p>
                        </div>
                    </div>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={onClose}
                        disabled={pending}
                        aria-label="Close dialog"
                        className="rounded-xl text-slate-500 hover:bg-slate-100"
                    >
                        <X className="h-5 w-5" aria-hidden="true" />
                    </Button>
                </div>

                {!isApprove && (
                    <div className="mt-5">
                        <label
                            htmlFor="service-request-rejection-reason"
                            className="text-sm font-semibold text-slate-900"
                        >
                            Rejection reason
                        </label>
                        <textarea
                            id="service-request-rejection-reason"
                            value={rejectionReason}
                            onChange={(event) =>
                                onRejectionReasonChange(event.target.value)
                            }
                            rows={5}
                            disabled={pending}
                            aria-invalid={Boolean(rejectionError)}
                            aria-describedby={
                                rejectionError
                                    ? "service-request-rejection-error"
                                    : "service-request-rejection-help"
                            }
                            className="mt-2 w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:bg-slate-50"
                            placeholder="Explain why this service request cannot be approved."
                        />
                        <p
                            id={
                                rejectionError
                                    ? "service-request-rejection-error"
                                    : "service-request-rejection-help"
                            }
                            className={`mt-1 text-xs ${rejectionError ? "text-red-600" : "text-slate-500"}`}
                        >
                            {rejectionError ?? "A specific reason is required."}
                        </p>
                    </div>
                )}

                <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                    <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        variant={isApprove ? "default" : "destructive"}
                        onClick={onConfirm}
                        disabled={pending}
                    >
                        {pending
                            ? isApprove
                                ? "Approving..."
                                : "Rejecting..."
                            : isApprove
                              ? "Approve request"
                              : "Reject request"}
                    </Button>
                </div>
            </div>
        </div>
    );
}

export default ServiceRequestActionDialog;
