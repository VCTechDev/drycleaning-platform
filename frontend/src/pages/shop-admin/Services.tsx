import { useState, useMemo, useEffect, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { isAxiosError } from "axios";
import {
    AlertCircle,
    AlertTriangle,
    CheckCircle2,
    Clock,
    Edit3,
    Layers,
    Loader2,
    Plus,
    Power,
    RefreshCw,
    Search,
    ShieldAlert,
    Sparkles,
    Tag,
    Wrench,
    X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useShopDetails } from "../../hooks/shopAdmin/useShopAdminProfile";
import {
    useCreateShopService,
    useGarmentTypes,
    usePlatformServices,
    useShopServices,
    useUpdateShopService,
} from "../../hooks/shopAdmin/useShopAdminServices";
import type {
    GarmentTypeItem,
    PlatformServiceItem,
    ShopServiceItem,
} from "../../types/shopAdmin/services";

interface FeedbackState {
    tone: "success" | "error";
    title: string;
    description: string;
}

const getApiErrorMessage = (error: unknown, fallback: string): string => {
    if (!isAxiosError(error)) return fallback;
    const data = error.response?.data;
    if (typeof data === "string" && data.trim()) return data;
    if (!data || typeof data !== "object") return fallback;

    const record = data as Record<string, unknown>;
    if (typeof record.detail === "string" && record.detail.trim()) {
        return record.detail;
    }
    if (typeof record.non_field_errors === "string") {
        return record.non_field_errors;
    }
    if (Array.isArray(record.non_field_errors) && record.non_field_errors[0]) {
        return String(record.non_field_errors[0]);
    }

    for (const val of Object.values(record)) {
        if (typeof val === "string") return val;
        if (Array.isArray(val) && typeof val[0] === "string") return val[0];
    }
    return fallback;
};

const getApiFieldErrors = (error: unknown): Record<string, string> => {
    if (!isAxiosError(error) || !error.response?.data) return {};
    const data = error.response.data;
    if (typeof data !== "object" || data === null) return {};

    const res: Record<string, string> = {};
    for (const [key, value] of Object.entries(data)) {
        if (typeof value === "string") {
            res[key] = value;
        } else if (Array.isArray(value) && typeof value[0] === "string") {
            res[key] = value[0];
        }
    }
    return res;
};

// ----------------------------------------------------------------------
// Add Service Modal Dialog
// ----------------------------------------------------------------------
interface AddServiceDialogProps {
    onClose: () => void;
    platformServices: PlatformServiceItem[];
    garmentTypes: GarmentTypeItem[];
    existingShopServices: ShopServiceItem[];
    onSuccess: (item: ShopServiceItem) => void;
}

function AddServiceDialog({
    onClose,
    platformServices,
    garmentTypes,
    existingShopServices,
    onSuccess,
}: AddServiceDialogProps) {
    const createMutation = useCreateShopService();

    const [serviceId, setServiceId] = useState<number | "">(() => platformServices[0]?.id ?? "");
    const [garmentTypeId, setGarmentTypeId] = useState<number | "">(() => garmentTypes[0]?.id ?? "");
    const [price, setPrice] = useState("");
    const [estimatedDays, setEstimatedDays] = useState("2");
    const [isActive, setIsActive] = useState(true);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [generalError, setGeneralError] = useState<string | null>(null);

    // Close on Escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape" && !createMutation.isPending) {
                onClose();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [onClose, createMutation.isPending]);

    // Check if the selected combination is already configured
    const isCombinationDuplicate = useMemo(() => {
        if (!serviceId || !garmentTypeId) return false;
        return existingShopServices.some(
            (ss) =>
                ss.service === Number(serviceId) &&
                ss.garment_type === Number(garmentTypeId)
        );
    }, [serviceId, garmentTypeId, existingShopServices]);

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        setFieldErrors({});
        setGeneralError(null);

        const errors: Record<string, string> = {};

        if (!serviceId) {
            errors.service = "Please select a platform service.";
        }
        if (!garmentTypeId) {
            errors.garment_type = "Please select a garment type.";
        }

        const numPrice = parseFloat(price);
        if (!price || isNaN(numPrice) || numPrice <= 0) {
            errors.price = "Price must be a valid number greater than 0.";
        }

        const numDays = parseInt(estimatedDays, 10);
        if (!estimatedDays || isNaN(numDays) || numDays < 1) {
            errors.estimated_days = "Turnaround days must be at least 1.";
        }

        if (isCombinationDuplicate) {
            errors.service =
                "This service and garment type combination is already configured for your shop.";
        }

        if (Object.keys(errors).length > 0) {
            setFieldErrors(errors);
            return;
        }

        createMutation.mutate(
            {
                service: Number(serviceId),
                garment_type: Number(garmentTypeId),
                price: numPrice.toFixed(2),
                estimated_days: numDays,
                is_active: isActive,
            },
            {
                onSuccess: (newItem) => {
                    onSuccess(newItem);
                    onClose();
                },
                onError: (err) => {
                    const apiErrors = getApiFieldErrors(err);
                    setFieldErrors(apiErrors);
                    setGeneralError(
                        getApiErrorMessage(
                            err,
                            "Failed to configure service. Please verify your inputs and try again."
                        )
                    );
                },
            }
        );
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-xs transition-opacity animate-in fade-in duration-150"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-service-title"
        >
            <div
                className="w-full max-w-lg rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-xl sm:p-8"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-start justify-between border-b border-slate-100 pb-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-[#2563EB]">
                            <Plus className="h-5 w-5" />
                        </div>
                        <div>
                            <h2
                                id="add-service-title"
                                className="text-lg font-bold text-slate-900"
                            >
                                Configure New Shop Service
                            </h2>
                            <p className="text-xs text-slate-500">
                                Select from verified platform catalogs and set custom pricing.
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={createMutation.isPending}
                        className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        aria-label="Close dialog"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} noValidate className="mt-5 space-y-4">
                    {generalError && (
                        <div
                            role="alert"
                            className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-900"
                        >
                            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                            <p className="leading-relaxed">{generalError}</p>
                        </div>
                    )}

                    {/* Platform Service Selection */}
                    <div>
                        <label
                            htmlFor="add-service-select"
                            className="block text-xs font-semibold text-slate-700"
                        >
                            Platform Service <span className="text-red-500">*</span>
                        </label>
                        <select
                            id="add-service-select"
                            value={serviceId}
                            onChange={(e) => {
                                setServiceId(Number(e.target.value));
                                setFieldErrors((prev) => {
                                    const next = { ...prev };
                                    delete next.service;
                                    return next;
                                });
                            }}
                            className="mt-1.5 h-10 w-full rounded-xl border border-input bg-input/30 px-3 text-sm text-slate-900 transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 outline-none"
                        >
                            <option value="" disabled>
                                Select a platform service...
                            </option>
                            {platformServices.map((ps) => (
                                <option key={ps.id} value={ps.id}>
                                    {ps.service_name}
                                </option>
                            ))}
                        </select>
                        {fieldErrors.service && (
                            <p className="mt-1 text-xs text-red-600" role="alert">
                                {fieldErrors.service}
                            </p>
                        )}
                    </div>

                    {/* Garment Type Selection */}
                    <div>
                        <label
                            htmlFor="add-garment-select"
                            className="block text-xs font-semibold text-slate-700"
                        >
                            Garment Type <span className="text-red-500">*</span>
                        </label>
                        <select
                            id="add-garment-select"
                            value={garmentTypeId}
                            onChange={(e) => {
                                setGarmentTypeId(Number(e.target.value));
                                setFieldErrors((prev) => {
                                    const next = { ...prev };
                                    delete next.garment_type;
                                    return next;
                                });
                            }}
                            className="mt-1.5 h-10 w-full rounded-xl border border-input bg-input/30 px-3 text-sm text-slate-900 transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 outline-none"
                        >
                            <option value="" disabled>
                                Select a garment type...
                            </option>
                            {garmentTypes.map((gt) => (
                                <option key={gt.id} value={gt.id}>
                                    {gt.garment_name}
                                </option>
                            ))}
                        </select>
                        {fieldErrors.garment_type && (
                            <p className="mt-1 text-xs text-red-600" role="alert">
                                {fieldErrors.garment_type}
                            </p>
                        )}
                    </div>

                    {/* Combination Duplicate Warning */}
                    {isCombinationDuplicate && (
                        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900">
                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                            <p>
                                <strong>Already Configured:</strong> This service and garment
                                type combination already exists in your shop. Edit the existing
                                item to update its price.
                            </p>
                        </div>
                    )}

                    {/* Price & Turnaround Inputs */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label
                                htmlFor="add-service-price"
                                className="block text-xs font-semibold text-slate-700"
                            >
                                Price (₹) <span className="text-red-500">*</span>
                            </label>
                            <div className="relative mt-1.5">
                                <Input
                                    id="add-service-price"
                                    type="number"
                                    step="0.01"
                                    min="1"
                                    placeholder="150.00"
                                    value={price}
                                    onChange={(e) => {
                                        setPrice(e.target.value);
                                        setFieldErrors((prev) => {
                                            const next = { ...prev };
                                            delete next.price;
                                            return next;
                                        });
                                    }}
                                    className="pl-8"
                                    required
                                />
                                <span className="absolute left-3 top-2.5 text-sm font-semibold text-slate-400">
                                    ₹
                                </span>
                            </div>
                            {fieldErrors.price && (
                                <p className="mt-1 text-xs text-red-600" role="alert">
                                    {fieldErrors.price}
                                </p>
                            )}
                        </div>

                        <div>
                            <label
                                htmlFor="add-service-days"
                                className="block text-xs font-semibold text-slate-700"
                            >
                                Turnaround (Days) <span className="text-red-500">*</span>
                            </label>
                            <div className="relative mt-1.5">
                                <Input
                                    id="add-service-days"
                                    type="number"
                                    min="1"
                                    step="1"
                                    placeholder="2"
                                    value={estimatedDays}
                                    onChange={(e) => {
                                        setEstimatedDays(e.target.value);
                                        setFieldErrors((prev) => {
                                            const next = { ...prev };
                                            delete next.estimated_days;
                                            return next;
                                        });
                                    }}
                                    className="pl-8"
                                    required
                                />
                                <Clock className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
                            </div>
                            {fieldErrors.estimated_days && (
                                <p className="mt-1 text-xs text-red-600" role="alert">
                                    {fieldErrors.estimated_days}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Active Checkbox */}
                    <div className="flex items-center gap-2 pt-1">
                        <input
                            id="add-service-active"
                            type="checkbox"
                            checked={isActive}
                            onChange={(e) => setIsActive(e.target.checked)}
                            className="h-4 w-4 rounded border-slate-300 text-[#2563EB] focus:ring-blue-500"
                        />
                        <label
                            htmlFor="add-service-active"
                            className="text-xs font-medium text-slate-700 cursor-pointer"
                        >
                            Active immediately (customers can place orders)
                        </label>
                    </div>

                    {/* Dialog Actions */}
                    <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={onClose}
                            disabled={createMutation.isPending}
                            className="rounded-xl text-slate-600 hover:bg-slate-100"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={
                                createMutation.isPending || isCombinationDuplicate || !price
                            }
                            className="rounded-xl bg-[#2563EB] text-white hover:bg-blue-700"
                        >
                            {createMutation.isPending ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Configuring...
                                </>
                            ) : (
                                <>
                                    <Plus className="mr-1.5 h-4 w-4" />
                                    Add Service
                                </>
                            )}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ----------------------------------------------------------------------
// Edit Service Modal Dialog
// ----------------------------------------------------------------------
interface EditServiceDialogProps {
    service: ShopServiceItem;
    onClose: () => void;
    onSuccess: (updated: ShopServiceItem) => void;
}

function EditServiceDialog({
    service,
    onClose,
    onSuccess,
}: EditServiceDialogProps) {
    const updateMutation = useUpdateShopService();

    const [price, setPrice] = useState(() => service.price);
    const [estimatedDays, setEstimatedDays] = useState(() => String(service.estimated_days));
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [generalError, setGeneralError] = useState<string | null>(null);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape" && !updateMutation.isPending) {
                onClose();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [onClose, updateMutation.isPending]);

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        setFieldErrors({});
        setGeneralError(null);

        const errors: Record<string, string> = {};
        const numPrice = parseFloat(price);
        if (!price || isNaN(numPrice) || numPrice <= 0) {
            errors.price = "Price must be greater than 0.";
        }

        const numDays = parseInt(estimatedDays, 10);
        if (!estimatedDays || isNaN(numDays) || numDays < 1) {
            errors.estimated_days = "Estimated days must be at least 1.";
        }

        if (Object.keys(errors).length > 0) {
            setFieldErrors(errors);
            return;
        }

        updateMutation.mutate(
            {
                id: service.id,
                data: {
                    price: numPrice.toFixed(2),
                    estimated_days: numDays,
                },
            },
            {
                onSuccess: (updatedItem) => {
                    onSuccess(updatedItem);
                    onClose();
                },
                onError: (err) => {
                    setFieldErrors(getApiFieldErrors(err));
                    setGeneralError(
                        getApiErrorMessage(
                            err,
                            "Could not update service details. Please try again."
                        )
                    );
                },
            }
        );
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-xs transition-opacity animate-in fade-in duration-150"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-service-title"
        >
            <div
                className="w-full max-w-md rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-xl sm:p-8"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-start justify-between border-b border-slate-100 pb-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-[#2563EB]">
                            <Edit3 className="h-5 w-5" />
                        </div>
                        <div>
                            <h2
                                id="edit-service-title"
                                className="text-lg font-bold text-slate-900"
                            >
                                Edit Service Details
                            </h2>
                            <p className="text-xs text-slate-500">
                                Update pricing and estimated delivery turnaround.
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={updateMutation.isPending}
                        className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        aria-label="Close dialog"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} noValidate className="mt-5 space-y-4">
                    {generalError && (
                        <div
                            role="alert"
                            className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-900"
                        >
                            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                            <p className="leading-relaxed">{generalError}</p>
                        </div>
                    )}

                    {/* Read-only Service & Garment Info */}
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-1">
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-500">Service:</span>
                            <span className="font-semibold text-slate-800">
                                {service.service_name}
                            </span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-500">Garment Type:</span>
                            <span className="font-semibold text-slate-800">
                                {service.garment_name}
                            </span>
                        </div>
                    </div>

                    {/* Editable Price */}
                    <div>
                        <label
                            htmlFor="edit-service-price"
                            className="block text-xs font-semibold text-slate-700"
                        >
                            Price (₹) <span className="text-red-500">*</span>
                        </label>
                        <div className="relative mt-1.5">
                            <Input
                                id="edit-service-price"
                                type="number"
                                step="0.01"
                                min="1"
                                value={price}
                                onChange={(e) => setPrice(e.target.value)}
                                className="pl-8"
                                required
                            />
                            <span className="absolute left-3 top-2.5 text-sm font-semibold text-slate-400">
                                ₹
                            </span>
                        </div>
                        {fieldErrors.price && (
                            <p className="mt-1 text-xs text-red-600" role="alert">
                                {fieldErrors.price}
                            </p>
                        )}
                    </div>

                    {/* Editable Turnaround Days */}
                    <div>
                        <label
                            htmlFor="edit-service-days"
                            className="block text-xs font-semibold text-slate-700"
                        >
                            Turnaround (Days) <span className="text-red-500">*</span>
                        </label>
                        <div className="relative mt-1.5">
                            <Input
                                id="edit-service-days"
                                type="number"
                                min="1"
                                step="1"
                                value={estimatedDays}
                                onChange={(e) => setEstimatedDays(e.target.value)}
                                className="pl-8"
                                required
                            />
                            <Clock className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
                        </div>
                        {fieldErrors.estimated_days && (
                            <p className="mt-1 text-xs text-red-600" role="alert">
                                {fieldErrors.estimated_days}
                            </p>
                        )}
                    </div>

                    {/* Dialog Actions */}
                    <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={onClose}
                            disabled={updateMutation.isPending}
                            className="rounded-xl text-slate-600 hover:bg-slate-100"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={updateMutation.isPending || !price}
                            className="rounded-xl bg-[#2563EB] text-white hover:bg-blue-700"
                        >
                            {updateMutation.isPending ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                "Save Changes"
                            )}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ----------------------------------------------------------------------
// Main ShopServices Page
// ----------------------------------------------------------------------
function ShopServices() {
    const {
        data: shopServices = [],
        isLoading: isServicesLoading,
        isError: isServicesError,
        error: servicesError,
        refetch: refetchServices,
    } = useShopServices();

    const { data: platformServices = [], isLoading: isPlatformLoading } =
        usePlatformServices();
    const { data: garmentTypes = [], isLoading: isGarmentsLoading } =
        useGarmentTypes();
    const { data: shop } = useShopDetails();

    const updateServiceMutation = useUpdateShopService();

    // Dialog state
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [editingService, setEditingService] = useState<ShopServiceItem | null>(
        null
    );

    // Search, filter, and pagination state
    const ITEMS_PER_PAGE = 10;
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">(
        "all"
    );
    const [currentPage, setCurrentPage] = useState(1);

    // Feedback message state
    const [feedback, setFeedback] = useState<FeedbackState | null>(null);

    // Track active services count
    const activeCount = useMemo(
        () => shopServices.filter((s) => s.is_active).length,
        [shopServices]
    );

    // Filtered services
    const filteredServices = useMemo(() => {
        return shopServices.filter((s) => {
            const matchesSearch =
                s.service_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                s.garment_name.toLowerCase().includes(searchQuery.toLowerCase());

            if (!matchesSearch) return false;

            if (statusFilter === "active") return s.is_active;
            if (statusFilter === "inactive") return !s.is_active;
            return true;
        });
    }, [shopServices, searchQuery, statusFilter]);

    // Paginated services slice
    const totalPages = Math.max(1, Math.ceil(filteredServices.length / ITEMS_PER_PAGE));
    const safePage = Math.min(currentPage, totalPages);
    const startIndex = (safePage - 1) * ITEMS_PER_PAGE;
    const paginatedServices = useMemo(() => {
        return filteredServices.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [filteredServices, startIndex]);

    // Handle toggle active/inactive status
    const handleToggleActive = (service: ShopServiceItem) => {
        const nextStatus = !service.is_active;

        updateServiceMutation.mutate(
            {
                id: service.id,
                data: { is_active: nextStatus },
            },
            {
                onSuccess: () => {
                    if (
                        !nextStatus &&
                        activeCount === 1 &&
                        service.is_active &&
                        shop?.is_open
                    ) {
                        setFeedback({
                            tone: "success",
                            title: "Service deactivated & shop closed",
                            description: `${service.service_name} (${service.garment_name}) was deactivated. Because it was your last active service, your shop was automatically set to closed.`,
                        });
                    } else {
                        setFeedback({
                            tone: "success",
                            title: nextStatus ? "Service activated" : "Service deactivated",
                            description: `${service.service_name} for ${service.garment_name} is now ${
                                nextStatus ? "active and orderable" : "inactive"
                            }.`,
                        });
                    }
                },
                onError: (err) => {
                    setFeedback({
                        tone: "error",
                        title: "Failed to update service status",
                        description: getApiErrorMessage(
                            err,
                            "An unexpected error occurred while toggling service status."
                        ),
                    });
                },
            }
        );
    };

    if (isServicesLoading || isPlatformLoading || isGarmentsLoading) {
        return (
            <div className="space-y-6 animate-pulse" aria-label="Loading services">
                <div className="h-32 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs" />
                <div className="h-14 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs" />
                <div className="h-80 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs" />
            </div>
        );
    }

    if (isServicesError) {
        return (
            <div className="rounded-2xl border border-red-200 bg-white p-8 text-center shadow-xs">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600">
                    <AlertCircle className="h-6 w-6" />
                </div>
                <h2 className="mt-4 text-xl font-bold text-slate-900">
                    Unable to load services
                </h2>
                <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
                    {getApiErrorMessage(
                        servicesError,
                        "Could not retrieve your configured services. Please try again."
                    )}
                </p>
                <div className="mt-6 flex justify-center">
                    <Button
                        type="button"
                        onClick={() => refetchServices()}
                        className="bg-[#2563EB] text-white hover:bg-blue-700"
                    >
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Retry
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-12">
            {/* Header Card */}
            <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-xs sm:p-8">
                <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#172554] text-white shadow-xs">
                            <Wrench className="h-6 w-6" />
                        </div>
                        <div>
                            <div className="flex flex-wrap items-center gap-2.5">
                                <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
                                    Shop Services & Pricing
                                </h1>
                                <span className="rounded-md bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                                    {shopServices.length} Total
                                </span>
                            </div>
                            <p className="mt-1 text-xs text-slate-500 sm:text-sm">
                                Configure service rates, turnaround guarantees, and customer
                                availability for {shop?.shop_name || "your shop"}.
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <Link
                            to="/shop-admin/service-requests"
                            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs transition"
                        >
                            <Sparkles className="h-3.5 w-3.5 text-blue-600" />
                            Request New Service
                        </Link>

                        <Button
                            type="button"
                            onClick={() => setIsAddOpen(true)}
                            className="rounded-xl bg-[#2563EB] px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 shadow-xs"
                        >
                            <Plus className="mr-1.5 h-4 w-4" />
                            Add Service
                        </Button>
                    </div>
                </div>

                {/* Metrics Summary Strip */}
                <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 border-t border-slate-100 pt-5">
                    <div className="rounded-xl bg-slate-50/80 p-3 text-center sm:text-left">
                        <p className="text-[11px] font-medium text-slate-500">
                            Total Configured
                        </p>
                        <p className="mt-1 text-lg font-bold text-slate-900">
                            {shopServices.length}
                        </p>
                    </div>

                    <div className="rounded-xl bg-emerald-50/80 p-3 text-center sm:text-left">
                        <p className="text-[11px] font-medium text-emerald-800">
                            Active Services
                        </p>
                        <p className="mt-1 text-lg font-bold text-emerald-700">
                            {activeCount}
                        </p>
                    </div>

                    <div className="rounded-xl bg-slate-100/70 p-3 text-center sm:text-left">
                        <p className="text-[11px] font-medium text-slate-600">
                            Inactive Services
                        </p>
                        <p className="mt-1 text-lg font-bold text-slate-700">
                            {shopServices.length - activeCount}
                        </p>
                    </div>

                    <div className="rounded-xl bg-blue-50/70 p-3 text-center sm:text-left">
                        <p className="text-[11px] font-medium text-blue-800">
                            Catalog Available
                        </p>
                        <p className="mt-1 text-lg font-bold text-blue-700">
                            {platformServices.length} Services
                        </p>
                    </div>
                </div>
            </div>

            {/* Feedback Alert */}
            {feedback && (
                <div
                    role={feedback.tone === "success" ? "status" : "alert"}
                    className={`flex items-start justify-between gap-3 rounded-2xl border p-4 text-xs sm:text-sm transition-all ${
                        feedback.tone === "success"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                            : "border-red-200 bg-red-50 text-red-900"
                    }`}
                >
                    <div className="flex items-start gap-3">
                        {feedback.tone === "success" ? (
                            <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600 shrink-0" />
                        ) : (
                            <AlertCircle className="mt-0.5 h-4 w-4 text-red-600 shrink-0" />
                        )}
                        <div>
                            <h3 className="font-semibold">{feedback.title}</h3>
                            <p className="mt-0.5 leading-relaxed text-xs">
                                {feedback.description}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => setFeedback(null)}
                        className="rounded p-1 text-slate-400 hover:text-slate-700"
                        aria-label="Dismiss feedback alert"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
            )}

            {/* Zero Active Services Warning */}
            {activeCount === 0 && shopServices.length > 0 && (
                <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs sm:text-sm text-amber-900">
                    <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                    <div>
                        <p className="font-semibold">
                            No active services configured
                        </p>
                        <p className="mt-0.5 text-xs text-amber-800">
                            A shop must have at least one active service before it can be
                            opened to accept customer orders. Activate at least one service
                            below to enable opening your shop.
                        </p>
                    </div>
                </div>
            )}

            {/* Controls Strip: Search & Filter Tabs */}
            <div className="flex flex-col gap-3 rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between">
                <div className="relative flex-1 sm:max-w-md">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
                    <Input
                        type="text"
                        placeholder="Search by service or garment name..."
                        value={searchQuery}
                        onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setCurrentPage(1);
                        }}
                        className="pl-9 text-xs sm:text-sm"
                    />
                    {searchQuery && (
                        <button
                            type="button"
                            onClick={() => {
                                setSearchQuery("");
                                setCurrentPage(1);
                            }}
                            className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                            aria-label="Clear search"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    )}
                </div>

                <div className="flex items-center gap-1.5 self-start sm:self-auto">
                    <span className="text-xs font-semibold text-slate-500 mr-1 hidden sm:inline">
                        Status:
                    </span>
                    {(["all", "active", "inactive"] as const).map((tab) => (
                        <button
                            key={tab}
                            type="button"
                            onClick={() => {
                                setStatusFilter(tab);
                                setCurrentPage(1);
                            }}
                            className={`rounded-xl px-3 py-1.5 text-xs font-semibold capitalize transition ${
                                statusFilter === tab
                                    ? "bg-[#172554] text-white shadow-xs"
                                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                            }`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>
            </div>

            {/* Services List / Table */}
            {filteredServices.length === 0 ? (
                <div className="rounded-2xl border border-[#E2E8F0] bg-white p-12 text-center shadow-xs">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-[#2563EB]">
                        <Layers className="h-7 w-7" />
                    </div>
                    {shopServices.length === 0 ? (
                        <>
                            <h2 className="mt-4 text-lg font-bold text-slate-900">
                                No services configured yet
                            </h2>
                            <p className="mx-auto mt-1.5 max-w-sm text-xs text-slate-500">
                                Start adding services from the platform catalog to set your
                                prices and begin accepting dry cleaning orders.
                            </p>
                            <Button
                                type="button"
                                onClick={() => setIsAddOpen(true)}
                                className="mt-6 rounded-xl bg-[#2563EB] text-white hover:bg-blue-700"
                            >
                                <Plus className="mr-1.5 h-4 w-4" />
                                Add Your First Service
                            </Button>
                        </>
                    ) : (
                        <>
                            <h2 className="mt-4 text-base font-bold text-slate-900">
                                No matching services found
                            </h2>
                            <p className="mt-1 text-xs text-slate-500">
                                No configured services match your search or filter criteria.
                            </p>
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={() => {
                                    setSearchQuery("");
                                    setStatusFilter("all");
                                    setCurrentPage(1);
                                }}
                                className="mt-4 rounded-xl text-xs text-blue-600 hover:bg-blue-50"
                            >
                                Reset filters
                            </Button>
                        </>
                    )}
                </div>
            ) : (
                <>
                    {/* Desktop View: Styled Table (hidden on mobile) */}
                    <div className="hidden lg:block overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-xs">
                        <table className="w-full text-left text-sm">
                            <thead className="border-b border-slate-100 bg-slate-50/70 text-xs font-semibold text-slate-500">
                                <tr>
                                    <th scope="col" className="px-6 py-3.5">
                                        Service Name
                                    </th>
                                    <th scope="col" className="px-6 py-3.5">
                                        Garment Type
                                    </th>
                                    <th scope="col" className="px-6 py-3.5">
                                        Price
                                    </th>
                                    <th scope="col" className="px-6 py-3.5">
                                        Turnaround
                                    </th>
                                    <th scope="col" className="px-6 py-3.5">
                                        Status
                                    </th>
                                    <th scope="col" className="px-6 py-3.5 text-right">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {paginatedServices.map((service) => (
                                    <tr
                                        key={service.id}
                                        className="transition hover:bg-slate-50/60"
                                    >
                                        <td className="px-6 py-4">
                                            <div className="font-semibold text-slate-900">
                                                {service.service_name}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                                                <Tag className="h-3 w-3 text-slate-400" />
                                                {service.garment_name}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="font-bold text-slate-900">
                                                ₹{parseFloat(service.price).toFixed(2)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-xs text-slate-600">
                                            <span className="inline-flex items-center gap-1">
                                                <Clock className="h-3.5 w-3.5 text-slate-400" />
                                                {service.estimated_days}{" "}
                                                {service.estimated_days === 1 ? "day" : "days"}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            {service.is_active ? (
                                                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-600/20">
                                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                                    Active
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-300">
                                                    <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                                                    Inactive
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setEditingService(service)}
                                                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
                                                >
                                                    <Edit3 className="h-3.5 w-3.5 text-slate-500" />
                                                    Edit
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={() => handleToggleActive(service)}
                                                    disabled={updateServiceMutation.isPending}
                                                    className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                                                        service.is_active
                                                            ? "border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"
                                                            : "border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                                                    }`}
                                                >
                                                    <Power className="h-3.5 w-3.5" />
                                                    {service.is_active
                                                        ? "Deactivate"
                                                        : "Activate"}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile View: Stacked Service Cards (hidden on desktop) */}
                    <div className="grid gap-3.5 lg:hidden">
                        {paginatedServices.map((service) => (
                            <div
                                key={service.id}
                                className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-xs space-y-3.5"
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <h3 className="font-bold text-slate-900 text-sm">
                                            {service.service_name}
                                        </h3>
                                        <span className="mt-1 inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                                            <Tag className="h-3 w-3 text-slate-400" />
                                            {service.garment_name}
                                        </span>
                                    </div>

                                    {service.is_active ? (
                                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-600/20">
                                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                            Active
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-300">
                                            <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                                            Inactive
                                        </span>
                                    )}
                                </div>

                                <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
                                    <div>
                                        <span className="text-slate-500">Price: </span>
                                        <span className="font-bold text-slate-900 text-sm">
                                            ₹{parseFloat(service.price).toFixed(2)}
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-1 text-slate-600">
                                        <Clock className="h-3.5 w-3.5 text-slate-400" />
                                        <span>
                                            {service.estimated_days}{" "}
                                            {service.estimated_days === 1 ? "day" : "days"}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 border-t border-slate-100 pt-3">
                                    <button
                                        type="button"
                                        onClick={() => setEditingService(service)}
                                        className="flex-1 inline-flex justify-center items-center gap-1.5 rounded-xl border border-slate-200 bg-white py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
                                    >
                                        <Edit3 className="h-3.5 w-3.5 text-slate-500" />
                                        Edit Price
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => handleToggleActive(service)}
                                        disabled={updateServiceMutation.isPending}
                                        className={`flex-1 inline-flex justify-center items-center gap-1.5 rounded-xl py-2 text-xs font-medium transition ${
                                            service.is_active
                                                ? "border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"
                                                : "border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                                        }`}
                                    >
                                        <Power className="h-3.5 w-3.5" />
                                        {service.is_active ? "Deactivate" : "Activate"}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Pagination Controls */}
                    {filteredServices.length > ITEMS_PER_PAGE && (
                        <div className="flex flex-col items-center justify-between gap-4 rounded-2xl border border-[#E2E8F0] bg-white px-5 py-3.5 shadow-xs sm:flex-row">
                            <p className="text-xs text-slate-500">
                                Showing <span className="font-semibold text-slate-800">{startIndex + 1}</span> to{" "}
                                <span className="font-semibold text-slate-800">
                                    {Math.min(startIndex + ITEMS_PER_PAGE, filteredServices.length)}
                                </span>{" "}
                                of <span className="font-semibold text-slate-800">{filteredServices.length}</span> services
                            </p>

                            <div className="flex items-center gap-1.5">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                    disabled={safePage === 1}
                                    className="rounded-xl text-xs h-8 px-2.5 text-slate-600"
                                >
                                    Previous
                                </Button>

                                <div className="flex items-center gap-1">
                                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                                        <button
                                            key={pageNum}
                                            type="button"
                                            onClick={() => setCurrentPage(pageNum)}
                                            className={`h-8 w-8 rounded-xl text-xs font-semibold transition ${
                                                pageNum === safePage
                                                    ? "bg-[#172554] text-white shadow-xs"
                                                    : "text-slate-600 hover:bg-slate-100"
                                            }`}
                                        >
                                            {pageNum}
                                        </button>
                                    ))}
                                </div>

                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                                    disabled={safePage === totalPages}
                                    className="rounded-xl text-xs h-8 px-2.5 text-slate-600"
                                >
                                    Next
                                </Button>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* Add Service Dialog */}
            {isAddOpen && (
                <AddServiceDialog
                    onClose={() => setIsAddOpen(false)}
                    platformServices={platformServices}
                    garmentTypes={garmentTypes}
                    existingShopServices={shopServices}
                    onSuccess={(newItem) => {
                        setFeedback({
                            tone: "success",
                            title: "Service configured successfully",
                            description: `Added ${newItem.service_name} for ${newItem.garment_name} at ₹${newItem.price}.`,
                        });
                    }}
                />
            )}

            {/* Edit Service Dialog */}
            {editingService && (
                <EditServiceDialog
                    key={editingService.id}
                    service={editingService}
                    onClose={() => setEditingService(null)}
                    onSuccess={(updatedItem) => {
                        setFeedback({
                            tone: "success",
                            title: "Service updated",
                            description: `Updated price and turnaround for ${updatedItem.service_name} (${updatedItem.garment_name}).`,
                        });
                    }}
                />
            )}
        </div>
    );
}

export default ShopServices;
