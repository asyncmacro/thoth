import { HttpError } from "./http-error.js";

export function handleError(error: unknown, ctx?: { requestId?: string }) {
  if (error instanceof HttpError) {
    return new Response(JSON.stringify({
      error: error.code,
      message: error.message,
      details: error.details,
    }), {
      status: error.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  const message = error instanceof Error ? error.message : "Internal server error";
  return new Response(JSON.stringify({
    error: "INTERNAL_ERROR",
    message,
    requestId: ctx?.requestId,
  }), {
    status: 500,
    headers: { "Content-Type": "application/json" },
  });
}
