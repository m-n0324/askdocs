import { describe, expect, it } from "vitest"
import { assertPublicUrl, isPrivateAddress } from "../../src/utils/url-safety"

describe("isPrivateAddress", () => {
    it.each([
        ["127.0.0.1", true],
        ["10.0.0.5", true],
        ["172.16.0.1", true],
        ["172.31.255.255", true],
        ["192.168.1.1", true],
        ["169.254.169.254", true], // cloud metadata endpoint
        ["0.0.0.0", true],
        ["::1", true],
        ["fd00::1", true],
        ["fe80::1", true],
        ["::ffff:127.0.0.1", true], // IPv4-mapped loopback
        ["::ffff:7f00:1", true], // same, hex form
        ["8.8.8.8", false],
        ["172.66.147.243", false], // public: 172.66 is outside 172.16.0.0/12
        ["2606:4700:10::ac42:93f3", false],
        ["::ffff:8.8.8.8", false],
        ["not-an-ip", true],
    ])("%s -> private=%s", (address, expected) => {
        expect(isPrivateAddress(address)).toBe(expected)
    })
})

describe("assertPublicUrl", () => {
    it.each([
        "ftp://example.com/file",
        "file:///etc/passwd",
        "http://user:pass@example.com",
        "http://localhost:6379",
        "http://api.localhost",
        "http://127.0.0.1:8080",
        "http://169.254.169.254/latest/meta-data",
        "http://[::1]/",
        "not a url",
    ])("rejects %s", async (url) => {
        await expect(assertPublicUrl(url)).rejects.toMatchObject({ statusCode: 400 })
    })

    it("accepts a public IP literal without DNS", async () => {
        const url = await assertPublicUrl("https://8.8.8.8/path?q=1")
        expect(url.hostname).toBe("8.8.8.8")
    })
})
