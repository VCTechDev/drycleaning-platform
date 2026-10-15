import { useMemo, useState, type FormEvent } from "react";
import { isAxiosError } from "axios";
import { useMutation } from "@tanstack/react-query";
import {
    AlertCircle,
    CheckCircle2,
    Eye,
    EyeOff,
    KeyRound,
    Mail,
    Pencil,
    Phone,
    RefreshCw,
    Save,
    ShieldCheck,
    UserRound,
    X,
} from "lucide-react";

import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { useAuth } from "../../hooks/useAuth";
import {
    usePlatformProfile,
    useUpdatePlatformProfile,
} from "../../hooks/platform/usePlatformProfile";
import {
    changePassword,
    type ChangePasswordData,
} from "../../services/authService";
import type {
    PlatformAdminProfile,
    UpdatePlatformAdminProfileData,
} from "../../types/platform/profile";

type FeedbackTone = "success" | "error";

interface FeedbackMessage {
    tone: FeedbackTone;
    title: string;
    description: string;
}

interface ProfileForm {
    first_name: string;
    last_name: string;
    email: string;
    phone_number: string;
}

interface PasswordForm {
    current_password: string;
    new_password: string;
    password_confirm: string;
}

const profileFields = [
    "first_name",
    "last_name",
    "email",
    "phone_number",
] as const;

const passwordFields = [
    "current_password",
    "new_password",
    "password_confirm",
] as const;

type ProfileField = (typeof profileFields)[number];
type PasswordField = (typeof passwordFields)[number];
type FieldErrors<T extends string> = Partial<Record<T, string>>;

const emptyProfileForm: ProfileForm = {
    first_name: "",
    last_name: "",
    email: "",
    phone_number: "",
};

const emptyPasswordForm: PasswordForm = {
    current_password: "",
    new_password: "",
    password_confirm: "",
};

const toProfileForm = (profile: PlatformAdminProfile): ProfileForm => ({
    first_name: profile.first_name ?? "",
    last_name: profile.last_name ?? "",
    email: profile.email ?? "",
    phone_number: profile.phone_number ?? "",
});

const getMessages = (value: unknown): string[] => {
    if (typeof value === "string" && value.trim()) {
        return [value];
    }

    if (Array.isArray(value)) {
        return value.filter(
            (item): item is string => typeof item === "string" && Boolean(item.trim())
        );
    }

    return [];
};

const getFieldErrors = <T extends string>(
    error: unknown,
    fields: readonly T[]
): FieldErrors<T> => {
    if (!isAxiosError(error) || !error.response?.data) {
        return {};
    }

    const responseData: unknown = error.response.data;

    if (!responseData || typeof responseData !== "object") {
        return {};
    }

    const data = responseData as Record<string, unknown>;
    const fieldErrors: FieldErrors<T> = {};

    for (const field of fields) {
        const message = getMessages(data[field])[0];

        if (message) {
            fieldErrors[field] = message;
        }
    }

    return fieldErrors;
};

const getApiErrorMessage = (error: unknown, fallback: string) => {
    if (!isAxiosError(error)) {
        return fallback;
    }

    if (error.response?.status === 401) {
        return "Your session has expired. Please log in again.";
    }

    if (error.response?.status === 403) {
        return "You do not have permission to manage this profile.";
    }

    const responseData: unknown = error.response?.data;

    if (!responseData || typeof responseData !== "object") {
        return fallback;
    }

    const data = responseData as Record<string, unknown>;
    const detail = getMessages(data.detail)[0];

    if (detail) {
        return detail;
    }

    for (const value of Object.values(data)) {
        const message = getMessages(value)[0];

        if (message) {
            return message;
        }
    }

    return fallback;
};

function FeedbackBanner({ feedback }: { feedback: FeedbackMessage }) {
    const isSuccess = feedback.tone === "success";
    const Icon = isSuccess ? CheckCircle2 : AlertCircle;

    return (
        <div
            className={`flex items-start gap-3 rounded-2xl border p-4 ${
                isSuccess
                    ? "border-emerald-100 bg-emerald-50 text-emerald-800"
                    : "border-red-100 bg-red-50 text-red-800"
            }`}
            role={isSuccess ? "status" : "alert"}
        >
            <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <div>
                <p className="text-sm font-semibold">{feedback.title}</p>
                <p className="mt-1 text-sm leading-6">{feedback.description}</p>
            </div>
        </div>
    );
}

function FieldError({ message, id }: { message?: string; id?: string }) {
    if (!message) {
        return null;
    }

    return (
        <p id={id} className="mt-1.5 text-xs font-medium text-red-600" role="alert">
            {message}
        </p>
    );
}

