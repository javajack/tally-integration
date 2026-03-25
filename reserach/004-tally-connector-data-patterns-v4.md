# TALLY CONNECTOR — Real-World Data Patterns, Parsing Hell & Operational Survival Guide

## VERSION: 0.4-ADDENDUM | DATE: 2026-03-26

This document goes beyond the "what" into the "how it actually looks in the wild" — the naming hacks, data suffixes, encoding nightmares, and workarounds that actual Indian SMB Tally users and their CAs create.

---

## 1. NAMING CONVENTIONS IN THE WILD — WHAT DATA ACTUALLY LOOKS LIKE

### 1.1 Ledger (Party) Naming Patterns

Indian SMBs follow NO standard. Here are the patterns you WILL encounter, often all within the SAME company:

```
FORMAL PATTERNS:
  "M/s Raj Medical Store"              ← M/s prefix (Messrs, formal)
  "M/S RAJ MEDICAL STORE"             ← ALL CAPS variant
  "Raj Medical Store, Ahmedabad"       ← City suffix
  "Raj Medical Store - Ahmedabad"      ← Dash separator
  "Raj Medical Store (Ahmedabad)"      ← Parenthetical city
  "Raj Medical Store [AHM]"            ← Bracketed city code

INFORMAL PATTERNS:
  "Raj Medical"                        ← Shortened
  "RAJ MED"                            ← Abbreviated
  "raj medical store"                  ← No capitalization
  "RajMedical"                         ← No spaces
  "Raj Med. Store"                     ← Abbreviated with period

DUPLICATE AVOIDANCE HACKS (confirmed by Tally docs):
  "A & Co - S/Dr"                      ← Same party as debtor
  "A & Co - S/Cr"                      ← Same party as creditor
  "Raj Medical (Old)"                  ← Old account (duplicate created)
  "Raj Medical Store 2"               ← Numbered duplicate
  "Raj Medical Store - DO NOT USE"     ← Deactivated but not deleted

PHONE/GSTIN IN NAME (common hack when party details are messy):
  "Raj Medical 9876543210"            ← Phone number in name!
  "Raj Medical 24ABCDE1234F1Z5"      ← GSTIN in name!
  "Raj Medical (DL: GJ/12345)"        ← Drug License in name

TERRITORY/ROUTE ENCODING IN NAME:
  "AHM-001 Raj Medical Store"         ← Route code prefix
  "Z1/Raj Medical Store"              ← Zone/territory prefix
  "Raj Medical Store [Maninagar]"     ← Area in brackets
  "Raj Medical-MN-AHM"               ← Area-city suffix code

SAME PARTY ACROSS COMPANIES (multi-GSTIN):
  "Raj Medical Store - GJ"            ← State suffix
  "Raj Medical Store (24)"            ← State code (24 = Gujarat)
```

**Parsing implications**: You CANNOT rely on ledger name for deduplication or matching. GSTIN is the only reliable identifier for the same business entity. But many small medical shops are unregistered (no GSTIN). For unregistered parties, you need fuzzy matching: normalize to lowercase, strip prefixes (M/s, M/S), strip suffixes (S/Dr, S/Cr, city names), strip special chars, then compare.

**Fuzzy matching algorithm for party ledger names**:
```
1. Lowercase the name
2. Remove prefixes: "m/s ", "m/s. ", "messrs ", "shri ", "smt "
3. Remove suffixes: " - s/dr", " - s/cr", " (old)", " - do not use"
4. Remove content in brackets: (AHM), [MN-AHM], (24)
5. Remove city names from a known list (ahmedabad, surat, baroda, rajkot, etc.)
6. Remove " - ", " / ", separators between name and location
7. Remove digits that look like phone (10 consecutive) or GSTIN (15 char pattern)
8. Collapse multiple spaces to one
9. Trim
10. Compare using Levenshtein distance or trigram similarity
```

### 1.2 Stock Item Naming Patterns (Pharma)

Pharma distributors use WILDLY inconsistent naming:

