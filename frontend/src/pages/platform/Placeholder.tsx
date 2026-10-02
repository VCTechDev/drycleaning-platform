import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { useAuth } from "../../hooks/useAuth";

function PlatformPlaceholder() {
    const navigate = useNavigate();
    const logout = useAuth().logout;

    const handleLogout = () => {
        logout();
        navigate("/auth/login", { replace: true });
    };

    return (
        <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-10">
            <section className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-sm">
                <h1 className="text-2xl font-bold text-slate-900">
                    Platform Admin workspace coming soon
                </h1>
                <p className="mt-3 text-sm leading-6 text-slate-500">
                    Your Platform Admin account is authenticated. The workspace
                    will be available in a future phase.
                </p>
                <Button
                    type="button"
                    onClick={handleLogout}
                    className="mt-7 rounded-full bg-blue-600 hover:bg-blue-700"
                >
                    Log out
                </Button>
            </section>
        </main>
    );
}

export default PlatformPlaceholder;
