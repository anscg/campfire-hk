import { type NextRequest } from "next/server";
import http from "http";

const INTERNAL_API_URL = process.env.INTERNAL_API_URL ?? "http://localhost:3001";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const url = new URL(`${INTERNAL_API_URL}/api/auction/events`);
  url.searchParams.set("token", token);

  const stream = new ReadableStream({
    start(controller) {
      const r = http.request(
        {
          hostname: url.hostname,
          port: url.port || 3001,
          path: `${url.pathname}?${url.searchParams.toString()}`,
          method: "GET",
          headers: { Accept: "text/event-stream" },
        },
        (res) => {
          res.on("data", (chunk: Buffer) => {
            controller.enqueue(chunk);
          });
          res.on("end", () => {
            controller.close();
          });
          res.on("error", (err) => {
            controller.error(err);
          });
        }
      );
      r.on("error", (err) => {
        controller.error(err);
      });
      r.end();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
