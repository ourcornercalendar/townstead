import type { Doc, Id } from "../../../convex/_generated/dataModel";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
  Font,
} from "@react-pdf/renderer";
import { expandEventOccurrences } from "@/lib/events/recurrence";
import React from "react";

Font.registerHyphenationCallback((word) => [word]);

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const DAY_HEADERS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const PALETTE = {
  border: "#d6d3cd",
  monthHeaderBg: "#c8e6dc",
  dayHeaderBg: "#e9e2c0",
  ink: "#1a1a1a",
  mutedInk: "#4a4a4a",
  // School district dates. A red that still reads as red on newsprint and in
  // one-colour photocopies, rather than a bright screen red that prints muddy.
  scusd: "#c0140f",
};

const styles = StyleSheet.create({
  page: {
    padding: 0,
    fontFamily: "Helvetica",
    color: PALETTE.ink,
    fontSize: 10,
  },
  monthHeader: {
    backgroundColor: PALETTE.monthHeaderBg,
    paddingVertical: 7,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  editionInfo: {
    position: "absolute",
    left: 14,
    top: 9,
    fontSize: 9,
    fontStyle: "italic",
    color: PALETTE.mutedInk,
  },
  monthTitle: {
    fontSize: 14,
    fontWeight: "bold",
    letterSpacing: 0.4,
  },
  grid: {
    flexGrow: 1,
    flexDirection: "column",
  },
  dayHeaderRow: {
    flexDirection: "row",
    backgroundColor: PALETTE.dayHeaderBg,
    borderTopWidth: 0.5,
    borderTopColor: PALETTE.border,
  },
  dayHeaderCell: {
    flex: 1,
    paddingVertical: 4,
    textAlign: "center",
    fontSize: 9,
    fontWeight: "bold",
    borderRightWidth: 0.5,
    borderRightColor: PALETTE.border,
  },
  dayHeaderCellLast: {
    borderRightWidth: 0,
  },
  weekRow: {
    flexDirection: "row",
    flexGrow: 1,
    borderTopWidth: 0.5,
    borderTopColor: PALETTE.border,
  },
  dayCell: {
    flex: 1,
    borderRightWidth: 0.5,
    borderRightColor: PALETTE.border,
    padding: 4,
    position: "relative",
  },
  dayCellLast: {
    borderRightWidth: 0,
  },
  dayNumber: {
    position: "absolute",
    top: 3,
    right: 5,
    fontSize: 11,
    fontWeight: "bold",
  },
  // The three bands a square is divided into. Each takes an equal share of the
  // height, so "middle" is genuinely the middle of the square rather than
  // "after whatever happens to be above it".
  //
  // The top band is pushed down to clear the day number, which is drawn in the
  // corner over the top of everything.
  bandTop: {
    flex: 1,
    justifyContent: "flex-start",
    paddingTop: 13,
  },
  bandMiddle: {
    flex: 1,
    justifyContent: "center",
  },
  bandBottom: {
    flex: 1,
    justifyContent: "flex-end",
  },
  eventsList: {
    flexGrow: 1,
    flexDirection: "column",
    paddingRight: 2,
  },
  eventItem: {
    marginBottom: 1.5,
  },
  eventTitle: {
    fontSize: 8,
    fontWeight: "bold",
    lineHeight: 1.2,
  },
  eventDescription: {
    fontSize: 7.5,
    lineHeight: 1.15,
  },
  scusdInk: {
    color: PALETTE.scusd,
  },
  splitDayCell: {
    flex: 1,
    borderRightWidth: 0.5,
    borderRightColor: PALETTE.border,
    flexDirection: "column",
    padding: 0,
  },
  splitHalf: {
    flex: 1,
    padding: 4,
    position: "relative",
  },
  splitHalfTop: {
    borderBottomWidth: 0.5,
    borderBottomColor: PALETTE.border,
  },
  splitDayNumber: {
    position: "absolute",
    top: 2,
    right: 4,
    fontSize: 9,
    fontWeight: "bold",
  },
  splitEventsList: {
    flexGrow: 1,
    flexDirection: "column",
    paddingTop: 9,
  },
  splitEventItem: {
    marginBottom: 0.5,
  },
  splitEventTitle: {
    fontSize: 7,
    fontWeight: "bold",
    lineHeight: 1.1,
  },
  splitEventDescription: {
    fontSize: 6.5,
    lineHeight: 1.1,
  },
});

/**
 * One event as it appears on a printed square.
 *
 * The name is set in bold and the description follows in regular, because
 * Joyce's designer is laying out a square about an inch across and the reader
 * needs to find the name first. The time is not here at all: it was cluttering
 * squares that have room for two lines, and where it matters it is on the
 * website.
 */
type PrintedEvent = {
  name: string;
  description?: string;
  placement: Placement;
  scusd: boolean;
};

type Placement = "TOP" | "MIDDLE" | "BOTTOM";

const PLACEMENTS: Placement[] = ["TOP", "MIDDLE", "BOTTOM"];

/** Absent means the top -- where everything printed before there was a choice. */
function placementOf(event: Doc<"events">): Placement {
  const p = (event as { printPlacement?: string }).printPlacement;
  return p === "MIDDLE" || p === "BOTTOM" ? p : "TOP";
}

type CalendarDayCell = {
  day: number | null;
  events: PrintedEvent[];
};

/** The events for one band, in the order they were added. */
function inBand(events: PrintedEvent[], band: Placement): PrintedEvent[] {
  return events.filter((e) => e.placement === band);
}

function buildMonthCells(
  year: number,
  monthIndex: number,
  events: Doc<"events">[]
): { cells: CalendarDayCell[]; needsSplit: boolean } {
  const firstDayOfWeek = new Date(year, monthIndex, 1).getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

  const eventNamesByDay = new Map<number, PrintedEvent[]>();
  for (const event of events) {
    const occurrences = expandEventOccurrences(event, year);
    for (const occ of occurrences) {
      const d = new Date(occ.date);
      if (d.getFullYear() !== year || d.getMonth() !== monthIndex) continue;
      const day = d.getDate();
      if (!eventNamesByDay.has(day)) eventNamesByDay.set(day, []);
      eventNamesByDay.get(day)!.push({
        name: event.name,
        description: event.description,
        placement: placementOf(event),
        scusd: (event as { isScusd?: boolean }).isScusd === true,
      });
    }
  }

  const cells: CalendarDayCell[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) cells.push({ day: null, events: [] });
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ day, events: eventNamesByDay.get(day) ?? [] });
  }
  // Pad to multiple of 7
  while (cells.length % 7 !== 0) cells.push({ day: null, events: [] });

  const needsSplit = cells.length > 35;
  return { cells, needsSplit };
}

