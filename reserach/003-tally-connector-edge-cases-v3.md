# TALLY CONNECTOR — Edge Cases, Gotchas & Operational Invariants

## VERSION: 0.3-ADDENDUM | DATE: 2026-03-26

This document supplements v2 of the spec with deep edge-case analysis derived from how Indian SMBs actually use Tally across pharma, trading, manufacturing, and how CAs set up and manage these installations.

---

## 1. HOW INDIAN SMBs ACTUALLY USE TALLY — VERTICAL PATTERNS

### 1.1 Pharma Distributor / Stockist (Primary Target)

**Setup pattern**: TallyPrime Gold (multi-user). Operated by 2-5 people — owner, 1-2 billing clerks, 1 accountant. CA visits monthly or quarterly.

**Typical features enabled**:
- Inventory ON (accounts integrated with inventory)
- Multiple Godowns (Main warehouse, counter stock, damaged goods)
- Batch-wise details ON (mandatory for pharma — Drug License requires batch tracking)
- Expiry dates ON (pharma non-negotiable)
- Order processing ON (Purchase Orders to companies, Sales Orders from retailers)
- Bill-wise details ON (Sundry Debtors/Creditors tracked bill-by-bill for ageing)
- Multiple voucher numbering series (separate series per financial registration)
- GST with e-invoicing (if turnover > ₹5 Cr)

**Common TDL customizations found**:
- Medical billing TDL (Patient Name, Doctor Name, Drug License No. fields on invoices)
- "Pack Of" / "Company/Brand" UDFs on Stock Item (e.g., "Strip of 10", "Cipla")
- Salesman tracking on vouchers
- Territory/Route UDF on Ledger (party) master
- Batch-wise MRP tracking (MRP printed on strip/bottle, may differ per batch)
- Schedule H/H1/X drug classification UDF on Stock Item
- Near-expiry alert TDL (custom report showing items expiring within N days)
- Discount structure TDL (trade discount, cash discount, scheme-based discount)

**Gotcha**: Pharma distributors often maintain TWO companies in one Tally — one for "Ethical" (prescription drugs) and one for "OTC/FMCG" (over-the-counter). Sometimes split by Drug License Number. Your connector must handle multi-company within a single Tally instance.

### 1.2 Trading / Wholesale Distribution

**Setup pattern**: TallyPrime Silver or Gold. Common in textiles, electronics, FMCG, auto parts.

**Typical features enabled**:
- Inventory ON
- Multiple Godowns (showroom, warehouse, godown, transit)
- Price Lists / Price Levels (Wholesale, Retail, Super Stockist, Dealer)
- Cost Centres (branch-wise or salesman-wise profitability)
- Bill-wise details ON
- Multiple currencies (only for import/export traders)

**Common TDL customizations**:
- Barcode printing/scanning TDL
- IMEI/Serial Number tracking TDL (for electronics)
- Scheme management (Buy 10 Get 1 Free type structures as TDL)
- Auto-discount calculation based on party group
- Vehicle number / Transport details on Delivery Note
- Salesman commission calculation TDL

**Gotcha**: Traders frequently use "Accounting Voucher" mode (not "Invoice" mode) for sales. In accounting mode, inventory and accounting entries are SEPARATE. The `PERSISTEDVIEW` tag in XML will be `"Accounting Voucher View"` instead of `"Invoice Voucher View"`. This changes the XML structure significantly — inventory entries are in `INVENTORYENTRIES.LIST` not `ALLINVENTORYENTRIES.LIST`. The connector MUST handle both views.

### 1.3 Manufacturing

**Setup pattern**: TallyPrime Gold with Bill of Materials (BOM) enabled.

**Typical features enabled**:
- All inventory features
- BOM (Bill of Materials) — defines raw material → finished goods conversion
- Manufacturing Journal / Stock Journal for production recording
- Job Work In/Out
- Cost Centres for department/project tracking
- Cost Categories

**Common TDL customizations**:
- Production planning TDL
- Quality control parameters as UDFs on Stock Item
- Wastage percentage tracking
- Scrap/Byproduct recording in Stock Journal
- Multi-level BOM support (TDL extension)

**Gotcha**: Manufacturing Journal vouchers create complex inventory movements where multiple raw materials go OUT and one finished product comes IN. The `trn_inventory` table will have BOTH positive (inward/finished) and negative (outward/raw material) rows for the SAME voucher GUID. Parse carefully.

### 1.4 Services + Accounting Only (CA-managed small businesses)

