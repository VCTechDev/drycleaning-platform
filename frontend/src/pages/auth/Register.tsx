import { useState } from "react";
import type { SubmitEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
    ArrowRight,
    Eye,
    EyeOff,
    LockKeyhole,
    Smartphone,
    Mail,
    User,
    ShieldCheck,
    Clock3,
    Award,
} from "lucide-react";

import { register } from "../../services/authService";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";


function Register() {
    const navigate = useNavigate();

    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [phoneNumber, setPhoneNumber] = useState("");

    const [password, setPassword] = useState("");
    const [passwordConfirm, setPasswordConfirm] = useState("");

    const [showPassword, setShowPassword] = useState(false);
    const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);

    const [termsAccepted, setTermsAccepted] = useState(false);

    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);


    const handleSubmit = async (event: SubmitEvent) => {
        event.preventDefault();

        // Clear previous error before validating the new submission.
        setError("");

        // User must accept the terms before creating an account.
        if (!termsAccepted) {
            setError("Please accept the Terms & Conditions.");
            return;
        }

        // Check passwords before sending the request to Django.
        if (password !== passwordConfirm) {
            setError("Passwords do not match.");
            return;
        }

        try {
            setLoading(true);

            await register({
                username,
                email,
                phone_number: phoneNumber,
                password,
                password_confirm: passwordConfirm,
            });

            // Registration succeeded.
            // Send the customer to Login so they can authenticate.
            navigate("/auth/login");

        } catch (error: any) {
            console.error(error);

            // Django validation errors can come as an object.
            // For now, show a simple message to the user.
            if (error.response?.data) {
                const data = error.response.data;

                if (typeof data === "object") {
                    const firstError = Object.values(data)[0];

                    if (Array.isArray(firstError)) {
                        setError(String(firstError[0]));
                    } else {
                        setError(String(firstError));
                    }
                } else {
                    setError("Registration failed.");
                }
            } else {
                setError("Registration failed. Please try again.");
            }

        } finally {
            setLoading(false);
        }
    };


    return (
        <main className="min-h-screen w-full bg-white">

            {/* =========================================================
                MAIN REGISTER CONTAINER
            ========================================================= */}
            <div
                className="
                    flex
                    min-h-screen
                    w-full
                    overflow-hidden
                    bg-white
                "
            >

                {/* =====================================================
                    LEFT SIDE — REGISTER FORM
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
                    <div className="mb-6">

                        <img
                            src="/images/branding/veecleen-logo.png"
                            alt="VeeCleen Dry Cleaning"
                            className="
                                h-auto
                                w-[190px]
                                max-w-full
                                object-contain
                                sm:w-[210px]
                            "
                        />

                    </div>


                    {/* -------------------------------------------------
                        Heading
                    ------------------------------------------------- */}
                    <div className="mb-6">

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
                            Create Account
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
                            Join VeeCleen and experience
                            effortless cloth care.
                        </p>

                    </div>


                    {/* =================================================
                        REGISTER FORM
                    ================================================= */}
                    <form
                        onSubmit={handleSubmit}
                        className="w-full space-y-3.5"
                    >

                        {/* ------------------------------------------------
                            Username
                        ------------------------------------------------ */}
                        <div className="relative">

                            <User
                                className="
                                    absolute
                                    left-4
                                    top-1/2
                                    z-10
                                    -translate-y-1/2
                                    text-blue-600
                                "
                                size={20}
                            />

                            <Input
                                type="text"
                                value={username}
                                onChange={(event) =>
                                    setUsername(event.target.value)
                                }
                                placeholder="Username"
                                className="
                                    h-14
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
                            Email
                        ------------------------------------------------ */}
                        <div className="relative">

                            <Mail
                                className="
                                    absolute
                                    left-4
                                    top-1/2
                                    z-10
                                    -translate-y-1/2
                                    text-blue-600
                                "
                                size={20}
                            />

                            <Input
                                type="email"
                                value={email}
                                onChange={(event) =>
                                    setEmail(event.target.value)
                                }
                                placeholder="Email Address"
                                className="
                                    h-14
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
                            Phone Number
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
                                size={20}
                            />

                            <Input
                                type="tel"
                                value={phoneNumber}
                                onChange={(event) =>
                                    setPhoneNumber(event.target.value)
                                }
                                placeholder="Phone Number"
                                className="
                                    h-14
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
                                size={20}
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
                                    h-14
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

                            {/* Show / hide password */}
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
                                    <EyeOff size={21} />
                                ) : (
                                    <Eye size={21} />
                                )}
                            </button>

                        </div>


                        {/* ------------------------------------------------
                            Confirm Password
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
                                size={20}
                            />

                            <Input
                                type={
                                    showPasswordConfirm
                                        ? "text"
                                        : "password"
                                }
                                value={passwordConfirm}
                                onChange={(event) =>
                                    setPasswordConfirm(event.target.value)
                                }
                                placeholder="Confirm Password"
                                className="
                                    h-14
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

                            {/* Show / hide confirm password */}
                            <button
                                type="button"
                                onClick={() =>
                                    setShowPasswordConfirm(
                                        !showPasswordConfirm
                                    )
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
                                    showPasswordConfirm
                                        ? "Hide password"
                                        : "Show password"
                                }
                            >
                                {showPasswordConfirm ? (
                                    <EyeOff size={21} />
                                ) : (
                                    <Eye size={21} />
                                )}
                            </button>

                        </div>


                        {/* ------------------------------------------------
                            Terms & Conditions
                        ------------------------------------------------ */}
                        <label
                            className="
                                flex
                                cursor-pointer
                                items-start
                                gap-2.5
                                pt-1
                                text-sm
                                leading-5
                                text-slate-600
                            "
                        >

                            <Checkbox
                                checked={termsAccepted}
                                onCheckedChange={(checked) =>
                                    setTermsAccepted(checked === true)
                                }
                                className="mt-0.5"
                            />

                            <span>
                                I agree to the{" "}
                                <button
                                    type="button"
                                    className="
                                        font-medium
                                        text-blue-600
                                        hover:text-blue-700
                                    "
                                >
                                    Terms & Conditions
                                </button>
                                {" "}and{" "}
                                <button
                                    type="button"
                                    className="
                                        font-medium
                                        text-blue-600
                                        hover:text-blue-700
                                    "
                                >
                                    Privacy Policy
                                </button>
                                .
                            </span>

                        </label>


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
                            Register Button
                        ------------------------------------------------ */}
                        <Button
                            type="submit"
                            disabled={loading}
                            className="
                                h-14
                                w-full
                                rounded-2xl
                                bg-blue-600
                                text-lg
                                font-semibold
                                shadow-md
                                transition
                                hover:bg-blue-700
                                disabled:cursor-not-allowed
                                disabled:opacity-60
                            "
                        >

                            <span>
                                {loading
                                    ? "Creating Account..."
                                    : "Create Account"}
                            </span>

                            {!loading && (
                                <ArrowRight
                                    className="ml-auto"
                                    size={24}
                                />
                            )}

                        </Button>

                    </form>


                    {/* -------------------------------------------------
                        Login Link
                    ------------------------------------------------- */}
                    <p
                        className="
                            mt-5
                            text-center
                            text-base
                            text-slate-600
                        "
                    >
                        Already have an account?{" "}

                        <button
                            type="button"
                            onClick={() => navigate("/auth/login")}
                            className="
                                font-semibold
                                text-blue-600
                                transition
                                hover:text-blue-700
                            "
                        >
                            Login
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

                        {/* Trusted & Safe */}
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


                        {/* Fast & Reliable */}
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


                        {/* Best Quality */}
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

export default Register;