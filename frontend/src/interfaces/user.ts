export interface IUser {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export interface IAuthResponse {
  token: string;
  user: IUser;
}

export interface ILoginInput {
  email: string;
  password: string;
}

export interface ISignupInput extends ILoginInput {
  name: string;
}