**Setup pattern**: TallyPrime Silver. Managed entirely by CA's staff.

**Typical features**: Accounting only (no inventory). GST compliance. TDS. Payroll sometimes.

**Gotcha**: When inventory is NOT enabled (F11: Inventory Features all set to No), stock items don't exist, and all vouchers are pure accounting entries. The connector's inventory extraction will return EMPTY for these companies. Must handle gracefully — don't fail, just skip inventory tables.

---

## 2. CA PRACTICES — HOW CHARTERED ACCOUNTANTS SET UP & MANAGE TALLY

### 2.1 Ledger Group Hierarchy Patterns

CAs follow a standard Chart of Accounts structure. Understanding this is critical for party identification:

```
Primary Groups (Tally built-in, NEVER change):
├── Capital Account
├── Current Assets
│   ├── Bank Accounts
│   ├── Cash-in-Hand
│   ├── Deposits (Asset)
│   ├── Loans & Advances (Asset)
│   ├── Stock-in-Hand         ← AUTO-MANAGED by inventory
│   └── Sundry Debtors        ← YOUR CUSTOMERS (medical shops)
├── Current Liabilities
│   ├── Duties & Taxes
│   │   ├── Output CGST
│   │   ├── Output SGST
│   │   ├── Output IGST
│   │   ├── Input CGST
│   │   ├── Input SGST
│   │   └── Input IGST
│   ├── Provisions
│   └── Sundry Creditors       ← YOUR SUPPLIERS (pharma companies)
├── Direct Expenses
│   └── Purchase Accounts      ← Purchase accounting
├── Direct Incomes
│   └── Sales Accounts         ← Sales accounting
├── Fixed Assets
├── Indirect Expenses
├── Indirect Incomes
├── Investments
├── Loans (Liability)
├── Misc. Expenses (Asset)
├── Reserves & Surplus
├── Secured Loans
├── Suspense A/c
└── Unsecured Loans
```

**CRITICAL INVARIANT**: To identify customers (medical shops), filter ledgers where `PrimaryGroup = "Sundry Debtors"`. To identify suppliers (pharma companies), filter `PrimaryGroup = "Sundry Creditors"`. CAs almost universally follow this. Sub-groups under Sundry Debtors are usually territory-based: "Ahmedabad Parties", "Surat Parties", "Baroda Parties".

### 2.2 Common CA Practices That Affect Integration

| Practice | What happens | Connector impact |
|---|---|---|
| **Opening balance corrections mid-year** | CA adjusts opening balances via Journal Voucher after audit | Stock positions shift. Your cached opening balance may be wrong. Always re-sync Stock Summary report. |
| **Voucher date alteration** | CA backdates entries for corrections (e.g., missing invoice from 3 months ago) | Your AlterID watermark catches the change, but the voucher DATE is in the past. Must re-process date ranges. |
| **Ledger renaming** | CA renames "ABC Medical" to "ABC Medical Store, Ahmedabad" for clarity | Name change = same GUID but different name. Your connector must match by GUID, not name. |
| **Ledger merging** | CA merges two duplicate ledgers into one | One ledger's vouchers move to another. Both AlterIDs and GUIDs change. Full re-sync recommended. |
| **Group restructuring** | CA moves a ledger from one group to another | The `Parent` and `PrimaryGroup` change for the ledger. Group-based filtering must be re-evaluated. |
| **Year-end provisioning** | CA passes adjustment JVs (Depreciation, Provisions, Prepaid expenses) | These are accounting-only entries. `is_inventory_voucher=0`. No inventory impact. |
| **Voucher deletion** | CA deletes incorrect voucher instead of cancelling | The voucher GUID disappears from Tally. Your connector's full reconciliation must detect the missing GUID and mark as deleted in cache. |
| **Data repair** | CA runs Gateway > Data > Repair to fix corruption | This can change AlterIDs and internal structure. Full re-sync recommended after repair. |
| **Split company** | CA splits FY data | Company GUID changes. New companies created. Must re-discover and re-profile. |

### 2.3 GST-Specific Setup Patterns

CAs set up GST in specific ways:

