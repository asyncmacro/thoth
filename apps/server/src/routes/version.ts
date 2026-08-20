export function versionHandler(_request: Request, version = "0.1.0") {
  return new Response(JSON.stringify({ version }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