```
PATTERN 1 — NAME + STRENGTH + FORM:
  "Paracetamol 500mg Tab"
  "PARACETAMOL 500 MG TABLET"
  "Paracetamol-500mg Tab"
  "Paracetamol 500 mg Tablets"
  "PARA 500 TAB"                       ← Ultra-abbreviated
  "Pcm 500"                            ← Trade abbreviation

PATTERN 2 — BRAND NAME + FORM:
  "Dolo 650"                           ← Brand name only
  "DOLO-650 TAB"
  "Dolo 650mg Tablet"
  "DOLO 650 TAB 15S"                   ← Pack size in name!

PATTERN 3 — BRAND + COMPANY:
  "Dolo 650 (Micro Labs)"
  "DOLO 650 - MICRO"
  "Dolo 650 Tab [ML]"                  ← Company abbreviation

PATTERN 4 — PACK SIZE EMBEDDED:
  "Paracetamol 500mg 10s"             ← 10 tablets per strip
  "Paracetamol 500mg Strip/10"        ← Strip of 10
  "Paracetamol 500mg x 10"            ← x 10
  "Amoxicillin 250mg 10x10"           ← 10 strips of 10 caps = 100
  "Crocin Advance 15s"                ← 15 tablets per strip
  "Pan-D Cap 10s"                      ← 10 capsules per strip
  "Augmentin 625 Duo Tab 10s"
  "Azithral 500 Tab 3s"               ← 3 tablet strip
  "Betadine 50ml"                      ← Liquid - ml
  "Benadryl Syrup 100ml"
  "Moov Spray 80g"                     ← Spray - grams

PATTERN 5 — HSN IN NAME (hack):
  "Paracetamol 500mg (30049099)"
  "Para 500 Tab-30049099"
```

**Unit of Measure patterns in pharma**:
```
SIMPLE UNITS:
  Tab, Tabs, Tablet, Tablets
  Cap, Caps, Capsule, Capsules
  Strip, Strips, Str
  Bot, Bottle, Bottles, Btl
  Inj, Injection, Vial
  Tube, Tubes
  Pcs, Nos, Nos., nos
  ml, ML, Ml
  gm, GM, Gm, g
  Kg, kg, KG
  Ltr, ltr, Lt, L

COMPOUND UNITS:
  "Box of 10 Strip"
  "Box of 10 Strips"
  "Carton of 100 Strip"
  "Dozen of 12 Nos"
  "Case of 50 Bottle"
```

**Parsing implications for stock items**: You need a normalisation layer that maps the many variants to a canonical form. Build a pharma-specific token dictionary:

```
FORM TOKENS:
  Tab/Tablet/Tablets/TAB  →  "Tablet"
  Cap/Capsule/Capsules/CAP  →  "Capsule"
  Inj/Injection/Vial/INJ  →  "Injection"
  Syr/Syrup/SYR  →  "Syrup"
  Drop/Drops/DRP  →  "Drops"
  Cream/CRM  →  "Cream"
  Oint/Ointment  →  "Ointment"
  Spray/SPR  →  "Spray"
  Gel  →  "Gel"
  Lotion  →  "Lotion"
  Suspension/Susp  →  "Suspension"

STRENGTH PATTERN:
  /(\d+\.?\d*)\s*(mg|mcg|g|ml|%|iu)/i  →  {value, unit}

PACK SIZE PATTERN:
  /(\d+)\s*[sx]/i  →  pack_size       (matches "10s", "10x10", "15S")
  /strip\s*\/?\s*(\d+)/i  →  pack_size  (matches "Strip/10", "strip 10")
```

### 1.3 Stock Group Naming Patterns (Pharma)

```
BY THERAPEUTIC CATEGORY (most common):
  "Analgesics", "Antibiotics", "Anti-inflammatory"
  "Cardiac", "Diabetic", "Gastro"
  "Ortho", "Derma", "Opthal"
  "Ayurvedic", "Homoeopathy"
  "OTC", "FMCG", "Surgical"

BY COMPANY/BRAND:
  "Cipla", "Sun Pharma", "Micro Labs"
  "Zydus", "Alkem", "Mankind"

BY SCHEDULE:
  "Schedule H", "Schedule H1", "Schedule X"
  "OTC Products"

MIXED (real-world chaos):
  "Cipla Products", "Sun Pharma - Cardiac"
  "General Medicines", "Fast Moving", "Slow Moving"
  "Expired Stock", "Near Expiry", "Damaged"
```

### 1.4 Godown/Location Naming Patterns

```
SIMPLE:
  "Main Location"         ← Tally default (NEVER rename this — legacy issues)
  "Warehouse", "Godown"
  "Counter", "Shop Floor"
  "Cold Storage"          ← For pharma (temperature-controlled)

WITH HIERARCHY:
  "Ahmedabad Warehouse > Rack A"
  "Main > Section 1"

SPECIAL PURPOSE:
  "Damaged Stock", "Expired Stock"
  "Return Stock", "QC Pending"
  "In Transit", "Vehicle"
  "Sample Stock"
  "Free Goods"             ← Scheme/promotional stock kept separate
```

### 1.5 Voucher Number Patterns

