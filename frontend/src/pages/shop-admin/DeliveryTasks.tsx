import { useState } from "react";
import { Link } from "react-router-dom";
import {
    AlertCircle,
    CheckCircle2,
    Clock,
    ExternalLink,
    Loader2,
    MapPin,
    Phone,
    RefreshCw,
    Search,
    Truck,
    User,
    UserCheck,
    UserMinus,
    UserPlus,
} from "lucide-react";

import AssignDeliveryTaskDialog from "../../components/shopAdmin/AssignDeliveryTaskDialog";
import UnassignDeliveryTaskDialog from "../../components/shopAdmin/UnassignDeliveryTaskDialog";
import { useShopAdminDeliveryTasks } from "../../hooks/shopAdmin/useShopAdminDeliveryTasks";
import { useShopAdminProfile } from "../../hooks/shopAdmin/useShopAdminProfile";
import type {
    DeliveryTaskDetail,
    DeliveryTaskFilters,
    DeliveryTaskStatus,
    DeliveryTaskType,
} from "../../types/shopAdmin/deliveryTasks";

export default function ShopDeliveryTasks() {
    const { data: profile } = useShopAdminProfile();

    const [searchInput, setSearchInput] = useState("");
    const [searchTerm, setSearchTerm] = useState("");
    const [taskTypeFilter, setTaskTypeFilter] = useState<string>("");
    const [statusFilter, setStatusFilter] = useState<string>("");
    const [assignedFilter, setAssignedFilter] = useState<string>("");
    const [currentPage, setCurrentPage] = useState<number>(1);

    // Dialog state
    const [assignDialogTask, setAssignDialogTask] = useState<DeliveryTaskDetail | null>(null);
    const [unassignDialogTask, setUnassignDialogTask] = useState<DeliveryTaskDetail | null>(null);

    const queryFilters: DeliveryTaskFilters = {
        page: currentPage,
        search: searchTerm || undefined,
        task_type: (taskTypeFilter as DeliveryTaskType) || undefined,
        status: (statusFilter as DeliveryTaskStatus) || undefined,
        is_assigned: assignedFilter === "" ? "" : assignedFilter === "true",
    };

    const {
        data: tasksData,
        isLoading,
        isError,
        error,
        refetch,
        isFetching,
    } = useShopAdminDeliveryTasks(queryFilters);

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setCurrentPage(1);
        setSearchTerm(searchInput.trim());
    };

    const handleClearFilters = () => {
        setSearchInput("");
        setSearchTerm("");
        setTaskTypeFilter("");
        setStatusFilter("");
        setAssignedFilter("");
        setCurrentPage(1);
    };

    const tasks = tasksData?.results || [];
    const totalCount = tasksData?.count || 0;
    const totalPages = Math.ceil(totalCount / 10) || 1;

    const formatDateTime = (isoStr?: string | null) => {
        if (!isoStr) return null;
        try {
            return new Date(isoStr).toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
            });
        } catch {
            return isoStr;
        }
    };

    const getStatusBadge = (status: DeliveryTaskStatus) => {
        switch (status) {
            case "unassigned":
                return "bg-amber-50 text-amber-700 border-amber-200/80";
            case "assigned":
                return "bg-blue-50 text-[#2563EB] border-blue-200/80";
            case "in_progress":
                return "bg-purple-50 text-purple-700 border-purple-200/80";
            case "completed":
                return "bg-emerald-50 text-emerald-700 border-emerald-200/80";
            case "failed":
                return "bg-rose-50 text-rose-700 border-rose-200/80";
            case "cancelled":
                return "bg-slate-100 text-slate-600 border-slate-200";
            default:
                return "bg-slate-50 text-slate-700 border-slate-200";
        }
    };

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-xs sm:p-8">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-[#2563EB]">
                            <Truck className="h-6 w-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">
                                Delivery Task Management
                            </h2>
                            <p className="text-sm text-slate-500">
                                Monitor pickup and delivery workflows for{" "}
                                <span className="font-semibold text-slate-800">
                                    {profile?.shop_name || "your shop"}
                                </span>
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Link
                            to="/shop-admin/delivery-agents"
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                        >
                            <User className="h-4 w-4" />
                            Manage Drivers
                        </Link>
                    </div>
                </div>

                {/* Filter and Search Bar */}
                <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between border-t border-slate-100 pt-5">
                    <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
                        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            placeholder="Search by order #, customer, address, or phone..."
                            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-20 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-[#2563EB] focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
                        />
                        <button
                            type="submit"
                            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg bg-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-300 transition-colors"
                        >
                            Search
                        </button>
                    </form>

                    <div className="flex flex-wrap items-center gap-2.5">
                        <select
                            value={taskTypeFilter}
                            onChange={(e) => {
                                setTaskTypeFilter(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:border-[#2563EB] focus:outline-none"
                        >
                            <option value="">All Task Types</option>
                            <option value="pickup">Pickup Tasks</option>
                            <option value="delivery">Delivery Tasks</option>
                        </select>

                        <select
                            value={statusFilter}
                            onChange={(e) => {
                                setStatusFilter(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:border-[#2563EB] focus:outline-none"
                        >
                            <option value="">All Task Statuses</option>
                            <option value="unassigned">Unassigned</option>
                            <option value="assigned">Assigned</option>
                            <option value="in_progress">In Progress</option>
                            <option value="completed">Completed</option>
                            <option value="failed">Failed</option>
                            <option value="cancelled">Cancelled</option>
                        </select>

                        <select
                            value={assignedFilter}
                            onChange={(e) => {
                                setAssignedFilter(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:border-[#2563EB] focus:outline-none"
                        >
                            <option value="">All Driver Assignments</option>
                            <option value="true">Assigned Only</option>
                            <option value="false">Unassigned Only</option>
                        </select>

                        {(searchTerm || taskTypeFilter || statusFilter || assignedFilter) && (
                            <button
                                type="button"
                                onClick={handleClearFilters}
                                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                            >
                                Reset Filters
                            </button>
                        )}

                        <button
                            type="button"
                            onClick={() => refetch()}
                            disabled={isFetching}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                            title="Refresh tasks"
                        >
                            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
                            Refresh
                        </button>
                    </div>
                </div>
            </div>

            {/* Tasks Table Card */}
            <div className="rounded-2xl border border-[#E2E8F0] bg-white shadow-xs overflow-hidden">
                {isLoading ? (
                    <div className="p-12 text-center">
                        <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#2563EB]" />
                        <p className="mt-3 text-sm font-medium text-slate-600">Loading delivery tasks...</p>
                    </div>
                ) : isError ? (
                    <div className="p-12 text-center">
                        <AlertCircle className="mx-auto h-8 w-8 text-rose-500" />
                        <p className="mt-3 text-sm font-semibold text-slate-900">Failed to load delivery tasks</p>
                        <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
                            {error?.message || "An unexpected error occurred while communicating with the server."}
                        </p>
                        <button
                            type="button"
                            onClick={() => refetch()}
                            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#2563EB] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700"
                        >
                            <RefreshCw className="h-3.5 w-3.5" />
                            Retry
                        </button>
                    </div>
                ) : tasks.length === 0 ? (
                    <div className="p-12 text-center">
                        <Truck className="mx-auto h-10 w-10 text-slate-300" />
                        <h3 className="mt-3 text-base font-bold text-slate-800">No delivery tasks found</h3>
                        <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
                            {searchTerm || taskTypeFilter || statusFilter || assignedFilter
                                ? "No delivery tasks matched your active filter criteria."
                                : "No pickup or delivery tasks have been created yet. Tasks are generated when orders are accepted or marked ready."}
                        </p>
                        {(searchTerm || taskTypeFilter || statusFilter || assignedFilter) && (
                            <div className="mt-5 flex justify-center">
                                <button
                                    type="button"
                                    onClick={handleClearFilters}
                                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                >
                                    Clear Filters
                                </button>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="border-b border-slate-100 bg-slate-50/70 text-xs font-bold uppercase tracking-wider text-slate-500">
                                <tr>
                                    <th className="px-6 py-3.5">Order & Customer</th>
                                    <th className="px-6 py-3.5">Task Type</th>
                                    <th className="px-6 py-3.5">Status</th>
                                    <th className="px-6 py-3.5">Assigned Driver</th>
                                    <th className="px-6 py-3.5">Scheduled / Completed</th>
                                    <th className="px-6 py-3.5 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {tasks.map((task) => {
                                    const isTerminal = ["completed", "failed", "cancelled"].includes(task.status);
                                    const isInProgress = task.status === "in_progress";
                                    const isAssigned = task.status === "assigned";
                                    const isUnassigned = task.status === "unassigned";

                                    const driverName = task.delivery_agent
                                        ? `${task.delivery_agent.first_name || ""} ${task.delivery_agent.last_name || ""}`.trim() ||
                                          task.delivery_agent.username
                                        : null;

                                    return (
                                        <tr key={task.id} className="hover:bg-slate-50/60 transition-colors">
                                            {/* Order & Customer */}
                                            <td className="px-6 py-4">
                                                <div>
                                                    <Link
                                                        to={`/shop-admin/orders/${task.order.id}`}
                                                        className="font-bold text-[#2563EB] hover:underline inline-flex items-center gap-1 font-mono text-sm"
                                                    >
                                                        #{task.order_number || task.order.order_number}
                                                        <ExternalLink className="h-3 w-3" />
                                                    </Link>
                                                    <div className="text-xs font-medium text-slate-800 mt-0.5">
                                                        {task.order.customer_name}
                                                    </div>
                                                    <div className="flex items-center gap-1 text-[11px] text-slate-500">
                                                        <MapPin className="h-3 w-3 text-slate-400 shrink-0" />
                                                        <span className="truncate max-w-[200px]" title={task.order.pickup_address_line}>
                                                            {task.order.pickup_address_line}, {task.order.pickup_city}
                                                        </span>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Task Type */}
                                            <td className="px-6 py-4">
                                                <span
                                                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider ${
                                                        task.task_type === "pickup"
                                                            ? "bg-sky-50 text-sky-700 border border-sky-200"
                                                            : "bg-indigo-50 text-indigo-700 border border-indigo-200"
                                                    }`}
                                                >
                                                    {task.task_type === "pickup" ? "Pickup" : "Delivery"}
                                                </span>
                                            </td>

                                            {/* Status */}
                                            <td className="px-6 py-4">
                                                <span
                                                    className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${getStatusBadge(
                                                        task.status
                                                    )}`}
                                                >
                                                    {task.status.replace("_", " ")}
                                                </span>
                                            </td>

                                            {/* Assigned Driver */}
                                            <td className="px-6 py-4 text-xs">
                                                {task.delivery_agent ? (
                                                    <div>
                                                        <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                                                            <UserCheck className="h-3.5 w-3.5 text-[#2563EB]" />
                                                            {driverName}
                                                        </div>
                                                        <div className="text-slate-400 font-mono text-[11px]">
                                                            @{task.delivery_agent.username}
                                                        </div>
                                                        {task.delivery_agent.phone_number && (
                                                            <div className="text-slate-500 flex items-center gap-1 mt-0.5">
                                                                <Phone className="h-3 w-3 text-slate-400" />
                                                                {task.delivery_agent.phone_number}
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 text-slate-400 italic">
                                                        Unassigned
                                                    </span>
                                                )}
                                            </td>

                                            {/* Scheduled / Completed */}
                                            <td className="px-6 py-4 text-xs text-slate-600">
                                                {task.completed_at ? (
                                                    <div className="flex items-center gap-1.5 text-emerald-700 font-medium">
                                                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                                                        <span>Completed: {formatDateTime(task.completed_at)}</span>
                                                    </div>
                                                ) : task.scheduled_at ? (
                                                    <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                                                        <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                                        <span>Scheduled: {formatDateTime(task.scheduled_at)}</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-400 italic">Not scheduled</span>
                                                )}
                                            </td>

                                            {/* Actions */}
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    {isUnassigned && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setAssignDialogTask(task)}
                                                            className="inline-flex items-center gap-1.5 rounded-xl bg-[#2563EB] px-3 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-blue-700 transition-colors"
                                                        >
                                                            <UserPlus className="h-3.5 w-3.5" />
                                                            Assign Driver
                                                        </button>
                                                    )}

                                                    {isAssigned && (
                                                        <>
                                                            <button
                                                                type="button"
                                                                onClick={() => setAssignDialogTask(task)}
                                                                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                                                            >
                                                                Reassign
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => setUnassignDialogTask(task)}
                                                                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 hover:border-rose-200 transition-colors"
                                                                title="Unassign Driver"
                                                            >
                                                                <UserMinus className="h-3.5 w-3.5" />
                                                                Unassign
                                                            </button>
                                                        </>
                                                    )}

                                                    {isInProgress && (
                                                        <span className="inline-flex items-center gap-1 rounded-lg bg-purple-50 px-2.5 py-1 text-xs font-semibold text-purple-700">
                                                            Active with Driver
                                                        </span>
                                                    )}

                                                    {isTerminal && (
                                                        <Link
                                                            to={`/shop-admin/orders/${task.order.id}`}
                                                            className="text-xs font-medium text-slate-500 hover:text-slate-800"
                                                        >
                                                            View Order
                                                        </Link>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination Controls */}
                {totalCount > 10 && (
                    <div className="flex items-center justify-between border-t border-slate-100 px-6 py-3.5 bg-slate-50/50">
                        <p className="text-xs text-slate-500">
                            Showing <span className="font-semibold text-slate-700">{(currentPage - 1) * 10 + 1}</span> to{" "}
                            <span className="font-semibold text-slate-700">
                                {Math.min(currentPage * 10, totalCount)}
                            </span>{" "}
                            of <span className="font-semibold text-slate-700">{totalCount}</span> tasks
                        </p>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                disabled={currentPage <= 1 || isFetching}
                                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                            >
                                Previous
                            </button>
                            <span className="text-xs font-medium text-slate-600 px-2">
                                Page {currentPage} of {totalPages}
                            </span>
                            <button
                                type="button"
                                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                                disabled={currentPage >= totalPages || isFetching}
                                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Assign / Reassign Dialog */}
            <AssignDeliveryTaskDialog
                taskId={assignDialogTask?.id ?? null}
                orderId={assignDialogTask?.order.id}
                orderNumber={assignDialogTask?.order_number || assignDialogTask?.order.order_number}
                taskType={assignDialogTask?.task_type}
                currentAgentId={assignDialogTask?.delivery_agent_id}
                currentScheduledAt={assignDialogTask?.scheduled_at}
                isOpen={Boolean(assignDialogTask)}
                onClose={() => setAssignDialogTask(null)}
            />

            {/* Unassign Confirmation Dialog */}
            <UnassignDeliveryTaskDialog
                taskId={unassignDialogTask?.id ?? null}
                orderId={unassignDialogTask?.order.id}
                orderNumber={unassignDialogTask?.order_number || unassignDialogTask?.order.order_number}
                taskType={unassignDialogTask?.task_type}
                agentName={
                    unassignDialogTask?.delivery_agent
                        ? `${unassignDialogTask.delivery_agent.first_name || ""} ${unassignDialogTask.delivery_agent.last_name || ""}`.trim() ||
                          unassignDialogTask.delivery_agent.username
                        : null
                }
                isOpen={Boolean(unassignDialogTask)}
                onClose={() => setUnassignDialogTask(null)}
            />
        </div>
    );
}