function ProfileSkeleton() {
    return (
        <div className="animate-pulse space-y-6" aria-label="Loading your profile">
            <div>
                <div className="h-4 w-20 rounded bg-slate-200" />
                <div className="mt-3 h-9 w-52 rounded bg-slate-200" />
                <div className="mt-3 h-5 w-full max-w-xl rounded bg-slate-200" />
            </div>
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.85fr)]">
                <div className="h-[32rem] rounded-2xl border border-blue-100 bg-white" />
                <div className="h-[30rem] rounded-2xl border border-blue-100 bg-white" />
            </div>
        </div>
    );
}

function ProfileLoadError({
    onRetry,
    retrying,
}: {
    onRetry: () => void;
    retrying: boolean;
}) {
    return (
        <section
            className="rounded-2xl border border-red-100 bg-white p-8 text-center shadow-sm"
            role="alert"
        >
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
                <RefreshCw className="h-6 w-6" aria-hidden="true" />
            </div>
            <h1 className="mt-4 font-heading text-xl font-semibold text-slate-950">
                Profile unavailable
            </h1>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                We could not load your account information. Please try again.
            </p>
            <Button
                type="button"
                onClick={onRetry}
                disabled={retrying}
                className="mt-6"
            >
                {retrying ? "Trying again..." : "Try again"}
            </Button>
        </section>
    );
}

function DetailField({
    label,
    value,
    icon: Icon,
}: {
    label: string;
    value: string;
    icon: typeof UserRound;
}) {
    return (
        <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
            <div className="flex items-center gap-2 text-slate-500">
                <Icon className="h-4 w-4" aria-hidden="true" />
                <dt className="text-xs font-semibold uppercase tracking-[0.1em]">
                    {label}
                </dt>
            </div>
            <dd className="mt-2 break-words text-sm font-semibold text-slate-800">
                {value}
            </dd>
        </div>
    );
}

function PasswordInput({
    id,
    label,
    value,
    onChange,
    visible,
    onVisibilityChange,
    error,
    autoComplete,
    disabled,
}: {
    id: string;
    label: string;
    value: string;
    onChange: (value: string) => void;
    visible: boolean;
    onVisibilityChange: () => void;
    error?: string;
    autoComplete: string;
    disabled: boolean;
}) {
    const errorId = `${id}-error`;

    return (
        <div>
            <label htmlFor={id} className="text-sm font-semibold text-slate-700">
                {label}
            </label>
            <div className="relative mt-2">
                <Input
                    id={id}
                    type={visible ? "text" : "password"}
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    autoComplete={autoComplete}
                    disabled={disabled}
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? errorId : undefined}
                    className="h-11 rounded-xl border-slate-200 bg-white pr-12 focus-visible:ring-blue-500"
                />
                <button
                    type="button"
                    onClick={onVisibilityChange}
                    disabled={disabled}
                    className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-xl text-slate-500 transition hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
                >
                    {visible ? (
                        <EyeOff className="h-4 w-4" aria-hidden="true" />
                    ) : (
                        <Eye className="h-4 w-4" aria-hidden="true" />
                    )}
                </button>
            </div>
            {error && <p id={errorId} className="mt-1.5 text-xs font-medium text-red-600" role="alert">{error}</p>}
        </div>
    );
}

