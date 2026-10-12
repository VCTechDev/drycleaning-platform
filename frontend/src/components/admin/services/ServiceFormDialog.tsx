import axios from "axios";
import { ImagePlus, LoaderCircle, Upload, X, Wrench } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "../../ui/button";
import type { PlatformService } from "../../../types/platform/services";

type ServiceField = "service_name" | "description" | "image" | "is_active";
type FieldErrors = Partial<Record<ServiceField, string>>;

interface ServiceFormDialogProps {
    open: boolean;
    service: PlatformService | null;
    pending: boolean;
    onClose: () => void;
    onSubmit: (data: FormData) => Promise<PlatformService>;
    onSuccess: (service: PlatformService) => void;
}

const getApiMessage = (value: unknown) => {
    if (Array.isArray(value)) {
        return value.map(String).join(" ");
    }

    return typeof value === "string" ? value : "";
};

const getApiErrors = (error: unknown): { fields: FieldErrors; general: string } => {
    if (!axios.isAxiosError(error)) {
        return {
            fields: {},
            general: "The service could not be saved. Please try again.",
        };
    }

    const responseData = error.response?.data;
    if (!responseData || typeof responseData !== "object") {
        return {
            fields: {},
            general: "The service could not be saved. Please try again.",
        };
    }

    const body = responseData as Record<string, unknown>;
    const fields: FieldErrors = {};
    for (const field of ["service_name", "description", "image", "is_active"] as const) {
        const message = getApiMessage(body[field]);
        if (message) {
            fields[field] = message;
        }
    }

    const general =
        getApiMessage(body.non_field_errors) ||
        getApiMessage(body.detail) ||
        "The service could not be saved. Check the form and try again.";

    return { fields, general };
};

function FieldError({ id, message }: { id: string; message?: string }) {
    if (!message) {
        return null;
    }

    return (
        <p id={id} className="mt-1 text-xs text-red-600">
            {message}
        </p>
    );
}

