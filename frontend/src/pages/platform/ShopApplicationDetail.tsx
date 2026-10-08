import {
    AlertCircle,
    ArrowLeft,
    Building2,
    CalendarDays,
    CheckCircle2,
    Clock3,
    MapPin,
    RefreshCw,
    Store,
    UserRound,
} from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";

import ApplicationActionDialog from "../../components/admin/applications/ApplicationActionDialog";
import ApplicationStatusBadge from "../../components/admin/applications/ApplicationStatusBadge";
import ShopApplicationDetailSkeleton from "../../components/admin/applications/ShopApplicationDetailSkeleton";
import { Button } from "../../components/ui/button";
import { useShopApplication } from "../../hooks/platform/useShopApplication";
import { useShopApplicationActions } from "../../hooks/platform/useShopApplicationActions";
import {
    formatApplicationDate,
    formatApplicationDateTime,
    formatApplicationLocation,
    formatApplicationTime,
} from "../../lib/applicationDisplay";
import type { ApplicationActionNotification } from "../../types/platform/applications";

interface FeedbackMessage {
    tone: "success" | "error";
    title: string;
    description: string;
}

function DetailError({ onRetry, retrying }: { onRetry?: () => void; retrying?: boolean }) {
    return (
        <section className="rounded-2xl border border-red-100 bg-white p-8 text-center shadow-sm" role="alert">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
                <AlertCircle className="h-6 w-6" aria-hidden="true" />
            </div>
            <h1 className="mt-4 font-heading text-xl font-semibold text-slate-950">
                Shop application could not be loaded
            </h1>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                The application may no longer be available, or the request failed. Please try again.
            </p>
            {onRetry && (
                <Button type="button" className="mt-6" onClick={onRetry} disabled={retrying}>
                    {retrying ? "Trying again..." : "Try again"}
                </Button>
            )}
        </section>
    );
}

function DetailSection({
    title,
    icon: Icon,
    children,
}: {
    title: string;
    icon: typeof Building2;
    children: React.ReactNode;
}) {
    return (
        <section className="min-w-0 rounded-2xl border border-blue-100 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                    <Icon className="h-4.5 w-4.5" aria-hidden="true" />
                </div>
                <h2 className="font-heading text-base font-semibold text-slate-950">{title}</h2>
            </div>
            <div className="pt-5">{children}</div>
        </section>
    );
}

function DetailField({ label, value }: { label: string; value: string }) {
    return (
        <div className="min-w-0">
            <dt className="text-xs font-medium text-slate-400">{label}</dt>
            <dd className="mt-1 break-words text-sm font-medium text-slate-800">{value}</dd>
        </div>
    );
}

function ApplicationImage({ image, shopName }: { image: string | null; shopName: string }) {
    const [failed, setFailed] = useState(false);

    if (!image || failed) {
        return (
            <div className="flex h-56 items-center justify-center rounded-xl bg-slate-100 text-slate-400 sm:h-64">
                <div className="text-center">
                    <Store className="mx-auto h-9 w-9" aria-hidden="true" />
                    <p className="mt-2 text-sm">No shop image available</p>
                </div>
            </div>
        );
    }

    return (
        <img
            src={image}
            alt={`${shopName} submitted shop`}
            onError={() => setFailed(true)}
            className="h-56 w-full rounded-xl object-cover sm:h-64"
        />
    );
}

function getNotificationMessage(notification: ApplicationActionNotification) {
    if (notification.delivered) {
        return "Approval email delivered to the applicant.";
    }

    if (notification.status === "failed") {
        return "Approval email delivery could not be confirmed.";
    }

    return "Approval email has been queued for delivery.";
}

const applicationStatusLabels: Record<string, string> = {
    draft: "Draft",
    submitted: "Submitted",
    under_review: "Under Review",
    approved: "Approved",
    rejected: "Rejected",
};

const getApplicationStatusLabel = (status: string) =>
    applicationStatusLabels[status] ?? "Status unavailable";