function PlatformProfile() {
    const { updateAuthenticatedUser } = useAuth();
    const { data: profile, isPending, isError, isFetching, refetch } =
        usePlatformProfile();
    const updateProfileMutation = useUpdatePlatformProfile();
    const changePasswordMutation = useMutation({ mutationFn: changePassword });

    const [editing, setEditing] = useState(false);
    const [profileForm, setProfileForm] = useState<ProfileForm>(emptyProfileForm);
    const [passwordForm, setPasswordForm] = useState<PasswordForm>(emptyPasswordForm);
    const [profileFieldErrors, setProfileFieldErrors] = useState<FieldErrors<ProfileField>>({});
    const [passwordFieldErrors, setPasswordFieldErrors] = useState<FieldErrors<PasswordField>>({});
    const [profileFeedback, setProfileFeedback] = useState<FeedbackMessage | null>(null);
    const [passwordFeedback, setPasswordFeedback] = useState<FeedbackMessage | null>(null);
    const [passwordVisibility, setPasswordVisibility] = useState({
        current: false,
        next: false,
        confirmation: false,
    });

    const displayName = useMemo(() => {
        if (!profile) {
            return "Platform Admin";
        }

        return (
            [profile.first_name, profile.last_name].filter(Boolean).join(" ") ||
            profile.username ||
            "Platform Admin"
        );
    }, [profile]);

    const initials = displayName
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join("") || "P";

    const startEditing = () => {
        if (!profile) {
            return;
        }

        setProfileForm(toProfileForm(profile));
        setProfileFieldErrors({});
        setProfileFeedback(null);
        setEditing(true);
    };

    const cancelEditing = () => {
        if (profile) {
            setProfileForm(toProfileForm(profile));
        }

        setProfileFieldErrors({});
        setProfileFeedback(null);
        setEditing(false);
    };

    const updateProfileField = (field: ProfileField, value: string) => {
        setProfileForm((current) => ({ ...current, [field]: value }));
        setProfileFieldErrors((current) => ({ ...current, [field]: undefined }));
        setProfileFeedback(null);
    };

    const updatePasswordField = (field: PasswordField, value: string) => {
        setPasswordForm((current) => ({ ...current, [field]: value }));
        setPasswordFieldErrors((current) => ({ ...current, [field]: undefined }));
        setPasswordFeedback(null);
    };

    const handleProfileSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        const errors: FieldErrors<ProfileField> = {};
        const email = profileForm.email.trim();

        if (!email) {
            errors.email = "Email is required.";
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            errors.email = "Enter a valid email address.";
        }

        if (Object.keys(errors).length > 0) {
            setProfileFieldErrors(errors);
            return;
        }

        const payload: UpdatePlatformAdminProfileData = {
            first_name: profileForm.first_name.trim(),
            last_name: profileForm.last_name.trim(),
            email,
            phone_number: profileForm.phone_number.trim(),
        };

        setProfileFieldErrors({});
        setProfileFeedback(null);
        updateProfileMutation.mutate(payload, {
            onSuccess: (updatedProfile) => {
                setProfileForm(toProfileForm(updatedProfile));
                updateAuthenticatedUser({
                    username: updatedProfile.username,
                    email: updatedProfile.email,
                });
                setEditing(false);
                setProfileFeedback({
                    tone: "success",
                    title: "Profile updated",
                    description: "Your account information has been saved.",
                });
            },
            onError: (error) => {
                setProfileFieldErrors(getFieldErrors(error, profileFields));
                setProfileFeedback({
                    tone: "error",
                    title: "Profile could not be updated",
                    description: getApiErrorMessage(
                        error,
                        "Check the highlighted fields and try again."
                    ),
                });
            },
        });
    };

    const handlePasswordSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        const errors: FieldErrors<PasswordField> = {};

        if (!passwordForm.current_password) {
            errors.current_password = "Enter your current password.";
        }
        if (!passwordForm.new_password) {
            errors.new_password = "Enter a new password.";
        }
        if (!passwordForm.password_confirm) {
            errors.password_confirm = "Confirm your new password.";
        } else if (passwordForm.new_password !== passwordForm.password_confirm) {
            errors.password_confirm = "New passwords do not match.";
        }

        if (Object.keys(errors).length > 0) {
            setPasswordFieldErrors(errors);
            return;
        }

        const payload: ChangePasswordData = {
            current_password: passwordForm.current_password,
            new_password: passwordForm.new_password,
            password_confirm: passwordForm.password_confirm,
        };

        setPasswordFieldErrors({});
        setPasswordFeedback(null);
        changePasswordMutation.mutate(payload, {
            onSuccess: (response) => {
                setPasswordForm(emptyPasswordForm);
                setPasswordFeedback({
                    tone: "success",
                    title: "Password changed",
                    description: response.message,
                });
            },
            onError: (error) => {
                setPasswordFieldErrors(getFieldErrors(error, passwordFields));
                setPasswordFeedback({
                    tone: "error",
                    title: "Password could not be changed",
                    description: getApiErrorMessage(
                        error,
                        "Check the highlighted fields and try again."
                    ),
                });
            },
        });
    };

    if (isPending) {
        return <ProfileSkeleton />;
    }

    if (isError || !profile) {
        return (
            <ProfileLoadError
                onRetry={() => void refetch()}
                retrying={isFetching}
            />
        );
    }

    const profileSaving = updateProfileMutation.isPending;
    const passwordSaving = changePasswordMutation.isPending;

    return (
        <div className="space-y-6">
            <header>
                <p className="text-sm font-semibold text-blue-600">Account</p>
                <h1 className="mt-1 font-heading text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                    My Profile
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 sm:text-base">
                    Review your Platform Admin account details and keep your sign-in information up to date.
                </p>
            </header>

            <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.85fr)]">
                <section className="space-y-6">
                    {profileFeedback && <FeedbackBanner feedback={profileFeedback} />}

                    <Card className="overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm">
                        <div className="border-b border-blue-100 bg-gradient-to-r from-blue-50 to-white px-5 py-6 sm:px-6">
                            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                                <div className="flex min-w-0 items-center gap-4">
                                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-blue-600 font-heading text-xl font-semibold text-white shadow-sm">
                                        {initials}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <h2 className="break-words font-heading text-xl font-semibold text-slate-950">
                                                {displayName}
                                            </h2>
                                            <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700">
                                                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                                                Platform Admin
                                            </span>
                                        </div>
                                        <p className="mt-1 break-all text-sm text-slate-500">
                                            @{profile.username}
                                        </p>
                                    </div>
                                </div>

                                {!editing && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={startEditing}
                                        className="shrink-0 border-blue-200 text-blue-700 hover:bg-blue-50"
                                    >
                                        <Pencil className="h-4 w-4" aria-hidden="true" />
                                        Edit Profile
                                    </Button>
                                )}
                            </div>
                        </div>

                        <div className="p-5 sm:p-6">
                            <div className="flex items-center gap-2">
                                <UserRound className="h-5 w-5 text-blue-600" aria-hidden="true" />
                                <h3 className="font-heading text-lg font-semibold text-slate-950">
                                    Account information
                                </h3>
                            </div>
                            <p className="mt-1 text-sm leading-6 text-slate-500">
                                Your username and role are managed by the platform and cannot be changed here.
                            </p>

                            {editing ? (
                                <form className="mt-6 space-y-5" onSubmit={handleProfileSubmit} noValidate>
                                    <div className="grid gap-5 sm:grid-cols-2">
                                        <div>
                                            <label htmlFor="platform-profile-first-name" className="text-sm font-semibold text-slate-700">
                                                First name
                                            </label>
                                            <Input
                                                id="platform-profile-first-name"
                                                value={profileForm.first_name}
                                                onChange={(event) => updateProfileField("first_name", event.target.value)}
                                                autoComplete="given-name"
                                                disabled={profileSaving}
                                                aria-invalid={Boolean(profileFieldErrors.first_name)}
                                                aria-describedby={profileFieldErrors.first_name ? "platform-profile-first-name-error" : undefined}
                                                className="mt-2 h-11 rounded-xl border-slate-200 focus-visible:ring-blue-500"
                                            />
                                            {profileFieldErrors.first_name && <p id="platform-profile-first-name-error" className="mt-1.5 text-xs font-medium text-red-600" role="alert">{profileFieldErrors.first_name}</p>}
                                        </div>
                                        <div>
                                            <label htmlFor="platform-profile-last-name" className="text-sm font-semibold text-slate-700">
                                                Last name
                                            </label>
                                            <Input
                                                id="platform-profile-last-name"
                                                value={profileForm.last_name}
                                                onChange={(event) => updateProfileField("last_name", event.target.value)}
                                                autoComplete="family-name"
                                                disabled={profileSaving}
                                                aria-invalid={Boolean(profileFieldErrors.last_name)}
                                                aria-describedby={profileFieldErrors.last_name ? "platform-profile-last-name-error" : undefined}
                                                className="mt-2 h-11 rounded-xl border-slate-200 focus-visible:ring-blue-500"
                                            />
                                            {profileFieldErrors.last_name && <p id="platform-profile-last-name-error" className="mt-1.5 text-xs font-medium text-red-600" role="alert">{profileFieldErrors.last_name}</p>}
                                        </div>
                                    </div>

                                    <div>
                                        <label htmlFor="platform-profile-email" className="text-sm font-semibold text-slate-700">
                                            Email address
                                        </label>
                                        <Input
                                            id="platform-profile-email"
                                            type="email"
                                            value={profileForm.email}
                                            onChange={(event) => updateProfileField("email", event.target.value)}
                                            autoComplete="email"
                                            disabled={profileSaving}
                                            aria-invalid={Boolean(profileFieldErrors.email)}
                                            aria-describedby={profileFieldErrors.email ? "platform-profile-email-error" : undefined}
                                            className="mt-2 h-11 rounded-xl border-slate-200 focus-visible:ring-blue-500"
                                        />
                                        <FieldError
                                            id="platform-profile-email-error"
                                            message={profileFieldErrors.email}
                                        />
                                    </div>

                                    <div>
                                        <label htmlFor="platform-profile-phone" className="text-sm font-semibold text-slate-700">
                                            Phone number
                                        </label>
                                        <Input
                                            id="platform-profile-phone"
                                            type="tel"
                                            value={profileForm.phone_number}
                                            onChange={(event) => updateProfileField("phone_number", event.target.value)}
                                            autoComplete="tel"
                                            disabled={profileSaving}
                                            aria-invalid={Boolean(profileFieldErrors.phone_number)}
                                            aria-describedby={profileFieldErrors.phone_number ? "platform-profile-phone-error" : undefined}
                                            className="mt-2 h-11 rounded-xl border-slate-200 focus-visible:ring-blue-500"
                                        />
                                        <FieldError
                                            id="platform-profile-phone-error"
                                            message={profileFieldErrors.phone_number}
                                        />
                                    </div>

                                    <div className="grid gap-4 rounded-xl border border-slate-100 bg-slate-50/70 p-4 sm:grid-cols-2">
                                        <div>
                                            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-400">
                                                Username
                                            </p>
                                            <p className="mt-1 break-words text-sm font-semibold text-slate-700">
                                                {profile.username}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-400">
                                                Role
                                            </p>
                                            <p className="mt-1 text-sm font-semibold text-slate-700">
                                                Platform Admin
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex flex-col-reverse gap-3 pt-1 sm:flex-row sm:justify-end">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={cancelEditing}
                                            disabled={profileSaving}
                                            className="border-slate-200"
                                        >
                                            <X className="h-4 w-4" aria-hidden="true" />
                                            Cancel
                                        </Button>
                                        <Button type="submit" disabled={profileSaving}>
                                            <Save className="h-4 w-4" aria-hidden="true" />
                                            {profileSaving ? "Saving..." : "Save Changes"}
                                        </Button>
                                    </div>
                                </form>
                            ) : (
                                <dl className="mt-6 grid gap-4 sm:grid-cols-2">
                                    <DetailField label="Username" value={profile.username} icon={UserRound} />
                                    <DetailField label="Role" value="Platform Admin" icon={ShieldCheck} />
                                    <DetailField label="First name" value={profile.first_name || "Not provided"} icon={UserRound} />
                                    <DetailField label="Last name" value={profile.last_name || "Not provided"} icon={UserRound} />
                                    <DetailField label="Email" value={profile.email || "Not provided"} icon={Mail} />
                                    <DetailField label="Phone number" value={profile.phone_number || "Not provided"} icon={Phone} />
                                </dl>
                            )}
                        </div>
                    </Card>
                </section>

                <aside className="space-y-6">
                    {passwordFeedback && <FeedbackBanner feedback={passwordFeedback} />}

                    <Card className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm sm:p-6">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                            <KeyRound className="h-5 w-5" aria-hidden="true" />
                        </div>
                        <h2 className="mt-4 font-heading text-lg font-semibold text-slate-950">
                            Change password
                        </h2>
                        <p className="mt-2 text-sm leading-6 text-slate-500">
                            Use your current password to choose a new secure password for this account.
                        </p>

                        <form className="mt-6 space-y-5" onSubmit={handlePasswordSubmit} noValidate>
                            <PasswordInput
                                id="platform-profile-current-password"
                                label="Current password"
                                value={passwordForm.current_password}
                                onChange={(value) => updatePasswordField("current_password", value)}
                                visible={passwordVisibility.current}
                                onVisibilityChange={() => setPasswordVisibility((current) => ({ ...current, current: !current.current }))}
                                error={passwordFieldErrors.current_password}
                                autoComplete="current-password"
                                disabled={passwordSaving}
                            />
                            <PasswordInput
                                id="platform-profile-new-password"
                                label="New password"
                                value={passwordForm.new_password}
                                onChange={(value) => updatePasswordField("new_password", value)}
                                visible={passwordVisibility.next}
                                onVisibilityChange={() => setPasswordVisibility((current) => ({ ...current, next: !current.next }))}
                                error={passwordFieldErrors.new_password}
                                autoComplete="new-password"
                                disabled={passwordSaving}
                            />
                            <PasswordInput
                                id="platform-profile-confirm-password"
                                label="Confirm new password"
                                value={passwordForm.password_confirm}
                                onChange={(value) => updatePasswordField("password_confirm", value)}
                                visible={passwordVisibility.confirmation}
                                onVisibilityChange={() => setPasswordVisibility((current) => ({ ...current, confirmation: !current.confirmation }))}
                                error={passwordFieldErrors.password_confirm}
                                autoComplete="new-password"
                                disabled={passwordSaving}
                            />

                            <Button type="submit" disabled={passwordSaving} className="w-full">
                                <KeyRound className="h-4 w-4" aria-hidden="true" />
                                {passwordSaving ? "Changing password..." : "Change Password"}
                            </Button>
                        </form>
                    </Card>
                </aside>
            </div>
        </div>
    );
}

export default PlatformProfile;
