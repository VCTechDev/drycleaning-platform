import { useEffect, useState } from "react";

import { getMyOrders } from "../../services/orderService";
import { Link } from "react-router-dom";

interface Order {
    id: number;
    order_number: string;
    shop: number;
    total_amount: string;
    order_status: string;
    payment_status: string;
    created_at: string;
}

function MyOrders() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchOrders = async () => {
            try {
                const data = await getMyOrders();
                setOrders(data);
            } catch (error) {
                console.error("FAILED TO FETCH ORDERS:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchOrders();
    }, []);

    if (loading) {
        return <h2>Loading orders...</h2>;
    }

    return (
        <>
            <h1>My Orders</h1>

            {orders.length === 0 ? (
                <p>You haven't placed any orders yet.</p>
            ) : (
                orders.map((order) => (
                    <div key={order.id}>
                        <h3>{order.order_number}</h3>

                        <p>Shop ID: {order.shop}</p>

                        <p>Total: ₹{order.total_amount}</p>

                        <p>Status: {order.order_status}</p>

                        <p>Payment: {order.payment_status}</p>

                        <Link to={`/customer/orders/${order.id}`}>
                            <button>View Order</button>
                        </Link>

                        <p>
                            Created:{" "}
                            {new Date(order.created_at).toLocaleDateString()}
                        </p>

                        <hr />
                    </div>
                ))
            )}
        </>
    );
}

export default MyOrders;