---
title: SQL Queries for Tally ODBC
description: Tally's SQL dialect with the $ prefix quirk. Available collections, useful query examples, and extending tables with TDL.
---

Tally's ODBC interface speaks a SQL-like language. It looks like SQL. It smells like SQL. But it has a few quirks that will trip you up if you're coming from MySQL or PostgreSQL.

The biggest one: **method names start with `$`**.

## The $ Prefix

In Tally's SQL dialect, column names (called "methods") use a `$` prefix:

```sql
SELECT $Name, $ClosingBalance
FROM Ledger
```

Not `Name`. Not `"Name"`. It's `$Name`. Every time.

:::caution
Forget the `$` and you'll get a cryptic error or empty results. This catches everyone the first time.
:::

## Available Collections (Tables)

Tally exposes its internal collections as ODBC "tables." The default ones available without any TDL customization:

| Collection | What It Contains |
|---|---|
| `Ledger` | All ledger accounts (parties, expenses, etc.) |
| `StockItem` | All stock/inventory items |
| `StockGroup` | Stock item grouping hierarchy |
| `Voucher` | All transactions (sales, purchases, etc.) |
| `VoucherType` | Voucher type definitions |
| `CostCentre` | Cost centres (often salesmen) |
| `Currency` | Currency definitions |
| `Unit` | Units of measure |
| `Godown` | Godown/warehouse locations |
| `Budget` | Budget entries |
| `Company` | Company information |

## Useful Query Examples

### List All Party Ledgers

```sql
SELECT $Name, $Parent, $ClosingBalance
FROM Ledger
WHERE $Parent = 'Sundry Debtors'
```

### Get Stock Item Details

```sql
SELECT $Name, $Parent, $BaseUnits,
       $ClosingBalance, $ClosingValue
FROM StockItem
```

### List Vouchers by Type

```sql
SELECT $VoucherNumber, $Date,
       $PartyLedgerName, $Amount
FROM Voucher
WHERE $VoucherTypeName = 'Sales'
```

### Get Company Information

```sql
SELECT $Name, $StartingFrom,
       $BooksFrom
FROM Company
```

### List Godowns

```sql
SELECT $Name, $Parent
FROM Godown
```

### Check If a Ledger Exists

```sql
SELECT $Name
FROM Ledger
WHERE $Name = 'Raj Medical Store'
```

:::tip
This query is great for pre-validation before pushing a Sales Order. Quick existence check via ODBC, then push via HTTP API.
:::

## The Limited Default Tables

Here's the catch: out of the box, Tally only exposes first-level data through ODBC. You get the master objects (Ledger, StockItem, etc.) but not the nested sub-objects.

For example, you **cannot** do this by default:

```sql
-- This WON'T work without TDL
SELECT $StockItemName, $Amount
FROM VoucherInventoryEntries
```

Voucher line items, batch allocations, GST details, and other nested structures are not available as separate ODBC tables unless you extend Tally with TDL.

## Extending with TDL (IsODBCTable)

You can make any Tally collection available via ODBC by defining it in TDL with the `IsODBCTable` flag:

```text
[Collection: VoucherItems]
  Type       : Voucher
  ChildOf    : $$VchTypeSales
  Belongs To : Yes
  IsODBCTable: Yes

  Fetch : VoucherNumber, Date
  Fetch : AllInventoryEntries.List

  [Line: VchItemLine]
    Field: StockItemName
    Field: ActualQty
    Field: Rate
    Field: Amount
```

After loading this TDL, the collection `VoucherItems` becomes queryable via ODBC:

```sql
SELECT $VoucherNumber, $StockItemName,
       $ActualQty, $Rate, $Amount
FROM VoucherItems
```

:::caution
TDL-extended ODBC tables require the TDL file to be loaded in Tally. If the TDL is removed or Tally restarts without loading it, the table disappears. The HTTP API with inline TDL is more reliable for integration purposes.
:::

## The $ Prefix Quirk -- Deep Dive

Not everything uses `$`. Here are the rules:

| Syntax | Example | When |
|---|---|---|
| `$MethodName` | `$Name` | Standard methods |
| `$$Function` | `$$CmpLoaded` | Tally functions |
| No prefix | `FROM Ledger` | Table/collection names |

### Methods You'll Use Most

| Method | On Collection | Returns |
|---|---|---|
| `$Name` | Any master | Object name |
| `$Parent` | Any master | Parent group name |
| `$GUID` | Any | Unique identifier |
| `$AlterId` | Any | Change tracking ID |
| `$ClosingBalance` | Ledger, StockItem | Current balance |
| `$ClosingValue` | StockItem | Monetary value |
| `$OpeningBalance` | Ledger, StockItem | Opening balance |
| `$Address` | Ledger | Address lines |
| `$LedgerPhone` | Ledger | Phone number |
| `$VoucherNumber` | Voucher | Voucher reference |
| `$Date` | Voucher | Transaction date |
| `$PartyLedgerName` | Voucher | Party name |

## Filtering and Sorting

Tally's ODBC SQL supports basic WHERE clauses and ORDER BY:

```sql
SELECT $Name, $ClosingBalance
FROM Ledger
WHERE $Parent = 'Sundry Debtors'
  AND $ClosingBalance > 0
ORDER BY $Name
```

Supported operators:
- `=`, `!=`, `<>`, `>`, `<`, `>=`, `<=`
- `AND`, `OR`
- `LIKE` (limited support)
- `ORDER BY` (ASC/DESC)

**Not supported** (without TDL):
- `JOIN`
- `GROUP BY`
- `HAVING`
- Subqueries
- `LIMIT` / `TOP`

## Practical Use Cases

### Quick Stock Check

Before pushing a Sales Order, verify item availability:

```sql
SELECT $Name, $ClosingBalance
FROM StockItem
WHERE $Name = 'Paracetamol 500mg Strip/10'
```

### Daily Outstanding Report

Pull all debtors with pending balances into Excel:

```sql
SELECT $Name, $ClosingBalance
FROM Ledger
WHERE $Parent = 'Sundry Debtors'
  AND $ClosingBalance != 0
ORDER BY $ClosingBalance DESC
```

### Master Data Validation

Cross-check your cached data against live Tally data:

```sql
SELECT $Name, $GUID, $AlterId
FROM StockItem
ORDER BY $AlterId DESC
```

Compare the latest `$AlterId` with your stored watermark. If they differ, something changed.

## Performance Tips

1. **Select only the fields you need**. Don't use `SELECT *` -- Tally computes every method you request.

2. **Filter server-side**. Use WHERE clauses instead of pulling everything and filtering in your code.

3. **Avoid large result sets**. Tally's ODBC interface wasn't designed for bulk data export. For large data pulls, use the HTTP API.

4. **Keep queries short-lived**. Don't hold ODBC connections open for minutes. Connect, query, disconnect.

## Next Steps

- [Limitations](/tally-integartion/odbc-interface/limitations/) -- understand what ODBC can't do before you invest too heavily in it
