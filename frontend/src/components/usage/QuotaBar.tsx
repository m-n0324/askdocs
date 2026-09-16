import { cx, formatNumber, toPercent } from "@/utils";

// Past this share of the quota the bar switches to the warning color.
const WARNING_PERCENT = 90;

interface IQuotaBarProps {
  used: number;
  quota: number;
}

export function QuotaBar({ used, quota }: IQuotaBarProps) {
  const percent = toPercent(used, quota);
  const isNearLimit = percent >= WARNING_PERCENT;

  return (
    <div>
      <div className="flex items-baseline justify-between font-mono text-[12px] text-ink-muted">
        <span>
          {formatNumber(used)} / {formatNumber(quota)} tokens
        </span>
        <span className={cx(isNearLimit && "text-failed")}>{percent}%</span>
      </div>
      <div
        role="progressbar"
        aria-label="Monthly quota used"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="mt-2 h-2 w-full overflow-hidden rounded-xs bg-paper-sunk shadow-[inset_0_0_0_1px_var(--color-rule)]"
      >
        <div
          className={cx("h-full origin-left transition-transform duration-500", isNearLimit ? "bg-failed" : "bg-accent")}
          style={{ transform: `scaleX(${percent / 100})` }}
        />
      </div>
    </div>
  );
}