```
AUTOMATIC (Tally-generated):
  "1", "2", "3", ...          ← Simple sequential
  "S/1", "S/2"                 ← Prefix from voucher type config
  "AHM/S/1"                    ← Branch prefix
  "2025-26/S/001"              ← FY prefix

MANUAL (user-entered):
  "INV-001", "INV001"          ← User's own format
  "24-25/001"                  ← FY/serial
  "GJ/2024-25/S/0001"         ← State/FY/type/serial
  "SO-FIELD-0042"              ← If you're pushing from connector

GST INVOICE NUMBER PATTERNS:
  "INV/24-25/AHM/001"         ← Branch-wise for GST compliance
  "GSTR/2024-25/001"          ← GST-specific series
  Tally auto-generates based on voucher numbering config
```

### 1.6 Batch Name Patterns (Pharma)

```
MANUFACTURER BATCH:
  "B-12345", "LOT-2024-001"
  "MFG/24/001"
  "BATCH-A001"

INTERNAL BATCH (stockist's own):
  "20240401-CIPLA-001"         ← Date-company-serial
  "WH1-20240401"               ← Godown-date
  "PRIMARY"                     ← Default when single batch

MRP-BASED (common hack — batch name includes MRP!):
  "B-12345 MRP:50.00"         ← MRP embedded in batch name
  "LOT001-MRP150"              ← MRP as suffix
  "MRP-125/B-456"              ← MRP as prefix
```

**This MRP-in-batch-name hack is EXTREMELY common** in pharma distribution. Because Tally doesn't have a native "MRP per batch" field, distributors encode MRP in the batch name. Your parser should detect this pattern:
```
/MRP\s*[:/-]?\s*(\d+\.?\d*)/i
```

---

## 2. DATA QUALITY ISSUES IN THE WILD

### 2.1 The Most Common Data Mess

| Issue | Frequency | Example | Impact |
|---|---|---|---|
| **Duplicate ledgers** | Very high | "Raj Medical" AND "Raj Medical Store" for same party | Double counting of outstandings |
| **Duplicate stock items** | High | "Dolo 650" AND "DOLO 650 Tab" AND "Dolo-650" | Stock split across duplicates |
| **Wrong group classification** | Medium | Customer placed under Sundry Creditors | Party type identification fails |
| **Missing GSTIN** | Very high for small shops | Unregistered medical shops | No reliable entity matching |
| **Opening balance not set** | High (especially after split) | Stock summary shows wrong position | Inventory data unreliable |
| **Negative stock** | Very high | Sales entered before purchase | Normal pharma operation |
| **Cancelled but not deleted vouchers** | Medium | `ISCANCELLED=Yes` still in system | Must filter from reports |
| **Optional/Quotation vouchers** | Medium | `ISOPTIONAL=Yes` Sales Orders used as quotations | Must filter from order pipeline |
| **Void vouchers** | Low | `ISVOID=Yes` | Must filter everywhere |
| **Post-dated vouchers** | Medium | Future-dated cheques | Can distort current-period reports |
| **Spelling variations across vouchers** | Very high | Same item spelled differently in different vouchers | Item matching fails |
| **Unit mismatch** | High | Item created as "Strip" but transaction says "pcs" | Quantity comparison fails |
| **Rate includes tax** | Medium | Inclusive GST rates on some items | Amount computation mismatch |
| **Round-off differences** | Very high | ₹0.01-₹1.00 differences in Dr/Cr | Import fails on "totals don't match" |

### 2.2 The "Both Sundry" Problem

Tally docs explicitly confirm: a party CAN be placed under Sundry Debtors even if you sometimes purchase from them. And vice versa. The same party can have both debit AND credit balances. Tally does NOT restrict this.

But some CAs create BOTH "A & Co - S/Dr" AND "A & Co - S/Cr" for the same party. This is a documented workaround when they want separate tracking.

**Connector implication**: When identifying customers vs suppliers, you CANNOT rely solely on group membership. A Sundry Debtor with a credit balance is a supplier (or has overpaid). A Sundry Creditor with a debit balance is a customer (or has been overpaid). Check the `ClosingBalance` sign.

### 2.3 The Alias System

Tally supports multiple aliases for masters. A stock item named "Paracetamol 500mg Tab" might have aliases "Dolo 650", "Crocin 500", "PCM 500". These aliases are searchable within Tally.

