---
title: Dual Voucher Views
description: Tally has two voucher viewing modes with different XML tag names. Your parser must handle both or you will silently miss data.
---

This is one of those Tally quirks that can silently eat your data if you don't know about it. Tally has two different ways to view (and export) a voucher, and the **XML tag names change** between them.

## The two views

When you open a voucher in Tally, you see one of two views:

| View | When it's used |
|---|---|
| **Accounting Voucher View** | Vouchers entered in accounting mode (no inventory detail) |
| **Invoice Voucher View** | Vouchers entered in invoice mode (with line items, quantities, rates) |

The view is determined by the `<PERSISTEDVIEW>` tag on the voucher:

```xml
<!-- Accounting mode -->
<PERSISTEDVIEW>
  Accounting Voucher View
</PERSISTEDVIEW>

<!-- Invoice mode -->
<PERSISTEDVIEW>
  Invoice Voucher View
</PERSISTEDVIEW>
```

The problem? The tag names for ledger entries and inventory entries are **different** between these two views.

## The tag name differences

Here's the critical comparison:

| Data | Accounting View | Invoice View |
|---|---|---|
| Ledger entries | `LEDGERENTRIES.LIST` | `ALLLEDGERENTRIES.LIST` |
| Inventory entries | `INVENTORYENTRIES.LIST` | `ALLINVENTORYENTRIES.LIST` |

:::danger
If your parser only looks for `ALLLEDGERENTRIES.LIST`, you will **completely miss** the ledger entries on vouchers that use Accounting Voucher View. No error, no warning -- just missing data.
:::

## Why this happens

In Accounting Voucher View, the user enters only accounting entries (debits and credits) without inventory detail. Tally uses the shorter tag names: `LEDGERENTRIES.LIST` and `INVENTORYENTRIES.LIST`.

In Invoice Voucher View, the user enters line items with stock items, quantities, and rates. Tally uses the `ALL`-prefixed tag names: `ALLLEDGERENTRIES.LIST` and `ALLINVENTORYENTRIES.LIST`.

The same voucher type (say, a Sales Invoice) can be entered in either view depending on the Tally configuration and the user's choice. So you genuinely see both tag variants in the wild.

## What each view looks like in XML

### Accounting Voucher View

```xml
<VOUCHER VCHTYPE="Sales">
  <PERSISTEDVIEW>
    Accounting Voucher View
  </PERSISTEDVIEW>

  <!-- Note: no ALL prefix -->
  <LEDGERENTRIES.LIST>
    <LEDGERNAME>Raj Medical</LEDGERNAME>
    <AMOUNT>-11800.00</AMOUNT>
  </LEDGERENTRIES.LIST>

  <LEDGERENTRIES.LIST>
    <LEDGERNAME>Sales Account</LEDGERNAME>
    <AMOUNT>10000.00</AMOUNT>
  </LEDGERENTRIES.LIST>

  <!-- Inventory entries may be absent
       entirely, or use the short name -->
</VOUCHER>
```

### Invoice Voucher View

```xml
<VOUCHER VCHTYPE="Sales">
  <PERSISTEDVIEW>
    Invoice Voucher View
  </PERSISTEDVIEW>

  <!-- Note: ALL prefix -->
  <ALLLEDGERENTRIES.LIST>
    <LEDGERNAME>Raj Medical</LEDGERNAME>
    <AMOUNT>-11800.00</AMOUNT>
  </ALLLEDGERENTRIES.LIST>

  <ALLLEDGERENTRIES.LIST>
    <LEDGERNAME>Sales Account</LEDGERNAME>
    <AMOUNT>10000.00</AMOUNT>
  </ALLLEDGERENTRIES.LIST>

  <ALLINVENTORYENTRIES.LIST>
    <STOCKITEMNAME>Dolo 650</STOCKITEMNAME>
    <ACTUALQTY>100 Strip</ACTUALQTY>
    <RATE>50.00/Strip</RATE>
    <AMOUNT>5000.00</AMOUNT>
  </ALLINVENTORYENTRIES.LIST>
</VOUCHER>
```

