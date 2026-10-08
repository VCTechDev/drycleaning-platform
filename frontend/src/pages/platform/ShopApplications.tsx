import { Eye, Filter, RefreshCw } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import ApplicationStatusBadge from "../../components/admin/applications/ApplicationStatusBadge";
import ShopApplicationsSkeleton from "../../components/admin/applications/ShopApplicationsSkeleton";
import { Button } from "../../components/ui/button";
import { useShopApplications } from "../../hooks/platform/useShopApplications";
import { formatApplicationDate, formatApplicationLocation } from "../../lib/applicationDisplay";
import type {
    ShopApplicationStatus,
} from "../../types/platform/applications";

const statusOptions: { value: "all" | ShopApplicationStatus; label: string }[] = [
    { value: "all", label: "All statuses" },
    { value: "submitted", label: "Submitted" },
    { value: "under_review", label: "Under Review" },
    { value: "approved", label: "Approved" },
    { value: "rejected", label: "Rejected" },
];

const getErrorMessage = () =>
    "Shop applications could not be loaded. Please try again.";

function ApplicationListError({ onRetry, retrying }: { onRetry: () => void; retrying: boolean }) {
    return (
        <section className="rounded-2xl border border-red-100 bg-white p-8 text-center shadow-sm" role="alert">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
                <RefreshCw className="h-6 w-6" aria-hidden="true" />
            </div>
            <h2 className="mt-4 font-heading text-xl font-semibold text-slate-950">
                Shop applications could not be loaded.
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                {getErrorMessage()}
            </p>
            <Button type="button" className="mt-6" onClick={onRetry} disabled={retrying}>
                {retrying ? "Trying again..." : "Try again"}
            </Button>
        </section>
    );
}

function ApplicationsEmptyState() {
    return (
        <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                <Filter className="h-5 w-5" aria-hidden="true" />
            </div>
            <h2 className="mt-4 font-heading text-lg font-semibold text-slate-950">
                No shop applications found
            </h2>
            <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
                Try a different status filter or check again later.
            </p>
        </div>
    );
}

function ApplicationViewLink({ publicId }: { publicId: string }) {
    return (
        <Link
            to={`/platform/applications/${publicId}`}
            className="inline-flex min-h-9 items-center justify-center gap-2 rounded-xl border border-blue-100 bg-white px-3 text-sm font-semibold text-blue-700 transition hover:border-blue-200 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
        >
            <Eye className="h-4 w-4" aria-hidden="true" />
            View
        </Link>
    );
}

