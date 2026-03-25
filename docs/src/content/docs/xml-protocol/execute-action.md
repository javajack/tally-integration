---
title: "Execute/TDLAction — Trigger Actions"
description: How to use Execute/TDLAction to trigger internal Tally actions — the least common request type, but useful for custom automation and sync triggers.
---

This is the fifth and least common request type. While Export and Import handle 99% of integration needs, Execute/TDLAction lets you trigger internal Tally actions programmatically.

You probably will not need this early on. But when you do, it is good to know it exists.

## When to Use Execute/TDLAction

- **Triggering a custom TDL action** defined by a loaded TDL plugin
- **Sync triggers** — kicking off Tally.NET sync programmatically
- **Custom automation** — running a TDL procedure that performs multiple internal operations
- **Batch operations** that are easier to express as a TDL action than as individual imports

## The Basic Template

```xml
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Execute</TALLYREQUEST>
    <TYPE>TDLAction</TYPE>
    <ID>ActionName</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVCURRENTCOMPANY>
          Your Company Name
        </SVCURRENTCOMPANY>
      </STATICVARIABLES>
    </DESC>
  </BODY>
</ENVELOPE>
```

The `ID` is the name of the TDL action to execute. This must be a valid action that Tally recognizes — either built-in or defined by a loaded TDL.

## Example: Triggering a Custom Action

If you have a TDL file loaded in Tally that defines a custom action called `MyExportTrigger`, you can execute it remotely:

```xml
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Execute</TALLYREQUEST>
    <TYPE>TDLAction</TYPE>
    <ID>MyExportTrigger</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVCURRENTCOMPANY>
          Stockist Pharma Pvt Ltd
        </SVCURRENTCOMPANY>
      </STATICVARIABLES>
    </DESC>
  </BODY>
</ENVELOPE>
```

The response depends entirely on what the action does. It could return a status message, trigger a file export, or perform internal Tally operations.

## Why You Rarely Need This

For standard integrations, Export and Import cover the full read/write cycle:

| Need | Better Approach |
|------|----------------|
| Pull data | Export/Data or Export/Collection |
| Push data | Import/Data |
| Check status | Export/Function |
| Custom batch logic | Multiple Import/Data calls |

Execute/TDLAction only becomes necessary when:

1. You have installed a **custom TDL plugin** on the stockist's machine that defines specific actions
2. You need to trigger an operation that is **not expressible** as a simple data import
3. You are building a **TDL-enhanced integration** where the TDL plugin does heavy lifting server-side

:::tip
If you are building a connector that needs to work on any stockist's machine without installing TDL files, you can safely skip Execute/TDLAction. Everything you need is available through Export and Import with inline TDL.
:::

## Practical Use Case: On-Save Notification

One compelling use of TDL actions is building a push-based sync model. Instead of polling Tally for changes, you install a TDL that fires an action whenever a voucher is saved. That action calls back to your connector via HTTP.

However, this requires a TDL file to be loaded on the stockist's machine — which may not always be feasible. For most integrations, the polling approach (using `$$MaxVoucherAlterID` from [Export/Function](/tally-integartion/xml-protocol/export-function/)) is simpler and works without any TDL installation.

## Response Format

The response structure varies by action. At minimum, you will get an envelope indicating success or failure:

```xml
<ENVELOPE>
  <BODY>
    <DATA>
      <RESULT>Action completed</RESULT>
    </DATA>
  </BODY>
</ENVELOPE>
```

Or in case of an error:

```xml
<ENVELOPE>
  <BODY>
    <DATA>
      <RESULT>Unknown Action</RESULT>
    </DATA>
  </BODY>
</ENVELOPE>
```

## What is Next

Now that you have seen all five request types, it is time to learn the real superpower — embedding TDL definitions directly in your XML requests, so you never need to install TDL files on the stockist's machine. Head to [Inline TDL](/tally-integartion/xml-protocol/inline-tdl/).
