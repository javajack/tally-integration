---
title: The 20 Nevers
description: The definitive list of 20 rules for Tally connector development -- break any of these and your integration will fail in production.
---

These are the hard-won rules of Tally integration. Every single one comes from real production failures. Print this list. Tape it to your monitor.

## The Rules

### 1. Never match by name -- use GUID

**What goes wrong:** A CA renames "ABC Medical" to "ABC Medical Store, Ahmedabad". Your name-based lookup creates a duplicate. Outstandings split across two records.

:::danger
Names change. GUIDs are forever. Always use `GUID` as your primary identifier for every Tally object.
:::

### 2. Never assume XML tag structure

**What goes wrong:** You parse `ALLLEDGERENTRIES.LIST` but the stockist uses Accounting Voucher View, which outputs `LEDGERENTRIES.LIST`. Half your vouchers come through empty.

Your parser must handle **both** tag variants for every entry type.

### 3. Never push without validating masters exist

**What goes wrong:** You push a Sales Order referencing "Dolo 650 Tab" but the Stock Item doesn't exist yet. Tally silently drops the voucher or creates a corrupt entry. No error, just missing data.

Always create masters **before** transactions, in dependency order.

### 4. Never pull all vouchers in one request

**What goes wrong:** A busy stockist has 100K+ vouchers per year. A single export request generates 200-500 MB of XML. Tally freezes. The connector runs out of memory. The operator calls you.

Batch by date range or count. Max 5,000 objects per request.

### 5. Never trust computed stock over Tally's report

**What goes wrong:** You sum up voucher quantities and get a closing stock of 450. Tally's Stock Summary says 430. The difference? Opening balance adjustments, valuation method effects, and CA corrections your math can't replicate.

Tally's Stock Summary report is the **source of truth**.

### 6. Never assume features are enabled

**What goes wrong:** You push a voucher with batch allocations to a company that has batches disabled. Silent failure. Or you omit godown names for a multi-godown company. Data lands in the wrong location.

Profile the company's feature flags **before** any push.

### 7. Never assume voucher numbers are unique

**What goes wrong:** With manual numbering and "Prevent Duplicates = No", the same number can exist twice. You use the voucher number as a key and overwrite one with the other.

Use GUID as the unique key. Voucher numbers are for display only.

### 8. Always use a streaming XML parser

**What goes wrong:** Your DOM parser loads 500 MB of voucher XML into memory. The connector crashes with an out-of-memory error on the stockist's 4 GB machine.

Use SAX/StAX (or Go's `xml.Decoder`) for collection exports. Process token by token.

### 9. Always escape special characters in push XML

**What goes wrong:** "M/s Patel & Sons" becomes `<LEDGERNAME>M/s Patel & Sons</LEDGERNAME>`. That `&` breaks XML parsing. Tally rejects the import silently or crashes.

Escape: `&` -> `&amp;`, `<` -> `&lt;`, `>` -> `&gt;`, `"` -> `&quot;`

### 10. Never assume clean data

**What goes wrong:** You build logic assuming one ledger per party, correct group classification, and complete GSTIN data. In reality: duplicates everywhere, wrong groups, missing GSTINs.

Validate and normalize. Always.

### 11. Never assume UDF tag names are stable

**What goes wrong:** You parse `<DRUGSCHEDULE.LIST>` and it works for months. The TDL license expires. Now it's `<UDF_STRING_30.LIST>`. Your parser misses the field entirely.

Key on the `Index` attribute, not the tag name.

### 12. Never assume automatic voucher numbering

**What goes wrong:** You omit the voucher number expecting Tally to auto-assign, but the company uses manual numbering. Import fails with no useful error.

Detect the numbering method per voucher type. Use a unique prefix for connector-generated numbers.

### 13. Never assume single company

**What goes wrong:** You hardcode the company name. The stockist runs two companies (Ethical + OTC). Your connector only syncs one.

Always discover and list all loaded companies on startup.

### 14. Never assume Tally is always running

**What goes wrong:** The operator closes Tally for lunch. Your connector throws unhandled connection errors and crashes. When Tally comes back, no recovery.

Implement retry with exponential backoff. Serve from local SQLite cache during downtime.

### 15. Never block Tally Silver users

**What goes wrong:** Your connector holds a long HTTP connection to Tally Silver (single-user license). The operator can't use Tally while your sync runs. They uninstall your software.

Keep requests fast. Schedule heavy syncs for off-hours.

### 16. Never skip the ampersand

**What goes wrong:** The `&` character in names, narrations, and addresses is the #1 cause of failed XML imports. Confirmed by multiple Tally community reports.

Escape **all** special characters in every push operation.

### 17. Never ignore the Tally.imp log

**What goes wrong:** Your HTTP push returns a 200 OK, but the data wasn't actually imported. You assume success. The `Tally.imp` log file would have told you `Errors: 1`.

Parse `Tally.imp` as a secondary confirmation after every import.

### 18. Never assume batch names are just identifiers

**What goes wrong:** The batch name is "B-12345 MRP:50.00". You store it as-is. Your sales app can't show the MRP because you didn't extract it from the batch name.

Pharma distributors embed MRP in batch names. Parse with regex: `/MRP\s*[:/-]?\s*(\d+\.?\d*)/i`

### 19. Never assume quantity strings are just numbers

**What goes wrong:** The quantity is `"2 Box of 10 Strip = 20 Strip"`. You try to parse "2 Box of 10 Strip = 20 Strip" as a float and get NaN.

Quantity strings contain units, compound expressions, and base-unit conversions. Build a proper parser.

### 20. Never assume encoding is UTF-8

**What goes wrong:** An older Tally ERP 9 installation exports in Windows-1252. Your UTF-8 parser garbles the Rupee symbol and Hindi text.

Detect encoding from Content-Type and XML declaration. Handle UTF-8, Windows-1252, and mixed content.

## Quick Reference

| # | Rule | Risk if Violated |
|---|---|---|
| 1 | Use GUID not name | Duplicates, lost data |
| 2 | Handle both XML views | Missing vouchers |
| 3 | Validate masters first | Corrupt imports |
| 4 | Batch your pulls | Tally freeze, OOM |
| 5 | Trust Tally's reports | Wrong stock numbers |
| 6 | Check feature flags | Silent push failure |
| 7 | GUID as unique key | Data overwrites |
| 8 | Streaming XML parser | Connector crash |
| 9 | Escape special chars | Import rejection |
| 10 | Expect dirty data | Logic failures |
| 11 | Key UDFs by Index | Lost custom fields |
| 12 | Detect numbering mode | Import failure |
| 13 | Multi-company aware | Incomplete sync |
| 14 | Handle Tally downtime | Connector crash |
| 15 | Don't block Silver | User revolt |
| 16 | Escape ampersands | #1 import failure |
| 17 | Check Tally.imp | False success |
| 18 | Parse batch names | Missing MRP data |
| 19 | Parse quantity strings | NaN errors |
| 20 | Detect encoding | Garbled text |
