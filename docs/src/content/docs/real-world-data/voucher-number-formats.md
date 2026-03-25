---
title: Voucher Number Formats
description: Auto-generated sequential numbers, prefix-based series, FY-prefix patterns, and manual formats -- plus why you must never use voucher number as a unique key.
---

Voucher numbers in Tally are not what you'd expect from a database primary key. They're more like human-friendly labels -- and they come in every format imaginable.

## Auto-Generated Patterns

When Tally manages numbering automatically:

### Simple Sequential

```
1, 2, 3, 4, 5 ...
```

Resets at the start of each financial year.

### Prefix-Based

```
S/1, S/2, S/3 ...
P/1, P/2, P/3 ...
```

The prefix comes from the voucher type configuration. "S" for sales, "P" for purchase, etc.

### FY-Prefix

```
2526-SI-001
2526-SI-002
25-26/S/001
```

Financial year encoded in the number (2526 = FY 2025-26).

### Branch-Prefix

```
AHM/S/1
SRT/S/1
BRD/S/1
```

Branch code prefix for multi-branch businesses.

## Manual Patterns

When the operator types their own numbers:

```
INV-001, INV001
24-25/001
GJ/2024-25/S/0001
AHM/2526/001
BR-GJ-001
```

Manual numbering is common when the business has a format mandated by their industry or their CA.

## GST Invoice Number Patterns

GST compliance sometimes drives specific formats:

```
INV/24-25/AHM/001
GSTR/2024-25/001
```

These must be sequential within a financial year and unique within the GSTIN.

## The Duplicate Problem

:::danger
With manual numbering and "Prevent Duplicates = No", the **same voucher number** can exist on multiple vouchers. Never use voucher number as a unique key.
:::

```
Voucher #1001 -> GUID: abc-123
               -> Sales, 15-Mar-2026

Voucher #1001 -> GUID: def-456
               -> Sales, 18-Mar-2026
```

Both are valid. Both coexist in Tally. This happens when:

- Multiple numbering series exist under one type
- The operator deliberately reuses numbers
- "Prevent Duplicates" is turned off

## Multi-User Gaps

Tally Gold (multi-user) pre-allocates number blocks to each user session. If User A gets 1-10 and User B gets 11-20, but User A only creates 5 vouchers, you get:

```
1, 2, 3, 4, 5, 11, 12, 13, 14 ...
```

Numbers 6-10 are permanently skipped. This is expected behavior, not a bug.

## Import Numbering Strategy

When your connector pushes vouchers to Tally, you have two options:

### Option A: Let Tally Auto-Assign

Omit the `VOUCHERNUMBER` tag entirely. Tally assigns the next number in sequence.

**Pros:** No duplicate risk.
**Cons:** You don't know the number until after import.

### Option B: Use a Unique Prefix

Generate numbers with a prefix that can never collide with human-entered numbers:

```
FIELD/a1b2c3
API/20260325/001
SO-CONN-0042
```

**Pros:** You control the number.
**Cons:** Must verify uniqueness before import.

:::tip
Option A is safer. After the import, parse `Tally.imp` or re-query the voucher to get the assigned number.
:::

## Quick Reference

| Numbering Mode | Format Example | Duplicates? |
|---|---|---|
| Auto / Sequential | 1, 2, 3 | No |
| Auto / Prefixed | SI-001 | No |
| Auto / Multi-user | 1, 2, 11, 12 (gaps) | No |
| Manual / Controlled | INV/24-25/001 | Possible |
| Manual / Free-form | Any string | Likely |

## Detection

You can detect the numbering method per voucher type:

```xml
<VOUCHERTYPE NAME="Sales - GST">
  <NUMBERINGMETHOD>
    Automatic
  </NUMBERINGMETHOD>
</VOUCHERTYPE>
```

Values: `Automatic`, `Manual`, or `Multi-User Auto`.

Build this into your company profile so your push logic knows whether to include or omit the voucher number.
