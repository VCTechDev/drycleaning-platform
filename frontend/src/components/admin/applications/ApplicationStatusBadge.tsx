import {
    CheckCircle2,
    CircleDot,
    Clock3,
    FileText,
    XCircle,
} from "lucide-react";

interface ApplicationStatusBadgeProps {
    status: string;
}

const statusMeta: Record<
    string,
    { label: string; className: string; icon: typeof CircleDot }
> = {
    draft: {
        label: "Draft",
        className: "bg-slate-100 text-slate-700",
        icon: FileText,
    },
    submitted: {
        label: "Submitted",
        className: "bg-blue-50 text-blue-700",
        icon: CircleDot,
    },
    under_review: {
        label: "Under Review",
        className: "bg-amber-50 text-amber-700",
        icon: Clock3,
    },
    approved: {
        label: "Approved",
        className: "bg-emerald-50 text-emerald-700",
        icon: CheckCircle2,
    },
    rejected: {
        label: "Rejected",
        className: "bg-red-50 text-red-700",
        icon: XCircle,
    },
};

function ApplicationStatusBadge({ status }: ApplicationStatusBadgeProps) {
    const meta =
        statusMeta[status] ?? {
            label: "Status unavailable",
            className: "bg-slate-100 text-slate-700",
            icon: CircleDot,
        };
    const Icon = meta.icon;

    return (
        <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${meta.className}`}
        >
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            {meta.label}
        </span>
    );
}

export default ApplicationStatusBadge;
