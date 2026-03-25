---
title: Stock Items
description: The core inventory master in Tally — 40+ fields covering naming, classification, GST, costing methods, batch tracking, reorder levels, aliases, and the complete XML export structure.
---

If Tally's data model were a solar system, **Stock Item** would be the sun. Every transaction -- sales, purchases, stock transfers, manufacturing -- revolves around stock items. This is the single most important master table you will work with.

## What Is a Stock Item?

A stock item is any product, material, or SKU that your business tracks inventory for. For a pharma distributor, that is every medicine, surgical supply, or OTC product in the catalog. For a garment business, it is every fabric, accessory, or finished piece.

Each stock item carries a staggering amount of information. Let us break it down.

## Schema Overview

```
mst_stock_item
 +-- guid               VARCHAR(64) PK
 +-- name               TEXT
 +-- alias              TEXT
 +-- part_number        TEXT
 +-- parent             TEXT (stock group)
 +-- category           TEXT (stock category)
 +-- base_units         TEXT (UoM)
 +-- additional_units   TEXT (alt UoM)
 +-- conversion         DECIMAL
 +-- opening_balance_qty    DECIMAL
 +-- opening_balance_rate   DECIMAL
 +-- opening_balance_value  DECIMAL
 +-- closing_balance_qty    DECIMAL
 +-- closing_balance_value  DECIMAL
 +-- standard_cost          DECIMAL
 +-- standard_selling_price DECIMAL
 +-- costing_method     TEXT
 +-- market_valuation   TEXT
 +-- is_batch_enabled   BOOLEAN
 +-- has_mfg_date       BOOLEAN
 +-- has_expiry_date    BOOLEAN
 +-- reorder_level      DECIMAL
 +-- reorder_quantity   DECIMAL
 +-- minimum_order_qty  DECIMAL
 +-- gst_type_of_supply TEXT
 +-- gst_hsn_code       TEXT
 +-- gst_taxability     TEXT
 +-- gst_igst_rate      DECIMAL
 +-- gst_cgst_rate      DECIMAL
 +-- gst_sgst_rate      DECIMAL
 +-- gst_cess_rate      DECIMAL
 +-- description        TEXT
 +-- narration          TEXT
 +-- alter_id           INTEGER
 +-- master_id          INTEGER
```

That is 35+ fields, and we haven't even counted UDFs (User Defined Fields) yet. Let us walk through them in logical groups.

## Field Reference

### Identity Fields

| Field | Type | Description |
|---|---|---|
| `guid` | VARCHAR(64) | Tally's globally unique ID |
| `name` | TEXT | Display name (case-sensitive!) |
| `alias` | TEXT | Alternate name for search |
| `part_number` | TEXT | External SKU or catalog number |

:::caution
Tally is **case-sensitive** on stock item names. "Paracetamol 500mg" and "paracetamol 500mg" are two different items. Always use the exact name from the master when referencing items in vouchers.
:::

### Classification Fields

| Field | Type | Description |
|---|---|---|
| `parent` | TEXT | Stock Group this item belongs to |
| `category` | TEXT | Stock Category (optional) |