**In XML export**:
```xml
<STOCKITEM NAME="Paracetamol 500mg Tab">
  <LANGUAGENAME.LIST>
    <NAME.LIST TYPE="String">
      <NAME>Paracetamol 500mg Tab</NAME>
      <NAME>Dolo 650</NAME>           <!-- Alias 1 -->
      <NAME>Crocin 500</NAME>         <!-- Alias 2 -->
      <NAME>PCM 500</NAME>            <!-- Alias 3 -->
    </NAME.LIST>
  </LANGUAGENAME.LIST>
</STOCKITEM>
```

**The connector MUST extract and index aliases**. The sales app should search across both primary name and aliases.

### 2.4 The "Stock Item Not Applicable" Pattern

Some businesses use Tally for "Accounting Invoice" (no inventory tracking on individual items). They create invoices with total amounts but no stock items. The `PERSISTEDVIEW` will be `"Invoice Voucher View"` but `INVENTORYENTRIES.LIST` will be absent or empty. The entire sale is one line under accounting entries.

**Connector must handle**: Vouchers with no inventory entries at all, even if they're Purchase or Sales type.

---

## 3. XML PARSING — THE COMPLETE SURVIVAL GUIDE

### 3.1 Response Size Estimation and Memory Management

```
TYPICAL RESPONSE SIZES:
  List of Companies:           1-5 KB
  All Ledgers (500 parties):   200-500 KB
  All Stock Items (5000 items): 2-10 MB
  All Vouchers (1 month, busy): 5-50 MB
  All Vouchers (1 year, busy):  100-500 MB  ← DO NOT do this in one request
  Full object export (single voucher): 2-20 KB
  Stock Summary report:         50-500 KB
```

**CRITICAL**: Use streaming XML parser (SAX/StAX), not DOM parser, for collection exports. A DOM parser loading 500MB of voucher XML into memory will crash the connector.

In Go, use `encoding/xml` with `xml.Decoder` for streaming:
```go
decoder := xml.NewDecoder(resp.Body)
for {
    token, err := decoder.Token()
    if err == io.EOF { break }
    // Process token by token, emit objects as they complete
}
```

### 3.2 The Complete Quantity String Parser

```
INPUT VARIATIONS:
  "100 Strip"                    → {100, "Strip", nil}
  "-50 pcs"                      → {-50, "pcs", nil}
  " 100 Strip"                   → {100, "Strip", nil}  (leading space)
  "100.50 Kg"                    → {100.50, "Kg", nil}
  "2 Box of 10 Strip = 20 Strip" → {20, "Strip", "2 Box of 10 Strip"}
  "100 Strip (= 10 Box)"        → {100, "Strip", "10 Box"}
  "0"                            → {0, "", nil}
  ""                             → {0, "", nil}
  " "                            → {0, "", nil}
  "Not Applicable"               → {0, "NA", nil}

PARSING ALGORITHM:
  1. Trim whitespace
  2. If empty or "Not Applicable", return zero
  3. If contains "=", split on "=" and use the LAST part (base unit quantity)
  4. If contains "(=", strip the parenthetical
  5. Extract leading number: /^(-?\d+\.?\d*)/
  6. Extract unit: everything after the number, trimmed
  7. Return {quantity, unit}
```

### 3.3 The Complete Amount String Parser

```
INPUT VARIATIONS:
  "1200000.00"                   → 1200000.00
  "-1200000.00"                  → -1200000.00
  "1200000.00 Dr"                → -1200000.00  (debit = negative)
  "1200000.00 Cr"                → 1200000.00   (credit = positive)
  "₹ 1200000.00"                → 1200000.00
  "Rs.1200000.00"               → 1200000.00
  "Rs. 12,00,000.00"            → 1200000.00   (Indian lakhs format!)
  "12,00,000.00"                → 1200000.00
  ""                             → 0
  "0"                            → 0

INDIAN NUMBER FORMAT:
  12,345.67      ← Western (rare in Tally XML, but appears in reports)
  12,34,567.89   ← Indian format (last group is 3, then groups of 2)
  1234567.89     ← No commas (most common in XML)

PARSING ALGORITHM:
  1. Strip currency symbols: ₹, Rs., Rs, INR
  2. Strip commas (ALL of them — handles both Western and Indian)
  3. Strip spaces
  4. Check for Dr/Cr suffix:
     - " Dr" or " Dr." → multiply by -1
     - " Cr" or " Cr." → keep as-is
  5. Parse remaining as float64
```

### 3.4 The Complete Rate String Parser

```
INPUT VARIATIONS:
  "50.00/Strip"                  → {50.00, "Strip"}
  "500.00/Box of 10 Strip"      → {500.00, "Box of 10 Strip"}
  "12.50/pcs"                    → {12.50, "pcs"}
  "1250.00/Bottle"               → {1250.00, "Bottle"}
  "50.00"                        → {50.00, ""}  (no unit = base unit)
  ""                             → {0, ""}

PARSING ALGORITHM:
  1. Split on first "/" character
  2. Left side = numeric rate (parse as float64)
  3. Right side = unit string (trim whitespace)
  4. If no "/", entire string is the rate, unit is empty (= base unit)
```

