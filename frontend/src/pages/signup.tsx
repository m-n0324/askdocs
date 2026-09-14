import Head from "next/head";
import { GuestGuard, SignupContainer } from "@/containers";

export default function SignupPage() {
  return (
    <>
      <Head>
        <title>Sign up · AskDocs</title>
      </Head>
      <GuestGuard>
        <SignupContainer />
      </GuestGuard>
    </>
  );
}
