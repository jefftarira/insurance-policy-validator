export const runtime = "nodejs";

export async function GET() {
  return Response.json({
    ok: true,
    service: "er-insurance-agent",
    time: new Date().toISOString(),
  });
}
