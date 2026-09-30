import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
    ArrowLeft,
    ArrowRight,
    Clock3,
    Leaf,
    MapPin,
    Minus,
    Plus,
    ShieldCheck,
    Sparkles,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

import {
    getShopDetail,
    getShopServices,
} from "../../services/shopService";
import type { Shop } from "../../types/shop";
import type { ShopService } from "../../types/shopService";

function formatTime(time: string) {
    if (!time) return "";

    const [hours, minutes] = time.split(":");
    const date = new Date();

    date.setHours(Number(hours), Number(minutes), 0, 0);

    return date.toLocaleTimeString("en-IN", {
        hour: "numeric",
        minute: "2-digit",
    });
}

function ShopDetail() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [shop, setShop] = useState<Shop | null>(null);
    const [services, setServices] = useState<ShopService[]>([]);
    const [selectedServices, setSelectedServices] =
        useState<Record<number, number>>({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchShop = async () => {
            try {
                if (!id) return;

                const [shopData, serviceData] = await Promise.all([
                    getShopDetail(id),
                    getShopServices(id),
                ]);

                setShop(shopData);
                setServices(serviceData);
            } catch (error) {
                console.error("FAILED TO LOAD SHOP:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchShop();
    }, [id]);

    const toggleService = (serviceId: number) => {
        setSelectedServices((current) => {
            if (current[serviceId]) {
                const updated = { ...current };
                delete updated[serviceId];
                return updated;
            }

            return {
                ...current,
                [serviceId]: 1,
            };
        });
    };

    const updateQuantity = (
        serviceId: number,
        quantity: number
    ) => {
        if (quantity < 1) return;

        setSelectedServices((current) => ({
            ...current,
            [serviceId]: quantity,
        }));
    };

    const removeService = (serviceId: number) => {
        setSelectedServices((current) => {
            const updated = { ...current };
            delete updated[serviceId];
            return updated;
        });
    };

    const selectedItems = useMemo(() => {
        return services.filter(
            (service) => selectedServices[service.id]
        );
    }, [services, selectedServices]);

    const totalItems = useMemo(() => {
        return Object.values(selectedServices).reduce(
            (total, quantity) => total + quantity,
            0
        );
    }, [selectedServices]);

    const totalAmount = useMemo(() => {
        return selectedItems.reduce((total, service) => {
            const quantity = selectedServices[service.id] || 0;

            return (
                total +
                Number(service.price) * quantity
            );
        }, 0);
    }, [selectedItems, selectedServices]);

    const handleContinue = () => {
        if (!id || selectedItems.length === 0) return;

        navigate(`/customer/shops/${id}/pickup`, {
            state: {
                shop,
                services: selectedItems,
                selectedServices,
                totalItems,
                totalAmount,
            },
        });
    };

    if (loading) {
        return (
            <div className="min-h-[60vh] bg-[#F5FAFF] px-4 py-10">
                <div className="mx-auto max-w-7xl">
                    <p className="text-[#596989]">
                        Loading shop...
                    </p>
                </div>
            </div>
        );
    }

    if (!shop) {
        return (
            <div className="min-h-[60vh] bg-[#F5FAFF] px-4 py-10">
                <div className="mx-auto max-w-7xl">
                    <p className="text-[#596989]">
                        Shop not found.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#F5FAFF] pb-32">
            <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">

                {/* Back */}
                <Link
                    to="/customer/shops"
                    className="inline-flex items-center gap-2 text-sm font-medium text-[#087CC1] hover:text-[#056AA8]"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Back to Shops
                </Link>

                {/* Shop Information */}
                <Card className="mt-4 overflow-hidden rounded-[22px] border-[#E3E8F2] bg-white p-3 shadow-sm sm:p-4 lg:p-5">
                    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">

                        {/* Image */}
                        <div className="overflow-hidden rounded-[18px] bg-[#EEF3F9]">
                            {shop.image ? (
                                <img
                                    src={shop.image}
                                    alt={shop.shop_name}
                                    className="aspect-[16/9] h-full w-full object-cover"
                                />
                            ) : (
                                <div className="flex aspect-[16/9] items-center justify-center text-sm text-muted-foreground">
                                    No shop image
                                </div>
                            )}
                        </div>

                        {/* Details */}
                        <div className="px-1 py-2 lg:px-2">

                            <div className="flex flex-wrap items-center gap-3">
                                <h1 className="font-heading text-3xl font-bold tracking-tight text-[#10194A] sm:text-4xl">
                                    {shop.shop_name}
                                </h1>

                                <span
                                    className={`rounded-full px-4 py-1.5 text-sm font-semibold ${shop.is_open
                                            ? "bg-[#DDF8E7] text-[#119447]"
                                            : "bg-[#FFE1E1] text-[#D92D20]"
                                        }`}
                                >
                                    {shop.is_open
                                        ? "Open"
                                        : "Closed"}
                                </span>
                            </div>

                            <div className="mt-5 space-y-3">
                                <div className="flex items-center gap-3 text-[#304B83]">
                                    <MapPin className="h-5 w-5 shrink-0 text-[#087CC1]" />
                                    <span>
                                        {shop.city},{" "}
                                        {shop.district}
                                    </span>
                                </div>

                                <div className="flex items-center gap-3 text-[#304B83]">
                                    <Clock3 className="h-5 w-5 shrink-0 text-[#087CC1]" />

                                    <span>
                                        {shop.is_open
                                            ? `Closes ${formatTime(
                                                shop.closing_time
                                            )}`
                                            : `Opens ${formatTime(
                                                shop.opening_time
                                            )}`}
                                    </span>
                                </div>
                            </div>

                            <p className="mt-6 text-sm leading-7 text-[#405887] sm:text-base">
                                {shop.description}
                            </p>

                            <div className="mt-6 grid grid-cols-3 overflow-hidden rounded-2xl bg-[#F1F8FF]">
                                <div className="flex items-center gap-2 px-3 py-4 sm:gap-3 sm:px-4">
                                    <Leaf className="h-5 w-5 shrink-0 text-[#087CC1]" />
                                    <span className="text-xs font-medium text-[#304B83] sm:text-sm">
                                        Eco-friendly
                                        <br />
                                        cleaning
                                    </span>
                                </div>

                                <div className="flex items-center gap-2 border-x border-[#D5E5F5] px-3 py-4 sm:gap-3 sm:px-4">
                                    <ShieldCheck className="h-5 w-5 shrink-0 text-[#087CC1]" />
                                    <span className="text-xs font-medium text-[#304B83] sm:text-sm">
                                        Careful
                                        <br />
                                        handling
                                    </span>
                                </div>

                                <div className="flex items-center gap-2 px-3 py-4 sm:gap-3 sm:px-4">
                                    <Sparkles className="h-5 w-5 shrink-0 text-[#087CC1]" />
                                    <span className="text-xs font-medium text-[#304B83] sm:text-sm">
                                        Fresh &
                                        <br />
                                        long-lasting
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </Card>

                {/* Services */}
                <section className="mt-8">
                    <div>
                        <p className="text-xs font-bold tracking-[0.18em] text-[#087CC1]">
                            SERVICES
                        </p>

                        <h2 className="mt-1 font-heading text-2xl font-bold tracking-tight text-[#10194A] sm:text-3xl">
                            Choose what you'd like cleaned
                        </h2>

                        <p className="mt-2 text-sm text-[#596989] sm:text-base">
                            Select the services you need and adjust the quantity.
                        </p>
                    </div>

                    <div className="mt-5 space-y-2 rounded-[20px] bg-white p-2 shadow-sm sm:p-3">
                        {services.map((service) => {
                            const quantity =
                                selectedServices[service.id] || 0;

                            const selected = quantity > 0;

                            return (
                                <div
                                    key={service.id}
                                    className={`flex min-h-[82px] items-center gap-3 rounded-2xl border px-3 py-3 transition sm:px-4 ${selected
                                            ? "border-[#B9DCFF] bg-[#F8FCFF]"
                                            : "border-transparent bg-white"
                                        }`}
                                >
                                    {/* Garment image */}
                                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-[#EEF3F9]">
                                        {service.garment_image ? (
                                            <img
                                                src={service.garment_image}
                                                alt={service.garment_type}
                                                className="h-full w-full object-cover"
                                            />
                                        ) : (
                                            <div className="flex h-full items-center justify-center px-1 text-center text-[10px] text-[#596989]">
                                                No image
                                            </div>
                                        )}
                                    </div>

                                    {/* Service info */}
                                    <div className="min-w-0 flex-1">
                                        <h3 className="truncate font-heading text-base font-semibold text-[#10194A]">
                                            {service.service}
                                        </h3>

                                        <p className="mt-1 text-sm text-[#596989]">
                                            {service.garment_type} ·{" "}
                                            {service.estimated_days}{" "}
                                            {service.estimated_days === 1
                                                ? "day"
                                                : "days"}
                                        </p>
                                    </div>

                                    {/* Price */}
                                    <div className="shrink-0 text-right">
                                        <p className="text-base font-bold text-[#10194A] sm:text-lg">
                                            ₹
                                            {Number(
                                                service.price
                                            ).toFixed(0)}
                                        </p>
                                    </div>

                                    {/* Action */}
                                    <div className="w-[112px] shrink-0">
                                        {!selected ? (
                                            <Button
                                                variant="outline"
                                                onClick={() =>
                                                    toggleService(
                                                        service.id
                                                    )
                                                }
                                                className="h-11 w-full rounded-xl border-[#087CC1] text-[#087CC1] hover:bg-[#F1F8FF]"
                                            >
                                                Select
                                            </Button>
                                        ) : (
                                            <div className="flex h-11 items-center justify-between rounded-xl">
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        quantity > 1
                                                            ? updateQuantity(
                                                                service.id,
                                                                quantity - 1
                                                            )
                                                            : removeService(
                                                                service.id
                                                            )
                                                    }
                                                    className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#DCEEFF] text-[#087CC1]"
                                                >
                                                    <Minus className="h-4 w-4" />
                                                </button>

                                                <span className="px-2 font-semibold text-[#10194A]">
                                                    {quantity}
                                                </span>

                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        updateQuantity(
                                                            service.id,
                                                            quantity + 1
                                                        )
                                                    }
                                                    className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#087CC1] text-white"
                                                >
                                                    <Plus className="h-4 w-4" />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>
            </main>

            {/* Sticky Order Summary */}
            {selectedItems.length > 0 && (
                <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#DDE8F4] bg-white/95 px-4 py-3 shadow-[0_-8px_30px_rgba(16,25,74,0.08)] backdrop-blur sm:px-6">
                    <div className="mx-auto flex max-w-7xl items-center gap-4">

                        <div className="hidden shrink-0 items-center gap-3 md:flex">
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#E5F3FF]">
                                <Sparkles className="h-5 w-5 text-[#087CC1]" />
                            </div>

                            <div>
                                <p className="font-semibold text-[#10194A]">
                                    Your selection
                                </p>
                                <p className="text-sm text-[#596989]">
                                    {selectedItems.length}{" "}
                                    {selectedItems.length === 1
                                        ? "service"
                                        : "services"}{" "}
                                    · {totalItems}{" "}
                                    {totalItems === 1
                                        ? "item"
                                        : "items"}
                                </p>
                            </div>
                        </div>

                        <div className="hidden min-w-0 flex-1 lg:block">
                            <div className="flex flex-wrap gap-x-5 gap-y-1">
                                {selectedItems.map((service) => (
                                    <span
                                        key={service.id}
                                        className="text-sm text-[#304B83]"
                                    >
                                        {service.service} ×{" "}
                                        {selectedServices[
                                            service.id
                                        ]}
                                    </span>
                                ))}
                            </div>
                        </div>

                        <div className="ml-auto shrink-0">
                            <p className="text-xs text-[#596989]">
                                Total
                            </p>
                            <p className="text-xl font-bold text-[#10194A]">
                                ₹{totalAmount.toFixed(0)}
                            </p>
                        </div>

                        <Button
                            onClick={handleContinue}
                            className="h-12 shrink-0 rounded-xl bg-[#087CC1] px-5 text-sm font-semibold text-white hover:bg-[#076FAE] sm:px-7"
                        >
                            Continue to pickup
                            <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default ShopDetail;
