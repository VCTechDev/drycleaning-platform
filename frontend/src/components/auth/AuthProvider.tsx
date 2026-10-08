import { useEffect, type PropsWithChildren } from "react";

import { useAuthStore } from "../../stores/authStore";

function AuthProvider({ children }: PropsWithChildren) {
    const restoreSession = useAuthStore((state) => state.restoreSession);

    useEffect(() => {
        void restoreSession();
    }, [restoreSession]);

    return children;
}

export default AuthProvider;
