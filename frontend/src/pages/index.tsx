import Head from "next/head";
import { HomeRedirectContainer } from "@/containers";

export default function HomePage() {
  return (
    <>
      <Head>
        <title>AskDocs</title>
      </Head>
      <HomeRedirectContainer />
    </>
  );
}
