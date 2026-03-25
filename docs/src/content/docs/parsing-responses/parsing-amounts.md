---
title: Parsing Amounts
description: How to parse Tally's amount strings -- Indian lakh formatting, Dr/Cr suffixes, currency symbols, and the ISDEEMEDPOSITIVE flag.
---

Money in Tally comes with baggage. Currency symbols, Indian-style comma grouping, Dr/Cr suffixes, and a sign convention that will trip you up if you're not paying attention.

Let's break it all down.

## What amount strings look like

Here's the full range of what Tally throws at you:

```
"1200000.00"
"-1200000.00"
"1200000.00 Dr"
"1200000.00 Cr"
"Rs. 12,00,000.00"
"12,00,000.00"
"0"
""
```

Most of the time, in raw XML exports, you get plain numbers without formatting: `"1200000.00"` or `"-1200000.00"`. But report exports and some display fields use the formatted versions.

## Indian lakh formatting

This catches everyone the first time. Indian number formatting groups digits differently from Western formatting.

| Style | Example |
|---|---|
| Western | 1,234,567.89 |
| Indian | 12,34,567.89 |

In the Indian system, the last group has 3 digits, and every group after that has 2 digits. So twelve lakh thirty-four thousand five hundred sixty-seven is `12,34,567` -- not `1,234,567`.

:::tip
The good news: for parsing, you don't need to understand the grouping rules. Just strip ALL commas. Both `1,234,567.89` and `12,34,567.89` become `1234567.89` once you remove commas.
:::

## Currency symbols

Tally may prefix amounts with currency indicators:

- `Rs.` or `Rs`
- `INR`

Strip these before parsing. They're display artifacts, not data.

## The Dr/Cr convention

This is where Tally's accounting DNA shows through.

| Suffix | Meaning | Sign |
|---|---|---|
| Dr | Debit | Negative in Tally |
| Cr | Credit | Positive in Tally |

In Tally's raw XML, debits are negative numbers and credits are positive numbers. But in report outputs and display fields, Tally sometimes drops the minus sign and appends `Dr` or `Cr` instead.

```
"-11800.00"       = debit of 11800
"11800.00 Dr"     = same thing
"11800.00 Cr"     = credit of 11800
"11800.00"        = credit of 11800
```

:::caution
When you see `Dr` at the end, the amount is a debit -- multiply by -1. When you see `Cr`, keep the sign as-is (positive). If there's no suffix, the raw sign is already correct.
:::

## The ISDEEMEDPOSITIVE flag

Inside voucher entries, you'll often see:

```xml
<ALLLEDGERENTRIES.LIST>
  <LEDGERNAME>Raj Medical Store</LEDGERNAME>
  <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
  <AMOUNT>-11800.00</AMOUNT>
</ALLLEDGERENTRIES.LIST>
```

Wait -- the amount is negative but `ISDEEMEDPOSITIVE` says Yes?

This flag tells Tally's **UI** how to display the entry. It doesn't change the actual sign. The amount is still -11800.00 in the data. `ISDEEMEDPOSITIVE=Yes` just means "show this as a positive number in the voucher screen."

:::danger
Do NOT use `ISDEEMEDPOSITIVE` to flip the sign of amounts. The `<AMOUNT>` field already has the correct sign for accounting purposes. Ignore `ISDEEMEDPOSITIVE` when parsing amounts for computation.
:::

## The parsing algorithm

1. Strip currency symbols: `Rs.`, `Rs`, `INR`
2. Strip ALL commas
3. Strip spaces
4. Check for Dr/Cr suffix:
   - `" Dr"` or `" Dr."` -- remove suffix, multiply by -1
   - `" Cr"` or `" Cr."` -- remove suffix, keep as-is
5. Parse the remaining string as a float

## Go implementation

```go
func ParseAmount(s string) float64 {
    s = strings.TrimSpace(s)
    if s == "" || s == "0" {
        return 0
    }

    // Strip currency symbols
    for _, prefix := range []string{
        "₹", "Rs.", "Rs", "INR",
    } {
        s = strings.TrimPrefix(s, prefix)
    }

    // Strip commas and spaces
    s = strings.ReplaceAll(s, ",", "")
    s = strings.TrimSpace(s)

    // Check Dr/Cr suffix
    isDebit := false
    for _, suffix := range []string{
        " Dr.", " Dr", " dr", " DR",
    } {
        if strings.HasSuffix(s, suffix) {
            s = strings.TrimSuffix(
                s, suffix,
            )
            isDebit = true
            break
        }
    }
    for _, suffix := range []string{
        " Cr.", " Cr", " cr", " CR",
    } {
        if strings.HasSuffix(s, suffix) {
            s = strings.TrimSuffix(
                s, suffix,
            )
            break
        }
    }

    val, _ := strconv.ParseFloat(
        strings.TrimSpace(s), 64,
    )
    if isDebit {
        val = -val
    }
    return val
}
```

## Python implementation

```python
import re

def parse_amount(s: str) -> float:
    s = (s or "").strip()
    if not s or s == "0":
        return 0.0

    # Strip currency symbols
    s = re.sub(
        r"^(₹|Rs\.?|INR)\s*", "", s
    )

    # Strip commas
    s = s.replace(",", "")

    # Check Dr/Cr suffix
    is_debit = False
    if re.search(r"\s+Dr\.?\s*$", s, re.I):
        s = re.sub(
            r"\s+Dr\.?\s*$", "", s, flags=re.I
        )
        is_debit = True
    elif re.search(r"\s+Cr\.?\s*$", s, re.I):
        s = re.sub(
            r"\s+Cr\.?\s*$", "", s, flags=re.I
        )

    val = float(s.strip())
    return -val if is_debit else val
```

## JavaScript implementation

```js
function parseAmount(s) {
  s = (s || "").trim();
  if (!s || s === "0") return 0;

  // Strip currency symbols
  s = s.replace(
    /^(₹|Rs\.?|INR)\s*/i, ""
  );

  // Strip commas
  s = s.replace(/,/g, "");

  // Check Dr/Cr suffix
  let isDebit = false;
  if (/\s+Dr\.?\s*$/i.test(s)) {
    s = s.replace(
      /\s+Dr\.?\s*$/i, ""
    );
    isDebit = true;
  } else if (/\s+Cr\.?\s*$/i.test(s)) {
    s = s.replace(
      /\s+Cr\.?\s*$/i, ""
    );
  }

  const val = parseFloat(s.trim());
  return isDebit ? -val : val;
}
```

## Testing your parser

| Input | Expected |
|---|---|
| `"1200000.00"` | 1200000.00 |
| `"-1200000.00"` | -1200000.00 |
| `"1200000.00 Dr"` | -1200000.00 |
| `"1200000.00 Cr"` | 1200000.00 |
| `"Rs. 12,00,000.00"` | 1200000.00 |
| `"12,00,000.00"` | 1200000.00 |
| `""` | 0 |
