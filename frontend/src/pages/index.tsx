import Head from "next/head";

export default function HomePage() {
  return (
    <>
      <Head>
        <title>AskDocs</title>
      </Head>
      <main className="flex min-h-screen items-center justify-center">
        <h1 className="text-3xl font-semibold">AskDocs</h1>
      </main>
    </>
  );
}
