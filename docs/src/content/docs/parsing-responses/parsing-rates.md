---
title: Parsing Rates
description: How to parse Tally rate strings -- splitting rate from unit, handling currency prefixes, and dealing with missing units.
---

Rate parsing is mercifully simpler than quantities or amounts. But it still has a few tricks worth knowing about.

## What rate strings look like

Tally expresses rates as a value followed by a per-unit indicator:

```
"50.00/Strip"
"500.00/Box of 10 Strip"
"12.50/pcs"
"1250.00/Bottle"
"50.00"
""
```

The pattern is straightforward: **number**, then **slash**, then **unit**.

## The parsing rule

Split on the **first** `/` character.

- Left side = the numeric rate
- Right side = the unit

If there's no `/`, the entire string is the rate and the unit is empty (meaning it's in the item's base unit).

:::tip
Always split on the **first** `/`, not the last. Unit strings can contain slashes in compound expressions like `Box of 10 Strip`. (In practice this is rare for rates, but better safe than sorry.)
:::

## The parsing algorithm

1. Trim whitespace
2. If empty, return zero with no unit
3. Strip any currency prefix (`Rs.`, `Rs`, etc.)
4. Split on the first `/`
5. Parse the left side as a float
6. Trim the right side as the unit string

## Go implementation

```go
func ParseRate(s string) (float64, string) {
    s = strings.TrimSpace(s)
    if s == "" {
        return 0, ""
    }

    // Strip currency prefix
    for _, p := range []string{
        "₹", "Rs.", "Rs ", "INR ",
    } {
        s = strings.TrimPrefix(s, p)
    }
    s = strings.TrimSpace(s)

    // Split on first "/"
    idx := strings.Index(s, "/")
    if idx == -1 {
        val, _ := strconv.ParseFloat(
            s, 64,
        )
        return val, ""
    }

    rateStr := strings.TrimSpace(
        s[:idx],
    )
    unit := strings.TrimSpace(
        s[idx+1:],
    )

    val, _ := strconv.ParseFloat(
        rateStr, 64,
    )
    return val, unit
}
```

## Python implementation

```python
import re

def parse_rate(s: str):
    s = (s or "").strip()
    if not s:
        return 0.0, ""

    # Strip currency prefix
    s = re.sub(
        r"^(₹|Rs\.?|INR)\s*", "", s
    ).strip()

    # Split on first "/"
    if "/" in s:
        parts = s.split("/", 1)
        val = float(parts[0].strip())
        unit = parts[1].strip()
        return val, unit

    return float(s), ""
```

## JavaScript implementation

```js
function parseRate(s) {
  s = (s || "").trim();
  if (!s) {
    return { rate: 0, unit: "" };
  }

  // Strip currency prefix
  s = s.replace(
    /^(₹|Rs\.?|INR)\s*/i, ""
  ).trim();

  // Split on first "/"
  const idx = s.indexOf("/");
  if (idx === -1) {
    return {
      rate: parseFloat(s),
      unit: "",
    };
  }

  return {
    rate: parseFloat(
      s.substring(0, idx).trim()
    ),
    unit: s.substring(idx + 1).trim(),
  };
}
```

## Edge cases

### Rates with currency prefix

Some report fields include a currency symbol:

```
"Rs.50.00/Strip"  ->  { 50.00, "Strip" }
```

Strip the prefix before splitting.

### Rates without a unit

```
"50.00"  ->  { 50.00, "" }
```

No slash means the rate is in the item's base unit. Your application should look up the base unit from the stock item master.

### Empty rates

```
""  ->  { 0, "" }
```

Treat as zero. This can happen for items entered without a rate (lump-sum amount entries).

### Compound units in rates

```
"500.00/Box of 10 Strip"
```

This means Rs 500 per Box (where a Box contains 10 Strips). The unit is the full string `"Box of 10 Strip"`. Don't try to parse or simplify the unit -- just store it as-is.

## Testing your parser

| Input | Rate | Unit |
|---|---|---|
| `"50.00/Strip"` | 50.00 | Strip |
| `"500.00/Box of 10 Strip"` | 500.00 | Box of 10 Strip |
| `"12.50/pcs"` | 12.50 | pcs |
| `"50.00"` | 50.00 | (empty) |
| `""` | 0 | (empty) |

Simple and clean. On to the next parsing challenge.
