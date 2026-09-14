import { LoadingState } from "@/components";

export function FullPageLoading() {
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <LoadingState />
    </div>
  );
}
