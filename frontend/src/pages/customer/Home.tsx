import {
    ArrowRight,
    MapPin,
    WashingMachine,
    Shirt,
    Scissors,
    Sparkles,
    Gem,
    Truck,
    Store,
    SlidersHorizontal,
    ClipboardList,
    Star,
} from "lucide-react";
import { useEffect, useState } from "react";
import { getShops } from "../../services/shopService";
import type { Shop } from "../../types/shop";
import { useNavigate } from "react-router-dom";

function Home() {
    const navigate = useNavigate();

    const [shops, setShops] = useState<Shop[]>([]);
    const [loadingShops, setLoadingShops] = useState(true);

    useEffect(() => {
        const loadShops = async () => {
            try {
                const data = await getShops();
                setShops(data.slice(0, 3));
            } catch (error) {
                console.error("Failed to load nearby shops:", error);
            } finally {
                setLoadingShops(false);
            }
        };

        loadShops();
    }, []);

    const featuredServices = [
        {
            name: "Dry Cleaning",
            description: "Gentle care for delicate and everyday garments.",
            icon: WashingMachine,
        },
        {
            name: "Shirt Laundry",
            description: "Freshly cleaned and pressed shirts.",
            icon: Shirt,
        },
        {
            name: "Alterations & Tailoring",
            description: "Professional adjustments for the perfect fit.",
            icon: Scissors,
        },
        {
            name: "Wedding Dress Preservation",
            description: "Special care for cherished garments.",
            icon: Gem,
        },
        {
            name: "Leather & Suede Care",
            description: "Specialized care for premium materials.",
            icon: Sparkles,
        },
        {
            name: "Free Pickup & Delivery",
            description: "Convenient door-to-door garment service.",
            icon: Truck,
        },
    ];

    const whyChooseUs = [
        {
            title: "Trusted Local Shops",
            description:
                "Discover open dry cleaning shops near you and choose the one that works best for you.",
            icon: Store,
        },
        {
            title: "Choose What Fits You",
            description:
                "Compare available services and prices from each shop before placing your order.",
            icon: SlidersHorizontal,
        },
        {
            title: "Care You Can Track",
            description:
                "Stay informed about your order from placement through pickup and delivery.",
            icon: ClipboardList,
        },
        {
            title: "Easy Pickup & Delivery",
            description:
                "Get your clothes picked up and delivered to your doorstep with less hassle.",
            icon: Truck,
        },
    ];

    const testimonials = [
        {
            name: "Ananya R.",
            location: "Kozhikode",
            initial: "A",
            review:
                "Finding a good dry cleaner nearby used to take so much time. VeeCleen made it easy to discover and compare local shops.",
        },
        {
            name: "Rahul M.",
            location: "Kozhikode",
            initial: "R",
            review:
                "I liked being able to see what services a shop offers before placing my order. It makes choosing much easier.",
        },
        {
            name: "Meera S.",
            location: "Kozhikode",
            initial: "M",
            review:
                "The pickup and delivery experience makes getting clothes cleaned much more convenient.",
        },
    ];

    return (
        <main className="w-full">

            {/* ================= HERO ================= */}
            {/* ================= HERO ================= */}
            <section className="relative w-full overflow-hidden bg-gradient-to-br from-blue-50 via-white to-blue-50">

                {/* ================= MOBILE HERO ================= */}
                <div
                    className="relative min-h-[760px] w-full bg-cover bg-center bg-no-repeat md:hidden"
                    style={{
                        backgroundImage: "url('/images/home/cleaning-hero-mobile.png')",
                    }}
                >

                    {/* Soft overlay for text readability */}
                    <div className="absolute inset-0 bg-gradient-to-r from-white/95 via-white/75 to-white/10" />

                    {/* Mobile Content */}
                    <div className="relative z-10 flex min-h-[760px] items-start px-6 pb-16 pt-16 sm:px-8">

                        <div className="w-[78%] max-w-[430px]">

                            {/* Heading */}
                            <h1 className="text-5xl font-bold leading-[1.05] tracking-tight text-slate-950">
                                Your Clothes
                                <br />
                                Deserve the
                                <br />
                                <span className="text-blue-600">
                                    Right Care.
                                </span>
                            </h1>


                            {/* Description */}
                            <p className="mt-8 text-lg leading-8 text-slate-600">
                                Discover trusted dry cleaners near you,
                                compare services, and get your clothes
                                professionally cared for.
                            </p>


                            {/* CTA Buttons */}
                            <div className="mt-10 flex flex-col gap-4">

                                <button
                                    type="button"
                                    onClick={() => navigate("/customer/shops")}
                                    className="group flex w-full items-center justify-between rounded-xl bg-blue-600 px-5 py-4 text-base font-medium text-white shadow-md transition hover:bg-blue-700"
                                >
                                    <span>Find Nearby Shops</span>

                                    <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                                </button>


                                <button
                                    type="button"
                                    onClick={() => navigate("/customer/shops")}
                                    className="group flex w-full items-center justify-between rounded-xl border-2 border-blue-600 bg-white/90 px-5 py-4 text-base font-medium text-blue-600 transition hover:bg-blue-50"
                                >
                                    <span>Explore Services</span>

                                    <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                                </button>

                            </div>

                        </div>

                    </div>

                </div>


                {/* ================= DESKTOP HERO ================= */}
                <div className="relative z-10 hidden min-h-[680px] w-full md:grid md:grid-cols-2">

                    {/* LEFT CONTENT */}
                    <div className="relative flex items-center px-16 py-16 lg:px-24">

                        <div className="max-w-xl">

                            {/* Decorative dots */}
                            <div className="mb-10 hidden grid-cols-4 gap-3 md:grid">
                                {Array.from({ length: 12 }).map((_, index) => (
                                    <span
                                        key={index}
                                        className="h-1.5 w-1.5 rounded-full bg-blue-200"
                                    />
                                ))}
                            </div>


                            {/* Heading */}
                            <h1 className="text-5xl font-bold leading-[1.05] tracking-tight text-slate-950 sm:text-6xl lg:text-7xl">
                                Your Clothes
                                <br />
                                Deserve the
                                <br />
                                <span className="text-blue-600">
                                    Right Care.
                                </span>
                            </h1>


                            {/* Description */}
                            <p className="mt-8 max-w-lg text-lg leading-8 text-slate-600 sm:text-xl">
                                Discover trusted dry cleaners near you,
                                compare services, and get your clothes
                                professionally cared for.
                            </p>


                            {/* CTA Buttons */}
                            <div className="mt-10 flex flex-col gap-4 sm:flex-row">

                                <button
                                    type="button"
                                    onClick={() => navigate("/customer/shops")}
                                    className="group flex items-center justify-center gap-8 rounded-xl bg-blue-600 px-7 py-4 text-lg font-medium text-white shadow-md transition hover:bg-blue-700"
                                >
                                    Find Nearby Shops

                                    <ArrowRight className="h-6 w-6 transition-transform group-hover:translate-x-1" />
                                </button>


                                <button
                                    type="button"
                                    onClick={() => navigate("/customer/shops")}
                                    className="group flex items-center justify-center gap-8 rounded-xl border-2 border-blue-600 bg-white px-7 py-4 text-lg font-medium text-blue-600 transition hover:bg-blue-50"
                                >
                                    Explore Services

                                    <ArrowRight className="h-6 w-6 transition-transform group-hover:translate-x-1" />
                                </button>

                            </div>

                        </div>

                    </div>


                    {/* DESKTOP HERO IMAGE */}
                    <div className="relative hidden min-h-full md:block">

                        <img
                            src="/images/home/cleaning-hero.png"
                            alt="Professional dry cleaning"
                            className="absolute inset-0 h-full w-full object-cover"
                        />

                    </div>

                </div>

            </section>


            {/* ================= NEARBY SHOPS ================= */}
            <section
                id="shops"
                className="w-full bg-white px-6 py-20 sm:px-8 lg:px-16"
            >

                <div className="mx-auto max-w-7xl">

                    {/* Section Heading */}
                    <div className="mb-12 text-center">

                        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-blue-600">
                            Nearby Shops
                        </p>

                        <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
                            Find Trusted Cleaners Near You
                        </h2>

                        <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
                            Explore trusted dry cleaning shops and find the right care
                            for your clothes.
                        </p>

                    </div>


                    {/* Shop Cards */}
                    {loadingShops ? (

                        <div className="grid gap-6 md:grid-cols-3">

                            {[1, 2, 3].map((item) => (
                                <div
                                    key={item}
                                    className="h-[360px] animate-pulse rounded-2xl bg-slate-100"
                                />
                            ))}

                        </div>

                    ) : (

                        <div className="mt-16 grid gap-6 md:grid-cols-3">

                            {shops.map((shop) => (

                                <article
                                    key={shop.id}
                                    className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.06)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_14px_40px_rgba(15,23,42,0.10)]"
                                >

                                    {/* Image */}
                                    <div className="h-64 w-full overflow-hidden bg-slate-100">

                                        {shop.image ? (

                                            <img
                                                src={shop.image}
                                                alt={shop.shop_name}
                                                className="h-full w-full object-cover transition duration-300 hover:scale-105"
                                            />

                                        ) : (

                                            <div className="flex h-full items-center justify-center text-sm text-slate-400">
                                                No image available
                                            </div>

                                        )}

                                    </div>


                                    {/* Content */}
                                    <div className="p-6">

                                        <div className="flex items-start justify-between gap-4">

                                            <h3 className="text-xl font-semibold text-slate-950">
                                                {shop.shop_name}
                                            </h3>

                                            <span
                                                className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${shop.is_open
                                                    ? "bg-green-50 text-green-600"
                                                    : "bg-slate-100 text-slate-500"
                                                    }`}
                                            >
                                                {shop.is_open ? "Open" : "Closed"}
                                            </span>

                                        </div>


                                        <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">
                                            {shop.description}
                                        </p>


                                        <div className="mt-4 flex items-center gap-2 text-sm text-slate-500">

                                            <MapPin className="h-4 w-4 text-blue-600" />

                                            <span>
                                                {shop.city}, {shop.district}
                                            </span>

                                        </div>


                                        <button
                                            type="button"
                                            onClick={() =>
                                                navigate(`/customer/shops/${shop.id}`)
                                            }
                                            className="group mt-6 flex w-full items-center justify-center gap-3 rounded-lg border-2 border-blue-600 px-5 py-3.5 font-semibold text-blue-600 transition hover:bg-blue-600 hover:text-white"
                                        >
                                            Explore Shop

                                            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                                        </button>

                                    </div>

                                </article>

                            ))}

                        </div>

                    )}


                    {/* View All Shops */}
                    <div className="mt-10 flex justify-center">

                        <button
                            type="button"
                            onClick={() => navigate("/customer/shops")}
                            className="group flex w-full max-w-xl items-center justify-center gap-3 rounded-lg border-2 border-blue-600 px-6 py-4 font-semibold text-blue-600 transition hover:bg-blue-600 hover:text-white"
                        >
                            View All Shops

                            <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                        </button>

                    </div>

                </div>

            </section>


            {/* ================= OUR SERVICES ================= */}
            <section
                id="services"
                className="relative overflow-hidden bg-[#F8FAFF] px-6 py-20 sm:px-8 lg:px-16"
            >

                <div className="mx-auto max-w-7xl">

                    {/* Section Heading */}
                    <div className="mx-auto max-w-3xl text-center">

                        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-blue-600">
                            Our Services
                        </p>

                        <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
                            Care for Every Garment,
                            <br />
                            Every <span className="text-blue-600">Need.</span>
                        </h2>

                        <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
                            Explore the care services available through trusted
                            professionals on VeeCleen.
                        </p>

                    </div>


                    {/* Services Grid */}
                    <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">

                        {featuredServices.map((service) => {

                            const Icon = service.icon;

                            return (
                                <article
                                    key={service.name}
                                    className="flex min-h-[270px] flex-col items-center justify-center rounded-2xl border border-slate-100 bg-white px-6 py-8 text-center shadow-[0_8px_30px_rgba(15,23,42,0.06)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_14px_40px_rgba(15,23,42,0.10)]"
                                >

                                    {/* Icon */}
                                    <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-blue-50">

                                        <Icon
                                            className="h-12 w-12 text-blue-600"
                                            strokeWidth={1.8}
                                        />

                                    </div>


                                    {/* Service Name */}
                                    <h3 className="mt-5 text-xl font-semibold text-slate-950">
                                        {service.name}
                                    </h3>


                                    {/* Description */}
                                    <p className="mt-3 max-w-xs text-base leading-7 text-slate-600">
                                        {service.description}
                                    </p>

                                </article>
                            );

                        })}

                    </div>


                    {/* View All Services */}
                    <div className="mt-10 flex justify-center">

                        <button
                            type="button"
                            onClick={() => navigate("/customer/services")}
                            className="group flex w-full max-w-xl items-center justify-center gap-3 rounded-lg border-2 border-blue-600 px-6 py-4 font-semibold text-blue-600 transition hover:bg-blue-600 hover:text-white"
                        >
                            View All Services

                            <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                        </button>

                    </div>

                </div>

            </section>


            {/* ================= HOW VEE-CLEEN WORKS ================= */}
            <section
                id="how-it-works"
                className="relative overflow-hidden bg-[#F8FAFF] px-6 py-20 sm:px-8 lg:px-16"
            >

                <div className="mx-auto max-w-7xl">

                    {/* Section Heading */}
                    <div className="mx-auto max-w-4xl text-center">

                        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-blue-600">
                            How VeeCleen Works
                        </p>

                        <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
                            Simple Steps, Spotless Results
                        </h2>

                        <p className="mx-auto mt-6 max-w-3xl text-base leading-7 text-slate-600 sm:text-lg">
                            From finding the right shop to getting your clothes back fresh and clean.
                        </p>

                    </div>


                    {/* Steps */}
                    <div className="mt-14 grid gap-6 lg:grid-cols-4">

                        {/* Step 1 */}
                        <article className="relative flex flex-col items-center rounded-2xl border border-slate-100 bg-white px-6 pb-8 pt-10 text-center shadow-[0_8px_30px_rgba(15,23,42,0.06)]">

                            <div className="absolute -top-6 flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-xl font-semibold text-white shadow-md">
                                1
                            </div>

                            <div className="flex h-52 w-full items-center justify-center">

                                <img
                                    src="/images/home/shop.png"
                                    alt="Find a shop"
                                    className="h-full w-full object-contain"
                                />

                            </div>

                            <h3 className="mt-4 text-xl font-semibold text-slate-950">
                                Find a Shop
                            </h3>

                            <p className="mt-3 max-w-xs text-base leading-7 text-slate-600">
                                Discover open and trusted dry cleaning shops near you.
                            </p>

                        </article>


                        {/* Step 2 */}
                        <article className="relative flex flex-col items-center rounded-2xl border border-slate-100 bg-white px-6 pb-8 pt-10 text-center shadow-[0_8px_30px_rgba(15,23,42,0.06)]">

                            <div className="absolute -top-6 flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-xl font-semibold text-white shadow-md">
                                2
                            </div>

                            <div className="flex h-52 w-full items-center justify-center">

                                <img
                                    src="/images/home/service.png"
                                    alt="Choose services"
                                    className="h-full w-full object-contain"
                                />

                            </div>

                            <h3 className="mt-4 text-xl font-semibold text-slate-950">
                                Choose Services
                            </h3>

                            <p className="mt-3 max-w-xs text-base leading-7 text-slate-600">
                                Explore the shop's available services and select what you need.
                            </p>

                        </article>


                        {/* Step 3 */}
                        <article className="relative flex flex-col items-center rounded-2xl border border-slate-100 bg-white px-6 pb-8 pt-10 text-center shadow-[0_8px_30px_rgba(15,23,42,0.06)]">

                            <div className="absolute -top-6 flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-xl font-semibold text-white shadow-md">
                                3
                            </div>

                            <div className="flex h-52 w-full items-center justify-center">

                                <img
                                    src="/images/home/place_order.png"
                                    alt="Place order"
                                    className="h-full w-full object-contain"
                                />

                            </div>

                            <h3 className="mt-4 text-xl font-semibold text-slate-950">
                                Place Order
                            </h3>

                            <p className="mt-3 max-w-xs text-base leading-7 text-slate-600">
                                Add your garments, provide the required details, and confirm your order securely.
                            </p>

                        </article>


                        {/* Step 4 */}
                        <article className="relative flex flex-col items-center rounded-2xl border border-slate-100 bg-white px-6 pb-8 pt-10 text-center shadow-[0_8px_30px_rgba(15,23,42,0.06)]">

                            <div className="absolute -top-6 flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-xl font-semibold text-white shadow-md">
                                4
                            </div>

                            <div className="flex h-52 w-full items-center justify-center">

                                <img
                                    src="/images/home/pickup and delivery.png"
                                    alt="Pickup and delivery"
                                    className="h-full w-full object-contain"
                                />

                            </div>

                            <h3 className="mt-4 text-xl font-semibold text-slate-950">
                                Pickup & Delivery
                            </h3>

                            <p className="mt-3 max-w-xs text-base leading-7 text-slate-600">
                                Your clothes are picked up, professionally cleaned, and delivered back to you.
                            </p>

                        </article>

                    </div>


                    {/* Promise */}
                    <div className="mx-auto mt-12 flex max-w-4xl flex-col items-center gap-5 rounded-2xl border border-blue-100 bg-white px-6 py-7 text-center shadow-[0_8px_30px_rgba(15,23,42,0.04)] sm:flex-row sm:text-left">

                        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-blue-50">

                            <Sparkles
                                className="h-10 w-10 text-blue-600"
                                strokeWidth={1.8}
                            />

                        </div>

                        <div>

                            <h3 className="text-xl font-semibold text-slate-950">
                                Hassle-free. Reliable. Right at your doorstep.
                            </h3>

                            <p className="mt-2 text-base text-slate-600">
                                That's the VeeCleen promise.
                            </p>

                        </div>

                    </div>

                </div>

            </section>


            {/* ================= WHY CHOOSE VEECLEEN ================= */}
            <section className="bg-[#f7faff] px-6 py-20 md:px-10 lg:px-16">

                <div className="mx-auto max-w-7xl">

                    {/* Section Header */}
                    <div className="mx-auto max-w-5xl text-center">

                        <p className="text-sm font-semibold tracking-[0.22em] text-blue-600 md:text-base">
                            WHY CHOOSE VEECLEEN
                        </p>

                        <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
                            Better Care. More Choice. Less Hassle.
                        </h2>

                        <p className="mx-auto mt-6 max-w-3xl text-base leading-7 text-[#53658b] md:text-lg md:leading-8">
                            VeeCleen makes it easier to find trusted local cleaners,
                            choose the right service, and get your clothes cared for
                            with confidence.
                        </p>

                    </div>


                    {/* Feature Cards */}
                    <div className="mt-12 grid grid-cols-1 gap-6 md:mt-14 md:grid-cols-2 md:gap-7">

                        {whyChooseUs.map((feature) => {

                            const Icon = feature.icon;

                            return (
                                <div
                                    key={feature.title}
                                    className="flex min-h-[220px] items-center gap-7 rounded-[28px] bg-white px-7 py-8 shadow-[0_8px_30px_rgba(30,64,175,0.08)] md:min-h-[250px] md:px-9 lg:gap-10 lg:px-10"
                                >

                                    {/* Icon */}
                                    <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-[26px] bg-[#eef5ff] md:h-32 md:w-32">

                                        <Icon
                                            size={66}
                                            strokeWidth={1.8}
                                            className="text-blue-600"
                                        />

                                    </div>


                                    {/* Content */}
                                    <div>

                                        <h3 className="text-xl font-bold leading-tight text-[#07133f] md:text-2xl">
                                            {feature.title}
                                        </h3>

                                        <p className="mt-4 text-base leading-7 text-[#53658b] md:text-lg md:leading-8">
                                            {feature.description}
                                        </p>

                                    </div>

                                </div>
                            );

                        })}

                    </div>

                </div>

            </section>


            {/* ================= TESTIMONIALS ================= */}
            <section className="bg-[#f7faff] px-6 py-20 md:px-10 lg:px-16">

                <div className="mx-auto max-w-7xl">

                    {/* Section Header */}
                    <div className="mx-auto max-w-6xl text-center">

                        <p className="text-sm font-semibold tracking-[0.22em] text-blue-600 md:text-base">
                            WHAT OUR CUSTOMERS SAY
                        </p>

                        <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
                            Trusted by People Who Care About Their Clothes.
                        </h2>

                        <p className="mx-auto mt-6 max-w-3xl text-base leading-7 text-[#53658b] md:text-lg md:leading-8">
                            See why customers choose VeeCleen for reliable garment care
                            and a simpler cleaning experience.
                        </p>

                    </div>


                    {/* Testimonial Cards */}
                    <div className="mt-12 grid grid-cols-1 gap-6 md:mt-14 md:grid-cols-3 md:gap-7">

                        {testimonials.map((testimonial) => (

                            <div
                                key={testimonial.name}
                                className="flex min-h-[390px] flex-col rounded-[28px] bg-white px-8 py-9 shadow-[0_8px_30px_rgba(30,64,175,0.08)] md:px-9"
                            >

                                {/* Rating */}
                                <div className="flex gap-2 text-blue-600">

                                    {[1, 2, 3, 4, 5].map((star) => (

                                        <Star
                                            key={star}
                                            size={27}
                                            fill="currentColor"
                                            strokeWidth={1.5}
                                        />

                                    ))}

                                </div>


                                {/* Review */}
                                <p className="mt-7 text-lg leading-9 text-[#07133f] md:text-xl md:leading-9">
                                    “{testimonial.review}”
                                </p>


                                {/* Customer */}
                                <div className="mt-auto flex items-center gap-4 pt-8">

                                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[#eaf2ff] text-2xl font-semibold text-[#07133f]">
                                        {testimonial.initial}
                                    </div>

                                    <div>

                                        <h3 className="text-xl font-bold text-[#07133f]">
                                            {testimonial.name}
                                        </h3>

                                        <div className="mt-1 flex items-center gap-2 text-base text-[#65759a]">

                                            <MapPin
                                                size={19}
                                                fill="currentColor"
                                                strokeWidth={1.5}
                                            />

                                            <span>
                                                {testimonial.location}
                                            </span>

                                        </div>

                                    </div>

                                </div>

                            </div>

                        ))}

                    </div>

                </div>

            </section>


            {/* ================= FINAL CTA ================= */}
            <section
                className="relative overflow-hidden bg-[#f7faff] bg-cover bg-center bg-no-repeat px-6 py-24 md:px-10 lg:px-16"
                style={{
                    backgroundImage: "url('/images/home/cta.png')",
                }}
            >

                {/* Decorative top-left dots */}
                <div className="absolute left-8 top-8 grid grid-cols-4 gap-4 opacity-70 md:left-10 md:top-10">

                    {Array.from({ length: 16 }).map((_, index) => (

                        <span
                            key={index}
                            className="h-2.5 w-2.5 rounded-full bg-blue-100"
                        />

                    ))}

                </div>


                {/* Decorative top-right circle */}
                <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full border-[24px] border-blue-100/70 md:h-72 md:w-72" />


                {/* Decorative bottom-left circle */}
                <div className="absolute -bottom-28 -left-20 h-64 w-64 rounded-full border-[24px] border-blue-100/70 md:h-80 md:w-80" />


                {/* Decorative bottom-right dots */}
                <div className="absolute bottom-10 right-8 grid grid-cols-4 gap-4 opacity-70 md:right-10">

                    {Array.from({ length: 16 }).map((_, index) => (

                        <span
                            key={index}
                            className="h-2.5 w-2.5 rounded-full bg-blue-100"
                        />

                    ))}

                </div>


                {/* Content */}
                <div className="relative z-10 text-center">

                    <p className="mb-6 text-sm font-semibold uppercase tracking-[0.28em] text-blue-600 md:text-base">
                        Ready When You Are
                    </p>

                    <h2 className="mx-auto max-w-4xl text-4xl font-bold leading-tight tracking-tight text-[#07164d] md:text-5xl lg:text-6xl">
                        Give Your Clothes the{" "}
                        <span className="text-blue-600">
                            Right Care.
                        </span>
                    </h2>

                    <p className="mx-auto mt-7 max-w-2xl text-lg leading-8 text-[#50658a] md:text-xl">
                        Find trusted dry cleaning shops near you, choose the services you
                        need, and place your order with confidence.
                    </p>

                    {/* Buttons */}
                    <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:justify-center">

                        <button
                            type="button"
                            onClick={() => navigate("/customer/shops")}
                            className="flex min-h-[64px] items-center justify-center gap-5 rounded-xl bg-blue-600 px-8 text-lg font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700"
                        >
                            <span>Find Nearby Shops</span>
                            <span className="text-3xl leading-none">→</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => navigate("/customer/shops")}
                            className="flex min-h-[64px] items-center justify-center gap-5 rounded-xl border-2 border-blue-600 bg-white px-8 text-lg font-semibold text-blue-600 transition hover:bg-blue-50"
                        >
                            <span>Explore Services</span>
                            <span className="text-3xl leading-none">→</span>
                        </button>

                    </div>

                </div>

            </section>


            {/* ================= MAIN FOOTER ================= */}
            <footer className="relative overflow-hidden border-t border-blue-100 bg-[#f7faff] px-6 py-16 md:px-10 lg:px-16 lg:py-20">

                {/* Decorative top-right circle */}
                <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full border-[24px] border-blue-100/70 md:h-80 md:w-80" />


                {/* Decorative bottom-left dots */}
                <div className="absolute bottom-8 left-8 grid grid-cols-4 gap-4 opacity-70 md:left-10">

                    {Array.from({ length: 16 }).map((_, index) => (

                        <span
                            key={index}
                            className="h-2.5 w-2.5 rounded-full bg-blue-100"
                        />

                    ))}

                </div>


                {/* Decorative bottom-right circle */}
                <div className="absolute -bottom-28 -right-20 h-64 w-64 rounded-full border-[24px] border-blue-100/70 md:h-80 md:w-80" />


                <div className="relative mx-auto max-w-7xl">

                    {/* Main footer content */}
                    <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-4 lg:gap-10">

                        {/* Brand */}
                        <div className="lg:pr-8">

                            <img
                                src="/images/branding/veecleen-logo.png"
                                alt="VeeCleen Dry Cleaning"
                                className="h-auto w-48 object-contain"
                            />

                            <p className="mt-6 max-w-xs text-base leading-7 text-[#50658a]">
                                Better care for your clothes.
                                <br />
                                More choice for you.
                            </p>

                        </div>


                        {/* Quick Links */}
                        <div>

                            <h3 className="mb-6 text-sm font-semibold uppercase tracking-[0.22em] text-blue-600">
                                Quick Links
                            </h3>

                            <nav className="space-y-4">

                                <a
                                    href="#"
                                    className="group flex items-center gap-3 text-base text-[#07164d] transition hover:text-blue-600"
                                >
                                    <span className="text-xl text-blue-600 transition-transform group-hover:translate-x-1">
                                        ›
                                    </span>
                                    Home
                                </a>

                                <a
                                    href="#services"
                                    className="group flex items-center gap-3 text-base text-[#07164d] transition hover:text-blue-600"
                                >
                                    <span className="text-xl text-blue-600 transition-transform group-hover:translate-x-1">
                                        ›
                                    </span>
                                    Services
                                </a>

                                <a
                                    href="#shops"
                                    className="group flex items-center gap-3 text-base text-[#07164d] transition hover:text-blue-600"
                                >
                                    <span className="text-xl text-blue-600 transition-transform group-hover:translate-x-1">
                                        ›
                                    </span>
                                    Shops
                                </a>

                                <a
                                    href="#how-it-works"
                                    className="group flex items-center gap-3 text-base text-[#07164d] transition hover:text-blue-600"
                                >
                                    <span className="text-xl text-blue-600 transition-transform group-hover:translate-x-1">
                                        ›
                                    </span>
                                    How It Works
                                </a>

                                <a
                                    href="/customer/orders"
                                    className="group flex items-center gap-3 text-base text-[#07164d] transition hover:text-blue-600"
                                >
                                    <span className="text-xl text-blue-600 transition-transform group-hover:translate-x-1">
                                        ›
                                    </span>
                                    Orders
                                </a>

                            </nav>

                        </div>


                        {/* Customer */}
                        <div>

                            <h3 className="mb-6 text-sm font-semibold uppercase tracking-[0.22em] text-blue-600">
                                Customer
                            </h3>

                            <nav className="space-y-4">

                                <a
                                    href="/customer/shops"
                                    className="group flex items-center gap-3 text-base text-[#07164d] transition hover:text-blue-600"
                                >
                                    <span className="text-xl text-blue-600 transition-transform group-hover:translate-x-1">
                                        ›
                                    </span>
                                    Find Nearby Shops
                                </a>

                                <a
                                    href="#services"
                                    className="group flex items-center gap-3 text-base text-[#07164d] transition hover:text-blue-600"
                                >
                                    <span className="text-xl text-blue-600 transition-transform group-hover:translate-x-1">
                                        ›
                                    </span>
                                    View All Services
                                </a>

                                <a
                                    href="/customer/orders"
                                    className="group flex items-center gap-3 text-base text-[#07164d] transition hover:text-blue-600"
                                >
                                    <span className="text-xl text-blue-600 transition-transform group-hover:translate-x-1">
                                        ›
                                    </span>
                                    Track Your Order
                                </a>

                            </nav>

                        </div>


                        {/* Support */}
                        <div>

                            <h3 className="mb-6 text-sm font-semibold uppercase tracking-[0.22em] text-blue-600">
                                Support
                            </h3>

                            <nav className="space-y-4">

                                <a
                                    href="/help"
                                    className="group flex items-center gap-3 text-base text-[#07164d] transition hover:text-blue-600"
                                >
                                    <span className="text-xl text-blue-600 transition-transform group-hover:translate-x-1">
                                        ›
                                    </span>
                                    Help & Support
                                </a>

                                <a
                                    href="/contact"
                                    className="group flex items-center gap-3 text-base text-[#07164d] transition hover:text-blue-600"
                                >
                                    <span className="text-xl text-blue-600 transition-transform group-hover:translate-x-1">
                                        ›
                                    </span>
                                    Contact Us
                                </a>

                            </nav>

                        </div>

                    </div>

                </div>

            </footer>

        </main>
    );
}

export default Home;