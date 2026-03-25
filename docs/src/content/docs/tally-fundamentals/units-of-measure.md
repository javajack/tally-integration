---
title: Units of Measure
description: Simple vs compound units in Tally, how they appear in XML, conversion factors, and how to parse the notoriously tricky quantity strings.
---

Units of measure in Tally seem simple at first glance. Nos, Pcs, Kg — what could go wrong? Then you encounter compound units like "Box of 10 Strip" and quantity strings like "2 Box of 10 Strip = 20 Strip", and suddenly your parser is having an existential crisis.

Let's break it down.

## Simple Units

Simple units are exactly what you'd expect — a single unit of measurement with no conversion involved.

| Unit | Formal Name | Common Usage |
|------|-------------|-------------|
| `Nos` | Numbers | Generic counting |
| `Pcs` | Pieces | Electronics, hardware |
| `Kg` | Kilograms | Bulk goods, chemicals |
| `Ltr` | Litres | Liquids |
| `Mtr` | Metres | Textiles, cables |
| `Strip` | Strip | Pharma (tablet strips) |
| `Bottle` | Bottle | Pharma (syrups, liquids) |
| `Tube` | Tube | Pharma (ointments) |

In XML, a simple unit looks clean:

```xml
<UNIT NAME="Strip">
  <ISSIMPLEUNIT>Yes</ISSIMPLEUNIT>
  <ORIGINALNAME>Strip</ORIGINALNAME>
</UNIT>
```

And quantity strings are straightforward:

```xml
<ACTUALQTY>100 Strip</ACTUALQTY>
<OPENINGBALANCE>500 Nos</OPENINGBALANCE>
```

Parsing rule: split on the first space. Left side is the number, right side is the unit.

## Compound Units

This is where Tally gets creative. A **compound unit** defines a relationship between two simple units with a conversion factor.

Think of it like this:
- 1 Box = 10 Strips
- 1 Thaan = 40 Metres
- 1 Dozen = 12 Pieces
- 1 Carton = 24 Bottles

In XML, a compound unit encodes this relationship:

```xml
<UNIT NAME="Box of 10 Strip">
  <ISSIMPLEUNIT>No</ISSIMPLEUNIT>
  <ORIGINALNAME>Box</ORIGINALNAME>
  <ADDITIONALUNITS>Strip</ADDITIONALUNITS>
  <CONVERSION>10</CONVERSION>
</UNIT>
```

The `NAME` attribute is the compound expression itself — `"Box of 10 Strip"`. The `CONVERSION` tells you the multiplier.

## How Compound Units Appear in Quantity Strings

This is where your parser earns its keep. Tally can express quantities in compound units in multiple formats:

```xml
<!-- Full compound expression -->
<ACTUALQTY>
  2 Box of 10 Strip = 20 Strip
</ACTUALQTY>

<!-- Just the compound unit -->
<ACTUALQTY>2 Box</ACTUALQTY>

<!-- Just the base unit -->
<ACTUALQTY>20 Strip</ACTUALQTY>

<!-- Mixed (partial box) -->
<ACTUALQTY>
  1 Box of 10 Strip + 5 Strip = 15 Strip
</ACTUALQTY>
```

:::caution
All four formats can appear in the same company, even for the same stock item. Your parser must handle every variant defensively.
:::

## Parsing Strategy

Here's a practical approach to parsing Tally quantity strings:

```
Input: "2 Box of 10 Strip = 20 Strip"

Step 1: Check for "=" sign
  → If present, take the RIGHT side
  → "20 Strip"

Step 2: Extract number and unit
  → Split on first space
  → {value: 20, unit: "Strip"}

Done. You now have the base quantity.
```

For strings without the `=` expansion:

```
Input: "2 Box"

Step 1: No "=" sign found
Step 2: Extract number and unit
  → {value: 2, unit: "Box"}
Step 3: Look up unit in mst_unit table
  → Box is compound: 1 Box = 10 Strip
Step 4: Convert to base unit
  → {value: 20, unit: "Strip"}
```

Here's pseudocode for a robust parser:

```go
func parseQty(raw string) (float64, string) {
  raw = strings.TrimSpace(raw)

  // If "=" present, use right side
  if idx := strings.Index(raw, "="); idx > 0 {
    raw = strings.TrimSpace(raw[idx+1:])
  }

  // Extract leading number
  // Handle negatives: "-50 Strip"
  re := regexp.MustCompile(
    `^(-?[\d,.]+)\s*(.+)$`,
  )
  m := re.FindStringSubmatch(raw)
  if m == nil {
    return 0, raw // fallback
  }

  val := parseNumber(m[1])
  unit := strings.TrimSpace(m[2])
  return val, unit
}
```

## Rate Strings

Rates follow a similar pattern but use `/` as the separator:

```xml
<RATE>50.00/Strip</RATE>
<RATE>500.00/Box of 10 Strip</RATE>
<RATE>12.50/pcs</RATE>
```

Parsing rule: split on `/`. Left side is the numeric rate, right side is the unit.

```
Input: "500.00/Box of 10 Strip"
  → {rate: 500.00, per_unit: "Box of 10 Strip"}
```

## Stock Item Unit Configuration

Each stock item has a base unit and optionally an alternate unit:

```xml
<STOCKITEM NAME="Paracetamol 500mg">
  <BASEUNITS>Strip</BASEUNITS>
  <ADDITIONALUNITS>Box</ADDITIONALUNITS>
  <CONVERSION>10</CONVERSION>
</STOCKITEM>
```

This means:
- The item is primarily tracked in **Strips**
- It can also be expressed in **Boxes**
- 1 Box = 10 Strips

The `CONVERSION` on the stock item matches the conversion on the compound unit. It's redundant but useful for quick lookups.

## Unit Schema Reference

Store units in your local cache:

| Field | Type | Notes |
|-------|------|-------|
| `name` | TEXT | `"Strip"` or `"Box of 10 Strip"` |
| `is_simple_unit` | BOOLEAN | `true` for simple, `false` for compound |
| `base_unit` | TEXT | For compound: the smaller unit |
| `additional_unit` | TEXT | For compound: the larger unit |
| `conversion` | DECIMAL | Multiplier from additional to base |

## Real-World Pharma Examples

In pharma distribution, you'll see these compound units constantly:

```
Strip of 10 Tablets    → 1 Strip = 10 Tablets
Box of 10 Strip        → 1 Box = 100 Tablets
Bottle of 100 ml       → 1 Bottle = 100 ml
Carton of 24 Bottles   → 1 Carton = 24 Bottles
Thaan of 40 Mtr        → 1 Thaan = 40 Metres
```

:::tip
When displaying quantities in your app, always convert to the **base unit** for consistency. Store both the original compound expression and the resolved base quantity. The stockist thinks in boxes; your system should think in strips.
:::

## Edge Cases to Watch For

1. **Custom unit names**: Stockists create whatever units they want. "Dz" for dozen, "Bx" for box, "Pkt" for packet. Don't assume standard names.

2. **Decimal quantities**: `"0.5 Kg"` or `"2.5 Ltr"` are valid. Always parse as float, not int.

3. **Negative quantities**: `"-50 Strip"` means stock reversal or return. Don't reject negatives.

4. **Empty/missing unit**: Some items have just a number with no unit. Treat the unit as empty string or "Nos" as fallback.

5. **Unit name with spaces**: `"Box of 10 Strip"` is one unit name. Don't split it further after extracting the leading number.
