---
title: Inventory Entries (trn_inventory)
description: How ALLINVENTORYENTRIES.LIST and INVENTORYENTRIES.LIST work — stock item movements, quantity with embedded units, the ACTUALQTY vs BILLEDQTY distinction for free goods, godown allocation, and tracking numbers.
---

If accounting entries track the money, inventory entries track the *stuff*. Every time stock moves -- in or out -- an inventory entry records what moved, how much, at what rate, and from which godown.

## The XML Tags

Two variants again, same as accounting:

- **`ALLINVENTORYENTRIES.LIST`** -- Invoice-style vouchers (Sales, Purchase). Includes accounting allocations within each entry.
- **`INVENTORYENTRIES.LIST`** -- Pure inventory vouchers (Stock Journal, Physical Stock). No accounting linkage.

Your connector should handle both.

## The trn_inventory Table

```sql
trn_inventory
├── guid             VARCHAR(64) FK
├── item             TEXT
├── quantity         DECIMAL
├── rate             DECIMAL
├── amount           DECIMAL
├── actual_quantity   DECIMAL
├── billed_quantity   DECIMAL
├── godown           TEXT
├── tracking_number  TEXT
├── order_number     TEXT
├── order_due_date   DATE
└── additional_allocations TEXT
```

## The Direction Convention

The sign of `quantity` tells you the direction:

> **Positive quantity = Inward (Purchase, Receipt Note)**
> **Negative quantity = Outward (Sales, Delivery Note)**

```xml
<!-- Purchase: stock comes IN -->
<ACTUALQTY>100 Strip</ACTUALQTY>
<AMOUNT>5000.00</AMOUNT>

<!-- Sale: stock goes OUT -->
<ACTUALQTY>-100 Strip</ACTUALQTY>
<AMOUNT>-5000.00</AMOUNT>
```

Wait -- amount is also signed? Yes. For inventory entries, the amount follows the same sign as quantity. Inward = positive, outward = negative.

:::caution
This is different from accounting entries, where negative = debit. In inventory entries, negative = outward. The sign convention is contextual. Don't mix them up.
:::

## Parsing Quantities with Units

Here's a fun one. Tally embeds the unit of measure *inside* the quantity string:

```xml
<ACTUALQTY>100 Strip</ACTUALQTY>
<ACTUALQTY>50 pcs</ACTUALQTY>
<ACTUALQTY>2 Box of 12 pcs</ACTUALQTY>
```

Your parser needs to split these:

| Raw String | Numeric Value | Unit |
|---|---|---|
| `100 Strip` | 100 | Strip |
| `50 pcs` | 50 | pcs |
| `2 Box of 12 pcs` | 2 | Box of 12 pcs |

For compound units like "Box of 12 pcs", extract the leading number. The unit definition in `mst_unit` will have the conversion factor (1 Box = 12 pcs).

```
// Pseudocode
func parseQty(s string) (float64, string) {
    // Split at first space
    // "100 Strip" -> 100, "Strip"
    // "-50 pcs"  -> -50, "pcs"
}
```

## Rate Field

The rate also includes the unit:

```xml
<RATE>50.00/Strip</RATE>
```

Parse it similarly: `50.00` is the rate, `Strip` is the per-unit. The formula: `amount = quantity * rate`.

## ACTUALQTY vs BILLEDQTY: The Free Goods Trick

This distinction is critical for pharmaceutical distribution, where "free goods" schemes are common.

A supplier might offer "Buy 10, Get 2 Free." In Tally, this shows up as:

```xml
<ACTUALQTY>12 Strip</ACTUALQTY>
<BILLEDQTY>10 Strip</BILLEDQTY>
<AMOUNT>500.00</AMOUNT>
```

- **ACTUALQTY** = 12 -- the physical quantity that moved
- **BILLEDQTY** = 10 -- the quantity that was invoiced/paid for
- **AMOUNT** = 500 -- based on billed quantity, not actual

The difference (2 strips) is the free goods. Your connector should capture both values because:

1. **Stock computation** uses ACTUALQTY (12 strips actually entered the warehouse)
2. **Financial computation** uses BILLEDQTY (only 10 strips were paid for)
3. **Effective rate** = Amount / ACTUALQTY = Rs. 41.67 per strip (not Rs. 50)

:::tip
If ACTUALQTY and BILLEDQTY are the same (the common case), some Tally exports omit BILLEDQTY entirely. Default BILLEDQTY to ACTUALQTY when it's missing.
:::

## Godown Allocation

Each inventory entry specifies which godown (warehouse/location) the stock moves from or to:

```xml
<GODOWNNAME>Main Location</GODOWNNAME>
```

For stock transfers (Stock Journal), you'll see both source and destination:

```xml
<GODOWNNAME>Warehouse A</GODOWNNAME>
<DESTINATIONGODOWNNAME>Warehouse B</DESTINATIONGODOWNNAME>
```

If multi-godown is not enabled on the company, every entry defaults to "Main Location."

## Tracking Number

The tracking number links inventory entries to related documents:

```xml
<TRACKINGNUMBER>DN/2026/0042</TRACKINGNUMBER>
```

This is commonly used to link:
- A Sales Invoice back to its Delivery Note
- A Purchase Invoice back to its Receipt Note (GRN)
- A Delivery Note back to its Sales Order

It's your breadcrumb for the order-to-invoice chain.

## Full XML Structure

Here's a complete inventory entry from a Sales Invoice:

```xml
<ALLINVENTORYENTRIES.LIST>
  <STOCKITEMNAME>
    Paracetamol 500mg Strip/10
  </STOCKITEMNAME>
  <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
  <RATE>50.00/Strip</RATE>
  <ACTUALQTY>100 Strip</ACTUALQTY>
  <BILLEDQTY>100 Strip</BILLEDQTY>
  <AMOUNT>5000.00</AMOUNT>
  <GODOWNNAME>Main Location</GODOWNNAME>

  <!-- Nested: accounting allocation -->
  <ACCOUNTINGALLOCATIONS.LIST>
    <LEDGERNAME>Sales Account</LEDGERNAME>
    <AMOUNT>5000.00</AMOUNT>
  </ACCOUNTINGALLOCATIONS.LIST>

  <!-- Nested: batch allocation -->
  <BATCHALLOCATIONS.LIST>
    <BATCHNAME>BATCH-2026-001</BATCHNAME>
    <GODOWNNAME>Main Location</GODOWNNAME>
    <AMOUNT>5000.00</AMOUNT>
    <ACTUALQTY>100 Strip</ACTUALQTY>
  </BATCHALLOCATIONS.LIST>
</ALLINVENTORYENTRIES.LIST>
```

Notice the nesting: batch allocations and accounting allocations sit *inside* each inventory entry. Your parser needs to handle this two-level nesting (voucher -> inventory entry -> batch allocation).

## Inventory Entry Count by Voucher Type

Not every voucher type has inventory entries:

| Voucher Type | Has Inventory? |
|---|---|
| Sales / Purchase | Yes |
| Sales/Purchase Order | Yes |
| Delivery / Receipt Note | Yes |
| Stock Journal | Yes |
| Payment / Receipt | No |
| Journal | Usually no |
| Debit/Credit Note | Sometimes |

:::tip
Check `is_inventory_voucher` on the voucher header before querying `trn_inventory`. If it's `No`, don't bother -- there won't be any inventory entries.
:::
