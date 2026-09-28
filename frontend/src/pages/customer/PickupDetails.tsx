import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
    ArrowLeft,
    ArrowRight,
    Check,
    FileText,
    MapPin,
    ShieldCheck,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

import { createOrder } from "../../services/orderService";
import type { Shop } from "../../types/shop";
import type { ShopService } from "../../types/shopService";

type PickupState = {
    shop: Shop;
    services: ShopService[];
    selectedServices: Record<number, number>;
    totalItems: number;
    totalAmount: number;
};

function PickupDetails() {
    const location = useLocation();
    const navigate = useNavigate();

    const state = location.state as PickupState | null;

    const [address, setAddress] = useState({
        pickup_address_line: "",
        pickup_city: "",
        pickup_district: "",
        pickup_state: "Kerala",
        pickup_pincode: "",
        note: "",
    });

    const [submitting, setSubmitting] = useState(false);

    const selectedServices = state?.services || [];
    const selectedQuantities = state?.selectedServices || {};

    const totalAmount = useMemo(() => {
        return selectedServices.reduce((total, service) => {
            const quantity =
                selectedQuantities[service.id] || 0;

            return (
                total +
                Number(service.price) * quantity
            );
        }, 0);
    }, [selectedServices, selectedQuantities]);

    const totalItems = useMemo(() => {
        return Object.values(selectedQuantities).reduce(
            (total, quantity) => total + quantity,
            0
        );
    }, [selectedQuantities]);

    if (!state?.shop) {
        return (
            <div className="min-h-screen bg-[#F5FAFF] px-4 py-10">
                <div className="mx-auto max-w-5xl">
                    <p className="text-[#596989]">
                        Order information is no longer available.
                    </p>

                    <Button
                        className="mt-4"
                        onClick={() =>
                            navigate("/customer/shops")
                        }
                    >
                        Back to Shops
                    </Button>
                </div>
            </div>
        );
    }

    const handleCreateOrder = async () => {
        try {
            if (!state.shop.id) return;

            setSubmitting(true);

            const items = selectedServices.map((service) => ({
                shop_service: service.id,
                quantity:
                    selectedQuantities[service.id] || 1,
            }));

            const orderData = {
                shop: state.shop.id,
                ...address,
                items,
            };

            const order = await createOrder(orderData);

            console.log("ORDER CREATED:", order);

            /*
             * Later we can navigate to:
             * /customer/orders/:id
             *
             * once the exact response structure is confirmed.
             */

            alert("Order created successfully!");

            navigate("/customer/orders");
        } catch (error) {
            console.error(
                "ORDER CREATION FAILED:",
                error
            );

            alert(
                "Unable to place the order. Please check your details and try again."
            );
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#F5FAFF] pb-10">
            <main className="mx-auto max-w-6xl px-4 py-5 sm:px-6 lg:px-8">

                {/* Back */}
                <button
                    type="button"
                    onClick={() => navigate(-1)}
                    className="inline-flex items-center gap-2 text-sm font-medium text-[#087CC1]"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Back to services
                </button>

                {/* Progress */}
                <div className="mx-auto mt-7 flex max-w-xl items-start">
                    <ProgressStep
                        number="✓"
                        label="Shop"
                        completed
                    />

                    <ProgressLine />

                    <ProgressStep
                        number="✓"
                        label="Services"
                        completed
                    />

                    <ProgressLine />

                    <ProgressStep
                        number="3"
                        label="Pickup"
                        active
                    />
                </div>

                {/* Header */}
                <section className="mt-8">
                    <p className="text-xs font-bold tracking-[0.18em] text-[#087CC1]">
                        PICKUP DETAILS
                    </p>

                    <h1 className="mt-2 font-heading text-3xl font-bold tracking-tight text-[#10194A] sm:text-4xl">
                        Where should we pick up?
                    </h1>

                    <p className="mt-2 max-w-2xl text-sm leading-6 text-[#596989] sm:text-base">
                        Enter your pickup address so we can
                        collect your clothes from your
                        doorstep.
                    </p>
                </section>

                {/* Main */}
                <div className="mt-6 grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">

                    {/* Form */}
                    <Card className="rounded-[20px] border-[#E3E8F2] bg-white p-5 shadow-sm sm:p-7">
                        <div className="flex items-center gap-3">
                            <MapPin className="h-6 w-6 text-[#087CC1]" />

                            <h2 className="font-heading text-xl font-bold text-[#10194A]">
                                Pickup address
                            </h2>
                        </div>

                        <div className="mt-6 space-y-5">

                            <FormField
                                label="Pickup address"
                            >
                                <input
                                    value={
                                        address.pickup_address_line
                                    }
                                    onChange={(e) =>
                                        setAddress({
                                            ...address,
                                            pickup_address_line:
                                                e.target.value,
                                        })
                                    }
                                    placeholder="House name, street, locality"
                                    className="form-input"
                                />
                            </FormField>

                            <div className="grid gap-5 sm:grid-cols-2">
                                <FormField label="City">
                                    <input
                                        value={
                                            address.pickup_city
                                        }
                                        onChange={(e) =>
                                            setAddress({
                                                ...address,
                                                pickup_city:
                                                    e.target.value,
                                            })
                                        }
                                        placeholder="Enter city"
                                        className="form-input"
                                    />
                                </FormField>

                                <FormField label="District">
                                    <select
                                        value={
                                            address.pickup_district
                                        }
                                        onChange={(e) =>
                                            setAddress({
                                                ...address,
                                                pickup_district:
                                                    e.target.value,
                                            })
                                        }
                                        className="form-input"
                                    >
                                        <option value="">
                                            Select district
                                        </option>
                                        <option value="Thiruvananthapuram">
                                            Thiruvananthapuram
                                        </option>
                                        <option value="Kollam">
                                            Kollam
                                        </option>
                                        <option value="Pathanamthitta">
                                            Pathanamthitta
                                        </option>
                                        <option value="Alappuzha">
                                            Alappuzha
                                        </option>
                                        <option value="Kottayam">
                                            Kottayam
                                        </option>
                                        <option value="Idukki">
                                            Idukki
                                        </option>
                                        <option value="Ernakulam">
                                            Ernakulam
                                        </option>
                                        <option value="Thrissur">
                                            Thrissur
                                        </option>
                                        <option value="Palakkad">
                                            Palakkad
                                        </option>
                                        <option value="Malappuram">
                                            Malappuram
                                        </option>
                                        <option value="Kozhikode">
                                            Kozhikode
                                        </option>
                                        <option value="Wayanad">
                                            Wayanad
                                        </option>
                                        <option value="Kannur">
                                            Kannur
                                        </option>
                                        <option value="Kasaragod">
                                            Kasaragod
                                        </option>
                                    </select>
                                </FormField>
                            </div>

                            <div className="grid gap-5 sm:grid-cols-2">
                                <FormField label="State">
                                    <input
                                        value={
                                            address.pickup_state
                                        }
                                        readOnly
                                        className="form-input bg-[#F8FBFF]"
                                    />
                                </FormField>

                                <FormField label="Pincode">
                                    <input
                                        value={
                                            address.pickup_pincode
                                        }
                                        onChange={(e) =>
                                            setAddress({
                                                ...address,
                                                pickup_pincode:
                                                    e.target.value,
                                            })
                                        }
                                        placeholder="Enter pincode"
                                        inputMode="numeric"
                                        maxLength={6}
                                        className="form-input"
                                    />
                                </FormField>
                            </div>

                            <FormField
                                label={
                                    <span className="flex items-center gap-2">
                                        Additional note
                                        <span className="rounded-full bg-[#EAF4FF] px-2 py-0.5 text-xs font-normal text-[#496C9E]">
                                            Optional
                                        </span>
                                    </span>
                                }
                            >
                                <textarea
                                    value={address.note}
                                    onChange={(e) =>
                                        setAddress({
                                            ...address,
                                            note: e.target.value,
                                        })
                                    }
                                    maxLength={200}
                                    rows={4}
                                    placeholder="Any special instructions for pickup? (Optional)"
                                    className="form-input resize-none py-3"
                                />

                                <div className="mt-1 text-right text-xs text-[#7182A3]">
                                    {address.note.length}/200
                                </div>
                            </FormField>
                        </div>

                        <Button
                            onClick={handleCreateOrder}
                            disabled={submitting}
                            className="mt-5 h-12 w-full rounded-xl bg-[#087CC1] text-base font-semibold hover:bg-[#076FAE]"
                        >
                            {submitting
                                ? "Placing order..."
                                : "Place Order"}

                            {!submitting && (
                                <ArrowRight className="ml-2 h-4 w-4" />
                            )}
                        </Button>

                        <p className="mt-3 text-center text-xs text-[#7182A3]">
                            By placing this order, you
                            confirm that the pickup details
                            are correct.
                        </p>
                    </Card>

                    {/* Summary */}
                    <Card className="h-fit rounded-[20px] border-[#E3E8F2] bg-white p-5 shadow-sm sm:p-6">
                        <div className="flex items-center gap-3">
                            <FileText className="h-5 w-5 text-[#087CC1]" />

                            <h2 className="font-heading text-xl font-bold text-[#10194A]">
                                Order summary
                            </h2>
                        </div>

                        {/* Shop */}
                        <div className="mt-5 flex gap-3">
                            <div className="h-20 w-24 shrink-0 overflow-hidden rounded-xl bg-[#EEF3F9]">
                                {state.shop.image ? (
                                    <img
                                        src={state.shop.image}
                                        alt={state.shop.shop_name}
                                        className="h-full w-full object-cover"
                                    />
                                ) : null}
                            </div>

                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                    <h3 className="font-heading font-bold text-[#10194A]">
                                        {state.shop.shop_name}
                                    </h3>

                                    <span className="rounded-full bg-[#DDF8E7] px-2.5 py-1 text-xs font-semibold text-[#119447]">
                                        {state.shop.is_open
                                            ? "Open"
                                            : "Closed"}
                                    </span>
                                </div>

                                <div className="mt-2 flex items-center gap-2 text-sm text-[#596989]">
                                    <MapPin className="h-4 w-4 shrink-0" />
                                    {state.shop.city},{" "}
                                    {state.shop.district}
                                </div>
                            </div>
                        </div>

                        <div className="my-5 border-t border-[#E3E8F2]" />

                        <h3 className="font-semibold text-[#10194A]">
                            Selected services
                        </h3>

                        <div className="mt-3 space-y-3">
                            {selectedServices.map(
                                (service) => {
                                    const quantity =
                                        selectedQuantities[
                                            service.id
                                        ] || 0;

                                    const lineTotal =
                                        Number(
                                            service.price
                                        ) * quantity;

                                    return (
                                        <div
                                            key={service.id}
                                            className="flex items-center justify-between gap-3"
                                        >
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-semibold text-[#10194A]">
                                                    {
                                                        service.service
                                                    }
                                                </p>

                                                <p className="mt-1 text-sm text-[#596989]">
                                                    {quantity} × ₹
                                                    {Number(
                                                        service.price
                                                    ).toFixed(0)}
                                                </p>
                                            </div>

                                            <p className="shrink-0 font-semibold text-[#10194A]">
                                                ₹
                                                {lineTotal.toFixed(
                                                    0
                                                )}
                                            </p>
                                        </div>
                                    );
                                }
                            )}
                        </div>

                        <div className="my-5 border-t border-[#E3E8F2]" />

                        <div className="flex items-end justify-between">
                            <div>
                                <p className="text-sm text-[#596989]">
                                    Total ({totalItems} items)
                                </p>
                            </div>

                            <p className="text-3xl font-bold text-[#10194A]">
                                ₹{totalAmount.toFixed(0)}
                            </p>
                        </div>

                        <div className="mt-5 flex gap-3 rounded-2xl bg-[#F0F8FF] p-4">
                            <ShieldCheck className="h-6 w-6 shrink-0 text-[#087CC1]" />

                            <div>
                                <p className="text-sm font-semibold text-[#087CC1]">
                                    Pickup from your doorstep
                                </p>

                                <p className="mt-1 text-xs leading-5 text-[#496C9E]">
                                    Our pickup team will
                                    collect your clothes
                                    from the address you
                                    provide.
                                </p>
                            </div>
                        </div>
                    </Card>
                </div>
            </main>
        </div>
    );
}

function ProgressStep({
    number,
    label,
    completed = false,
    active = false,
}: {
    number: string;
    label: string;
    completed?: boolean;
    active?: boolean;
}) {
    return (
        <div className="flex min-w-0 flex-1 flex-col items-center">
            <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                    completed || active
                        ? "bg-[#087CC1] text-white"
                        : "bg-[#DCE7F2] text-[#7182A3]"
                }`}
            >
                {completed ? (
                    <Check className="h-4 w-4" />
                ) : (
                    number
                )}
            </div>

            <span
                className={`mt-2 text-xs font-medium ${
                    active
                        ? "text-[#087CC1]"
                        : "text-[#596989]"
                }`}
            >
                {label}
            </span>
        </div>
    );
}

function ProgressLine() {
    return (
        <div className="mt-4 h-0.5 flex-1 bg-[#087CC1]" />
    );
}

function FormField({
    label,
    children,
}: {
    label: React.ReactNode;
    children: React.ReactNode;
}) {
    return (
        <label className="block">
            <span className="mb-2 block text-sm font-medium text-[#10194A]">
                {label}
            </span>

            {children}
        </label>
    );
}

export default PickupDetails;