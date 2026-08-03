/**
 * EC2 worker fleet, oldest launch first. `Uptime` is derived on the client, so it
 * is only rendered after the first fetch resolves (no SSR/hydration skew).
 */

import {
  ErrorNote,
  Panel,
  TableScroll,
  TD_CLASS,
  TH_CLASS,
  TR_CLASS,
} from "@/components/monitor/panel";
import type { WorkersResponse } from "@/lib/monitor";

const HEADERS = [
  "Instance",
  "Type",
  "AZ",
  "State",
  "SSM",
  "Launched",
  "Uptime",
];

function fmtLaunched(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function hoursSince(iso: string): number | null {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return (Date.now() - t) / 3600000;
}

export function WorkersTable({ data }: { data: WorkersResponse | null }) {
  if (!data) return null;
  const workers = [...(data.workers ?? [])].sort(
    (a, b) => new Date(a.launched).getTime() - new Date(b.launched).getTime(),
  );

  return (
    <Panel
      title={`Workers (${workers.length})`}
      caption="systemd runs scripts/worker.sh on each instance; 3 trial loops per worker."
    >
      {data.error && <ErrorNote>{data.error}</ErrorNote>}
      {workers.length === 0 && !data.error ? (
        <p className="text-sm text-neutral-500">
          No worker instances are running.
        </p>
      ) : (
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
              {workers.map((w) => {
                const hrs = hoursSince(w.launched);
                return (
                  <tr key={w.id} className={TR_CLASS}>
                    <td className={`${TD_CLASS} font-mono text-xs`}>{w.id}</td>
                    <td className={TD_CLASS}>{w.type}</td>
                    <td className={TD_CLASS}>{w.az}</td>
                    <td
                      className={`${TD_CLASS} ${
                        w.state === "running"
                          ? "text-brand-green-dark"
                          : "text-destructive"
                      }`}
                    >
                      {w.state}
                    </td>
                    <td
                      className={`${TD_CLASS} ${
                        w.ssm === "Online" ? "" : "text-neutral-500"
                      }`}
                    >
                      {w.ssm}
                    </td>
                    <td className={TD_CLASS}>{fmtLaunched(w.launched)}</td>
                    <td className={TD_CLASS}>
                      {hrs != null ? `${hrs.toFixed(1)} h` : "-"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableScroll>
      )}
    </Panel>
  );
}
