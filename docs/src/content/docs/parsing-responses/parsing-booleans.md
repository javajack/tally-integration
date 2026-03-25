---
title: Parsing Booleans
description: Tally booleans are always strings -- "Yes"/"No", "1"/"0", or "True"/"False". Here's how to handle them all.
---

This one's quick. Tally never uses native boolean types. Every boolean value is a string. But there are three flavors you need to handle.

## The three boolean formats

| Format | Where it appears |
|---|---|
| `"Yes"` / `"No"` | Most fields (90%+) |
| `"1"` / `"0"` | Some CMPINFO fields |
| `"True"` / `"False"` | Rare, some reports |

The vast majority of Tally booleans look like this:

```xml
<ISBATCHENABLED>Yes</ISBATCHENABLED>
<HASMFGDATE>No</HASMFGDATE>
<ISMULTISTORAGEOPTION>Yes</ISMULTISTORAGEOPTION>
```

## Absent tags mean false

If a boolean tag is completely absent from the XML, treat it as `false` / `No`. Tally omits tags when they're in their default state, and the default for most boolean flags is `No`.

```xml
<!-- Tag present = Yes -->
<ISBATCHENABLED>Yes</ISBATCHENABLED>

<!-- Tag absent = No (implicit) -->
```

An empty tag also means false:

```xml
<ISBATCHENABLED/>
<ISBATCHENABLED></ISBATCHENABLED>
```

## Case sensitivity

Tally is mostly consistent with capitalization (`Yes`/`No`), but don't bet your parser on it. Always compare case-insensitively.

## Implementation

This is one function you can write in about five lines.

### Go

```go
func ParseBool(s string) bool {
    switch strings.ToLower(
        strings.TrimSpace(s),
    ) {
    case "yes", "1", "true":
        return true
    default:
        return false
    }
}
```

### Python

```python
def parse_bool(s: str) -> bool:
    return (s or "").strip().lower() in (
        "yes", "1", "true"
    )
```

### JavaScript

```js
function parseBool(s) {
  return ["yes", "1", "true"].includes(
    (s || "").trim().toLowerCase()
  );
}
```

## That's it

Seriously, that's the whole page. Booleans are the one thing in Tally XML parsing that's actually straightforward.

:::tip
When building XML to **send** to Tally (import/write-back), always use `Yes` and `No` -- the capitalized string format. Tally expects this for import operations.
:::
