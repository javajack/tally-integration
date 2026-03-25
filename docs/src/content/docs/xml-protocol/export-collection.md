---
title: "Export/Collection — Pull Object Lists"
description: How to use Export/Collection requests to pull lists of stock items, ledgers, vouchers, and more from Tally — with filtering, field selection, and inline TDL.
---

If Export/Data is like running a pre-built report, Export/Collection is like writing your own SQL query. You define *what* objects to pull, *which* fields to include, and *how* to filter them — all inside the XML request.

This is the workhorse request type for data sync.

## When to Use Export/Collection

Use this when you want:

- A list of all stock items, ledgers, godowns, etc.
- Specific fields only (not the entire object)
- Server-side filtering (by AlterID, date, name, etc.)
- Incremental sync (only objects that changed)

## The Basic Shape

```xml
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>MyCollection</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVCURRENTCOMPANY>
          Your Company
        </SVCURRENTCOMPANY>
        <SVEXPORTFORMAT>
          $$SysName:XML
        </SVEXPORTFORMAT>
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="MyCollection">
            <TYPE>StockItem</TYPE>
            <FETCH>Name, Parent</FETCH>
          </COLLECTION>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>
```

The `ID` in the header must match the `NAME` on the `COLLECTION` tag. Inside the `TDL > TDLMESSAGE` block, you define what the collection contains.

## The Three Core Attributes

### TYPE — What Kind of Objects

`TYPE` tells Tally which object type to query:

| TYPE Value | What You Get |
|-----------|-------------|
| `StockItem` | Inventory items |
| `Ledger` | Accounts / parties |
| `StockGroup` | Stock group hierarchy |
| `StockCategory` | Stock categories |
| `Godown` | Warehouses / locations |
| `Unit` | Units of measure |
| `VoucherType` | Voucher type masters |
| `Currency` | Currency masters |
| `Company` | Loaded companies |
| `Voucher` | Transactions |

### FETCH — Which Fields to Include

`FETCH` specifies exactly which fields come back. This is critical for performance — fetching everything is slow; fetching just what you need is fast.

```xml
<COLLECTION NAME="StockList">
  <TYPE>StockItem</TYPE>
  <FETCH>
    Name, Parent, BaseUnits, GUID,
    MasterId, AlterId
  </FETCH>
</COLLECTION>
```

:::tip
Always include `GUID`, `MasterId`, and `AlterId` in your FETCH list. You need GUID for unique identification, MasterId for stable references, and AlterId for change detection.
:::

### CHILDOF — Scope to a Parent

Want stock items from a specific group only? Use `CHILDOF`:

```xml
<COLLECTION NAME="AnalgesicItems">
  <TYPE>StockItem</TYPE>
  <CHILDOF>Analgesics</CHILDOF>
  <FETCH>Name, Parent, BaseUnits</FETCH>
</COLLECTION>
```

This returns only stock items that belong to the "Analgesics" stock group (and its sub-groups).

## Filtering with FILTER

Here is where things get powerful. You can define server-side filters so Tally only sends objects that match your criteria.

### Basic Filter Structure

Filters are defined in two parts: a `FILTER` attribute on the collection, and a `SYSTEM` element that defines the filter logic.

```xml
<TDLMESSAGE>
  <COLLECTION NAME="ActiveLedgers">
    <TYPE>Ledger</TYPE>
    <FETCH>Name, Parent, GUID, AlterId</FETCH>
    <FILTER>IsDebtors</FILTER>
  </COLLECTION>
  <SYSTEM TYPE="Formulae" NAME="IsDebtors">
    $Parent = "Sundry Debtors"
  </SYSTEM>
</TDLMESSAGE>
```

This pulls only ledgers under the "Sundry Debtors" group — your customers.

### Filter by AlterID (Incremental Sync)

This is the killer filter for building efficient sync:

```xml
<TDLMESSAGE>
  <COLLECTION NAME="ChangedItems">
    <TYPE>StockItem</TYPE>
    <FETCH>
      Name, Parent, GUID, AlterId
    </FETCH>
    <FILTER>RecentlyChanged</FILTER>
  </COLLECTION>
  <SYSTEM TYPE="Formulae"
    NAME="RecentlyChanged">
    $$FilterGreater:$AlterId:5000
  </SYSTEM>
</TDLMESSAGE>
```

Replace `5000` with your last-seen AlterID. Only objects modified *after* that point come back. This is how you avoid pulling the entire dataset on every sync cycle.

### Filter by Date Range (Vouchers)

For vouchers, combine the collection filter with date static variables:

