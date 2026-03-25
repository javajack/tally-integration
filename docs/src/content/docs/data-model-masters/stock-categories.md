---
title: Stock Categories
description: The cross-cutting classification dimension in Tally that works alongside Stock Groups — when to use categories, common patterns, and XML structure.
---

If Stock Groups are your primary filing system, Stock Categories are the colored labels you stick on the folders. They give you a second, independent dimension to classify stock items.

## Groups vs Categories

This is the single most confusing distinction for newcomers to Tally. Here is the simple version:

| Aspect | Stock Group | Stock Category |
|---|---|---|
| Required? | Yes (every item has one) | No (optional) |
| Hierarchy? | Yes (deeply nested) | Yes (but usually flat) |
| Purpose | Primary classification | Cross-cutting tag |
| Example | "Antibiotics" | "Fast Moving" |

A stock item belongs to **one** group and **one** category (or no category). The group tells you *what* the item is. The category tells you *something else about it* that cuts across groups.

## When Categories Shine

### Pharma: Movement Speed

```
Groups:              Categories:
  Analgesics           Fast Moving
  Antibiotics    x     Slow Moving
  Cardiac              Seasonal
  OTC                  New Launch
```

An antibiotic can be "Fast Moving." A cardiac drug can be "Slow Moving." The category is orthogonal to the therapeutic group.

### Garments: Season

```
Groups:              Categories:
  Men's Shirts         Summer 2026
  Women's Kurtis x     Winter 2025
  Kids Wear            All Season
                       Clearance
```

### General: Price Range

```
Groups:              Categories:
  Electronics          Premium
  Stationery     x     Mid-Range
  Furniture            Economy
```

## Schema

```
mst_stock_category
 +-- guid        VARCHAR(64) PK
 +-- name        TEXT
 +-- parent      TEXT (parent category)
 +-- alter_id    INTEGER
 +-- master_id   INTEGER
```

Almost identical to Stock Groups. The `parent` field supports hierarchy, though most businesses keep categories flat (one level deep).

## XML Export Example

```xml
<STOCKCATEGORY NAME="Fast Moving">
  <GUID>sc-guid-001</GUID>
  <ALTERID>55</ALTERID>
  <MASTERID>8</MASTERID>
  <PARENT>Primary</PARENT>
</STOCKCATEGORY>

<STOCKCATEGORY NAME="Slow Moving">
  <GUID>sc-guid-002</GUID>
  <ALTERID>56</ALTERID>
  <MASTERID>9</MASTERID>
  <PARENT>Primary</PARENT>
</STOCKCATEGORY>
```

Just like Stock Groups, the root category is called "Primary."

## Collection Export Request

```xml
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>StockCatColl</ID>
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
          NAME="StockCatColl"
          ISMODIFY="No">
          <TYPE>StockCategory</TYPE>
          <NATIVEMETHOD>
            Name, Parent, GUID,
            MasterId, AlterId
          </NATIVEMETHOD>
        </COLLECTION>
      </TDLMESSAGE></TDL>
    </DESC>
  </BODY>
</ENVELOPE>
```

## The Reality Check

Let us be honest: **most Tally users do not use Stock Categories.** It is one of those features that exists in Tally but gets overlooked in favor of just using Stock Groups for everything.

When you encounter a Tally company with no categories, you will see only the "Primary" root category and nothing else. That is perfectly normal.

:::tip
During your connector's profile discovery phase, check if the company actually uses categories. If the count is just 1 (only "Primary"), you can skip category sync entirely and save some bandwidth.
:::

## When to Pay Attention

If the stockist *does* use categories, they become valuable for:

- **Filtering in reports**: "Show me all Fast Moving items across all therapeutic groups"
- **Price strategies**: Different markup rules per category
- **Reorder policies**: Different reorder thresholds by category
- **Sales fleet app**: Let the field sales guy filter by category to quickly find relevant products

Categories are a lightweight, powerful tool when used. Just do not be surprised when they are empty.
