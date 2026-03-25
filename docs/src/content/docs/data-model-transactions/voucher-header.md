---
title: Voucher Header (trn_voucher)
description: The trn_voucher table holds the header for every transaction in Tally — dates, voucher types, party names, cancellation flags, GUIDs, AlterIDs, and the notorious numbering chaos.
---

The voucher header is the anchor of every transaction in Tally. Whether it's a Sales Invoice worth ten lakhs or a petty cash entry for chai, it starts here.

## The trn_voucher Table

```sql
trn_voucher
├── guid             VARCHAR(64) PK
├── date             DATE
├── voucher_type     TEXT
├── voucher_number   TEXT
├── reference_number TEXT
├── reference_date   DATE
├── narration        TEXT
├── party_name       TEXT
├── place_of_supply  TEXT
├── gstin            TEXT
├── is_invoice       BOOLEAN
├── is_accounting_voucher  BOOLEAN
├── is_inventory_voucher   BOOLEAN
├── is_order_voucher       BOOLEAN
├── is_cancelled     BOOLEAN
├── is_optional      BOOLEAN
├── entered_by       TEXT
├── altered_by       TEXT
├── altered_on       TIMESTAMP
├── master_id        INTEGER
├── alter_id         INTEGER
├── _synced_at       TIMESTAMP
└── _upstream_pushed BOOLEAN
```

That's a lot of fields. Let's walk through the important ones.

## Key Fields Explained

### Date (YYYYMMDD)

Tally stores and transmits dates in `YYYYMMDD` format. Always. No exceptions.

```xml
<DATE>20260325</DATE>
```

Your connector should normalize this to `YYYY-MM-DD` when storing in SQLite or PostgreSQL. The date determines which financial year the voucher belongs to and which date-range batch it falls into during sync.

### Voucher Type

The type tells you *what* the voucher is:

| Type | Stock Impact | Account Impact |
|---|---|---|
| Sales | OUT | Yes |
| Purchase | IN | Yes |
| Sales Order | None | None |
| Purchase Order | None | None |
| Delivery Note | OUT | None |
| Receipt Note | IN | None |

:::danger
**Never hardcode voucher type names.** Tally allows custom voucher types like "Field Sales Order" under "Sales Order". Always check the `mst_voucher_type` hierarchy to determine the base type.
:::

### Voucher Number

The identifier within the voucher type. Looks simple, right? It's not.

### The Numbering Chaos Problem

Tally supports multiple numbering methods:

- **Automatic** -- Tally auto-increments. Clean, sequential, reliable.
- **Manual** -- The operator types whatever they want. This is where chaos lives.
- **Multi-user (per-user prefix)** -- Each user gets a series.

When numbering is set to **manual**, you can (and people do) get:

- Duplicate voucher numbers within the same type
- Non-sequential numbers
- Alphanumeric strings like `INV/2026/SPECIAL-42`

:::caution
Never assume voucher numbers are unique. The only truly unique identifier is the **GUID**. Use it as your primary key, always.
:::

### Party Ledger

The counterparty for this transaction. For sales, it's the customer (Sundry Debtor). For purchases, it's the supplier (Sundry Creditor).

```xml
<PARTYLEDGERNAME>Raj Medical Store - Ahmedabad</PARTYLEDGERNAME>
```

This is the exact ledger name from Tally's master data. It must match character-for-character when you push data back.

### Reference and Narration

- **Reference** -- Usually the external document number (supplier invoice number, PO reference, etc.)
- **Narration** -- Free-text notes. Stockists often put salesman names, delivery instructions, or territory codes here.

### The Boolean Flags

These flags classify the voucher:

```xml
<ISINVOICE>Yes</ISINVOICE>
<ISACCOUNTINGVOUCHER>Yes</ISACCOUNTINGVOUCHER>
<ISINVENTORYVOUCHER>Yes</ISINVENTORYVOUCHER>
<ISORDERVOUCHER>No</ISORDERVOUCHER>
<ISCANCELLED>No</ISCANCELLED>
<ISOPTIONAL>No</ISOPTIONAL>
```

:::danger
**The `is_order_voucher` flag is critical.** When this is `Yes`, the voucher is a Sales Order or Purchase Order. These do NOT affect stock levels or account balances. If you include order vouchers in stock computation, your numbers will be wrong. Always filter `is_order_voucher = 0` for real stock impact.
:::

The `is_cancelled` flag marks vouchers that were cancelled (not deleted -- cancelled vouchers remain in Tally as a record). The `is_optional` flag marks memo/optional vouchers that don't affect books.

### GUID

Tally's globally unique identifier for this voucher. Looks like:

```
f5a8e6b2-3c4d-4e5f-a6b7-c8d9e0f1a2b3
```

This is your **primary key**. It survives voucher number changes, date changes, and even company splits. Always use it.

### AlterID

A monotonically increasing integer across ALL objects in the company. Every time any object is created, modified, or deleted, the global AlterID counter increments and the affected object gets the new value.

This is your **change detection mechanism**. Store the max AlterID after each sync. Next sync, pull only vouchers where `AlterID > watermark`.

### The Order Flag

When `is_order_voucher` is true, the voucher represents a commitment (Sales Order, Purchase Order), not an actual transaction. Order vouchers:

- Appear in Outstanding Order reports
- Show as "on order" quantity in Stock Summary
- Do NOT move stock or money
- Can be partially fulfilled across multiple actual vouchers

## XML Structure

Here's what a voucher header looks like in Tally's XML export:

```xml
<VOUCHER REMOTEID="GUID-HERE"
         VCHTYPE="Sales"
         VCHKEY="GUID-HERE">
  <DATE>20260325</DATE>
  <GUID>f5a8e6b2-...</GUID>
  <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
  <VOUCHERNUMBER>SI/2026/0042</VOUCHERNUMBER>
  <REFERENCE>PO-123</REFERENCE>
  <PARTYLEDGERNAME>Raj Medical</PARTYLEDGERNAME>
  <NARRATION>Delivery by Amit</NARRATION>
  <ISINVOICE>Yes</ISINVOICE>
  <ISORDERVOUCHER>No</ISORDERVOUCHER>
  <ISCANCELLED>No</ISCANCELLED>
  <ISOPTIONAL>No</ISOPTIONAL>
  <ALTERID>98765</ALTERID>
  <MASTERID>12345</MASTERID>

  <!-- Sub-entries follow... -->
  <ALLLEDGERENTRIES.LIST>...</ALLLEDGERENTRIES.LIST>
  <ALLINVENTORYENTRIES.LIST>...</ALLINVENTORYENTRIES.LIST>
</VOUCHER>
```

Notice the sub-entries are nested *inside* the voucher. Your XML parser needs to handle this nesting -- extract the header fields, then iterate through the child lists for accounting and inventory entries.

## Common Queries

Once you have voucher headers in SQLite, these queries are gold:

```sql
-- Today's sales count
SELECT COUNT(*) FROM trn_voucher
WHERE voucher_type = 'Sales'
  AND date = '2026-03-25';

-- Cancelled vouchers (suspicious?)
SELECT * FROM trn_voucher
WHERE is_cancelled = 1
  AND date > '2026-03-01';

-- Order vouchers pending fulfilment
SELECT * FROM trn_voucher
WHERE is_order_voucher = 1
  AND is_cancelled = 0;
```

:::tip
Index the `date`, `voucher_type`, and `alter_id` columns. These three are your most frequent filter and sort criteria.
:::
