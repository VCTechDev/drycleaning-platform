import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Link } from "react-router-dom";

import { getOrderDetail } from "../../services/orderService";

interface Order {
    order_number: string;
    note: string;
    pickup_address_line: string;
    pickup_city: string;
    pickup_district: string;
    pickup_state: string;
    pickup_pincode: string;
    total_amount: string;
    order_status: string;
    payment_status: string;
    created_at: string;
    items: OrderItem[];
}

interface OrderItem {
    garment: string;
    service: string;
    quantity: number;
    unit_price: string;
    line_total: string;
}

function OrderDetail() {
    const { id } = useParams();

    const [order, setOrder] = useState<Order | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchOrder = async () => {
            try {
                if (!id) return;

                const data = await getOrderDetail(id);

                setOrder(data);
            } catch (error) {
                console.error("FAILED TO FETCH ORDER:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchOrder();
    }, [id]);

    if (loading) {
        return <h2>Loading order...</h2>;
    }

    if (!order) {
        return <h2>Order not found.</h2>;
    }

    return (
        <>
            <h1>Order {order.order_number}</h1>

            <p>Status: {order.order_status}</p>

            <p>Payment: {order.payment_status}</p>

            <hr />
            <Link to={`/customer/orders/${id}/tracking`}>
                <button>Track Order</button>
            </Link>

            <h2>Items</h2>

            {order.items.map((item, index) => (
                <div key={index}>
                    <h3>{item.service}</h3>

                    <p>Garment: {item.garment}</p>

                    <p>Quantity: {item.quantity}</p>

                    <p>
                        Unit Price: ₹{item.unit_price}
                    </p>

                    <p>
                        Total: ₹{item.line_total}
                    </p>

                    <hr />
                </div>
            ))}

            <h2>Pickup Address</h2>

            <p>{order.pickup_address_line}</p>
            <p>{order.pickup_city}</p>
            <p>{order.pickup_district}</p>
            <p>{order.pickup_state}</p>
            <p>{order.pickup_pincode}</p>

            {order.note && (
                <>
                    <h3>Note</h3>
                    <p>{order.note}</p>
                </>
            )}

            <h2>Total: ₹{order.total_amount}</h2>
        </>
    );
}

export default OrderDetail;