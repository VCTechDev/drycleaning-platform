import {
    AlertCircle,
    CheckCircle2,
    Filter,
    ImageOff,
    Pencil,
    RefreshCw,
    Search,
    Wrench,
} from "lucide-react";
import { useMemo, useState } from "react";

import ServiceFormDialog from "../../components/admin/services/ServiceFormDialog";
import PlatformServicesSkeleton from "../../components/admin/services/PlatformServicesSkeleton";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { usePlatformServiceActions } from "../../hooks/platform/usePlatformServiceActions";
import { usePlatformServices } from "../../hooks/platform/usePlatformServices";
import type { PlatformService } from "../../types/platform/services";

interface FeedbackMessage {
    tone: "success" | "error";
    title: string;
    description: string;
}

function ServiceImage({ image, name }: { image: string | null; name: string }) {
    const [failedImage, setFailedImage] = useState<string | null>(null);
    const failed = Boolean(image && failedImage === image);

    if (!image || failed) {
        return (
            <div className="flex h-full min-h-40 items-center justify-center bg-blue-50 text-blue-300">
                {failed ? (
                    <ImageOff className="h-10 w-10" aria-label={`${name} image unavailable`} />
                ) : (
                    <Wrench className="h-10 w-10" aria-hidden="true" />
                )}
            </div>
        );
    }

    return (
        <img
            src={image}
            alt={name}
            className="h-full min-h-40 w-full object-cover"
            onError={() => setFailedImage(image)}
        />
    );
}

function ServicesListError({ onRetry, retrying }: { onRetry: () => void; retrying: boolean }) {
    return (
        <section className="rounded-2xl border border-red-100 bg-white p-8 text-center shadow-sm" role="alert">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
                <RefreshCw className="h-6 w-6" aria-hidden="true" />
            </div>
            <h1 className="mt-4 font-heading text-xl font-semibold text-slate-950">Services could not be loaded</h1>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                Something went wrong while retrieving platform services. Please try again.
            </p>
            <Button type="button" className="mt-6" onClick={onRetry} disabled={retrying}>
                {retrying ? "Trying again..." : "Try again"}
            </Button>
        </section>
    );
}

function ServicesEmptyState({ filtered }: { filtered: boolean }) {
    return (
        <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                {filtered ? <Filter className="h-5 w-5" aria-hidden="true" /> : <Wrench className="h-5 w-5" aria-hidden="true" />}
            </div>
            <h2 className="mt-4 font-heading text-lg font-semibold text-slate-950">
                {filtered ? "No services match this search" : "No services yet"}
            </h2>
            <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
                {filtered ? "Try a different service name." : "Add the first platform service to make it available to shops."}
            </p>
        </div>
    );
}

