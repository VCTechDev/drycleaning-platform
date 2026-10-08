const getValidDate = (value: string | null | undefined) => {
    if (!value) {
        return null;
    }

    const date = new Date(value);

    return Number.isNaN(date.getTime()) ? null : date;
};

export const formatApplicationDate = (value: string | null | undefined) => {
    const date = getValidDate(value);

    if (!date) {
        return "Date unavailable";
    }

    return new Intl.DateTimeFormat("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
    }).format(date);
};

export const formatApplicationDateTime = (
    value: string | null | undefined
) => {
    const date = getValidDate(value);

    if (!date) {
        return "Not available";
    }

    return new Intl.DateTimeFormat("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
    }).format(date);
};

export const formatApplicationTime = (value: string | null | undefined) => {
    if (!value) {
        return "Not provided";
    }

    return value.slice(0, 5);
};

export const formatApplicationLocation = (
    city: string,
    district: string,
    state?: string
) =>
    [city, district, state]
        .map((part) => part?.trim())
        .filter((part): part is string => Boolean(part))
        .join(", ") || "Location unavailable";
