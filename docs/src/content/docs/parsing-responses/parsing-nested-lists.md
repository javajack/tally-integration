---
title: Parsing Nested Lists
description: How to handle Tally's arbitrarily nested LIST fields, UDF namespaces, and the hierarchical table-inside-table structure.
---

Tally XML loves nesting. A voucher contains ledger entries, which contain cost centre allocations. A stock item contains GST details, which contain state-wise details, which contain rate details. It's lists inside lists inside lists.

This is where your parser earns its keep.

## The LIST convention

In Tally XML, any tag ending in `.LIST` is a repeating element -- an array. When you see:

```xml
<GSTDETAILS.LIST>
  <HSNCODE>30049099</HSNCODE>
  <TAXABILITY>Taxable</TAXABILITY>
</GSTDETAILS.LIST>
<GSTDETAILS.LIST>
  <HSNCODE>30042099</HSNCODE>
  <TAXABILITY>Exempt</TAXABILITY>
</GSTDETAILS.LIST>
```

That's two items in the `GSTDETAILS` array. The `.LIST` suffix is Tally's way of saying "this can repeat."

## Nesting depth: how deep does it go?

Pretty deep. Here's a real-world voucher structure, showing just the nesting levels:

```
VOUCHER
├── ALLLEDGERENTRIES.LIST
│   ├── BANKALLOCATIONS.LIST
│   ├── BILLALLOCATIONS.LIST
│   └── COSTCENTREALLOCATIONS.LIST
├── ALLINVENTORYENTRIES.LIST
│   ├── ACCOUNTINGALLOCATIONS.LIST
│   └── BATCHALLOCATIONS.LIST
│       ├── GODOWNNAME
│       ├── AMOUNT
│       └── EXPIRYPERIOD
└── ATTENDANCEENTRIES.LIST
```

That's three levels of nesting in the inventory branch alone. And GST details on a stock item can go four levels deep:

```
STOCKITEM
└── GSTDETAILS.LIST
    └── STATEWISEDETAILS.LIST
        └── RATEDETAILS.LIST
            └── GSTRATE
```

:::caution
Don't assume a maximum nesting depth. Tally's TDL system allows custom collections that can nest arbitrarily. Your parser should handle recursive structures.
:::

## Voucher ledger entries

The most important nested list in practice is the ledger/inventory entries on a voucher. Here's what a real Sales Invoice looks like:

```xml
<VOUCHER VCHTYPE="Sales">
  <DATE>20260315</DATE>

  <!-- Party entry (debit) -->
  <ALLLEDGERENTRIES.LIST>
    <LEDGERNAME>Raj Medical</LEDGERNAME>
    <AMOUNT>-11800.00</AMOUNT>
    <BILLALLOCATIONS.LIST>
      <NAME>INV/001</NAME>
      <BILLTYPE>New Ref</BILLTYPE>
      <AMOUNT>-11800.00</AMOUNT>
    </BILLALLOCATIONS.LIST>
  </ALLLEDGERENTRIES.LIST>

  <!-- Sales entry (credit) -->
  <ALLLEDGERENTRIES.LIST>
    <LEDGERNAME>Sales Account</LEDGERNAME>
    <AMOUNT>10000.00</AMOUNT>
  </ALLLEDGERENTRIES.LIST>

  <!-- Inventory entry -->
  <ALLINVENTORYENTRIES.LIST>
    <STOCKITEMNAME>Dolo 650</STOCKITEMNAME>
    <ACTUALQTY>100 Strip</ACTUALQTY>
    <RATE>50.00/Strip</RATE>
    <AMOUNT>5000.00</AMOUNT>
    <BATCHALLOCATIONS.LIST>
      <GODOWNNAME>Main Location</GODOWNNAME>
      <BATCHNAME>B-12345</BATCHNAME>
      <AMOUNT>5000.00</AMOUNT>
    </BATCHALLOCATIONS.LIST>
  </ALLINVENTORYENTRIES.LIST>

</VOUCHER>
```

