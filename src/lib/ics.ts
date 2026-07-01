/**
 * Build and download an .ics calendar file (Apple/Google/Outlook compatible).
 */
export interface IcsEvent {
  uid: string;
  title: string;
  description?: string | null;
  location?: string | null;
  startISO: string;
  endISO: string;
  organizer?: { name: string; email: string } | null;
  attendees?: { name: string; email: string }[];
  url?: string | null;
}

function toIcsDate(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    "Z"
  );
}

function escapeText(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

export function buildIcs(ev: IcsEvent): string {
  const now = toIcsDate(new Date().toISOString());
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//CoreEgin Sales OS//Meetings//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${ev.uid}@coreegin.com`,
    `DTSTAMP:${now}`,
    `DTSTART:${toIcsDate(ev.startISO)}`,
    `DTEND:${toIcsDate(ev.endISO)}`,
    `SUMMARY:${escapeText(ev.title)}`,
  ];
  if (ev.description) lines.push(`DESCRIPTION:${escapeText(ev.description)}`);
  if (ev.location || ev.url) lines.push(`LOCATION:${escapeText(ev.location || ev.url || "")}`);
  if (ev.url) lines.push(`URL:${ev.url}`);
  if (ev.organizer) lines.push(`ORGANIZER;CN=${escapeText(ev.organizer.name)}:MAILTO:${ev.organizer.email}`);
  (ev.attendees ?? []).forEach((a) => {
    lines.push(`ATTENDEE;CN=${escapeText(a.name)};RSVP=TRUE:MAILTO:${a.email}`);
  });
  lines.push("END:VEVENT", "END:VCALENDAR");
  return lines.join("\r\n");
}

export function downloadIcs(ev: IcsEvent) {
  const content = buildIcs(ev);
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${ev.title.replace(/[^a-z0-9-_]+/gi, "-").toLowerCase() || "meeting"}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}