import { useRouter } from "next/router";
import { useEffect, type ReactNode } from "react";
import { ROUTES } from "@/constants";
import { useSessionReady } from "@/hooks";
import { useSessionStore } from "@/stores";
import { FullPageLoading } from "@/containers/FullPageLoading";

/** Renders its children only for logged-in users; everyone else is sent to /login. */
export function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const isReady = useSessionReady();
  const token = useSessionStore((state) => state.token);

  useEffect(() => {
    if (isReady && !token) void router.replace(ROUTES.LOGIN);
  }, [isReady, token, router]);

  if (!isReady || !token) return <FullPageLoading />;
  return children;
}
