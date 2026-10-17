import { useState, useEffect, useMemo, useRef, type FormEvent, type ChangeEvent } from "react";
import { Link } from "react-router-dom";
import { isAxiosError } from "axios";
import {
    AlertCircle,
    AlertTriangle,
    Building2,
    CheckCircle2,
    Clock,
    ImageIcon,
    Loader2,
    Lock,
    Mail,
    MapPin,
    Phone,
    Power,
    RefreshCw,
    RotateCcw,
    Save,
    ShieldAlert,
    ShieldCheck,
    Sparkles,
    Store,
    Upload,
    User,
    X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    useShopAdminProfile,
    useShopDetails,
    useUpdateOperationalStatus,
    useUpdateShopAdminProfile,
    useUpdateShopDetails,
} from "../../hooks/shopAdmin/useShopAdminProfile";
import {
    KERALA_DISTRICTS,
    type KeralaDistrict,
    type ShopAdminProfile,
    type ShopDetails,
} from "../../types/shopAdmin/profile";

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const ACCEPTED_IMAGE_TYPES = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
];

const shopFields = [
    "description",
    "contact_number",
    "address_line",
    "city",
    "district",
    "state",
    "pincode",
    "opening_time",
    "closing_time",
    "image",
] as const;

type ShopField = (typeof shopFields)[number];

const accountFields = [
    "first_name",
    "last_name",
    "email",
    "phone_number",
] as const;

type AccountField = (typeof accountFields)[number];

interface ShopFormState {
    description: string;
    contact_number: string;
    address_line: string;
    city: string;
    district: string;
    pincode: string;
    opening_time: string;
    closing_time: string;
}

interface AccountFormState {
    first_name: string;
    last_name: string;
    email: string;
    phone_number: string;
}

interface FeedbackState {
    tone: "success" | "error";
    title: string;
    description: string;
}

const formatTimeForInput = (timeStr?: string | null): string => {
    if (!timeStr) return "";
    return timeStr.slice(0, 5); // "09:00:00" -> "09:00"
};

const getMessages = (value: unknown): string[] => {
    if (typeof value === "string" && value.trim()) {
        return [value];
    }
    if (Array.isArray(value)) {
        return value.filter(
            (item): item is string =>
                typeof item === "string" && Boolean(item.trim())
        );
    }
    return [];
};

const extractFieldErrors = <T extends string>(
    error: unknown,
    fields: readonly T[]
): Partial<Record<T, string>> => {
    if (!isAxiosError(error) || !error.response?.data) {
        return {};
    }
    const responseData: unknown = error.response.data;
    if (!responseData || typeof responseData !== "object") {
        return {};
    }
    const data = responseData as Record<string, unknown>;
    const result: Partial<Record<T, string>> = {};
    for (const field of fields) {
        const msg = getMessages(data[field])[0];
        if (msg) {
            result[field] = msg;
        }
    }
    return result;
};

const extractGeneralErrorMessage = (
    error: unknown,
    fallback: string
): string => {
    if (!isAxiosError(error)) {
        return fallback;
    }
    const data: unknown = error.response?.data;
    if (typeof data === "string" && data.trim()) {
        return data;
    }
    if (!data || typeof data !== "object") {
        return fallback;
    }
    const rec = data as Record<string, unknown>;
    if (typeof rec.detail === "string" && rec.detail.trim()) {
        return rec.detail;
    }
    for (const val of Object.values(rec)) {
        const msg = getMessages(val)[0];
        if (msg) return msg;
    }
    return fallback;
};

function FeedbackAlert({
    feedback,
    onDismiss,
}: {
    feedback: FeedbackState;
    onDismiss?: () => void;
}) {
    const isSuccess = feedback.tone === "success";
    const Icon = isSuccess ? CheckCircle2 : AlertCircle;

    return (
        <div
            role={isSuccess ? "status" : "alert"}
            className={`flex items-start justify-between gap-3 rounded-2xl border p-4 text-sm transition-all ${
                isSuccess
                    ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                    : "border-red-200 bg-red-50 text-red-900"
            }`}
        >
            <div className="flex items-start gap-3">
                <Icon
                    className={`mt-0.5 h-5 w-5 shrink-0 ${
                        isSuccess ? "text-emerald-600" : "text-red-600"
                    }`}
                    aria-hidden="true"
                />
                <div>
                    <h3 className="font-semibold">{feedback.title}</h3>
                    <p className="mt-0.5 leading-relaxed text-xs sm:text-sm">
                        {feedback.description}
                    </p>
                </div>
            </div>
            {onDismiss && (
                <button
                    type="button"
                    onClick={onDismiss}
                    className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-black/5 hover:text-slate-700"
                    aria-label="Dismiss feedback alert"
                >
                    <X className="h-4 w-4" />
                </button>
            )}
        </div>
    );
}

function FieldErrorText({ id, message }: { id?: string; message?: string }) {
    if (!message) return null;
    return (
        <p id={id} className="mt-1.5 text-xs font-medium text-red-600" role="alert">
            {message}
        </p>
    );
}

