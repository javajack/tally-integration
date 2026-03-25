---
title: XML to JSON Migration Guide
description: How to migrate your Tally integration from XML to JSON. Tag mapping, structural differences, and a gradual migration strategy for mixed environments.
---

So you've decided to move from XML to JSON. Maybe you're standardizing on TallyPrime 7.0+. Maybe your team is tired of angle brackets. Either way, here's how to make the switch without breaking things.

## The Core Translation Rules

The mapping from XML to JSON follows predictable patterns. Once you internalize these rules, you can translate any Tally XML to JSON mechanically.

### Rule 1: Tags Become Keys

```xml
<VOUCHERTYPENAME>Sales Order</VOUCHERTYPENAME>
```

Becomes:

```json
{ "VOUCHERTYPENAME": "Sales Order" }
```

### Rule 2: Attributes Use @ Prefix

```xml
<VOUCHER VCHTYPE="Sales Order"
         ACTION="Create">
```

Becomes:

```json
{
  "VOUCHER": {
    "@VCHTYPE": "Sales Order",
    "@ACTION": "Create"
  }
}
```

### Rule 3: Repeated Elements Become Arrays

```xml
<ALLLEDGERENTRIES.LIST>
  <LEDGERNAME>Party A</LEDGERNAME>
  <AMOUNT>-1000.00</AMOUNT>
</ALLLEDGERENTRIES.LIST>
<ALLLEDGERENTRIES.LIST>
  <LEDGERNAME>Sales</LEDGERNAME>
  <AMOUNT>1000.00</AMOUNT>
</ALLLEDGERENTRIES.LIST>
```

Becomes:

```json
{
  "ALLLEDGERENTRIES.LIST": [
    {
      "LEDGERNAME": "Party A",
      "AMOUNT": "-1000.00"
    },
    {
      "LEDGERNAME": "Sales",
      "AMOUNT": "1000.00"
    }
  ]
}
```

:::caution
**The single-element array trap**: If there's only ONE `ALLLEDGERENTRIES.LIST` in the XML, Tally's JSON output may return it as an object instead of a one-element array. Your parser must handle both cases.
:::

### Rule 4: Nested Structures Stay Nested

```xml
<BATCHALLOCATIONS.LIST>
  <GODOWNNAME>Main Location</GODOWNNAME>
  <BATCHNAME>Primary Batch</BATCHNAME>
  <AMOUNT>5000.00</AMOUNT>
</BATCHALLOCATIONS.LIST>
```

Becomes:

```json
{
  "BATCHALLOCATIONS.LIST": {
    "GODOWNNAME": "Main Location",
    "BATCHNAME": "Primary Batch",
    "AMOUNT": "5000.00"
  }
}
```

### Rule 5: Self-Closing Tags Become Empty Strings

```xml
<HSNCODE/>
```

Becomes:

```json
{ "HSNCODE": "" }
```

### Rule 6: NATIVEMETHOD Arrays

```xml
<NATIVEMETHOD>Name, Parent</NATIVEMETHOD>
<NATIVEMETHOD>BaseUnits, GUID</NATIVEMETHOD>
```

Becomes:

```json
{
  "NATIVEMETHOD": [
    "Name, Parent",
    "BaseUnits, GUID"
  ]
}
```

## Complete Example: Sales Order

### XML Version

```xml
<ENVELOPE>
 <HEADER>
  <VERSION>1</VERSION>
  <TALLYREQUEST>Import</TALLYREQUEST>
  <TYPE>Data</TYPE>
  <ID>Vouchers</ID>
 </HEADER>
 <BODY>
  <DESC>
   <STATICVARIABLES>
    <SVCURRENTCOMPANY>
      My Company
    </SVCURRENTCOMPANY>
   </STATICVARIABLES>
  </DESC>
  <DATA>
   <TALLYMESSAGE>
    <VOUCHER VCHTYPE="Sales Order"
             ACTION="Create">
     <DATE>20260325</DATE>
     <PARTYLEDGERNAME>
       Raj Medical
     </PARTYLEDGERNAME>
     <ALLLEDGERENTRIES.LIST>
      <LEDGERNAME>Raj Medical</LEDGERNAME>
      <AMOUNT>-1180.00</AMOUNT>
     </ALLLEDGERENTRIES.LIST>
     <ALLLEDGERENTRIES.LIST>
      <LEDGERNAME>Sales Account</LEDGERNAME>
      <AMOUNT>1000.00</AMOUNT>
     </ALLLEDGERENTRIES.LIST>
     <ALLLEDGERENTRIES.LIST>
      <LEDGERNAME>Output IGST 18%</LEDGERNAME>
      <AMOUNT>180.00</AMOUNT>
     </ALLLEDGERENTRIES.LIST>
    </VOUCHER>
   </TALLYMESSAGE>
  </DATA>
 </BODY>
</ENVELOPE>
```

