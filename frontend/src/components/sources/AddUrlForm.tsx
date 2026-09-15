import { useId, useState, type FormEvent } from "react";
import { Button, TextField } from "@/components/ui";
import { CRAWL_DEPTH, CRAWL_PAGES } from "@/constants";
import type { IAddUrlSourceInput } from "@/interfaces";
import { validateIntegerInRange, validateUrl } from "@/utils";

interface IAddUrlFormProps {
  onSubmit: (input: IAddUrlSourceInput) => Promise<unknown>;
  isSubmitting: boolean;
}

const DEPTH_OPTIONS = [
  { value: 0, label: "This page only" },
  { value: 1, label: "Page + linked pages" },
  { value: 2, label: "Two levels deep" },
];

export function AddUrlForm({ onSubmit, isSubmitting }: IAddUrlFormProps) {
  const depthId = useId();
  const [url, setUrl] = useState("");
  const [maxDepth, setMaxDepth] = useState<number>(CRAWL_DEPTH.default);
  const [maxPages, setMaxPages] = useState<string>(String(CRAWL_PAGES.default));
  const [errors, setErrors] = useState<{ url?: string | null; maxPages?: string | null }>({});

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = {
      url: validateUrl(url),
      maxPages: validateIntegerInRange(Number(maxPages), CRAWL_PAGES.min, CRAWL_PAGES.max),
    };
    setErrors(nextErrors);
    if (nextErrors.url || nextErrors.maxPages) return;
    try {
      await onSubmit({ url: url.trim(), maxDepth, maxPages: Number(maxPages) });
      setUrl("");
    } catch {
      // The container shows the error message; keep the URL so it can be fixed.
    }
  };

  return (
    <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-5">
      <TextField
        label="Website URL"
        type="url"
        inputMode="url"
        placeholder="https://docs.example.com/guide"
        value={url}
        error={errors.url}
        onChange={(event) => setUrl(event.target.value)}
      />
      <div className="grid grid-cols-[1fr_6rem] gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={depthId} className="font-mono text-[11px] tracking-[0.14em] text-ink-muted uppercase">
            Crawl depth
          </label>
          <select
            id={depthId}
            value={maxDepth}
            onChange={(event) => setMaxDepth(Number(event.target.value))}
            className="h-11 w-full rounded-xs border-b border-rule-strong bg-transparent text-[15px] text-ink hover:border-ink-muted focus:border-accent focus:outline-none"
          >
            {DEPTH_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <TextField
          label="Max pages"
          type="number"
          min={CRAWL_PAGES.min}
          max={CRAWL_PAGES.max}
          value={maxPages}
          error={errors.maxPages}
          onChange={(event) => setMaxPages(event.target.value)}
        />
      </div>
      <Button type="submit" variant="secondary" isLoading={isSubmitting} className="self-start">
        Add website
      </Button>
    </form>
  );
}
