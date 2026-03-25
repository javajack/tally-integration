---
title: Party Naming Chaos
description: How Indian SMBs actually name their ledgers -- M/s prefixes, city suffixes, phone numbers in names, GSTIN hacks, and duplicate-avoidance tricks.
---

If you expect ledger names to be clean, consistent, and parseable -- we have some bad news. Indian SMB party naming is a beautiful mess, and your connector needs to embrace it.

## The Reality

Within a **single** Tally company, you'll find all of these naming patterns side by side. No standard. No convention. Just whatever the billing clerk typed that day.

## Formal Patterns

```
M/s Raj Medical Store
M/S RAJ MEDICAL STORE
Raj Medical Store, Ahmedabad
Raj Medical Store - Ahmedabad
Raj Medical Store (Ahmedabad)
Raj Medical Store [AHM]
```

The `M/s` prefix (short for Messrs) is a formal business prefix used widely in Indian commerce. You'll see `M/s`, `M/S`, and `M/s.` variants.

## Informal Patterns

```
Raj Medical
RAJ MED
raj medical store
RajMedical
Raj Med. Store
```

Billing clerks abbreviate freely. Capitalisation is whatever mood they're in.

## The Duplicate Avoidance Hacks

When Tally prevents duplicate names, users get creative:

```
A & Co - S/Dr       (debtor version)
A & Co - S/Cr       (creditor version)
Raj Medical (Old)   (old account)
Raj Medical Store 2  (numbered duplicate)
Raj Medical Store - DO NOT USE
```

:::caution
"DO NOT USE" ledgers are real. They exist because Tally doesn't let you delete a ledger that has transactions. CAs leave them as zombie entries with a warning label.
:::

## Phone Numbers and GSTINs in Names

When party details are messy and the operator wants quick identification:

```
Raj Medical 9876543210
Raj Medical 24ABCDE1234F1Z5
Raj Medical (DL: GJ/12345)
```

Yes, people put phone numbers and GSTINs directly in the ledger name. It's a search hack -- they type the phone number to find the party quickly.

## Territory and Route Encoding

Sales teams encode route information in party names for quick filtering:

```
AHM-001 Raj Medical Store
Z1/Raj Medical Store
Raj Medical Store [Maninagar]
Raj Medical-MN-AHM
```

## Multi-State / Multi-GSTIN Variants

The same business entity with branches:

```
Raj Medical Store - GJ
Raj Medical Store (24)
Raj Medical Store - MH
```

The number in parentheses is the state code (24 = Gujarat, 27 = Maharashtra).

## What This Means for Your Connector

1. **Never use ledger name as a unique identifier.** Use GUID.

2. **Never assume name format.** Your search must be fuzzy.

3. **GSTIN is the only reliable entity identifier** for registered businesses.

4. **For unregistered parties** (small medical shops with no GSTIN), you need the [fuzzy matching algorithm](/tally-integartion/real-world-data/party-deduplication/).

5. **Store the raw name as-is.** Don't try to "clean" it -- the user typed it that way for a reason.

6. **Build a search index** that handles partial matches, abbreviations, and case-insensitive lookups.

## 10+ Real Examples

Here are actual ledger names from production Tally installations:

| # | Ledger Name | What's Going On |
|---|---|---|
| 1 | `M/s Raj Medical Store, Ahmedabad` | Formal with city |
| 2 | `RAJ MED` | Ultra-abbreviated |
| 3 | `Raj Medical 9876543210` | Phone number in name |
| 4 | `Raj Medical 24ABCDE1234F1Z5` | GSTIN in name |
| 5 | `AHM-001 Raj Medical Store` | Route code prefix |
| 6 | `Raj Medical (Old)` | Deprecated account |
| 7 | `Raj Medical Store - DO NOT USE` | Zombie ledger |
| 8 | `Raj Medical - S/Dr` | Debtor variant |
| 9 | `Raj Medical - S/Cr` | Creditor variant |
| 10 | `Z1/Raj Medical Store` | Zone prefix |
| 11 | `Raj Medical Store (24)` | State code suffix |
| 12 | `Raj Medical-MN-AHM` | Area-city suffix |

All twelve of these could represent the **same physical medical shop**. That's party naming chaos.