function PlatformServices() {
    const { data, isPending, isError, isFetching, refetch } = usePlatformServices();
    const { createMutation, updateMutation } = usePlatformServiceActions();
    const [search, setSearch] = useState("");
    const [formOpen, setFormOpen] = useState(false);
    const [editingService, setEditingService] = useState<PlatformService | null>(null);
    const [feedback, setFeedback] = useState<FeedbackMessage | null>(null);

    const visibleServices = useMemo(() => {
        const term = search.trim().toLocaleLowerCase();
        if (!term) {
            return data?.results ?? [];
        }

        return (data?.results ?? []).filter((service) =>
            service.service_name.toLocaleLowerCase().includes(term)
        );
    }, [data?.results, search]);

    const submissionPending = createMutation.isPending || updateMutation.isPending;

    const openCreateForm = () => {
        setFeedback(null);
        setEditingService(null);
        setFormOpen(true);
    };

    const openEditForm = (service: PlatformService) => {
        setFeedback(null);
        setEditingService(service);
        setFormOpen(true);
    };

    const handleSubmit = (formData: FormData) => {
        if (editingService) {
            return updateMutation.mutateAsync({ serviceId: editingService.id, data: formData });
        }

        return createMutation.mutateAsync(formData);
    };

    const handleSuccess = (service: PlatformService) => {
        setFormOpen(false);
        setEditingService(null);
        setFeedback({
            tone: "success",
            title: editingService ? "Service updated" : "Service created",
            description: `${service.service_name} is ready for platform use.`,
        });
    };

    if (isPending) {
        return <PlatformServicesSkeleton />;
    }

    if (isError || !data) {
        return <ServicesListError onRetry={() => void refetch()} retrying={isFetching} />;
    }

    const hasSearch = Boolean(search.trim());

    return (
        <div className="space-y-6">
            <header className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
                <div>
                    <p className="text-sm font-semibold text-blue-600">Platform workspace</p>
                    <h1 className="mt-1 font-heading text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">Services</h1>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                        Manage the global services that approved shops can offer to customers.
                    </p>
                </div>
                <Button type="button" onClick={openCreateForm} disabled={submissionPending}>
                    <Wrench className="h-4 w-4" aria-hidden="true" />
                    Add Service
                </Button>
            </header>

            {feedback && (
                <div
                    className={`flex items-start gap-3 rounded-2xl border p-4 ${feedback.tone === "success" ? "border-emerald-100 bg-emerald-50 text-emerald-800" : "border-red-100 bg-red-50 text-red-800"}`}
                    role={feedback.tone === "error" ? "alert" : "status"}
                >
                    {feedback.tone === "success" ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" /> : <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />}
                    <div>
                        <p className="text-sm font-semibold">{feedback.title}</p>
                        <p className="mt-1 text-sm">{feedback.description}</p>
                    </div>
                </div>
            )}

            <div className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm sm:p-5">
                <label htmlFor="service-search" className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Search services
                </label>
                <div className="relative mt-2 max-w-xl">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                    <Input
                        id="service-search"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Search by service name"
                        className="pl-9"
                    />
                </div>
                <p className="mt-3 text-sm text-slate-500" role="status">
                    {hasSearch ? `${visibleServices.length} matching service${visibleServices.length === 1 ? "" : "s"}` : `${data.count} service${data.count === 1 ? "" : "s"}`}
                    {isFetching && <span className="ml-2 inline-flex items-center gap-1 text-xs text-slate-400"><RefreshCw className="h-3 w-3 animate-spin" aria-hidden="true" /> Updating...</span>}
                </p>
            </div>

            {visibleServices.length === 0 ? (
                <ServicesEmptyState filtered={hasSearch} />
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {visibleServices.map((service) => (
                        <article key={service.id} className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                            <div className="h-40 overflow-hidden bg-blue-50">
                                <ServiceImage image={service.image} name={service.service_name} />
                            </div>
                            <div className="flex flex-1 flex-col p-5">
                                <div className="flex items-start justify-between gap-3">
                                    <h2 className="min-w-0 break-words font-heading text-lg font-semibold text-slate-950">{service.service_name}</h2>
                                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${service.is_active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                                        {service.is_active ? "Active" : "Inactive"}
                                    </span>
                                </div>
                                <p className="mt-2 min-h-12 text-sm leading-6 text-slate-500">
                                    {service.description || "No description provided."}
                                </p>
                                <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4">
                                    <div>
                                        <dt className="text-xs font-medium text-slate-400">Shops using it</dt>
                                        <dd className="mt-1 text-base font-semibold text-slate-800">{service.shop_count}</dd>
                                    </div>
                                    <div>
                                        <dt className="text-xs font-medium text-slate-400">Order items</dt>
                                        <dd className="mt-1 text-base font-semibold text-slate-800">{service.order_item_count}</dd>
                                    </div>
                                </dl>
                                <Button type="button" variant="outline" className="mt-5 w-full" onClick={() => openEditForm(service)} disabled={submissionPending}>
                                    <Pencil className="h-4 w-4" aria-hidden="true" />
                                    Edit service
                                </Button>
                            </div>
                        </article>
                    ))}
                </div>
            )}

            <ServiceFormDialog
                key={formOpen ? `open-${editingService?.id ?? "new"}` : "closed"}
                open={formOpen}
                service={editingService}
                pending={submissionPending}
                onClose={() => {
                    if (!submissionPending) {
                        setFormOpen(false);
                    }
                }}
                onSubmit={handleSubmit}
                onSuccess={handleSuccess}
            />
        </div>
    );
}

export default PlatformServices;