/** What react-pdf accepts as a style, without naming its internal types. */
type PdfStyle = NonNullable<React.ComponentProps<typeof View>["style"]>;

/** One event: name in bold, description beneath it in regular. */
function EventLines({
  event,
  titleStyle,
  descriptionStyle,
  itemStyle,
}: {
  event: PrintedEvent;
  titleStyle: PdfStyle;
  descriptionStyle: PdfStyle;
  itemStyle: PdfStyle;
}) {
  const ink = event.scusd ? styles.scusdInk : {};
  return (
    <View style={itemStyle}>
      <Text style={[titleStyle, ink]}>{event.name}</Text>
      {event.description ? (
        <Text style={[descriptionStyle, ink]}>{event.description}</Text>
      ) : null}
    </View>
  );
}

function DayCell({
  cell,
  isLast,
}: {
  cell: CalendarDayCell;
  isLast: boolean;
}) {
  const bandStyles: Record<Placement, PdfStyle> = {
    TOP: styles.bandTop,
    MIDDLE: styles.bandMiddle,
    BOTTOM: styles.bandBottom,
  };

  return (
    <View style={[styles.dayCell, isLast ? styles.dayCellLast : {}]}>
      {cell.day !== null && (
        <>
          <Text style={styles.dayNumber}>{cell.day}</Text>
          {/* All three bands are always drawn, even when empty. That is what
              holds an event placed at the bottom actually at the bottom
              rather than immediately under the one above it. */}
          <View style={styles.eventsList}>
            {PLACEMENTS.map((band) => (
              <View key={band} style={bandStyles[band]}>
                {inBand(cell.events, band).map((event, idx) => (
                  <EventLines
                    key={idx}
                    event={event}
                    itemStyle={styles.eventItem}
                    titleStyle={styles.eventTitle}
                    descriptionStyle={styles.eventDescription}
                  />
                ))}
              </View>
            ))}
          </View>
        </>
      )}
    </View>
  );
}

