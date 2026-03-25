---
title: Parsing GUIDs
description: The four GUID formats in Tally, why you should treat them as opaque strings, and why GUIDs are the only reliable identifier.
---

Tally assigns a GUID (Globally Unique Identifier) to every object -- ledgers, stock items, vouchers, godowns, everything. These GUIDs are your lifeline for reliable identification.

## Why GUIDs matter

:::danger
Names change. GUIDs don't. A ledger named "Raj Medical Store" today might be renamed "Raj Medical Store - Ahmedabad" tomorrow. The GUID stays the same forever.
:::

This makes GUIDs the **only** reliable way to identify and track objects across syncs. Voucher numbers can be duplicated. Names can be changed. AlterIDs reset on data repair. But a GUID is permanent.

## The four GUID formats

Tally uses four different GUID formats across its objects. Here's what they look like:

```
Standard UUID:
  a0b1c2d3-e4f5-6789-0abc-def012345678

No-dash UUID:
  a0b1c2d3e4f567890abcdef012345678

Short format (masters):
  i012345678abcdef

Compound format (vouchers):
  012345678abcdef0-00000042:00000001
```

The format varies by Tally version, object type, and sometimes even the specific field.

## The golden rule: treat as opaque strings

:::tip
Never parse, validate, or generate Tally GUIDs. Treat them as opaque strings. Store them as `TEXT` in your database, compare them with string equality, and move on with your life.
:::

Don't try to:

- Validate the format (it changes between versions)
- Extract meaning from the components
- Generate your own GUIDs that "look like" Tally's
- Convert between formats
- Truncate or normalize them

Just read them, store them, and use them for matching.

## Where GUIDs appear in XML

On master objects, the GUID is usually a child element:

```xml
<STOCKITEM NAME="Paracetamol 500mg">
  <GUID>a0b1c2d3-e4f5-6789-...</GUID>
  <MASTERID>12345</MASTERID>
  ...
</STOCKITEM>
```

On vouchers, you'll find it in a similar position:

```xml
<VOUCHER>
  <GUID>012345678abcdef0-...</GUID>
  <MASTERID>67890</MASTERID>
  <VOUCHERNUMBER>INV/001</VOUCHERNUMBER>
  ...
</VOUCHER>
```

## GUID vs MasterID vs Name

| Identifier | Stable? | Unique? | Use for |
|---|---|---|---|
| GUID | Always | Always | Primary key, cross-sync matching |
| MasterID | Usually | Per-company | Secondary reference |
| Name | No | Not always | Display only |

MasterID is the integer ID Tally uses internally. It's unique within a company but can reset if the company data is repaired or restored from backup. GUIDs survive even those operations.

:::caution
After a data repair, MasterIDs may change but GUIDs remain the same. If your connector tracks objects by MasterID, a data repair will break your sync. Always use GUID as the primary key.
:::

## Storage recommendations

In your database schema:

```sql
-- SQLite
CREATE TABLE stock_items (
    tally_guid  TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    -- ...other fields
);

-- PostgreSQL
CREATE TABLE stock_items (
    tally_guid  TEXT NOT NULL UNIQUE,
    name        TEXT NOT NULL,
    -- ...other fields
);
```

Use `TEXT`, not `UUID` type in PostgreSQL. Tally's GUIDs don't always conform to the standard UUID format, and the compound/short formats will fail UUID validation.

## Quick summary

- Tally has 4 GUID formats -- don't try to normalize them
- Treat GUIDs as opaque strings
- GUID is the only identifier that never changes
- Store as `TEXT` in your database
- Use for all cross-sync object matching
