import { useMutation } from "@tanstack/react-query";
import { OBJECT_URL_TTL_MS } from "@/constants";
import type { ICitation } from "@/interfaces";
import { getSourceFile } from "@/services";
import { isHttpUrl, isPdf, isTextFile } from "@/utils";

const PDF_MIME = "application/pdf";
// Markdown is shown as plain text too: never as HTML, so the file's content can't run as a page.
const TEXT_MIME = "text/plain;charset=utf-8";

function downloadBlobUrl(objectUrl: string, fileName: string) {
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = fileName;
  link.rel = "noopener";
  link.click();
}

/**
 * Opens the original source behind a citation:
 * - website  -> its URL in a new tab
 * - PDF      -> the file in a new tab, jumping to the cited page (#page=N)
 * - MD / TXT -> the text in a new tab
 * - DOCX     -> downloads the file
 * Files need the auth header, so we fetch them as a Blob and use an object URL.
 */
export function useOpenSource(workspaceId: string) {
  return useMutation({
    mutationFn: async (citation: ICitation) => {
      if (citation.sourceType === "url") {
        // The URL comes from crawled data, so only ever open real web pages.
        if (!citation.url || !isHttpUrl(citation.url)) throw new Error("This source has no web address to open.");
        window.open(citation.url, "_blank", "noopener,noreferrer");
        return;
      }

      const asPdf = isPdf(citation.sourceName);
      const asText = isTextFile(citation.sourceName);
      const opensInTab = asPdf || asText;
      // Open the tab right away, inside the click, so popup blockers allow it.
      const tab = opensInTab ? window.open("", "_blank") : null;
      if (opensInTab && !tab) throw new Error("Your browser blocked the new tab. Allow pop-ups for this site to view the file.");

      try {
        const blob = await getSourceFile(workspaceId, citation.sourceId);
        // The browser only shows its PDF viewer (or the text) if the blob has the right type.
        const viewType = asPdf ? PDF_MIME : asText ? TEXT_MIME : null;
        const typedBlob = viewType ? new Blob([blob], { type: viewType }) : blob;
        const objectUrl = URL.createObjectURL(typedBlob);
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), OBJECT_URL_TTL_MS);

        if (!opensInTab) return downloadBlobUrl(objectUrl, citation.sourceName);

        const target = asPdf && citation.page ? `${objectUrl}#page=${citation.page}` : objectUrl;
        if (tab) {
          tab.opener = null;
          tab.location.href = target;
        }
      } catch (error) {
        tab?.close();
        throw error;
      }
    },
  });
}
