---
title: Parsing Quantities
description: The single hardest parsing challenge in Tally XML -- quantity strings that embed units, compound expressions, and base-unit conversions.
---

If there's one parsing problem that will make you question your career choices, it's Tally quantity strings. They're not just numbers. They're numbers with units, compound unit expressions, and conversion math baked right into the string.

Welcome to the deep end.

## What quantity strings look like

Here's a taste of what Tally gives you:

```
"100 Strip"
"-50 pcs"
"100.50 Kg"
"2 Box of 10 Strip = 20 Strip"
"100 Strip (= 10 Box)"
"0"
""
"Not Applicable"
```

That fourth one? It says "2 Boxes, each containing 10 Strips, equals 20 Strips total." Your job is to extract the number `20` and the unit `Strip`.

## The golden rule

:::danger
When a quantity string contains an `=` sign, **always** extract the value AFTER the `=`. That's the base-unit quantity -- the one Tally actually uses for calculations.
:::

The part before `=` is the compound expression (for human readability). The part after is the resolved base-unit value. If there's no `=`, the entire string is already in base units.

## The parsing algorithm

Here's the step-by-step:

1. Trim whitespace
2. If empty, `"0"`, or `"Not Applicable"` -- return zero
3. If it contains `=` -- split on `=`, take the **last** part
4. If it contains `(=` -- strip the parenthetical
5. Extract the leading number: positive, negative, or decimal
6. Everything after the number is the unit

## The regex

One regex to extract the number and unit from the (possibly post-`=`) string:

```
^(-?\d+\.?\d*)\s*(.*)$
```

- Group 1: the numeric value (handles negatives and decimals)
- Group 2: the unit string (everything else)

## Go implementation

```go
func ParseQty(s string) (float64, string) {
    s = strings.TrimSpace(s)
    if s == "" || s == "0" ||
        s == "Not Applicable" {
        return 0, ""
    }

    // Take value after "=" if present
    if idx := strings.LastIndex(s, "=");
        idx != -1 {
        s = strings.TrimSpace(
            s[idx+1:],
        )
    }

    re := regexp.MustCompile(
        `^(-?\d+\.?\d*)\s*(.*)$`,
    )
    m := re.FindStringSubmatch(s)
    if m == nil {
        return 0, s
    }

    val, _ := strconv.ParseFloat(m[1], 64)
    unit := strings.TrimSpace(m[2])
    return val, unit
}
```

## Python implementation

```python
import re

def parse_qty(s: str):
    s = (s or "").strip()
    if not s or s in ("0", "Not Applicable"):
        return 0.0, ""

    # Take value after last "="
    if "=" in s:
        s = s.rsplit("=", 1)[-1].strip()

    m = re.match(
        r"^(-?\d+\.?\d*)\s*(.*)$", s
    )
    if not m:
        return 0.0, s

    return float(m.group(1)), m.group(2).strip()
```

## JavaScript implementation

```js
function parseQty(s) {
  s = (s || "").trim();
  if (!s || s === "0"
    || s === "Not Applicable") {
    return { value: 0, unit: "" };
  }

  // Take value after last "="
  if (s.includes("=")) {
    s = s.split("=").pop().trim();
  }

  const m = s.match(
    /^(-?\d+\.?\d*)\s*(.*)$/
  );
  if (!m) {
    return { value: 0, unit: s };
  }

  return {
    value: parseFloat(m[1]),
    unit: m[2].trim(),
  };
}
```

## Edge cases

### Negative quantities

Perfectly normal in Tally. A stock item with negative closing balance means more was sold than purchased (common in pharma when sales invoices are entered before purchase receipts).

```
"-50 Strip"  ->  { value: -50, unit: "Strip" }
```

### Zero quantities

Can appear as `"0"`, `""`, or a completely absent tag. Treat all three the same way.

```
"0"   ->  { value: 0, unit: "" }
""    ->  { value: 0, unit: "" }
```

### Compound units without `=`

Sometimes Tally gives you the compound expression without the base-unit conversion:

```
"2 Box of 10 Strip"
```

If there's no `=`, you only get the leading number (`2`) and the full unit string (`Box of 10 Strip`). You'll need your unit conversion table to resolve this to base units yourself.

:::caution
If you see a compound unit without an `=` sign, don't just take the leading number as the quantity. `2 Box of 10 Strip` is 20 strips, not 2. Check whether the unit string contains `of` and do the math.
:::

### Leading spaces

Tally sometimes prefixes quantities with a space: `" 100 Strip"`. Always trim before parsing.

### The "Not Applicable" value

Some fields return the literal string `"Not Applicable"` instead of a number. This happens when the field exists in the XML schema but doesn't apply to this particular item. Treat it as zero.

## Testing your parser

Run these through your parser and make sure you get the right results:

| Input | Expected value | Expected unit |
|---|---|---|
| `"100 Strip"` | 100 | Strip |
| `"-50 pcs"` | -50 | pcs |
| `"2 Box of 10 Strip = 20 Strip"` | 20 | Strip |
| `"100.50 Kg"` | 100.50 | Kg |
| `""` | 0 | (empty) |
| `"Not Applicable"` | 0 | (empty) |
| `" 100 Strip"` | 100 | Strip |

If all seven pass, your quantity parser is ready for production.
