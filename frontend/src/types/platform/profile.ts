export interface PlatformAdminProfile {
    username: string;
    first_name: string;
    last_name: string;
    email: string | null;
    phone_number: string | null;
}

export interface UpdatePlatformAdminProfileData {
    first_name: string;
    last_name: string;
    email: string;
    phone_number: string;
}
