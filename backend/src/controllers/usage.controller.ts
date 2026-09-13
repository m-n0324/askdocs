import type { Request, Response } from "express"
import { sendData } from "../lib/response"
import { getWorkspace } from "../middlewares/workspace"
import { getUsageSummary } from "../services/usage.service"

export async function getUsageHandler(req: Request, res: Response): Promise<void> {
    sendData(res, await getUsageSummary(getWorkspace(req).id))
}
