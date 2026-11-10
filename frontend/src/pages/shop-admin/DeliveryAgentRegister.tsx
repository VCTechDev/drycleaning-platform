import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
    AlertCircle,
    ArrowLeft,
    CheckCircle2,
    Clock,
    Loader2,
    Mail,
    Phone,
    Shield,
    User,
    UserPlus,
} from "lucide-react";

import { useRegisterDeliveryAgent } from "../../hooks/shopAdmin/useShopAdminDeliveryAgents";
import { useShopAdminProfile } from "../../hooks/shopAdmin/useShopAdminProfile";
import type { RegisterDeliveryAgentPayload } from "../../types/shopAdmin/deliveryAgents";

export default function ShopDeliveryAgentRegister() {
    const navigate = useNavigate();
    const { data: profile } = useShopAdminProfile();
    const registerMutation = useRegisterDeliveryAgent();

    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [phoneNumber, setPhoneNumber] = useState("");
    const [shiftStartsAt, setShiftStartsAt] = useState("09:00");
    const [shiftEndsAt, setShiftEndsAt] = useState("18:00");
    const [isActive, setIsActive] = useState(true);

    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [generalError, setGeneralError] = useState<string | null>(null);
    const [registeredAgent, setRegisteredAgent] = useState<{ username: string; agentId: string } | null>(null);

    const validateForm = (): boolean => {
        const errors: Record<string, string> = {};

        if (!username.trim()) {
            errors.username = "Username is required.";
        } else if (username.trim().length > 150) {
            errors.username = "Username cannot exceed 150 characters.";
        }

        if (!email.trim()) {
            errors.email = "Email is required.";
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
            errors.email = "Please enter a valid email address.";
        }

        if (!phoneNumber.trim()) {
            errors.phone_number = "Phone number is required.";
        }

        if (!shiftStartsAt) {
            errors.shift_starts_at = "Shift start time is required.";
        }

        if (!shiftEndsAt) {
            errors.shift_ends_at = "Shift end time is required.";
        }

        if (shiftStartsAt && shiftEndsAt && shiftStartsAt === shiftEndsAt) {
            errors.shift_ends_at = "Shift start and end times cannot be identical.";
        }

        setFieldErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setGeneralError(null);
        setRegisteredAgent(null);

        if (!validateForm()) {
            return;
        }

        const formattedStart = shiftStartsAt.length === 5 ? `${shiftStartsAt}:00` : shiftStartsAt;
        const formattedEnd = shiftEndsAt.length === 5 ? `${shiftEndsAt}:00` : shiftEndsAt;

        const payload: RegisterDeliveryAgentPayload = {
            username: username.trim(),
            email: email.trim().toLowerCase(),
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            phone_number: phoneNumber.trim(),
            shift_starts_at: formattedStart,
            shift_ends_at: formattedEnd,
            is_active: isActive,
        };

        try {
            const newAgent = await registerMutation.mutateAsync(payload);
            setRegisteredAgent({
                username: username.trim(),
                agentId: newAgent.agent_id,
            });
            setTimeout(() => {
                navigate("/shop-admin/delivery-agents");
            }, 3000);
        } catch (err: unknown) {
            const error = err as { response?: { data?: Record<string, unknown> } };
            const data = error.response?.data;
            if (data && typeof data === "object") {
                const newFieldErrors: Record<string, string> = {};
                const nonFieldErrors: string[] = [];

                Object.entries(data).forEach(([key, val]) => {
                    const message = Array.isArray(val) ? val.join(" ") : String(val);
                    if (["username", "email", "shift_starts_at", "shift_ends_at", "phone_number"].includes(key)) {
                        newFieldErrors[key] = message;
                    } else {
                        nonFieldErrors.push(`${key}: ${message}`);
                    }
                });

                setFieldErrors(newFieldErrors);
                if (nonFieldErrors.length > 0) {
                    setGeneralError(nonFieldErrors.join(" | "));
                }
            } else {
                setGeneralError("An unexpected error occurred during agent registration. Please try again.");
            }
        }
    };

    return (
        <div className="space-y-6">
            {/* Standalone Page Header */}
            <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-xs sm:p-8">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-[#2563EB]">
                            <UserPlus className="h-6 w-6" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
                                Register Delivery Agent
                            </h1>
                            <p className="text-sm text-slate-500">
                                Create account credentials and set shift hours for new delivery personnel at{" "}
                                <span className="font-semibold text-slate-800">
                                    {profile?.shop_name || "your shop"}
                                </span>
                            </p>
                        </div>
                    </div>
                    <Link
                        to="/shop-admin/delivery-agents"
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition-colors"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back to Delivery Agents
                    </Link>
                </div>
            </div>

            {/* Main Form Surface */}
            <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-xs sm:p-8">
                <div className="max-w-4xl">
                    {registeredAgent && (
                        <div className="mb-6 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
                            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                            <div className="flex-1">
                                <p className="text-sm font-bold text-emerald-900">
                                    Delivery agent @{registeredAgent.username} registered successfully!
                                </p>
                                <div className="mt-2 flex items-center gap-2">
                                    <span className="text-xs font-medium text-emerald-700">Public Agent ID:</span>
                                    <span className="rounded-md bg-emerald-100 px-2.5 py-1 text-xs font-bold font-mono text-emerald-900 border border-emerald-300">
                                        {registeredAgent.agentId}
                                    </span>
                                </div>
                                <p className="text-xs text-emerald-600 mt-2">
                                    The agent will log in using this Agent ID (or their registered phone) and OTP delivered to their email. Redirecting to roster...
                                </p>
                            </div>
                        </div>
                    )}

                    {generalError && (
                        <div className="mb-6 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-700">
                            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                            <span>{generalError}</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-8">
                        {/* Section 1: Account & Authentication */}
                        <div>
                            <div className="mb-4">
                                <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
                                    <Shield className="h-4 w-4 text-[#2563EB]" />
                                    Account & Authentication
                                </h2>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    Account identity used by the delivery agent. Agents authenticate passwordlessly using OTP delivered to their registered email address.
                                </p>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                                        Username <span className="text-rose-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                        <input
                                            type="text"
                                            required
                                            value={username}
                                            onChange={(e) => {
                                                setUsername(e.target.value);
                                                if (fieldErrors.username) setFieldErrors((prev) => ({ ...prev, username: "" }));
                                            }}
                                            disabled={registerMutation.isPending}
                                            maxLength={150}
                                            className={`w-full rounded-xl border pl-10 pr-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 ${
                                                fieldErrors.username
                                                    ? "border-rose-300 bg-rose-50/30 focus:border-rose-500 focus:ring-rose-100"
                                                    : "border-slate-200 bg-white focus:border-[#2563EB] focus:ring-blue-100"
                                            }`}
                                            placeholder="e.g. kochi_driver_1"
                                        />
                                    </div>
                                    {fieldErrors.username && (
                                        <p className="mt-1 text-xs text-rose-600">{fieldErrors.username}</p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                                        Email Address <span className="text-rose-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                        <input
                                            type="email"
                                            required
                                            value={email}
                                            onChange={(e) => {
                                                setEmail(e.target.value);
                                                if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: "" }));
                                            }}
                                            disabled={registerMutation.isPending}
                                            className={`w-full rounded-xl border pl-10 pr-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 ${
                                                fieldErrors.email
                                                    ? "border-rose-300 bg-rose-50/30 focus:border-rose-500 focus:ring-rose-100"
                                                    : "border-slate-200 bg-white focus:border-[#2563EB] focus:ring-blue-100"
                                            }`}
                                            placeholder="agent@example.com"
                                        />
                                    </div>
                                    {fieldErrors.email && (
                                        <p className="mt-1 text-xs text-rose-600">{fieldErrors.email}</p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Section 2: Personal & Contact Details */}
                        <div className="border-t border-slate-100 pt-8">
                            <div className="mb-4">
                                <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
                                    <User className="h-4 w-4 text-[#2563EB]" />
                                    Personal & Contact Details
                                </h2>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    Driver identity and contact details displayed on delivery manifests.
                                </p>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                                        First Name
                                    </label>
                                    <input
                                        type="text"
                                        value={firstName}
                                        onChange={(e) => setFirstName(e.target.value)}
                                        maxLength={150}
                                        disabled={registerMutation.isPending}
                                        className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-blue-100"
                                        placeholder="First name"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                                        Last Name
                                    </label>
                                    <input
                                        type="text"
                                        value={lastName}
                                        onChange={(e) => setLastName(e.target.value)}
                                        maxLength={150}
                                        disabled={registerMutation.isPending}
                                        className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-blue-100"
                                        placeholder="Last name"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                                        Phone Number <span className="text-rose-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <Phone className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                        <input
                                            type="tel"
                                            required
                                            value={phoneNumber}
                                            onChange={(e) => {
                                                setPhoneNumber(e.target.value);
                                                if (fieldErrors.phone_number) setFieldErrors((prev) => ({ ...prev, phone_number: "" }));
                                            }}
                                            maxLength={16}
                                            disabled={registerMutation.isPending}
                                            className={`w-full rounded-xl border pl-10 pr-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 ${
                                                fieldErrors.phone_number
                                                    ? "border-rose-300 bg-rose-50/30 focus:border-rose-500 focus:ring-rose-100"
                                                    : "border-slate-200 bg-white focus:border-[#2563EB] focus:ring-blue-100"
                                            }`}
                                            placeholder="e.g. 9876543210"
                                        />
                                    </div>
                                    {fieldErrors.phone_number && (
                                        <p className="mt-1 text-xs text-rose-600">{fieldErrors.phone_number}</p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Section 3: Shift Scheduling & Availability */}
                        <div className="border-t border-slate-100 pt-8">
                            <div className="mb-4">
                                <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
                                    <Clock className="h-4 w-4 text-[#2563EB]" />
                                    Shift Scheduling & Availability
                                </h2>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    Working hours during which this agent is eligible to receive task assignments.
                                </p>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                                        Shift Starts At <span className="text-rose-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <Clock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                        <input
                                            type="time"
                                            required
                                            value={shiftStartsAt}
                                            onChange={(e) => {
                                                setShiftStartsAt(e.target.value);
                                                if (fieldErrors.shift_starts_at) setFieldErrors((prev) => ({ ...prev, shift_starts_at: "" }));
                                            }}
                                            disabled={registerMutation.isPending}
                                            className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2.5 text-sm text-slate-800 focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-blue-100"
                                        />
                                    </div>
                                    {fieldErrors.shift_starts_at && (
                                        <p className="mt-1 text-xs text-rose-600">{fieldErrors.shift_starts_at}</p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                                        Shift Ends At <span className="text-rose-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <Clock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                        <input
                                            type="time"
                                            required
                                            value={shiftEndsAt}
                                            onChange={(e) => {
                                                setShiftEndsAt(e.target.value);
                                                if (fieldErrors.shift_ends_at) setFieldErrors((prev) => ({ ...prev, shift_ends_at: "" }));
                                            }}
                                            disabled={registerMutation.isPending}
                                            className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2.5 text-sm text-slate-800 focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-blue-100"
                                        />
                                    </div>
                                    {fieldErrors.shift_ends_at && (
                                        <p className="mt-1 text-xs text-rose-600">{fieldErrors.shift_ends_at}</p>
                                    )}
                                </div>
                            </div>

                            <div className="mt-4 flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                                <div>
                                    <p className="text-sm font-semibold text-slate-800">Activate Account on Creation</p>
                                    <p className="text-xs text-slate-500">
                                        When active, the driver can immediately receive task assignments during their shift.
                                    </p>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={isActive}
                                    onChange={(e) => setIsActive(e.target.checked)}
                                    disabled={registerMutation.isPending}
                                    className="h-5 w-5 rounded border-slate-300 text-[#2563EB] focus:ring-blue-500 cursor-pointer"
                                />
                            </div>
                        </div>

                        {/* Form Actions */}
                        <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-6">
                            <Link
                                to="/shop-admin/delivery-agents"
                                className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                            >
                                Cancel
                            </Link>
                            <button
                                type="submit"
                                disabled={registerMutation.isPending}
                                className="inline-flex items-center gap-2 rounded-xl bg-[#2563EB] px-6 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-blue-700 transition-colors disabled:opacity-60"
                            >
                                {registerMutation.isPending ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Registering Driver...
                                    </>
                                ) : (
                                    <>
                                        <UserPlus className="h-4 w-4" />
                                        Register Delivery Agent
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
