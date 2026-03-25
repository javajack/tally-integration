---
title: Language Recipes
description: Quick-start code snippets for integrating with TallyPrime in Python, Node.js, C#, Go, and Java — minimal but complete and runnable.
---

Enough theory. Let's write some code.

Each recipe below does the same thing: connect to TallyPrime, fetch a list of stock items, and print the first one. Minimal, complete, and runnable. Pick your language and go.

:::tip[Prerequisites for all recipes]
TallyPrime must be running with its HTTP server enabled on `localhost:9000`. Open TallyPrime, press `F12` (Advanced Configuration), and set "Enable ODBC Server" to Yes.
:::

## Python

The most popular choice for quick Tally integrations. We'll use `requests` for HTTP and `lxml` for XML parsing.

### Install

```bash
pip install requests lxml
```

### Code

```python
import requests
from lxml import etree

XML_REQUEST = """
<ENVELOPE>
 <HEADER>
  <TALLYREQUEST>Export Data</TALLYREQUEST>
 </HEADER>
 <BODY>
  <EXPORTDATA>
   <REQUESTDESC>
    <REPORTNAME>
     List of Stock Items
    </REPORTNAME>
   </REQUESTDESC>
  </EXPORTDATA>
 </BODY>
</ENVELOPE>""".strip()

resp = requests.post(
    "http://localhost:9000",
    data=XML_REQUEST,
    headers={"Content-Type": "text/xml"},
)

root = etree.fromstring(resp.content)
items = root.xpath("//STOCKITEM")

if items:
    name = items[0].findtext("STOCKITEMNAME")
    print(f"First stock item: {name}")
else:
    print("No stock items found.")
```

### What's Happening

1. We POST raw XML to Tally's HTTP server
2. Tally responds with XML containing all stock items
3. We parse the response and extract the first item's name

That's the entire pattern. Everything else is variations on this theme.

---

## Node.js

Using `axios` for HTTP and `fast-xml-parser` for XML parsing. Fast, async, and JavaScript-native.

### Install

```bash
npm install axios fast-xml-parser
```

### Code

```javascript
const axios = require("axios");
const { XMLParser } = require("fast-xml-parser");

const xmlRequest = `
<ENVELOPE>
 <HEADER>
  <TALLYREQUEST>Export Data</TALLYREQUEST>
 </HEADER>
 <BODY>
  <EXPORTDATA>
   <REQUESTDESC>
    <REPORTNAME>
     List of Stock Items
    </REPORTNAME>
   </REQUESTDESC>
  </EXPORTDATA>
 </BODY>
</ENVELOPE>`.trim();

async function main() {
  const resp = await axios.post(
    "http://localhost:9000",
    xmlRequest,
    { headers: { "Content-Type": "text/xml" } }
  );

  const parser = new XMLParser();
  const result = parser.parse(resp.data);
  const items =
    result?.ENVELOPE?.BODY?.DATA?.COLLECTION
      ?.STOCKITEM;

  if (items) {
    const first = Array.isArray(items)
      ? items[0] : items;
    console.log("First stock item:", first.NAME);
  } else {
    console.log("No stock items found.");
  }
}

main().catch(console.error);
```

:::caution[Array vs. single object]
When Tally returns exactly one item, `fast-xml-parser` gives you an object instead of an array. Always check with `Array.isArray()` before indexing. This trips up *everyone* at least once.
:::

---

## C\#

