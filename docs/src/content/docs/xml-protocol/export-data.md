---
title: "Export/Data — Pull Reports"
description: How to use the Export/Data request type to pull master objects and computed reports like Stock Summary, Daybook, and company info from Tally.
---

The `Export/Data` request type asks Tally to run one of its built-in TDL reports and hand you the result as XML. Think of it as clicking a report in the Tally UI — except you get structured data instead of a screen.

## When to Use Export/Data

Use this when you want:

- **Computed reports** — Stock Summary, Trial Balance, Balance Sheet
- **Built-in object lists** — List of Companies, Daybook
- **Tally-calculated values** — closing stock, outstanding balances

:::tip
Export/Data gives you Tally's own computed view. For stock levels, *always* trust Tally's Stock Summary over computing positions from raw vouchers yourself.
:::

## The Basic Template

Every Export/Data request follows this shape:

```xml
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Data</TYPE>
    <ID>Stock Summary</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVCURRENTCOMPANY>
          Your Company Name
        </SVCURRENTCOMPANY>
        <SVEXPORTFORMAT>
          $$SysName:XML
        </SVEXPORTFORMAT>
      </STATICVARIABLES>
    </DESC>
  </BODY>
</ENVELOPE>
```

The `ID` in the header is the report name. The `STATICVARIABLES` section targets a company and sets the output format.

## STATICVARIABLES — Your Control Panel

This section is where you configure the report. Here are the most common variables:

| Variable | Purpose | Example |
|----------|---------|---------|
| `SVCURRENTCOMPANY` | Target company | `My Pharma Ltd` |
| `SVEXPORTFORMAT` | Output format | `$$SysName:XML` |
| `SVFROMDATE` | Report start date | `20250401` |
| `SVTODATE` | Report end date | `20260331` |

Dates are always in `YYYYMMDD` format. No dashes, no slashes.

## Worked Example: List of Companies

This is usually the first request you send — a health check that also tells you what companies are loaded.

```xml
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Data</TYPE>
    <ID>List of Companies</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>
          $$SysName:XML
        </SVEXPORTFORMAT>
      </STATICVARIABLES>
    </DESC>
  </BODY>
</ENVELOPE>
```

Try it with curl:

```bash
curl -X POST http://localhost:9000 \
  -H "Content-Type: text/xml" \
  -d '<ENVELOPE><HEADER><VERSION>1</VERSION>
<TALLYREQUEST>Export</TALLYREQUEST>
<TYPE>Data</TYPE>
<ID>List of Companies</ID></HEADER>
<BODY><DESC><STATICVARIABLES>
<SVEXPORTFORMAT>$$SysName:XML
</SVEXPORTFORMAT>
</STATICVARIABLES></DESC></BODY></ENVELOPE>'
```

### What Comes Back

The response includes details for each loaded company:

```xml
<ENVELOPE>
  <BODY>
    <DATA>
      <COLLECTION>
        <COMPANY>
          <NAME>Stockist Pharma Pvt Ltd</NAME>
          <STARTINGFROM>20250401</STARTINGFROM>
          <ENDINGAT>20260331</ENDINGAT>
          <BOOKSFROM>20250401</BOOKSFROM>
        </COMPANY>
      </COLLECTION>
    </DATA>
  </BODY>
</ENVELOPE>
```

The `STARTINGFROM` and `ENDINGAT` fields give you the full transaction date range — super useful for knowing how far back data goes without guessing.

## Worked Example: Stock Summary

This is the most important report for inventory visibility. It gives you Tally's own computed closing stock per item.

```xml
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Data</TYPE>
    <ID>Stock Summary</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVCURRENTCOMPANY>
          Stockist Pharma Pvt Ltd
        </SVCURRENTCOMPANY>
        <SVEXPORTFORMAT>
          $$SysName:XML
        </SVEXPORTFORMAT>
        <SVFROMDATE>20250401</SVFROMDATE>
        <SVTODATE>20260331</SVTODATE>
      </STATICVARIABLES>
    </DESC>
  </BODY>
</ENVELOPE>
```

### Response Structure

The Stock Summary response contains `STOCKITEM` elements nested inside their stock groups:

```xml
<STOCKITEM>
  <STOCKITEMNAME>
    Paracetamol 500mg Strip/10
  </STOCKITEMNAME>
  <CLOSINGBALANCE>
    500 Strip
  </CLOSINGBALANCE>
  <CLOSINGVALUE>-25000.00</CLOSINGVALUE>
  <CLOSINGRATE>50.00/Strip</CLOSINGRATE>
</STOCKITEM>
```

:::caution
Notice the negative sign on `CLOSINGVALUE`. Tally uses debit-negative convention — stock is an asset (debit balance), so values are negative. Strip the sign when displaying to users.
:::

## Worked Example: Daybook (Vouchers)

The Daybook gives you all vouchers within a date range:

```xml
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Data</TYPE>
    <ID>Daybook</ID>
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
    </DESC>
  </BODY>
</ENVELOPE>
```

:::danger
For large companies, pulling the full Daybook in one shot can freeze Tally. Use day-by-day batching for companies with more than a few thousand vouchers per month. See [Batching Rules](/tally-integartion/xml-protocol/batching-rules/) for details.
:::

## CMPINFO Tags in Responses

Many Export/Data responses include company info tags at the top level:

```xml
<CMPINFO>
  <CMPNAME>Stockist Pharma Pvt Ltd</CMPNAME>
  <CMPSTATE>Gujarat</CMPSTATE>
  <CMPCOUNTRY>India</CMPCOUNTRY>
  <CMPCURRENCY>INR</CMPCURRENCY>
</CMPINFO>
```

These are handy for confirming you are talking to the right company. Always validate `CMPNAME` against your expected company during sync.

## Common Report IDs

Here are the report IDs you will use most often:

| Report ID | What You Get |
|-----------|-------------|
| `List of Companies` | All loaded companies with date ranges |
| `Stock Summary` | Closing stock per item |
| `Daybook` | All vouchers in date range |
| `Trial Balance` | Account balances |
| `Balance Sheet` | Financial position |

## Parsing Tips

A few things to watch for when parsing Export/Data responses:

**Quantities have units baked in.** You will see `100 Strip` instead of just `100`. Parse the leading number and extract the unit separately.

**Amounts may have Dr/Cr suffixes.** In report contexts, you might see `50000.00 Cr` instead of just `50000.00`. Strip the suffix and map `Cr` to positive, `Dr` to negative.

**Booleans are Yes/No strings.** Not `true`/`false`. Always compare against `Yes` and `No`.

**Dates are YYYYMMDD.** No separators. Normalize to `YYYY-MM-DD` in your storage layer.

## What is Next

Export/Data is great for reports, but when you want fine-grained control over *which* objects and *which* fields come back, you need **Export/Collection**. That is where inline TDL really shines.