```xml
<STATICVARIABLES>
  <SVCURRENTCOMPANY>
    Stockist Pharma Pvt Ltd
  </SVCURRENTCOMPANY>
  <SVFROMDATE>20260301</SVFROMDATE>
  <SVTODATE>20260331</SVTODATE>
  <SVEXPORTFORMAT>
    $$SysName:XML
  </SVEXPORTFORMAT>
</STATICVARIABLES>
```

The `SVFROMDATE` and `SVTODATE` variables apply to voucher-type collections, scoping results to that date range.

## Full Example: All Stock Items with Key Fields

Here is a complete, copy-paste-ready request:

```xml
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>StockItemCollection</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>
          $$SysName:XML
        </SVEXPORTFORMAT>
        <SVCURRENTCOMPANY>
          Stockist Pharma Pvt Ltd
        </SVCURRENTCOMPANY>
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION
            NAME="StockItemCollection"
            ISMODIFY="No">
            <TYPE>StockItem</TYPE>
            <FETCH>
              Name, Parent, Category,
              BaseUnits, OpeningBalance,
              OpeningValue, ClosingBalance,
              ClosingValue, MasterId,
              AlterId, GUID,
              GSTDetails.List,
              StandardCost,
              StandardSellingPrice,
              ReorderLevel,
              MinimumOrderQty,
              HasMfgDate,
              MaintainInBatches
            </FETCH>
          </COLLECTION>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>
```

### Response Shape

```xml
<ENVELOPE>
  <COLLECTION>
    <STOCKITEM NAME="Paracetamol 500mg">
      <NAME>
        Paracetamol 500mg Strip/10
      </NAME>
      <PARENT>Analgesics</PARENT>
      <BASEUNITS>Strip</BASEUNITS>
      <GUID>abc-123-def</GUID>
      <MASTERID>42</MASTERID>
      <ALTERID>5678</ALTERID>
      <OPENINGBALANCE>
        200 Strip
      </OPENINGBALANCE>
      <CLOSINGBALANCE>
        500 Strip
      </CLOSINGBALANCE>
      <!-- ...more fields... -->
    </STOCKITEM>
    <STOCKITEM NAME="Amoxicillin 250mg">
      <!-- ... -->
    </STOCKITEM>
  </COLLECTION>
</ENVELOPE>
```

Each object appears as a repeated element inside `COLLECTION`.

## Full Example: Vouchers with Date Filter

```xml
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>VoucherCollection</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVCURRENTCOMPANY>
          Stockist Pharma Pvt Ltd
        </SVCURRENTCOMPANY>
        <SVFROMDATE>20260301</SVFROMDATE>
        <SVTODATE>20260331</SVTODATE>
        <SVEXPORTFORMAT>
          $$SysName:XML
        </SVEXPORTFORMAT>
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION
            NAME="VoucherCollection"
            ISMODIFY="No">
            <TYPE>Voucher</TYPE>
            <FETCH>
              VoucherNumber, Date,
              VoucherTypeName, PartyName,
              Amount, GUID, MasterId,
              AlterId, Narration,
              IsInventoryVoucher,
              IsOrderVoucher
            </FETCH>
            <FILTER>SalesOnly</FILTER>
          </COLLECTION>
          <SYSTEM TYPE="Formulae"
            NAME="SalesOnly">
            $VoucherTypeName = "Sales"
          </SYSTEM>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>
```

This pulls only Sales vouchers for March 2026, with just the fields you need.

## FETCH vs NATIVEMETHOD

You will see both `FETCH` and `NATIVEMETHOD` used in collection definitions. They are similar but not identical:

| Attribute | Behaviour |
|-----------|-----------|
| `FETCH` | Fetches fields and resolves sub-objects (like `GSTDetails.List`) |
| `NATIVEMETHOD` | Fetches native (built-in) methods/properties of the object |

In practice, `FETCH` is the simpler choice. Use `NATIVEMETHOD` when you need more control over which specific native properties to include. See the [Inline TDL](/tally-integartion/xml-protocol/inline-tdl/) page for the full breakdown.

## ISMODIFY Attribute

You will see `ISMODIFY="No"` on collection definitions:

```xml
<COLLECTION NAME="MyList" ISMODIFY="No">
```

This tells Tally this is a read-only collection. Always set it to `"No"` for export requests.

:::danger
Never set `ISMODIFY="Yes"` on an export collection — that would allow modifications during the read, which is not what you want.
:::

## Handling Large Collections

If a company has thousands of stock items or tens of thousands of vouchers, a single collection export can overwhelm Tally.

**The safe limits:**
- ~5,000 objects per collection export
- Day-by-day batching for vouchers in large companies

See [Batching Rules](/tally-integartion/xml-protocol/batching-rules/) for strategies on breaking large exports into manageable chunks.

## What is Next

Collections give you lists of objects. But what if you just need a quick yes/no answer or a single number? That is what [Export/Function](/tally-integartion/xml-protocol/export-function/) is for.
