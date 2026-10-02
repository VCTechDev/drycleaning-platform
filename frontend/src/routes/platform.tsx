import { Route } from "react-router-dom";

import ProtectedRoute from "../components/auth/ProtectedRoute";
import RoleRoute from "../components/auth/RoleRoute";
import PlatformPlaceholder from "../pages/platform/Placeholder";

const PlatformAdminRoutes = (
    <Route element={<ProtectedRoute />}>
        <Route element={<RoleRoute allowedRoles={["platform_admin"]} />}>
            <Route path="platform/*" element={<PlatformPlaceholder />} />
        </Route>
    </Route>
);

export default PlatformAdminRoutes;
