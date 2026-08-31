/**
 * Network-free DNS fixture for extraction tests.
 *
 * The production SSRF guard intentionally fails closed when DNS is unavailable.
 * Tests use IANA-reserved example hostnames with mocked provider HTTP responses,
 * so resolve only those names to a documentation-range public address. All other
 * lookups keep the real resolver behavior and private-address tests stay intact.
 */
import dns from "node:dns/promises";

const originalLookup = dns.lookup.bind(dns);

Object.defineProperty(dns, "lookup", {
  configurable: true,
  value: async (hostname: string, options?: { all?: boolean; verbatim?: boolean }) => {
    const normalized = String(hostname || "").toLowerCase().replace(/\.$/, "");
    if (
      normalized === "example.com"
      || normalized.endsWith(".example.com")
      || normalized === "example.org"
      || normalized.endsWith(".example.org")
      || normalized === "example.net"
      || normalized.endsWith(".example.net")
      || normalized.endsWith(".example")
    ) {
      const record = { address: "203.0.113.10", family: 4 as const };
      return options?.all ? [record] : record;
    }
    return originalLookup(hostname, options as any);
  },
});
