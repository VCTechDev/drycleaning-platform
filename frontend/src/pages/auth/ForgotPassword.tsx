import { useState, type FormEvent } from "react";
import { isAxiosError } from "axios";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    forgotPassword,
    resetPassword,
    verifyOTP,
} from "../../services/authService";

type RecoveryStep = "request" | "verify" | "reset";

const getErrorMessage = (error: unknown, fallback: string) => {
    if (!isAxiosError(error)) {
        return fallback;
    }

    const data = error.response?.data as
        | Record<string, unknown>
        | undefined;

    if (typeof data?.detail === "string") {
        return data.detail;
    }

    for (const value of Object.values(data ?? {})) {
        if (Array.isArray(value) && typeof value[0] === "string") {
            return value[0];
        }

        if (typeof value === "string") {
            return value;
        }
    }

    return fallback;
};

function ForgotPassword() {
    const navigate = useNavigate();
    const [step, setStep] = useState<RecoveryStep>("request");
    const [identifier, setIdentifier] = useState("");
    const [otp, setOtp] = useState("");
    const [resetToken, setResetToken] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [passwordConfirm, setPasswordConfirm] = useState("");
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setLoading(true);
        setError("");
        setMessage("");

        try {
            if (step === "request") {
                const response = await forgotPassword({ identifier });
                setMessage(response.message);
                setStep("verify");
            } else if (step === "verify") {
                const response = await verifyOTP({ identifier, otp });
                setResetToken(response.reset_token);
                setMessage("OTP verified. Choose a new password.");
                setStep("reset");
            } else {
                const response = await resetPassword({
                    identifier,
                    reset_token: resetToken,
                    new_password: newPassword,
                    password_confirm: passwordConfirm,
                });
                setMessage(response.message);
                setTimeout(() => navigate("/auth/login"), 700);
            }
        } catch (recoveryError) {
            setError(
                getErrorMessage(
                    recoveryError,
                    "We could not complete the password recovery request."
                )
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-10">
            <section className="w-full max-w-md rounded-3xl bg-white p-7 shadow-sm sm:p-9">
                <img
                    src="/images/branding/veecleen-logo.png"
                    alt="VeeCleen Dry Cleaning"
                    className="h-auto w-48 max-w-full object-contain"
                />

                <h1 className="mt-8 text-3xl font-bold tracking-tight text-slate-900">
                    Reset your password
                </h1>

                <p className="mt-3 text-sm leading-6 text-slate-500">
                    {step === "request" &&
                        "Enter your username or registered email to receive an OTP."}
                    {step === "verify" &&
                        "Enter the 6-digit OTP sent to your registered email."}
                    {step === "reset" && "Set a new password for your account."}
                </p>

                <form onSubmit={handleSubmit} className="mt-7 space-y-4">
                    {(step === "request" || step === "verify" || step === "reset") && (
                        <Input
                            value={identifier}
                            onChange={(event) => setIdentifier(event.target.value)}
                            placeholder="Username or Email"
                            required
                            disabled={step !== "request"}
                            className="h-14 rounded-2xl"
                        />
                    )}

                    {step === "verify" && (
                        <Input
                            value={otp}
                            onChange={(event) => setOtp(event.target.value)}
                            placeholder="6-digit OTP"
                            inputMode="numeric"
                            maxLength={6}
                            required
                            className="h-14 rounded-2xl"
                        />
                    )}

                    {step === "reset" && (
                        <>
                            <Input
                                type="password"
                                value={newPassword}
                                onChange={(event) => setNewPassword(event.target.value)}
                                placeholder="New Password"
                                required
                                className="h-14 rounded-2xl"
                            />
                            <Input
                                type="password"
                                value={passwordConfirm}
                                onChange={(event) => setPasswordConfirm(event.target.value)}
                                placeholder="Confirm New Password"
                                required
                                className="h-14 rounded-2xl"
                            />
                        </>
                    )}

                    {message && (
                        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700" role="status">
                            {message}
                        </p>
                    )}

                    {error && (
                        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600" role="alert">
                            {error}
                        </p>
                    )}

                    <Button
                        type="submit"
                        disabled={loading}
                        className="h-14 w-full rounded-2xl bg-blue-600 text-base font-semibold hover:bg-blue-700"
                    >
                        {loading
                            ? "Please wait..."
                            : step === "request"
                                ? "Send OTP"
                                : step === "verify"
                                    ? "Verify OTP"
                                    : "Reset Password"}
                    </Button>
                </form>

                <button
                    type="button"
                    onClick={() => navigate("/auth/login")}
                    className="mt-6 w-full text-center text-sm font-medium text-blue-600 hover:text-blue-700"
                >
                    Back to Login
                </button>
            </section>
        </main>
    );
}

export default ForgotPassword;
