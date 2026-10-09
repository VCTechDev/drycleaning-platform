import {
    ArrowUpDown,
    Eye,
    Filter,
    MapPin,
    RefreshCw,
    Search,
    Store,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import OperationalStatusControl from "../../components/admin/shops/OperationalStatusControl";
import PlatformShopsSkeleton from "../../components/admin/shops/PlatformShopsSkeleton";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { usePlatformShops } from "../../hooks/platform/usePlatformShops";
import {
    formatApplicationDate,
    formatApplicationLocation,
} from "../../lib/applicationDisplay";
import type {
    PlatformShopFilters,
    PlatformShopOrdering,
} from "../../types/platform/shops";

const PAGE_SIZE = 10;

const districtOptions = [
    "Thiruvananthapuram",
    "Kollam",
    "Pathanamthitta",
    "Alappuzha",
    "Kottayam",
    "Idukki",
    "Ernakulam",
    "Thrissur",
    "Palakkad",
    "Malappuram",
    "Kozhikode",
    "Wayanad",
    "Kannur",
    "Kasaragod",
];

type ShopStatusFilter = "all" | "open" | "closed";

interface ShopListControls {
    search: string;
    status: ShopStatusFilter;
    district: string;
    city: string;
    ordering: PlatformShopOrdering;
}

const initialControls: ShopListControls = {
    search: "",
    status: "all",
    district: "",
    city: "",
    ordering: "shop_name",
};

const getShopFilters = (
    controls: ShopListControls,
    page: number
): PlatformShopFilters => ({
    search: controls.search || undefined,
    is_open:
        controls.status === "all" ? undefined : controls.status === "open",
    district: controls.district || undefined,
    city: controls.city || undefined,
    ordering: controls.ordering,
    page,
});

function ShopsListError({
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
            <h1 className="mt-4 font-heading text-xl font-semibold text-slate-950">
                Shops could not be loaded
            </h1>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                Something went wrong while retrieving approved shops. Please try again.
            </p>
            <Button type="button" className="mt-6" onClick={onRetry} disabled={retrying}>
                {retrying ? "Trying again..." : "Try again"}
            </Button>
        </section>
    );
}

function ShopsEmptyState({ filtered }: { filtered: boolean }) {
    return (
        <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                {filtered ? (
                    <Filter className="h-5 w-5" aria-hidden="true" />
                ) : (
                    <Store className="h-5 w-5" aria-hidden="true" />
                )}
            </div>
            <h2 className="mt-4 font-heading text-lg font-semibold text-slate-950">
                {filtered ? "No shops match these filters" : "No approved shops yet"}
            </h2>
            <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
                {filtered
                    ? "Try changing your search or filter selections."
                    : "Approved shops will appear here once they are available."}
            </p>
        </div>
    );
}

function ShopViewLink({ shopId }: { shopId: number }) {
    return (
        <Link
            to={`/platform/shops/${shopId}`}
            className="inline-flex min-h-9 items-center justify-center gap-2 rounded-xl border border-blue-100 bg-white px-3 text-sm font-semibold text-blue-700 transition hover:border-blue-200 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
        >
            <Eye className="h-4 w-4" aria-hidden="true" />
            View
        </Link>
    );
}

function PlatformShops() {
    const [controls, setControls] = useState(initialControls);
    const [appliedControls, setAppliedControls] = useState(initialControls);
    const [page, setPage] = useState(1);
    const filters = getShopFilters(appliedControls, page);
    const { data, isPending, isError, isFetching, refetch } =
        usePlatformShops(filters);

    const applyFilters = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setAppliedControls({
            ...controls,
            search: controls.search.trim(),
            city: controls.city.trim(),
        });
        setPage(1);
    };

    const resetFilters = () => {
        setControls(initialControls);
        setAppliedControls(initialControls);
        setPage(1);
    };

    if (isPending) {
        return <PlatformShopsSkeleton />;
    }

    if (isError || !data) {
        return <ShopsListError onRetry={() => void refetch()} retrying={isFetching} />;
    }

    const totalPages = Math.max(1, Math.ceil(data.count / PAGE_SIZE));
    const firstResult = data.count === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
    const lastResult = Math.min(page * PAGE_SIZE, data.count);
    const hasActiveFilters = Boolean(
        appliedControls.search ||
            appliedControls.district ||
            appliedControls.city ||
            appliedControls.status !== "all"
    );

    return (
        <div className="space-y-6">
            <header className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
                <div>
                    <p className="text-sm font-semibold text-blue-600">Platform workspace</p>
                    <h1 className="mt-1 font-heading text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
                        Shops
                    </h1>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                        View approved shops, monitor their operating status, and inspect shop details.
                    </p>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-500">
                    <Store className="h-4 w-4 text-blue-600" aria-hidden="true" />
                    <span>{data.count} approved shop{data.count === 1 ? "" : "s"}</span>
                </div>
            </header>

            <form
                onSubmit={applyFilters}
                className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm sm:p-5"
            >
                <div className="grid gap-4 lg:grid-cols-[minmax(16rem,1.5fr)_repeat(4,minmax(0,1fr))_auto] lg:items-end">
                    <div>
                        <label htmlFor="shop-search" className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                            Search shops
                        </label>
                        <div className="relative mt-2">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                            <Input
                                id="shop-search"
                                value={controls.search}
                                onChange={(event) =>
                                    setControls((current) => ({
                                        ...current,
                                        search: event.target.value,
                                    }))
                                }
                                placeholder="Name, city, admin username..."
                                className="pl-9"
                            />
                        </div>
                    </div>

                    <div>
                        <label htmlFor="shop-status" className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                            Status
                        </label>
                        <select
                            id="shop-status"
                            value={controls.status}
                            onChange={(event) =>
                                setControls((current) => ({
                                    ...current,
                                    status: event.target.value as ShopStatusFilter,
                                }))
                            }
                            className="mt-2 min-h-9 w-full rounded-4xl border border-input bg-input/30 px-3 text-sm text-slate-700 outline-none transition focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                        >
                            <option value="all">All statuses</option>
                            <option value="open">Open</option>
                            <option value="closed">Closed</option>
                        </select>
                    </div>

                    <div>
                        <label htmlFor="shop-district" className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                            District
                        </label>
                        <select
                            id="shop-district"
                            value={controls.district}
                            onChange={(event) =>
                                setControls((current) => ({
                                    ...current,
                                    district: event.target.value,
                                }))
                            }
                            className="mt-2 min-h-9 w-full rounded-4xl border border-input bg-input/30 px-3 text-sm text-slate-700 outline-none transition focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                        >
                            <option value="">All districts</option>
                            {districtOptions.map((district) => (
                                <option key={district} value={district}>
                                    {district}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label htmlFor="shop-city" className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                            City
                        </label>
                        <Input
                            id="shop-city"
                            value={controls.city}
                            onChange={(event) =>
                                setControls((current) => ({
                                    ...current,
                                    city: event.target.value,
                                }))
                            }
                            placeholder="Filter by city"
                            className="mt-2"
                        />
                    </div>

                    <div>
                        <label htmlFor="shop-ordering" className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                            Sort by
                        </label>
                        <div className="relative mt-2">
                            <ArrowUpDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                            <select
                                id="shop-ordering"
                                value={controls.ordering}
                                onChange={(event) =>
                                    setControls((current) => ({
                                        ...current,
                                        ordering: event.target.value as PlatformShopOrdering,
                                    }))
                                }
                                className="min-h-9 w-full appearance-none rounded-4xl border border-input bg-input/30 px-3 pr-9 text-sm text-slate-700 outline-none transition focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                            >
                                <option value="shop_name">Shop name: A to Z</option>
                                <option value="-shop_name">Shop name: Z to A</option>
                                <option value="created_at">Created: oldest first</option>
                                <option value="-created_at">Created: newest first</option>
                            </select>
                        </div>
                    </div>

                    <div className="flex gap-2 lg:justify-end">
                        <Button type="submit" className="flex-1 lg:flex-none">
                            Apply
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={resetFilters}
                            disabled={!hasActiveFilters && controls.ordering === initialControls.ordering}
                        >
                            Reset
                        </Button>
                    </div>
                </div>
            </form>

            {isFetching && (
                <p className="-mt-2 flex items-center justify-end gap-2 text-xs text-slate-400" role="status">
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    Updating shops...
                </p>
            )}

            {data.results.length === 0 ? (
                <ShopsEmptyState filtered={hasActiveFilters} />
            ) : (
                <>
                    <div className="hidden overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm md:block">
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[900px] text-left text-sm">
                                <caption className="sr-only">Approved shops</caption>
                                <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-[0.12em] text-slate-500">
                                    <tr>
                                        <th scope="col" className="px-6 py-4 font-semibold">Shop</th>
                                        <th scope="col" className="px-6 py-4 font-semibold">Location</th>
                                        <th scope="col" className="px-6 py-4 font-semibold">Shop Admin</th>
                                        <th scope="col" className="px-6 py-4 font-semibold">Operational status</th>
                                        <th scope="col" className="px-6 py-4 font-semibold">Created</th>
                                        <th scope="col" className="px-6 py-4 text-right font-semibold">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {data.results.map((shop) => (
                                        <tr key={shop.id} className="align-middle transition hover:bg-blue-50/40">
                                            <td className="max-w-64 px-6 py-4">
                                                <Link to={`/platform/shops/${shop.id}`} className="truncate font-semibold text-slate-900 hover:text-blue-700">
                                                    {shop.shop_name}
                                                </Link>
                                                <p className="mt-1 text-xs text-slate-500">Approved shop</p>
                                            </td>
                                            <td className="max-w-64 px-6 py-4 text-slate-600">
                                                <span className="flex items-center gap-2">
                                                    <MapPin className="h-4 w-4 shrink-0 text-blue-500" aria-hidden="true" />
                                                    <span className="truncate">{formatApplicationLocation(shop.city, shop.district, shop.state)}</span>
                                                </span>
                                            </td>
                                            <td className="max-w-48 truncate px-6 py-4 text-slate-700">
                                                {shop.shop_admin_username || "Not assigned"}
                                            </td>
                                            <td className="px-6 py-4"><OperationalStatusControl shopId={shop.id} shopName={shop.shop_name} isOpen={shop.is_open} compact /></td>
                                            <td className="whitespace-nowrap px-6 py-4 text-slate-600">{formatApplicationDate(shop.created_at)}</td>
                                            <td className="px-6 py-4 text-right"><ShopViewLink shopId={shop.id} /></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="space-y-3 md:hidden">
                        {data.results.map((shop) => (
                            <article key={shop.id} className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <Link to={`/platform/shops/${shop.id}`} className="font-heading text-base font-semibold text-slate-950 hover:text-blue-700">
                                            {shop.shop_name}
                                        </Link>
                                        <p className="mt-2 flex items-center gap-2 text-sm text-slate-500">
                                            <MapPin className="h-4 w-4 shrink-0 text-blue-500" aria-hidden="true" />
                                            <span className="truncate">{formatApplicationLocation(shop.city, shop.district, shop.state)}</span>
                                        </p>
                                    </div>
                                    <OperationalStatusControl shopId={shop.id} shopName={shop.shop_name} isOpen={shop.is_open} compact />
                                </div>
                                <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-slate-100 pt-4 text-sm">
                                    <div>
                                        <dt className="text-xs font-medium text-slate-400">Shop Admin</dt>
                                        <dd className="mt-1 truncate font-medium text-slate-700">{shop.shop_admin_username || "Not assigned"}</dd>
                                    </div>
                                    <div>
                                        <dt className="text-xs font-medium text-slate-400">Created</dt>
                                        <dd className="mt-1 font-medium text-slate-700">{formatApplicationDate(shop.created_at)}</dd>
                                    </div>
                                </dl>
                                <div className="mt-5"><ShopViewLink shopId={shop.id} /></div>
                            </article>
                        ))}
                    </div>

                    <nav className="flex flex-col gap-4 rounded-2xl border border-blue-100 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between" aria-label="Shop pagination">
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

export default PlatformShops;