function SplitDayCell({
  topCell,
  bottomCell,
  isLast,
}: {
  topCell: CalendarDayCell;
  bottomCell: CalendarDayCell;
  isLast: boolean;
}) {
  // A squeezed square -- the fifth and sixth weeks share one cell -- so the
  // three bands would be a couple of millimetres each and mean nothing. The
  // events are listed in placement order instead, which keeps the same
  // sequence without pretending to a precision the space does not allow.
  const renderHalf = (cell: CalendarDayCell, isTop: boolean) => {
    const ordered = PLACEMENTS.flatMap((band) => inBand(cell.events, band));
    return (
      <View style={[styles.splitHalf, isTop ? styles.splitHalfTop : {}]}>
        {cell.day !== null && (
          <>
            <Text style={styles.splitDayNumber}>{cell.day}</Text>
            <View style={styles.splitEventsList}>
              {ordered.slice(0, 3).map((event, idx) => (
                <EventLines
                  key={idx}
                  event={event}
                  itemStyle={styles.splitEventItem}
                  titleStyle={styles.splitEventTitle}
                  descriptionStyle={styles.splitEventDescription}
                />
              ))}
            </View>
          </>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.splitDayCell, isLast ? styles.dayCellLast : {}]}>
      {renderHalf(topCell, true)}
      {renderHalf(bottomCell, false)}
    </View>
  );
}

function MonthPage({
  year,
  monthIndex,
  editionLabel,
  events,
}: {
  year: number;
  monthIndex: number;
  editionLabel: string;
  events: Doc<"events">[];
}) {
  const { cells, needsSplit } = buildMonthCells(year, monthIndex, events);
  const completeRows = needsSplit ? 4 : 5;
  const rows: CalendarDayCell[][] = [];
  for (let r = 0; r < completeRows; r++) {
    rows.push(cells.slice(r * 7, r * 7 + 7));
  }

  return (
    <Page size="LETTER" orientation="landscape" style={styles.page}>
      <View style={styles.monthHeader}>
        <Text style={styles.editionInfo}>
          {year} {editionLabel}
        </Text>
        <Text style={styles.monthTitle}>
          {MONTH_NAMES[monthIndex]} {year}
        </Text>
      </View>
      <View style={styles.grid}>
        <View style={styles.dayHeaderRow}>
          {DAY_HEADERS.map((d, idx) => (
            <Text
              key={d}
              style={[
                styles.dayHeaderCell,
                idx === 6 ? styles.dayHeaderCellLast : {},
              ]}
            >
              {d}
            </Text>
          ))}
        </View>
        {rows.map((row, rIdx) => (
          <View key={rIdx} style={styles.weekRow}>
            {row.map((cell, cIdx) => (
              <DayCell
                key={cIdx}
                cell={cell}
                isLast={cIdx === 6}
              />
            ))}
          </View>
        ))}
        {needsSplit && (
          <View style={styles.weekRow}>
            {Array.from({ length: 7 }).map((_, cIdx) => {
              const top = cells[28 + cIdx] ?? { day: null, events: [] };
              const bottom = cells[35 + cIdx] ?? { day: null, events: [] };
              return (
                <SplitDayCell
                  key={cIdx}
                  topCell={top}
                  bottomCell={bottom}
                  isLast={cIdx === 6}
                />
              );
            })}
          </View>
        )}
      </View>
    </Page>
  );
}

export type CalendarPdfInput = {
  year: number;
  events: Doc<"events">[];
  editionLabel?: string;
  calendarEditionId?: Id<"calendarEditions"> | null;
};

export async function generateCalendarPdf(
  input: CalendarPdfInput
): Promise<Buffer> {
  const editionLabel = input.editionLabel ?? "Community Calendar";
  const events = input.calendarEditionId
    ? input.events.filter((e) =>
        (e.calendarEditionIds ?? []).includes(input.calendarEditionId!)
      )
    : input.events;

  const doc = (
    <Document
      title={`${editionLabel} ${input.year}`}
      author="Townstead"
      creator="Townstead"
      producer="Townstead"
    >
      {MONTH_NAMES.map((_, monthIndex) => (
        <MonthPage
          key={monthIndex}
          year={input.year}
          monthIndex={monthIndex}
          editionLabel={editionLabel}
          events={events}
        />
      ))}
    </Document>
  );

  return renderToBuffer(doc);
}
