import { useEffect, useState } from "react";
import {
    Check,
    ChevronDown,
    ListFilter,
    Search,
    X,
} from "lucide-react";

import {
    getShopFilterOptions,
    getShops,
} from "../../services/shopService";

import type { Shop } from "../../types/shop";

import ShopCard from "../../components/shop/ShopCard";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";

type SortOption = "recommended" | "name" | "price";

type DistrictOption = {
    value: string;
    label: string;
};

type ServiceOption = {
    id: number;
    service_name: string;
};

function ShopList() {
    const [shops, setShops] = useState<Shop[]>([]);
    const [loading, setLoading] = useState(true);

    // Search
    const [search, setSearch] = useState("");

    // Applied filters
    const [openNow, setOpenNow] = useState(false);
    const [district, setDistrict] = useState("");
    const [service, setService] = useState("");

    // Backend filter options
    const [districts, setDistricts] = useState<
        DistrictOption[]
    >([]);

    const [services, setServices] = useState<
        ServiceOption[]
    >([]);

    // Filter sheet
    const [filterOpen, setFilterOpen] = useState(false);

    // Temporary filter values
    const [draftOpenNow, setDraftOpenNow] = useState(false);
    const [draftDistrict, setDraftDistrict] = useState("");
    const [draftService, setDraftService] = useState("");

    // Sorting
    const [sort, setSort] =
        useState<SortOption>("recommended");

    /*
     * Fetch districts and services
     * from the backend.
     */
    useEffect(() => {
        const fetchFilterOptions = async () => {
            try {
                const data = await getShopFilterOptions();

                setDistricts(data.districts);
                setServices(data.services);
            } catch (error) {
                console.error(
                    "Failed to fetch shop filter options:",
                    error
                );
            }
        };

        fetchFilterOptions();
    }, []);

    /*
     * Fetch shops whenever search,
     * filters, or sorting changes.
     */
    useEffect(() => {
        const timer = setTimeout(async () => {
            try {
                setLoading(true);

                const data = await getShops({
                    search: search || undefined,
                    open_now: openNow || undefined,
                    district: district || undefined,
                    service: service
                        ? Number(service)
                        : undefined,
                    sort:
                        sort === "recommended"
                            ? undefined
                            : sort,
                });

                setShops(data);
            } catch (error) {
                console.error(
                    "Failed to fetch shops:",
                    error
                );

                setShops([]);
            } finally {
                setLoading(false);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [
        search,
        openNow,
        district,
        service,
        sort,
    ]);

    /*
     * Open filter sheet with
     * current applied values.
     */
    const openFilters = () => {
        setDraftOpenNow(openNow);
        setDraftDistrict(district);
        setDraftService(service);

        setFilterOpen(true);
    };

    /*
     * Apply temporary filters.
     */
    const applyFilters = () => {
        setOpenNow(draftOpenNow);
        setDistrict(draftDistrict);
        setService(draftService);

        setFilterOpen(false);
    };

    /*
     * Reset filters.
     */
    const clearFilters = () => {
        setOpenNow(false);
        setDistrict("");
        setService("");

        setDraftOpenNow(false);
        setDraftDistrict("");
        setDraftService("");
    };

    const clearSearch = () => {
        setSearch("");
    };

    const hasFilters = Boolean(
        openNow || district || service
    );

    return (
        <div className="min-h-full bg-[#F5F9FF]">
            <div className="mx-auto w-full max-w-7xl px-4 pb-16 pt-7 sm:px-6 sm:pt-8 lg:px-8 lg:pb-20 lg:pt-9">

                <section>
                    <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-2 lg:grid-cols-[minmax(0,1fr)_145px_265px] lg:gap-3">

                        {/* Search */}
                        <div className="relative min-w-0">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#16265D] sm:left-4 sm:h-5 sm:w-5" />

                            <Input
                                value={search}
                                onChange={(event) =>
                                    setSearch(event.target.value)
                                }
                                placeholder="Search shops"
                                className="h-11 rounded-xl border-[#D8E4F5] bg-white pl-9 pr-8 text-sm shadow-sm placeholder:text-[#647092] focus-visible:ring-primary sm:h-[52px] sm:pl-12 sm:text-base"
                            />

                            {search && (
                                <button
                                    type="button"
                                    onClick={clearSearch}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#647092] hover:text-[#10194A]"
                                    aria-label="Clear search"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            )}
                        </div>

                        {/* Filters */}
                        <Button
                            type="button"
                            variant="outline"
                            onClick={openFilters}
                            className="h-11 rounded-xl border-[#D8E4F5] bg-white px-3 text-sm text-[#10194A] shadow-sm hover:bg-[#EDF5FF] sm:h-[52px] sm:px-4"
                        >
                            <ListFilter className="h-4 w-4 sm:mr-2" />

                            <span className="hidden sm:inline">
                                Filters
                            </span>
                        </Button>

                        {/* Sort */}
                        <div className="relative w-[118px] sm:w-[180px] lg:w-auto">
                            <select
                                value={sort}
                                onChange={(event) =>
                                    setSort(
                                        event.target.value as SortOption
                                    )
                                }
                                className="h-11 w-full appearance-none rounded-xl border border-[#D8E4F5] bg-white px-3 pr-8 text-xs font-medium text-[#10194A] shadow-sm outline-none focus:ring-2 focus:ring-primary sm:h-[52px] sm:px-4 sm:pr-10 sm:text-sm"
                            >
                                <option value="recommended">
                                    Recommended
                                </option>

                                <option value="name">
                                    Shop name
                                </option>

                                <option value="price">
                                    Lowest price
                                </option>
                            </select>

                            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#10194A] sm:right-4" />
                        </div>
                    </div>

                    {/* Active filters */}
                    {hasFilters && (
                        <div className="mt-3 flex items-center justify-end">
                            <button
                                type="button"
                                onClick={clearFilters}
                                className="text-sm font-medium text-primary hover:underline"
                            >
                                Clear filters
                            </button>
                        </div>
                    )}
                </section>


                {/* Results heading */}
                {/* <section className="mt-6 flex items-end justify-between gap-4 sm:mt-7">
                    <h2 className="font-heading text-2xl font-semibold tracking-tight text-[#10194A] sm:text-[26px]">
                        Shops
                    </h2>

                    {!loading && (
                        <p className="text-sm text-[#647092] sm:text-base">
                            {shops.length}{" "}
                            {shops.length === 1
                                ? "shop"
                                : "shops"}
                        </p>
                    )}
                </section> */}

                {/* Loading */}
                {loading && (
                    <section className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {Array.from({ length: 6 }).map(
                            (_, index) => (
                                <div
                                    key={index}
                                    className="overflow-hidden rounded-[22px] border border-[#E3E8F2] bg-white p-2.5 shadow-sm"
                                >
                                    <div className="aspect-[16/9] animate-pulse rounded-[17px] bg-[#E9EFF7]" />

                                    <div className="space-y-3 px-1.5 pb-2 pt-4">
                                        <div className="h-6 w-3/5 animate-pulse rounded bg-[#E9EFF7]" />

                                        <div className="h-4 w-4/5 animate-pulse rounded bg-[#E9EFF7]" />

                                        <div className="h-5 w-2/5 animate-pulse rounded bg-[#E9EFF7]" />

                                        <div className="h-10 w-full animate-pulse rounded-xl bg-[#E9EFF7]" />
                                    </div>
                                </div>
                            )
                        )}
                    </section>
                )}

                {/* Empty state */}
                {!loading && shops.length === 0 && (
                    <section className="mt-5 rounded-[22px] border border-dashed border-[#C9D8EC] bg-white px-6 py-14 text-center shadow-sm">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#EDF5FF]">
                            <Search className="h-5 w-5 text-primary" />
                        </div>

                        <h3 className="mt-4 font-heading text-xl font-semibold text-[#10194A]">
                            No shops found
                        </h3>

                        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#647092]">
                            Try changing your search or filters
                            to find available dry-cleaning shops.
                        </p>

                        {(hasFilters || search) && (
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                    clearFilters();
                                    clearSearch();
                                }}
                                className="mt-5 rounded-xl"
                            >
                                Clear search and filters
                            </Button>
                        )}
                    </section>
                )}

                {/* Shop grid */}
                {!loading && shops.length > 0 && (
                    <section className="mt-15 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {shops.map((shop) => (
                            <ShopCard
                                key={shop.id}
                                id={shop.id}
                                shop_name={shop.shop_name}
                                city={shop.city}
                                district={shop.district}
                                address_line={
                                    shop.address_line
                                }
                                image={shop.image}
                                opening_time={
                                    shop.opening_time
                                }
                                closing_time={
                                    shop.closing_time
                                }
                                is_open={shop.is_open}
                                starting_price={
                                    shop.starting_price
                                }
                            />
                        ))}
                    </section>
                )}
            </div>

            {/* Filter Sheet */}
            <Sheet
                open={filterOpen}
                onOpenChange={setFilterOpen}
            >
                <SheetContent
                    side="right"
                    className="w-full sm:max-w-md"
                >
                    <SheetHeader>
                        <SheetTitle className="font-heading text-xl text-[#10194A]">
                            Filters
                        </SheetTitle>

                        <SheetDescription>
                            Narrow down shops based on
                            availability, district, and service.
                        </SheetDescription>
                    </SheetHeader>

                    <div className="space-y-7 px-4 py-6">

                        {/* Availability */}
                        <div>
                            <p className="mb-3 text-sm font-semibold text-[#10194A]">
                                Availability
                            </p>

                            <button
                                type="button"
                                onClick={() =>
                                    setDraftOpenNow(
                                        (current) =>
                                            !current
                                    )
                                }
                                className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left text-sm transition-colors ${draftOpenNow
                                        ? "border-primary bg-[#EDF5FF] text-primary"
                                        : "border-border bg-white text-foreground"
                                    }`}
                            >
                                <span>
                                    Open now
                                </span>

                                {draftOpenNow && (
                                    <Check className="h-4 w-4" />
                                )}
                            </button>
                        </div>

                        {/* District */}
                        <div>
                            <label
                                htmlFor="district-filter"
                                className="mb-3 block text-sm font-semibold text-[#10194A]"
                            >
                                District
                            </label>

                            <div className="relative">
                                <select
                                    id="district-filter"
                                    value={draftDistrict}
                                    onChange={(event) =>
                                        setDraftDistrict(
                                            event.target.value
                                        )
                                    }
                                    className="h-11 w-full appearance-none rounded-xl border border-input bg-white px-4 pr-10 text-sm outline-none focus:ring-2 focus:ring-primary"
                                >
                                    <option value="">
                                        All districts
                                    </option>

                                    {districts.map(
                                        (item) => (
                                            <option
                                                key={
                                                    item.value
                                                }
                                                value={
                                                    item.value
                                                }
                                            >
                                                {item.label}
                                            </option>
                                        )
                                    )}
                                </select>

                                <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2" />
                            </div>
                        </div>

                        {/* Service */}
                        <div>
                            <label
                                htmlFor="service-filter"
                                className="mb-3 block text-sm font-semibold text-[#10194A]"
                            >
                                Service availability
                            </label>

                            <div className="relative">
                                <select
                                    id="service-filter"
                                    value={draftService}
                                    onChange={(event) =>
                                        setDraftService(
                                            event.target.value
                                        )
                                    }
                                    className="h-11 w-full appearance-none rounded-xl border border-input bg-white px-4 pr-10 text-sm outline-none focus:ring-2 focus:ring-primary"
                                >
                                    <option value="">
                                        All services
                                    </option>

                                    {services.map(
                                        (item) => (
                                            <option
                                                key={item.id}
                                                value={item.id}
                                            >
                                                {
                                                    item.service_name
                                                }
                                            </option>
                                        )
                                    )}
                                </select>

                                <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2" />
                            </div>
                        </div>
                    </div>

                    <SheetFooter className="border-t bg-white px-4 py-4">
                        <div className="flex w-full gap-3">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                    setDraftOpenNow(false);
                                    setDraftDistrict("");
                                    setDraftService("");
                                }}
                                className="flex-1 rounded-xl"
                            >
                                Reset
                            </Button>

                            <Button
                                type="button"
                                onClick={applyFilters}
                                className="flex-1 rounded-xl"
                            >
                                Apply filters
                            </Button>
                        </div>
                    </SheetFooter>
                </SheetContent>
            </Sheet>
        </div>
    );
}

export default ShopList;