function ServiceFormDialog({
    open,
    service,
    pending,
    onClose,
    onSubmit,
    onSuccess,
}: ServiceFormDialogProps) {
    const [serviceName, setServiceName] = useState(service?.service_name ?? "");
    const [description, setDescription] = useState(service?.description ?? "");
    const [isActive, setIsActive] = useState(service?.is_active ?? true);
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(service?.image ?? null);
    const [imagePreviewFailed, setImagePreviewFailed] = useState(false);
    const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
    const [generalError, setGeneralError] = useState<string | null>(null);
    const nameInputRef = useRef<HTMLInputElement>(null);
    const objectUrlRef = useRef<string | null>(null);

    const clearObjectUrl = () => {
        if (objectUrlRef.current) {
            URL.revokeObjectURL(objectUrlRef.current);
            objectUrlRef.current = null;
        }
    };

    useEffect(() => {
        if (!open) {
            return;
        }

        clearObjectUrl();
        window.requestAnimationFrame(() => nameInputRef.current?.focus());
    }, [open, service]);

    useEffect(() => clearObjectUrl, []);

    useEffect(() => {
        if (!open) {
            return;
        }

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape" && !pending) {
                onClose();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [open, onClose, pending]);

    if (!open) {
        return null;
    }

    const isEditing = Boolean(service);
    const title = isEditing ? "Edit service" : "Add service";

    const handleImageChange = (file: File | null) => {
        setFieldErrors((current) => ({ ...current, image: undefined }));

        if (!file) {
            return;
        }

        if (!file.type.startsWith("image/")) {
            clearObjectUrl();
            setImageFile(null);
            setImagePreview(service?.image ?? null);
            setImagePreviewFailed(false);
            setFieldErrors((current) => ({
                ...current,
                image: "Select a valid image file.",
            }));
            return;
        }

        clearObjectUrl();
        const objectUrl = URL.createObjectURL(file);
        objectUrlRef.current = objectUrl;
        setImageFile(file);
        setImagePreview(objectUrl);
        setImagePreviewFailed(false);
    };

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (pending) {
            return;
        }

        const trimmedName = serviceName.trim();
        const trimmedDescription = description.trim();
        const localErrors: FieldErrors = {};

        if (!trimmedName) {
            localErrors.service_name = "Service name is required.";
        }

        if (trimmedName.length > 50) {
            localErrors.service_name = "Service name must be 50 characters or fewer.";
        }

        if (trimmedDescription.length > 255) {
            localErrors.description = "Description must be 255 characters or fewer.";
        }

        if (Object.keys(localErrors).length > 0) {
            setFieldErrors(localErrors);
            setGeneralError(null);
            return;
        }

        const formData = new FormData();
        formData.append("service_name", trimmedName);
        formData.append("description", trimmedDescription);
        formData.append("is_active", String(isActive));

        // Omitting image during edit preserves the existing image. The API
        // contract does not provide image removal, so no removal control is shown.
        if (imageFile) {
            formData.append("image", imageFile);
        }

        setFieldErrors({});
        setGeneralError(null);

        try {
            const savedService = await onSubmit(formData);
            onSuccess(savedService);
        } catch (error) {
            const apiErrors = getApiErrors(error);
            setFieldErrors(apiErrors.fields);
            setGeneralError(apiErrors.general);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-3 sm:items-center sm:p-5">
            <div
                className="max-h-[calc(100vh-1.5rem)] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-xl sm:max-h-[calc(100vh-2.5rem)]"
                role="dialog"
                aria-modal="true"
                aria-labelledby="service-form-title"
                aria-describedby="service-form-description"
            >
                <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5 sm:p-6">
                    <div className="flex min-w-0 items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                            <Wrench className="h-5 w-5" aria-hidden="true" />
                        </div>
                        <div className="min-w-0">
                            <h2 id="service-form-title" className="font-heading text-lg font-semibold text-slate-950">
                                {title}
                            </h2>
                            <p id="service-form-description" className="mt-1 text-sm leading-6 text-slate-500">
                                Add a global service that shops can configure for their customers.
                            </p>
                        </div>
                    </div>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={onClose}
                        disabled={pending}
                        aria-label="Close dialog"
                        className="rounded-xl text-slate-500 hover:bg-slate-100"
                    >
                        <X className="h-5 w-5" aria-hidden="true" />
                    </Button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5 p-5 sm:p-6">
                    {generalError && (
                        <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-800" role="alert">
                            {generalError}
                        </div>
                    )}

                    <div>
                        <label htmlFor="service-form-name" className="text-sm font-semibold text-slate-900">
                            Service name <span className="text-red-600" aria-hidden="true">*</span>
                        </label>
                        <input
                            ref={nameInputRef}
                            id="service-form-name"
                            value={serviceName}
                            onChange={(event) => setServiceName(event.target.value)}
                            maxLength={50}
                            disabled={pending}
                            aria-invalid={Boolean(fieldErrors.service_name)}
                            aria-describedby={fieldErrors.service_name ? "service-name-error" : "service-name-help"}
                            className="mt-2 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:bg-slate-50"
                            placeholder="e.g. Dry cleaning"
                        />
                        <div className="mt-1 flex items-start justify-between gap-3 text-xs">
                            <FieldError id="service-name-error" message={fieldErrors.service_name} />
                            {!fieldErrors.service_name && <p id="service-name-help" className="text-slate-500">Use a unique service name.</p>}
                            <span className="shrink-0 text-slate-400">{serviceName.length}/50</span>
                        </div>
                    </div>

                    <div>
                        <label htmlFor="service-form-description" className="text-sm font-semibold text-slate-900">
                            Description
                        </label>
                        <textarea
                            id="service-form-description"
                            value={description}
                            onChange={(event) => setDescription(event.target.value)}
                            maxLength={255}
                            rows={4}
                            disabled={pending}
                            aria-invalid={Boolean(fieldErrors.description)}
                            aria-describedby={fieldErrors.description ? "service-description-error" : "service-description-help"}
                            className="mt-2 w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:bg-slate-50"
                            placeholder="Briefly describe what this service includes."
                        />
                        <div className="mt-1 flex items-start justify-between gap-3 text-xs">
                            <FieldError id="service-description-error" message={fieldErrors.description} />
                            {!fieldErrors.description && <p id="service-description-help" className="text-slate-500">Optional.</p>}
                            <span className="shrink-0 text-slate-400">{description.length}/255</span>
                        </div>
                    </div>

                    <div>
                        <span className="text-sm font-semibold text-slate-900">Service image</span>
                        <div className="mt-2 grid gap-3 sm:grid-cols-[8rem_minmax(0,1fr)]">
                            <div className="flex h-32 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                                {imagePreview && !imagePreviewFailed ? (
                                    <img
                                        src={imagePreview}
                                        alt="Selected service preview"
                                        className="h-full w-full object-cover"
                                        onError={() => setImagePreviewFailed(true)}
                                    />
                                ) : (
                                    <ImagePlus className="h-8 w-8 text-slate-300" aria-hidden="true" />
                                )}
                            </div>
                            <div className="flex min-w-0 flex-col justify-center">
                                <label htmlFor="service-form-image" className="inline-flex min-h-10 w-fit cursor-pointer items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-3 text-sm font-semibold text-blue-700 transition hover:border-blue-200 hover:bg-blue-100 focus-within:ring-2 focus-within:ring-blue-500/30">
                                    <Upload className="h-4 w-4" aria-hidden="true" />
                                    Choose image
                                    <input
                                        id="service-form-image"
                                        type="file"
                                        accept="image/*"
                                        className="sr-only"
                                        disabled={pending}
                                        onChange={(event) => handleImageChange(event.target.files?.[0] ?? null)}
                                    />
                                </label>
                                <p className="mt-2 text-xs leading-5 text-slate-500">
                                    {isEditing && service?.image
                                        ? "The current image stays in place unless you choose a replacement."
                                        : "Optional. Select an image to show on service cards."}
                                </p>
                                <FieldError id="service-image-error" message={fieldErrors.image} />
                            </div>
                        </div>
                    </div>

                    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 transition hover:border-blue-200 hover:bg-blue-50/40">
                        <input
                            type="checkbox"
                            checked={isActive}
                            onChange={(event) => setIsActive(event.target.checked)}
                            disabled={pending}
                            className="mt-0.5 h-4 w-4 accent-blue-600"
                        />
                        <span>
                            <span className="block text-sm font-semibold text-slate-900">Active service</span>
                            <span className="mt-1 block text-xs leading-5 text-slate-500">Active services can be configured by shops.</span>
                        </span>
                    </label>

                    <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
                        <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={pending}>
                            {pending && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}
                            {pending ? "Saving..." : isEditing ? "Save changes" : "Add service"}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default ServiceFormDialog;
