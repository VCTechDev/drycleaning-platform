import { Eye, Filter, RefreshCw, Search, Wrench } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import ApplicationStatusBadge from "../../components/admin/applications/ApplicationStatusBadge";
import PlatformServiceRequestsSkeleton from "../../components/admin/serviceRequests/PlatformServiceRequestsSkeleton";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { usePlatformServiceRequests } from "../../hooks/platform/usePlatformServiceRequests";
import { formatApplicationDate } from "../../lib/applicationDisplay";
import type {
    ServiceRequestStatus,
} from "../../types/platform/serviceRequests";

const statusOptions: { value: "all" | ServiceRequestStatus; label: string }[] = [
    { value: "all", label: "All statuses" },
    { value: "pending", label: "Pending" },
    { value: "under_review", label: "Under Review" },
    { value: "approved", label: "Approved" },
    { value: "rejected", label: "Rejected" },
];

function ServiceRequestListError({
    onRetry,
    retrying,
}: {
    onRetry: () => void;
    retrying: boolean;
}) {
    return (
        <section
            className="rounded-2xl border border-red-100 bg-white p-8 text-center shadow-sm"
            role="alert"
        >
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
                <RefreshCw className="h-6 w-6" aria-hidden="true" />
            </div>
            <h2 className="mt-4 font-heading text-xl font-semibold text-slate-950">
                Service requests could not be loaded
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                Something went wrong while retrieving service requests. Please try again.
            </p>
            <Button type="button" className="mt-6" onClick={onRetry} disabled={retrying}>
                {retrying ? "Trying again..." : "Try again"}
            </Button>
        </section>
    );
}

function ServiceRequestsEmptyState({ hasFilter }: { hasFilter: boolean }) {
    return (
        <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                {hasFilter ? (
                    <Filter className="h-5 w-5" aria-hidden="true" />
                ) : (
                    <Wrench className="h-5 w-5" aria-hidden="true" />
                )}
            </div>
            <h2 className="mt-4 font-heading text-lg font-semibold text-slate-950">
                {hasFilter ? "No service requests found" : "No service requests yet"}
            </h2>
            <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
                {hasFilter
                    ? "Try a different status or shop filter."
                    : "Requests from approved shops will appear here."}
            </p>
        </div>
    );
}

function ServiceRequestViewLink({ requestId, status }: { requestId: number; status: ServiceRequestStatus }) {
    const label = status === "pending" || status === "under_review" ? "Review" : "View";

    return (
        <Link
            to={`/platform/service-requests/${requestId}`}
            className="inline-flex min-h-9 items-center justify-center gap-2 rounded-xl border border-blue-100 bg-white px-3 text-sm font-semibold text-blue-700 transition hover:border-blue-200 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
        >
            <Eye className="h-4 w-4" aria-hidden="true" />
            {label}
        </Link>
    );
}

