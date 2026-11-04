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
import {
  bySlot,
  inPrintOrder,
  fitToSquare,
} from "@/lib/events/print-priority";
// The month is laid out by a function the on-screen preview also calls, so
// "preview" genuinely means "what will print" rather than a second opinion.
import {
  buildPrintMonth,
  type CalendarDayCell,
  type PrintedEvent,
} from "@/lib/events/print-month";
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
    // A width, because this sits absolutely positioned in a header whose
    // centred month title leaves it almost none. Without one it was
    // squeezed to about three characters wide, so "2027 Elk Grove" wrapped
    // onto three lines that were then drawn on top of each other — it read
    // as "2027 / Elk" with "Grove" hidden underneath.
    width: 190,
    maxLines: 1,
    textOverflow: "ellipsis",
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
  // EVERY WEEK ROW THE SAME HEIGHT.
  //
  // `flexBasis: 0` is what forces that: it tells the layout to divide the
  // page evenly between the rows and ignore how much is in each one.
  // Without it (the default, "auto") a row grew to fit its busiest day, so
  // a month with one crowded Saturday printed with rows of three different
  // heights and a grid that does not line up.
  //
  // This calendar is sent to a designer and printed on paper, where the
  // squares have to be squares. A day holding more than fits is clipped at
  // its own border — see dayCell — rather than pushing the weeks below it
  // out of true.
  weekRow: {
    flexDirection: "row",
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    borderTopWidth: 0.5,
    borderTopColor: PALETTE.border,
  },
  dayCell: {
    flex: 1,
    borderRightWidth: 0.5,
    borderRightColor: PALETTE.border,
    padding: 4,
    position: "relative",
    // Now that a row cannot stretch, this is what stops an over-full day
    // printing across the week beneath it. Clipped at the border is a
    // problem the designer can see; printed over next Tuesday is not.
    overflow: "hidden",
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
  // A slot GROWS to share out spare height — that is what holds an event at
  // position 5 down on the floor — but it has to START from the size of the
  // text inside it.
  //
  // `flex: 1` is shorthand for `flexGrow:1, flexShrink:1, flexBasis:0%`, and
  // that last part is what smeared Joyce's downloaded calendar: a basis of 0
  // tells the layout to IGNORE the text when sharing out the height. Four
  // events in one square were each handed an equal 18pt while needing about
  // 55, so every one of them printed across the next three.
  //
  // "auto" starts from what the text actually needs, and flexGrow shares out
  // only what is left over.
  slotFirst: {
    flexGrow: 1,
    // Never squeezed below its own text. With the week rows now a fixed
    // height this matters: a shrunk slot does not clip, it lets its text
    // spill over whatever is underneath. The clipping happens at the cell
    // border instead, which is where it belongs.
    flexShrink: 0,
    flexBasis: "auto",
    justifyContent: "flex-start",
    // Clear of the day number in the corner.
    paddingTop: 13,
  },
  slotMiddle: {
    flexGrow: 1,
    // Never squeezed below its own text. With the week rows now a fixed
    // height this matters: a shrunk slot does not clip, it lets its text
    // spill over whatever is underneath. The clipping happens at the cell
    // border instead, which is where it belongs.
    flexShrink: 0,
    flexBasis: "auto",
    justifyContent: "center",
  },
  slotLast: {
    flexGrow: 1,
    // Never squeezed below its own text. With the week rows now a fixed
    // height this matters: a shrunk slot does not clip, it lets its text
    // spill over whatever is underneath. The clipping happens at the cell
    // border instead, which is where it belongs.
    flexShrink: 0,
    flexBasis: "auto",
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
  moreNote: {
    fontSize: 7,
    fontStyle: "italic",
    color: PALETTE.mutedInk,
  },
  eventTitle: {
    fontSize: 8,
    fontWeight: "bold",
    // 1.4, not 1.2. Helvetica's glyph box measures about 1.38 of the font
    // size, so tighter leading drew each line a point and a half into the
    // one above it and the words looked bruised.
    lineHeight: 1.4,
  },
  eventDescription: {
    fontSize: 7.5,
    // Same reason; at 1.15 this was the worse of the two.
    lineHeight: 1.4,
    // Explicit, because this renders nested inside the name's Text (see
    // EventLines) and would otherwise inherit its bold. The name is bold
    // so the eye finds it first in an inch-wide square.
    fontWeight: "normal",
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
    // Now that a row cannot stretch, this is what stops an over-full day
    // printing across the week beneath it. Clipped at the border is a
    // problem the designer can see; printed over next Tuesday is not.
    overflow: "hidden",
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
 * How one slot divides the square.
 *
 * Each slot takes an equal share of the height; the first hugs the top, the
 * last hugs the floor and the rest sit in the middle of their share. With
 * five slots that puts positions 1, 3 and 5 exactly where the old TOP,
 * MIDDLE and BOTTOM bands put their events, which is why switching to
 * numbers changed nothing on paper until somebody used it.
 */
function slotStyle(index: number, total: number): PdfStyle {
  if (index === 0) return styles.slotFirst;
  if (index === total - 1) return styles.slotLast;
  return styles.slotMiddle;
}

/**
 * One event as it appears on a printed square.
 *
 * The name is set in bold and the description follows in regular, because
 * Joyce's designer is laying out a square about an inch across and the reader
 * needs to find the name first. The time is not here at all: it was cluttering
 * squares that have room for two lines, and where it matters it is on the
 * website.
 */

/** What react-pdf accepts as a style, without naming its internal types. */
type PdfStyle = NonNullable<React.ComponentProps<typeof View>["style"]>;

/** One event: name in bold, description beneath it in regular. */
function EventLines({
  event,
  titleStyle,
  descriptionStyle,
  itemStyle,
  maxLines,
}: {
  event: PrintedEvent;
  titleStyle: PdfStyle;
  descriptionStyle: PdfStyle;
  itemStyle: PdfStyle;
  /**
   * How many lines this event may use. The square is a fixed size, so the
   * budget has to be enforced here rather than hoped for — without a cap
   * the layout engine squeezes the lines together and they print over each
   * other instead of being cut.
   */
  maxLines?: number;
}) {
  const ink = event.scusd ? styles.scusdInk : {};
  return (
    <View style={itemStyle}>
      {/* The description is nested INSIDE the name's Text, not a sibling
          beside it, and that is deliberate.

          A <Text> that wraps reports a ONE-LINE height to the layout when
          the space around it is tight — which it now always is, because a
          week row is a fixed height. A sibling placed under it is therefore
          positioned under the FIRST line of the name, and the rest of the
          name prints straight through the description. One flow lays out
          correctly, because the wrapping all happens inside a single
          text node. */}
      <Text
        style={[titleStyle, ink, maxLines ? { maxLines, textOverflow: "ellipsis" } : {}]}
      >
        {event.name}
        {event.description ? (
          <Text style={[descriptionStyle, ink]}>{"\n" + event.description}</Text>
        ) : null}
      </Text>
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
  // What will fit, before anything is positioned. The square cannot grow —
  // it is a printed grid — so a day with more on it than fits loses its
  // descriptions first and then its last events, rather than the layout
  // cramming everything in on top of itself.
  const { shown, hidden, linesEach } = fitToSquare(inPrintOrder(cell.events));
  // One slot per position, slot 1 at the top. Five of them normally; more if
  // something on this day is numbered past five.
  const slots = bySlot(shown);

  return (
    <View style={[styles.dayCell, isLast ? styles.dayCellLast : {}]}>
      {cell.day !== null && (
        <>
          <Text style={styles.dayNumber}>{cell.day}</Text>
          {/* EVERY slot is drawn, empty ones included. That is what holds an
              event at position 5 down at the floor instead of letting it
              float up under the one above — the pinning Joyce asked to keep
              when the three bands became numbers. Delete the empty ones and
              the square quietly turns into a plain list. */}
          <View style={styles.eventsList}>
            {slots.map((inSlot, slotIndex) => (
              <View
                key={slotIndex}
                style={slotStyle(slotIndex, slots.length)}
              >
                {inSlot.map((event, idx) => (
                  <EventLines
                    key={idx}
                    event={event}
                    itemStyle={styles.eventItem}
                    titleStyle={styles.eventTitle}
                    descriptionStyle={styles.eventDescription}
                    maxLines={linesEach}
                  />
                ))}
              </View>
            ))}
          </View>
          {hidden > 0 && (
            /* Said out loud rather than silently cut. Whoever is laying out
               the printed calendar needs to know a day was trimmed; finding
               out from the finished article is too late. */
            <Text style={styles.moreNote}>+{hidden} more</Text>
          )}
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
    const ordered = inPrintOrder(cell.events);
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
  const { cells, needsSplit } = buildPrintMonth(year, monthIndex, events);
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
