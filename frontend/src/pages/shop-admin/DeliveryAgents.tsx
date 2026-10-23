import { useState } from "react";
import { Link } from "react-router-dom";
import {
    AlertCircle,
    Clock,
    Edit3,
    Loader2,
    Phone,
    RefreshCw,
    Search,
    UserCheck,
    UserPlus,
    Users,
    UserX,
    WifiOff,
} from "lucide-react";

import EditDeliveryAgentDialog from "../../components/shopAdmin/EditDeliveryAgentDialog";
import { useShopAdminDeliveryAgents } from "../../hooks/shopAdmin/useShopAdminDeliveryAgents";
import { useShopAdminProfile } from "../../hooks/shopAdmin/useShopAdminProfile";
import type { DeliveryAgent, DeliveryAgentFilters } from "../../types/shopAdmin/deliveryAgents";

export default function ShopDeliveryAgents() {
    const { data: profile } = useShopAdminProfile();

    const [searchInput, setSearchInput] = useState("");
    const [searchTerm, setSearchTerm] = useState("");
    const [activeFilter, setActiveFilter] = useState<string>("");
    const [onlineFilter, setOnlineFilter] = useState<string>("");
    const [currentPage, setCurrentPage] = useState<number>(1);

    const [selectedAgentForEdit, setSelectedAgentForEdit] = useState<DeliveryAgent | null>(null);

    const queryFilters: DeliveryAgentFilters = {
        page: currentPage,
        search: searchTerm || undefined,
        is_active: activeFilter === "" ? "" : activeFilter === "true",
        is_online: onlineFilter === "" ? "" : onlineFilter === "true",
    };

    const {
        data: agentsData,
        isLoading,
        isError,
        error,
        refetch,
        isFetching,
    } = useShopAdminDeliveryAgents(queryFilters);

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setCurrentPage(1);
        setSearchTerm(searchInput.trim());
    };

    const handleClearFilters = () => {
        setSearchInput("");
        setSearchTerm("");
        setActiveFilter("");
        setOnlineFilter("");
        setCurrentPage(1);
    };

    const agents = agentsData?.results || [];
    const totalCount = agentsData?.count || 0;
    const totalPages = Math.ceil(totalCount / 10) || 1;

    // Format time "09:00:00" to "9:00 AM" or "09:00"
    const formatShiftTime = (timeStr?: string) => {
        if (!timeStr) return "N/A";
        const parts = timeStr.split(":");
        if (parts.length >= 2) {
            const hour = parseInt(parts[0], 10);
            const minute = parts[1];
            const ampm = hour >= 12 ? "PM" : "AM";
            const formattedHour = hour % 12 === 0 ? 12 : hour % 12;
            return `${formattedHour}:${minute} ${ampm}`;
        }
        return timeStr;
    };

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-xs sm:p-8">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-[#2563EB]">
                            <Users className="h-6 w-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">
                                Delivery Agent Management
                            </h2>
                            <p className="text-sm text-slate-500">
                                Monitor and manage delivery personnel for{" "}
                                <span className="font-semibold text-slate-800">
                                    {profile?.shop_name || "your shop"}
                                </span>
                            </p>
                        </div>
                    </div>
                    <Link
                        to="/shop-admin/delivery-agents/register"
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#2563EB] px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-blue-700 transition-colors"
                    >
                        <UserPlus className="h-4 w-4" />
                        Register New Agent
                    </Link>
                </div>

                {/* Filter and Search Bar */}
                <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between border-t border-slate-100 pt-5">
                    <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
                        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            placeholder="Search by name, username, email, or phone..."
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
                            value={activeFilter}
                            onChange={(e) => {
                                setActiveFilter(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:border-[#2563EB] focus:outline-none"
                        >
                            <option value="">All Account Statuses</option>
                            <option value="true">Active Accounts</option>
                            <option value="false">Inactive Accounts</option>
                        </select>

                        <select
                            value={onlineFilter}
                            onChange={(e) => {
                                setOnlineFilter(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:border-[#2563EB] focus:outline-none"
                        >
                            <option value="">All Online States</option>
                            <option value="true">Online Now</option>
                            <option value="false">Offline</option>
                        </select>

                        {(searchTerm || activeFilter || onlineFilter) && (
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
                            title="Refresh roster"
                        >
                            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
                            Refresh
                        </button>
                    </div>
                </div>
            </div>

            {/* Roster Table Card */}
            <div className="rounded-2xl border border-[#E2E8F0] bg-white shadow-xs overflow-hidden">
                {isLoading ? (
                    <div className="p-12 text-center">
                        <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#2563EB]" />
                        <p className="mt-3 text-sm font-medium text-slate-600">Loading delivery agent roster...</p>
                    </div>
                ) : isError ? (
                    <div className="p-12 text-center">
                        <AlertCircle className="mx-auto h-8 w-8 text-rose-500" />
                        <p className="mt-3 text-sm font-semibold text-slate-900">Failed to load delivery agents</p>
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
                ) : agents.length === 0 ? (
                    <div className="p-12 text-center">
                        <Users className="mx-auto h-10 w-10 text-slate-300" />
                        <h3 className="mt-3 text-base font-bold text-slate-800">No delivery agents found</h3>
                        <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
                            {searchTerm || activeFilter || onlineFilter
                                ? "No delivery agents matched your active search and filter criteria."
                                : "You haven't registered any delivery agents for your shop yet."}
                        </p>
                        <div className="mt-5 flex justify-center gap-3">
                            {searchTerm || activeFilter || onlineFilter ? (
                                <button
                                    type="button"
                                    onClick={handleClearFilters}
                                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                >
                                    Clear Filters
                                </button>
                            ) : (
                                <Link
                                    to="/shop-admin/delivery-agents/register"
                                    className="inline-flex items-center gap-2 rounded-xl bg-[#2563EB] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700"
                                >
                                    <UserPlus className="h-4 w-4" />
                                    Register First Agent
                                </Link>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="border-b border-slate-100 bg-slate-50/70 text-xs font-bold uppercase tracking-wider text-slate-500">
                                <tr>
                                    <th className="px-6 py-3.5">Agent Details</th>
                                    <th className="px-6 py-3.5">Contact</th>
                                    <th className="px-6 py-3.5">Shift Hours</th>
                                    <th className="px-6 py-3.5">Account Status</th>
                                    <th className="px-6 py-3.5">Availability</th>
                                    <th className="px-6 py-3.5">Active Tasks</th>
                                    <th className="px-6 py-3.5 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {agents.map((agent) => {
                                    const fullName = `${agent.user.first_name || ""} ${agent.user.last_name || ""}`.trim();
                                    return (
                                        <tr key={agent.id} className="hover:bg-slate-50/60 transition-colors">
                                            {/* Agent Details */}
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-[#2563EB] font-bold text-sm">
                                                        {agent.user.first_name ? agent.user.first_name[0].toUpperCase() : agent.user.username[0].toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div className="font-semibold text-slate-900">
                                                            {fullName || agent.user.username}
                                                        </div>
                                                        <div className="text-xs text-slate-500 font-mono">
                                                            @{agent.user.username}
                                                        </div>
                                                        {agent.user.email && (
                                                            <div className="text-xs text-slate-400">
                                                                {agent.user.email}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Contact */}
                                            <td className="px-6 py-4 text-xs text-slate-700">
                                                {agent.user.phone_number ? (
                                                    <span className="inline-flex items-center gap-1.5 font-medium">
                                                        <Phone className="h-3.5 w-3.5 text-slate-400" />
                                                        {agent.user.phone_number}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-400 italic">No phone</span>
                                                )}
                                            </td>

                                            {/* Shift Hours */}
                                            <td className="px-6 py-4 text-xs text-slate-700">
                                                <div className="inline-flex items-center gap-1.5 font-medium text-slate-800">
                                                    <Clock className="h-3.5 w-3.5 text-slate-400" />
                                                    {formatShiftTime(agent.shift_starts_at)} – {formatShiftTime(agent.shift_ends_at)}
                                                </div>
                                            </td>

                                            {/* Account Status (is_active) */}
                                            <td className="px-6 py-4">
                                                {agent.is_active ? (
                                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200/80 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                                                        <UserCheck className="h-3.5 w-3.5 text-emerald-600" />
                                                        Active
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 border border-slate-200 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                                                        <UserX className="h-3.5 w-3.5 text-slate-400" />
                                                        Inactive
                                                    </span>
                                                )}
                                            </td>

                                            {/* Online Status (is_online) */}
                                            <td className="px-6 py-4">
                                                {agent.is_online ? (
                                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200/80 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                                                        <span className="relative flex h-2 w-2">
                                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                                        </span>
                                                        Online
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 border border-slate-200 px-2.5 py-0.5 text-xs font-semibold text-slate-500">
                                                        <WifiOff className="h-3 w-3 text-slate-400" />
                                                        Offline
                                                    </span>
                                                )}
                                            </td>

                                            {/* Active Tasks Count */}
                                            <td className="px-6 py-4">
                                                <span className="inline-flex items-center justify-center rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-bold text-[#2563EB]">
                                                    {agent.active_tasks_count} active
                                                </span>
                                            </td>

                                            {/* Actions */}
                                            <td className="px-6 py-4 text-right">
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedAgentForEdit(agent)}
                                                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-slate-900 transition-colors"
                                                >
                                                    <Edit3 className="h-3.5 w-3.5" />
                                                    Edit
                                                </button>
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
                            of <span className="font-semibold text-slate-700">{totalCount}</span> agents
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

            {/* Edit Agent Modal */}
            <EditDeliveryAgentDialog
                agent={selectedAgentForEdit}
                isOpen={Boolean(selectedAgentForEdit)}
                onClose={() => setSelectedAgentForEdit(null)}
            />
        </div>
    );
}
