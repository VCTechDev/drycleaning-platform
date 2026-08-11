import { Link } from "react-router-dom";



type ShopCardProps = {
    id: number;
    shop_name: string;
    city: string;
    district: string;
};


function ShopCard({ id, shop_name, city, district }: ShopCardProps) {

    return (
        <div
            style={{
                border: "1px solid #ccc",
                padding: "16px",
                marginBottom: "16px",
                borderRadius: "8px",
            }}
        >
            <h2>{shop_name}</h2>

            <p>City: {city}</p>

            <p>District: {district}</p>

            <Link to={`/customer/shops/${id}`}> <button>View Shop</button> </Link>
        </div>
    );
}


export default ShopCard;