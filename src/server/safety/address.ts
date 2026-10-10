import "server-only";

import { BlockList, isIP } from "node:net";

/**
 * Which IP addresses the server may connect to when it follows a user's link (DECISIONS.md D57). Links are submitted by users,
 * so without this a link to http://169.254.169.254/ or http://localhost:5432/ would make our server
 * probe its own network for them (SSRF).
 */

// IPv4 ranges that are not on the public internet (RFC 6890 special-purpose registry).
const privateIpv4 = new BlockList();
for (const [network, prefix] of [
  ["0.0.0.0", 8], // "this network"
  ["10.0.0.0", 8], // private
  ["100.64.0.0", 10], // carrier-grade NAT
  ["127.0.0.0", 8], // loopback
  ["169.254.0.0", 16], // link-local, cloud metadata services
  ["172.16.0.0", 12], // private
  ["192.0.0.0", 24], // IETF protocol assignments
  ["192.0.2.0", 24], // documentation
  ["192.88.99.0", 24], // 6to4 relays
  ["192.168.0.0", 16], // private
  ["198.18.0.0", 15], // benchmarking
  ["198.51.100.0", 24], // documentation
  ["203.0.113.0", 24], // documentation
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // reserved, broadcast
] as const) {
  privateIpv4.addSubnet(network, prefix, "ipv4");
}

// IPv6: only global unicast (2000::/3) is public. Everything else (loopback, unique-local, link-local,
// multicast, IPv4-mapped and NAT64 forms that could smuggle a private IPv4 address) is refused.
const globalIpv6 = new BlockList();
globalIpv6.addSubnet("2000::", 3, "ipv6");

// …except the special-purpose blocks inside it.
const specialIpv6 = new BlockList();
for (const [network, prefix] of [
  ["2001::", 23], // IETF protocol assignments (Teredo, benchmarking, ORCHID)
  ["2001:db8::", 32], // documentation
  ["2002::", 16], // 6to4: embeds an IPv4 address
  ["3fff::", 20], // documentation
] as const) {
  specialIpv6.addSubnet(network, prefix, "ipv6");
}

/** True when `address` is an IP address on the public internet. Anything else is refused. */
export function isPublicAddress(address: string): boolean {
  try {
    switch (isIP(address)) {
      case 4:
        return !privateIpv4.check(address, "ipv4");
      case 6:
        return globalIpv6.check(address, "ipv6") && !specialIpv6.check(address, "ipv6");
      default:
        return false;
    }
  } catch {
    // Forms BlockList cannot parse (e.g. a zone index, "fe80::1%eth0") are never public.
    return false;
  }
}
