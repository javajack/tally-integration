---
title: Cost Centres & Bank Allocations
description: Two smaller transaction sub-tables — COSTCENTREALLOCATIONS.LIST for salesman and department tracking, and BANKALLOCATIONS.LIST for cheque numbers, bank names, and instrument dates.
---

These two sub-tables are smaller and more specialized than the others, but they unlock important capabilities. We've combined them into one page since they're simpler structures.

## Part 1: Cost Centre Allocations

### What Cost Centres Do

In Tally, cost centres are a way to tag transactions with an extra dimension -- typically departments, projects, branches, or (most relevant for our use case) **salesmen**.

A medical distributor might set up cost centres like:

```
Cost Centre: Salesman
├── Amit Kumar
├── Raj Patel
├── Priya Shah
└── Field Sales (unassigned)
```

When a Sales Invoice is created, the accounting entry can be allocated to a cost centre, recording which salesman was responsible for that sale.

### The trn_cost_centre Table

```sql
trn_cost_centre
├── guid          VARCHAR(64) FK
├── ledger        TEXT
├── cost_category TEXT
├── cost_centre   TEXT
└── amount        DECIMAL
```

### XML Structure

Cost centre allocations nest inside accounting entries:

```xml
<ALLLEDGERENTRIES.LIST>
  <LEDGERNAME>Sales Account</LEDGERNAME>
  <AMOUNT>10000.00</AMOUNT>

  <COSTCENTREALLOCATIONS.LIST>
    <NAME>Amit Kumar</NAME>
    <AMOUNT>10000.00</AMOUNT>
  </COSTCENTREALLOCATIONS.LIST>
</ALLLEDGERENTRIES.LIST>
```

### Cost Categories

Tally supports **cost categories** -- a grouping layer above cost centres. A company might have:

```
Category: Department
  └── Centres: Sales, Procurement, Admin

Category: Territory
  └── Centres: Ahmedabad, Surat, Rajkot
```

A single accounting entry can be allocated across multiple categories simultaneously:

```xml
<COSTCENTREALLOCATIONS.LIST>
  <COSTCATEGORYNAME>Salesman</COSTCATEGORYNAME>
  <NAME>Amit Kumar</NAME>
  <AMOUNT>10000.00</AMOUNT>
</COSTCENTREALLOCATIONS.LIST>

<COSTCENTREALLOCATIONS.LIST>
  <COSTCATEGORYNAME>Territory</COSTCATEGORYNAME>
  <NAME>Ahmedabad-West</NAME>
  <AMOUNT>10000.00</AMOUNT>
</COSTCENTREALLOCATIONS.LIST>
```

### Salesman Tracking Use Case

For a field sales fleet, cost centre allocations answer:

- **Which salesman sold what?** -- Filter vouchers by cost centre
- **Territory-wise sales** -- If territories are cost centres
- **Commission computation** -- Sales amount per salesman

```sql
-- Sales by salesman this month
SELECT
  cc.cost_centre as salesman,
  SUM(ABS(cc.amount)) as total_sales
FROM trn_cost_centre cc
JOIN trn_voucher v ON cc.guid = v.guid
WHERE v.voucher_type = 'Sales'
  AND v.date >= '2026-03-01'
  AND v.date <= '2026-03-31'
GROUP BY cc.cost_centre;
```

:::tip
Not every stockist uses cost centres for salesman tracking. Some put the salesman name in the voucher narration instead (less structured but common). During onboarding, check whether cost centres are configured and what they represent.
:::

### When Cost Centres Are Absent

The `COSTCENTREALLOCATIONS.LIST` section is absent when:

- Cost centre tracking is not enabled in the company
- The specific voucher doesn't have cost centre allocations
- The ledger entry doesn't participate in cost tracking

---

## Part 2: Bank Allocations

### What Bank Allocations Track

When a voucher involves a bank transaction (payment by cheque, NEFT, RTGS, etc.), Tally records the banking instrument details in a `BANKALLOCATIONS.LIST`.

### The trn_bank Table

```sql
trn_bank
├── guid              VARCHAR(64) FK
├── ledger            TEXT
├── transaction_type  TEXT
├── instrument_number TEXT
├── instrument_date   DATE
├── bank_name         TEXT
├── amount            DECIMAL
└── status            TEXT
```

### XML Structure

Bank allocations appear in payment and receipt vouchers:

```xml
<ALLLEDGERENTRIES.LIST>
  <LEDGERNAME>HDFC Bank Current A/c</LEDGERNAME>
  <AMOUNT>25000.00</AMOUNT>

  <BANKALLOCATIONS.LIST>
    <INSTRUMENTDATE>20260325</INSTRUMENTDATE>
    <INSTRUMENTNUMBER>456789</INSTRUMENTNUMBER>
    <TRANSACTIONTYPE>Cheque</TRANSACTIONTYPE>
    <BANKNAME>HDFC Bank</BANKNAME>
    <AMOUNT>25000.00</AMOUNT>
    <STATUS>Issued</STATUS>
  </BANKALLOCATIONS.LIST>
</ALLLEDGERENTRIES.LIST>
```

### Transaction Types

| Type | Description |
|---|---|
| Cheque | Physical cheque payment |
| NEFT | National Electronic Fund Transfer |
| RTGS | Real Time Gross Settlement |
| UPI | Unified Payments Interface |
| Cash | Cash deposit/withdrawal |

### Cheque Tracking

For distributors who still deal heavily in cheques (common in pharmaceutical distribution), bank allocations provide:

- **Cheque number** -- for reconciliation
- **Instrument date** -- when the cheque is dated (may be post-dated)
- **Bank name** -- which bank to deposit at
- **Status** -- Issued, Deposited, Cleared, Bounced

```sql
-- Post-dated cheques not yet due
SELECT
  v.party_name,
  b.instrument_number,
  b.instrument_date,
  b.amount
FROM trn_bank b
JOIN trn_voucher v ON b.guid = v.guid
WHERE b.instrument_date > date('now')
ORDER BY b.instrument_date;
```

### When Bank Allocations Are Absent

Bank allocations only appear on:

- Payment vouchers (when paying via bank)
- Receipt vouchers (when receiving via bank)
- Contra vouchers (bank-to-bank transfers)

They're absent on sales invoices, purchase invoices, journals, and any voucher that doesn't directly involve a bank ledger.

:::caution
Don't confuse the bank ledger entry (which is always there in payment vouchers) with bank allocations (which carry the instrument details). You can have a bank ledger entry without bank allocations if the instrument details weren't entered.
:::

## Combining Both for Analysis

Cost centres and bank allocations together can answer questions like:

- "How much did Amit Kumar's territory collect via cheque this month?"
- "What's the NEFT vs cheque split for our Surat territory?"

These are niche queries, but for a distributor managing 10+ salesmen and hundreds of medical shops, they're valuable.
