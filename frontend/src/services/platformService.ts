import api from "../lib/axios";
import type {
    PaginatedPlatformServices,
    PlatformService,
    PlatformServicesResult,
} from "../types/platform/services";

const platformServicesPath = "/platform/services/";

/**
 * The platform service endpoint is paginated but does not provide a search
 * filter. Fetch each supported page so the UI can search the complete list.
 */
export const getPlatformServices = async (): Promise<PlatformServicesResult> => {
    const results: PlatformService[] = [];
    let page = 1;
    let count = 0;
    let next: string | null = "initial";

    while (next) {
        const response = await api.get<PaginatedPlatformServices>(
            platformServicesPath,
            { params: { page } }
        );

        results.push(...response.data.results);
        count = response.data.count;
        next = response.data.next;
        page += 1;
    }

    return { count, results };
};

export const getPlatformService = async (
    serviceId: number | string
): Promise<PlatformService> => {
    const response = await api.get<PlatformService>(
        `${platformServicesPath}${encodeURIComponent(serviceId)}/`
    );

    return response.data;
};

export const createPlatformService = async (
    data: FormData
): Promise<PlatformService> => {
    const response = await api.post<PlatformService>(platformServicesPath, data);
    return response.data;
};

export const updatePlatformService = async (
    serviceId: number | string,
    data: FormData
): Promise<PlatformService> => {
    const response = await api.patch<PlatformService>(
        `${platformServicesPath}${encodeURIComponent(serviceId)}/`,
        data
    );

    return response.data;
};