The `parent` field links to a Stock Group. Every stock item must belong to a group -- if none is specified, it goes into the "Primary" group (Tally's default root).

### Unit of Measure Fields

| Field | Type | Description |
|---|---|---|
| `base_units` | TEXT | Primary unit (Strip, Pcs, Kg) |
| `additional_units` | TEXT | Alternate unit (Box, Carton) |
| `conversion` | DECIMAL | How many base units in one additional unit |

For a pharma distributor: base unit might be "Strip" and additional unit "Box" with conversion factor 10 (1 Box = 10 Strips).

### Opening and Closing Balances

| Field | Type | Description |
|---|---|---|
| `opening_balance_qty` | DECIMAL | Stock at start of period |
| `opening_balance_rate` | DECIMAL | Rate per unit at opening |
| `opening_balance_value` | DECIMAL | Total value at opening |
| `closing_balance_qty` | DECIMAL | Computed by Tally |
| `closing_balance_value` | DECIMAL | Computed by Tally |

:::danger
You **cannot** compute stock position from vouchers alone. The opening balance is the anchor. All voucher-based movement is a delta on top of it. Always trust Tally's Stock Summary report for the definitive closing position.
:::

### Costing and Pricing

| Field | Type | Description |
|---|---|---|
| `standard_cost` | DECIMAL | Default purchase cost |
| `standard_selling_price` | DECIMAL | Default selling price |
| `costing_method` | TEXT | FIFO, LIFO, Weighted Avg, etc. |
| `market_valuation` | TEXT | Valuation method for reporting |

Costing methods matter a lot for pharma (FIFO is often mandatory for expiry-based dispatch) and for garments (weighted average is common).

### Batch and Expiry Tracking

| Field | Type | Description |
|---|---|---|
| `is_batch_enabled` | BOOLEAN | Track batches for this item? |
| `has_mfg_date` | BOOLEAN | Record manufacturing date? |
| `has_expiry_date` | BOOLEAN | Record expiry date? |

:::tip
For pharma businesses, batch and expiry tracking is not optional -- it is a regulatory requirement. If `is_batch_enabled` is `No` for a medicine, something is misconfigured in Tally.
:::

### Reorder Management

| Field | Type | Description |
|---|---|---|
| `reorder_level` | DECIMAL | Trigger point for reordering |
| `reorder_quantity` | DECIMAL | How much to reorder |
| `minimum_order_qty` | DECIMAL | Minimum purchase quantity |

These fields power Tally's Reorder Status report. When closing stock drops below `reorder_level`, the item shows up as needing replenishment.

### GST Fields

| Field | Type | Description |
|---|---|---|
| `gst_type_of_supply` | TEXT | "Goods" or "Services" |
| `gst_hsn_code` | TEXT | HSN/SAC code |
| `gst_taxability` | TEXT | Taxable, Exempt, Nil Rated |
| `gst_igst_rate` | DECIMAL | IGST percentage |
| `gst_cgst_rate` | DECIMAL | CGST percentage |
| `gst_sgst_rate` | DECIMAL | SGST percentage |
| `gst_cess_rate` | DECIMAL | Cess percentage (if any) |

GST details are stored in a nested `GSTDETAILS.LIST` structure in XML, which can contain multiple entries effective from different dates. We flatten the most recent one.

## The Alias System

Tally supports multiple aliases per stock item. This is how the same product can be searched by different names -- generic name, brand name, short code, etc.

In XML, aliases appear in a peculiar nested structure:

```xml
<STOCKITEM NAME="Paracetamol 500mg">
  <LANGUAGENAME.LIST>
    <NAME.LIST>
      <NAME>Paracetamol 500mg</NAME>
      <NAME>PCM500</NAME>
      <NAME>Crocin 500</NAME>
    </NAME.LIST>
  </LANGUAGENAME.LIST>
</STOCKITEM>
```

The first `<NAME>` is always the primary name. Subsequent entries are aliases. The `LANGUAGENAME.LIST` wrapper exists because Tally supports multi-language names (Hindi, Gujarati, etc.), though most businesses only use one language.

## XML Export Example

Here is what a stock item looks like when exported from Tally via XML:

```xml
<STOCKITEM NAME="Paracetamol 500mg Strip/10">
  <GUID>abc123-def456-ghi789</GUID>
  <ALTERID>4521</ALTERID>
  <MASTERID>1042</MASTERID>
  <PARENT>Analgesics</PARENT>
  <CATEGORY>Fast Moving</CATEGORY>
  <BASEUNITS>Strip</BASEUNITS>
  <ADDITIONALUNITS>Box</ADDITIONALUNITS>
  <CONVERSION>10</CONVERSION>
  <OPENINGBALANCE>
    500 Strip
  </OPENINGBALANCE>
  <OPENINGVALUE>-25000.00</OPENINGVALUE>
  <OPENINGRATE>50.00/Strip</OPENINGRATE>
  <CLOSINGBALANCE>
    320 Strip
  </CLOSINGBALANCE>
  <CLOSINGVALUE>-16000.00</CLOSINGVALUE>
  <STANDARDCOST>45.00/Strip</STANDARDCOST>
  <STANDARDSELLINGPRICE>
    65.00/Strip
  </STANDARDSELLINGPRICE>
  <COSTINGMETHOD>FIFO</COSTINGMETHOD>
  <MAINTAININBATCHES>Yes</MAINTAININBATCHES>
  <HASMFGDATE>Yes</HASMFGDATE>
  <HASEXPIRYDATE>Yes</HASEXPIRYDATE>
  <REORDERLEVEL>100 Strip</REORDERLEVEL>
  <MINIMUMORDERQTY>
    50 Strip
  </MINIMUMORDERQTY>
  <GSTDETAILS.LIST>
    <APPLICABLEFROM>20240401</APPLICABLEFROM>
    <HSNCODE>30049099</HSNCODE>
    <TAXABILITY>Taxable</TAXABILITY>
    <STATEWISEDETAILS.LIST>
      <STATENAME>Gujarat</STATENAME>
      <RATEDETAILS.LIST>
        <GSTRATE>12</GSTRATE>
      </RATEDETAILS.LIST>
    </STATEWISEDETAILS.LIST>
  </GSTDETAILS.LIST>
</STOCKITEM>
```

## Parsing Gotchas

A few things that will trip you up if you are not prepared:

### Quantities Have Embedded Units

```xml
<OPENINGBALANCE>500 Strip</OPENINGBALANCE>
```

That is not a number. It is `"500 Strip"`. Your parser needs to split the numeric value from the unit string.

### Values Are Negative for Stock

```xml
<OPENINGVALUE>-25000.00</OPENINGVALUE>
```

Tally uses debit-negative convention. Stock is an asset (debit), so its value is negative in XML. Flip the sign when storing.

### Rates Include Unit Suffix

```xml
<STANDARDCOST>45.00/Strip</STANDARDCOST>
```

Strip the `/Unit` suffix before parsing the number.

### Booleans Are Yes/No

```xml
<MAINTAININBATCHES>Yes</MAINTAININBATCHES>
```

Not `true`/`false`. Always `Yes` or `No`.

### GST Is Deeply Nested

The GST rate is buried three levels deep: `GSTDETAILS.LIST` > `STATEWISEDETAILS.LIST` > `RATEDETAILS.LIST` > `GSTRATE`. And there can be multiple `GSTDETAILS.LIST` entries for different effective dates.

## Collection Export Request

To pull all stock items in one shot:

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
          ##CompanyName##
        </SVCURRENTCOMPANY>
      </STATICVARIABLES>
      <TDL><TDLMESSAGE>
        <COLLECTION
          NAME="StockItemCollection"
          ISMODIFY="No">
          <TYPE>StockItem</TYPE>
          <FETCH>
            Name, Parent, Category,
            BaseUnits, GUID,
            MasterId, AlterId,
            OpeningBalance,
            OpeningValue,
            ClosingBalance,
            ClosingValue,
            GSTDetails.List,
            StandardCost,
            StandardSellingPrice,
            ReorderLevel,
            MinimumOrderQty,
            HasMfgDate,
            MaintainInBatches
          </FETCH>
        </COLLECTION>
      </TDLMESSAGE></TDL>
    </DESC>
  </BODY>
</ENVELOPE>
```

:::tip
Use `FETCH` or `NATIVEMETHOD` to specify exactly which fields you want. This reduces the response size dramatically -- a full stock item export with all fields can be 5--10x larger than a targeted fetch.
:::

## UDFs (User Defined Fields)

Pharma distributors commonly add custom fields via TDL:

- **Drug Schedule** (H, H1, X, OTC)
- **Storage Temperature** (Below 25C, Refrigerate)
- **Manufacturer** name

These appear as extra tags in XML when the TDL is loaded:

```xml
<DRUGSCHEDULE.LIST TYPE="String"
  Index="30">
  <DRUGSCHEDULE>H</DRUGSCHEDULE>
</DRUGSCHEDULE.LIST>
```

If the TDL is not loaded, you get generic tags:

```xml
<UDF_STRING_30.LIST Index="30">
  <UDF_STRING_30>H</UDF_STRING_30>
</UDF_STRING_30.LIST>
```

Your connector should handle both forms. Store UDFs in a flexible key-value table, not as hardcoded columns.

## What to Watch For

1. **Name changes break references.** If someone renames a stock item in Tally, every voucher referencing it by name still works inside Tally (it updates internally). But your cache has the old name. Always use `GUID` or `MasterID` as the stable identifier.

2. **Closing balance is computed.** Do not store it as a source of truth -- pull the Stock Summary report from Tally for accurate positions.

3. **Multiple GST entries.** When GST rates change (say from 12% to 18%), Tally keeps both entries with different `APPLICABLEFROM` dates. Always pick the one that is current.

4. **Conversion factor edge cases.** Some items have compound units like "Box of 12 Strip". The conversion factor is 12. But some items have no additional unit -- `additional_units` and `conversion` will be empty.
