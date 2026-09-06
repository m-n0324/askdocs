import { defineConfig } from "vitest/config"
import { testEnv } from "./tests/helpers/test-env"

export default defineConfig({
    test: {
        environment: "node",
        env: testEnv,
        // Integration tests share one database, so files run one at a time
        fileParallelism: false,
        coverage: {
            provider: "v8",
            include: ["src/**/*.ts"],
            exclude: ["src/generated/**", "src/server.ts", "src/worker.ts", "src/scripts/**"],
            reporter: ["text-summary", "html"],
        },
        projects: [
            {
                extends: true,
                test: { name: "unit", include: ["tests/unit/**/*.test.ts"] },
            },
            {
                extends: true,
                test: {
                    name: "integration",
                    include: ["tests/integration/**/*.test.ts"],
                    globalSetup: ["tests/helpers/global-setup.ts"],
                    setupFiles: ["tests/helpers/close-connections.ts"],
                },
            },
        ],
    },
})
