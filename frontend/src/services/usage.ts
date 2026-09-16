import { authApi, unwrap } from "@/lib/api";
import type { IApiSuccess, IUsage } from "@/interfaces";

export const getUsage = (workspaceId: string) =>
  authApi().url(`/workspaces/${workspaceId}/usage`).get().json<IApiSuccess<IUsage>>().then(unwrap);
