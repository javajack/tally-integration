---
title: What is TDL?
description: Tally Definition Language (TDL) and compiled TCP files -- why they matter for every connector that talks to real-world Tally installations.
---

If you've ever written a SQL stored procedure to customise a database, you already have the mental model for TDL. It's Tally's own scripting language, and you **will** encounter it in the wild.

## TDL in 30 Seconds

**TDL** stands for *Tally Definition Language*. It lets developers (and vendors) extend Tally's UI, reports, data fields, and even XML output -- without touching Tally's source code.

Think of it this way:

| Concept | SQL World | Tally World |
|---|---|---|
| Custom fields | `ALTER TABLE` | UDF via TDL |
| Custom reports | Views / SPs | TDL Report |
| Compiled form | `.pyc` / `.class` | `.tcp` file |

## TDL vs TCP

- **TDL** -- plain-text source code (`.tdl` files). Human-readable, editable.
- **TCP** -- compiled TDL (`.tcp` files). Think `.pyc` vs `.py`. **Not** human-readable.

Most commercial addons ship as `.tcp` so the source stays proprietary. You can't peek inside them, but you *can* observe their effects on Tally's XML output.

## Why This Matters for Connectors

Here's the thing: almost every Indian SMB running Tally has at least one third-party TDL addon loaded. Pharma stockists might have three or four. These addons do things that directly affect your connector:

### 1. They Add Custom Fields (UDFs)

A medical billing TDL might add `DrugSchedule`, `Manufacturer`, and `StorageTemp` fields to every Stock Item. These show up as extra XML tags your parser needs to handle.

### 2. They Modify XML Output

Some TDLs change how Tally renders its XML export. Tags get added, nested, or restructured. Your parser can't assume a "clean" Tally installation.

### 3. They Create Custom Voucher Types

A stockist might have "Sales - GST", "Purchase Return - Local", or "Sales - Export" -- all created by TDL addons. These inherit from standard parent types but carry different names.

## Where TDL/TCP Files Live

```
C:\TallyPrime\
  ├── MedicalBilling.tcp
  ├── SalesmanTracker.tcp
  ├── tally.ini        <-- lists loaded TDLs
  └── tdl/
      └── *.tcp        <-- account-level TDLs
```

The `tally.ini` file tells you which TDLs are active:

```ini
[Tally]
User TDL = Yes
User TDL0 = MedicalBilling.tcp
User TDL1 = SalesmanTracker.tcp
```

## The Bottom Line

:::caution
Never assume you're talking to a "vanilla" Tally installation. Discovery of loaded TDLs and their UDFs is a mandatory first step before any sync operation.
:::

Your connector must:

1. **Detect** which TDLs are loaded
2. **Discover** what UDFs they create
3. **Handle** both "TDL loaded" and "TDL unloaded" XML tag formats
4. **Store** UDF data flexibly (no per-stockist schema changes)

The next pages walk through each of these steps in detail.