### 3.5 The Complete Date Parser

```
INPUT VARIATIONS:
  "20260325"                     → 2026-03-25  (YYYYMMDD — import/export)
  "25-Mar-2026"                  → 2026-03-25  (DD-Mon-YYYY — some reports)
  "25-03-2026"                   → 2026-03-25  (DD-MM-YYYY — display format)
  "2026/03/25"                   → 2026-03-25  (rare)
  "25/03/2026"                   → 2026-03-25  (DD/MM/YYYY — Indian style)
  ""                             → nil
  "N/A"                          → nil

PARSING ALGORITHM:
  1. If 8 digits exactly (YYYYMMDD): direct parse
  2. If contains "-" with 3-letter month: parse DD-Mon-YYYY
  3. If contains "/" with 4-digit year at start: YYYY/MM/DD
  4. If contains "/" with 4-digit year at end: DD/MM/YYYY
  5. If contains "-" with all digits: try DD-MM-YYYY, then YYYY-MM-DD
  6. Else: return nil, log warning
```

### 3.6 Boolean Values

```
TALLY BOOLEANS (ALWAYS STRING, NEVER true/false):
  "Yes" → true
  "No"  → false
  ""    → false (absent = false)
  absent tag → false

SPECIAL CASE:
  Some flags use "1" / "0" instead of Yes/No (especially in CMPINFO section)
```

### 3.7 The GUID Format

```
TALLY GUID FORMATS:
  "a0b1c2d3-e4f5-6789-0abc-def012345678"   ← Standard UUID format
  "a0b1c2d3e4f567890abcdef012345678"        ← No dashes (some versions)
  "i012345678abcdef"                          ← Short format (master objects)
  "012345678abcdef0-00000042:00000001"       ← Compound format (vouchers)

PARSING: Treat as opaque string. Don't validate format. Just store and compare.
```

---

## 4. OPERATIONAL SURVIVAL PATTERNS

### 4.1 The "Tally Is Down" Handling Chain

```
SCENARIO: Connector polls Tally at http://localhost:9000 and gets no response.

CAUSE TREE:
├── Tally not running (operator closed it, or machine rebooted)
├── Tally running but no company loaded (operator is at company selection screen)
├── Tally running but company is being repaired
├── Tally running but HTTP server disabled (F1 > Settings > Advanced > HTTP disabled)
├── Tally running on different port (changed in config or port conflict)
├── Tally frozen (processing large export, or data corruption)
├── Windows firewall blocking localhost (rare but possible)
└── Tally running but locked by backup software (.tsf files locked)

HANDLING:
1. No TCP connection → Retry every 30s with exponential backoff up to 5min
2. TCP connects but no HTTP response → Tally frozen. Log alert. Wait 5min.
3. HTTP 200 but empty/error response → Tally running, no company loaded.
   Send a "List of Companies" request. If response lists companies, wait and retry.
   If "No company loaded", log warning and wait.
4. After 30min of continuous failure → Send alert to central system
5. NEVER crash the connector. Always retry. Always log.
```

### 4.2 The "Dirty Data" Reconciliation Pattern

```
WEEKLY RECONCILIATION JOB:

1. Pull ALL master GUIDs from Tally:
   - Request Collection of StockItem: GUID, Name, AlterId
   - Request Collection of Ledger: GUID, Name, AlterId
   - Request Collection of Godown: GUID, Name, AlterId

2. Compare with SQLite cache:
   - GUIDs in Tally but not in cache → NEW masters (missed by incremental)
   - GUIDs in cache but not in Tally → DELETED masters (or company was repaired)
   - Name mismatches for same GUID → RENAMED masters

3. Pull Stock Summary report from Tally:
   - Compare Tally-reported closing stock with connector's computed stock
   - If mismatch > threshold → Log warning, override with Tally's numbers
   
4. Pull Outstanding Sales Orders:
   - Compare with write_orders table
   - Orders in Tally but not in central → Created in Tally UI directly (not via connector)
   - Orders in central but not in Tally → Deleted in Tally (must update central status)

5. Check AlterID consistency:
   - Pull current max AlterID from Tally
   - If LESS than stored watermark → Data was restored/repaired. FULL RE-SYNC.
```

### 4.3 The "Feature Flag Detection" Pattern

