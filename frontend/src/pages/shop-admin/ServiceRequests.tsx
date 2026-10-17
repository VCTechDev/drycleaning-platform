import { useState, useMemo, useEffect, useRef, type FormEvent, type ChangeEvent } from "react";
import { Link } from "react-router-dom";
import { isAxiosError } from "axios";
import {
    AlertCircle,
    BriefcaseBusiness,
    CheckCircle2,
    Clock,
    Loader2,
    Plus,
    RefreshCw,
    Search,
    ShieldAlert,
    Sparkles,
    Upload,
    Wrench,
    X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useShopDetails } from "../../hooks/shopAdmin/useShopAdminProfile";
import {
    useCreateServiceRequest,
    useServiceRequests,
} from "../../hooks/shopAdmin/useShopAdminServices";
import type {
    ShopServiceRequestItem,
} from "../../types/shopAdmin/services";

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const ACCEPTED_IMAGE_TYPES = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
];

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

const formatDate = (dateStr?: string | null): string => {
    if (!dateStr) return "";
    try {
        const d = new Date(dateStr);
        return d.toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
        });
    } catch {
        return dateStr;
    }
};

// ----------------------------------------------------------------------
// Create Service Request Modal Dialog
// ----------------------------------------------------------------------
interface CreateRequestDialogProps {
    open: boolean;
    onClose: () => void;
    isShopApproved: boolean;
    onSuccess: (item: ShopServiceRequestItem) => void;
}

