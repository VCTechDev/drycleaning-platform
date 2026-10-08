import { useQuery } from "@tanstack/react-query";

import { getShopApplication } from "../../services/platformApplicationService";
import { shopApplicationKeys } from "./useShopApplications";

export const useShopApplication = (publicId: string | undefined) =>
    useQuery({
        queryKey: shopApplicationKeys.detail(publicId ?? ""),
        queryFn: () => getShopApplication(publicId ?? ""),
        enabled: Boolean(publicId),
        staleTime: 30_000,
        retry: 1,
    });