Before ANY push operation, the connector must know which Tally features are enabled. Features affect XML structure requirements:

```xml
<!-- Query company features via XML -->
<ENVELOPE>
  <HEADER><VERSION>1</VERSION>
  <TALLYREQUEST>Export</TALLYREQUEST>
  <TYPE>Object</TYPE>
  <SUBTYPE>Company</SUBTYPE>
  <ID>##COMPANY_NAME##</ID></HEADER>
  <BODY><DESC><STATICVARIABLES>
    <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
  </STATICVARIABLES></DESC></BODY>
</ENVELOPE>
```

**Critical feature flags to detect** (appear in company XML):
```xml
<ISINVENTORYON>Yes</ISINVENTORYON>
<ISMULTISTORAGEOPTION>Yes</ISMULTISTORAGEOPTION>        ← Multi-godown
<ISBATCHENABLED>Yes</ISBATCHENABLED>                     ← Batches
<ISUSETRACKING>Yes</ISUSETRACKING>                       ← Tracking numbers
<ISUSEBOM>Yes</ISUSEBOM>                                 ← Bill of Materials
<ISBILLWISEON>Yes</ISBILLWISEON>                          ← Bill-by-bill
<ISUSEEXPDATEFORSTOCK>Yes</ISUSEEXPDATEFORSTOCK>          ← Expiry dates
<ISUSEMFGDATEFORSTOCK>Yes</ISUSEMFGDATEFORSTOCK>          ← Mfg dates
<ISMAINTAINBALANCEBILLWISE>Yes</ISMAINTAINBALANCEBILLWISE>
<ISCOSTCENTRESAVAILABLE>Yes</ISCOSTCENTRESAVAILABLE>
<ISUSEORDERPROCESSING>Yes</ISUSEORDERPROCESSING>          ← Orders enabled
<ISUSECOSTTRACK>Yes</ISUSECOSTTRACK>                      ← Cost tracking
<ISUSEJOBCOSTING>Yes</ISUSEJOBCOSTING>                    ← Job work
```

**Feature → Push XML requirement matrix**:
```
Multi-godown ON → MUST include GODOWNNAME in batch allocations
Batches ON → MUST include BATCHALLOCATIONS.LIST
Expiry dates ON → MUST include EXPIRYPERIOD or EXPIRYDATE in batch
Tracking ON → MUST include tracking number in Delivery Note / Receipt Note
Orders ON → Sales Order / Purchase Order voucher types are active
Bill-wise ON → Bills are tracked; bill allocations needed in Payment/Receipt
```

### 4.4 The "Auto-Master Creation" Pattern for Push

When pushing a Sales Order, if masters don't exist, create them IN ORDER:

```
CREATION ORDER (dependencies flow downward):

1. Stock Group (if new category needed)
     ↓
2. Unit of Measure (if item uses a unit not yet in Tally)
     ↓
3. Stock Item (depends on group + unit)
     ↓
4. Account Group (e.g., new territory sub-group under Sundry Debtors)
     ↓
5. Ledger (party — depends on group)
     ↓
6. Godown (if new location needed)
     ↓
7. Voucher Type (if custom Sales Order type needed)
     ↓
8. Voucher (Sales Order — depends on all above)

EACH step is a SEPARATE XML import request.
WAIT for success response before proceeding to next step.
ANY failure → abort and report error. Do NOT try to create the voucher.
```

### 4.5 The "Round-Off" Problem

Dr/Cr MUST balance to the paisa (₹0.01). In practice, GST calculations on multiple line items create rounding differences. The standard workaround:

```xml
<!-- Add a round-off ledger entry to absorb the difference -->
<ALLLEDGERENTRIES.LIST>
  <LEDGERNAME>Rounded Off</LEDGERNAME>
  <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
  <AMOUNT>0.50</AMOUNT>              <!-- or -0.50 depending on direction -->
</ALLLEDGERENTRIES.LIST>
```

The ledger "Rounded Off" (or "Round Off", "Rounding Off", "Rounding Difference" — name varies) should exist in Tally under Indirect Expenses or Indirect Income. Your connector should:
1. Compute the exact Dr/Cr difference after all line items and taxes
2. If difference is within ±₹1.00, add a round-off entry
3. If difference is >₹1.00, something is fundamentally wrong — reject the order

### 4.6 The "Same Party, Buyer and Seller" Pattern

In pharma distribution, a party can be BOTH customer and supplier (e.g., stockist buys from another stockist AND sells to them). Tally recommends putting them under ONE group (usually Sundry Debtors) and letting the balance swing. But CAs sometimes create TWO ledgers:

