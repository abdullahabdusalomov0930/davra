import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { isPublicAddress } from "@/server/safety/address";
import { checkLink, type LinkCheckOptions } from "@/server/link-check/check-link";

describe("isPublicAddress", () => {
  it("accepts public IPv4 and IPv6 addresses", () => {
    for (const address of ["8.8.8.8", "1.1.1.1", "172.32.0.1", "11.0.0.1", "2606:4700:4700::1111", "2a00:1450::1"]) {
      expect(isPublicAddress(address), address).toBe(true);
    }
  });

  it("refuses private, loopback, link-local and other special-purpose addresses", () => {
    for (const address of [
      "127.0.0.1",
      "127.255.0.9",
      "0.0.0.0",
      "10.1.2.3",
      "100.64.0.1",
      "169.254.169.254",
      "172.16.0.1",
      "172.31.255.255",
      "192.0.0.8",
      "192.0.2.10",
      "192.168.1.1",
      "198.18.0.1",
      "203.0.113.5",
      "224.0.0.1",
      "255.255.255.255",
      "::",
      "::1",
      "fe80::1",
      "fc00::1",
      "fd12:3456::1",
      "ff02::1",
      "2001:db8::1",
      "2001::1",
    ]) {
      expect(isPublicAddress(address), address).toBe(false);
    }
  });

  it("refuses IPv6 forms that wrap an IPv4 address", () => {
    for (const address of [
      "::ffff:127.0.0.1",
      "::ffff:7f00:1",
      "::ffff:8.8.8.8",
      "64:ff9b::7f00:1",
      "2002:7f00:1::1",
    ]) {
      expect(isPublicAddress(address), address).toBe(false);
    }
  });

  it("refuses anything that is not an IP address", () => {
    for (const address of ["", "localhost", "example.com", "fe80::1%eth0", "1.2.3"]) {
      expect(isPublicAddress(address), address).toBe(false);
    }
  });
});

