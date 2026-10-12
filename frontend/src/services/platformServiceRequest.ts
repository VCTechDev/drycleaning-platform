import api from "../lib/axios";
import type {
    ApprovePlatformServiceRequestResponse,
    PaginatedPlatformServiceRequests,
    PlatformServiceRequestDetail,
    PlatformServiceRequestFilters,
    RejectPlatformServiceRequestData,
} from "../types/platform/serviceRequests";

const platformServiceRequestsPath = "/platform/service-requests/";

const serviceRequestPath = (requestId: number | string) =>
    `${platformServiceRequestsPath}${encodeURIComponent(requestId)}`;

export const getPlatformServiceRequests = async (
    filters: PlatformServiceRequestFilters = {}
): Promise<PaginatedPlatformServiceRequests> => {
    const response = await api.get<PaginatedPlatformServiceRequests>(
        platformServiceRequestsPath,
        { params: filters }
    );

    return response.data;
};

export const getPlatformServiceRequest = async (
    requestId: number | string
): Promise<PlatformServiceRequestDetail> => {
    const response = await api.get<PlatformServiceRequestDetail>(
        `${serviceRequestPath(requestId)}/`
    );

    return response.data;
};

export const movePlatformServiceRequestToReview = async (
    requestId: number | string
): Promise<PlatformServiceRequestDetail> => {
    const response = await api.post<PlatformServiceRequestDetail>(
        `${serviceRequestPath(requestId)}/under-review/`
    );

    return response.data;
};

export const approvePlatformServiceRequest = async (
    requestId: number | string
): Promise<ApprovePlatformServiceRequestResponse> => {
    const response = await api.post<ApprovePlatformServiceRequestResponse>(
        `${serviceRequestPath(requestId)}/approve/`
    );

    return response.data;
};

export const rejectPlatformServiceRequest = async (
    requestId: number | string,
    data: RejectPlatformServiceRequestData
): Promise<PlatformServiceRequestDetail> => {
    const response = await api.post<PlatformServiceRequestDetail>(
        `${serviceRequestPath(requestId)}/reject/`,
        data
    );

    return response.data;
};
