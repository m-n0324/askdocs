import { authApi, unwrap } from "@/lib/api";
import type { IApiSuccess, IDeleted, IWorkspace } from "@/interfaces";

export const getWorkspaces = () =>
  authApi().url("/workspaces").get().json<IApiSuccess<IWorkspace[]>>().then(unwrap);

export const createWorkspace = (name: string) =>
  authApi().url("/workspaces").post({ name }).json<IApiSuccess<IWorkspace>>().then(unwrap);

export const deleteWorkspace = (workspaceId: string) =>
  authApi().url(`/workspaces/${workspaceId}`).delete().json<IApiSuccess<IDeleted>>().then(unwrap);
