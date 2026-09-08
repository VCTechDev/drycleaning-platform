import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
    ArrowRight,
    Eye,
    EyeOff,
    LockKeyhole,
    Smartphone,
    ShieldCheck,
    Clock3,
    Award,
} from "lucide-react";

import { login } from "../../services/authService";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

function Login() {
    const navigate = useNavigate();

    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");

    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);

    const [error, setError] = useState("");

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        try {
            setError("");

            const data = await login({
                username,
                password,
            });

            localStorage.setItem("access_token", data.access);
            localStorage.setItem("refresh_token", data.refresh);

            navigate("/customer/shops");
        } catch (error) {
            console.error(error);
            setError("Invalid username or password.");
        }
    };

    return (
        <main className="min-h-screen w-full bg-white">
            {/* =========================================================
                MAIN AUTH CARD
            ========================================================= */}
            <div className=" flex min-h-screen w-full overflow-hidden bg-white">
                {/* =====================================================
                    LEFT SIDE — LOGIN FORM
                ===================================================== */}
                <section
                    className="
                        flex
                        w-full
                        flex-col
                        justify-center
                        px-6
                        py-8
                        sm:px-10
                        lg:w-1/2
                        lg:px-12
                        lg:py-8
                        xl:px-16
                    "
                >

                    {/* -------------------------------------------------
                        VeeCleen Logo
                    ------------------------------------------------- */}
                    <div className="mb-7">
                        <img
                            src="/images/branding/veecleen-logo.png"
                            alt="VeeCleen Dry Cleaning"
                            className="
                                h-auto
                                w-52.5
                                max-w-full
                                object-contain
                                sm:w-57.5
                            "
                        />
                    </div>


                    {/* -------------------------------------------------
                        Heading
                    ------------------------------------------------- */}
                    <div className="mb-7">

                        <h1
                            className="
                                text-4xl
                                font-bold
                                tracking-tight
                                text-slate-900
                                sm:text-[42px]
                                lg:text-[44px]
                            "
                        >
                            Welcome Back
                        </h1>

                        <p
                            className="
                                mt-3
                                max-w-lg
                                text-base
                                leading-7
                                text-slate-500
                                sm:text-lg
                                sm:leading-8
                            "
                        >
                            Login to your account and get your
                            cloth care, done right.
                        </p>

                    </div>


                    {/* =================================================
                        LOGIN FORM
                    ================================================= */}
                    <form
                        onSubmit={handleSubmit}
                        className="w-full space-y-4"
                    >

                        {/* ------------------------------------------------
                            Username
                        ------------------------------------------------ */}
                        <div className="relative">

                            <Smartphone
                                className="
                                    absolute
                                    left-4
                                    top-1/2
                                    z-10
                                    -translate-y-1/2
                                    text-blue-600
                                "
                                size={21}
                            />

                            <Input
                                type="text"
                                value={username}
                                onChange={(event) =>
                                    setUsername(event.target.value)
                                }
                                placeholder="Username"
                                className="
                                    h-16
                                    rounded-2xl
                                    border-slate-200
                                    bg-white
                                    pl-14
                                    text-base
                                    shadow-sm
                                    placeholder:text-slate-400
                                    focus-visible:ring-blue-500
                                "
                                required
                            />

                        </div>


                        {/* ------------------------------------------------
                            Password
                        ------------------------------------------------ */}
                        <div className="relative">

                            <LockKeyhole
                                className="
                                    absolute
                                    left-4
                                    top-1/2
                                    z-10
                                    -translate-y-1/2
                                    text-blue-600
                                "
                                size={21}
                            />

                            <Input
                                type={
                                    showPassword
                                        ? "text"
                                        : "password"
                                }
                                value={password}
                                onChange={(event) =>
                                    setPassword(event.target.value)
                                }
                                placeholder="Password"
                                className="
                                    h-16
                                    rounded-2xl
                                    border-slate-200
                                    bg-white
                                    pl-14
                                    pr-14
                                    text-base
                                    shadow-sm
                                    placeholder:text-slate-400
                                    focus-visible:ring-blue-500
                                "
                                required
                            />


                            {/* Password visibility */}
                            <button
                                type="button"
                                onClick={() =>
                                    setShowPassword(!showPassword)
                                }
                                className="
                                    absolute
                                    right-4
                                    top-1/2
                                    -translate-y-1/2
                                    text-slate-500
                                    transition
                                    hover:text-blue-600
                                "
                                aria-label={
                                    showPassword
                                        ? "Hide password"
                                        : "Show password"
                                }
                            >
                                {showPassword ? (
                                    <EyeOff size={22} />
                                ) : (
                                    <Eye size={22} />
                                )}
                            </button>

                        </div>


                        {/* ------------------------------------------------
                            Remember + Forgot Password
                        ------------------------------------------------ */}
                        <div
                            className="
                                flex
                                items-center
                                justify-between
                                gap-4
                                pt-1
                            "
                        >

                            <label
                                className="
                                    flex
                                    cursor-pointer
                                    items-center
                                    gap-2
                                    text-sm
                                    text-slate-600
                                    sm:text-base
                                "
                            >

                                <Checkbox
                                    checked={rememberMe}
                                    onCheckedChange={(checked) =>
                                        setRememberMe(checked === true)
                                    }
                                />

                                <span>
                                    Remember me
                                </span>

                            </label>


                            <button
                                type="button"
                                className="
                                    text-sm
                                    font-medium
                                    text-blue-600
                                    transition
                                    hover:text-blue-700
                                    sm:text-base
                                "
                            >
                                Forgot Password?
                            </button>

                        </div>


                        {/* ------------------------------------------------
                            Error
                        ------------------------------------------------ */}
                        {error && (
                            <p
                                className="
                                    rounded-xl
                                    bg-red-50
                                    px-4
                                    py-3
                                    text-sm
                                    text-red-600
                                "
                            >
                                {error}
                            </p>
                        )}


                        {/* ------------------------------------------------
                            Login Button
                        ------------------------------------------------ */}
                        <Button
                            type="submit"
                            className="
                                h-16
                                w-full
                                rounded-2xl
                                bg-blue-600
                                text-lg
                                font-semibold
                                shadow-md
                                transition
                                hover:bg-blue-700
                            "
                        >

                            <span>
                                Login
                            </span>

                            <ArrowRight
                                className="ml-auto"
                                size={25}
                            />

                        </Button>

                    </form>


                    {/* -------------------------------------------------
                        Create Account
                    ------------------------------------------------- */}
                    <p
                        className="
                            mt-7
                            text-center
                            text-base
                            text-slate-600
                        "
                    >
                        Don't have an account?{" "}

                        <button
                            type="button"
                            onClick={() => navigate("/register")}
                            className="
                                font-semibold
                                text-blue-600
                                transition
                                hover:text-blue-700
                            "
                        >
                            Create Account
                        </button>

                    </p>

                </section>


                {/* =====================================================
                    RIGHT SIDE — DESKTOP ONLY
                ===================================================== */}
                <section
                    className="
                        hidden
                        w-1/2
                        flex-col
                        bg-slate-50
                        lg:flex
                    "
                >

                    {/* -------------------------------------------------
                        Cleaning Image
                    ------------------------------------------------- */}
                    <div
                        className="
                            relative
                            min-h-0
                            flex-1
                            overflow-hidden
                        "
                    >

                        <img
                            src="/images/auth/cleaning-hero.png"
                            alt="Professional dry cleaning service"
                            className="
                                h-full
                                w-full
                                object-cover
                            "
                        />

                    </div>


                    {/* =================================================
                        THREE BENEFITS
                    ================================================= */}
                    <div
                        className="
                            grid
                            shrink-0
                            grid-cols-3
                            bg-white
                            px-4
                            py-5
                            xl:px-6
                            xl:py-6
                        "
                    >

                        {/* ------------------------------------------------
                            Trusted & Safe
                        ------------------------------------------------ */}
                        <div
                            className="
                                flex
                                flex-col
                                items-center
                                px-3
                                text-center
                            "
                        >

                            <div
                                className="
                                    mb-2
                                    flex
                                    h-12
                                    w-12
                                    items-center
                                    justify-center
                                    rounded-full
                                    bg-blue-50
                                    text-blue-600
                                "
                            >
                                <ShieldCheck size={25} />
                            </div>

                            <h3
                                className="
                                    text-sm
                                    font-semibold
                                    text-slate-900
                                    xl:text-base
                                "
                            >
                                Trusted & Safe
                            </h3>

                            <p
                                className="
                                    mt-1
                                    text-xs
                                    leading-5
                                    text-slate-500
                                    xl:text-sm
                                "
                            >
                                Your clothes are in safe hands.
                            </p>

                        </div>


                        {/* ------------------------------------------------
                            Fast & Reliable
                        ------------------------------------------------ */}
                        <div
                            className="
                                flex
                                flex-col
                                items-center
                                border-x
                                border-slate-200
                                px-3
                                text-center
                            "
                        >

                            <div
                                className="
                                    mb-2
                                    flex
                                    h-12
                                    w-12
                                    items-center
                                    justify-center
                                    rounded-full
                                    bg-blue-50
                                    text-blue-600
                                "
                            >
                                <Clock3 size={25} />
                            </div>

                            <h3
                                className="
                                    text-sm
                                    font-semibold
                                    text-slate-900
                                    xl:text-base
                                "
                            >
                                Fast & Reliable
                            </h3>

                            <p
                                className="
                                    mt-1
                                    text-xs
                                    leading-5
                                    text-slate-500
                                    xl:text-sm
                                "
                            >
                                On-time pickup and delivery,
                                every time.
                            </p>

                        </div>


                        {/* ------------------------------------------------
                            Best Quality
                        ------------------------------------------------ */}
                        <div
                            className="
                                flex
                                flex-col
                                items-center
                                px-3
                                text-center
                            "
                        >

                            <div
                                className="
                                    mb-2
                                    flex
                                    h-12
                                    w-12
                                    items-center
                                    justify-center
                                    rounded-full
                                    bg-blue-50
                                    text-blue-600
                                "
                            >
                                <Award size={25} />
                            </div>

                            <h3
                                className="
                                    text-sm
                                    font-semibold
                                    text-slate-900
                                    xl:text-base
                                "
                            >
                                Best Quality
                            </h3>

                            <p
                                className="
                                    mt-1
                                    text-xs
                                    leading-5
                                    text-slate-500
                                    xl:text-sm
                                "
                            >
                                Premium care for every fabric.
                            </p>

                        </div>

                    </div>

                </section>

            </div>

        </main>
    );
}

export default Login;