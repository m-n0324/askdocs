import { api, authApi, unwrap } from "@/lib/api";
import type { IApiSuccess, IAuthResponse, ILoginInput, ISignupInput, IUser } from "@/interfaces";

export const signup = (input: ISignupInput) =>
  api().url("/auth/signup").post(input).json<IApiSuccess<IAuthResponse>>().then(unwrap);

export const login = (input: ILoginInput) =>
  api().url("/auth/login").post(input).json<IApiSuccess<IAuthResponse>>().then(unwrap);

export const getMe = () =>
  authApi()
    .url("/auth/me")
    .get()
    .json<IApiSuccess<{ user: IUser }>>()
    .then((body) => unwrap(body).user);
