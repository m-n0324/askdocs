import { describe, expect, it } from "vitest";
import { ApiError, isClientError, readApiError } from "@/lib/apiError";

const jsonResponse = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("readApiError", () => {
  it("uses the message and code from the error envelope", async () => {
    const error = await readApiError(
      jsonResponse({ success: false, message: "Email already in use", code: "CONFLICT" }, 409),
    );

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ message: "Email already in use", code: "CONFLICT", status: 409 });
  });

  it("falls back to a friendly message when the body is not JSON", async () => {
    const error = await readApiError(new Response("<html>Too large</html>", { status: 413 }));

    expect(error.message).toBe("That file is too large.");
    expect(error.status).toBe(413);
  });
});

describe("isClientError", () => {
  it("is true only for 4xx ApiErrors", () => {
    expect(isClientError(new ApiError("x", 404, "NOT_FOUND"))).toBe(true);
    expect(isClientError(new ApiError("x", 500, "INTERNAL_ERROR"))).toBe(false);
    expect(isClientError(new Error("network"))).toBe(false);
  });
});
