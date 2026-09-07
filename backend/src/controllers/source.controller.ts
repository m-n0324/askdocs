import type { Request, Response } from "express"
import { badRequest } from "../lib/errors"
import { sendData } from "../lib/response"
import { getWorkspace } from "../middlewares/workspace"
import { parseId, urlSourceSchema } from "../schemas"
import {
    addFileSource,
    addUrlSource,
    getSource,
    getSourceFile,
    getSources,
    removeSource,
} from "../services/source.service"

export async function listSourcesHandler(req: Request, res: Response): Promise<void> {
    sendData(res, await getSources(getWorkspace(req).id))
}

export async function uploadSourceHandler(req: Request, res: Response): Promise<void> {
    if (!req.file) throw badRequest('Attach a file in the "file" form field')
    const source = await addFileSource(getWorkspace(req).id, {
        // multer decodes file names as latin1; re-decode so names like "résumé.pdf" survive
        originalName: Buffer.from(req.file.originalname, "latin1").toString("utf8"),
        mimeType: req.file.mimetype,
        buffer: req.file.buffer,
    })
    sendData(res, source, 201)
}

export async function addUrlSourceHandler(req: Request, res: Response): Promise<void> {
    sendData(res, await addUrlSource(getWorkspace(req).id, urlSourceSchema.parse(req.body)), 201)
}

export async function getSourceHandler(req: Request, res: Response): Promise<void> {
    sendData(res, await getSource(getWorkspace(req).id, parseId(req.params.sourceId, "Source")))
}

/** Streams the original upload back, so the UI can open a PDF at the cited page. */
export async function getSourceFileHandler(req: Request, res: Response): Promise<void> {
    const file = await getSourceFile(getWorkspace(req).id, parseId(req.params.sourceId, "Source"))
    res.status(200)
        .type(file.mimeType)
        .set("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(file.name)}`)
        .send(file.data)
}

export async function deleteSourceHandler(req: Request, res: Response): Promise<void> {
    await removeSource(getWorkspace(req).id, parseId(req.params.sourceId, "Source"))
    sendData(res, { deleted: true })
}