function LoadingSkeleton() {
    return (
        <div className="space-y-6 animate-pulse" aria-label="Loading shop profile details">
            {/* Header skeleton */}
            <div className="h-32 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs" />
            <div className="grid gap-6 lg:grid-cols-12">
                <div className="space-y-6 lg:col-span-8">
                    <div className="h-96 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs" />
                    <div className="h-64 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs" />
                </div>
                <div className="space-y-6 lg:col-span-4">
                    <div className="h-48 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs" />
                    <div className="h-72 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs" />
                    <div className="h-64 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs" />
                </div>
            </div>
        </div>
    );
}

interface ShopProfileFormProps {
    shop: ShopDetails;
    profile: ShopAdminProfile | undefined;
}

function ShopProfileForm({ shop, profile }: ShopProfileFormProps) {
    const updateShopMutation = useUpdateShopDetails();
    const updateStatusMutation = useUpdateOperationalStatus();
    const updateAccountMutation = useUpdateShopAdminProfile();

    // Shop Form State initialized directly from shop prop
    const [shopForm, setShopForm] = useState<ShopFormState>(() => ({
        description: shop.description || "",
        contact_number: shop.contact_number || "",
        address_line: shop.address_line || "",
        city: shop.city || "",
        district: shop.district || "Ernakulam",
        pincode: shop.pincode || "",
        opening_time: formatTimeForInput(shop.opening_time),
        closing_time: formatTimeForInput(shop.closing_time),
    }));

    const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
    const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
    const [shopFieldErrors, setShopFieldErrors] = useState<
        Partial<Record<ShopField, string>>
    >({});
    const [shopFeedback, setShopFeedback] = useState<FeedbackState | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Account Form State initialized directly from profile prop
    const [accountForm, setAccountForm] = useState<AccountFormState>(() => ({
        first_name: profile?.first_name || "",
        last_name: profile?.last_name || "",
        email: profile?.email || "",
        phone_number: profile?.phone_number || "",
    }));
    const [accountFieldErrors, setAccountFieldErrors] = useState<
        Partial<Record<AccountField, string>>
    >({});
    const [accountFeedback, setAccountFeedback] = useState<FeedbackState | null>(
        null
    );

    // Operational Status feedback
    const [statusError, setStatusError] = useState<string | null>(null);

    // Clean up blob preview on unmount or when imagePreviewUrl changes
    useEffect(() => {
        return () => {
            if (imagePreviewUrl && imagePreviewUrl.startsWith("blob:")) {
                URL.revokeObjectURL(imagePreviewUrl);
            }
        };
    }, [imagePreviewUrl]);

    // Compute if shop form is dirty
    const isShopDirty = useMemo(() => {
        if (selectedImageFile !== null) return true;

        const initialOpening = formatTimeForInput(shop.opening_time);
        const initialClosing = formatTimeForInput(shop.closing_time);

        return (
            shopForm.description !== (shop.description || "") ||
            shopForm.contact_number !== (shop.contact_number || "") ||
            shopForm.address_line !== (shop.address_line || "") ||
            shopForm.city !== (shop.city || "") ||
            shopForm.district !== (shop.district || "Ernakulam") ||
            shopForm.pincode !== (shop.pincode || "") ||
            shopForm.opening_time !== initialOpening ||
            shopForm.closing_time !== initialClosing
        );
    }, [shop, shopForm, selectedImageFile]);

    // Compute if account form is dirty
    const isAccountDirty = useMemo(() => {
        if (!profile) return false;
        return (
            accountForm.first_name !== (profile.first_name || "") ||
            accountForm.last_name !== (profile.last_name || "") ||
            accountForm.email !== (profile.email || "") ||
            accountForm.phone_number !== (profile.phone_number || "")
        );
    }, [profile, accountForm]);

    // Image file selection handler with validation
    const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate type
        if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
            setShopFieldErrors((prev) => ({
                ...prev,
                image: "Please choose a valid image format (JPEG, PNG, WEBP, or GIF).",
            }));
            e.target.value = "";
            return;
        }

        // Validate size
        if (file.size > MAX_IMAGE_SIZE_BYTES) {
            setShopFieldErrors((prev) => ({
                ...prev,
                image: "Image file size must be less than 5 MB.",
            }));
            e.target.value = "";
            return;
        }

        // Clear previous error
        setShopFieldErrors((prev) => {
            const next = { ...prev };
            delete next.image;
            return next;
        });

        // Revoke previous blob if any
        if (imagePreviewUrl && imagePreviewUrl.startsWith("blob:")) {
            URL.revokeObjectURL(imagePreviewUrl);
        }

        const newPreview = URL.createObjectURL(file);
        setSelectedImageFile(file);
        setImagePreviewUrl(newPreview);
    };

    // Revert pending image
    const handleRevertImage = () => {
        if (imagePreviewUrl && imagePreviewUrl.startsWith("blob:")) {
            URL.revokeObjectURL(imagePreviewUrl);
        }
        setSelectedImageFile(null);
        setImagePreviewUrl(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
        setShopFieldErrors((prev) => {
            const next = { ...prev };
            delete next.image;
            return next;
        });
    };

    // Reset shop form
    const handleResetShopForm = () => {
        setShopForm({
            description: shop.description || "",
            contact_number: shop.contact_number || "",
            address_line: shop.address_line || "",
            city: shop.city || "",
            district: shop.district || "Ernakulam",
            pincode: shop.pincode || "",
            opening_time: formatTimeForInput(shop.opening_time),
            closing_time: formatTimeForInput(shop.closing_time),
        });
        handleRevertImage();
        setShopFieldErrors({});
        setShopFeedback(null);
    };

    // Reset account form
    const handleResetAccountForm = () => {
        if (!profile) return;
        setAccountForm({
            first_name: profile.first_name || "",
            last_name: profile.last_name || "",
            email: profile.email || "",
            phone_number: profile.phone_number || "",
        });
        setAccountFieldErrors({});
        setAccountFeedback(null);
    };

    // Submit Shop Details Form
    const handleShopSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setShopFeedback(null);

        // Client validations
        const errors: Partial<Record<ShopField, string>> = {};

        if (!shopForm.contact_number.trim()) {
            errors.contact_number = "Contact number cannot be empty.";
        }

        if (shopForm.opening_time && shopForm.closing_time) {
            if (shopForm.opening_time >= shopForm.closing_time) {
                errors.closing_time = "Closing time must be after opening time.";
            }
        }

        if (Object.keys(errors).length > 0) {
            setShopFieldErrors(errors);
            setShopFeedback({
                tone: "error",
                title: "Validation error",
                description: "Please resolve the indicated field errors before saving.",
            });
            return;
        }

        // Construct FormData for multipart API submission
        const formData = new FormData();
        formData.append("description", shopForm.description.trim());
        formData.append("contact_number", shopForm.contact_number.trim());
        formData.append("address_line", shopForm.address_line.trim());
        formData.append("city", shopForm.city.trim());
        formData.append("district", shopForm.district);
        formData.append("state", "Kerala");
        formData.append("pincode", shopForm.pincode.trim());

        if (shopForm.opening_time) {
            formData.append("opening_time", shopForm.opening_time);
        }
        if (shopForm.closing_time) {
            formData.append("closing_time", shopForm.closing_time);
        }
        if (selectedImageFile) {
            formData.append("image", selectedImageFile);
        }

        updateShopMutation.mutate(formData, {
            onSuccess: (updated) => {
                setShopFieldErrors({});
                if (imagePreviewUrl && imagePreviewUrl.startsWith("blob:")) {
                    URL.revokeObjectURL(imagePreviewUrl);
                }
                setSelectedImageFile(null);
                setImagePreviewUrl(null);
                setShopForm({
                    description: updated.description || "",
                    contact_number: updated.contact_number || "",
                    address_line: updated.address_line || "",
                    city: updated.city || "",
                    district: updated.district || "Ernakulam",
                    pincode: updated.pincode || "",
                    opening_time: formatTimeForInput(updated.opening_time),
                    closing_time: formatTimeForInput(updated.closing_time),
                });
                setShopFeedback({
                    tone: "success",
                    title: "Shop profile saved",
                    description: "Your shop profile information has been updated successfully.",
                });
            },
            onError: (err) => {
                const apiFieldErrors = extractFieldErrors(err, shopFields);
                setShopFieldErrors(apiFieldErrors);
                setShopFeedback({
                    tone: "error",
                    title: "Could not save shop details",
                    description: extractGeneralErrorMessage(
                        err,
                        "An unexpected error occurred while saving shop details."
                    ),
                });
            },
        });
    };

    // Submit Account Details Form
    const handleAccountSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setAccountFeedback(null);
        setAccountFieldErrors({});

        updateAccountMutation.mutate(
            {
                first_name: accountForm.first_name.trim(),
                last_name: accountForm.last_name.trim(),
                email: accountForm.email.trim() || null,
                phone_number: accountForm.phone_number.trim() || null,
            },
            {
                onSuccess: (updated) => {
                    setAccountForm({
                        first_name: updated.first_name || "",
                        last_name: updated.last_name || "",
                        email: updated.email || "",
                        phone_number: updated.phone_number || "",
                    });
                    setAccountFeedback({
                        tone: "success",
                        title: "Account details saved",
                        description: "Your personal account information has been updated.",
                    });
                },
                onError: (err) => {
                    const apiFieldErrors = extractFieldErrors(err, accountFields);
                    setAccountFieldErrors(apiFieldErrors);
                    setAccountFeedback({
                        tone: "error",
                        title: "Could not save account details",
                        description: extractGeneralErrorMessage(
                            err,
                            "An unexpected error occurred while saving account details."
                        ),
                    });
                },
            }
        );
    };

    // Toggle Operational Status
    const handleToggleOperationalStatus = () => {
        setStatusError(null);
        const nextStatus = !shop.is_open;

        // Perform request directly to API (server validates approval & active services)
        updateStatusMutation.mutate(nextStatus, {
            onSuccess: () => {
                setStatusError(null);
            },
            onError: (err) => {
                const message = extractGeneralErrorMessage(
                    err,
                    "Failed to update operational status. Please try again."
                );
                setStatusError(message);
            },
        });
    };

    const currentImageSrc = imagePreviewUrl || shop.image;
    const canOpen = shop.is_approved && shop.active_services_count > 0;

    return (
        <div className="space-y-8 pb-12">
            {/* 1. Header Overview & Approval Status Banner */}
            <header className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-xs sm:p-8">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-start gap-4">
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#172554] text-white shadow-xs">
                            <Store className="h-7 w-7" />
                        </div>
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2.5">
                                <h1 className="truncate text-xl font-bold text-slate-900 sm:text-2xl">
                                    {shop.shop_name}
                                </h1>
                                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
                                    ID #{shop.id}
                                </span>
                            </div>

                            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 sm:text-sm">
                                <span>
                                    Admin:{" "}
                                    <strong className="font-semibold text-slate-700">
                                        @{shop.shop_admin_username}
                                    </strong>
                                </span>
                                {shop.shop_admin_email && (
                                    <>
                                        <span className="hidden sm:inline">•</span>
                                        <span>{shop.shop_admin_email}</span>
                                    </>
                                )}
                            </p>
                        </div>
                    </div>

                    {/* Status Pill Badges */}
                    <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
                        {/* Approval status */}
                        {shop.is_approved ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-600/20">
                                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                                <span>Approved Shop</span>
                            </span>
                        ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 ring-1 ring-amber-600/25">
                                <ShieldAlert className="h-4 w-4 text-amber-600" />
                                <span>Pending Approval</span>
                            </span>
                        )}

                        {/* Active Services Count */}
                        <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ${
                                shop.active_services_count > 0
                                    ? "bg-blue-50 text-blue-800 ring-blue-600/20"
                                    : "bg-slate-100 text-slate-700 ring-slate-400/25"
                            }`}
                        >
                            <Sparkles className="h-3.5 w-3.5 text-blue-600" />
                            <span>
                                {shop.active_services_count}{" "}
                                {shop.active_services_count === 1
                                    ? "Active Service"
                                    : "Active Services"}
                            </span>
                        </span>

                        {/* Operational status badge */}
                        <span
                            className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ${
                                shop.is_open
                                    ? "bg-emerald-500/10 text-emerald-700 ring-emerald-500/30"
                                    : "bg-slate-100 text-slate-600 ring-slate-300"
                            }`}
                        >
                            <span
                                className={`h-2.5 w-2.5 rounded-full ${
                                    shop.is_open
                                        ? "bg-emerald-500 animate-pulse"
                                        : "bg-slate-400"
                                }`}
                                aria-hidden="true"
                            />
                            <span>{shop.is_open ? "Open for Business" : "Closed"}</span>
                        </span>
                    </div>
                </div>
            </header>

            {/* Layout: Main 2-Column Grid on Desktop */}
            <div className="grid gap-8 lg:grid-cols-12">
                {/* LEFT COLUMN: Main Shop Details Form (8 Cols) */}
                <div className="space-y-8 lg:col-span-8">
                    {/* Unsaved Changes Banner */}
                    {isShopDirty && (
                        <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-xs sm:text-sm text-amber-900 shadow-xs">
                            <div className="flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                                <span className="font-medium">
                                    You have unsaved shop profile changes.
                                </span>
                            </div>
                            <Button
                                type="button"
                                variant="ghost"
                                size="xs"
                                onClick={handleResetShopForm}
                                className="text-amber-800 hover:bg-amber-100"
                            >
                                Discard
                            </Button>
                        </div>
                    )}

                    {/* Shop Feedback Alert */}
                    {shopFeedback && (
                        <FeedbackAlert
                            feedback={shopFeedback}
                            onDismiss={() => setShopFeedback(null)}
                        />
                    )}

                    <form
                        onSubmit={handleShopSubmit}
                        noValidate
                        className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-xs sm:p-8 space-y-8"
                    >
                        {/* Section: Basic Identity */}
                        <div>
                            <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
                                <Building2 className="h-5 w-5 text-[#2563EB]" />
                                <h2 className="text-base font-bold text-slate-900">
                                    Shop Overview & Contact
                                </h2>
                            </div>

                            <div className="mt-5 grid gap-5 sm:grid-cols-2">
                                {/* Protected Shop Name */}
                                <div className="sm:col-span-2">
                                    <label
                                        htmlFor="shop-name-input"
                                        className="flex items-center justify-between text-xs font-semibold text-slate-700"
                                    >
                                        <span>Shop Name (Protected)</span>
                                        <span className="flex items-center gap-1 text-[11px] font-normal text-slate-400">
                                            <Lock className="h-3 w-3" /> Read-only
                                        </span>
                                    </label>
                                    <div className="relative mt-1.5">
                                        <Input
                                            id="shop-name-input"
                                            value={shop.shop_name}
                                            readOnly
                                            disabled
                                            className="bg-slate-50 text-slate-600 cursor-not-allowed border-slate-200"
                                        />
                                    </div>
                                    <p className="mt-1 text-[11px] text-slate-400">
                                        Shop name is verified by platform administrators and cannot be modified directly.
                                    </p>
                                </div>

                                {/* Contact Number */}
                                <div>
                                    <label
                                        htmlFor="shop-contact-input"
                                        className="block text-xs font-semibold text-slate-700"
                                    >
                                        Contact Phone <span className="text-red-500">*</span>
                                    </label>
                                    <div className="relative mt-1.5">
                                        <Input
                                            id="shop-contact-input"
                                            type="tel"
                                            value={shopForm.contact_number}
                                            onChange={(e) =>
                                                setShopForm((prev) => ({
                                                    ...prev,
                                                    contact_number: e.target.value,
                                                }))
                                            }
                                            maxLength={15}
                                            required
                                            aria-invalid={Boolean(shopFieldErrors.contact_number)}
                                            aria-describedby={
                                                shopFieldErrors.contact_number
                                                    ? "shop-contact-error"
                                                    : undefined
                                            }
                                            placeholder="e.g. 9876543210"
                                            className="pl-9"
                                        />
                                        <Phone className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
                                    </div>
                                    <FieldErrorText
                                        id="shop-contact-error"
                                        message={shopFieldErrors.contact_number}
                                    />
                                </div>

                                {/* Description */}
                                <div className="sm:col-span-2">
                                    <label
                                        htmlFor="shop-description-input"
                                        className="block text-xs font-semibold text-slate-700"
                                    >
                                        Shop Description
                                    </label>
                                    <textarea
                                        id="shop-description-input"
                                        rows={3}
                                        value={shopForm.description}
                                        onChange={(e) =>
                                            setShopForm((prev) => ({
                                                ...prev,
                                                description: e.target.value,
                                            }))
                                        }
                                        placeholder="Briefly describe your dry cleaning & laundry expertise, specialties, or turn-around guarantees..."
                                        className="mt-1.5 w-full rounded-xl border border-input bg-input/30 p-3 text-sm text-slate-900 transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 outline-none"
                                    />
                                    <FieldErrorText message={shopFieldErrors.description} />
                                </div>
                            </div>
                        </div>

                        {/* Section: Operating Hours */}
                        <div>
                            <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
                                <Clock className="h-5 w-5 text-[#2563EB]" />
                                <h2 className="text-base font-bold text-slate-900">
                                    Operating Hours
                                </h2>
                            </div>

                            <p className="mt-2 text-xs text-slate-500">
                                Set your daily customer order hours. Closing time must be strictly after opening time.
                            </p>

                            <div className="mt-4 grid gap-5 sm:grid-cols-2">
                                <div>
                                    <label
                                        htmlFor="shop-opening-time"
                                        className="block text-xs font-semibold text-slate-700"
                                    >
                                        Opening Time
                                    </label>
                                    <div className="relative mt-1.5">
                                        <Input
                                            id="shop-opening-time"
                                            type="time"
                                            step="60"
                                            value={shopForm.opening_time}
                                            onChange={(e) =>
                                                setShopForm((prev) => ({
                                                    ...prev,
                                                    opening_time: e.target.value,
                                                }))
                                            }
                                            aria-invalid={Boolean(shopFieldErrors.opening_time)}
                                            aria-describedby={
                                                shopFieldErrors.opening_time
                                                    ? "shop-opening-error"
                                                    : undefined
                                            }
                                            className="pl-9"
                                        />
                                        <Clock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
                                    </div>
                                    <FieldErrorText
                                        id="shop-opening-error"
                                        message={shopFieldErrors.opening_time}
                                    />
                                </div>

                                <div>
                                    <label
                                        htmlFor="shop-closing-time"
                                        className="block text-xs font-semibold text-slate-700"
                                    >
                                        Closing Time
                                    </label>
                                    <div className="relative mt-1.5">
                                        <Input
                                            id="shop-closing-time"
                                            type="time"
                                            step="60"
                                            value={shopForm.closing_time}
                                            onChange={(e) =>
                                                setShopForm((prev) => ({
                                                    ...prev,
                                                    closing_time: e.target.value,
                                                }))
                                            }
                                            aria-invalid={Boolean(shopFieldErrors.closing_time)}
                                            aria-describedby={
                                                shopFieldErrors.closing_time
                                                    ? "shop-closing-error"
                                                    : undefined
                                            }
                                            className="pl-9"
                                        />
                                        <Clock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
                                    </div>
                                    <FieldErrorText
                                        id="shop-closing-error"
                                        message={shopFieldErrors.closing_time}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Section: Location & Address */}
                        <div>
                            <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
                                <MapPin className="h-5 w-5 text-[#2563EB]" />
                                <h2 className="text-base font-bold text-slate-900">
                                    Location & Address
                                </h2>
                            </div>

                            <div className="mt-5 grid gap-5 sm:grid-cols-2">
                                <div className="sm:col-span-2">
                                    <label
                                        htmlFor="shop-address-line"
                                        className="block text-xs font-semibold text-slate-700"
                                    >
                                        Address Line
                                    </label>
                                    <Input
                                        id="shop-address-line"
                                        type="text"
                                        value={shopForm.address_line}
                                        onChange={(e) =>
                                            setShopForm((prev) => ({
                                                ...prev,
                                                address_line: e.target.value,
                                            }))
                                        }
                                        placeholder="Door number, street name, building"
                                        className="mt-1.5"
                                    />
                                    <FieldErrorText message={shopFieldErrors.address_line} />
                                </div>

                                <div>
                                    <label
                                        htmlFor="shop-city"
                                        className="block text-xs font-semibold text-slate-700"
                                    >
                                        City / Town
                                    </label>
                                    <Input
                                        id="shop-city"
                                        type="text"
                                        value={shopForm.city}
                                        onChange={(e) =>
                                            setShopForm((prev) => ({
                                                ...prev,
                                                city: e.target.value,
                                            }))
                                        }
                                        placeholder="e.g. Kochi"
                                        className="mt-1.5"
                                    />
                                    <FieldErrorText message={shopFieldErrors.city} />
                                </div>

                                <div>
                                    <label
                                        htmlFor="shop-district"
                                        className="block text-xs font-semibold text-slate-700"
                                    >
                                        District (Kerala)
                                    </label>
                                    <select
                                        id="shop-district"
                                        value={shopForm.district}
                                        onChange={(e) =>
                                            setShopForm((prev) => ({
                                                ...prev,
                                                district: e.target.value as KeralaDistrict,
                                            }))
                                        }
                                        className="mt-1.5 h-9 w-full rounded-4xl border border-input bg-input/30 px-3 py-1 text-sm text-slate-900 transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 outline-none"
                                    >
                                        {KERALA_DISTRICTS.map((d) => (
                                            <option key={d} value={d}>
                                                {d}
                                            </option>
                                        ))}
                                    </select>
                                    <FieldErrorText message={shopFieldErrors.district} />
                                </div>

                                <div>
                                    <label
                                        htmlFor="shop-state"
                                        className="block text-xs font-semibold text-slate-700"
                                    >
                                        State
                                    </label>
                                    <Input
                                        id="shop-state"
                                        type="text"
                                        value="Kerala"
                                        readOnly
                                        disabled
                                        className="mt-1.5 bg-slate-50 text-slate-600 cursor-not-allowed border-slate-200"
                                    />
                                </div>

                                <div>
                                    <label
                                        htmlFor="shop-pincode"
                                        className="block text-xs font-semibold text-slate-700"
                                    >
                                        PIN Code
                                    </label>
                                    <Input
                                        id="shop-pincode"
                                        type="text"
                                        value={shopForm.pincode}
                                        onChange={(e) =>
                                            setShopForm((prev) => ({
                                                ...prev,
                                                pincode: e.target.value,
                                            }))
                                        }
                                        maxLength={10}
                                        placeholder="e.g. 682001"
                                        className="mt-1.5"
                                    />
                                    <FieldErrorText message={shopFieldErrors.pincode} />
                                </div>
                            </div>
                        </div>

                        {/* Save & Reset Actions */}
                        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 pt-5">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleResetShopForm}
                                disabled={!isShopDirty || updateShopMutation.isPending}
                                className="rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50"
                            >
                                <RotateCcw className="mr-2 h-4 w-4" />
                                Cancel & Reset
                            </Button>

                            <Button
                                type="submit"
                                disabled={!isShopDirty || updateShopMutation.isPending}
                                className="rounded-xl bg-[#2563EB] px-5 text-white hover:bg-blue-700 shadow-xs"
                            >
                                {updateShopMutation.isPending ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Saving Changes...
                                    </>
                                ) : (
                                    <>
                                        <Save className="mr-2 h-4 w-4" />
                                        Save Shop Details
                                    </>
                                )}
                            </Button>
                        </div>
                    </form>
                </div>

                {/* RIGHT COLUMN: Operational Status, Shop Image, Account Info (4 Cols) */}
                <div className="space-y-8 lg:col-span-4">
                    {/* 2. Operational Status Card */}
                    <section
                        aria-labelledby="operational-status-heading"
                        className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-xs"
                    >
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <div className="flex items-center gap-2">
                                <Power
                                    className={`h-5 w-5 ${
                                        shop.is_open ? "text-emerald-600" : "text-slate-400"
                                    }`}
                                />
                                <h2
                                    id="operational-status-heading"
                                    className="text-base font-bold text-slate-900"
                                >
                                    Operational Status
                                </h2>
                            </div>

                            <span
                                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${
                                    shop.is_open
                                        ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20"
                                        : "bg-slate-100 text-slate-700 ring-1 ring-slate-400/20"
                                }`}
                            >
                                <span
                                    className={`h-2 w-2 rounded-full ${
                                        shop.is_open
                                            ? "bg-emerald-500 animate-pulse"
                                            : "bg-slate-400"
                                    }`}
                                />
                                {shop.is_open ? "Open" : "Closed"}
                            </span>
                        </div>

                        <p className="mt-3 text-xs leading-relaxed text-slate-500">
                            When open, your shop accepts customer dry cleaning and laundry orders online during operating hours.
                        </p>

                        {/* Error Callout */}
                        {statusError && (
                            <div
                                role="alert"
                                className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-900"
                            >
                                <div className="flex items-start gap-2">
                                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                                    <div className="flex-1">
                                        <p className="font-semibold">Unable to change status</p>
                                        <p className="mt-0.5 leading-normal">{statusError}</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setStatusError(null)}
                                        className="text-red-400 hover:text-red-700"
                                        aria-label="Dismiss error"
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Precondition Explanations if closed and cannot open */}
                        {!shop.is_open && (
                            <div className="mt-4 space-y-2 text-xs">
                                {!shop.is_approved && (
                                    <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-900">
                                        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                                        <p>
                                            <strong>Pending Approval:</strong> An unapproved shop cannot be opened until platform administrators verify it.
                                        </p>
                                    </div>
                                )}

                                {shop.active_services_count === 0 && (
                                    <div className="flex items-start gap-2 rounded-xl border border-blue-100 bg-blue-50/70 p-3 text-blue-900">
                                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                                        <div>
                                            <p>
                                                <strong>No Active Services:</strong> Your shop must configure at least one active service before it can be opened.
                                            </p>
                                            <Link
                                                to="/shop-admin/services"
                                                className="mt-1 inline-flex font-semibold text-blue-700 hover:underline"
                                            >
                                                Configure services →
                                            </Link>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Open/Close Toggle Control */}
                        <div className="mt-5">
                            <Button
                                type="button"
                                onClick={handleToggleOperationalStatus}
                                disabled={updateStatusMutation.isPending}
                                className={`w-full rounded-xl font-semibold transition shadow-xs ${
                                    shop.is_open
                                        ? "bg-slate-100 text-slate-800 hover:bg-slate-200 border border-slate-300"
                                        : canOpen
                                        ? "bg-emerald-600 text-white hover:bg-emerald-700"
                                        : "bg-slate-200 text-slate-500 hover:bg-slate-300"
                                }`}
                                aria-label={shop.is_open ? "Close shop" : "Open shop"}
                            >
                                {updateStatusMutation.isPending ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Updating Status...
                                    </>
                                ) : shop.is_open ? (
                                    <>
                                        <Power className="mr-2 h-4 w-4 text-red-500" />
                                        Close Shop
                                    </>
                                ) : (
                                    <>
                                        <Power className="mr-2 h-4 w-4 text-emerald-500" />
                                        Open Shop
                                    </>
                                )}
                            </Button>
                        </div>
                    </section>

                    {/* 3. Shop Image Preview & Upload Card */}
                    <section
                        aria-labelledby="shop-image-heading"
                        className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-xs"
                    >
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <div className="flex items-center gap-2">
                                <ImageIcon className="h-5 w-5 text-[#2563EB]" />
                                <h2 id="shop-image-heading" className="text-base font-bold text-slate-900">
                                    Shop Storefront Image
                                </h2>
                            </div>
                            {selectedImageFile && (
                                <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700 ring-1 ring-amber-600/20">
                                    Unsaved
                                </span>
                            )}
                        </div>

                        {/* Image Preview Window */}
                        <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                            {currentImageSrc ? (
                                <div className="relative group">
                                    <img
                                        src={currentImageSrc}
                                        alt={shop.shop_name}
                                        className="h-48 w-full object-cover transition duration-200 group-hover:scale-102"
                                    />
                                    {selectedImageFile && (
                                        <button
                                            type="button"
                                            onClick={handleRevertImage}
                                            className="absolute right-2 top-2 rounded-full bg-black/70 p-1.5 text-white hover:bg-black transition"
                                            title="Cancel selected image"
                                            aria-label="Cancel selected image"
                                        >
                                            <X className="h-4 w-4" />
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <div className="flex h-48 flex-col items-center justify-center p-4 text-center text-slate-400">
                                    <Store className="h-10 w-10 text-slate-300" />
                                    <p className="mt-2 text-xs font-medium text-slate-500">
                                        No storefront photo uploaded yet
                                    </p>
                                    <p className="mt-0.5 text-[11px] text-slate-400">
                                        Upload a clean, bright photo of your facility or logo
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Image details & file picker */}
                        <div className="mt-4 space-y-2">
                            {selectedImageFile ? (
                                <div className="flex items-center justify-between rounded-xl bg-slate-50 p-2.5 text-xs text-slate-600">
                                    <span className="truncate max-w-44 font-medium">
                                        {selectedImageFile.name}
                                    </span>
                                    <span className="text-slate-400">
                                        {(selectedImageFile.size / 1024).toFixed(0)} KB
                                    </span>
                                </div>
                            ) : null}

                            <FieldErrorText
                                id="shop-image-error"
                                message={shopFieldErrors.image}
                            />

                            <input
                                ref={fileInputRef}
                                id="shop-image-upload-input"
                                type="file"
                                accept="image/jpeg,image/png,image/webp,image/gif"
                                onChange={handleImageChange}
                                className="hidden"
                            />

                            <div className="flex items-center gap-2 pt-1">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-full rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50 text-xs"
                                >
                                    <Upload className="mr-2 h-3.5 w-3.5" />
                                    {currentImageSrc ? "Replace Storefront Photo" : "Upload Storefront Photo"}
                                </Button>

                                {selectedImageFile && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={handleRevertImage}
                                        className="shrink-0 text-slate-500 hover:text-red-600"
                                        title="Discard new image selection"
                                        aria-label="Discard new image selection"
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                )}
                            </div>

                            <p className="text-[11px] text-slate-400 text-center">
                                JPEG, PNG, WEBP, or GIF up to 5 MB
                            </p>
                        </div>
                    </section>

                    {/* 4. Personal Account Information Card */}
                    <section
                        aria-labelledby="account-details-heading"
                        className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-xs"
                    >
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <div className="flex items-center gap-2">
                                <User className="h-5 w-5 text-[#2563EB]" />
                                <h2
                                    id="account-details-heading"
                                    className="text-base font-bold text-slate-900"
                                >
                                    Shop Admin Account
                                </h2>
                            </div>
                            {isAccountDirty && (
                                <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700 ring-1 ring-amber-600/20">
                                    Unsaved
                                </span>
                            )}
                        </div>

                        <p className="mt-2 text-xs text-slate-500">
                            Your personal login credentials and notification contact.
                        </p>

                        {accountFeedback && (
                            <div className="mt-3">
                                <FeedbackAlert
                                    feedback={accountFeedback}
                                    onDismiss={() => setAccountFeedback(null)}
                                />
                            </div>
                        )}

                        <form
                            onSubmit={handleAccountSubmit}
                            noValidate
                            className="mt-4 space-y-4"
                        >
                            {/* Read-only Username */}
                            <div>
                                <label
                                    htmlFor="account-username"
                                    className="flex items-center justify-between text-xs font-semibold text-slate-700"
                                >
                                    <span>Username</span>
                                    <span className="flex items-center gap-1 text-[11px] font-normal text-slate-400">
                                        <Lock className="h-3 w-3" /> Read-only
                                    </span>
                                </label>
                                <Input
                                    id="account-username"
                                    value={profile?.username || ""}
                                    readOnly
                                    disabled
                                    className="mt-1 bg-slate-50 text-slate-600 cursor-not-allowed border-slate-200"
                                />
                            </div>

                            {/* First & Last Name */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label
                                        htmlFor="account-first-name"
                                        className="block text-xs font-semibold text-slate-700"
                                    >
                                        First Name
                                    </label>
                                    <Input
                                        id="account-first-name"
                                        type="text"
                                        value={accountForm.first_name}
                                        onChange={(e) =>
                                            setAccountForm((prev) => ({
                                                ...prev,
                                                first_name: e.target.value,
                                            }))
                                        }
                                        className="mt-1"
                                    />
                                    <FieldErrorText message={accountFieldErrors.first_name} />
                                </div>

                                <div>
                                    <label
                                        htmlFor="account-last-name"
                                        className="block text-xs font-semibold text-slate-700"
                                    >
                                        Last Name
                                    </label>
                                    <Input
                                        id="account-last-name"
                                        type="text"
                                        value={accountForm.last_name}
                                        onChange={(e) =>
                                            setAccountForm((prev) => ({
                                                ...prev,
                                                last_name: e.target.value,
                                            }))
                                        }
                                        className="mt-1"
                                    />
                                    <FieldErrorText message={accountFieldErrors.last_name} />
                                </div>
                            </div>

                            {/* Email */}
                            <div>
                                <label
                                    htmlFor="account-email"
                                    className="block text-xs font-semibold text-slate-700"
                                >
                                    Email Address
                                </label>
                                <div className="relative mt-1">
                                    <Input
                                        id="account-email"
                                        type="email"
                                        value={accountForm.email}
                                        onChange={(e) =>
                                            setAccountForm((prev) => ({
                                                ...prev,
                                                email: e.target.value,
                                            }))
                                        }
                                        className="pl-9"
                                    />
                                    <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
                                </div>
                                <FieldErrorText message={accountFieldErrors.email} />
                            </div>

                            {/* Phone */}
                            <div>
                                <label
                                    htmlFor="account-phone"
                                    className="block text-xs font-semibold text-slate-700"
                                >
                                    Personal Phone
                                </label>
                                <div className="relative mt-1">
                                    <Input
                                        id="account-phone"
                                        type="tel"
                                        value={accountForm.phone_number}
                                        onChange={(e) =>
                                            setAccountForm((prev) => ({
                                                ...prev,
                                                phone_number: e.target.value,
                                            }))
                                        }
                                        maxLength={15}
                                        className="pl-9"
                                    />
                                    <Phone className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
                                </div>
                                <FieldErrorText message={accountFieldErrors.phone_number} />
                            </div>

                            {/* Account Form Buttons */}
                            <div className="flex items-center justify-end gap-2 pt-2">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleResetAccountForm}
                                    disabled={!isAccountDirty || updateAccountMutation.isPending}
                                    className="text-xs text-slate-600 hover:bg-slate-100"
                                >
                                    Discard
                                </Button>

                                <Button
                                    type="submit"
                                    size="sm"
                                    disabled={!isAccountDirty || updateAccountMutation.isPending}
                                    className="rounded-xl bg-[#2563EB] text-xs font-semibold text-white hover:bg-blue-700"
                                >
                                    {updateAccountMutation.isPending ? (
                                        <>
                                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                            Saving...
                                        </>
                                    ) : (
                                        <>
                                            <Save className="mr-1.5 h-3.5 w-3.5" />
                                            Save Account
                                        </>
                                    )}
                                </Button>
                            </div>
                        </form>
                    </section>
                </div>
            </div>
        </div>
    );
}

function ShopProfile() {
    const {
        data: shop,
        isLoading: isShopLoading,
        isError: isShopError,
        error: shopError,
        refetch: refetchShop,
    } = useShopDetails();

    const {
        data: profile,
        isLoading: isProfileLoading,
        refetch: refetchProfile,
    } = useShopAdminProfile();

    if (isShopLoading || isProfileLoading) {
        return <LoadingSkeleton />;
    }

    if (isShopError || !shop) {
        const errorMsg = extractGeneralErrorMessage(
            shopError,
            "Could not load shop details. Your account may not be linked to an active shop."
        );

        return (
            <div className="space-y-6">
                <div
                    role="alert"
                    className="rounded-2xl border border-red-200 bg-white p-8 text-center shadow-xs"
                >
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600">
                        <AlertCircle className="h-6 w-6" />
                    </div>
                    <h2 className="mt-4 text-xl font-bold text-slate-900">
                        Shop Profile Unavailable
                    </h2>
                    <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
                        {errorMsg}
                    </p>
                    <div className="mt-6 flex justify-center gap-3">
                        <Button
                            type="button"
                            onClick={() => {
                                refetchShop();
                                refetchProfile();
                            }}
                            className="bg-[#2563EB] text-white hover:bg-blue-700"
                        >
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Retry
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <ShopProfileForm
            key={`${shop.id}-${shop.updated_at}-${profile?.id ?? 0}`}
            shop={shop}
            profile={profile}
        />
    );
}

export default ShopProfile;
