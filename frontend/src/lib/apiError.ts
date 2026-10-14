import { isAxiosError } from "axios";

export const getApiErrorMessage = (error: unknown, fallback: string) => {
    if (!isAxiosError(error)) {
        return fallback;
    }

    const data: unknown = error.response?.data;
    if (typeof data === "string" && data.trim()) {
        return data;
    }

    if (!data || typeof data !== "object") {
        return fallback;
    }

    const messages = Object.values(data as Record<string, unknown>)
        .flatMap((value) => (Array.isArray(value) ? value : [value]))
        .filter(
            (value): value is string =>
                typeof value === "string" && Boolean(value.trim())
        );

    return messages[0] ?? fallback;
};
