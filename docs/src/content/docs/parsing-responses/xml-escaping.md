---
title: XML Escaping
description: The number one cause of failed Tally imports -- unescaped special characters in XML. How to handle ampersands, angle brackets, and real-world Indian business names.
---

This is the single most common cause of failed XML imports into Tally. And it's completely preventable.

The villain? The ampersand. `&`

## The problem

Indian business names love the ampersand:

```
M/s Patel & Sons
Shah & Associates
A & Co - S/Dr
Kumar Brothers & Co.
R.K. Pharma & Distributors
```

If you build XML by naively concatenating strings, you get this:

```xml
<LEDGERNAME>M/s Patel & Sons</LEDGERNAME>
```

That's **invalid XML**. The `&` character is a reserved symbol in XML -- it starts an entity reference (like `&amp;` or `&lt;`). A bare `&` will cause the XML parser to choke and Tally to reject your request.

:::danger
If you build XML by string concatenation without escaping, you WILL hit this bug in production. Indian business names virtually guarantee it. Fix this before you ship anything.
:::

## The five special characters

XML has five characters that MUST be escaped when they appear in text content:

| Character | Escape | Name |
|---|---|---|
| `&` | `&amp;` | Ampersand |
| `<` | `&lt;` | Less than |
| `>` | `&gt;` | Greater than |
| `"` | `&quot;` | Double quote |
| `'` | `&apos;` | Single quote/apostrophe |

The ampersand is the biggest offender because it's so common in business names. But the others can bite you too:

```
A < B Enterprises        (yes, really)
"Quality" Pharma         (quotes in name)
Sharma's Medical Store   (apostrophe)
```

## Real-world names that break naive XML

Here's a hall of fame of actual Indian business names that will break your XML if you don't escape:

```
M/s Patel & Sons
Shah & Associates
Kumar & Kumar Pharma
R & D Medical
A & Co - S/Dr
"New" Medical Store
Sharma's Drug House
<Blank> Enterprises       (yes, someone
                           named their
                           company this)
Johnson & Johnson India
Procter & Gamble Health
```

## The fix: escape before building XML

Every string that goes into your XML must be escaped first. No exceptions.

### Go

```go
import "encoding/xml"

func escapeXML(s string) string {
    var buf bytes.Buffer
    xml.EscapeText(&buf, []byte(s))
    return buf.String()
}

// Usage
name := "M/s Patel & Sons"
xml := fmt.Sprintf(
    "<LEDGERNAME>%s</LEDGERNAME>",
    escapeXML(name),
)
// <LEDGERNAME>M/s Patel &amp; Sons
// </LEDGERNAME>
```

Or better yet, use Go's `xml.Marshal` which handles escaping automatically:

```go
type Ledger struct {
    XMLName xml.Name `xml:"LEDGER"`
    Name    string   `xml:"NAME,attr"`
    Parent  string   `xml:"PARENT"`
}

l := Ledger{
    Name:   "M/s Patel & Sons",
    Parent: "Sundry Debtors",
}
data, _ := xml.Marshal(l)
// Properly escaped automatically
```

:::tip
If you use `xml.Marshal` or `xml.Encoder` in Go, escaping is handled for you. String concatenation is where the bugs live. Avoid `fmt.Sprintf` for building XML whenever possible.
:::

### Python

```python
from xml.sax.saxutils import escape

name = "M/s Patel & Sons"
xml_str = (
    f"<LEDGERNAME>"
    f"{escape(name)}"
    f"</LEDGERNAME>"
)

# Or use xml.etree for safe building
import xml.etree.ElementTree as ET
elem = ET.SubElement(
    parent, "LEDGERNAME"
)
elem.text = name  # Auto-escaped
```

### JavaScript

```js
function escapeXml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

const name = "M/s Patel & Sons";
const xml =
  `<LEDGERNAME>` +
  `${escapeXml(name)}` +
  `</LEDGERNAME>`;
```

:::caution
The order of replacements matters in the JavaScript version. Always replace `&` FIRST. If you replace `<` with `&lt;` first and then replace `&` with `&amp;`, your `&lt;` becomes `&amp;lt;`. Ampersand goes first.
:::

## CDATA sections: an alternative

Instead of escaping individual characters, you can wrap values in CDATA sections:

```xml
<LEDGERNAME>
  <![CDATA[M/s Patel & Sons]]>
</LEDGERNAME>
```

Inside `<![CDATA[...]]>`, everything is treated as plain text. No escaping needed. The only thing you can't put inside CDATA is the string `]]>` itself (which would end the section).

However, we recommend entity escaping over CDATA for Tally integration because:

- Some Tally versions handle CDATA inconsistently
- Entity escaping is simpler and more universal
- CDATA adds visual noise to the XML

## When reading responses

When **parsing** XML from Tally, you don't need to worry about escaping -- your XML parser handles it automatically. `&amp;` in the raw XML becomes `&` in the parsed string.

This is only a concern when **building** XML to send to Tally.

## The checklist

Before shipping your connector, make sure:

- [ ] All string values are escaped before XML insertion
- [ ] You've tested with names containing `&`
- [ ] You've tested with names containing `<` and `>`
- [ ] You've tested with names containing quotes
- [ ] You're using an XML library (not string concatenation) wherever possible
- [ ] You have a test case for `"M/s Patel & Sons"`

If all boxes are checked, you're safe. If even one is missed, you'll hear about it from the first stockist whose name has an ampersand.
