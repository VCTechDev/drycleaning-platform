import { useEffect, useState } from "react";

import { getShops } from "../../services/shopService";
import type { Shop } from "../../types/shop";
import ShopCard from "../../components/shop/ShopCard";


function ShopList() {

    const [shops, setShops] = useState<Shop[]>([]);

    useEffect(() => {
        const fetchShops = async () => {
            try {
                const data = await getShops();
                console.log(data);
                setShops(data)
            }
            catch (error) {
                console.error(error);
            }
        };

        fetchShops();
    }, []);

    return (
        <>
            <h1>Shop List</h1>
            {shops.map((shop) => (
                <ShopCard key={shop.id}
                    id={shop.id}
                    shop_name={shop.shop_name}
                    city={shop.city}
                    district={shop.district}
                />
            ))}
        </>
    );
}


export default ShopList;