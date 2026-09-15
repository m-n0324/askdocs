import { useId, useRef, useState, type DragEvent } from "react";
import { ALLOWED_UPLOAD_EXTENSIONS, UPLOAD_FORMATS_LABEL } from "@/constants";
import { cx } from "@/utils";

interface IUploadDropzoneProps {
  onFiles: (files: File[]) => void;
  isUploading: boolean;
}

/** Click or drag & drop. Validation happens in the container so the rules live in one place. */
export function UploadDropzone({ onFiles, isUploading }: IUploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const hintId = useId();

  const handleDrop = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setIsDragging(false);
    const files = Array.from(event.dataTransfer.files);
    if (files.length > 0) onFiles(files);
  };

  return (
    <div>
      <button
        type="button"
        aria-describedby={hintId}
        disabled={isUploading}
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={cx(
          "group flex w-full flex-col items-start gap-3 rounded-sm border border-dashed px-6 py-8 text-left transition-colors duration-150",
          "disabled:cursor-progress disabled:opacity-70",
          isDragging ? "border-accent bg-accent-wash" : "border-rule-strong bg-paper-raised/60 hover:border-ink-muted",
        )}
      >
        <span className="font-display text-3xl leading-none text-ink">
          {isUploading ? "Uploading…" : isDragging ? "Drop to upload" : "Drop files here"}
        </span>
        <span className="text-sm text-ink-muted">
          or <span className="text-accent-strong underline decoration-1 underline-offset-4">browse your computer</span>
        </span>
        <span id={hintId} className="font-mono text-[11px] tracking-wide text-ink-faint">
          {UPLOAD_FORMATS_LABEL} · up to 10 MB each
        </span>
        <span className="text-xs text-ink-muted">
          Tip: Markdown and plain text are the smallest and fastest to index. Prefer them when you can.
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        hidden
        accept={ALLOWED_UPLOAD_EXTENSIONS.join(",")}
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = ""; // allow picking the same file again
          if (files.length > 0) onFiles(files);
        }}
      />
    </div>
  );
}
