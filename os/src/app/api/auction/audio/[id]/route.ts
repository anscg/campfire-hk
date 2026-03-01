import { type NextRequest } from "next/server";
import https from "https";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Map of stable IDs → CDN URLs for auction audio assets.
// Proxied here so the browser never hits the CDN directly (avoids CORS issues
// caused by cdn.hackclub.com → user-cdn.hackclub-assets.com redirects).
const AUDIO_MAP: Record<string, string> = {
  bid:  "https://cdn.hackclub.com/019ca521-a10c-7397-af31-7d39bdd661c8/bid_audio.mp4",
  sold: "https://cdn.hackclub.com/019ca521-a276-744c-ac45-7cae7041babd/sold_audio.mp4",
  bgm:  "https://cdn.hackclub.com/019ca521-baea-78bd-9f8c-6668cc5891e8/broken_brass_-_the_hitchhiker__official_video__-_broken_brass_audio.mp4",
};

function fetchUrl(url: string): Promise<{ statusCode: number; headers: Record<string, string>; body: ReadableStream }> {
  return new Promise((resolve, reject) => {
    const makeRequest = (targetUrl: string, redirects = 0) => {
      if (redirects > 5) { reject(new Error("Too many redirects")); return; }
      const parsed = new URL(targetUrl);
      const mod = parsed.protocol === "https:" ? https : require("http");
      mod.get(targetUrl, (res: import("http").IncomingMessage) => {
        // Follow redirects
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume(); // drain
          makeRequest(res.headers.location, redirects + 1);
          return;
        }
        const contentType = (res.headers["content-type"] as string) ?? "audio/mp4";
        const contentLength = res.headers["content-length"] as string | undefined;
        const body = new ReadableStream<Uint8Array>({
          start(controller) {
            res.on("data", (chunk: Buffer) => controller.enqueue(new Uint8Array(chunk)));
            res.on("end", () => controller.close());
            res.on("error", (err: Error) => controller.error(err));
          },
        });
        const headers: Record<string, string> = { "Content-Type": contentType };
        if (contentLength) headers["Content-Length"] = contentLength;
        resolve({ statusCode: res.statusCode ?? 200, headers, body });
      }).on("error", reject);
    };
    makeRequest(url);
  });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const cdnUrl = AUDIO_MAP[id];
  if (!cdnUrl) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const { headers, body } = await fetchUrl(cdnUrl);
    return new Response(body, {
      headers: {
        ...headers,
        "Cache-Control": "public, max-age=86400, immutable",
      },
    });
  } catch {
    return new Response("Failed to fetch audio", { status: 502 });
  }
}