describe("checkLink", () => {
  type Handler = (request: IncomingMessage, response: ServerResponse) => void;

  const routes: Record<string, Handler> = {
    "/ok": (_, response) => response.writeHead(200).end("salom"),
    "/head-not-allowed": (request, response) => response.writeHead(request.method === "HEAD" ? 405 : 200).end(),
    "/head-404": (request, response) => response.writeHead(request.method === "HEAD" ? 404 : 200).end(),
    "/gone": (_, response) => response.writeHead(410).end(),
    "/missing": (_, response) => response.writeHead(404).end(),
    "/error": (_, response) => response.writeHead(500).end(),
    "/forbidden": (_, response) => response.writeHead(403).end(),
    "/too-many": (_, response) => response.writeHead(429).end(),
    "/challenge": (_, response) => response.writeHead(503, { "cf-mitigated": "challenge" }).end(),
    "/redirect": (_, response) => response.writeHead(301, { location: "/redirect-2" }).end(),
    "/redirect-2": (_, response) => response.writeHead(302, { location: `http://127.0.0.1:${port}/ok` }).end(),
    "/loop": (_, response) => response.writeHead(302, { location: "/loop" }).end(),
    "/to-private": (_, response) => response.writeHead(302, { location: "http://10.0.0.1/admin" }).end(),
    "/to-file": (_, response) => response.writeHead(302, { location: "file:///etc/passwd" }).end(),
    "/no-location": (_, response) => response.writeHead(302).end(),
    "/slow": () => {
      // Never answers; the check must give up on its own.
    },
  };

  let server: Server;
  let port: number;
  const requests: { method?: string; path?: string; userAgent?: string }[] = [];

  beforeAll(async () => {
    server = createServer((request, response) => {
      requests.push({ method: request.method, path: request.url, userAgent: request.headers["user-agent"] });
      const handler = routes[request.url ?? ""];
      if (handler) handler(request, response);
      else response.writeHead(404).end();
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    port = (server.address() as AddressInfo).port;
  });

  afterAll(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  });

  // The test server is on 127.0.0.1, which the real checker refuses; these tests allow exactly that one.
  const options: LinkCheckOptions = {
    userAgent: "DavraLinkChecker/test",
    headTimeoutMs: 500,
    getTimeoutMs: 500,
    isAllowedAddress: (address) => address === "127.0.0.1",
    isAllowedPort: () => true,
  };
  const check = (path: string, overrides: Partial<LinkCheckOptions> = {}) =>
    checkLink(`http://127.0.0.1:${port}${path}`, { ...options, ...overrides });

  it("calls a page that answers ok, with a HEAD request and the bot's user agent", async () => {
    requests.length = 0;
    expect(await check("/ok")).toEqual({ outcome: "ok", reason: "http 200" });
    expect(requests).toEqual([{ method: "HEAD", path: "/ok", userAgent: "DavraLinkChecker/test" }]);
  });

  it("asks again with GET when HEAD is not answered properly", async () => {
    expect(await check("/head-not-allowed")).toEqual({ outcome: "ok", reason: "http 200" });
    expect(await check("/head-404")).toEqual({ outcome: "ok", reason: "http 200" });
  });

  it("calls missing pages and server errors failures", async () => {
    expect(await check("/missing")).toEqual({ outcome: "failure", reason: "http 404" });
    expect(await check("/gone")).toEqual({ outcome: "failure", reason: "http 410" });
    expect(await check("/error")).toEqual({ outcome: "failure", reason: "http 500" });
  });

  it("learns nothing from sites that refuse bots", async () => {
    expect(await check("/forbidden")).toEqual({ outcome: "unknown", reason: "http 403" });
    expect(await check("/too-many")).toEqual({ outcome: "unknown", reason: "http 429" });
    expect(await check("/challenge")).toEqual({ outcome: "unknown", reason: "bot challenge" });
  });

  it("follows redirects, up to a limit", async () => {
    expect(await check("/redirect")).toEqual({ outcome: "ok", reason: "http 200" });
    expect(await check("/no-location")).toEqual({ outcome: "ok", reason: "http 302" });
    expect(await check("/loop")).toEqual({ outcome: "unknown", reason: "too many redirects" });
  });

  it("refuses redirects to private addresses and to other schemes", async () => {
    expect(await check("/to-private")).toEqual({ outcome: "failure", reason: "blocked address" });
    expect(await check("/to-file")).toEqual({ outcome: "failure", reason: "not http" });
  });

  it("gives up on a page that never answers", async () => {
    expect(await check("/slow", { headTimeoutMs: 100, getTimeoutMs: 100 })).toEqual({
      outcome: "failure",
      reason: "timeout",
    });
  });

  it("calls a closed port a failure", async () => {
    const closed = createServer();
    await new Promise<void>((resolve) => closed.listen(0, "127.0.0.1", resolve));
    const closedPort = (closed.address() as AddressInfo).port;
    await new Promise((resolve) => closed.close(resolve));

    expect(await checkLink(`http://127.0.0.1:${closedPort}/`, options)).toEqual({
      outcome: "failure",
      reason: "refused",
    });
  });

  it("by default never connects to loopback or private addresses, by IP or by name", async () => {
    requests.length = 0;
    const { isAllowedAddress: _, ...defaults } = options;

    expect(await checkLink(`http://127.0.0.1:${port}/ok`, defaults)).toEqual({
      outcome: "failure",
      reason: "blocked address",
    });
    expect(await checkLink(`http://[::1]:${port}/ok`, defaults)).toEqual({
      outcome: "failure",
      reason: "blocked address",
    });
    expect(await checkLink(`http://localhost:${port}/ok`, defaults)).toEqual({
      outcome: "failure",
      reason: "blocked address",
    });
    // URL parsing turns shorthand and hex forms into a plain address first.
    expect(await checkLink(`http://0x7f.1:${port}/ok`, defaults)).toEqual({
      outcome: "failure",
      reason: "blocked address",
    });
    expect(requests).toEqual([]);
  });

  it("only fetches http and https links", async () => {
    expect(await checkLink("ftp://example.com/file", options)).toEqual({ outcome: "failure", reason: "not http" });
    expect(await checkLink("javascript:alert(1)", options)).toEqual({ outcome: "failure", reason: "not http" });
    expect(await checkLink("not a link", options)).toEqual({ outcome: "failure", reason: "invalid url" });
  });
});
