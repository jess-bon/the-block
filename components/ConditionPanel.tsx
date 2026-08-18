import { damageSeverity, titleStatusWarning, type DamageSeverity } from "@/lib/auction";
import { GradeBadge } from "./Badges";

const SEVERITY_ORDER: DamageSeverity[] = ["structural", "mechanical", "cosmetic"];

const SEVERITY_META: Record<
  DamageSeverity,
  { label: string; dot: string; text: string; note: string }
> = {
  structural: {
    label: "Structural",
    dot: "bg-warn",
    text: "text-warn",
    note: "Affects the vehicle's integrity or history. Inspect before bidding.",
  },
  mechanical: {
    label: "Mechanical",
    dot: "bg-live",
    text: "text-live",
    note: "Needs repair. Factor the cost into your bid.",
  },
  cosmetic: {
    label: "Cosmetic",
    dot: "bg-ink-faint",
    text: "text-ink-muted",
    note: "Appearance only.",
  },
};

/**
 * The condition story, ordered worst-first.
 *
 * The dataset hands damage over as an unordered list of free-text strings, so a
 * flood-damage note sits at the same visual weight as a scuffed door sill. We
 * classify each note and lead with the serious ones — a buyer scanning this
 * page should hit the disqualifying problems before the trivia.
 */
export function ConditionPanel({
  grade,
  report,
  damageNotes,
  titleStatus,
}: {
  grade: number;
  report: string;
  damageNotes: string[];
  titleStatus: string;
}) {
  const grouped = SEVERITY_ORDER.map((severity) => ({
    severity,
    notes: damageNotes.filter((note) => damageSeverity(note) === severity),
  })).filter((group) => group.notes.length > 0);

  const warning = titleStatusWarning(titleStatus);

  return (
    <section className="rounded-xl border border-hairline bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[15px] font-semibold">Condition</h2>
        <GradeBadge grade={grade} size="lg" />
      </div>

      {warning && (
        <p className="mt-4 flex gap-2.5 rounded-lg bg-warn-soft px-3 py-2.5 text-[13px] leading-relaxed text-warn">
          <span aria-hidden className="mt-0.5 font-bold">
            !
          </span>
          <span>{warning}</span>
        </p>
      )}

      <p className="mt-4 text-[13.5px] leading-relaxed text-ink-muted">{report}</p>

      <div className="mt-5">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
          Damage disclosed
        </h3>

        {damageNotes.length === 0 ? (
          <p className="mt-2 text-[13.5px] text-good">
            No damage disclosed by the inspecting dealer.
          </p>
        ) : (
          <div className="mt-3 space-y-4">
            {grouped.map((group) => {
              const meta = SEVERITY_META[group.severity];
              return (
                <div key={group.severity}>
                  <p className={`text-[12px] font-semibold ${meta.text}`}>
                    {meta.label} · {meta.note}
                  </p>
                  <ul className="mt-1.5 space-y-1.5">
                    {group.notes.map((note) => (
                      <li key={note} className="flex gap-2.5 text-[13.5px] text-ink-muted">
                        <span
                          aria-hidden
                          className={`mt-[7px] h-1.5 w-1.5 flex-none rounded-full ${meta.dot}`}
                        />
                        <span>{note}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
