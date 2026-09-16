import { Eyebrow } from "@/components/ui";
import type { IUsage } from "@/interfaces";
import { formatDate, formatNumber } from "@/utils";
import { QuotaBar } from "@/components/usage/QuotaBar";
import { UsageBreakdown } from "@/components/usage/UsageBreakdown";

export function UsageSummary({ usage }: { usage: IUsage }) {
  const { totals } = usage;

  return (
    <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <section aria-labelledby="usage-total">
        <Eyebrow>Since {formatDate(usage.periodStart)}</Eyebrow>
        <p id="usage-total" className="mt-3 font-display text-[clamp(3.5rem,2.5rem+4vw,6rem)] leading-none text-ink">
          {formatNumber(totals.totalTokens)}
        </p>
        <p className="mt-2 text-sm text-ink-muted">tokens used this period</p>

        <dl className="mt-8 grid grid-cols-2 border-t border-rule">
          <div className="border-r border-rule py-4 pr-4">
            <dt className="text-[13px] text-ink-faint">Prompt</dt>
            <dd className="mt-1 font-mono text-lg text-ink">{formatNumber(totals.promptTokens)}</dd>
          </div>
          <div className="py-4 pl-4">
            <dt className="text-[13px] text-ink-faint">Completion</dt>
            <dd className="mt-1 font-mono text-lg text-ink">{formatNumber(totals.completionTokens)}</dd>
          </div>
        </dl>

        {usage.monthlyQuota !== null && (
          <div className="mt-8">
            <Eyebrow className="mb-3">Monthly quota</Eyebrow>
            <QuotaBar used={totals.totalTokens} quota={usage.monthlyQuota} />
          </div>
        )}
      </section>

      <section aria-label="Usage by kind">
        <Eyebrow className="mb-3">By kind</Eyebrow>
        <UsageBreakdown byKind={usage.byKind} total={totals.totalTokens} />
      </section>
    </div>
  );
}
