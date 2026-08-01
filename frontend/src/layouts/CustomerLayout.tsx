import { Outlet } from "react-router-dom";




function CustomerLayout() {

    return (
        <>
            <h2>Customer Navbar</h2>

            <Outlet />

            <h2>Customer Footer</h2>
        </>
    );
}


export default CustomerLayout;