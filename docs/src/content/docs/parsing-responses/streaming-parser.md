---
title: Streaming XML Parser
description: Why DOM parsing will blow up on large Tally responses, and how to use SAX/StAX streaming parsers in Go, Node.js, and Python.
---

Tally responses can be huge. We're talking 100--500 MB for a full year of vouchers from a busy distributor. If you try to load that into a DOM parser, your connector will die a painful, out-of-memory death.

This page explains why streaming parsers are essential and shows you how to use them.

## Why DOM parsing fails

A DOM parser reads the entire XML document into memory, builds a tree structure, and then lets you query it. Convenient? Absolutely. Viable for Tally? Not even close.

Here's the problem: DOM parsers typically consume 3--5x the raw XML size in memory. A 500 MB XML response becomes 1.5--2.5 GB in memory.

| Response size | DOM memory | Streaming memory |
|---|---|---|
| 5 KB | ~20 KB | ~5 KB |
| 10 MB | ~40 MB | ~1 MB |
| 100 MB | ~400 MB | ~2 MB |
| 500 MB | ~2 GB | ~5 MB |

:::danger
DOM parsing a full-year voucher export will crash your connector. On a typical stockist's machine (4--8 GB RAM, shared with Tally itself), you have maybe 1--2 GB available. A DOM parser will eat that for breakfast.
:::

Streaming parsers read the XML token by token. They never hold the full document in memory. Your memory footprint stays constant regardless of response size.

## The streaming approach

The idea is simple: read one XML token at a time, maintain a small state machine, and emit complete objects as you encounter them. You're processing a river, not filling a lake.

```
XML stream in -> Token reader -> State machine
  -> Complete object -> Process/store -> Next
```

For Tally, a "complete object" is usually one `<STOCKITEM>`, one `<VOUCHER>`, or one `<LEDGER>`. You accumulate tokens until you hit the closing tag, process that object, then move on. At any given moment, you're only holding one object in memory.

## Go: encoding/xml Decoder

Go's standard library has a streaming XML decoder built in. No external dependencies needed.

```go
decoder := xml.NewDecoder(resp.Body)
for {
    token, err := decoder.Token()
    if err == io.EOF {
        break
    }
    if err != nil {
        log.Fatal(err)
    }

    switch t := token.(type) {
    case xml.StartElement:
        if t.Name.Local == "STOCKITEM" {
            var item StockItem
            err := decoder.DecodeElement(
                &item, &t,
            )
            if err != nil {
                log.Println("skip:", err)
                continue
            }
            processItem(item)
        }
    }
}
```

The key trick: use `decoder.Token()` to scan for the start tag you care about, then call `decoder.DecodeElement()` to parse just that one object. The decoder reads only as far as the closing tag and stops.

:::tip
`DecodeElement` handles nested structures automatically. If a `<STOCKITEM>` contains `<GSTDETAILS.LIST>` with nested `<RATEDETAILS.LIST>`, it will all be decoded into your struct -- as long as your struct definition matches.
:::

### Struct tags for Tally XML

Tally uses some unusual tag names (dots, ALL-prefix). Here's how to map them in Go:

```go
type Voucher struct {
    Date     string `xml:"DATE"`
    Number   string `xml:"VOUCHERNUMBER"`
    Type     string `xml:"VOUCHERTYPENAME"`
    Ledgers  []LedgerEntry `xml:
        "ALLLEDGERENTRIES.LIST"`
    Items    []InventoryEntry `xml:
        "ALLINVENTORYENTRIES.LIST"`
}
```

## Node.js: sax-js

In Node.js, the `sax` package gives you a SAX-style streaming parser.

```js
const sax = require("sax");
const parser = sax.createStream(true);
let current = null;
let tag = "";
let depth = 0;

parser.on("opentag", (node) => {
  if (node.name === "STOCKITEM") {
    current = {};
    depth = 1;
  } else if (current) {
    depth++;
    tag = node.name;
  }
});

parser.on("text", (text) => {
  if (current && tag) {
    current[tag] = text.trim();
  }
});

parser.on("closetag", (name) => {
  if (current) {
    depth--;
    if (depth === 0) {
      processItem(current);
      current = null;
    }
    tag = "";
  }
});

resp.pipe(parser);
```

:::caution
The `sax` package doesn't handle nested LIST structures automatically. For deeply nested Tally XML (like vouchers with inventory entries containing batch allocations), you'll need to track depth and build nested objects yourself.
:::

For a more ergonomic approach, consider `xml2js` with its streaming mode, or the `saxes` package which is a maintained fork of `sax`.

## Python: xml.etree.iterparse

Python's `iterparse` from the standard library is your streaming parser. It yields events as it parses, without building the full tree.

```python
import xml.etree.ElementTree as ET

context = ET.iterparse(
    response_stream,
    events=("end",)
)

for event, elem in context:
    if elem.tag == "STOCKITEM":
        name = elem.get("NAME", "")
        parent = elem.findtext(
            "PARENT", ""
        )
        unit = elem.findtext(
            "BASEUNITS", ""
        )
        process_item(name, parent, unit)
        elem.clear()  # Free memory!
```

:::danger
The `elem.clear()` call is critical. Without it, `iterparse` still accumulates elements in the tree root, and you'll eventually run out of memory anyway. Always clear elements after processing.
:::

### Handling the root element

By default, `iterparse` keeps a reference to the root element, which grows as children accumulate. To fix this:

```python
context = ET.iterparse(
    response_stream,
    events=("start", "end")
)

root = None
for event, elem in context:
    if event == "start" and root is None:
        root = elem
    if event == "end":
        if elem.tag == "STOCKITEM":
            process_item(elem)
            root.clear()
```

Calling `root.clear()` removes all processed children from the root, keeping memory flat.

## When is DOM parsing okay?

Not every response needs streaming. For small responses, DOM is perfectly fine and much simpler to work with.

| Response type | Use streaming? |
|---|---|
| List of Companies | No -- tiny |
| Import response | No -- tiny |
| Single object export | No -- small |
| Stock Summary report | Maybe -- depends |
| All Ledgers | Yes if > 1000 |
| All Stock Items | Yes |
| Voucher exports | Always yes |

A good rule of thumb: if the response could exceed 10 MB, use streaming. Below that, DOM is fine.

## Hybrid approach

In practice, most connectors use a hybrid: DOM for small responses and streaming for collection/voucher exports. You can detect which to use based on the request type -- you know before sending whether you're pulling a company list (DOM) or a year of vouchers (streaming).

```go
if requestType == "collection" ||
   requestType == "vouchers" {
    return streamParse(resp)
}
return domParse(resp)
```

This gives you the simplicity of DOM where it's safe and the memory efficiency of streaming where it matters.
