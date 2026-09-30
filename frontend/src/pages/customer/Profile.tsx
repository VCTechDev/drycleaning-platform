import { useCallback, useEffect, useMemo, useState } from "react";
import { isAxiosError } from "axios";
import {
    CheckCircle2,
    Mail,
    Pencil,
    Phone,
    UserRound,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

import {
    getCustomerProfile,
    updateCustomerProfile,
    type CustomerProfile,
    type UpdateCustomerProfileData,
} from "../../services/profileService";

interface ProfileForm {
    first_name: string;
    last_name: string;
    email: string;
    phone_number: string;
}

const emptyForm: ProfileForm = {
    first_name: "",
    last_name: "",
    email: "",
    phone_number: "",
};

const toForm = (profile: CustomerProfile): ProfileForm => ({
    first_name: profile.first_name ?? "",
    last_name: profile.last_name ?? "",
    email: profile.email ?? "",
    phone_number: profile.phone_number ?? "",
});

const getProfileErrorMessage = (
    error: unknown,
    fallback: string
) => {
    if (!isAxiosError(error)) {
        return fallback;
    }

    if (error.response?.status === 401) {
        return "Your session has expired. Please log in again.";
    }

    if (error.response?.status === 403) {
        return "You do not have permission to view this profile.";
    }

    const responseData = error.response?.data;

    if (responseData && typeof responseData === "object") {
        const messages = Object.values(
            responseData as Record<string, unknown>
        ).flatMap((value) => {
            if (Array.isArray(value)) {
                return value.filter(
                    (item): item is string => typeof item === "string"
                );
            }

            return typeof value === "string" ? [value] : [];
        });

        if (messages.length > 0) {
            return messages.join(" ");
        }
    }

    return fallback;
};

function ProfileSkeleton() {
    return (
        <div className="min-h-full bg-[#F5F9FF]">
            <div className="mx-auto w-full max-w-4xl px-4 pb-16 pt-7 sm:px-6 sm:pt-9 lg:px-8 lg:pb-20">
                <div className="h-4 w-24 animate-pulse rounded bg-[#E9EFF7]" />
                <div className="mt-3 h-9 w-48 animate-pulse rounded bg-[#E9EFF7]" />
                <div className="mt-3 h-5 w-80 animate-pulse rounded bg-[#E9EFF7]" />

                <div className="mt-8 space-y-5">
                    <div className="h-44 animate-pulse rounded-[22px] bg-white shadow-sm" />
                    <div className="h-80 animate-pulse rounded-[22px] bg-white shadow-sm" />
                </div>
            </div>
        </div>
    );
}

function Profile() {
    const [profile, setProfile] = useState<CustomerProfile | null>(null);
    const [form, setForm] = useState<ProfileForm>(emptyForm);
    const [editing, setEditing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [saveError, setSaveError] = useState("");
    const [success, setSuccess] = useState("");

    const loadProfile = useCallback(async () => {
        setLoading(true);
        setError("");

        try {
            const data = await getCustomerProfile();

            setProfile(data);
            setForm(toForm(data));
        } catch (profileError) {
            console.error("Failed to fetch customer profile:", profileError);
            setError(
                getProfileErrorMessage(
                    profileError,
                    "Unable to load your profile right now. Please try again."
                )
            );
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        // The initial authenticated request hydrates the profile state.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        void loadProfile();
    }, [loadProfile]);

    const displayName = useMemo(() => {
        if (!profile) {
            return "Customer";
        }

        return (
            [profile.first_name, profile.last_name]
                .filter(Boolean)
                .join(" ") ||
            profile.username ||
            "Customer"
        );
    }, [profile]);

    const initials = displayName
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join("") || "C";

    const handleChange = (field: keyof ProfileForm, value: string) => {
        setForm((current) => ({
            ...current,
            [field]: value,
        }));
        setSaveError("");
        setSuccess("");
    };

    const handleCancel = () => {
        if (profile) {
            setForm(toForm(profile));
        }

        setEditing(false);
        setSaveError("");
        setSuccess("");
    };

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (!form.email.trim()) {
            setSaveError("Email is required.");
            return;
        }

        setSaving(true);
        setSaveError("");
        setSuccess("");

        const payload: UpdateCustomerProfileData = {
            first_name: form.first_name.trim(),
            last_name: form.last_name.trim(),
            email: form.email.trim(),
            phone_number: form.phone_number.trim(),
        };

        try {
            const updatedProfile = await updateCustomerProfile(payload);

            setProfile(updatedProfile);
            setForm(toForm(updatedProfile));
            setEditing(false);
            setSuccess("Profile updated successfully.");
        } catch (profileError) {
            console.error("Failed to update customer profile:", profileError);
            setSaveError(
                getProfileErrorMessage(
                    profileError,
                    "Unable to update your profile. Please check your details and try again."
                )
            );
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <ProfileSkeleton />;
    }

    if (error || !profile) {
        return (
            <div className="min-h-full bg-[#F5F9FF]">
                <div className="mx-auto w-full max-w-4xl px-4 pb-16 pt-7 sm:px-6 sm:pt-9 lg:px-8 lg:pb-20">
                    <Card className="rounded-[22px] border border-red-100 bg-white px-6 py-12 text-center shadow-sm">
                        <h1 className="font-heading text-2xl font-semibold text-[#10194A]">
                            Profile unavailable
                        </h1>

                        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#647092]">
                            {error || "We could not load your profile."}
                        </p>

                        <Button
                            type="button"
                            onClick={loadProfile}
                            className="mt-6 rounded-full"
                        >
                            Try again
                        </Button>
                    </Card>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-full bg-[#F5F9FF]">
            <div className="mx-auto w-full max-w-4xl px-4 pb-16 pt-7 sm:px-6 sm:pt-9 lg:px-8 lg:pb-20">
                <header>
                    <p className="text-sm font-medium text-primary">Account</p>

                    <h1 className="mt-1 font-heading text-3xl font-semibold tracking-tight text-[#10194A] sm:text-4xl">
                        My Profile
                    </h1>

                    <p className="mt-2 text-sm text-[#647092] sm:text-base">
                        Manage your account information.
                    </p>
                </header>

                <main className="mt-8 space-y-5">
                    <Card className="rounded-[22px] border border-[#E3E8F2] bg-white p-5 shadow-sm sm:p-6">
                        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex min-w-0 items-center gap-4">
                                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[#EDF5FF] font-heading text-xl font-semibold text-primary">
                                    {initials}
                                </div>

                                <div className="min-w-0">
                                    <h2 className="break-words font-heading text-xl font-semibold text-[#10194A]">
                                        {displayName}
                                    </h2>

                                    <p className="mt-1 break-all text-sm text-[#647092]">
                                        @{profile.username || "Username unavailable"}
                                    </p>
                                </div>
                            </div>

                            {!editing && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => {
                                        setEditing(true);
                                        setSuccess("");
                                    }}
                                    className="rounded-full"
                                >
                                    <Pencil className="h-4 w-4" aria-hidden="true" />
                                    Edit Profile
                                </Button>
                            )}
                        </div>

                        <div className="mt-5 grid gap-3 border-t border-[#EEF2F7] pt-5 sm:grid-cols-2">
                            <div className="flex min-w-0 items-start gap-3 rounded-2xl bg-[#FAFCFF] p-3">
                                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                                <div className="min-w-0">
                                    <p className="text-xs text-[#7B879B]">Email</p>
                                    <p className="mt-1 break-words text-sm font-medium text-[#10194A]">
                                        {profile.email || "Email unavailable"}
                                    </p>
                                </div>
                            </div>

                            <div className="flex min-w-0 items-start gap-3 rounded-2xl bg-[#FAFCFF] p-3">
                                <Phone className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                                <div className="min-w-0">
                                    <p className="text-xs text-[#7B879B]">Phone</p>
                                    <p className="mt-1 break-words text-sm font-medium text-[#10194A]">
                                        {profile.phone_number || "Phone unavailable"}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </Card>

                    <Card className="rounded-[22px] border border-[#E3E8F2] bg-white p-5 shadow-sm sm:p-6">
                        <div className="flex items-start gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EDF5FF] text-primary">
                                <UserRound className="h-5 w-5" aria-hidden="true" />
                            </div>

                            <div>
                                <h2 className="font-heading text-xl font-semibold text-[#10194A]">
                                    Account Information
                                </h2>

                                <p className="mt-1 text-sm text-[#647092]">
                                    Your customer account details.
                                </p>
                            </div>
                        </div>

                        {success && (
                            <div className="mt-5 flex items-center gap-2 rounded-xl bg-[#E8F7EE] px-3 py-2.5 text-sm font-medium text-[#278251]" role="status">
                                <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                                {success}
                            </div>
                        )}

                        {editing ? (
                            <form onSubmit={handleSubmit} className="mt-6 space-y-5">
                                <div className="grid gap-5 sm:grid-cols-2">
                                    <label className="block text-sm font-medium text-[#10194A]">
                                        First name
                                        <Input
                                            value={form.first_name}
                                            onChange={(event) => handleChange("first_name", event.target.value)}
                                            className="mt-2 h-11 rounded-xl"
                                        />
                                    </label>

                                    <label className="block text-sm font-medium text-[#10194A]">
                                        Last name
                                        <Input
                                            value={form.last_name}
                                            onChange={(event) => handleChange("last_name", event.target.value)}
                                            className="mt-2 h-11 rounded-xl"
                                        />
                                    </label>
                                </div>

                                <div className="grid gap-5 sm:grid-cols-2">
                                    <label className="block text-sm font-medium text-[#10194A]">
                                        Username
                                        <Input
                                            value={profile.username}
                                            readOnly
                                            className="mt-2 h-11 rounded-xl bg-[#F5F7FB] text-[#7B879B]"
                                        />
                                        <span className="mt-1 block text-xs font-normal text-[#7B879B]">
                                            Username cannot be changed.
                                        </span>
                                    </label>

                                    <label className="block text-sm font-medium text-[#10194A]">
                                        Email
                                        <Input
                                            type="email"
                                            required
                                            value={form.email}
                                            onChange={(event) => handleChange("email", event.target.value)}
                                            className="mt-2 h-11 rounded-xl"
                                        />
                                    </label>
                                </div>

                                <label className="block text-sm font-medium text-[#10194A]">
                                    Phone number
                                    <Input
                                        type="tel"
                                        value={form.phone_number}
                                        onChange={(event) => handleChange("phone_number", event.target.value)}
                                        className="mt-2 h-11 rounded-xl sm:max-w-[calc(50%-0.625rem)]"
                                    />
                                </label>

                                {saveError && (
                                    <p className="rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700" role="alert">
                                        {saveError}
                                    </p>
                                )}

                                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={handleCancel}
                                        disabled={saving}
                                        className="rounded-full"
                                    >
                                        Cancel
                                    </Button>

                                    <Button
                                        type="submit"
                                        disabled={saving}
                                        className="rounded-full"
                                    >
                                        {saving ? "Saving..." : "Save Changes"}
                                    </Button>
                                </div>
                            </form>
                        ) : (
                            <div className="mt-6 grid gap-4 sm:grid-cols-2">
                                <div className="rounded-2xl border border-[#E8EEF7] bg-[#FAFCFF] p-4">
                                    <p className="text-xs text-[#7B879B]">First name</p>
                                    <p className="mt-1 break-words font-medium text-[#10194A]">
                                        {profile.first_name || "Not provided"}
                                    </p>
                                </div>

                                <div className="rounded-2xl border border-[#E8EEF7] bg-[#FAFCFF] p-4">
                                    <p className="text-xs text-[#7B879B]">Last name</p>
                                    <p className="mt-1 break-words font-medium text-[#10194A]">
                                        {profile.last_name || "Not provided"}
                                    </p>
                                </div>

                                <div className="rounded-2xl border border-[#E8EEF7] bg-[#FAFCFF] p-4">
                                    <p className="text-xs text-[#7B879B]">Email</p>
                                    <p className="mt-1 break-words font-medium text-[#10194A]">
                                        {profile.email || "Not provided"}
                                    </p>
                                </div>

                                <div className="rounded-2xl border border-[#E8EEF7] bg-[#FAFCFF] p-4">
                                    <p className="text-xs text-[#7B879B]">Phone number</p>
                                    <p className="mt-1 break-words font-medium text-[#10194A]">
                                        {profile.phone_number || "Not provided"}
                                    </p>
                                </div>
                            </div>
                        )}
                    </Card>
                </main>
            </div>
        </div>
    );
}

export default Profile;
