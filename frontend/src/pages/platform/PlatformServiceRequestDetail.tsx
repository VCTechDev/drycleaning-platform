import { AlertCircle, ArrowLeft, CheckCircle2, ImageOff, RefreshCw, Wrench } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";

import ApplicationStatusBadge from "../../components/admin/applications/ApplicationStatusBadge";
import ServiceRequestActionDialog from "../../components/admin/serviceRequests/ServiceRequestActionDialog";
import { Button } from "../../components/ui/button";
import { usePlatformServiceRequest } from "../../hooks/platform/usePlatformServiceRequests";
import { usePlatformServiceRequestActions } from "../../hooks/platform/usePlatformServiceRequestActions";
import { formatApplicationDate, formatApplicationDateTime } from "../../lib/applicationDisplay";
import type { PlatformServiceRequestDetail as ServiceRequestData } from "../../types/platform/serviceRequests";

interface FeedbackMessage {
    tone: "success" | "error";
    title: string;
    description: string;
}

function getApiErrorMessage(error: unknown, fallback: string) {
    if (!error || typeof error !== "object" || !("response" in error)) {
        return fallback;
    }

    const response = error.response;
    if (!response || typeof response !== "object" || !("data" in response)) {
        return fallback;
    }

    const data = response.data;
    if (!data || typeof data !== "object") {
        return fallback;
    }

    const messages = Object.values(data as Record<string, unknown>).flatMap((value) =>
        Array.isArray(value) ? value : [value]
    ).filter((value): value is string => typeof value === "string" && Boolean(value.trim()));

    return messages[0] ?? fallback;
}

function ServiceRequestImage({ request }: { request: ServiceRequestData }) {
    const [failedImage, setFailedImage] = useState<string | null>(null);
    const failed = Boolean(request.image && failedImage === request.image);

    if (!request.image || failed) {
        return (
            <div className="flex min-h-64 items-center justify-center rounded-2xl bg-blue-50 text-blue-300">
                {failed ? (
                    <ImageOff className="h-12 w-12" aria-label={`${request.service_name} image unavailable`} />
                ) : (
                    <Wrench className="h-12 w-12" aria-hidden="true" />
                )}
            </div>
        );
    }

    return (
        <img
            src={request.image}
            alt={request.service_name}
            className="max-h-96 w-full rounded-2xl object-cover"
            onError={() => setFailedImage(request.image)}
        />
    );
}

function ServiceRequestDetailError({ onRetry, retrying }: { onRetry: () => void; retrying: boolean }) {
    return (
        <section className="rounded-2xl border border-red-100 bg-white p-8 text-center shadow-sm" role="alert">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
                <RefreshCw className="h-6 w-6" aria-hidden="true" />
            </div>
            <h1 className="mt-4 font-heading text-xl font-semibold text-slate-950">Service request could not be loaded</h1>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">The request may no longer be available, or something went wrong.</p>
            <Button type="button" className="mt-6" onClick={onRetry} disabled={retrying}>{retrying ? "Trying again..." : "Try again"}</Button>
        </section>
    );
}

function DetailField({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <dt className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-400">{label}</dt>
            <dd className="mt-1 break-words text-sm font-medium text-slate-700">{value}</dd>
        </div>
    );
}