```
"ABC Pharma - S/Dr" (under Sundry Debtors)  → for our sales TO them
"ABC Pharma - S/Cr" (under Sundry Creditors) → for our purchases FROM them
```

**Connector must**: Map both to the same party entity in the central system. Use GSTIN as the linking key. If no GSTIN, use the fuzzy name matcher (Section 1.1).

### 4.7 The "Salesman as Cost Centre" Pattern

Many distributors track salesman performance by creating each salesman as a Cost Centre:

```
Cost Centre hierarchy:
├── Sales Department
│   ├── Amit Kumar         ← Salesman 1
│   ├── Rahul Sharma       ← Salesman 2
│   └── Vijay Patel        ← Salesman 3
```

Every sales voucher is allocated to a cost centre (salesman). This appears in XML as:
```xml
<COSTCENTREALLOCATIONS.LIST>
  <NAME>Amit Kumar</NAME>
  <AMOUNT>-11800.00</AMOUNT>
</COSTCENTREALLOCATIONS.LIST>
```

Some distributors use a UDF on the voucher instead:
```xml
<SALESMANNAME.LIST TYPE="String" Index="30">
  <SALESMANNAME>Amit Kumar</SALESMANNAME>
</SALESMANNAME.LIST>
```

**Connector must check BOTH patterns**: Cost Centre allocation AND UDF-based salesman tracking. The sales fleet app must map field salesman identity to whichever method the stockist uses.

### 4.8 The "Scheme/Free Goods" Problem

Pharma companies offer schemes like "Buy 10 Get 2 Free" or "10+2" or "Flat 15% discount". Distributors handle this in Tally multiple ways:

**Method 1**: Different Actual vs Billed quantity
```xml
<ACTUALQTY>12 Strip</ACTUALQTY>    <!-- Actually delivered 12 -->
<BILLEDQTY>10 Strip</BILLEDQTY>     <!-- Billed for 10 only -->
```

**Method 2**: Separate line item for free goods
```xml
<!-- Paid item -->
<ALLINVENTORYENTRIES.LIST>
  <STOCKITEMNAME>Dolo 650</STOCKITEMNAME>
  <ACTUALQTY>10 Strip</ACTUALQTY>
  <RATE>50.00/Strip</RATE>
  <AMOUNT>500.00</AMOUNT>
</ALLINVENTORYENTRIES.LIST>
<!-- Free item (zero rate) -->
<ALLINVENTORYENTRIES.LIST>
  <STOCKITEMNAME>Dolo 650</STOCKITEMNAME>
  <ACTUALQTY>2 Strip</ACTUALQTY>
  <RATE>0/Strip</RATE>
  <AMOUNT>0</AMOUNT>
</ALLINVENTORYENTRIES.LIST>
```

**Method 3**: Free goods in a separate godown
```xml
<BATCHALLOCATIONS.LIST>
  <GODOWNNAME>Free Goods</GODOWNNAME>
  <AMOUNT>0</AMOUNT>
  <ACTUALQTY>2 Strip</ACTUALQTY>
</BATCHALLOCATIONS.LIST>
```

**Connector must handle**: All three patterns. The zero-amount line item is the trickiest because Tally may reject it if "Enable zero-valued transactions" is not set.

---

## 5. CA OPERATIONS CALENDAR — WHEN TO EXPECT DISRUPTIONS

| Month | CA Activity | Connector Impact |
|---|---|---|
| **March (last week)** | Year-end closing entries, stock verification | Heavy voucher alteration. AlterIDs spike. |
| **April (first week)** | New FY setup, voucher numbering reset | Company may be split. New company created. Re-profile. |
| **July** | GSTR-1/3B filing for Q1 | GST corrections, voucher amendments |
| **September** | Half-yearly GST audit (for some) | Voucher corrections, ledger renames |
| **October** | GSTR-9 annual return preparation | Massive reconciliation, corrections |
| **December/January** | Tax audit (for large entities) | Back-dated entries, data verification |
| **Any time** | CA "repairs" data after detecting issues | AlterIDs reset. FULL RE-SYNC risk. |
| **Random** | Tally upgrade (new release) | Company data migration. Folder structure changes. |

**Best practice**: Schedule initial deployments and major sync operations in May-June or November — the quietest periods for CA activity.

---

## 6. ENCODING & CHARACTER SET ISSUES

### 6.1 The Hindi/Gujarati Text Problem

Tally supports multi-language stock items and ledgers. Gujarat-based stockists may have:

```
"पेरासिटामोल 500mg टैबलेट"        ← Hindi
"પેરાસિટામોલ 500mg ટેબલેટ"       ← Gujarati
"Paracetamol 500mg Tab"            ← English
```