- **Tax ledgers**: Separate ledgers for CGST, SGST, IGST, Cess — at each rate (5%, 12%, 18%, 28%). Names vary: "Output CGST 9%", "CGST on Sales @9%", "GST-CGST-9%". NEVER assume ledger names.
- **Place of Supply**: Set on each voucher. Interstate = IGST. Intrastate = CGST+SGST. The connector must track this for correct tax computation.
- **HSN/SAC codes**: Set on Stock Item master or Stock Group. If set on group, items inherit it. The connector should check both levels.
- **GST Registration Type on Party**: Regular, Composition, Unregistered, Consumer. Affects tax treatment.
- **Multiple GSTINs**: A stockist with branches in multiple states has separate GSTINs. May be separate companies in Tally or separate registrations within one company.
- **e-Invoicing**: If enabled, vouchers have IRN (Invoice Reference Number) and QR code data. This appears in XML as additional tags.

---

## 3. TDL/TCP DETECTION & PARSING — FILESYSTEM APPROACH

### 3.1 Where TDL/TCP Files Live

```
TALLY INSTALLATION DIRECTORY (typical paths):
├── C:\TallyPrime\                        ← Most common
├── C:\Program Files\TallyPrime\          ← Older installs
├── C:\Tally.ERP9\                        ← ERP 9
│
│   ├── *.tcp                             ← Compiled TDL files (LOCAL)
│   ├── *.tdl                             ← Source TDL files (LOCAL)
│   ├── tally.exe / tallyprime.exe
│   ├── tally.ini                         ← CRITICAL: Configuration file
│   │   Contains: Data Path, TDL paths, Port config
│   │
│   ├── config/                           ← TallyPrime 7.0+ config
│   │   └── excelmaps/                    ← Import mapping templates
│   │
│   └── Tally.imp                         ← Import log file (plain text)

TALLY DATA DIRECTORY (from tally.ini → "Data Path"):
├── C:\Users\Public\Tally.ERP9\Data\     ← Tally ERP 9 default
├── C:\Users\Public\TallyPrime\Data\     ← TallyPrime default
│
│   ├── 10000\                            ← First company (5-digit folder)
│   │   ├── Company.900                   ← Company data
│   │   ├── cmpsave.900                   ← Company backup
│   │   ├── manager.900                   ← Master data
│   │   ├── tranmgr.900                   ← Transaction manager
│   │   ├── linkmgr.900                   ← Link manager
│   │   ├── sumtran.900                   ← Summary transactions
│   │   ├── *.tsf                         ← Temp files (ignore)
│   │   └── tmessage.tsf                  ← Sync messages
│   │
│   ├── 10001\                            ← Second company
│   ├── 100000\                           ← 6-digit (TallyPrime 3.0+)
│   └── ...

ACCOUNT TDL DIRECTORY (deployed via Tally.NET Control Centre):
├── C:\TallyPrime\                        ← Same as install dir
│   └── tdl/                              ← Account TDLs downloaded here
│       └── *.tcp
│
├── %LOCALAPPDATA%\TallyPrime\           ← Some versions
│   └── tdl/

REMOTE TDL: Not on disk — served from Tally.NET server at runtime
```

### 3.2 How to Discover Loaded TDLs

**Method 1: Parse tally.ini** (most reliable for local TDLs)

```ini
; Typical tally.ini structure
[Tally]
TDL = Yes
Default TDL = tally.tdl
User TDL = Yes
User TDL0 = C:\TallyPrime\MedicalBilling.tcp
User TDL1 = C:\TallyPrime\SalesmanTracking.tcp
Data Path = C:\Users\Public\TallyPrime\Data
```

Your Go connector can parse this file to enumerate all configured local TDLs.

**Method 2: Scan TallyPrime installation directory for *.tcp and *.tdl files**

```go
// Pseudocode for Go connector
filepath.Walk(tallyInstallDir, func(path string, info os.FileInfo, err error) error {
    ext := strings.ToLower(filepath.Ext(path))
    if ext == ".tcp" || ext == ".tdl" {
        tdlFiles = append(tdlFiles, path)
    }
    return nil
})
```

**Method 3: XML API query for TDL Management Report**

```xml
<ENVELOPE>
  <HEADER><VERSION>1</VERSION>
  <TALLYREQUEST>Export</TALLYREQUEST>
  <TYPE>Data</TYPE>
  <ID>TDL Management</ID></HEADER>
  <BODY><DESC><STATICVARIABLES>
    <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
  </STATICVARIABLES></DESC></BODY>
</ENVELOPE>
```

**Method 4: CTRL+ALT+T equivalent via API** — Query the loaded TDL list programmatically using the built-in collection.

### 3.3 TCP File Analysis

TCP files are COMPILED TDL (think .pyc vs .py). They are NOT human-readable. However:

- The filename usually reveals purpose: `MedicalBilling.tcp`, `SalesmanTracker.tcp`, `BatchMRP.tcp`, `IMEI_Tracking.tcp`
- The file metadata (size, creation date) helps identify active vs stale TDLs
- You CANNOT extract UDF definitions from a TCP file directly

**To discover UDFs created by a TCP**, you must:
1. Load the TCP in Tally (it's already loaded if configured)
2. Export a sample object (Stock Item, Voucher) to XML
3. Parse the XML for non-standard tags / UDF.LIST tags
4. Map UDF names and indices

### 3.4 UDF Detection Algorithm

```
STEP 1: Export ALL stock items with FULL OBJECT (no field filtering)

  <ENVELOPE><HEADER>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Object</TYPE>
    <SUBTYPE>Stock Item</SUBTYPE>
    <ID>##ANY_ITEM_NAME##</ID>
  </HEADER>
  <BODY><DESC><STATICVARIABLES>
    <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
    <EXPLODEFLAG>Yes</EXPLODEFLAG>
  </STATICVARIABLES></DESC></BODY></ENVELOPE>

STEP 2: Parse the response for tags containing ".LIST" with "Index" attribute
  - Standard tags: GSTDETAILS.LIST, BATCHALLOCATIONS.LIST (no Index attr)
  - UDF tags: DRUGSCHEDULE.LIST Index="30", MANUFACTURER.LIST Index="31"

STEP 3: Build UDF registry
  {
    "stock_item": [
      {"name": "DrugSchedule", "index": 30, "type": "String"},
      {"name": "Manufacturer", "index": 31, "type": "String"},
      {"name": "StorageTemp", "index": 32, "type": "String"},
      {"name": "PackOf", "index": 33, "type": "Number"}
    ]
  }

STEP 4: Repeat for Voucher object and Ledger object

STEP 5: Store in _tally_profile.discovered_udfs
```

**CRITICAL EDGE CASE**: If the TDL is NOT loaded (CA uninstalled it, or it expired — many TDLs are license-locked to a Tally serial number), UDFs become:
```xml
<UDF_STRING_30.LIST Index="30">
  <UDF_STRING_30>H</UDF_STRING_30>
</UDF_STRING_30.LIST>
```
The DATA is still there, but the NAME is gone. Your parser must handle BOTH `<DRUGSCHEDULE.LIST Index="30">` and `<UDF_STRING_30.LIST Index="30">` as the same field.

---

## 4. COMPREHENSIVE XML GOTCHAS & EDGE CASES

### 4.1 The Ampersand Problem

Tally ledger names frequently contain `&` (e.g., "M/s Patel & Sons", "R & D Expenses"). In XML, `&` must be escaped as `&amp;`. When EXPORTING from Tally, Tally correctly escapes it. When IMPORTING to Tally, you MUST escape it in your XML, or the import fails silently or crashes Tally.

Real-world blog posts confirm this is the #1 cause of failed imports: "I found Errors with character in ledger name and narration '&' (and Symbol) make sure not use '&' directly".

**Other characters requiring XML escaping**:
- `<` → `&lt;`
- `>` → `&gt;`
- `"` → `&quot;`
- `'` → `&apos;`
- Non-ASCII characters (₹, accented text) → UTF-8 encoding with proper Content-Type header

### 4.2 Accounting Voucher View vs Invoice Voucher View

This is a MAJOR XML structural difference that trips up most integrators:

**Invoice View** (`PERSISTEDVIEW = "Invoice Voucher View"`):
```xml
<VOUCHER>
  <ALLLEDGERENTRIES.LIST>...</ALLLEDGERENTRIES.LIST>      ← Accounting
  <ALLINVENTORYENTRIES.LIST>                               ← Inventory
    <ACCOUNTINGALLOCATIONS.LIST>...</ACCOUNTINGALLOCATIONS.LIST>
    <BATCHALLOCATIONS.LIST>...</BATCHALLOCATIONS.LIST>
  </ALLINVENTORYENTRIES.LIST>
</VOUCHER>
```

**Voucher/Accounting View** (`PERSISTEDVIEW = "Accounting Voucher View"`):
```xml
<VOUCHER>
  <LEDGERENTRIES.LIST>...</LEDGERENTRIES.LIST>             ← Note: different tag name!
  <INVENTORYENTRIES.LIST>                                   ← Note: different tag name!
    <BATCHALLOCATIONS.LIST>...</BATCHALLOCATIONS.LIST>
  </INVENTORYENTRIES.LIST>
</VOUCHER>
```

The tag names change between views: `ALLLEDGERENTRIES.LIST` vs `LEDGERENTRIES.LIST`, `ALLINVENTORYENTRIES.LIST` vs `INVENTORYENTRIES.LIST`. Your parser MUST check for BOTH tag variants.

### 4.3 Negative Stock Situations

Tally ALLOWS negative stock by default (can be disabled in F11: Inventory Features). Many Indian SMBs operate with negative stock because billing clerk enters sales before recording purchase. This means:

- `ClosingBalance` can be negative (e.g., "-50 pcs")
- Stock Summary report will show negative quantities
- The connector must NOT reject negative stock values — they're valid business reality

### 4.4 Voucher Numbering Chaos

Indian SMBs use wildly inconsistent voucher numbering:

- **Automatic**: Tally auto-numbers 1, 2, 3, ... Resets per financial year.
- **Manual**: User types any number. Often duplicate. "1001", "INV/2024-25/1001".
- **Multi-user Auto**: Each user gets a series. Gaps appear.
- **Custom prefixes**: "AHM/SO/001", "SRT/SO/001" (city-based).
- **Multiple series per voucher type**: e.g., "Cash Sales" series and "Credit Sales" series under same Sales voucher type.

**Import gotcha**: Tally uses voucher number as the primary duplicate check during import. If your connector generates voucher numbers, use a UNIQUE prefix that can never collide: `FIELD/{UUID-fragment}` or `API/{timestamp}`.

**The duplicate voucher problem**: If you import a voucher with the same number as an existing one AND numbering is set to "Manual" with "Prevent Duplicates = No", Tally creates a DUPLICATE. Both vouchers exist with the same number. This causes accounting havoc. Always check before push.

### 4.5 The "Enable zero-valued transactions" Gotcha

If Tally has `Enable zero-valued transactions = No` (common default), and you push a voucher where any line has zero amount (e.g., a free sample), the import fails with "No entries in Voucher!" error. The connector must either set this flag or filter out zero-value lines.

### 4.6 The "Inventory values are affected" Flag

This setting on the LEDGER master determines whether a Purchase/Sales entry through that ledger affects stock. If a stockist has created a "Purchase Account" ledger with `Inventory values are affected = No`, then even a purchase voucher with stock items won't update stock. The connector must read this flag to understand data correctness.

### 4.7 Date Boundary Issues

- **Financial year boundary**: Voucher dates MUST fall within the company's date range. A Sales Order dated 01-Apr-2026 in a company where FY ends 31-Mar-2026 will fail if the company hasn't been extended or period changed.
- **Post-dated vouchers**: Tally supports post-dated cheques and vouchers. These appear as `ISPOSTDATED=Yes` and should be handled carefully in reports.
- **Back-dated entries**: After year-end, CAs frequently enter back-dated entries for adjustments. AlterID catches these, but the voucher date is old.

### 4.8 Compound Units Parsing

```xml
<BASEUNITS>Strip</BASEUNITS>
<ADDITIONALUNITS>Box</ADDITIONALUNITS>
<CONVERSION>10</CONVERSION>
<!-- Means: 1 Box = 10 Strips -->

<ACTUALQTY>2 Box of 10 Strip = 20 Strip</ACTUALQTY>
<!-- OR simply: -->
<ACTUALQTY>20 Strip</ACTUALQTY>
<!-- OR: -->
<ACTUALQTY>2 Box</ACTUALQTY>
```

Quantity strings can appear in any of these formats. Parse defensively. Extract the leading number and the first unit token.

### 4.9 Rate Strings

```xml
<RATE>50.00/Strip</RATE>
<RATE>500.00/Box of 10 Strip</RATE>
<RATE>12.50/pcs</RATE>
```

Rate always has a `/` separator between value and unit. Split on `/` to get numeric rate and unit.

### 4.10 The Tally.imp Log File

Every XML import to Tally logs results to `Tally.imp` in the TallyPrime installation directory. This is a PLAIN TEXT file (not XML). It contains:

```
Created: 1
Altered: 0
Combined: 0
Cancelled: 0
Deleted: 0
Ignored: 0
Errors: 0
Last Voucher ID: 12345
```

Your connector can parse this file as a secondary confirmation mechanism after a push, especially when the HTTP response is ambiguous.

---

## 5. OPERATIONAL INVARIANTS CHECKLIST

### 5.1 Must-Have Invariants (never skip)

- [ ] **GUID is king**: Always use Tally GUID as the primary identifier. Names change. GUIDs don't.
- [ ] **AlterID is globally monotonic per company**: It increments across ALL objects. A stock item change and a voucher change both bump the same counter.
- [ ] **Order vouchers are ghosts**: `is_order_voucher=1` means Purchase Order / Sales Order. They affect NOTHING in accounting or inventory. ALWAYS filter them from stock/financial calculations.
- [ ] **Stock Summary from Tally is the source of truth**: Never compute stock position from raw vouchers. Tally's report accounts for opening balances, valuation methods, and corrections you can't replicate.
- [ ] **Batch export size matters**: >5000 objects per HTTP request = Tally freeze risk. Always batch.
- [ ] **Tally must be running and company loaded**: No background extraction possible. Tally is a GUI app, not a service.
- [ ] **XML escaping is mandatory for push**: `&` in names, `<` in descriptions — all must be escaped.
- [ ] **Both voucher views must be parsed**: `ALLLEDGERENTRIES.LIST` AND `LEDGERENTRIES.LIST` are different representations of the same data.
- [ ] **Features must match for import**: If company has `Maintain Batches = Yes`, imported vouchers MUST include batch allocations or they fail.
- [ ] **Masters before transactions**: Always create/verify ledgers and stock items exist before pushing vouchers.

### 5.2 Should-Have Invariants (recommended)

- [ ] **Profile Tally on first connect**: Detect version, features, TDLs, UDFs before any sync.
- [ ] **Store raw XML of push operations**: For debugging failed imports.
- [ ] **Handle TDL absence gracefully**: UDFs become indexed-only. Don't crash, store by index.
- [ ] **Multi-company awareness**: Always query loaded companies on startup.
- [ ] **Full reconciliation weekly**: Don't trust incremental sync alone. Run a full diff periodically.
- [ ] **Parse tally.ini for data path**: Don't assume default paths.
- [ ] **Handle negative stock**: It's normal in Indian SMBs.
- [ ] **Respect Tally Silver's single-user lock**: If only Silver (not Gold), the connector and human operator can't access simultaneously. Queue and batch operations.

### 5.3 Edge Cases to Specifically Test

| # | Scenario | Expected Behaviour |
|---|---|---|
| 1 | Stock item name contains `&`, `<`, or Unicode chars (Hindi) | Parser handles XML escaping; push escapes correctly |
| 2 | Voucher with zero-amount line item (free sample) | Detect and warn; skip zero lines if Tally rejects |
| 3 | Export during Tally company switch | Request returns error; retry after delay |
| 4 | AlterID resets (after company repair/restore) | Detect AlterID going backwards; trigger full re-sync |
| 5 | Split company mid-sync | Company GUID changes; discovery phase re-runs |
| 6 | TDL loaded/unloaded between syncs | UDF tags change format; parser handles both |
| 7 | Voucher in both Accounting and Invoice view | Both tag variants parsed correctly |
| 8 | Compound unit quantity string | Parsing extracts correct number and base unit |
| 9 | Multiple companies with same name (after split) | Distinguished by GUID, not name |
| 10 | Backdated voucher entered by CA | AlterID catches it; date-range aware re-processing |
| 11 | Ledger renamed by CA | GUID matches; name updated in cache |
| 12 | GST rate changed mid-year (government notification) | Stock items have date-wise GST rate lists |
| 13 | Tally port conflict (another app on 9000) | Configurable port in connector config |
| 14 | Tally running but no company loaded | HTTP request returns error XML; connector waits |
| 15 | Push Sales Order for non-existent party | Auto-create ledger under Sundry Debtors first |
| 16 | Push Sales Order when order numbering is "Automatic" | Omit VOUCHERNUMBER tag; let Tally assign |
| 17 | Stock item with batch enabled but no batch specified in push | Import fails; must include BATCHALLOCATIONS.LIST |
| 18 | Godown disabled (single godown) but push includes godown name | Use "Main Location" as default |
| 19 | Tally.ERP 9 (not TallyPrime) — no JSON support | Detect version; use XML only |
| 20 | Large company (500K+ vouchers) — initial full sync | Day-by-day batching; progress reporting; resumable |

---

## 6. FILESYSTEM SCANNING STRATEGY (for Go connector)

### 6.1 Discovery on Windows Machine

```go
// Step 1: Find Tally installation
// Check common paths
candidates := []string{
    `C:\TallyPrime`,
    `C:\Tally.ERP9`,
    `C:\Program Files\TallyPrime`,
    `C:\Program Files (x86)\TallyPrime`,
    `C:\Program Files\Tally.ERP9`,
}
// Also check registry: HKLM\SOFTWARE\Tally Solutions\Install
// Also check running processes for tallyprime.exe / tally.exe path

// Step 2: Parse tally.ini
ini := parseINI(filepath.Join(tallyDir, "tally.ini"))
dataPath := ini.Get("Tally", "Data Path")
port := ini.GetInt("Tally", "Port", 9000)
userTDLs := ini.GetAll("Tally", "User TDL")

// Step 3: Enumerate company folders
companies := listDirectories(dataPath)
// Folders named 10000, 10001, 100000, etc.
// Each is a separate company

// Step 4: Scan for TDL/TCP files
tdlFiles := scanForExtensions(tallyDir, []string{".tcp", ".tdl"})

// Step 5: Check tally.imp for recent import activity
impLog := readFile(filepath.Join(tallyDir, "Tally.imp"))
```

### 6.2 tally.ini Key Fields

```ini
[Tally]
; Installation
Admin = Yes
Launch Browser = No

; Network
Port = 9000                          ; HTTP server port
Connect = Yes                        ; ODBC enabled
Port 2 = 9001                        ; ODBC port (if different)

; Data
Data Path = C:\Users\Public\TallyPrime\Data
Export Path = C:\TallyPrime\Export
Log Path = C:\TallyPrime\Logs

; TDL
TDL = Yes                            ; TDL engine enabled
Default TDL = tally.tdl
User TDL = Yes                       ; User TDLs enabled
User TDL0 = MedicalBilling.tcp
User TDL1 = SalesmanTracker.tcp
User TDL2 = C:\Custom\DiscountCalc.tdl

; Performance
; Cache related settings
```

---

## 7. COMMON POPULAR TDL/TCP ADDONS IN INDIAN MARKET

| Addon Category | Common Names | UDFs Created | Impact on XML |
|---|---|---|---|
| **Medical Billing** | TDLStore Medical, Antraweb Pharma | DrugSchedule, PackOf, CompanyBrand, PatientName, DoctorName, DLNumber on Company | Stock Item gets extra LIST tags; Voucher gets extra UDF fields |
| **E-commerce Integration** | eCom2Tally, Unicommerce, Amazon-to-Tally | OrderID, MarketplaceName, AWB, ChannelName | Voucher gets marketplace UDFs; may create custom voucher types |
| **Barcode/QR** | TallyBarcode, ScanTally | BarcodeValue, EANCode on StockItem | Stock Item gets barcode UDF |
| **Salesman/DSR** | Various | SalesmanName, Route, Territory, BeatName | Voucher and Ledger get salesman UDFs |
| **Approval Workflow** | Antraweb Approval, TallyVault | ApprovalStatus, ApprovedBy, ApprovalDate | Voucher gets workflow UDFs; may restrict voucher creation |
| **WhatsApp Integration** | Tally WhatsApp (built-in 7.0+) | None (uses existing data) | No UDF impact |
| **Multi-branch Reporting** | Custom per partner | BranchCode, BranchName | Company/Voucher get branch UDFs |
| **IMEI/Serial Tracking** | TDLStore IMEI, Custom | IMEINumber (aggregate UDF on voucher inventory line) | Complex nested UDFs in inventory allocations |
| **Discount Management** | Custom | DiscountType, DiscountPct, SchemeCode | Voucher line items get discount UDFs |
| **Transport/Logistics** | E-Way Bill TDL (built-in), Custom | VehicleNo, TransporterID, TransportMode, EWayBillNo | Voucher gets transport UDFs |

### 7.1 Detecting Addon Category from Filename

```go
// Heuristic detection from TCP/TDL filenames
patterns := map[string]string{
    "medical":    "pharma_billing",
    "pharma":     "pharma_billing",
    "billing":    "billing_customization",
    "barcode":    "barcode_tracking",
    "ecom":       "ecommerce_integration",
    "amazon":     "ecommerce_integration",
    "flipkart":   "ecommerce_integration",
    "salesman":   "salesman_tracking",
    "dsr":        "salesman_tracking",
    "approval":   "workflow_approval",
    "imei":       "serial_tracking",
    "serial":     "serial_tracking",
    "discount":   "discount_management",
    "transport":  "logistics",
    "eway":       "logistics",
    "whatsapp":   "communication",
    "sms":        "communication",
    "branch":     "multi_branch",
    "api2books":  "third_party_sync",
    "easyreport": "reporting",
    "powerbi":    "reporting",
}
```

---

## 8. VERSION-SPECIFIC DIFFERENCES

| Feature | Tally.ERP 9 | TallyPrime (pre-7.0) | TallyPrime 7.0+ |
|---|---|---|---|
| JSON API | No | No | Yes (native) |
| XML API | Yes | Yes | Yes |
| ODBC | Yes | Yes | Yes |
| Company folder | 5-digit (10000) | 5-digit (10000) | 6-digit (100000) after migration |
| Data files | .900 | .900 | .900 / .1800 |
| Config file | tally.ini | tally.ini | tally.ini + config/ folder |
| TDL Management | F12 > Product Features | F1 > TDLs & Add-ons | F1 > TDLs & Add-ons |
| e-Invoicing | Add-on | Built-in | Built-in (enhanced) |
| Import from JSON | No | No | Yes |
| Export to JSON | Limited (via TDL) | Limited (via TDL) | Native |
| HTTP response | XML only | XML only | XML or JSON |
| Max data in single response | Lower (~2000 objects) | ~5000 objects | ~5000 objects |

**Version detection via XML API**:
```xml
<!-- Query company to detect Tally version -->
<ENVELOPE><HEADER>
  <TALLYREQUEST>Export</TALLYREQUEST>
  <TYPE>Data</TYPE>
  <ID>List of Companies</ID>
</HEADER><BODY><DESC><STATICVARIABLES>
  <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
</STATICVARIABLES></DESC></BODY></ENVELOPE>

<!-- Response includes: -->
<TALLYVERSION>TallyPrime:Release 7.0</TALLYVERSION>
<!-- Or: -->
<TALLYVERSION>Tally.ERP 9:Release 6.6.3</TALLYVERSION>
```

---

## 9. THE TALLY SILVER vs GOLD PROBLEM

**Tally Silver** = Single user. Only ONE connection to the HTTP server at a time. If the operator is using Tally, the connector's HTTP requests may fail or queue.

**Tally Gold** = Multi-user. Multiple concurrent connections. The connector can operate alongside human users.

**Detection**: Query the license type via XML API or check the About screen data.

**Mitigation for Silver**:
- Schedule heavy sync operations during off-hours (night, lunch break)
- Use lightweight, fast requests during business hours (incremental AlterID check only)
- Implement aggressive connection timeout and retry
- Consider a "sync now" button in the sales app that the operator triggers when they're not actively in Tally
- CRITICAL: Never hold an HTTP connection open for long. Tally Silver will block the user.

---

## 10. DATA INTEGRITY RULES FOR PUSH OPERATIONS

### 10.1 The Golden Rules

1. **Dr = Cr**: Every voucher must balance. Sum of all debit amounts must equal sum of all credit amounts. In Tally's convention: sum of all negative amounts must equal sum of all positive amounts.

2. **Inventory amount must match accounting allocation**: If inventory line says Paracetamol ₹5000, the accounting allocation to Sales Account must also be ₹5000.

3. **GST must be correct**: IGST for interstate, CGST+SGST for intrastate. The connector must know the stockist's state and the party's state to determine this.

4. **Dependent masters must pre-exist**: Stock Items, Ledgers, Godowns, Units — all must exist in Tally before referencing in a voucher.

5. **Batch allocation must match item quantity**: If item says 100 strips, the sum of batch allocation quantities must also be 100 strips.

6. **Feature flags must match**: If company has batches enabled, voucher must include batch details. If godowns enabled, must include godown allocation. If these are missing, import fails.

### 10.2 Pre-Push Validation Checklist

```
For each Sales Order to push:
  □ Party ledger exists in mst_ledger cache (or auto-create)
  □ Party state is set (for GST determination)
  □ All stock items exist in mst_stock_item cache
  □ All stock items have GST rates defined
  □ Quantity format matches item's base unit
  □ Rate is positive and non-zero
  □ Amount = Quantity × Rate (for each line)
  □ Total of item amounts + tax amounts = party amount
  □ Dr total = Cr total
  □ If batches enabled: batch allocation included
  □ If godowns enabled: godown name valid
  □ Voucher number is unique (or omitted for auto-numbering)
  □ Date falls within current financial year
  □ XML is properly escaped (& → &amp;, etc.)
```
