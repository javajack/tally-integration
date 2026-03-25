---
title: XML Response Structure
description: Anatomy of Tally's XML responses — the ENVELOPE wrapper, response sizes, empty vs error responses, and encoding defaults.
---

Every response Tally sends back is wrapped in a predictable XML structure. Before you start parsing individual fields, you need to understand what that wrapper looks like and how big it can get.

## The ENVELOPE wrapper

Every Tally XML response lives inside an `<ENVELOPE>` root element. This is true for exports, imports, collection queries -- everything.

Here's the basic skeleton:

```xml
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <STATUS>1</STATUS>
  </HEADER>
  <BODY>
    <DATA>
      <!-- Your actual data lives here -->
    </DATA>
  </BODY>
</ENVELOPE>
```

The `<HEADER>` echoes back metadata about the request. The `<BODY>` holds your data inside a `<DATA>` block. For collection exports, you'll find a `<TALLYMESSAGE>` wrapper inside `<DATA>` containing the actual objects.

### Collection export responses

When you pull a collection (like all stock items), the response nests deeper:

```xml
<ENVELOPE>
  <HEADER>...</HEADER>
  <BODY>
    <DATA>
      <TALLYMESSAGE
        xmlns:UDF="TallyUDF">
        <STOCKITEM NAME="Item 1">
          ...
        </STOCKITEM>
        <STOCKITEM NAME="Item 2">
          ...
        </STOCKITEM>
      </TALLYMESSAGE>
    </DATA>
  </BODY>
</ENVELOPE>
```

### Import responses

Import (write-back) responses look different. They report success and failure counts:

```xml
<RESPONSE>
  <CREATED>1</CREATED>
  <ALTERED>0</ALTERED>
  <LASTVCHID>12345</LASTVCHID>
  <LASTMASTERID>67890</LASTMASTERID>
  <COMBINED>0</COMBINED>
  <IGNORED>0</IGNORED>
  <ERRORS>0</ERRORS>
  <LINEERROR></LINEERROR>
</RESPONSE>
```

:::tip
Always check `<ERRORS>` first. If it's non-zero, dig into `<LINEERROR>` for the specific failure message.
:::

## Response sizes: what to expect

This is where things get real. Response sizes vary wildly depending on what you're pulling.

| Request type | Typical size |
|---|---|
| List of Companies | 1 -- 5 KB |
| All Ledgers (~500) | 200 -- 500 KB |
| All Stock Items (~5000) | 2 -- 10 MB |
| Vouchers (1 month, busy) | 5 -- 50 MB |
| Vouchers (1 year, busy) | 100 -- 500 MB |

:::danger
Never pull a full year of vouchers in a single request. At 100--500 MB, you'll either crash your parser or freeze Tally itself. Batch by day or by date range.
:::

A single voucher export is tiny (2--20 KB). A Stock Summary report is moderate (50--500 KB). But collection exports of busy companies can produce genuinely massive XML payloads.

## Empty responses

An empty response doesn't mean an error. It usually means "no data matched your query." This happens when:

- You query vouchers for a date range with no transactions
- You request a collection with a filter that matches nothing
- The company has no data of that type

An empty response looks like this:

```xml
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <STATUS>1</STATUS>
  </HEADER>
  <BODY>
    <DATA>
      <TALLYMESSAGE/>
    </DATA>
  </BODY>
</ENVELOPE>
```

The `<TALLYMESSAGE/>` self-closing tag is your clue. Status is still `1` (success). The data section just has nothing in it.

## Error responses

Errors come in a few flavors:

### Malformed request

If your XML is broken, Tally returns a terse error (or sometimes just hangs). Common culprits: unescaped ampersands, missing closing tags, wrong encoding.

### Unknown request

```xml
<RESPONSE>
  <LINEERROR>Unknown Request</LINEERROR>
</RESPONSE>
```

This usually means your XML was too large (more than ~50 vouchers per batch) or the request structure doesn't match what Tally expects.

### Object not found

```xml
<RESPONSE>
  <LINEERROR>
    [STOCKITEM] not found
  </LINEERROR>
  <ERRORS>1</ERRORS>
</RESPONSE>
```

Your request referenced a master (ledger, stock item, godown) that doesn't exist in Tally.

### No company loaded

If Tally is running but no company is open, you'll get an empty or minimal response. Always check company status before making data requests.

## Encoding: UTF-8 by default

Tally's HTTP server returns XML with UTF-8 encoding by default. Your requests should also use UTF-8:

```
Content-Type: text/xml; charset=UTF-8
```

:::caution
Some older Tally.ERP 9 installations may return Windows-1252 (ANSI) encoding. The XML declaration might say `encoding="ASCII"` while the body contains Windows-1252 characters like the Rupee sign. Detect and handle both.
:::

Indian businesses use Hindi, Gujarati, and other scripts in their data. A stock item named `"Paracetamol 500mg Tab"` in one company might be `"पेरासिटामोल 500mg टैबलेट"` in another. Your parser must handle all of these without truncation or re-encoding.

## What's next

Now that you know what the response envelope looks like, the real work begins: parsing the actual data inside it. And for large responses, you'll need a streaming parser -- which is exactly what the [next page](/tally-integartion/parsing-responses/streaming-parser/) covers.
