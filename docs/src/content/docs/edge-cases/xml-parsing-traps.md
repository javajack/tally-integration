---
title: XML Parsing Traps
description: The most common XML parsing failures when working with Tally -- ampersands, dual voucher views, zero-valued transactions, compound units, and surprise CDATA.
---

Tally's XML is... special. It's valid XML, mostly, but it has patterns that trip up even experienced parsers. Here are the traps you'll hit.

## The Ampersand Problem (Failure #1)

This is the single most common cause of failed Tally imports. Indian business names **love** the `&` character:

- "M/s Patel & Sons"
- "R & D Expenses"
- "Jai & Co."

### On Export (Tally -> You)

Tally correctly escapes: `M/s Patel &amp; Sons`. Your parser handles this fine.

### On Import (You -> Tally)

If you send raw `&` in your XML, everything breaks:

```xml
<!-- WRONG -- breaks XML parsing -->
<LEDGERNAME>
  M/s Patel & Sons
</LEDGERNAME>

<!-- CORRECT -->
<LEDGERNAME>
  M/s Patel &amp; Sons
</LEDGERNAME>
```

:::danger
Tally may fail silently on malformed XML -- no error, just no import. Or it crashes entirely. Always escape these characters:

| Char | Escape |
|---|---|
| `&` | `&amp;` |
| `<` | `&lt;` |
| `>` | `&gt;` |
| `"` | `&quot;` |
| `'` | `&apos;` |
:::

## Dual Voucher Views

This is a **structural** XML difference that changes tag names based on how the voucher was entered.

### Invoice Voucher View

```xml
<VOUCHER>
  <PERSISTEDVIEW>
    Invoice Voucher View
  </PERSISTEDVIEW>
  <ALLLEDGERENTRIES.LIST>
    ...
  </ALLLEDGERENTRIES.LIST>
  <ALLINVENTORYENTRIES.LIST>
    <ACCOUNTINGALLOCATIONS.LIST>
      ...
    </ACCOUNTINGALLOCATIONS.LIST>
    <BATCHALLOCATIONS.LIST>
      ...
    </BATCHALLOCATIONS.LIST>
  </ALLINVENTORYENTRIES.LIST>
</VOUCHER>
```

### Accounting Voucher View

```xml
<VOUCHER>
  <PERSISTEDVIEW>
    Accounting Voucher View
  </PERSISTEDVIEW>
  <LEDGERENTRIES.LIST>
    ...
  </LEDGERENTRIES.LIST>
  <INVENTORYENTRIES.LIST>
    <BATCHALLOCATIONS.LIST>
      ...
    </BATCHALLOCATIONS.LIST>
  </INVENTORYENTRIES.LIST>
</VOUCHER>
```

Notice the tag name changes:

| Invoice View | Accounting View |
|---|---|
| `ALLLEDGERENTRIES.LIST` | `LEDGERENTRIES.LIST` |
| `ALLINVENTORYENTRIES.LIST` | `INVENTORYENTRIES.LIST` |

:::tip
Check the `PERSISTEDVIEW` tag first, then parse accordingly. Or better yet, handle **both** tag names in your parser unconditionally.
:::

## Zero-Valued Transactions

If the Tally company has **"Enable zero-valued transactions = No"** (a common default), pushing a voucher with any zero-amount line fails:

```xml
<!-- This free sample line will be rejected -->
<ALLINVENTORYENTRIES.LIST>
  <STOCKITEMNAME>Dolo 650</STOCKITEMNAME>
  <ACTUALQTY>2 Strip</ACTUALQTY>
  <RATE>0/Strip</RATE>
  <AMOUNT>0</AMOUNT>
</ALLINVENTORYENTRIES.LIST>
```

The error you get: `"No entries in Voucher!"` -- which is spectacularly unhelpful.

**Workarounds:**
1. Detect the feature flag before pushing
2. Filter out zero-value lines from push XML
3. Or set a nominal value (Rs 0.01) with a matching round-off entry

## Compound Unit Strings

Tally represents quantities in compound units that aren't just numbers:

```xml
<ACTUALQTY>
  2 Box of 10 Strip = 20 Strip
</ACTUALQTY>
```

Your parser needs to handle all these forms:

```
"100 Strip"           -> 100, "Strip"
"-50 pcs"             -> -50, "pcs"
"100.50 Kg"           -> 100.50, "Kg"
"2 Box of 10 Strip = 20 Strip"
                      -> 20, "Strip"
"100 Strip (= 10 Box)"
                      -> 100, "Strip"
"Not Applicable"      -> 0, "NA"
""                    -> 0, ""
```

The algorithm:

```
1. Trim whitespace
2. If empty or "Not Applicable" -> 0
3. If contains "=" -> use LAST part
4. Strip parenthetical expressions
5. Extract leading number
6. Extract trailing unit string
```

:::caution
Always extract the **base unit** quantity (after the `=` sign). The compound expression before it is informational. The base unit quantity is what matters for calculations.
:::

## Rate Strings

Similar pattern -- rates include the unit:

```xml
<RATE>50.00/Strip</RATE>
<RATE>500.00/Box of 10 Strip</RATE>
<RATE>12.50/pcs</RATE>
```

Split on the first `/` to get numeric rate and unit.

## CDATA in Unexpected Places

Some TDL addons wrap content in CDATA sections:

```xml
<NARRATION><![CDATA[
  Sale to Raj Medical & Sons
  (includes 2+1 scheme)
]]></NARRATION>
```

Standard XML parsers handle CDATA, but if you're doing string-based extraction (don't -- but just in case), you'll miss this content entirely.

## The Indian Number Format

Amounts sometimes appear in Indian lakhs format in report exports:

```
Western:  1,234,567.89
Indian:   12,34,567.89
Tally XML: 1234567.89 (no commas)
```

The XML typically uses plain numbers without commas, but report-style exports may include Indian formatting. Strip **all** commas before parsing.

## Dr/Cr Suffixes on Amounts

```xml
<CLOSINGBALANCE>
  1200000.00 Dr
</CLOSINGBALANCE>
```

That `Dr` suffix means debit (negative in Tally's convention). `Cr` means credit (positive).

```
"1200000.00 Dr"  -> -1200000.00
"1200000.00 Cr"  ->  1200000.00
"1200000.00"     ->  1200000.00
```

## Boolean Values

Tally booleans are always strings:

```xml
<ISCANCELLED>Yes</ISCANCELLED>
<ISOPTIONAL>No</ISOPTIONAL>
```

Never `true`/`false`. Always `"Yes"`/`"No"`. An absent tag means `No`.

Some flags in `CMPINFO` use `"1"`/`"0"` instead -- because consistency is overrated, apparently.
