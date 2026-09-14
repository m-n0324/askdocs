import Head from "next/head";
import { GuestGuard, LoginContainer } from "@/containers";

export default function LoginPage() {
  return (
    <>
      <Head>
        <title>Log in · AskDocs</title>
      </Head>
      <GuestGuard>
        <LoginContainer />
      </GuestGuard>
    </>
  );
}
