---
title: Round-Off Handling
description: How to handle rounding differences when Dr/Cr totals don't balance. The round-off ledger trick that saves your imports from rejection.
---

Here's a scenario that will happen on day one: your sales app calculates an order total of Rs 11,800.50, but when you sum up the individual line items with GST, you get Rs 11,800.47. Tally rejects the voucher because Dr/Cr don't balance.

Welcome to the round-off problem.

## Why It Happens

GST is calculated per line item, then summed. Rounding at each step introduces tiny differences.

**Example**: Two items, both at 18% GST.

```
Item 1: Rs 3,333.33 x 18% = Rs 599.9994
  Rounded to: Rs 600.00

Item 2: Rs 6,666.67 x 18% = Rs 1,200.0006
  Rounded to: Rs 1,200.00

Sum of tax: Rs 1,800.00
```

But if the app calculates tax on the total:

```
Total: Rs 10,000.00 x 18% = Rs 1,800.00
```

Same result here. But with messier numbers:

```
Item 1: Rs 2,150.75 x 18% = Rs 387.135
  Rounded to: Rs 387.14

Item 2: Rs 3,849.25 x 18% = Rs 692.865
  Rounded to: Rs 692.87

Sum: Rs 1,080.01

Total: Rs 6,000.00 x 18% = Rs 1,080.00
Difference: Rs 0.01
```

That one paisa breaks the import.

## The Rule

:::danger
Dr/Cr must balance to **exactly zero**. Not "close enough." Not "within a paisa." Exactly zero. Tally has no tolerance.
:::

## The Fix: Round-Off Ledger Entry

When the difference is small (at most Rs 1.00), add a round-off ledger entry to absorb it.

```xml
<!-- Dr/Cr difference is +0.50 (credit side heavy) -->
<ALLLEDGERENTRIES.LIST>
  <LEDGERNAME>Rounded Off</LEDGERNAME>
  <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
  <AMOUNT>-0.50</AMOUNT>
</ALLLEDGERENTRIES.LIST>
```

```xml
<!-- Dr/Cr difference is -0.30 (debit side heavy) -->
<ALLLEDGERENTRIES.LIST>
  <LEDGERNAME>Rounded Off</LEDGERNAME>
  <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
  <AMOUNT>0.30</AMOUNT>
</ALLLEDGERENTRIES.LIST>
```

## The Algorithm

Here's the logic in pseudocode:

```
total = sum(all AMOUNT fields in voucher)

if total == 0:
    # Perfect balance. Ship it.
    return voucher_xml

if abs(total) <= 1.00:
    # Small difference. Add round-off.
    roundoff_amount = -total
    add_ledger_entry(
        name   = "Rounded Off",
        amount = roundoff_amount
    )
    return voucher_xml

if abs(total) > 1.00:
    # Something is fundamentally wrong.
    # Don't try to fix it with round-off.
    reject_order(
        reason = "Dr/Cr mismatch of " + total
    )
```

:::caution
The Rs 1.00 threshold is a practical guideline, not a Tally rule. If you're seeing differences larger than Rs 1.00, the problem isn't rounding -- it's a bug in your tax calculation logic. Fix the root cause instead of papering over it with a bigger round-off.
:::

## The Round-Off Ledger

The round-off ledger must already exist in Tally. Common names:

- `Rounded Off`
- `Round Off`
- `Rounding Off`
- `Rounding Difference`
- `Round Off A/c`

It's usually found under **Indirect Expenses** or **Indirect Income** (or sometimes both -- one for each direction).

:::tip
During the setup phase, query Tally for the round-off ledger name. Store it in your config. Don't assume "Rounded Off" -- every CA names it differently.
:::

## Complete Example

An order where line-item GST doesn't perfectly match the total:

```
Item: Metformin 500mg
  Qty: 75 Strip @ Rs 28.50 = Rs 2,137.50
  GST 12%: Rs 256.50
  Line total: Rs 2,394.00

Item: Glimepiride 2mg
  Qty: 30 Strip @ Rs 45.33 = Rs 1,359.90
  GST 12%: Rs 163.19
  Line total: Rs 1,523.09

Subtotal: Rs 3,497.40
Tax total: Rs 419.69
Grand total: Rs 3,917.09

Party amount (Dr): -3,917.09
Sales (Cr): +3,497.40
Tax (Cr): +419.69
Balance: 0.00  (lucky -- balanced!)
```

But what if the app rounds the grand total to Rs 3,917.00?

```
Party amount (Dr): -3,917.00
Sales (Cr): +3,497.40
Tax (Cr): +419.69
Balance: +0.09  (credit-heavy by 9 paise)

Fix: Add round-off entry
  Rounded Off (Dr): -0.09
  New balance: 0.00
```

## Code Example (Go)

```go
func computeRoundOff(
    partyAmt float64,
    salesAmt float64,
    taxAmt   float64,
) (float64, error) {
    total := partyAmt + salesAmt + taxAmt

    if total == 0 {
        return 0, nil
    }

    if math.Abs(total) > 1.0 {
        return 0, fmt.Errorf(
            "Dr/Cr mismatch: %.2f", total,
        )
    }

    // Return the negation to balance
    return -total, nil
}
```

## Prevention Is Better Than Cure

The best round-off entry is one you never need. Here's how to minimize rounding differences:

1. **Calculate GST per line item**, not on the total
2. **Round each line item's tax** to 2 decimal places
3. **Sum the rounded values** for the total tax
4. **Use the summed value** as the party's debit amount
5. **Never reverse-calculate**: don't derive line amounts from a pre-determined total

## What If the Round-Off Ledger Doesn't Exist?

If the stockist doesn't have a round-off ledger, create one:

```xml
<LEDGER NAME="Rounded Off"
        ACTION="Create">
  <PARENT>Indirect Expenses</PARENT>
  <ISBILLWISEON>No</ISBILLWISEON>
  <AFFECTSSTOCK>No</AFFECTSSTOCK>
</LEDGER>
```

Do this once during onboarding, not on every order push.