function CreateRequestDialog({
    open,
    onClose,
    isShopApproved,
    onSuccess,
}: CreateRequestDialogProps) {
    const createMutation = useCreateServiceRequest();

    const [serviceName, setServiceName] = useState("");
    const [description, setDescription] = useState("");
    const [selectedImage, setSelectedImage] = useState<File | null>(null);
    const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [generalError, setGeneralError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Clean up preview blob URL
    useEffect(() => {
        return () => {
            if (imagePreviewUrl && imagePreviewUrl.startsWith("blob:")) {
                URL.revokeObjectURL(imagePreviewUrl);
            }
        };
    }, [imagePreviewUrl]);

    // Close on Escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape" && open && !createMutation.isPending) {
                onClose();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [open, onClose, createMutation.isPending]);

    if (!open) return null;

    const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
            setFieldErrors((prev) => ({
                ...prev,
                image: "Please choose a valid image format (JPEG, PNG, WEBP, or GIF).",
            }));
            e.target.value = "";
            return;
        }

        if (file.size > MAX_IMAGE_SIZE_BYTES) {
            setFieldErrors((prev) => ({
                ...prev,
                image: "Image file size must be less than 5 MB.",
            }));
            e.target.value = "";
            return;
        }

        setFieldErrors((prev) => {
            const next = { ...prev };
            delete next.image;
            return next;
        });

        if (imagePreviewUrl && imagePreviewUrl.startsWith("blob:")) {
            URL.revokeObjectURL(imagePreviewUrl);
        }

        setSelectedImage(file);
        setImagePreviewUrl(URL.createObjectURL(file));
    };

    const handleRevertImage = () => {
        if (imagePreviewUrl && imagePreviewUrl.startsWith("blob:")) {
            URL.revokeObjectURL(imagePreviewUrl);
        }
        setSelectedImage(null);
        setImagePreviewUrl(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
        setFieldErrors((prev) => {
            const next = { ...prev };
            delete next.image;
            return next;
        });
    };

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        setFieldErrors({});
        setGeneralError(null);

        if (!isShopApproved) {
            setGeneralError(
                "Only approved shops can submit service requests to platform administrators."
            );
            return;
        }

        const trimmedName = serviceName.trim();
        if (!trimmedName) {
            setFieldErrors({ service_name: "Service name is required." });
            return;
        }

        if (trimmedName.length > 50) {
            setFieldErrors({
                service_name: "Service name must not exceed 50 characters.",
            });
            return;
        }

        if (description.trim().length > 255) {
            setFieldErrors({
                description: "Description must not exceed 255 characters.",
            });
            return;
        }

        // Construct FormData for multipart submission
        const formData = new FormData();
        formData.append("service_name", trimmedName);
        if (description.trim()) {
            formData.append("description", description.trim());
        }
        if (selectedImage) {
            formData.append("image", selectedImage);
        }

        createMutation.mutate(formData, {
            onSuccess: (newReq) => {
                // Reset form on success
                setServiceName("");
                setDescription("");
                handleRevertImage();
                onSuccess(newReq);
                onClose();
            },
            onError: (err) => {
                // Preserve entered form values on error!
                const apiErrors = getApiFieldErrors(err);
                setFieldErrors(apiErrors);
                setGeneralError(
                    getApiErrorMessage(
                        err,
                        "Could not submit service request. Please check the form and try again."
                    )
                );
            },
        });
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-xs transition-opacity animate-in fade-in duration-150"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-request-title"
        >
            <div
                className="w-full max-w-lg rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-xl sm:p-8"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-start justify-between border-b border-slate-100 pb-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-[#2563EB]">
                            <BriefcaseBusiness className="h-5 w-5" />
                        </div>
                        <div>
                            <h2
                                id="create-request-title"
                                className="text-lg font-bold text-slate-900"
                            >
                                Request New Platform Service
                            </h2>
                            <p className="text-xs text-slate-500">
                                Propose a service to platform administrators for catalog inclusion.
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

                {!isShopApproved && (
                    <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                        <p>
                            <strong>Shop Verification Required:</strong> Your shop must be
                            verified and approved by platform administrators before submitting
                            new service requests.
                        </p>
                    </div>
                )}

                <form onSubmit={handleSubmit} noValidate className="mt-4 space-y-4">
                    {generalError && (
                        <div
                            role="alert"
                            className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-900"
                        >
                            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                            <p className="leading-relaxed">{generalError}</p>
                        </div>
                    )}

                    {/* Service Name */}
                    <div>
                        <div className="flex items-center justify-between">
                            <label
                                htmlFor="request-service-name"
                                className="text-xs font-semibold text-slate-700"
                            >
                                Service Name <span className="text-red-500">*</span>
                            </label>
                            <span className="text-[11px] text-slate-400">
                                {serviceName.length}/50
                            </span>
                        </div>
                        <Input
                            id="request-service-name"
                            value={serviceName}
                            onChange={(e) => {
                                setServiceName(e.target.value);
                                setFieldErrors((prev) => {
                                    const next = { ...prev };
                                    delete next.service_name;
                                    return next;
                                });
                            }}
                            maxLength={50}
                            placeholder="e.g. Leather Jacket Conditioning, Wedding Gown Preservation"
                            className="mt-1.5"
                            required
                        />
                        {fieldErrors.service_name && (
                            <p className="mt-1 text-xs text-red-600" role="alert">
                                {fieldErrors.service_name}
                            </p>
                        )}
                    </div>

                    {/* Description */}
                    <div>
                        <div className="flex items-center justify-between">
                            <label
                                htmlFor="request-description"
                                className="text-xs font-semibold text-slate-700"
                            >
                                Description (Optional)
                            </label>
                            <span className="text-[11px] text-slate-400">
                                {description.length}/255
                            </span>
                        </div>
                        <textarea
                            id="request-description"
                            rows={3}
                            value={description}
                            onChange={(e) => {
                                setDescription(e.target.value);
                                setFieldErrors((prev) => {
                                    const next = { ...prev };
                                    delete next.description;
                                    return next;
                                });
                            }}
                            maxLength={255}
                            placeholder="Describe what the service entails, specialized chemicals, techniques, or customer benefits..."
                            className="mt-1.5 w-full rounded-xl border border-input bg-input/30 p-3 text-sm text-slate-900 transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 outline-none"
                        />
                        {fieldErrors.description && (
                            <p className="mt-1 text-xs text-red-600" role="alert">
                                {fieldErrors.description}
                            </p>
                        )}
                    </div>

                    {/* Optional Reference Image */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-700">
                            Reference Photo (Optional)
                        </label>
                        <div className="mt-1.5 flex items-center gap-3">
                            {imagePreviewUrl ? (
                                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-slate-200">
                                    <img
                                        src={imagePreviewUrl}
                                        alt="Request reference"
                                        className="h-full w-full object-cover"
                                    />
                                    <button
                                        type="button"
                                        onClick={handleRevertImage}
                                        className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white hover:bg-black transition"
                                        title="Remove photo"
                                        aria-label="Remove photo"
                                    >
                                        <X className="h-3 w-3" />
                                    </button>
                                </div>
                            ) : null}

                            <div className="flex-1">
                                <input
                                    ref={fileInputRef}
                                    id="request-image-input"
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp,image/gif"
                                    onChange={handleImageChange}
                                    className="hidden"
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-full rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50 text-xs"
                                >
                                    <Upload className="mr-2 h-3.5 w-3.5" />
                                    {selectedImage ? "Change Photo" : "Upload Reference Photo"}
                                </Button>
                                <p className="mt-1 text-[11px] text-slate-400">
                                    JPEG, PNG, WEBP, or GIF up to 5 MB
                                </p>
                            </div>
                        </div>
                        {fieldErrors.image && (
                            <p className="mt-1 text-xs text-red-600" role="alert">
                                {fieldErrors.image}
                            </p>
                        )}
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
                                createMutation.isPending ||
                                !isShopApproved ||
                                !serviceName.trim()
                            }
                            className="rounded-xl bg-[#2563EB] text-white hover:bg-blue-700"
                        >
                            {createMutation.isPending ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Submitting...
                                </>
                            ) : (
                                "Submit Request"
                            )}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ----------------------------------------------------------------------
// Main ShopServiceRequests Page
// ----------------------------------------------------------------------
function ShopServiceRequests() {
    const {
        data: requests = [],
        isLoading: isRequestsLoading,
        isError: isRequestsError,
        error: requestsError,
        refetch: refetchRequests,
    } = useServiceRequests();

    const { data: shop } = useShopDetails();

    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [statusFilter, setStatusFilter] = useState<
        "all" | "pending_review" | "approved" | "rejected"
    >("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [feedback, setFeedback] = useState<FeedbackState | null>(null);

    // Compute status counts
    const counts = useMemo(() => {
        let pending = 0;
        let underReview = 0;
        let approved = 0;
        let rejected = 0;

        for (const req of requests) {
            if (req.status === "pending") pending++;
            else if (req.status === "under_review") underReview++;
            else if (req.status === "approved") approved++;
            else if (req.status === "rejected") rejected++;
        }

        return {
            total: requests.length,
            pending,
            underReview,
            pendingAndReview: pending + underReview,
            approved,
            rejected,
        };
    }, [requests]);

    // Filtered requests and pagination
    const ITEMS_PER_PAGE = 9;
    const [currentPage, setCurrentPage] = useState(1);

    const filteredRequests = useMemo(() => {
        return requests.filter((req) => {
            const matchesSearch =
                req.service_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                req.description.toLowerCase().includes(searchQuery.toLowerCase());

            if (!matchesSearch) return false;

            if (statusFilter === "pending_review") {
                return req.status === "pending" || req.status === "under_review";
            }
            if (statusFilter === "approved") {
                return req.status === "approved";
            }
            if (statusFilter === "rejected") {
                return req.status === "rejected";
            }
            return true;
        });
    }, [requests, searchQuery, statusFilter]);

    // Paginated requests slice
    const totalPages = Math.max(1, Math.ceil(filteredRequests.length / ITEMS_PER_PAGE));
    const safePage = Math.min(currentPage, totalPages);
    const startIndex = (safePage - 1) * ITEMS_PER_PAGE;
    const paginatedRequests = useMemo(() => {
        return filteredRequests.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [filteredRequests, startIndex]);

    if (isRequestsLoading) {
        return (
            <div className="space-y-6 animate-pulse" aria-label="Loading service requests">
                <div className="h-32 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs" />
                <div className="h-14 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs" />
                <div className="h-80 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs" />
            </div>
        );
    }

    if (isRequestsError) {
        return (
            <div className="rounded-2xl border border-red-200 bg-white p-8 text-center shadow-xs">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600">
                    <AlertCircle className="h-6 w-6" />
                </div>
                <h2 className="mt-4 text-xl font-bold text-slate-900">
                    Unable to load service requests
                </h2>
                <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
                    {getApiErrorMessage(
                        requestsError,
                        "Could not retrieve your custom service requests. Please try again."
                    )}
                </p>
                <div className="mt-6 flex justify-center">
                    <Button
                        type="button"
                        onClick={() => refetchRequests()}
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
                            <BriefcaseBusiness className="h-6 w-6" />
                        </div>
                        <div>
                            <div className="flex flex-wrap items-center gap-2.5">
                                <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
                                    Custom Service Requests
                                </h1>
                                <span className="rounded-md bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                                    {counts.total} Total
                                </span>
                            </div>
                            <p className="mt-1 text-xs text-slate-500 sm:text-sm">
                                Request specialized laundry or cleaning services to be added to
                                the VeeCleen platform catalog.
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <Link
                            to="/shop-admin/services"
                            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs transition"
                        >
                            <Wrench className="h-3.5 w-3.5 text-blue-600" />
                            View Configured Services
                        </Link>

                        <Button
                            type="button"
                            onClick={() => setIsCreateOpen(true)}
                            className="rounded-xl bg-[#2563EB] px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 shadow-xs"
                        >
                            <Plus className="mr-1.5 h-4 w-4" />
                            Request New Service
                        </Button>
                    </div>
                </div>

                {/* Status Summary Pills */}
                <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 border-t border-slate-100 pt-5">
                    <div className="rounded-xl bg-slate-50/80 p-3 text-center sm:text-left">
                        <p className="text-[11px] font-medium text-slate-500">
                            Total Submitted
                        </p>
                        <p className="mt-1 text-lg font-bold text-slate-900">
                            {counts.total}
                        </p>
                    </div>

                    <div className="rounded-xl bg-amber-50/80 p-3 text-center sm:text-left">
                        <p className="text-[11px] font-medium text-amber-800">
                            Pending Review
                        </p>
                        <p className="mt-1 text-lg font-bold text-amber-700">
                            {counts.pendingAndReview}
                        </p>
                    </div>

                    <div className="rounded-xl bg-emerald-50/80 p-3 text-center sm:text-left">
                        <p className="text-[11px] font-medium text-emerald-800">
                            Approved
                        </p>
                        <p className="mt-1 text-lg font-bold text-emerald-700">
                            {counts.approved}
                        </p>
                    </div>

                    <div className="rounded-xl bg-red-50/80 p-3 text-center sm:text-left">
                        <p className="text-[11px] font-medium text-red-800">
                            Rejected
                        </p>
                        <p className="mt-1 text-lg font-bold text-red-700">
                            {counts.rejected}
                        </p>
                    </div>
                </div>
            </div>

            {/* Unapproved Shop Notice */}
            {shop && !shop.is_approved && (
                <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs sm:text-sm text-amber-900">
                    <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                    <div>
                        <p className="font-semibold">
                            Shop Verification In Progress
                        </p>
                        <p className="mt-0.5 text-xs text-amber-800">
                            Your shop is currently pending platform administrator approval.
                            Custom service requests can only be reviewed once your shop is
                            approved.
                        </p>
                    </div>
                </div>
            )}

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
                        <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600 shrink-0" />
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

            {/* Search & Filter Strip */}
            <div className="flex flex-col gap-3 rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between">
                <div className="relative flex-1 sm:max-w-md">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
                    <Input
                        type="text"
                        placeholder="Search service requests..."
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
                        Filter:
                    </span>
                    {(
                        [
                            { id: "all", label: "All" },
                            { id: "pending_review", label: "In Review" },
                            { id: "approved", label: "Approved" },
                            { id: "rejected", label: "Rejected" },
                        ] as const
                    ).map((tab) => (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => {
                                setStatusFilter(tab.id);
                                setCurrentPage(1);
                            }}
                            className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                                statusFilter === tab.id
                                    ? "bg-[#172554] text-white shadow-xs"
                                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Requests Cards List */}
            {filteredRequests.length === 0 ? (
                <div className="rounded-2xl border border-[#E2E8F0] bg-white p-12 text-center shadow-xs">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-[#2563EB]">
                        <BriefcaseBusiness className="h-7 w-7" />
                    </div>
                    {requests.length === 0 ? (
                        <>
                            <h2 className="mt-4 text-lg font-bold text-slate-900">
                                No custom service requests yet
                            </h2>
                            <p className="mx-auto mt-1.5 max-w-sm text-xs text-slate-500">
                                Need to offer specialized dry cleaning or specialty garment care
                                not in the catalog? Propose it to platform administrators.
                            </p>
                            <Button
                                type="button"
                                onClick={() => setIsCreateOpen(true)}
                                className="mt-6 rounded-xl bg-[#2563EB] text-white hover:bg-blue-700"
                            >
                                <Plus className="mr-1.5 h-4 w-4" />
                                Request a Service
                            </Button>
                        </>
                    ) : (
                        <>
                            <h2 className="mt-4 text-base font-bold text-slate-900">
                                No requests match your filter
                            </h2>
                            <p className="mt-1 text-xs text-slate-500">
                                Try changing your search query or selecting a different status
                                tab.
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
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {paginatedRequests.map((req) => (
                        <div
                            key={req.id}
                            className="flex flex-col justify-between rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-xs transition hover:shadow-sm space-y-4"
                        >
                            <div className="space-y-3">
                                {/* Top: Image & Status */}
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-center gap-3">
                                        {req.image ? (
                                            <img
                                                src={req.image}
                                                alt={req.service_name}
                                                className="h-12 w-12 rounded-xl object-cover border border-slate-200"
                                            />
                                        ) : (
                                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
                                                <BriefcaseBusiness className="h-6 w-6" />
                                            </div>
                                        )}
                                        <div>
                                            <h3 className="font-bold text-slate-900 text-sm leading-snug">
                                                {req.service_name}
                                            </h3>
                                            <p className="text-[11px] text-slate-400">
                                                Submitted: {formatDate(req.created_at)}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Status Badge */}
                                    {req.status === "pending" && (
                                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800 ring-1 ring-amber-600/20">
                                            <Clock className="h-3 w-3 text-amber-600" />
                                            Pending
                                        </span>
                                    )}
                                    {req.status === "under_review" && (
                                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-800 ring-1 ring-blue-600/20">
                                            <Search className="h-3 w-3 text-blue-600" />
                                            In Review
                                        </span>
                                    )}
                                    {req.status === "approved" && (
                                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 ring-1 ring-emerald-600/20">
                                            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                                            Approved
                                        </span>
                                    )}
                                    {req.status === "rejected" && (
                                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-800 ring-1 ring-red-600/20">
                                            <AlertCircle className="h-3 w-3 text-red-600" />
                                            Rejected
                                        </span>
                                    )}
                                </div>

                                {/* Description */}
                                {req.description ? (
                                    <p className="text-xs text-slate-600 leading-relaxed line-clamp-3">
                                        {req.description}
                                    </p>
                                ) : (
                                    <p className="text-xs italic text-slate-400">
                                        No description provided.
                                    </p>
                                )}
                            </div>

                            {/* Decision & Action Callout */}
                            <div className="border-t border-slate-100 pt-3">
                                {req.status === "approved" && (
                                    <div className="rounded-xl bg-emerald-50/70 p-2.5 text-xs text-emerald-900 space-y-1.5">
                                        <p className="font-semibold text-emerald-800 flex items-center gap-1">
                                            <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
                                            Catalog Ready!
                                        </p>
                                        <p className="text-[11px] leading-tight text-emerald-700">
                                            This service is now added to VeeCleen. Configure your
                                            price and turnaround under Services.
                                        </p>
                                        <Link
                                            to="/shop-admin/services"
                                            className="inline-flex font-semibold text-emerald-800 hover:underline text-[11px]"
                                        >
                                            Configure in Services →
                                        </Link>
                                    </div>
                                )}

                                {req.status === "rejected" && (
                                    <div className="rounded-xl bg-red-50/70 p-2.5 text-xs text-red-900 space-y-1">
                                        <p className="font-semibold text-red-800">
                                            Rejection Reason:
                                        </p>
                                        <p className="text-[11px] leading-tight text-red-700">
                                            {req.rejection_reason ||
                                                "This request does not meet platform catalog criteria."}
                                        </p>
                                    </div>
                                )}

                                {(req.status === "pending" ||
                                    req.status === "under_review") && (
                                    <p className="text-[11px] text-slate-400 flex items-center gap-1">
                                        <Clock className="h-3 w-3" />
                                        Platform team is evaluating this request.
                                    </p>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Pagination Controls */}
                {filteredRequests.length > ITEMS_PER_PAGE && (
                    <div className="flex flex-col items-center justify-between gap-4 rounded-2xl border border-[#E2E8F0] bg-white px-5 py-3.5 shadow-xs sm:flex-row">
                        <p className="text-xs text-slate-500">
                            Showing <span className="font-semibold text-slate-800">{startIndex + 1}</span> to{" "}
                            <span className="font-semibold text-slate-800">
                                {Math.min(startIndex + ITEMS_PER_PAGE, filteredRequests.length)}
                            </span>{" "}
                            of <span className="font-semibold text-slate-800">{filteredRequests.length}</span> requests
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

            {/* Create Service Request Modal */}
            <CreateRequestDialog
                open={isCreateOpen}
                onClose={() => setIsCreateOpen(false)}
                isShopApproved={Boolean(shop?.is_approved)}
                onSuccess={(newReq) => {
                    setFeedback({
                        tone: "success",
                        title: "Service request submitted",
                        description: `Your proposal for "${newReq.service_name}" was sent for platform administrator review.`,
                    });
                }}
            />
        </div>
    );
}

export default ShopServiceRequests;
