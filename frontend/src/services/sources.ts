import { UPLOAD_TIMEOUT_MS } from "@/constants";
import { authApi, unwrap } from "@/lib/api";
import type { IAddUrlSourceInput, IApiSuccess, IDeleted, ISource } from "@/interfaces";

const sourcesPath = (workspaceId: string) => `/workspaces/${workspaceId}/sources`;

export const getSources = (workspaceId: string) =>
  authApi().url(sourcesPath(workspaceId)).get().json<IApiSuccess<ISource[]>>().then(unwrap);

export const getSource = (workspaceId: string, sourceId: string) =>
  authApi().url(`${sourcesPath(workspaceId)}/${sourceId}`).get().json<IApiSuccess<ISource>>().then(unwrap);

export const uploadSource = (workspaceId: string, file: File) => {
  const form = new FormData();
  form.append("file", file);
  // Passing FormData lets the browser set the multipart boundary header itself.
  return authApi({ timeoutMs: UPLOAD_TIMEOUT_MS })
    .url(`${sourcesPath(workspaceId)}/upload`)
    .body(form)
    .post()
    .json<IApiSuccess<ISource>>()
    .then(unwrap);
};

export const addUrlSource = (workspaceId: string, input: IAddUrlSourceInput) =>
  authApi().url(`${sourcesPath(workspaceId)}/url`).post(input).json<IApiSuccess<ISource>>().then(unwrap);

/** Original uploaded file. It needs the auth header, so we fetch it as a Blob. */
export const getSourceFile = (workspaceId: string, sourceId: string) =>
  authApi({ timeoutMs: UPLOAD_TIMEOUT_MS }).url(`${sourcesPath(workspaceId)}/${sourceId}/file`).get().blob();

export const deleteSource = (workspaceId: string, sourceId: string) =>
  authApi().url(`${sourcesPath(workspaceId)}/${sourceId}`).delete().json<IApiSuccess<IDeleted>>().then(unwrap);
