/** Parses a complete text/event-stream body into a list of { event, data } frames. */
export function parseSseBody(body: string): { event: string; data: unknown }[] {
    return body
        .split("\n\n")
        .filter((frame) => frame.trim().length > 0)
        .map((frame) => {
            const lines = frame.split("\n")
            const event = lines.find((line) => line.startsWith("event: "))?.slice(7) ?? "message"
            const data = lines
                .filter((line) => line.startsWith("data: "))
                .map((line) => line.slice(6))
                .join("\n")
            return { event, data: JSON.parse(data) as unknown }
        })
}
