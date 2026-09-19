import { describe, expect, it } from "vitest"
import { findMissingModels, isLocalUrl, withDefaultTag } from "../../src/scripts/ollama-setup"

describe("ollama setup helpers", () => {
    it("treats a model name without a tag as ':latest', like Ollama does", () => {
        expect(withDefaultTag("nomic-embed-text")).toBe("nomic-embed-text:latest")
        expect(withDefaultTag("qwen2.5:3b")).toBe("qwen2.5:3b")
    })

    it("finds which configured models still need to be pulled", () => {
        const installed = ["qwen2.5:3b", "nomic-embed-text:latest"]

        expect(findMissingModels(installed, ["qwen2.5:3b", "nomic-embed-text"])).toEqual([])
        expect(findMissingModels(installed, ["llama3.2:3b", "nomic-embed-text"])).toEqual([
            "llama3.2:3b",
        ])
        // the same model configured twice is only pulled once
        expect(findMissingModels([], ["all-minilm", "all-minilm:latest"])).toEqual(["all-minilm"])
    })

    it("only offers to start Ollama when it is supposed to run on this machine", () => {
        expect(isLocalUrl("http://localhost:11434")).toBe(true)
        expect(isLocalUrl("http://127.0.0.1:11434")).toBe(true)
        expect(isLocalUrl("http://host.docker.internal:11434")).toBe(false)
        expect(isLocalUrl("http://gpu-box.lan:11434")).toBe(false)
    })
})
