import Head from "next/head";
import { NotFound } from "@/components";

export default function NotFoundPage() {
  return (
    <>
      <Head>
        <title>Page not found · AskDocs</title>
      </Head>
      <NotFound />
    </>
  );
}
