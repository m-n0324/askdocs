import dns from "node:dns/promises"
import net from "node:net"
import { badRequest } from "../lib/errors"

/**
 * SSRF protection ("Server-Side Request Forgery").
 * Our server fetches URLs that users type in. Without this check a user could make it fetch
 * http://169.254.169.254/ (AWS instance credentials!), http://localhost:6379 (our Redis), or
 * other machines inside our private network. So we only allow public internet addresses.
 *
 * Known limitation: DNS could return a public IP for this check and a private one for the
 * real request ("DNS rebinding"). Fully closing that needs a custom HTTP agent that pins the
 * checked IP. It is noted in docs/ARCHITECTURE.md as a future improvement.
 */

const blockList = new net.BlockList()
for (const [network, prefix] of [
    ["0.0.0.0", 8], // "this" network
    ["10.0.0.0", 8], // private
    ["100.64.0.0", 10], // carrier-grade NAT
    ["127.0.0.0", 8], // loopback
    ["169.254.0.0", 16], // link-local, includes cloud metadata 169.254.169.254
    ["172.16.0.0", 12], // private
    ["192.0.0.0", 24], // IETF protocol assignments
    ["192.88.99.0", 24], // 6to4 relay
    ["192.168.0.0", 16], // private
    ["198.18.0.0", 15], // benchmarking
    ["224.0.0.0", 4], // multicast
    ["240.0.0.0", 4], // reserved
    ["168.63.129.16", 32], // Azure host metadata (a "public" IP that is really internal)
] as const) {
    blockList.addSubnet(network, prefix, "ipv4")
}
// Note: do NOT add the IPv4-mapped range ::ffff:0:0/96 here. Node's BlockList would then match
// every plain IPv4 address. Mapped addresses are unwrapped to IPv4 in `isPrivateAddress` instead.
for (const [network, prefix] of [
    ["::", 128], // unspecified
    ["::1", 128], // loopback
    ["::", 96], // IPv4-compatible (deprecated)
    ["64:ff9b::", 96], // NAT64: can be translated to ANY IPv4, including private ones
    ["2002::", 16], // 6to4: embeds an IPv4 address
    ["fec0::", 10], // site-local (deprecated)
    ["fc00::", 7], // unique local
    ["fe80::", 10], // link-local
    ["ff00::", 8], // multicast
] as const) {
    blockList.addSubnet(network, prefix, "ipv6")
}

/** "::ffff:127.0.0.1" and "::ffff:7f00:1" both mean IPv4 127.0.0.1. Returns null for other IPv6. */
function unwrapIpv4Mapped(address: string): string | null {
    const dotted = address.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i)
    if (dotted) return dotted[1]
    const hex = address.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i)
    if (!hex) return null
    const high = parseInt(hex[1], 16)
    const low = parseInt(hex[2], 16)
    return [high >> 8, high & 0xff, low >> 8, low & 0xff].join(".")
}

export function isPrivateAddress(address: string): boolean {
    const family = net.isIP(address)
    if (family === 4) return blockList.check(address, "ipv4")
    if (family === 6) {
        const mapped = unwrapIpv4Mapped(address)
        return mapped ? blockList.check(mapped, "ipv4") : blockList.check(address, "ipv6")
    }
    return true // not an IP at all: refuse rather than guess
}

/** Parses the URL and throws a 400 unless it is http(s) and resolves only to public IPs. */
export async function assertPublicUrl(rawUrl: string): Promise<URL> {
    let url: URL
    try {
        url = new URL(rawUrl)
    } catch {
        throw badRequest("Invalid URL")
    }

    if (url.protocol !== "http:" && url.protocol !== "https:") {
        throw badRequest("Only http and https URLs are allowed")
    }
    if (url.username || url.password) {
        throw badRequest("URLs with credentials are not allowed")
    }

    const hostname = url.hostname.replace(/^\[|\]$/g, "") // IPv6 literals come wrapped in []
    if (hostname === "localhost" || hostname.endsWith(".localhost")) {
        throw badRequest("URL points to a private or local network address")
    }

    let addresses: string[]
    if (net.isIP(hostname)) {
        addresses = [hostname]
    } else {
        try {
            addresses = (await dns.lookup(hostname, { all: true })).map((entry) => entry.address)
        } catch {
            throw badRequest(`Could not resolve host "${hostname}"`)
        }
    }

    if (addresses.length === 0 || addresses.some(isPrivateAddress)) {
        throw badRequest("URL points to a private or local network address")
    }
    return url
}