function PlatformServiceRequestDetail() {
    const { id } = useParams<{ id: string }>();
    const requestId = id ?? "";
    const { data, isPending, isError, isFetching, refetch } = usePlatformServiceRequest(requestId);
    const { underReviewMutation, approveMutation, rejectMutation } = usePlatformServiceRequestActions(requestId);
    const [dialogMode, setDialogMode] = useState<"approve" | "reject" | null>(null);
    const [rejectionReason, setRejectionReason] = useState("");
    const [rejectionError, setRejectionError] = useState<string | null>(null);
    const [feedback, setFeedback] = useState<FeedbackMessage | null>(null);

    const actionPending = underReviewMutation.isPending || approveMutation.isPending || rejectMutation.isPending;

    const closeDialog = () => {
        if (!actionPending) {
            setDialogMode(null);
            setRejectionError(null);
        }
    };

    const handleUnderReview = () => {
        setFeedback(null);
        underReviewMutation.mutate(undefined, {
            onSuccess: () => setFeedback({ tone: "success", title: "Request moved to review", description: "The request is ready for a platform decision." }),
            onError: (error) => setFeedback({ tone: "error", title: "Could not move request to review", description: getApiErrorMessage(error, "Please try again.") }),
        });
    };

    const handleDialogConfirm = () => {
        if (!data || !dialogMode) {
            return;
        }

        if (dialogMode === "approve") {
            setFeedback(null);
            approveMutation.mutate(undefined, {
                onSuccess: (result) => {
                    setDialogMode(null);
                    setFeedback({ tone: "success", title: "Request approved", description: `Global service #${result.service_id} is now available.` });
                },
                onError: (error) => setFeedback({ tone: "error", title: "Could not approve request", description: getApiErrorMessage(error, "Please try again.") }),
            });
            return;
        }

        if (!rejectionReason.trim()) {
            setRejectionError("Enter a rejection reason.");
            return;
        }

        setRejectionError(null);
        setFeedback(null);
        rejectMutation.mutate({ rejection_reason: rejectionReason }, {
            onSuccess: () => {
                setDialogMode(null);
                setRejectionReason("");
                setFeedback({ tone: "success", title: "Request rejected", description: "The shop administrator can review the rejection reason." });
            },
            onError: (error) => setRejectionError(getApiErrorMessage(error, "The request could not be rejected. Please try again.")),
        });
    };

    if (isPending) {
        return <div className="animate-pulse space-y-6" aria-label="Loading service request"><div className="h-10 w-40 rounded bg-slate-200" /><div className="h-96 rounded-2xl border border-blue-100 bg-white" /></div>;
    }

    if (isError || !data) {
        return <ServiceRequestDetailError onRetry={() => void refetch()} retrying={isFetching} />;
    }

    return (
        <div className="space-y-6">
            <Link to="/platform/service-requests" className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">
                <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to service requests
            </Link>

            <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <p className="text-sm font-semibold text-blue-600">Service request #{data.id}</p>
                    <h1 className="mt-1 break-words font-heading text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">{data.service_name}</h1>
                    <p className="mt-2 text-sm text-slate-500">Submitted {formatApplicationDate(data.created_at)}</p>
                </div>
                <ApplicationStatusBadge status={data.status} />
            </header>

            {feedback && (
                <div className={`flex items-start gap-3 rounded-2xl border p-4 ${feedback.tone === "success" ? "border-emerald-100 bg-emerald-50 text-emerald-800" : "border-red-100 bg-red-50 text-red-800"}`} role={feedback.tone === "error" ? "alert" : "status"}>
                    {feedback.tone === "success" ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" /> : <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />}
                    <div><p className="text-sm font-semibold">{feedback.title}</p><p className="mt-1 text-sm">{feedback.description}</p></div>
                </div>
            )}

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.8fr)]">
                <section className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm sm:p-6">
                    <h2 className="font-heading text-lg font-semibold text-slate-950">Request details</h2>
                    <div className="mt-5"><ServiceRequestImage key={`service-request-image-${data.image ?? "missing"}`} request={data} /></div>
                    <div className="mt-6">
                        <h3 className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-400">Description</h3>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{data.description || "No description provided."}</p>
                    </div>
                </section>

                <aside className="space-y-6">
                    <section className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm sm:p-6">
                        <h2 className="font-heading text-lg font-semibold text-slate-950">Request information</h2>
                        <dl className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-1">
                            <DetailField label="Shop" value={data.shop_name} />
                            <DetailField label="Requester" value={data.requested_by_username} />
                            <DetailField label="Submitted" value={formatApplicationDateTime(data.created_at)} />
                            <DetailField label="Last updated" value={formatApplicationDateTime(data.updated_at)} />
                            <DetailField label="Reviewed by" value={data.reviewed_by_username ?? "Not reviewed"} />
                            <DetailField label="Reviewed at" value={formatApplicationDateTime(data.reviewed_at)} />
                            <DetailField label="Approved service ID" value={data.approved_service_id ? `#${data.approved_service_id}` : "Not approved"} />
                        </dl>
                        {data.rejection_reason && (
                            <div className="mt-6 rounded-xl bg-red-50 p-4">
                                <h3 className="text-sm font-semibold text-red-800">Rejection reason</h3>
                                <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-red-700">{data.rejection_reason}</p>
                            </div>
                        )}
                    </section>

                    {data.status === "pending" && (
                        <section className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm sm:p-6">
                            <Button type="button" className="w-full" onClick={handleUnderReview} disabled={actionPending}>Move to review</Button>
                        </section>
                    )}
                    {data.status === "under_review" && (
                        <section className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm sm:p-6">
                            <h2 className="font-heading text-lg font-semibold text-slate-950">Review decision</h2>
                            <p className="mt-2 text-sm leading-6 text-slate-500">Approve to create or reactivate the global service, or reject with a reason.</p>
                            <div className="mt-5 flex flex-col gap-3 sm:flex-row lg:flex-col xl:flex-row">
                                <Button type="button" className="flex-1" onClick={() => { setRejectionError(null); setDialogMode("approve"); }} disabled={actionPending}>Approve</Button>
                                <Button type="button" variant="destructive" className="flex-1" onClick={() => { setRejectionError(null); setDialogMode("reject"); }} disabled={actionPending}>Reject</Button>
                            </div>
                        </section>
                    )}
                </aside>
            </div>

            <ServiceRequestActionDialog
                mode={dialogMode ?? "approve"}
                open={Boolean(dialogMode)}
                pending={actionPending}
                rejectionReason={rejectionReason}
                rejectionError={rejectionError}
                onClose={closeDialog}
                onConfirm={handleDialogConfirm}
                onRejectionReasonChange={(value) => { setRejectionReason(value); if (rejectionError) setRejectionError(null); }}
            />
        </div>
    );
}

export default PlatformServiceRequestDetail;