## Detection strategy

You have two options for handling this:

### Option 1: Check PERSISTEDVIEW first

Read `<PERSISTEDVIEW>` and then look for the correct tag names:

```go
if view == "Accounting Voucher View" {
    // Parse LEDGERENTRIES.LIST
    // Parse INVENTORYENTRIES.LIST
} else {
    // Parse ALLLEDGERENTRIES.LIST
    // Parse ALLINVENTORYENTRIES.LIST
}
```

### Option 2: Parse both (recommended)

Just look for **all four** tag names on every voucher. This is simpler and more resilient:

```go
type Voucher struct {
    // Invoice Voucher View
    AllLedgers []LedgerEntry `xml:
        "ALLLEDGERENTRIES.LIST"`
    AllItems   []InvEntry    `xml:
        "ALLINVENTORYENTRIES.LIST"`

    // Accounting Voucher View
    Ledgers    []LedgerEntry `xml:
        "LEDGERENTRIES.LIST"`
    Items      []InvEntry    `xml:
        "INVENTORYENTRIES.LIST"`
}

// After parsing, merge:
func (v *Voucher) GetLedgerEntries() []LedgerEntry {
    if len(v.AllLedgers) > 0 {
        return v.AllLedgers
    }
    return v.Ledgers
}
```

:::tip
Option 2 is what we recommend. Parsing both tag variants and merging is safer than relying on `PERSISTEDVIEW` detection. Some vouchers in the wild have inconsistent or missing `PERSISTEDVIEW` values.
:::

## Python approach

```python
def get_ledger_entries(voucher_elem):
    entries = voucher_elem.findall(
        "ALLLEDGERENTRIES.LIST"
    )
    if not entries:
        entries = voucher_elem.findall(
            "LEDGERENTRIES.LIST"
        )
    return entries

def get_inventory_entries(voucher_elem):
    entries = voucher_elem.findall(
        "ALLINVENTORYENTRIES.LIST"
    )
    if not entries:
        entries = voucher_elem.findall(
            "INVENTORYENTRIES.LIST"
        )
    return entries
```

## JavaScript approach

```js
function getLedgerEntries(voucher) {
  return (
    voucher["ALLLEDGERENTRIES.LIST"]
    || voucher["LEDGERENTRIES.LIST"]
    || []
  );
}

function getInventoryEntries(voucher) {
  return (
    voucher["ALLINVENTORYENTRIES.LIST"]
    || voucher["INVENTORYENTRIES.LIST"]
    || []
  );
}
```

## Quick reference table

Full tag name mapping between the two views:

| Accounting View | Invoice View |
|---|---|
| `LEDGERENTRIES.LIST` | `ALLLEDGERENTRIES.LIST` |
| `INVENTORYENTRIES.LIST` | `ALLINVENTORYENTRIES.LIST` |

The child tags inside these entries (like `LEDGERNAME`, `AMOUNT`, `STOCKITEMNAME`, etc.) stay the same regardless of view. Only the parent list tag name changes.

## When pushing XML to Tally

When creating vouchers via import, you control which view to use with the `OBJVIEW` attribute and `PERSISTEDVIEW` tag:

```xml
<VOUCHER VCHTYPE="Sales Order"
  ACTION="Create"
  OBJVIEW="Invoice Voucher View">
  <PERSISTEDVIEW>
    Invoice Voucher View
  </PERSISTEDVIEW>
  <!-- Use ALL-prefixed tags here -->
  <ALLLEDGERENTRIES.LIST>
    ...
  </ALLLEDGERENTRIES.LIST>
</VOUCHER>
```

:::caution
When pushing vouchers, always use the `ALL`-prefixed tags with `Invoice Voucher View`. If you use the non-prefixed tags but specify Invoice view (or vice versa), Tally may silently ignore your entries or reject the voucher.
:::

## The bottom line

Always parse both tag variants. It costs you four extra lines of code and saves you from silently dropping data. This is one of those Tally behaviors that's easy to miss in testing (because your test data might all be in one view) and devastating in production.