function PlatformServiceRequests() {
    const [status, setStatus] = useState<"all" | ServiceRequestStatus>("all");
    const [shopInput, setShopInput] = useState("");
    const [shopId, setShopId] = useState<number | undefined>();
    const [filterError, setFilterError] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const filters = {
        ...(status === "all" ? {} : { status }),
        ...(shopId ? { shop: shopId } : {}),
        page,
    };
    const { data, isPending, isError, isFetching, refetch } =
        usePlatformServiceRequests(filters);

    const handleStatusChange = (nextStatus: "all" | ServiceRequestStatus) => {
        setStatus(nextStatus);
        setPage(1);
    };

    const handleShopFilterSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const value = shopInput.trim();

        if (value && (!/^\d+$/.test(value) || Number(value) < 1)) {
            setFilterError("Enter a positive shop ID.");
            return;
        }

        setFilterError(null);
        setShopId(value ? Number(value) : undefined);
        setPage(1);
    };

    const clearFilters = () => {
        setStatus("all");
        setShopInput("");
        setShopId(undefined);
        setFilterError(null);
        setPage(1);
    };

    if (isPending) {
        return <PlatformServiceRequestsSkeleton />;
    }

    if (isError || !data) {
        return <ServiceRequestListError onRetry={() => void refetch()} retrying={isFetching} />;
    }

    const totalPages = Math.max(1, Math.ceil(data.count / 10));
    const firstResult = data.count === 0 ? 0 : (page - 1) * 10 + 1;
    const lastResult = Math.min(page * 10, data.count);
    const hasFilter = status !== "all" || Boolean(shopId);

    return (
        <div className="space-y-6">
            <header className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
                <div>
                    <p className="text-sm font-semibold text-blue-600">Platform workspace</p>
                    <h1 className="mt-1 font-heading text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
                        Service Requests
                    </h1>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                        Review service requests submitted by approved shops before making them globally available.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <label htmlFor="service-request-status" className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                        <Filter className="h-4 w-4 text-blue-600" aria-hidden="true" />
                        <span className="sr-only sm:not-sr-only">Filter</span>
                    </label>
                    <select
                        id="service-request-status"
                        value={status}
                        onChange={(event) =>
                            handleStatusChange(event.target.value as "all" | ServiceRequestStatus)
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

            <section className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm sm:p-5">
                <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={handleShopFilterSubmit}>
                    <div className="w-full max-w-xs">
                        <label htmlFor="service-request-shop" className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                            Filter by shop ID
                        </label>
                        <div className="relative mt-2">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                            <Input
                                id="service-request-shop"
                                inputMode="numeric"
                                value={shopInput}
                                onChange={(event) => setShopInput(event.target.value)}
                                placeholder="e.g. 12"
                                className="pl-9"
                                aria-invalid={Boolean(filterError)}
                                aria-describedby={filterError ? "service-request-shop-error" : undefined}
                            />
                        </div>
                        {filterError && <p id="service-request-shop-error" className="mt-1 text-xs text-red-600">{filterError}</p>}
                    </div>
                    <Button type="submit" variant="outline">Apply shop filter</Button>
                    <Button type="button" variant="ghost" onClick={clearFilters} disabled={!hasFilter && !shopInput}>Clear filters</Button>
                </form>
                <p className="mt-3 text-sm text-slate-500" role="status">
                    {data.count} request{data.count === 1 ? "" : "s"}
                    {isFetching && (
                        <span className="ml-2 inline-flex items-center gap-1 text-xs text-slate-400">
                            <RefreshCw className="h-3 w-3 animate-spin" aria-hidden="true" /> Updating...
                        </span>
                    )}
                </p>
            </section>

            {data.results.length === 0 ? (
                <ServiceRequestsEmptyState hasFilter={hasFilter} />
            ) : (
                <>
                    <div className="hidden overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm md:block">
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[820px] text-left text-sm">
                                <caption className="sr-only">Platform service requests</caption>
                                <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-[0.12em] text-slate-500">
                                    <tr>
                                        <th scope="col" className="px-6 py-4 font-semibold">Service request</th>
                                        <th scope="col" className="px-6 py-4 font-semibold">Shop</th>
                                        <th scope="col" className="px-6 py-4 font-semibold">Requester</th>
                                        <th scope="col" className="px-6 py-4 font-semibold">Status</th>
                                        <th scope="col" className="px-6 py-4 font-semibold">Submitted</th>
                                        <th scope="col" className="px-6 py-4 text-right font-semibold">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {data.results.map((request) => (
                                        <tr key={request.id} className="align-middle transition hover:bg-blue-50/40">
                                            <td className="max-w-64 px-6 py-4">
                                                <p className="truncate font-semibold text-slate-900">{request.service_name}</p>
                                                <p className="mt-1 text-xs text-slate-500">Request #{request.id}</p>
                                            </td>
                                            <td className="max-w-48 truncate px-6 py-4 text-slate-700">{request.shop_name}</td>
                                            <td className="max-w-48 truncate px-6 py-4 text-slate-600">{request.requested_by_username}</td>
                                            <td className="px-6 py-4"><ApplicationStatusBadge status={request.status} /></td>
                                            <td className="whitespace-nowrap px-6 py-4 text-slate-600">{formatApplicationDate(request.created_at)}</td>
                                            <td className="px-6 py-4 text-right"><ServiceRequestViewLink requestId={request.id} status={request.status} /></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="space-y-3 md:hidden">
                        {data.results.map((request) => (
                            <article key={request.id} className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="truncate font-heading text-base font-semibold text-slate-950">{request.service_name}</p>
                                        <p className="mt-1 truncate text-sm text-slate-500">{request.shop_name}</p>
                                    </div>
                                    <ApplicationStatusBadge status={request.status} />
                                </div>
                                <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-slate-100 pt-4 text-sm">
                                    <div>
                                        <dt className="text-xs font-medium text-slate-400">Requester</dt>
                                        <dd className="mt-1 truncate font-medium text-slate-700">{request.requested_by_username}</dd>
                                    </div>
                                    <div>
                                        <dt className="text-xs font-medium text-slate-400">Submitted</dt>
                                        <dd className="mt-1 font-medium text-slate-700">{formatApplicationDate(request.created_at)}</dd>
                                    </div>
                                </dl>
                                <div className="mt-5"><ServiceRequestViewLink requestId={request.id} status={request.status} /></div>
                            </article>
                        ))}
                    </div>

                    <nav className="flex flex-col gap-4 rounded-2xl border border-blue-100 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between" aria-label="Service request pagination">
                        <p className="text-sm text-slate-500">
                            Showing <span className="font-semibold text-slate-700">{firstResult}-{lastResult}</span> of <span className="font-semibold text-slate-700">{data.count}</span>
                        </p>
                        <div className="flex items-center gap-2">
                            <Button type="button" variant="outline" size="sm" onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))} disabled={!data.previous || isFetching}>Previous</Button>
                            <span className="min-w-20 text-center text-sm font-medium text-slate-600">Page {page} of {totalPages}</span>
                            <Button type="button" variant="outline" size="sm" onClick={() => setPage((currentPage) => currentPage + 1)} disabled={!data.next || isFetching}>Next</Button>
                        </div>
                    </nav>
                </>
            )}
        </div>
    );
}

export default PlatformServiceRequests;
