---
title: Batch Name Patterns
description: Manufacturer batch numbers, internal batch numbers, and the extremely common MRP-in-batch-name hack used by pharma distributors.
---

Batches in pharma distribution carry regulatory and financial significance. The batch name isn't just an identifier -- in many cases, it's a data carrier that encodes MRP, manufacturer info, and more.

## Manufacturer Batch Numbers

The simplest pattern -- the batch number printed on the product packaging:

```
B-12345
LOT-2024-001
MFG/24/001
BATCH-A001
```

These come directly from the manufacturer and are required for regulatory traceability (Drug License compliance).

## Internal Batch Numbers

Some distributors create their own batch numbering:

```
20240401-CIPLA-001    (date-company-serial)
WH1-20240401          (godown-date)
PRIMARY               (default single batch)
```

Internal batches are typically used when the distributor receives goods without clear manufacturer batch marking, or when they want to track by receipt date.

## The MRP-in-Batch-Name Hack

This is **extremely common** in Indian pharma distribution and deserves special attention.

### The Problem

Tally doesn't have a native "MRP per batch" field. But the same product can have different MRPs across batches (government price revisions, different packaging dates, different markets).

### The Hack

Distributors embed the MRP directly in the batch name:

```
B-12345 MRP:50.00
LOT001-MRP150
MRP-125/B-456
B12345 MRP 99.50
BATCH-A001 MRP:225.00
LOT-2024-001-MRP:175
```

:::tip
If your sales app needs per-batch MRP (it does, for pharma), you **must** parse it from the batch name. There's no other reliable source for this data in Tally.
:::

### MRP Extraction Regex

```
/MRP\s*[:/-]?\s*(\d+\.?\d*)/i
```

This handles all common delimiter patterns:

| Batch Name | Extracted MRP |
|---|---|
| `B-12345 MRP:50.00` | 50.00 |
| `LOT001-MRP150` | 150 |
| `MRP-125/B-456` | 125 |
| `B12345 MRP 99.50` | 99.50 |
| `BATCH-A001 MRP:225.00` | 225.00 |

### Multiple Delimiter Patterns

The MRP can appear with various separators:

```
MRP:50.00       (colon)
MRP-50.00       (dash)
MRP/50.00       (slash)
MRP 50.00       (space)
MRP50.00        (no separator)
```

Your regex should handle all of these.

### Edge Cases

```
B-12345 MRP:50.00 EXP:202603
```

Some batch names encode **multiple** data points. Extract MRP first, then check for other patterns like expiry dates.

## Extraction Pseudocode

```python
import re

def parse_batch_name(name):
    result = {
        "raw": name,
        "batch_id": name,
        "mrp": None,
    }

    # Extract MRP
    mrp_match = re.search(
        r'MRP\s*[:/-]?\s*(\d+\.?\d*)',
        name,
        re.IGNORECASE
    )
    if mrp_match:
        result["mrp"] = float(
            mrp_match.group(1)
        )
        # Clean batch ID
        result["batch_id"] = re.sub(
            r'\s*MRP\s*[:/-]?\s*\d+\.?\d*',
            '',
            name,
            flags=re.IGNORECASE
        ).strip()

    return result
```

```
Input:  "B-12345 MRP:50.00"
Output: {
  raw: "B-12345 MRP:50.00",
  batch_id: "B-12345",
  mrp: 50.00
}
```

## Batch Allocations in Voucher XML

Each inventory line in a voucher can have multiple batch allocations:

```xml
<BATCHALLOCATIONS.LIST>
  <BATCHNAME>
    B-12345 MRP:50.00
  </BATCHNAME>
  <GODOWNNAME>Main Location</GODOWNNAME>
  <AMOUNT>5000.00</AMOUNT>
  <ACTUALQTY>100 Strip</ACTUALQTY>
  <EXPIRYPERIOD>202603</EXPIRYPERIOD>
</BATCHALLOCATIONS.LIST>
```

Your connector should:
1. Extract the raw batch name
2. Parse out the MRP
3. Store the clean batch ID, MRP, and expiry separately
4. Keep the raw name for round-trip fidelity (push back to Tally exactly as received)

## When Batches Are Disabled

If `ISBATCHENABLED = No`, there are no batch names to parse. All stock is in a single implicit "Primary" batch. Your connector should handle this gracefully -- no batch parsing needed, no MRP extraction possible from batch names.

:::caution
When batches are disabled, MRP data may not be available at the batch level at all. Check if the stockist tracks MRP via a UDF on the Stock Item master instead.
:::
