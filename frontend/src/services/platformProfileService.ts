import api from "../lib/axios";
import type {
    PlatformAdminProfile,
    UpdatePlatformAdminProfileData,
} from "../types/platform/profile";

const platformProfilePath = "/platform/profile/";

export const getPlatformAdminProfile = async (): Promise<PlatformAdminProfile> => {
    const response = await api.get<PlatformAdminProfile>(platformProfilePath);

    return response.data;
};

export const updatePlatformAdminProfile = async (
    data: UpdatePlatformAdminProfileData
): Promise<PlatformAdminProfile> => {
    const response = await api.patch<PlatformAdminProfile>(
        platformProfilePath,
        data
    );

    return response.data;
};
