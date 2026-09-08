import { Link } from "react-router-dom";
import { MapPin, ArrowRight } from "lucide-react";
import {
    Card,
    CardContent,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";


type ShopCardProps = {
    id: number;
    shop_name: string;
    city: string;
    district: string;
};


function ShopCard({ id, shop_name, city, district }: ShopCardProps) {

    return (
        <Card className="group overflow-hidden transition-all duration-200 hover:-translate-y-1 hover:shadow-lg">

            {/* Shop image placeholder */}
            <div className="flex h-40 items-center justify-center bg-muted">
                <span className="text-sm text-muted-foreground">
                    Shop Image
                </span>
            </div>

            <CardHeader className="pb-3">
                <CardTitle className="text-lg">
                    {shop_name}
                </CardTitle>
            </CardHeader>

            <CardContent className="space-y-2">

                {/* City */}
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4 shrink-0" />
                    <span>
                        {city}, {district}
                    </span>
                </div>

            </CardContent>

            <CardFooter>
                <Link
                    to={`/customer/shops/${id}`}
                    className="w-full"
                >
                    <Button className="w-full">
                        View Shop
                        <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </Button>
                </Link>
            </CardFooter>

        </Card>
    );
}


export default ShopCard;