function ShopApplications() {
    const [status, setStatus] = useState<"all" | ShopApplicationStatus>("all");
    const [page, setPage] = useState(1);
    const filters = {
        ...(status === "all" ? {} : { status }),
        page,
    };
    const { data, isPending, isError, isFetching, refetch } =
        useShopApplications(filters);

    const handleStatusChange = (nextStatus: "all" | ShopApplicationStatus) => {
        setStatus(nextStatus);
        setPage(1);
    };

    if (isPending) {
        return <ShopApplicationsSkeleton />;
    }

    if (isError || !data) {
        return <ApplicationListError onRetry={() => void refetch()} retrying={isFetching} />;
    }

    const totalPages = Math.max(1, Math.ceil(data.count / 10));
    const firstResult = data.count === 0 ? 0 : (page - 1) * 10 + 1;
    const lastResult = Math.min(page * 10, data.count);

    return (
        <div className="space-y-6">
            <header className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
                <div>
                    <p className="text-sm font-semibold text-blue-600">Platform workspace</p>
                    <h1 className="mt-1 font-heading text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
                        Shop Applications
                    </h1>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                        Review and manage businesses applying to join VeeCleen.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <label htmlFor="application-status" className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                        <Filter className="h-4 w-4 text-blue-600" aria-hidden="true" />
                        <span className="sr-only sm:not-sr-only">Filter</span>
                    </label>
                    <select
                        id="application-status"
                        value={status}
                        onChange={(event) =>
                            handleStatusChange(event.target.value as "all" | ShopApplicationStatus)
                        }
                        className="min-h-10 rounded-xl border border-blue-100 bg-white px-3 text-sm font-medium text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                    >
                        {statusOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                </div>
            </header>

            {isFetching && (
                <p className="-mt-2 flex items-center justify-end gap-2 text-xs text-slate-400" role="status">
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    Updating applications...
                </p>
            )}

            {data.results.length === 0 ? (
                <ApplicationsEmptyState />
            ) : (
                <>
                    <div className="hidden overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm md:block">
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[760px] text-left text-sm">
                                <caption className="sr-only">Shop applications</caption>
                                <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-[0.12em] text-slate-500">
                                    <tr>
                                        <th scope="col" className="px-6 py-4 font-semibold">Application / Shop</th>
                                        <th scope="col" className="px-6 py-4 font-semibold">Owner</th>
                                        <th scope="col" className="px-6 py-4 font-semibold">Location</th>
                                        <th scope="col" className="px-6 py-4 font-semibold">Status</th>
                                        <th scope="col" className="px-6 py-4 font-semibold">Submitted</th>
                                        <th scope="col" className="px-6 py-4 text-right font-semibold">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {data.results.map((application) => (
                                        <tr key={application.public_id} className="align-middle transition hover:bg-blue-50/40">
                                            <td className="max-w-64 px-6 py-4">
                                                <p className="truncate font-semibold text-slate-900">{application.shop_name}</p>
                                                <p className="mt-1 truncate text-xs text-slate-500">Application {application.public_id.slice(0, 8)}...</p>
                                            </td>
                                            <td className="max-w-48 truncate px-6 py-4 text-slate-700">{application.owner_name || "Owner unavailable"}</td>
                                            <td className="max-w-56 truncate px-6 py-4 text-slate-600">
                                                {formatApplicationLocation(application.city, application.district)}
                                            </td>
                                            <td className="px-6 py-4"><ApplicationStatusBadge status={application.status} /></td>
                                            <td className="whitespace-nowrap px-6 py-4 text-slate-600">{formatApplicationDate(application.created_at)}</td>
                                            <td className="px-6 py-4 text-right"><ApplicationViewLink publicId={application.public_id} /></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="space-y-3 md:hidden">
                        {data.results.map((application) => (
                            <article key={application.public_id} className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="truncate font-heading text-base font-semibold text-slate-950">{application.shop_name}</p>
                                        <p className="mt-1 truncate text-sm text-slate-500">{formatApplicationLocation(application.city, application.district)}</p>
                                    </div>
                                    <ApplicationStatusBadge status={application.status} />
                                </div>
                                <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-slate-100 pt-4 text-sm">
                                    <div>
                                        <dt className="text-xs font-medium text-slate-400">Owner</dt>
                                        <dd className="mt-1 truncate font-medium text-slate-700">{application.owner_name || "Unavailable"}</dd>
                                    </div>
                                    <div>
                                        <dt className="text-xs font-medium text-slate-400">Submitted</dt>
                                        <dd className="mt-1 font-medium text-slate-700">{formatApplicationDate(application.created_at)}</dd>
                                    </div>
                                </dl>
                                <div className="mt-5"><ApplicationViewLink publicId={application.public_id} /></div>
                            </article>
                        ))}
                    </div>

                    <nav className="flex flex-col gap-4 rounded-2xl border border-blue-100 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between" aria-label="Shop application pagination">
                        <p className="text-sm text-slate-500">
                            Showing <span className="font-semibold text-slate-700">{firstResult}-{lastResult}</span> of <span className="font-semibold text-slate-700">{data.count}</span>
                        </p>
                        <div className="flex items-center gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))}
                                disabled={!data.previous || isFetching}
                            >
                                Previous
                            </Button>
                            <span className="min-w-20 text-center text-sm font-medium text-slate-600">Page {page} of {totalPages}</span>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setPage((currentPage) => currentPage + 1)}
                                disabled={!data.next || isFetching}
                            >
                                Next
                            </Button>
                        </div>
                    </nav>
                </>
            )}
        </div>
    );
}

export default ShopApplications;
