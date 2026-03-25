---
title: Accounting Entries (trn_accounting)
description: How ALLLEDGERENTRIES.LIST and LEDGERENTRIES.LIST work in Tally vouchers — debit/credit balancing, GST ledger entries, round-off entries, and extracting party, tax, and net totals.
---

Every voucher in Tally has an accounting side -- the money part. Even inventory vouchers that move stock also record who owes what. The accounting entries tell you exactly how the money flows.

## The XML Tags

You'll encounter two variants in Tally's XML:

- **`ALLLEDGERENTRIES.LIST`** -- Used in invoice-style vouchers (Sales, Purchase). Includes inventory-aware entries.
- **`LEDGERENTRIES.LIST`** -- Used in non-inventory vouchers (Journal, Payment, Receipt). Pure accounting entries.

Both have the same structure. The connector should handle them identically.

## The trn_accounting Table

```sql
trn_accounting
├── guid        VARCHAR(64) FK
├── ledger      TEXT
├── amount      DECIMAL
├── amount_forex DECIMAL
├── currency    TEXT
├── cost_centre TEXT
└── bill_allocations TEXT
```

The `guid` links back to the parent `trn_voucher`. Each row represents one ledger entry within the voucher.

## The Debit/Credit Convention

This is the single most important thing to understand about Tally amounts:

> **Negative = Debit. Positive = Credit.**

That's it. No separate Dr/Cr column. Just the sign.

```xml
<!-- Party: DEBIT (they owe us) -->
<ALLLEDGERENTRIES.LIST>
  <LEDGERNAME>Raj Medical Store</LEDGERNAME>
  <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
  <AMOUNT>-11800.00</AMOUNT>
</ALLLEDGERENTRIES.LIST>

<!-- Sales: CREDIT (revenue earned) -->
<ALLLEDGERENTRIES.LIST>
  <LEDGERNAME>Sales Account</LEDGERNAME>
  <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
  <AMOUNT>10000.00</AMOUNT>
</ALLLEDGERENTRIES.LIST>
```

:::caution
Every voucher MUST balance. The sum of all `AMOUNT` values across all ledger entries in a voucher must equal zero. If it doesn't, Tally will reject the voucher on import with "Voucher totals do not match!"
:::

## The Balancing Act

For a Sales Invoice of Rs. 11,800 (Rs. 10,000 + 18% GST):

| Ledger | Amount | Dr/Cr |
|---|---|---|
| Raj Medical Store | -11,800 | Debit |
| Sales Account | +10,000 | Credit |
| Output IGST 18% | +1,800 | Credit |
| **Total** | **0** | **Balanced** |

The party is debited (they owe us money). Sales and GST are credited (revenue and tax liability).

## GST Ledger Entries

GST in India splits into three components depending on whether the transaction is inter-state or intra-state:

**Intra-state (same state):**
```xml
<ALLLEDGERENTRIES.LIST>
  <LEDGERNAME>Output CGST 9%</LEDGERNAME>
  <AMOUNT>900.00</AMOUNT>
</ALLLEDGERENTRIES.LIST>
<ALLLEDGERENTRIES.LIST>
  <LEDGERNAME>Output SGST 9%</LEDGERNAME>
  <AMOUNT>900.00</AMOUNT>
</ALLLEDGERENTRIES.LIST>
```

**Inter-state (different state):**
```xml
<ALLLEDGERENTRIES.LIST>
  <LEDGERNAME>Output IGST 18%</LEDGERNAME>
  <AMOUNT>1800.00</AMOUNT>
</ALLLEDGERENTRIES.LIST>
```

:::tip
You can identify GST entries by checking if the ledger name contains "CGST", "SGST", "IGST", or "Cess". Or better yet, check the ledger's parent group in `mst_ledger` -- GST ledgers fall under the "Duties & Taxes" group.
:::

## The Round-Off Entry

Tally often includes a small round-off entry to make the total come out to a clean number:

```xml
<ALLLEDGERENTRIES.LIST>
  <LEDGERNAME>Round Off</LEDGERNAME>
  <AMOUNT>-0.50</AMOUNT>
</ALLLEDGERENTRIES.LIST>
```

This entry is typically tiny (under Rs. 1) and ensures the invoice total is a round figure. Your connector should capture it -- it's needed for the voucher to balance.

## Extracting Totals

Here's how to compute the key totals from accounting entries:

### Party Total (Invoice Amount)

The party entry is the one where the ledger belongs to "Sundry Debtors" (sales) or "Sundry Creditors" (purchase). Its absolute amount is the invoice total.

```sql
SELECT ABS(amount) as invoice_total
FROM trn_accounting
WHERE guid = 'voucher-guid'
  AND ledger = (
    SELECT party_name
    FROM trn_voucher
    WHERE guid = 'voucher-guid'
  );
```

### Tax Total

Sum all entries where the ledger is a GST ledger:

```sql
SELECT SUM(amount) as gst_total
FROM trn_accounting a
JOIN mst_ledger l ON a.ledger = l.name
WHERE a.guid = 'voucher-guid'
  AND l.parent IN (
    'Duties & Taxes',
    'Current Liabilities'
  );
```

### Net Total (Before Tax)

```
Net = Invoice Total - Tax Total
```

Or sum the entries for revenue ledgers (Sales Account, Purchase Account, etc.).

## Multiple Ledger Entries

A single voucher can have many accounting entries. A Sales Invoice with items from different tax slabs might look like:

| Ledger | Amount |
|---|---|
| Raj Medical Store | -23,600 |
| Sales Account | +10,000 |
| Sales Account (12%) | +10,000 |
| Output IGST 18% | +1,800 |
| Output IGST 12% | +1,200 |
| Output Cess | +600 |

That's 6 accounting entries for one voucher. All balancing to zero.

## The ISDEEMEDPOSITIVE Flag

You'll see this tag in every entry:

```xml
<ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
```

This tells Tally's UI whether to show the amount as a "positive" value in the voucher entry screen. It does NOT change the actual amount sign. The `AMOUNT` field is always debit-negative, credit-positive regardless of this flag.

For your connector, you can safely ignore `ISDEEMEDPOSITIVE`. Just use the `AMOUNT` sign.

## Forex Entries

If the stockist deals in foreign currency (rare for domestic pharma, but possible for imports):

```xml
<ALLLEDGERENTRIES.LIST>
  <LEDGERNAME>Overseas Supplier</LEDGERNAME>
  <AMOUNT>-840000.00</AMOUNT>
  <CURRENCYNAME>USD</CURRENCYNAME>
  <FOREIGNAMOUNT>-10000.00</FOREIGNAMOUNT>
</ALLLEDGERENTRIES.LIST>
```

The `amount` is in base currency (INR), `amount_forex` is in the foreign currency.

:::tip
When syncing to the central database, always store BOTH the base currency amount and the forex amount. Exchange rate disputes are common, and having both values lets you audit them.
:::
