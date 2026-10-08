import { useQuery } from "@tanstack/react-query";

import { getPlatformDashboard } from "../../services/platformDashboardService";

export const usePlatformDashboard = (days: number) =>
    useQuery({
        queryKey: ["platform", "dashboard", { days }],
        queryFn: () => getPlatformDashboard({ days }),
        staleTime: 60_000,
        retry: 1,
    });

