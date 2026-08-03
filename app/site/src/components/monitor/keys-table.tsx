/**
 * Per-key credit usage. Keys arrive already truncated (`ksk_abcd1234...wxyz`)
 * from `scripts/kiro_account_usage.py` — never render a full key here. The
 * static snapshot goes further and labels rows `account-NN` instead, since that
 * artifact is public (`scripts/build_monitor_snapshot.py`).
 */

import {
  ErrorNote,
  Panel,
  TableScroll,
  TD_CLASS,
  TH_CLASS,
  TR_CLASS,
} from "@/components/monitor/panel";
import { costToNum, fmtDecimal, toNum, type KeysResponse } from "@/lib/monitor";

const HEADERS = [
  "Key",
  "Email",
  "Plan",
  "Credits used",
  "Overages",
  "Est. cost",
  "Next reset",
  "Status",
];

export function KeysTable({ data }: { data: KeysResponse | null }) {
  if (!data) return null;
  const keys = data.keys ?? [];

  let totalUsed = 0;
  let totalCost = 0;
  for (const k of keys) {
    totalUsed += toNum(k.creditsUsed) ?? 0;
    totalCost += costToNum(k.estimatedCost) ?? 0;
  }

  return (
    <Panel title="API Keys" caption={`${keys.length} keys rotated per trial.`}>
      {data.error && <ErrorNote>{data.error}</ErrorNote>}
      <TableScroll>
        <table className="min-w-full">
          <thead className="bg-muted">
            <tr>
              {HEADERS.map((header) => (
                <th key={header} className={TH_CLASS}>
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-background">
            {keys.map((k) => {
              const used = toNum(k.creditsUsed);
              const allowance = toNum(k.planAllowance);
              const pct =
                used != null && allowance != null && allowance > 0
                  ? Math.min((used / allowance) * 100, 100)
                  : null;
              return (
                <tr key={k.key} className={TR_CLASS}>
                  <td className={`${TD_CLASS} font-mono text-xs`}>{k.key}</td>
                  <td className={TD_CLASS}>{k.email}</td>
                  <td className={TD_CLASS}>{k.plan}</td>
                  <td className={TD_CLASS}>
                    <div className="flex items-center gap-2">
                      <span>
                        {k.creditsUsed} / {k.planAllowance}
                      </span>
                      {pct != null && (
                        <span className="h-1.5 w-[90px] overflow-hidden rounded-full bg-neutral-200">
                          <span
                            className="block h-full bg-brand-green-dark"
                            style={{ width: `${pct}%` }}
                          />
                        </span>
                      )}
                    </div>
                  </td>
                  <td className={TD_CLASS}>{k.overages}</td>
                  <td className={TD_CLASS}>{k.estimatedCost}</td>
                  <td className={TD_CLASS}>{k.nextReset}</td>
                  <td
                    className={`${TD_CLASS} ${
                      k.status === "ok"
                        ? "text-brand-green-dark"
                        : "text-destructive"
                    }`}
                  >
                    {k.status}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="border-t border-border">
            <tr>
              <td className={`${TD_CLASS} font-medium`} colSpan={3}>
                Total ({keys.length} keys)
              </td>
              <td className={`${TD_CLASS} font-medium`}>
                {fmtDecimal(totalUsed)}
              </td>
              <td className={TD_CLASS} />
              <td className={`${TD_CLASS} font-medium`}>
                ${fmtDecimal(totalCost)}
              </td>
              <td className={TD_CLASS} colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </TableScroll>
    </Panel>
  );
}
