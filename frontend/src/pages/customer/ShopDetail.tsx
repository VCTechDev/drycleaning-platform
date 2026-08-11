import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import {
    getShopDetail,
    getShopServices,
} from "../../services/shopService";
import { createOrder } from "../../services/orderService";

import type { Shop } from "../../types/shop";
import type { ShopService } from "../../types/shopService";

function ShopDetail() {
    const { id } = useParams();

    const [shop, setShop] = useState<Shop | null>(null);
    const [services, setServices] = useState<ShopService[]>([]);
    const [selectedServices, setSelectedServices] = useState<Record<number, number>>({});
    const [showOrderForm, setShowOrderForm] = useState(false);

    const [address, setAddress] = useState({
        pickup_address_line: "",
        pickup_city: "",
        pickup_district: "",
        pickup_state: "Kerala",
        pickup_pincode: "",
        note: "",
    });

    useEffect(() => {
        const fetchShop = async () => {
            try {
                if (!id) return;

                const shopData = await getShopDetail(id);
                const serviceData = await getShopServices(id);

                setShop(shopData);
                setServices(serviceData);
            } catch (error) {
                console.error(error);
            }
        };

        fetchShop();
    }, [id]);


    const toggleService = (serviceId: number) => {
        setSelectedServices((current) => {
            if (current[serviceId]) {
                const updated = { ...current };
                delete updated[serviceId];
                return updated
            }

            return {
                ...current, [serviceId]: 1
            };
        });
    };

    const updateQuantity = (servicesId: number, quantity: number) => {
        if (quantity < 1) {
            return;
        }

        setSelectedServices((current) => ({
            ...current, [servicesId]: quantity,
        }));
    };

    const handleCreateOrder = async () => {
        try {
            if (!id) return;

            const items = Object.entries(selectedServices).map(
                ([serviceId, quantity]) => ({
                    shop_service: Number(serviceId),
                    quantity,
                })
            );

            const orderData = {
                shop: Number(id),
                ...address,
                items,
            };

            const order = await createOrder(orderData);

            console.log("ORDER CREATED:", order);

            alert("Order created successfully!");
        } catch (error) {
            console.error("ORDER CREATION FAILED:", error);
        }
    };

    if (!shop) {
        return <h2>Loading...</h2>;
    }

    return (
        <>
            <h1>{shop.shop_name}</h1>

            <p>{shop.description}</p>
            <p>{shop.city}</p>
            <p>{shop.district}</p>

            <hr />

            <h2>Services</h2>

            {services.map((service) => {
                const quantity = selectedServices[service.id] || 0;

                return (
                    <div key={service.id}>
                        <h3>{service.service}</h3>

                        <p>Garment: {service.garment_type}</p>

                        <p>Price: ₹{service.price}</p>

                        <p>Estimated days: {service.estimated_days}</p>

                        {!quantity ? (
                            <button onClick={() => toggleService(service.id)}>
                                Select
                            </button>
                        ) : (
                            <>
                                <button
                                    onClick={() =>
                                        updateQuantity(service.id, quantity - 1)
                                    }
                                    disabled={quantity === 1}
                                >
                                    -
                                </button>

                                <span> {quantity} </span>

                                <button
                                    onClick={() =>
                                        updateQuantity(service.id, quantity + 1)
                                    }
                                >
                                    +
                                </button>

                                <button
                                    onClick={() => toggleService(service.id)}
                                >
                                    Remove
                                </button>
                            </>
                        )}

                        <hr />
                    </div>
                );
            })}

            {showOrderForm && (
                <div>
                    <h2>Pickup Address</h2>

                    <input
                        placeholder="Address"
                        value={address.pickup_address_line}
                        onChange={(e) =>
                            setAddress({
                                ...address,
                                pickup_address_line: e.target.value,
                            })
                        }
                    />

                    <input
                        placeholder="City"
                        value={address.pickup_city}
                        onChange={(e) =>
                            setAddress({
                                ...address,
                                pickup_city: e.target.value,
                            })
                        }
                    />

                    <select
                        value={address.pickup_district}
                        onChange={(e) =>
                            setAddress({
                                ...address,
                                pickup_district: e.target.value,
                            })
                        }
                    >
                        <option value="">Select District</option>
                        <option value="Thiruvananthapuram">Thiruvananthapuram</option>
                        <option value="Kollam">Kollam</option>
                        <option value="Pathanamthitta">Pathanamthitta</option>
                        <option value="Alappuzha">Alappuzha</option>
                        <option value="Kottayam">Kottayam</option>
                        <option value="Idukki">Idukki</option>
                        <option value="Ernakulam">Ernakulam</option>
                        <option value="Thrissur">Thrissur</option>
                        <option value="Palakkad">Palakkad</option>
                        <option value="Malappuram">Malappuram</option>
                        <option value="Kozhikode">Kozhikode</option>
                        <option value="Wayanad">Wayanad</option>
                        <option value="Kannur">Kannur</option>
                        <option value="Kasaragod">Kasaragod</option>
                    </select>

                    <input
                        placeholder="Pincode"
                        value={address.pickup_pincode}
                        onChange={(e) =>
                            setAddress({
                                ...address,
                                pickup_pincode: e.target.value,
                            })
                        }
                    />

                    <textarea
                        placeholder="Note (optional)"
                        value={address.note}
                        onChange={(e) =>
                            setAddress({
                                ...address,
                                note: e.target.value,
                            })
                        }
                    />

                    <button onClick={handleCreateOrder}>
                        Place Order
                    </button>
                </div>
            )}

            {Object.keys(selectedServices).length > 0 && (
                <button onClick={() => setShowOrderForm(true)}>
                    Continue
                </button>
            )}
        </>
    );
}

export default ShopDetail;