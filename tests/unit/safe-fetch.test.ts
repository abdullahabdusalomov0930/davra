import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { safeFetch, SafeFetchError } from "@/server/safety/safe-fetch";

// Mocked DNS: "rebind.example" points at a private address, "mixed.example" has one public and one
// private address; everything else resolves normally.
vi.mock("node:dns", async (importOriginal) => {
  const dns = await importOriginal<typeof import("node:dns")>();
  const answers: Record<string, { address: string; family: number }[]> = {
    "rebind.example": [{ address: "10.0.0.5", family: 4 }],
    "mixed.example": [
      { address: "93.184.215.14", family: 4 },
      { address: "127.0.0.1", family: 4 },
    ],
    "metadata.example": [{ address: "169.254.169.254", family: 4 }],
  };
  const lookup = (hostname: string, options: object, callback: (...args: unknown[]) => void) =>
    answers[hostname] ? callback(null, answers[hostname]) : dns.lookup(hostname, options as never, callback as never);
  return { ...dns, default: { ...dns, lookup }, lookup };
});

async function code(promise: Promise<unknown>) {
  try {
    await promise;
    return "no error";
  } catch (error) {
    return error instanceof SafeFetchError ? error.code : String(error);
  }
}

describe("safeFetch", () => {
  let server: Server;
  let port: number;
  const hits: string[] = [];

  beforeAll(async () => {
    server = createServer((request, response) => {
      hits.push(request.url ?? "");
      const hop = /^\/hop\/(\d+)$/.exec(request.url ?? "");
      if (hop) return response.writeHead(302, { location: `/hop/${Number(hop[1]) + 1}` }).end();
      if (request.url === "/chain") return response.writeHead(301, { location: "/page" }).end();
      if (request.url === "/to-rebind") return response.writeHead(302, { location: "http://rebind.example/" }).end();
      if (request.url === "/big") return response.writeHead(200).end(Buffer.alloc(2 * 1024 * 1024, 97));
      response.writeHead(200, { "content-type": "text/html" }).end("<title>salom</title>");
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    port = (server.address() as AddressInfo).port;
  });

  afterAll(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  });

  const local = {
    userAgent: "DavraTest",
    isAllowedAddress: (a: string) => a === "127.0.0.1",
    isAllowedPort: () => true,
  };
  const base = () => `http://127.0.0.1:${port}`;

  it("fetches, reports the final URL and reads a body only when asked", async () => {
    const head = await safeFetch(`${base()}/chain`, { ...local, method: "HEAD" });
    expect(head).toMatchObject({ status: 200, url: `${base()}/page`, redirects: [`${base()}/chain`] });
    expect(head.body).toBeUndefined();
    const page = await safeFetch(`${base()}/page`, { ...local, maxBodyBytes: 1000 });
    expect(page.body?.toString()).toBe("<title>salom</title>");
    expect(page.contentType).toBe("text/html");
  });

  it("follows at most 3 redirects, each checked again", async () => {
    // /hop/1 → /hop/2 → /hop/3 → /hop/4: the fourth redirect is refused.
    expect(await code(safeFetch(`${base()}/hop/1`, { ...local, maxRedirects: 10 }))).toBe("too_many_redirects");
  });

  it("refuses a redirect to a host that resolves to a private address", async () => {
    hits.length = 0;
    expect(await code(safeFetch(`${base()}/to-rebind`, local))).toBe("blocked_address");
    expect(hits).toEqual(["/to-rebind"]);
  });

  it("refuses hosts with any private address, including the cloud metadata service", async () => {
    const defaults = { userAgent: "DavraTest" };
    expect(await code(safeFetch("http://rebind.example/", defaults))).toBe("blocked_address");
    expect(await code(safeFetch("http://mixed.example/", defaults))).toBe("blocked_address");
    expect(await code(safeFetch("http://metadata.example/latest/meta-data/", defaults))).toBe("blocked_address");
    expect(await code(safeFetch("http://169.254.169.254/latest/meta-data/", defaults))).toBe("blocked_address");
    expect(await code(safeFetch("http://[::ffff:7f00:1]/", defaults))).toBe("blocked_address");
  });

  it("allows only http(s), standard ports and URLs without credentials", async () => {
    const defaults = { userAgent: "DavraTest" };
    expect(await code(safeFetch("ftp://example.com/", defaults))).toBe("blocked_scheme");
    expect(await code(safeFetch("file:///etc/passwd", defaults))).toBe("blocked_scheme");
    expect(await code(safeFetch("https://example.com:8443/", defaults))).toBe("blocked_port");
    expect(await code(safeFetch("https://user:secret@example.com/", defaults))).toBe("credentials");
    expect(await code(safeFetch("not a url", defaults))).toBe("invalid_url");
  });

  it("reads at most 1 MB of a body, whatever is asked", async () => {
    const big = await safeFetch(`${base()}/big`, { ...local, maxBodyBytes: 5 * 1024 * 1024 });
    expect(big.body?.length).toBe(1024 * 1024);
    expect(big.bodyTruncated).toBe(true);
  });
});
