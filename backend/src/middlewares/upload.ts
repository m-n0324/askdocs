import multer from "multer"
import { env } from "../config/env"

/**
 * Parses multipart/form-data uploads (field name "file") into memory.
 * Memory is fine because files are capped at MAX_UPLOAD_MB; the source service checks the
 * real file type and then writes the bytes to storage.
 */
export const uploadSingleFile = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: env.MAX_UPLOAD_MB * 1024 * 1024, files: 1 },
}).single("file")