const getFinalDecisionLabel = (status: string) => {
    if (status === "approved") {
        return "Approved";
    }

    if (status === "rejected") {
        return "Rejected";
    }

    return "Pending";
};

function ShopApplicationDetail() {
    const { publicId } = useParams<{ publicId: string }>();
    const { data, isPending, isError, isFetching, refetch } = useShopApplication(publicId);
    const { underReviewMutation, approveMutation, rejectMutation } = useShopApplicationActions(publicId ?? "");
    const [dialog, setDialog] = useState<"approve" | "reject" | null>(null);
    const [rejectionReason, setRejectionReason] = useState("");
    const [rejectionError, setRejectionError] = useState<string | null>(null);
    const [feedback, setFeedback] = useState<FeedbackMessage | null>(null);

    if (!publicId) {
        return <DetailError />;
    }

    if (isPending) {
        return <ShopApplicationDetailSkeleton />;
    }

    if (isError || !data) {
        return <DetailError onRetry={() => void refetch()} retrying={isFetching} />;
    }

    const actionPending =
        underReviewMutation.isPending || approveMutation.isPending || rejectMutation.isPending;

    const handleMoveToReview = () => {
        setFeedback(null);
        underReviewMutation.mutate(undefined, {
            onSuccess: () =>
                setFeedback({
                    tone: "success",
                    title: "Application moved to review",
                    description: "The application is now ready for an approval decision.",
                }),
            onError: () =>
                setFeedback({
                    tone: "error",
                    title: "Application could not be moved to review",
                    description: "The status may have changed. Refresh and try again.",
                }),
        });
    };

    const handleApprove = () => {
        setFeedback(null);
        approveMutation.mutate(undefined, {
            onSuccess: (result) => {
                setDialog(null);
                setFeedback({
                    tone: "success",
                    title: "Shop created successfully",
                    description: `Shop Admin username: ${result.shop_admin_username}. ${getNotificationMessage(result.notification)}`,
                });
            },
            onError: () =>
                setFeedback({
                    tone: "error",
                    title: "Application could not be approved",
                    description: "No changes were confirmed. Refresh and try again.",
                }),
        });
    };

    const handleReject = () => {
        const trimmedReason = rejectionReason.trim();

        if (!trimmedReason) {
            setRejectionError("Enter a rejection reason before continuing.");
            return;
        }

        setRejectionError(null);
        setFeedback(null);
        rejectMutation.mutate(
            { rejection_reason: trimmedReason },
            {
                onSuccess: (result) => {
                    setDialog(null);
                    setRejectionReason("");
                    setFeedback({
                        tone: "success",
                        title: "Application rejected",
                        description: result.notification.delivered
                            ? "The rejection reason was saved and the applicant notification was delivered."
                            : "The rejection reason was saved, but notification delivery could not be confirmed.",
                    });
                },
                onError: () =>
                    setFeedback({
                        tone: "error",
                        title: "Application could not be rejected",
                        description: "No changes were confirmed. Refresh and try again.",
                    }),
            }
        );
    };

    const openRejectDialog = () => {
        setRejectionError(null);
        setDialog("reject");
    };

    return (
        <div className="space-y-6">
            <header className="space-y-4">
                <Link
                    to="/platform/applications"
                    className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700 transition hover:text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                >
                    <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                    Back to applications
                </Link>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                        <p className="text-sm font-semibold text-blue-600">Application review</p>
                        <h1 className="mt-1 break-words font-heading text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
                            {data.shop_name || "Shop application"}
                        </h1>
                        <p className="mt-2 text-sm text-slate-500">
                            Submitted {formatApplicationDate(data.created_at)}
                        </p>
                    </div>
                    <ApplicationStatusBadge status={data.status} />
                </div>
            </header>

            {feedback && (
                <div
                    className={`flex items-start gap-3 rounded-2xl border p-4 ${feedback.tone === "success" ? "border-emerald-100 bg-emerald-50 text-emerald-800" : "border-red-100 bg-red-50 text-red-800"}`}
                    role={feedback.tone === "error" ? "alert" : "status"}
                >
                    {feedback.tone === "success" ? (
                        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                    ) : (
                        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                    )}
                    <div>
                        <p className="text-sm font-semibold">{feedback.title}</p>
                        <p className="mt-1 text-sm">{feedback.description}</p>
                    </div>
                </div>
            )}

            <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(280px,1fr)]">
                <div className="min-w-0 space-y-6">
                    <DetailSection title="Applicant" icon={UserRound}>
                        <dl className="grid gap-5 sm:grid-cols-3">
                            <DetailField label="Owner" value={data.owner_name || "Not provided"} />
                            <DetailField label="Email" value={data.email || "Not provided"} />
                            <DetailField label="Phone" value={data.phone_number || "Not provided"} />
                        </dl>
                    </DetailSection>

                    <DetailSection title="Business" icon={Building2}>
                        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(220px,0.8fr)] lg:items-start">
                            <div className="min-w-0">
                                <dl className="space-y-5">
                                    <DetailField label="Shop name" value={data.shop_name || "Not provided"} />
                                    <DetailField label="Description" value={data.description || "No description provided."} />
                                </dl>
                            </div>
                            <ApplicationImage
                                key={data.image ?? "no-image"}
                                image={data.image}
                                shopName={data.shop_name}
                            />
                        </div>
                    </DetailSection>

                    <DetailSection title="Location" icon={MapPin}>
                        <dl className="grid gap-5 sm:grid-cols-2">
                            <DetailField label="Address" value={data.address_line || "Not provided"} />
                            <DetailField label="City / district" value={formatApplicationLocation(data.city, data.district)} />
                            <DetailField label="State" value={data.state || "Not provided"} />
                            <DetailField label="Pincode" value={data.pincode || "Not provided"} />
                        </dl>
                    </DetailSection>

                    <DetailSection title="Operating hours" icon={Clock3}>
                        <dl className="grid gap-5 sm:grid-cols-2">
                            <DetailField label="Opening time" value={formatApplicationTime(data.opening_time)} />
                            <DetailField label="Closing time" value={formatApplicationTime(data.closing_time)} />
                        </dl>
                    </DetailSection>
                </div>

                <aside className="min-w-0 space-y-6 lg:self-start">
                    <div className="lg:top-28">
                        <section className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm sm:p-6">
                        <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                                <CheckCircle2 className="h-4.5 w-4.5" aria-hidden="true" />
                            </div>
                            <h2 className="font-heading text-base font-semibold text-slate-950">Review actions</h2>
                        </div>
                        <div className="mt-5 space-y-3">
                            {data.status === "submitted" && (
                                <Button type="button" className="w-full" onClick={handleMoveToReview} disabled={actionPending}>
                                    {underReviewMutation.isPending ? "Moving to review..." : "Move to Review"}
                                </Button>
                            )}
                            {data.status === "under_review" && (
                                <>
                                    <Button type="button" className="w-full" onClick={() => setDialog("approve")} disabled={actionPending}>
                                        Approve Application
                                    </Button>
                                    <Button type="button" variant="destructive" className="w-full" onClick={openRejectDialog} disabled={actionPending}>
                                        Reject Application
                                    </Button>
                                </>
                            )}
                            {data.status === "approved" && (
                                <div className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">
                                    <p className="font-semibold">This application is approved.</p>
                                    <p className="mt-1 leading-6">No further review actions are available.</p>
                                </div>
                            )}
                            {data.status === "rejected" && (
                                <div className="rounded-xl bg-red-50 p-4 text-sm text-red-800">
                                    <p className="font-semibold">This application is rejected.</p>
                                    <p className="mt-1 leading-6">No further review actions are available.</p>
                                </div>
                            )}
                            {data.status === "draft" && (
                                <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
                                    <p className="font-semibold">Draft application</p>
                                    <p className="mt-1 leading-6">This application is not ready for platform review.</p>
                                </div>
                            )}
                        </div>
                        </section>
                    </div>

                    <DetailSection title="Review information" icon={CalendarDays}>
                        <dl className="space-y-5">
                            <DetailField label="Current status" value={getApplicationStatusLabel(data.status)} />
                            <DetailField label="Final decision" value={getFinalDecisionLabel(data.status)} />
                            {data.reviewed_by_username && <DetailField label="Reviewed by" value={data.reviewed_by_username} />}
                            {data.reviewed_at && <DetailField label="Reviewed at" value={formatApplicationDateTime(data.reviewed_at)} />}
                            {data.approved_user_username && <DetailField label="Shop Admin username" value={data.approved_user_username} />}
                            {data.created_shop_id && <DetailField label="Created shop ID" value={String(data.created_shop_id)} />}
                            {data.rejection_reason && <DetailField label="Rejection reason" value={data.rejection_reason} />}
                        </dl>
                    </DetailSection>

                    <DetailSection title="Application timeline" icon={RefreshCw}>
                        <ol className="space-y-5 border-l border-blue-100 pl-5">
                            <li className="relative">
                                <span className="absolute -left-[1.6rem] top-0.5 h-3 w-3 rounded-full border-2 border-white bg-blue-500 ring-1 ring-blue-100" aria-hidden="true" />
                                <p className="text-sm font-semibold text-slate-800">Application received</p>
                                <p className="mt-1 text-xs text-slate-500">{formatApplicationDateTime(data.created_at)}</p>
                            </li>
                            {data.reviewed_at && (
                                <li className="relative">
                                    <span className="absolute -left-[1.6rem] top-0.5 h-3 w-3 rounded-full border-2 border-white bg-blue-500 ring-1 ring-blue-100" aria-hidden="true" />
                                    <p className="text-sm font-semibold text-slate-800">Application reviewed</p>
                                    <p className="mt-1 text-xs text-slate-500">{formatApplicationDateTime(data.reviewed_at)}</p>
                                </li>
                            )}
                            <li className="relative">
                                <span className="absolute -left-[1.6rem] top-0.5 h-3 w-3 rounded-full border-2 border-white bg-slate-400 ring-1 ring-slate-100" aria-hidden="true" />
                                <p className="text-sm font-semibold text-slate-800">Last updated</p>
                                <p className="mt-1 text-xs text-slate-500">{formatApplicationDateTime(data.updated_at)}</p>
                            </li>
                        </ol>
                        {data.notifications.length > 0 && (
                            <div className="mt-6 border-t border-slate-100 pt-5">
                                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Notification delivery</p>
                                <div className="mt-3 space-y-3">
                                    {data.notifications.map((notification, index) => (
                                        <div key={`${notification.type}-${notification.status}-${index}`} className="rounded-xl bg-slate-50 p-3 text-sm">
                                            <div className="flex items-center justify-between gap-3">
                                                <span className="font-medium capitalize text-slate-700">{notification.type.replaceAll("_", " ")}</span>
                                                <span className="font-semibold text-slate-700">{notification.status}</span>
                                            </div>
                                            <p className="mt-1 text-xs text-slate-500">
                                                {notification.attempts} attempt{notification.attempts === 1 ? "" : "s"}
                                                {notification.sent_at ? ` · Sent ${formatApplicationDateTime(notification.sent_at)}` : ""}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </DetailSection>
                </aside>
            </div>

            <ApplicationActionDialog
                mode="approve"
                open={dialog === "approve"}
                pending={approveMutation.isPending}
                rejectionReason={rejectionReason}
                rejectionError={rejectionError}
                onClose={() => setDialog(null)}
                onConfirm={handleApprove}
                onRejectionReasonChange={setRejectionReason}
            />
            <ApplicationActionDialog
                mode="reject"
                open={dialog === "reject"}
                pending={rejectMutation.isPending}
                rejectionReason={rejectionReason}
                rejectionError={rejectionError}
                onClose={() => setDialog(null)}
                onConfirm={handleReject}
                onRejectionReasonChange={(value) => {
                    setRejectionReason(value);
                    if (rejectionError) {
                        setRejectionError(null);
                    }
                }}
            />
        </div>
    );
}

export default ShopApplicationDetail;
