---
title: Native JSON Support
description: TallyPrime 7.0 introduced native JSON for the HTTP API. No TDL needed. Same ENVELOPE concept, friendlier syntax.
---

If you've been wrestling with XML angle brackets and wondering "isn't there a better way?" -- good news. TallyPrime 7.0 introduced native JSON support for its HTTP API.

No additional TDL files. No plugins. Just POST JSON, get JSON back.

## What Changed in TallyPrime 7.0

Before 7.0, Tally spoke XML exclusively. You could technically convert responses to JSON using a TDL trick (the "Convert to JSON TDL" tool), but it was clunky and unreliable.

With TallyPrime 7.0 and later, JSON is a first-class citizen:

| Feature | XML | JSON (7.0+) |
|---|---|---|
| Send requests | Yes | Yes |
| Receive responses | Yes | Yes |
| Import data | Yes | Yes |
| Export data | Yes | Yes |
| Inline TDL | Yes | Yes |
| Additional setup | None | None |

## The Basics

### HTTP POST with JSON Body

Same endpoint, same port. Just change the content type and body format.

```bash
curl -X POST http://localhost:9000 \
  -H "Content-Type: application/json" \
  -d '{
    "HEADER": {
      "VERSION": 1,
      "TALLYREQUEST": "Export",
      "TYPE": "Collection",
      "ID": "LedgerList"
    },
    "BODY": {
      "DESC": {
        "STATICVARIABLES": {
          "SVCURRENTCOMPANY":
            "Stockist Pharma Pvt Ltd"
        },
        "TDL": {
          "TDLMESSAGE": {
            "COLLECTION": {
              "@NAME": "LedgerList",
              "@ISMODIFY": "No",
              "TYPE": "Ledger",
              "NATIVEMETHOD": [
                "Name",
                "Parent",
                "ClosingBalance"
              ]
            }
          }
        }
      }
    }
  }'
```

### HTTP GET for Simple Queries

For basic data fetching, you can use GET with query parameters:

```bash
curl "http://localhost:9000?type=collection\
&id=LedgerList\
&company=Stockist+Pharma+Pvt+Ltd"
```

:::caution
GET requests are limited in what they can express. For anything beyond simple collection fetches, use POST with a JSON body.
:::

## JSON Structure = Tally's Object Schema

The JSON structure mirrors the XML structure almost exactly. The same ENVELOPE concept applies, just in JSON notation.

### XML vs JSON Side by Side

**XML request:**
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

**JSON equivalent:**
```json
{
  "HEADER": {
    "VERSION": 1,
    "TALLYREQUEST": "Export",
    "TYPE": "Data",
    "ID": "List of Companies"
  },
  "BODY": {
    "DESC": {
      "STATICVARIABLES": {
        "SVEXPORTFORMAT":
          "$$SysName:JSON"
      }
    }
  }
}
```

:::tip
Notice the `SVEXPORTFORMAT` value changes from `$$SysName:XML` to `$$SysName:JSON` when you want JSON responses. If you omit this, Tally may respond in XML even if you sent JSON.
:::

## Example: Fetch Stock Items

### Request

```json
{
  "HEADER": {
    "VERSION": 1,
    "TALLYREQUEST": "Export",
    "TYPE": "Collection",
    "ID": "StockItems"
  },
  "BODY": {
    "DESC": {
      "STATICVARIABLES": {
        "SVCURRENTCOMPANY":
          "Stockist Pharma Pvt Ltd",
        "SVEXPORTFORMAT":
          "$$SysName:JSON"
      },
      "TDL": {
        "TDLMESSAGE": {
          "COLLECTION": {
            "@NAME": "StockItems",
            "@ISMODIFY": "No",
            "TYPE": "StockItem",
            "NATIVEMETHOD": [
              "Name",
              "Parent",
              "BaseUnits",
              "ClosingBalance",
              "ClosingValue"
            ]
          }
        }
      }
    }
  }
}
```

### Response

```json
{
  "ENVELOPE": {
    "BODY": {
      "DATA": {
        "COLLECTION": {
          "STOCKITEM": [
            {
              "@NAME":
                "Paracetamol 500mg Strip/10",
              "PARENT": "Analgesics",
              "BASEUNITS": "Strip",
              "CLOSINGBALANCE": "500 Strip",
              "CLOSINGVALUE": "-25000.00"
            },
            {
              "@NAME":
                "Amoxicillin 250mg Cap/10",
              "PARENT": "Antibiotics",
              "BASEUNITS": "Strip",
              "CLOSINGBALANCE": "200 Strip",
              "CLOSINGVALUE": "-16000.00"
            }
          ]
        }
      }
    }
  }
}
```

## Key Differences from XML

### Attributes Use @ Prefix

XML attributes like `NAME="Paracetamol"` become `"@NAME": "Paracetamol"` in JSON.

### Lists Are Arrays

In XML, repeated elements create implicit arrays. In JSON, they're explicit:

```json
{
  "NATIVEMETHOD": [
    "Name",
    "Parent",
    "BaseUnits"
  ]
}
```

### Boolean Values

Still `"Yes"` and `"No"` strings -- not `true`/`false`. Tally's internal data model doesn't change just because the transport format did.

```json
{
  "ISBATCHENABLED": "Yes",
  "HASMFGDATE": "No"
}
```

### Amounts and Quantities

Still strings with embedded units, just like XML:

```json
{
  "CLOSINGBALANCE": "500 Strip",
  "AMOUNT": "-11800.00"
}
```

You still need the same parsing logic for quantities, amounts, and rates.

## The "Convert to JSON TDL" Tool

Before 7.0, some developers used a community TDL file that wrapped Tally's XML responses in a JSON conversion layer. If you encounter this in the wild:

- It works, but it's a third-party solution
- The JSON structure may differ from native JSON
- Native JSON (7.0+) is always preferred
- Don't mix the two approaches

## Import via JSON

You can push data (create vouchers, masters) using JSON too:

```json
{
  "HEADER": {
    "VERSION": 1,
    "TALLYREQUEST": "Import",
    "TYPE": "Data",
    "ID": "Vouchers"
  },
  "BODY": {
    "DESC": {
      "STATICVARIABLES": {
        "SVCURRENTCOMPANY":
          "Stockist Pharma Pvt Ltd"
      }
    },
    "DATA": {
      "TALLYMESSAGE": {
        "@xmlns:UDF": "TallyUDF",
        "VOUCHER": {
          "@VCHTYPE": "Sales Order",
          "@ACTION": "Create",
          "DATE": "20260325",
          "VOUCHERTYPENAME":
            "Sales Order",
          "PARTYLEDGERNAME":
            "Raj Medical Store"
        }
      }
    }
  }
}
```

:::caution
JSON import support is less battle-tested than XML import. If you're working with critical production data, we recommend sticking with XML for imports and using JSON for exports/queries where you're comfortable with the 7.0+ requirement.
:::

## When to Use JSON

| Scenario | Recommendation |
|---|---|
| New project, TallyPrime 7.0+ only | JSON all the way |
| Mixed fleet (some old Tally versions) | XML for compatibility |
| Quick ad-hoc queries | JSON (easier to build) |
| Production write-back | XML (more tested) |
| Building a REST API wrapper | JSON (natural fit) |

## Next Steps

- [JSON vs XML Comparison](/tally-integartion/json-api/json-vs-xml/) -- detailed feature comparison
- [Migration Guide](/tally-integartion/json-api/migration-guide/) -- moving from XML to JSON
