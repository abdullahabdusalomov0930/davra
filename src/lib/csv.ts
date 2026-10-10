/**
 * A small CSV reader (RFC 4180): comma-separated, fields may be quoted with `"`, a quote inside a quoted
 * field is written `""`, and quoted fields may contain commas and line breaks. Accepts LF or CRLF line
 * endings and a leading byte-order mark (Excel adds one). Blank lines are skipped.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let i = text.charCodeAt(0) === 0xfeff ? 1 : 0;

  const endField = () => {
    row.push(field);
    field = "";
  };
  const endRow = () => {
    endField();
    if (row.length > 1 || row[0] !== "") rows.push(row);
    row = [];
  };

  for (; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"' && field === "") {
      quoted = true;
    } else if (char === ",") {
      endField();
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      endRow();
    } else {
      field += char;
    }
  }
  if (quoted) throw new Error("CSV: a quoted field is not closed");
  if (field !== "" || row.length > 0) endRow();
  return rows;
}

/** Rows as records keyed by the (trimmed) header row, each with its line number in the file. */
export function parseCsvRecords(text: string) {
  const [header = [], ...rows] = parseCsv(text);
  const columns = header.map((name) => name.trim());
  return {
    columns,
    records: rows.map((cells, index) => ({
      // The header is row 1; this ignores line breaks inside quoted fields, which is close enough for messages.
      row: index + 2,
      values: Object.fromEntries(columns.map((column, position) => [column, cells[position] ?? ""])),
    })),
  };
}