Or MIXED: `"Paracetamol 500mg गोली"` (English name + Hindi form)

**Connector MUST**:
- Use UTF-8 for all HTTP requests (Content-Type: text/xml; charset=UTF-8)
- Store all strings as TEXT/NVARCHAR in SQLite/PostgreSQL
- Never truncate or re-encode — pass through as-is
- For search/matching, use Unicode-aware collation

### 6.2 The Windows-1252 Encoding Problem

Some older Tally.ERP 9 installations export in Windows-1252 (ANSI) encoding, not UTF-8. The XML header says `encoding="ASCII"` but the content has Windows-1252 characters (₹, smart quotes, etc.).

**Detection**: Check the Content-Type header and XML declaration. If encoding is "ASCII" or absent, try decoding as Windows-1252 first, then fall back to UTF-8. Look for the byte sequence `0xE2 0x82 0xB9` (UTF-8 ₹) vs `0x80` (Windows-1252 €) as a signal.

### 6.3 The "Tally Capitalizes First Letter" Pattern

Tally auto-capitalizes the first letter of every master name on creation. If a user types "raj medical store", Tally stores it as "Raj medical store" (only first letter capitalised). But if the user types "RAJ MEDICAL STORE", Tally keeps it as-is. This means name casing is INCONSISTENT.

**For all name comparisons**: Always use case-insensitive matching.

---

## 7. CONNECTION HEALTH MONITORING

### 7.1 Heartbeat Request (Lightweight)

Send this every 60 seconds to confirm Tally is alive without pulling data:

```xml
<ENVELOPE>
  <HEADER><VERSION>1</VERSION>
  <TALLYREQUEST>Export</TALLYREQUEST>
  <TYPE>Function</TYPE>
  <ID>$$CmpLoaded</ID></HEADER>
  <BODY><DESC><STATICVARIABLES>
    <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
  </STATICVARIABLES></DESC></BODY>
</ENVELOPE>
```

This returns the loaded company name (or empty if no company loaded). Tiny payload, fast response.

### 7.2 Change Detection Request (Medium weight)

Send this every 1-5 minutes to check if anything changed:

```xml
<ENVELOPE>
  <HEADER><VERSION>1</VERSION>
  <TALLYREQUEST>Export</TALLYREQUEST>
  <TYPE>Function</TYPE>
  <ID>$$MaxMasterAlterID</ID></HEADER>
  <BODY><DESC><STATICVARIABLES>
    <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
  </STATICVARIABLES></DESC></BODY>
</ENVELOPE>
```

Compare returned AlterID with stored watermark. If different → something changed → trigger incremental sync. If same → nothing to do.

**COST**: This is a single-value function evaluation. Takes milliseconds. Does not load Tally.

---

## 8. BEST PRACTICES SUMMARY — THE "DON'T GET BURNED" LIST

1. **Never match by name. Match by GUID.** Names change. GUIDs are forever.
2. **Never assume XML tag structure.** Parse both ALLLEDGERENTRIES and LEDGERENTRIES variants.
3. **Never assume encoding.** Detect and handle UTF-8, UTF-16, Windows-1252.
4. **Never push without pre-validating all masters exist.** Create masters first.
5. **Never push a voucher without computing Dr=Cr balance.** Add round-off if needed.
6. **Never pull all vouchers in one request.** Batch by day or by count (max 5000).
7. **Never trust your computed stock position over Tally's Stock Summary report.**
8. **Never assume features are enabled.** Profile the company first.
9. **Never assume UDF tag names are stable.** Store by Index, not by name.
10. **Never assume clean data.** Duplicates, wrong groups, missing GSTIN are the norm.
11. **Never assume voucher numbers are unique.** They're not, unless "Prevent Duplicates" is on.
12. **Never assume automatic numbering.** The connector should either use manual numbering with unique prefix or omit the number and let Tally auto-assign.
13. **Never assume single company.** Discovery phase finds all loaded companies.
14. **Never assume Tally is always running.** Graceful degradation to local SQLite cache.
15. **Never block Tally Silver users.** Keep HTTP requests fast and infrequent during business hours.
16. **Never skip the ampersand.** Escape ALL special chars in push XML.
17. **Never ignore the Tally.imp log file.** It's your secondary confirmation for imports.
18. **Never assume batch names are just identifiers.** They may contain MRP.
19. **Never assume quantity strings are just numbers.** They contain units, compound expressions, and "= base unit" conversions.
20. **Always use streaming XML parser for large responses.** DOM parsing will OOM.
