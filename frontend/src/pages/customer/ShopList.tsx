import { useEffect, useState } from "react";
import { MapPin, Search, Store } from "lucide-react";

import { getShops } from "../../services/shopService";
import type { Shop } from "../../types/shop";
import ShopCard from "../../components/shop/ShopCard";

import { Input } from "@/components/ui/input";


function ShopList() {

    const [shops, setShops] = useState<Shop[]>([]);

    useEffect(() => {
        const fetchShops = async () => {
            try {
                const data = await getShops();

                console.log(data);

                setShops(data);
            }
            catch (error) {
                console.error(error);
            }
        };

        fetchShops();
    }, []);


    return (
        <div className="space-y-8">

            {/* ================= HERO SECTION ================= */}
            <section className="rounded-3xl bg-primary px-6 py-10 text-primary-foreground sm:px-10">

                <div className="max-w-2xl">

                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-foreground/15">
                        <Store className="h-6 w-6" />
                    </div>

                    <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
                        Find a cleaner near you
                    </h1>

                    <p className="mt-3 max-w-xl text-primary-foreground/80">
                        Discover trusted dry cleaning services nearby and
                        schedule a convenient pickup for your clothes.
                    </p>

                </div>

            </section>


            {/* ================= SEARCH SECTION ================= */}
            <section className="space-y-3">

                <h2 className="font-heading text-xl font-semibold">
                    Nearby cleaners
                </h2>

                <div className="relative max-w-xl">

                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

                    <Input
                        placeholder="Search by shop name or location..."
                        className="pl-9"
                    />

                </div>

            </section>


            {/* ================= SHOP LIST ================= */}
            <section>

                {shops.length === 0 ? (

                    <div className="rounded-2xl border border-dashed p-10 text-center">

                        <MapPin className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />

                        <h3 className="font-heading text-lg font-semibold">
                            No cleaners found
                        </h3>

                        <p className="mt-1 text-sm text-muted-foreground">
                            There are currently no available cleaners in your
                            area.
                        </p>

                    </div>

                ) : (

                    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">

                        {shops.map((shop) => (
                            <ShopCard
                                key={shop.id}
                                id={shop.id}
                                shop_name={shop.shop_name}
                                city={shop.city}
                                district={shop.district}
                            />
                        ))}

                    </div>

                )}

            </section>

        </div>
    );
}


export default ShopList;