Using the [TallyConnector](https://github.com/Accounting-Companion/TallyConnector) NuGet package. This one is a joy — it abstracts all the XML away.

### Install

```bash
dotnet add package TallyConnector
```

### Code

```csharp
using TallyConnector;
using TallyConnector.Models;

var tally = new Tally("http://localhost:9000");

// Fetch all stock items
var items = await tally
    .GetStockItemsAsync();

if (items.Count > 0)
{
    Console.WriteLine(
        $"First stock item: {items[0].Name}"
    );
}
else
{
    Console.WriteLine(
        "No stock items found."
    );
}
```

### Why C# Rocks Here

Notice there's no XML anywhere in this code. TallyConnector handles:

- Building the XML request envelope
- Sending the HTTP POST
- Parsing the XML response
- Deserializing into strongly-typed C# objects

If you're in the .NET ecosystem, this is the path of least resistance.

---

## Go

Go is the connector language of choice for production Tally integrations. Strong typing, fast execution, single binary deployment. We use the standard library — no external deps needed.

### Code

```go
package main

import (
	"bytes"
	"encoding/xml"
	"fmt"
	"io"
	"net/http"
)

type Envelope struct {
	XMLName xml.Name `xml:"ENVELOPE"`
	Body    struct {
		Data struct {
			Collection struct {
				Items []StockItem `xml:"STOCKITEM"`
			} `xml:"COLLECTION"`
		} `xml:"DATA"`
	} `xml:"BODY"`
}

type StockItem struct {
	Name string `xml:"NAME"`
}

func main() {
	xmlReq := `
<ENVELOPE>
 <HEADER>
  <TALLYREQUEST>Export Data</TALLYREQUEST>
 </HEADER>
 <BODY>
  <EXPORTDATA>
   <REQUESTDESC>
    <REPORTNAME>
     List of Stock Items
    </REPORTNAME>
   </REQUESTDESC>
  </EXPORTDATA>
 </BODY>
</ENVELOPE>`

	resp, err := http.Post(
		"http://localhost:9000",
		"text/xml",
		bytes.NewBufferString(xmlReq),
	)
	if err != nil {
		panic(err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	var env Envelope
	xml.Unmarshal(body, &env)

	items := env.Body.Data.Collection.Items
	if len(items) > 0 {
		fmt.Println(
			"First stock item:", items[0].Name,
		)
	} else {
		fmt.Println("No stock items found.")
	}
}
```

### Why Go Works Well

- **Struct tags** map directly to XML elements — no manual parsing
- **Single binary** deployment — no runtime dependencies on the target machine
- **Fast** — compiles to native code, handles concurrent connections effortlessly

:::tip[Go for production]
If you're building a long-running Tally sync service, Go is an excellent choice. The `encoding/xml` package handles Tally's XML quirks well, and goroutines make it easy to sync multiple companies in parallel.
:::

---

## Java

Using Java's built-in `HttpClient` (Java 11+) and DOM parser. No external dependencies.

### Code

```java
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import javax.xml.parsers.*;
import org.w3c.dom.*;
import java.io.ByteArrayInputStream;

public class TallyDemo {
  public static void main(String[] args)
      throws Exception {

    String xmlReq = """
      <ENVELOPE>
       <HEADER>
        <TALLYREQUEST>
         Export Data
        </TALLYREQUEST>
       </HEADER>
       <BODY>
        <EXPORTDATA>
         <REQUESTDESC>
          <REPORTNAME>
           List of Stock Items
          </REPORTNAME>
         </REQUESTDESC>
        </EXPORTDATA>
       </BODY>
      </ENVELOPE>""";

    var client = HttpClient.newHttpClient();
    var request = HttpRequest.newBuilder()
      .uri(URI.create(
        "http://localhost:9000"))
      .header(
        "Content-Type", "text/xml")
      .POST(HttpRequest.BodyPublishers
        .ofString(xmlReq))
      .build();

    var response = client.send(
      request,
      HttpResponse.BodyHandlers
        .ofString());

    var factory = DocumentBuilderFactory
      .newInstance();
    var builder = factory
      .newDocumentBuilder();
    var doc = builder.parse(
      new ByteArrayInputStream(
        response.body().getBytes()));

    var items = doc
      .getElementsByTagName("STOCKITEM");

    if (items.getLength() > 0) {
      var first = (Element) items.item(0);
      var name = first
        .getElementsByTagName("NAME")
        .item(0).getTextContent();
      System.out.println(
        "First stock item: " + name);
    } else {
      System.out.println(
        "No stock items found.");
    }
  }
}
```

### Notes on Java

- Uses **text blocks** (triple quotes) — requires Java 15+
- The DOM parser is verbose but familiar to Java developers
- For production, consider JAXB with annotated POJOs (similar to Go's struct tags)

---

## Quick Reference

| Language | HTTP Library | XML Parser | Lines |
|----------|-------------|------------|-------|
| Python | requests | lxml | ~18 |
| Node.js | axios | fast-xml-parser | ~22 |
| C# | TallyConnector | Built-in | ~10 |
| Go | net/http | encoding/xml | ~25 |
| Java | HttpClient | DOM | ~30 |

## What's Next?

These recipes get you *reading* from Tally. For writing (creating vouchers, updating ledgers), the pattern is the same — you just POST different XML. Check the main guide for write operation examples.

:::danger[Don't forget error handling]
These recipes skip error handling for clarity. In production, you need to handle: Tally not running, company not open, malformed XML responses, network timeouts, and the dreaded empty response that means Tally silently rejected your request.
:::
