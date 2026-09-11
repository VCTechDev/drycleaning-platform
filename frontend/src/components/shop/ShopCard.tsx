import { Link } from "react-router-dom";
import { ArrowRight, Clock3, MapPin } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type ShopCardProps = {
    id: number;
    shop_name: string;
    city: string;
    district: string;
    address_line?: string;
    image: string | null;
    opening_time: string;
    closing_time: string;
    is_open: boolean;
    starting_price: string | null;
};

function formatTime(time: string) {
    if (!time) {
        return "";
    }

    const [hours, minutes] = time.split(":");

    const date = new Date();
    date.setHours(Number(hours), Number(minutes), 0, 0);

    return date.toLocaleTimeString("en-IN", {
        hour: "numeric",
        minute: "2-digit",
    });
}

function ShopCard({
    id,
    shop_name,
    city,
    district,
    address_line,
    image,
    opening_time,
    closing_time,
    is_open,
    starting_price,
}: ShopCardProps) {
    const location = address_line
        ? `${address_line}, ${city}, ${district}`
        : `${city}, ${district}`;

    return (
        <Card
            className={`group overflow-hidden rounded-[22px] border border-[#E3E8F2] bg-white p-2.5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
                !is_open ? "opacity-80" : ""
            }`}
        >
            {/* Image */}
            <Link
                to={`/customer/shops/${id}`}
                className="block overflow-hidden rounded-[17px]"
            >
                <div className="relative aspect-[16/9] overflow-hidden bg-[#EEF3F9]">
                    {image ? (
                        <img
                            src={image}
                            alt={shop_name}
                            className={`h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.025] ${
                                !is_open ? "grayscale-[12%]" : ""
                            }`}
                        />
                    ) : (
                        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                            No shop image
                        </div>
                    )}

                    {/* Status badge */}
                    <span
                        className={`absolute right-3 top-3 rounded-full px-3 py-1 text-xs font-semibold shadow-sm ${
                            is_open
                                ? "bg-[#DDF8E7] text-[#119447]"
                                : "bg-[#FFE1E1] text-[#D92D20]"
                        }`}
                    >
                        {is_open ? "Open" : "Closed"}
                    </span>
                </div>
            </Link>

            {/* Card content */}
            <div className="px-1.5 pb-1 pt-3">
                {/* Name + Price */}
                <div className="flex items-start justify-between gap-3">
                    <Link
                        to={`/customer/shops/${id}`}
                        className="min-w-0"
                    >
                        <h3 className="font-heading text-lg font-semibold leading-6 tracking-tight text-[#111B50] sm:text-xl">
                            {shop_name}
                        </h3>
                    </Link>

                    <div className="shrink-0 rounded-xl bg-[#EDF6FF] px-3 py-2">
                        <p className="text-[11px] leading-4 text-[#60708F]">
                            Services from
                        </p>

                        <p className="text-base font-bold leading-5 text-[#087CEB]">
                            {starting_price
                                ? `₹${Number(starting_price).toFixed(0)}`
                                : "—"}
                        </p>
                    </div>
                </div>

                {/* Location */}
                <div className="mt-2 flex min-w-0 items-center gap-2 text-sm text-[#596989]">
                    <MapPin className="h-4 w-4 shrink-0 text-[#16265D]" />

                    <span className="truncate">
                        {location}
                    </span>
                </div>

                {/* Opening status */}
                <div className="mt-2 flex items-center gap-2 text-sm">
                    {/* <span
                        className={`rounded-full px-2.5 py-0.5 font-medium ${
                            is_open
                                ? "bg-[#DDF8E7] text-[#119447]"
                                : "bg-[#FFE1E1] text-[#D92D20]"
                        }`}
                    >
                        {is_open ? "Open" : "Closed"}
                    </span>

                    <span className="text-[#7B88A4]">
                        •
                    </span> */}

                    <Clock3 className="h-3.5 w-3.5 text-[#596989]" />

                    <span className="truncate text-[#596989]">
                        {is_open
                            ? `Closes ${formatTime(closing_time)}`
                            : `Opens ${formatTime(opening_time)}`}
                    </span>
                </div>

                {/* CTA */}
                <Link
                    to={`/customer/shops/${id}`}
                    className="mt-3 block"
                >
                    <Button className="h-10 w-full rounded-xl bg-[#087CC1] text-sm font-medium hover:bg-[#0870AE] sm:h-11 sm:text-base">
                        View Shop
                        <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                    </Button>
                </Link>
            </div>
        </Card>
    );
}

export default ShopCard;