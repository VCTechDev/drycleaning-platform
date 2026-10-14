import api from "../lib/axios";
import type {
    PaginatedPlatformUsers,
    PlatformUserDetail,
    PlatformUserFilters,
} from "../types/platform/users";

const platformUsersPath = "/platform/users/";

export const getPlatformUsers = async (
    filters: PlatformUserFilters
): Promise<PaginatedPlatformUsers> => {
    const response = await api.get<PaginatedPlatformUsers>(
        platformUsersPath,
        { params: filters }
    );

    return response.data;
};

export const getPlatformUser = async (
    userId: number | string
): Promise<PlatformUserDetail> => {
    const response = await api.get<PlatformUserDetail>(
        `${platformUsersPath}${encodeURIComponent(userId)}/`
    );

    return response.data;
};