One voucher, multiple ledger entries, each with their own sub-lists.

## UDF tags and namespaces

User Defined Fields (UDFs) add another layer of complexity. They appear as `.LIST` tags with an `Index` attribute:

### Named UDFs (TDL loaded)

When the TDL that defines the UDF is loaded in Tally, you get human-readable tag names:

```xml
<DRUGSCHEDULE.LIST TYPE="String"
  Index="30">
  <DRUGSCHEDULE>H</DRUGSCHEDULE>
</DRUGSCHEDULE.LIST>
```

### Generic indexed UDFs (TDL not loaded)

When the TDL is not loaded, the same data comes through with generic names:

```xml
<UDF_STRING_30.LIST Index="30">
  <UDF_STRING_30>H</UDF_STRING_30>
</UDF_STRING_30.LIST>
```

:::danger
Your parser MUST handle both formats. The `Index` attribute is the stable identifier. The tag name can change depending on whether the defining TDL is loaded when the data is exported.
:::

### Handling strategy

Store UDFs in a flexible key-value structure keyed by the `Index` number:

```go
type UDFValue struct {
    Index int
    Name  string // "DRUGSCHEDULE" or
                 // "UDF_STRING_30"
    Value string
}
```

When the named version appears, record the name-to-index mapping. When only the generic version appears, store by index and log a warning. This lets you map them later once you discover the UDF definitions.

## The RDBMS problem

Tally's nested XML maps naturally to a document/tree structure. But relational databases want flat tables. A single voucher with 5 ledger entries, 3 inventory items, and 2 batch allocations per item becomes rows in potentially 4 different tables.

Here's how to model it:

```
vouchers (1 row per voucher)
  ├── voucher_ledger_entries
  │     (N rows per voucher)
  ├── voucher_inventory_entries
  │     (N rows per voucher)
  └── voucher_batch_allocations
        (N rows per inventory entry)
```

Each child table needs a foreign key back to its parent. Batch allocations reference inventory entries, which reference vouchers.

```sql
CREATE TABLE voucher_ledger_entries (
    id          INTEGER PRIMARY KEY,
    voucher_id  INTEGER REFERENCES
                vouchers(id),
    ledger_name TEXT,
    amount      DECIMAL,
    is_deemed_positive TEXT
);

CREATE TABLE voucher_inventory_entries (
    id          INTEGER PRIMARY KEY,
    voucher_id  INTEGER REFERENCES
                vouchers(id),
    stock_item  TEXT,
    quantity    DECIMAL,
    rate        DECIMAL,
    amount      DECIMAL
);

CREATE TABLE voucher_batch_allocs (
    id              INTEGER PRIMARY KEY,
    inv_entry_id    INTEGER REFERENCES
        voucher_inventory_entries(id),
    godown          TEXT,
    batch_name      TEXT,
    amount          DECIMAL,
    quantity        DECIMAL
);
```

:::tip
If you're using a document database (MongoDB, PostgreSQL JSONB), you can store the entire voucher as a nested document and skip the table decomposition. But for SQLite and traditional PostgreSQL, you need the flattened relational model above.
:::

## Parsing strategy

When streaming through voucher XML:

1. Start a new voucher object when you hit `<VOUCHER>`
2. When you hit `<ALLLEDGERENTRIES.LIST>`, start a new ledger entry and attach it to the current voucher
3. When you hit `<BILLALLOCATIONS.LIST>` inside a ledger entry, start a new bill allocation and attach it to the current ledger entry
4. Same for inventory entries and their batch allocations
5. On `</VOUCHER>`, flush the entire voucher (with all nested children) to the database

Keep a stack of "current context" so you always know which parent to attach a child to.

## Empty lists

Sometimes a LIST tag is present but empty:

```xml
<BATCHALLOCATIONS.LIST/>
```

Or it has a single empty child:

```xml
<BATCHALLOCATIONS.LIST>
  <BATCHNAME/>
</BATCHALLOCATIONS.LIST>
```

Treat both as "no batch allocations." Don't create empty rows in your database for these.