### JSON Version

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
          "My Company"
      }
    },
    "DATA": {
      "TALLYMESSAGE": {
        "VOUCHER": {
          "@VCHTYPE": "Sales Order",
          "@ACTION": "Create",
          "DATE": "20260325",
          "PARTYLEDGERNAME":
            "Raj Medical",
          "ALLLEDGERENTRIES.LIST": [
            {
              "LEDGERNAME":
                "Raj Medical",
              "AMOUNT": "-1180.00"
            },
            {
              "LEDGERNAME":
                "Sales Account",
              "AMOUNT": "1000.00"
            },
            {
              "LEDGERNAME":
                "Output IGST 18%",
              "AMOUNT": "180.00"
            }
          ]
        }
      }
    }
  }
}
```

## What Doesn't Change

Some things are identical in both formats:

- Date format: `YYYYMMDD`
- Amount signs: Debit is negative
- Boolean values: `"Yes"` / `"No"` strings
- Quantity strings: `"100 Strip"`
- Rate strings: `"50.00/Strip"`
- The ENVELOPE concept
- Endpoint URL and port
- Error response content

:::tip
Your parsing logic for quantities, amounts, rates, dates, and booleans stays exactly the same. Only the deserialization layer changes.
:::

## Handling Mixed Environments

Here's the real-world challenge: some of your stockists are on TallyPrime 7.0+ (JSON-capable) and some are on older versions (XML-only).

### Feature Detection Strategy

On first connection, probe for JSON support:

```
1. Send a lightweight JSON request
   (e.g., "List of Companies")

2. If you get a valid JSON response:
   -> Mark this stockist as JSON-capable
   -> Store in profile: is_json = true

3. If you get an error or XML response:
   -> Mark as XML-only
   -> Store in profile: is_json = false

4. Use the stored flag for all future
   requests to this stockist
```

### The Adapter Pattern

Build your connector with a format abstraction layer:

```
+-------------------+
|  Business Logic   |
+-------------------+
        |
+-------------------+
|  Format Adapter   |
|  (JSON or XML)    |
+-------------------+
        |
+-------------------+
|  HTTP Transport   |
+-------------------+
```

The business logic doesn't care about the wire format. The adapter handles serialization based on the stockist's capability.

```go
type TallyClient interface {
    ExportCollection(
        name string,
        fields []string,
    ) ([]map[string]string, error)

    ImportVoucher(
        v Voucher,
    ) (*ImportResponse, error)
}

// Two implementations:
// - XMLTallyClient
// - JSONTallyClient
```

## Gradual Migration Approach

Don't migrate everything at once. Here's a phased approach:

### Phase 1: Read Operations

Switch export/query requests to JSON first. These are lower-risk because you're only reading data.

```
Week 1-2:
- Collection exports -> JSON
- Company queries -> JSON
- Health checks -> JSON
- Keep all imports as XML
```

### Phase 2: Non-Critical Writes

Move master creation (ledgers, stock items) to JSON. These are less sensitive than voucher operations.

```
Week 3-4:
- Ledger creation -> JSON
- Stock item creation -> JSON
- Keep voucher imports as XML
```

### Phase 3: Critical Writes

Once you're confident, switch voucher imports to JSON.

```
Week 5+:
- Sales Order creation -> JSON
- Voucher alter/cancel -> JSON
- Full JSON operation
```

### Rollback Plan

Keep the XML code path alive for at least 3 months after switching. If a stockist upgrades Tally and something breaks with JSON, you can flip back to XML with a config change.

```toml
[tally]
# "auto" | "xml" | "json"
preferred_format = "auto"
```

`auto` means: detect capability, use JSON if available, fall back to XML.

## Common Migration Gotchas

### 1. The Single-vs-Array Problem

Already mentioned, but worth repeating. When Tally returns JSON with a single item in a list, it may come as an object instead of a one-element array.

**Expect both:**
```json
{ "STOCKITEM": { "@NAME": "Dolo" } }
```
```json
{ "STOCKITEM": [{ "@NAME": "Dolo" }] }
```

### 2. Numeric vs String Types

XML is all strings. JSON might return numbers for some fields (like `VERSION: 1` instead of `"1"`). Don't let strict type checking break your parser.

### 3. Empty Collections

XML returns an empty tag. JSON might return `null`, an empty object `{}`, or omit the key entirely. Handle all three.

### 4. The xmlns Attribute

XML uses `xmlns:UDF="TallyUDF"`. In JSON, this becomes `"@xmlns:UDF": "TallyUDF"`. Don't forget it in import requests or UDF fields may not be recognized.

## Is Migration Worth It?

Honest answer: **only if your entire fleet is on TallyPrime 7.0+.**

If even one stockist is on an older version, you need the XML code path anyway. Maintaining both adds complexity. The JSON benefits (cleaner parsing, smaller payloads) are nice but not transformative.

Our recommendation: build with XML first (as this guide does), then add JSON support as an optimization when all your stockists have upgraded.
