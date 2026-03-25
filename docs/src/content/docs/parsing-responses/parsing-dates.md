---
title: Parsing Dates
description: The 6 date formats Tally uses and how to detect and convert them all to ISO 8601.
---

Tally doesn't pick one date format and stick with it. Depending on whether you're looking at raw XML exports, report outputs, or display fields, you'll encounter up to six different formats.

Let's get them all nailed down.

## The six formats

| Format | Example | Where you'll see it |
|---|---|---|
| YYYYMMDD | 20260315 | XML import/export (most common) |
| DD-Mon-YYYY | 15-Mar-2026 | Some report outputs |
| DD/MM/YYYY | 15/03/2026 | Indian display format |
| DD-MM-YYYY | 15-03-2026 | Alternative display |
| Mon DD YYYY | Mar 15 2026 | Rare, some report headers |
| YYYY-MM-DD | 2026-03-15 | Rare, ISO-adjacent fields |

The one you'll see 90% of the time is `YYYYMMDD` -- eight digits, no separators.

## The YYYYMMDD format

This is Tally's native format for dates in XML:

```xml
<DATE>20260315</DATE>
<ORDERDUEDATE>20260401</ORDERDUEDATE>
<APPLICABLEFROM>20240401</APPLICABLEFROM>
```

:::caution
Note: no dashes, no slashes. It's `20260315`, not `2026-03-15`. Your parser needs to handle this unseparated format explicitly.
:::

## Detection strategy

When you encounter a date string, here's how to figure out which format it is:

1. **8 digits, no separators** -- it's `YYYYMMDD`
2. **Contains `-` with a 3-letter month** -- it's `DD-Mon-YYYY`
3. **Contains `/` with 4-digit year at end** -- it's `DD/MM/YYYY`
4. **Contains `-` with all digits and 4-digit group at end** -- try `DD-MM-YYYY`
5. **Contains `-` with all digits and 4-digit group at start** -- it's `YYYY-MM-DD`
6. **Starts with 3-letter month** -- it's `Mon DD YYYY`
7. **Empty or "N/A"** -- return null

## Go implementation

```go
func ParseDate(s string) (time.Time, error) {
    s = strings.TrimSpace(s)
    if s == "" || s == "N/A" {
        return time.Time{}, nil
    }

    formats := []string{
        "20060102",       // YYYYMMDD
        "02-Jan-2006",    // DD-Mon-YYYY
        "02/01/2006",     // DD/MM/YYYY
        "02-01-2006",     // DD-MM-YYYY
        "Jan 02 2006",    // Mon DD YYYY
        "2006-01-02",     // YYYY-MM-DD
    }

    for _, f := range formats {
        if t, err := time.Parse(f, s);
            err == nil {
            return t, nil
        }
    }

    return time.Time{},
        fmt.Errorf("unknown date: %s", s)
}
```

:::tip
Go's `time.Parse` uses a reference date of `Mon Jan 2 15:04:05 MST 2006`. The `20060102` format string tells Go to expect `YYYYMMDD` because January 2, 2006 in that layout is `20060102`.
:::

## Python implementation

```python
from datetime import datetime

DATE_FORMATS = [
    "%Y%m%d",       # YYYYMMDD
    "%d-%b-%Y",     # DD-Mon-YYYY
    "%d/%m/%Y",     # DD/MM/YYYY
    "%d-%m-%Y",     # DD-MM-YYYY
    "%b %d %Y",     # Mon DD YYYY
    "%Y-%m-%d",     # YYYY-MM-DD
]

def parse_date(s: str):
    s = (s or "").strip()
    if not s or s == "N/A":
        return None

    for fmt in DATE_FORMATS:
        try:
            return datetime.strptime(
                s, fmt
            ).date()
        except ValueError:
            continue

    raise ValueError(
        f"Unknown date format: {s}"
    )
```

## JavaScript implementation

```js
function parseDate(s) {
  s = (s || "").trim();
  if (!s || s === "N/A") return null;

  // YYYYMMDD (most common)
  if (/^\d{8}$/.test(s)) {
    return new Date(
      s.slice(0, 4),
      parseInt(s.slice(4, 6)) - 1,
      s.slice(6, 8)
    );
  }

  // DD-Mon-YYYY
  const monRe =
    /^(\d{2})-([A-Za-z]{3})-(\d{4})$/;
  let m = s.match(monRe);
  if (m) {
    return new Date(`${m[2]} ${m[1]} ${m[3]}`);
  }

  // DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
    const [d, mo, y] = s.split("/");
    return new Date(y, mo - 1, d);
  }

  // DD-MM-YYYY
  if (/^\d{2}-\d{2}-\d{4}$/.test(s)) {
    const [d, mo, y] = s.split("-");
    return new Date(y, mo - 1, d);
  }

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return new Date(s);
  }

  throw new Error(
    `Unknown date: ${s}`
  );
}
```

## Converting to ISO 8601

Once parsed, always normalize to `YYYY-MM-DD` (ISO 8601) for storage. This is what your database expects and what APIs should return.

```
20260315      ->  2026-03-15
15-Mar-2026   ->  2026-03-15
15/03/2026    ->  2026-03-15
```

:::tip
Store dates as `YYYY-MM-DD` strings in SQLite (its native date format) and as `DATE` types in PostgreSQL. Never store Tally's raw `YYYYMMDD` format in your database -- always convert on ingestion.
:::

## Edge cases

### Empty and N/A

Both `""` and `"N/A"` mean "no date." Return null/nil and let the calling code handle it.

### Financial year boundaries

Indian financial years run April to March. A date of `20260401` is the first day of FY 2026--27, not FY 2025--26. Keep this in mind when filtering by financial year.

### The DD-MM-YYYY vs YYYY-MM-DD ambiguity

A date like `2026-03-15` is unambiguous (YYYY-MM-DD). But `15-03-2026` could theoretically be misread. The detection strategy handles this: if the 4-digit group is at the end, it's `DD-MM-YYYY`. If it's at the start, it's `YYYY-MM-DD`.

## Quick reference

For the impatient -- if you're only dealing with raw XML (which is 90% of the time), you only need one parser:

```go
// Most Tally XML dates are YYYYMMDD
t, _ := time.Parse("20060102", dateStr)
```

```python
# Most Tally XML dates are YYYYMMDD
d = datetime.strptime(s, "%Y%m%d").date()
```

The multi-format parser is for when you're also consuming report outputs or display fields. For raw XML export parsing, `YYYYMMDD` is almost always what you'll get.
