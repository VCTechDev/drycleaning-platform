import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import { getOrderTracking } from "../../services/orderService";

interface TrackingItem {
    status: string;
    completed: boolean;
}

interface TrackingData {
    order_number: string;
    order_status: string;
    tracking: TrackingItem[];
}

function OrderTracking() {
    const { id } = useParams();

    const [tracking, setTracking] = useState<TrackingData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchTracking = async () => {
            try {
                if (!id) return;

                const data = await getOrderTracking(id);

                setTracking(data);
            } catch (error) {
                console.error("FAILED TO FETCH TRACKING:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchTracking();
    }, [id]);

    if (loading) {
        return <h2>Loading tracking...</h2>;
    }

    if (!tracking) {
        return <h2>Tracking information not found.</h2>;
    }

    return (
        <>
            <h1>Order Tracking</h1>

            <h2>{tracking.order_number}</h2>

            <p>Current Status: {tracking.order_status}</p>

            <div>
                {tracking.tracking.map((item) => (
                    <div key={item.status}>
                        <h3>
                            {item.status.replaceAll("_", " ")}
                        </h3>

                        <p>
                            {item.completed
                                ? "✓ Completed"
                                : "Pending"}
                        </p>
                    </div>
                ))}
            </div>
        </>
    );
}

export default OrderTracking;