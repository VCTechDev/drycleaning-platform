import {
    ChevronLeft,
    ChevronRight,
    Eye,
    Filter,
    RefreshCw,
    Search,
    Users,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";

import {
    UserRoleBadge,
    UserStatusBadge,
} from "../../components/admin/users/UserBadges";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { usePlatformUsers } from "../../hooks/platform/usePlatformUsers";
import { getApiErrorMessage } from "../../lib/apiError";
import { formatApplicationDate } from "../../lib/applicationDisplay";
import type {
    PlatformUserFilters,
    PlatformUserRole,
} from "../../types/platform/users";

const PAGE_SIZE = 10;

type UserRoleFilter = "all" | PlatformUserRole;
type UserStatusFilter = "all" | "active" | "inactive";

interface UserListControls {
    search: string;
    role: UserRoleFilter;
    status: UserStatusFilter;
}

const initialControls: UserListControls = {
    search: "",
    role: "all",
    status: "all",
};

const roleOptions: { value: UserRoleFilter; label: string }[] = [
    { value: "all", label: "All roles" },
    { value: "customer", label: "Customer" },
    { value: "shop_admin", label: "Shop Admin" },
    { value: "delivery_agent", label: "Delivery Agent" },
];

const statusOptions: { value: UserStatusFilter; label: string }[] = [
    { value: "all", label: "All statuses" },
    { value: "active", label: "Active" },
    { value: "inactive", label: "Inactive" },
];

const getUserFilters = (
    controls: UserListControls,
    page: number
): PlatformUserFilters => ({
    search: controls.search || undefined,
    role: controls.role === "all" ? undefined : controls.role,
    is_active:
        controls.status === "all" ? undefined : controls.status === "active",
    page,
});

function UsersListError({
    message,
    onRetry,
    retrying,
}: {
    message: string;
    onRetry: () => void;
    retrying: boolean;
}) {
    return (
        <section className="rounded-2xl border border-red-100 bg-white p-8 text-center shadow-sm" role="alert">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
                <RefreshCw className="h-6 w-6" aria-hidden="true" />
            </div>
            <h1 className="mt-4 font-heading text-xl font-semibold text-slate-950">
                Users could not be loaded
            </h1>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">
                {message}
            </p>
            <Button type="button" className="mt-6" onClick={onRetry} disabled={retrying}>
                {retrying ? "Trying again..." : "Try again"}
            </Button>
        </section>
    );
}

function UsersEmptyState({ filtered }: { filtered: boolean }) {
    return (
        <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                {filtered ? (
                    <Filter className="h-5 w-5" aria-hidden="true" />
                ) : (
                    <Users className="h-5 w-5" aria-hidden="true" />
                )}
            </div>
            <h2 className="mt-4 font-heading text-lg font-semibold text-slate-950">
                {filtered ? "No users match these filters" : "No users yet"}
            </h2>
            <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
                {filtered
                    ? "Try changing the search, role, or account status filters."
                    : "Eligible platform users will appear here."}
            </p>
        </div>
    );
}

function PlatformUsers() {
    const [controls, setControls] = useState(initialControls);
    const [appliedControls, setAppliedControls] = useState(initialControls);
    const [page, setPage] = useState(1);
    const filters = getUserFilters(appliedControls, page);
    const { data, isPending, isError, isFetching, error, refetch } =
        usePlatformUsers(filters);

    const applyFilters = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setAppliedControls({
            ...controls,
            search: controls.search.trim(),
        });
        setPage(1);
    };

    const resetFilters = () => {
        setControls(initialControls);
        setAppliedControls(initialControls);
        setPage(1);
    };

    if (isPending) {
        return (
            <div className="animate-pulse space-y-6" aria-label="Loading users">
                <div className="h-24 rounded-2xl bg-slate-200" />
                <div className="h-32 rounded-2xl bg-slate-200" />
                <div className="h-96 rounded-2xl bg-slate-200" />
            </div>
        );
    }

    if (isError || !data) {
        return (
            <UsersListError
                message={getApiErrorMessage(error, "Please try again.")}
                onRetry={() => void refetch()}
                retrying={isFetching}
            />
        );
    }

    const totalPages = Math.max(1, Math.ceil(data.count / PAGE_SIZE));
    const firstResult = data.count === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
    const lastResult = Math.min(page * PAGE_SIZE, data.count);
    const hasActiveFilters = Boolean(
        appliedControls.search ||
            appliedControls.role !== "all" ||
            appliedControls.status !== "all"
    );
    const hasPendingChanges =
        controls.search !== appliedControls.search ||
        controls.role !== appliedControls.role ||
        controls.status !== appliedControls.status;

    return (
        <div className="space-y-6">
            <header className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
                <div>
                    <p className="text-sm font-semibold text-blue-600">Platform workspace</p>
                    <h1 className="mt-1 font-heading text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
                        Users
                    </h1>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                        Monitor customers, Shop Admins, and Delivery Agents. This view is read-only.
                    </p>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-500">
                    <Users className="h-4 w-4 text-blue-600" aria-hidden="true" />
                    <span>{data.count} user{data.count === 1 ? "" : "s"}</span>
                </div>
            </header>

            <form
                onSubmit={applyFilters}
                className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm sm:p-5"
            >
                <div className="grid gap-4 lg:grid-cols-[minmax(16rem,1.5fr)_repeat(2,minmax(0,1fr))_auto] lg:items-end">
                    <div>
                        <label htmlFor="platform-user-search" className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                            Search users
                        </label>
                        <div className="relative mt-2">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                            <Input
                                id="platform-user-search"
                                value={controls.search}
                                onChange={(event) =>
                                    setControls((current) => ({
                                        ...current,
                                        search: event.target.value,
                                    }))
                                }
                                placeholder="Username, email, or name..."
                                className="pl-9"
                            />
                        </div>
                    </div>

                    <div>
                        <label htmlFor="platform-user-role" className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                            Role
                        </label>
                        <select
                            id="platform-user-role"
                            value={controls.role}
                            onChange={(event) =>
                                setControls((current) => ({
                                    ...current,
                                    role: event.target.value as UserRoleFilter,
                                }))
                            }
                            className="mt-2 min-h-9 w-full rounded-4xl border border-input bg-input/30 px-3 text-sm text-slate-700 outline-none transition focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                        >
                            {roleOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label htmlFor="platform-user-status" className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                            Account status
                        </label>
                        <select
                            id="platform-user-status"
                            value={controls.status}
                            onChange={(event) =>
                                setControls((current) => ({
                                    ...current,
                                    status: event.target.value as UserStatusFilter,
                                }))
                            }
                            className="mt-2 min-h-9 w-full rounded-4xl border border-input bg-input/30 px-3 text-sm text-slate-700 outline-none transition focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                        >
                            {statusOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="flex gap-2 lg:justify-end">
                        <Button type="submit" className="flex-1 lg:flex-none">
                            Apply
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={resetFilters}
                            disabled={!hasActiveFilters && !hasPendingChanges}
                        >
                            Reset
                        </Button>
                    </div>
                </div>
            </form>

            {isFetching && (
                <p className="-mt-2 flex items-center justify-end gap-2 text-xs text-slate-400" role="status">
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    Updating users...
                </p>
            )}

            {data.results.length === 0 ? (
                <UsersEmptyState filtered={hasActiveFilters} />
            ) : (
                <>
                    <div className="hidden overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm md:block">
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[1050px] text-left text-sm">
                                <caption className="sr-only">Platform users</caption>
                                <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-[0.12em] text-slate-500">
                                    <tr>
                                        <th scope="col" className="px-6 py-4 font-semibold">User</th>
                                        <th scope="col" className="px-6 py-4 font-semibold">Email</th>
                                        <th scope="col" className="px-6 py-4 font-semibold">Role</th>
                                        <th scope="col" className="px-6 py-4 font-semibold">Status</th>
                                        <th scope="col" className="px-6 py-4 font-semibold">Shop</th>
                                        <th scope="col" className="px-6 py-4 font-semibold">Joined</th>
                                        <th scope="col" className="px-6 py-4 text-right font-semibold">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {data.results.map((user) => (
                                        <tr key={user.id} className="align-middle transition hover:bg-blue-50/40">
                                            <td className="max-w-52 px-6 py-4">
                                                <Link to={`/platform/users/${user.id}`} className="truncate font-semibold text-slate-900 hover:text-blue-700">
                                                    {user.username}
                                                </Link>
                                                <p className="mt-1 truncate text-xs text-slate-500">
                                                    {[user.first_name, user.last_name].filter(Boolean).join(" ") || "Name not provided"}
                                                </p>
                                            </td>
                                            <td className="max-w-56 truncate px-6 py-4 text-slate-700">{user.email || "Not provided"}</td>
                                            <td className="px-6 py-4"><UserRoleBadge role={user.role} /></td>
                                            <td className="px-6 py-4"><UserStatusBadge isActive={user.is_active} /></td>
                                            <td className="max-w-48 truncate px-6 py-4 text-slate-700">{user.shop_name || "Unassigned"}</td>
                                            <td className="whitespace-nowrap px-6 py-4 text-slate-600">{formatApplicationDate(user.date_joined)}</td>
                                            <td className="px-6 py-4 text-right">
                                                <Link to={`/platform/users/${user.id}`} className="inline-flex min-h-9 items-center justify-center gap-2 rounded-xl border border-blue-100 bg-white px-3 text-sm font-semibold text-blue-700 transition hover:border-blue-200 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">
                                                    <Eye className="h-4 w-4" aria-hidden="true" />
                                                    View
                                                </Link>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="space-y-3 md:hidden">
                        {data.results.map((user) => (
                            <article key={user.id} className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <Link to={`/platform/users/${user.id}`} className="truncate font-heading text-base font-semibold text-slate-950 hover:text-blue-700">
                                            {user.username}
                                        </Link>
                                        <p className="mt-1 truncate text-sm text-slate-500">{user.email || "Email not provided"}</p>
                                    </div>
                                    <UserStatusBadge isActive={user.is_active} />
                                </div>
                                <div className="mt-4"><UserRoleBadge role={user.role} /></div>
                                <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-slate-100 pt-4 text-sm">
                                    <div>
                                        <dt className="text-xs font-medium text-slate-400">Shop</dt>
                                        <dd className="mt-1 truncate font-medium text-slate-700">{user.shop_name || "Unassigned"}</dd>
                                    </div>
                                    <div>
                                        <dt className="text-xs font-medium text-slate-400">Joined</dt>
                                        <dd className="mt-1 font-medium text-slate-700">{formatApplicationDate(user.date_joined)}</dd>
                                    </div>
                                </dl>
                                <Link to={`/platform/users/${user.id}`} className="mt-5 inline-flex min-h-9 w-full items-center justify-center gap-2 rounded-xl border border-blue-100 px-3 text-sm font-semibold text-blue-700 hover:bg-blue-50">
                                    <Eye className="h-4 w-4" aria-hidden="true" />
                                    View user
                                </Link>
                            </article>
                        ))}
                    </div>

                    <nav className="flex flex-col gap-4 rounded-2xl border border-blue-100 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between" aria-label="User pagination">
                        <p className="text-sm text-slate-500">
                            Showing <span className="font-semibold text-slate-700">{firstResult}-{lastResult}</span> of <span className="font-semibold text-slate-700">{data.count}</span>
                        </p>
                        <div className="flex items-center gap-2">
                            <Button type="button" variant="outline" size="sm" onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))} disabled={!data.previous || isFetching}>
                                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                                Previous
                            </Button>
                            <span className="min-w-20 text-center text-sm font-medium text-slate-600">Page {page} of {totalPages}</span>
                            <Button type="button" variant="outline" size="sm" onClick={() => setPage((currentPage) => currentPage + 1)} disabled={!data.next || isFetching}>
                                Next
                                <ChevronRight className="h-4 w-4" aria-hidden="true" />
                            </Button>
                        </div>
                    </nav>
                </>
            )}
        </div>
    );
}

export default PlatformUsers;
