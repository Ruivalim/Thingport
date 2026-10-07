import React from "react";
import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { alpha, type Theme } from "@mui/material/styles";
import type { ActivityDay, ActivityKind } from "../../../api/activity";
import { buildWeeks, level, monthStarts, type DateRange } from "./calendar";

const CELL = 11;
const GAP = 3;
// The order the tooltip lists them in.
export const ACTIVITY_KINDS: ActivityKind[] = ["import", "upload", "download", "slicer", "delete"];
const LEVEL_ALPHA = [0, 0.3, 0.5, 0.75, 1];

function cellColor(theme: Theme, value: number): string {
  if (value === 0) return theme.palette.mode === "dark" ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.06)";
  return alpha(theme.palette.primary.main, LEVEL_ALPHA[value]);
}

type Props = {
  range: DateRange;
  days: ActivityDay[];
  /** The day the timeline starts from, outlined. */
  selectedDay: string | null;
  /** Days still to come can't be picked. */
  today: string;
  onSelectDay: (date: string) => void;
};

/** GitHub's contribution graph: a column per week, a square per day, darker the busier the day. */
export default function Heatmap({ range, days, selectedDay, today, onSelectDay }: Props) {
  const { t, i18n } = useTranslation("app");
  // Monday-first in Lithuanian, as its calendars are; Sunday-first otherwise, as GitHub's is.
  const weekStart = i18n.language.startsWith("lt") ? 1 : 0;
  const weeks = React.useMemo(() => buildWeeks(range, weekStart), [range, weekStart]);
  const months = React.useMemo(() => monthStarts(weeks), [weeks]);
  const byDate = React.useMemo(() => new Map(days.map((day) => [day.date, day.counts])), [days]);
  const max = React.useMemo(
    () => Math.max(0, ...days.map((day) => Object.values(day.counts).reduce((sum, n) => sum + (n ?? 0), 0))),
    [days],
  );

  // From the translations: the browser has no short Lithuanian month names and falls back to numbers.
  const monthNames = t("activity.monthsShort", { returnObjects: true }) as string[];
  const longDate = new Intl.DateTimeFormat(i18n.language, { dateStyle: "long", timeZone: "UTC" });
  const weekdayName = new Intl.DateTimeFormat(i18n.language, { weekday: "short", timeZone: "UTC" });
  // Every other row is labelled, as on GitHub. 4 January 2026 was a Sunday.
  const rowLabel = (row: number) =>
    row % 2 === 1 ? weekdayName.format(new Date(Date.UTC(2026, 0, 4 + ((row + weekStart) % 7)))) : "";

  return (
    <Box sx={{ overflowX: "auto", pb: 1 }}>
      <Box sx={{ display: "inline-grid", gridTemplateColumns: "auto auto", columnGap: 1, rowGap: 0.5 }}>
        <Box />
        <Box sx={{ position: "relative", height: 16, width: weeks.length * (CELL + GAP) }}>
          {months.map(({ column, month }) => (
            <Typography
              key={`${column}-${month}`}
              variant="caption"
              color="text.secondary"
              sx={{ position: "absolute", left: column * (CELL + GAP), top: 0, lineHeight: "16px" }}
            >
              {monthNames[month]}
            </Typography>
          ))}
        </Box>
        <Box sx={{ display: "grid", gridTemplateRows: `repeat(7, ${CELL}px)`, rowGap: `${GAP}px` }}>
          {Array.from({ length: 7 }, (_, row) => (
            <Typography
              key={row}
              variant="caption"
              color="text.secondary"
              sx={{ fontSize: 10, lineHeight: `${CELL}px` }}
            >
              {rowLabel(row)}
            </Typography>
          ))}
        </Box>
        <Box
          sx={{
            display: "grid",
            gridAutoFlow: "column",
            gridTemplateRows: `repeat(7, ${CELL}px)`,
            gridAutoColumns: `${CELL}px`,
            gap: `${GAP}px`,
          }}
        >
          {weeks.flat().map(({ date, inRange }) => {
            if (!inRange) return <Box key={date} />;
            const counts = byDate.get(date) ?? {};
            const total = Object.values(counts).reduce((sum, n) => sum + (n ?? 0), 0);
            return (
              <Tooltip
                key={date}
                arrow
                disableInteractive
                placement="top"
                title={
                  <DayTooltip date={longDate.format(new Date(`${date}T00:00:00Z`))} counts={counts} total={total} />
                }
              >
                <Box
                  component="button"
                  type="button"
                  aria-label={t("activity.dayLabel", { count: total, date })}
                  aria-pressed={date === selectedDay}
                  // Not `disabled`: a Tooltip can't show over a disabled button.
                  aria-disabled={date > today}
                  onClick={() => {
                    if (date <= today) onSelectDay(date);
                  }}
                  sx={{
                    display: "block",
                    p: 0,
                    border: 0,
                    width: CELL,
                    height: CELL,
                    borderRadius: "2px",
                    cursor: date > today ? "default" : "pointer",
                    bgcolor: (theme) => cellColor(theme, level(total, max)),
                    outline: date === selectedDay ? "2px solid" : "1px solid",
                    outlineColor: (theme) =>
                      date === selectedDay ? theme.thingport.headingText : alpha(theme.palette.text.primary, 0.04),
                    outlineOffset: date === selectedDay ? 1 : -1,
                    "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: 1 },
                  }}
                />
              </Tooltip>
            );
          })}
        </Box>
      </Box>
      <Stack direction="row" alignItems="center" justifyContent="flex-end" spacing={0.5} sx={{ mt: 1 }}>
        <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5 }}>
          {t("activity.less")}
        </Typography>
        {[0, 1, 2, 3, 4].map((value) => (
          <Box
            key={value}
            sx={{ width: CELL, height: CELL, borderRadius: "2px", bgcolor: (theme) => cellColor(theme, value) }}
          />
        ))}
        <Typography variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
          {t("activity.more")}
        </Typography>
      </Stack>
    </Box>
  );
}

function DayTooltip({ date, counts, total }: { date: string; counts: ActivityDay["counts"]; total: number }) {
  const { t } = useTranslation("app");
  return (
    <Box sx={{ py: 0.25 }}>
      <Typography variant="caption" sx={{ display: "block", fontWeight: 700 }}>
        {total ? t("activity.dayTotal", { count: total, date }) : t("activity.dayEmpty", { date })}
      </Typography>
      {ACTIVITY_KINDS.filter((kind) => counts[kind]).map((kind) => (
        <Box key={kind} sx={{ display: "flex", justifyContent: "space-between", gap: 2 }}>
          <Typography variant="caption">{t(`activity.kinds.${kind}`)}</Typography>
          <Typography variant="caption" fontWeight={600}>
            {counts[kind]}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}
