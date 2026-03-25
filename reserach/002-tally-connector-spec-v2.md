# TALLY CONNECTOR — Full Integration Specification v2

## VERSION: 0.2-DRAFT | DATE: 2026-03-25

---

## 1. DEEP DIVE: HISTORICAL DATA DEPTH

### 1.1 How Tally Organises Time

Tally companies have two critical dates:
- **Financial Year Beginning**: Usually 1-Apr in India (configurable)
- **Books Beginning From**: Can be same as FY or different (e.g., if company started mid-year)

A single Tally company CAN hold multiple financial years of data. There is no hard boundary — you can change the current period (Alt+F2) to view/enter data in any year. However, most Indian businesses follow one of these patterns:

**Pattern A — Multi-year single company**: One company file holds 3-10+ years of data. This is common for small stockists. The file grows, Tally slows down, but they live with it.

**Pattern B — Split per financial year**: After audit/finalisation, the company is split using Gateway > Data > Split. This creates two new companies (pre-split and post-split). The old data is archived. Each company is a separate data universe with its own GUID, AlterIDs starting from 1, and independent master hierarchies.

**Pattern C — New company with imported opening balances**: A fresh company is created for the new FY. Only closing balances of ledgers and stock items are exported as XML and imported as opening balances in the new company. Transaction history is NOT carried forward.

### 1.2 Impact Matrix: Historical Depth vs. System Behaviour

#### On Integration Behaviour

| Depth | What happens | Connector complexity |
|---|---|---|
| **Current FY only** | Set `SVFROMDATE` / `SVTODATE` to current FY boundaries. Masters are always full-export (no date filter). Vouchers are date-filtered. | Simplest. One date range. |
| **Current + Previous FY** | Same as above but two date ranges. If stockist uses Pattern A (single company), just widen the date range. If Pattern B/C, the connector must discover and connect to multiple company files — each is a separate Tally company loaded independently. | Medium. Multi-company iteration if split. |
| **All available history** | For Pattern A, use `auto` mode (like tally-database-loader) to auto-detect first and last transaction dates. For Pattern B, must iterate ALL split company files. | Most complex. Discovery problem. |

**Key insight**: For Pattern A, `SVFROMDATE=auto` detection works by querying the company for its `BooksFrom` date and `LastVoucherDate`. This is a single XML request:

```xml
<ENVELOPE><HEADER><VERSION>1</VERSION>
<TALLYREQUEST>Export</TALLYREQUEST><TYPE>Data</TYPE>
<ID>List of Companies</ID></HEADER>
<BODY><DESC><STATICVARIABLES>
<SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
</STATICVARIABLES></DESC></BODY></ENVELOPE>
```

The response includes `<STARTINGFROM>` and `<ENDINGAT>` per company, giving you the full transaction date range without guessing.

#### On Data Behaviour

| Depth | Data volume | Stock position accuracy | Outstanding bills accuracy |
|---|---|---|---|
| **Current FY only** | Manageable. Typical stockist: 5K-50K vouchers/year. | Accurate only if opening balances are correctly set in Tally for current FY. If stockist forgot to set opening stock, your computed stock will be wrong. | Bills from prior FY that are still outstanding appear as opening balance entries — but you won't have the original invoice detail. |
| **Current + Previous FY** | 2x volume. 10K-100K vouchers. | Better. You can trace movement over 2 years. But stock position computation STILL depends on opening balance of the oldest FY you sync. | Full bill lifecycle for anything originated in previous FY. Still blind before that. |
| **All available history** | Could be 500K+ vouchers for a busy stockist over 5+ years. Initial full sync could take hours. | Best possible — but still depends on the accuracy of the oldest opening balance in Tally. | Complete bill history. Can compute ageing from original date. |

**CRITICAL INSIGHT**: You can NEVER compute stock position from raw vouchers alone. Tally's opening balance for stock items (set in the stock item master) is the anchor. All voucher-based stock movement is a delta on top of that. The **Stock Summary report** from Tally gives you the Tally-computed closing stock — always trust this over your own computation from vouchers.

#### On Usage Behaviour (downstream app)

| Depth | Sales fleet impact | CRM impact | Reporting impact |
|---|---|---|---|
| **Current FY** | Has current stock levels (from Stock Summary report). Can see current orders. Sufficient for day-to-day. | Can see party ledger balances. Missing historical purchase patterns. | Current year P&L, inventory reports. No YoY comparison. |
| **Current + Previous FY** | Same stock visibility. Can see last year's buying patterns for each medical shop — useful for demand prediction. | Better territory analysis. Knows which shops were added/lost. Can see credit behaviour over time. | YoY comparisons. Seasonality patterns (e.g., monsoon illness spikes). |
| **All history** | No incremental benefit over 2 years for daily operations. | Full relationship history. Lifetime value computation. | Multi-year trend analysis. But diminishing returns past 3 years for a stockist. |

#### On Ops Behaviour

| Depth | Initial sync time | Ongoing sync load | Storage | Recovery |
|---|---|---|---|---|
| **Current FY** | Minutes. | Light. Only new vouchers. | ~50-200MB SQLite. | Fast — full re-sync in minutes. |
| **Current + Previous FY** | 10-30 minutes. | Light after initial sync. | ~200-500MB SQLite. | Moderate — full re-sync in under an hour. |
| **All history** | Hours. Must batch by day. Tally WILL freeze if you try to pull 5+ years in one request. tally-database-loader explicitly warns: batch size >5000 vouchers per HTTP request can freeze Tally indefinitely. | Light after initial sync. | 500MB-2GB SQLite. | Painful. Hours for full re-sync. |

### 1.3 RECOMMENDATION

**Default to Current FY + Previous FY.** This gives the sales fleet enough history for demand patterns, gives CRM enough for credit assessment, and keeps the sync footprint manageable. Make the depth configurable in `config.toml`:

```toml
[sync]
# "current_fy" | "current_plus_previous" | "all" | "custom"
historical_depth = "current_plus_previous"
# Only used if historical_depth = "custom"
custom_from_date = "2023-04-01"
```

For Pattern B/C (split companies), the connector needs a **company discovery** phase: list all companies loaded in Tally, identify which ones share the same business entity (by GSTIN or company name prefix), and iterate sync across them.

---

## 2. DEEP DIVE: WRITE-BACK — SALES ORDER PUSH TO TALLY

### 2.1 Why This Is Phase 1, Not Phase 2

The field sales workflow is: sales guy visits medical shop → checks needs → creates order on phone → order must appear in Tally as a Sales Order → warehouse picks/packs based on the order → Delivery Note is issued → Sales Invoice is created against the Delivery Note.

If the Sales Order doesn't flow into Tally, the stockist's warehouse has NO visibility of what to prepare. The entire fulfilment chain breaks. Write-back is foundational, not an enhancement.

### 2.2 Tally's Order-to-Invoice Flow

```
Sales Order (Ctrl+F8)          ← ORDER ONLY, no stock/accounts impact
    │
    ├──→ Delivery Note (Alt+F8)  ← Stock OUT only (from specific godown)
    │       │
    │       └──→ Sales Invoice (F8) ← Stock OUT + Accounts (debit party, credit sales)
    │
    └──→ Sales Invoice (F8)      ← Can skip Delivery Note for simple cases
```

The Sales Order is a commitment. It appears in:
- **Sales Order Outstanding** report
- **Stock Summary** (as "on order" quantity — committed but not dispatched)
- Can be partially fulfilled across multiple Delivery Notes / Invoices

### 2.3 XML Import: Sales Order Voucher Structure

The XML for creating a Sales Order via HTTP POST:

```xml
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Import</TALLYREQUEST>
    <TYPE>Data</TYPE>
    <ID>Vouchers</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVCURRENTCOMPANY>Stockist Pharma Pvt Ltd</SVCURRENTCOMPANY>
      </STATICVARIABLES>
    </DESC>
    <DATA>
      <TALLYMESSAGE xmlns:UDF="TallyUDF">
        <VOUCHER VCHTYPE="Sales Order" ACTION="Create"
                 OBJVIEW="Invoice Voucher View">
          <DATE>20260325</DATE>
          <VOUCHERTYPENAME>Sales Order</VOUCHERTYPENAME>
          <VOUCHERNUMBER>SO/FIELD/0042</VOUCHERNUMBER>
          <REFERENCE>SO/FIELD/0042</REFERENCE>
          <PARTYLEDGERNAME>Raj Medical Store - Ahmedabad</PARTYLEDGERNAME>
          <PERSISTEDVIEW>Invoice Voucher View</PERSISTEDVIEW>
          <NARRATION>Field order by Salesman: Amit K. Territory: Ahmedabad-West</NARRATION>

          <!-- Accounting entry: Party side -->
          <ALLLEDGERENTRIES.LIST>
            <LEDGERNAME>Raj Medical Store - Ahmedabad</LEDGERNAME>
            <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
            <AMOUNT>-11800.00</AMOUNT>
          </ALLLEDGERENTRIES.LIST>

          <!-- Accounting entry: Sales side -->
          <ALLLEDGERENTRIES.LIST>
            <LEDGERNAME>Sales Account</LEDGERNAME>
            <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
            <AMOUNT>10000.00</AMOUNT>
          </ALLLEDGERENTRIES.LIST>

          <!-- Tax entry: GST -->
          <ALLLEDGERENTRIES.LIST>
            <LEDGERNAME>Output IGST 18%</LEDGERNAME>
            <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
            <AMOUNT>1800.00</AMOUNT>
          </ALLLEDGERENTRIES.LIST>

          <!-- Inventory line 1 -->
          <ALLINVENTORYENTRIES.LIST>
            <STOCKITEMNAME>Paracetamol 500mg Strip/10</STOCKITEMNAME>
            <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
            <RATE>50.00/Strip</RATE>
            <ACTUALQTY>100 Strip</ACTUALQTY>
            <BILLEDQTY>100 Strip</BILLEDQTY>
            <AMOUNT>5000.00</AMOUNT>
            <ACCOUNTINGALLOCATIONS.LIST>
              <LEDGERNAME>Sales Account</LEDGERNAME>
              <AMOUNT>5000.00</AMOUNT>
            </ACCOUNTINGALLOCATIONS.LIST>
            <BATCHALLOCATIONS.LIST>
              <GODOWNNAME>Main Location</GODOWNNAME>
              <DESTINATIONGODOWNNAME>Main Location</DESTINATIONGODOWNNAME>
              <BATCHNAME>Primary Batch</BATCHNAME>
              <ORDERDUEDATE>20260401</ORDERDUEDATE>
              <AMOUNT>5000.00</AMOUNT>
              <ACTUALQTY>100 Strip</ACTUALQTY>
              <BILLEDQTY>100 Strip</BILLEDQTY>
            </BATCHALLOCATIONS.LIST>
          </ALLINVENTORYENTRIES.LIST>

          <!-- Inventory line 2 -->
          <ALLINVENTORYENTRIES.LIST>
            <STOCKITEMNAME>Amoxicillin 250mg Cap/10</STOCKITEMNAME>
            <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
            <RATE>100.00/Strip</RATE>
            <ACTUALQTY>50 Strip</ACTUALQTY>
            <BILLEDQTY>50 Strip</BILLEDQTY>
            <AMOUNT>5000.00</AMOUNT>
            <ACCOUNTINGALLOCATIONS.LIST>
              <LEDGERNAME>Sales Account</LEDGERNAME>
              <AMOUNT>5000.00</AMOUNT>
            </ACCOUNTINGALLOCATIONS.LIST>
            <BATCHALLOCATIONS.LIST>
              <GODOWNNAME>Main Location</GODOWNNAME>
              <DESTINATIONGODOWNNAME>Main Location</DESTINATIONGODOWNNAME>
              <BATCHNAME>Primary Batch</BATCHNAME>
              <ORDERDUEDATE>20260401</ORDERDUEDATE>
              <AMOUNT>5000.00</AMOUNT>
              <ACTUALQTY>50 Strip</ACTUALQTY>
              <BILLEDQTY>50 Strip</BILLEDQTY>
            </BATCHALLOCATIONS.LIST>
          </ALLINVENTORYENTRIES.LIST>

        </VOUCHER>
      </TALLYMESSAGE>
    </DATA>
  </BODY>
</ENVELOPE>
```

### 2.4 Import Response Handling

Tally responds with a structured XML indicating success/failure:

```xml
<RESPONSE>
  <CREATED>1</CREATED>
  <ALTERED>0</ALTERED>
  <LASTVCHID>12345</LASTVCHID>
  <LASTMASTERID>67890</LASTMASTERID>
  <COMBINED>0</COMBINED>
  <IGNORED>0</IGNORED>
  <ERRORS>0</ERRORS>
  <LINEERROR></LINEERROR>
</RESPONSE>
```

Common error responses and their meaning:

| Error | Cause | Connector handling |
|---|---|---|
| `Voucher totals do not match!` | Dr/Cr sides don't balance. GST calculation error. | Reject order, report error to sales app. |
| `[STOCKITEM] not found` | Stock item name in order doesn't match Tally master | Pre-validate item names from cached masters before push. |
| `[LEDGER] not found` | Party ledger doesn't exist in Tally | Auto-create party ledger first (separate import request), then retry order. |
| `Unknown Request` | XML malformed or too large (>50 vouchers per batch) | Split into smaller batches. |
| No response / timeout | Tally busy or frozen | Retry with backoff. |

### 2.5 Write-Back Pre-Requisites

Before pushing a Sales Order, the connector MUST validate:

1. **Party ledger exists**: Query `SELECT $Name FROM Ledger WHERE $Name = 'Raj Medical Store'`. If not found, create the ledger first via import XML under group `Sundry Debtors`.
2. **Stock item names match exactly**: Tally is case-sensitive on names. The sales app must use the exact stock item name from the cached `mst_stock_item` table.
3. **Godown exists**: If multi-godown is enabled, the godown name must match.
4. **Sales ledger exists**: The accounting allocation ledger (e.g., "Sales Account") must exist.
5. **GST ledgers exist**: Tax ledgers like "Output IGST 18%" must exist.
6. **Dr/Cr totals balance**: Party amount = Sum of (item amounts + tax amounts). The connector must compute this correctly.

### 2.6 Write-Back: Voucher Lifecycle Operations

| Operation | XML ACTION | Use case |
|---|---|---|
| Create | `ACTION="Create"` | New Sales Order from field |
| Alter | `ACTION="Alter"` + `TAGNAME="Voucher Number" TAGVALUE="SO/FIELD/0042"` + `DATE="20260325"` | Modify quantities/items after order placed |
| Cancel | `ACTION="Cancel"` + same identifiers | Cancel order (medical shop changed mind) |
| Delete | `ACTION="Delete"` + same identifiers | Remove order entirely |

For Alter/Cancel/Delete, you need to identify the voucher by either:
- `MasterID` (Tally's internal ID — most reliable)
- `VoucherNumber` + `VoucherType` + `Date` combination
- `GUID` (globally unique)

**Recommendation**: Store the `MasterID` and `GUID` returned in the create response (`LASTVCHID`/`LASTMASTERID`) in the central database. Use these for all subsequent operations.

### 2.7 Auto-Creating Party Ledgers (Medical Shops)

When a sales guy visits a new medical shop and places an order, the party ledger won't exist in Tally. The connector must auto-create it:

```xml
<ENVELOPE>
  <HEADER><VERSION>1</VERSION>
  <TALLYREQUEST>Import</TALLYREQUEST>
  <TYPE>Data</TYPE><ID>All Masters</ID></HEADER>
  <BODY>
    <DESC><STATICVARIABLES>
      <SVCURRENTCOMPANY>Stockist Pharma Pvt Ltd</SVCURRENTCOMPANY>
    </STATICVARIABLES></DESC>
    <DATA>
      <TALLYMESSAGE xmlns:UDF="TallyUDF">
        <LEDGER NAME="New Medical Shop - Surat" ACTION="Create">
          <PARENT>Sundry Debtors</PARENT>
          <ISBILLWISEON>Yes</ISBILLWISEON>
          <AFFECTSSTOCK>No</AFFECTSSTOCK>
          <ISREVENUE>No</ISREVENUE>
          <ADDRESS.LIST TYPE="String">
            <ADDRESS>123 Main Road</ADDRESS>
            <ADDRESS>Surat, Gujarat 395001</ADDRESS>
          </ADDRESS.LIST>
          <LEDGERPHONE>+91-9876543210</LEDGERPHONE>
          <LEDGEREMAIL>newmedical@email.com</LEDGEREMAIL>
          <LEDSTATENAME>Gujarat</LEDSTATENAME>
          <PARTYGSTIN>24ABCDE1234F1Z5</PARTYGSTIN>
          <GSTREGISTRATIONTYPE>Regular</GSTREGISTRATIONTYPE>
        </LEDGER>
      </TALLYMESSAGE>
    </DATA>
  </BODY>
</ENVELOPE>
```

---

## 3. DEEP DIVE: TDL/TCP CUSTOMIZATIONS & THEIR IMPACT

### 3.1 What Are TDL Customizations

TDL (Tally Definition Language) is Tally's native scripting language. TCP (Tally Compliant Product) is a compiled TDL file. Customizations are loaded by placing `.tdl` or `.tcp` files in Tally's directory and activating them via F1 > TDLs & Add-ons.

### 3.2 Where to Discover Loaded TDLs

```
Method 1: F1 (Help) > TDLs & Add-ons > Manage Local TDLs
  — Lists all .tdl/.tcp files loaded with their paths

Method 2: XML API query for loaded TDLs
  — Query the Company object for its TDL configuration

Method 3: Filesystem scan
  — Check Tally installation directory for .tdl/.tcp files
  — Check %APPDATA%\Tally\ for account-level TDLs
  — Your Go directory scanner tool is perfect for this
```

### 3.3 How TDL Customizations Impact Data Fetch

#### 3.3.1 User Defined Fields (UDFs)

This is the most common and impactful customization. UDFs add custom fields to Tally's internal objects (masters, vouchers). For a medical distributor, typical UDFs might include:

- On Stock Item: Drug Schedule (H, H1, X), Storage Temperature, Manufacturer
- On Voucher: Salesman Name, Territory Code, Route Number
- On Ledger: DL Number (Drug License), FSSAI Number, Shop Category

**How UDFs appear in XML export**: When you export a Stock Item with UDFs, they appear as additional tags within the object:

```xml
<STOCKITEM NAME="Paracetamol 500mg Strip/10">
  <PARENT>Analgesics</PARENT>
  <BASEUNITS>Strip</BASEUNITS>
  <!-- ... standard fields ... -->

  <!-- UDFs appear here if TDL is loaded -->
  <DRUGSCHEDULE.LIST TYPE="String" Index="30">
    <DRUGSCHEDULE>H</DRUGSCHEDULE>
  </DRUGSCHEDULE.LIST>
  <STORAGETEMPERATURE.LIST TYPE="String" Index="31">
    <STORAGETEMPERATURE>Below 25°C</STORAGETEMPERATURE>
  </STORAGETEMPERATURE.LIST>
</STOCKITEM>
```

**Critical gotcha**: If the TDL that defines the UDF is NOT loaded when you export, the UDF data still exists in Tally's database but the tag names are LOST. Instead, you get generic tags with only the `Index` attribute preserved:

```xml
<!-- UDF data WITHOUT TDL loaded — tag names become generic -->
<UDF_STRING_30.LIST Index="30">
  <UDF_STRING_30>H</UDF_STRING_30>
</UDF_STRING_30.LIST>
```

**Connector implication**: The connector MUST be able to handle BOTH named and generic UDF tags. When named tags are available, use them. When only indexed tags appear, log a warning and store them by index number, allowing later mapping once the UDF definitions are discovered.

#### 3.3.2 Custom Voucher Types

Tally allows creating custom voucher types (e.g., "Field Sales Order" under Sales Order). These:
- Inherit the parent type's behaviour
- Can have their own numbering
- Appear in export as `<VOUCHERTYPENAME>Field Sales Order</VOUCHERTYPENAME>`
- The `<PARENT>` tag tells you the base type

**Connector implication**: Never hardcode voucher type names. Always check `<PARENT>` or the `mst_voucher_type` hierarchy to determine if something is a Sales Order variant, Purchase variant, etc.

#### 3.3.3 Custom Reports and Collections

TDL can define custom reports and collections. If the stockist has a custom "Sales Analysis" report or a custom collection that enriches stock items with additional computed fields, the connector can access these IF it knows their names.

**Connector implication**: During setup/onboarding, the connector should do a discovery phase:

```xml
<!-- List all available collections -->
<ENVELOPE><HEADER><VERSION>1</VERSION>
<TALLYREQUEST>Export</TALLYREQUEST>
<TYPE>Collection</TYPE><ID>ListOfCollections</ID>
</HEADER><BODY><DESC><TDL><TDLMESSAGE>
<COLLECTION NAME="ListOfCollections" ISMODIFY="No">
  <TYPE>Collection</TYPE>
  <FETCH>Name</FETCH>
</COLLECTION>
</TDLMESSAGE></TDL></DESC></BODY></ENVELOPE>
```

#### 3.3.4 Modified Default Behaviour

TDL can alter default Tally behaviour:
- Custom validation rules on voucher entry
- Modified GST calculation logic
- Altered stock valuation methods
- Custom import/export behaviours

**Connector implication for PUSH**: When pushing a Sales Order into a Tally that has custom validations, the import might fail with validation errors that don't exist in default Tally. The connector must:
1. Capture ALL error details from the import response
2. Report them clearly to the central system
3. Never assume a default XML template will work for all stockists

### 3.4 How TDL Customizations Impact Data Push

| Customization | Push Impact | Mitigation |
|---|---|---|
| Custom voucher types | Must use exact voucher type name in XML | Fetch `mst_voucher_type` and let central system reference correct name |
| UDFs on vouchers | Must include UDF tags in push XML if TDL expects them | Optional: include `xmlns:UDF="TallyUDF"` and add UDF values |
| Custom validation rules | Import may reject valid-looking XML | Robust error handling + retry without UDFs |
| Modified GST logic | Tax calculation mismatch | Let Tally compute tax (omit tax entries, use ISVATOVERRIDDEN=No) |
| Custom number series | Voucher number collision | Let Tally auto-number (omit VOUCHERNUMBER or use unique prefix) |

### 3.5 Connector Strategy for TDL-Modified Environments

```
Phase 1: Discovery
  - Query loaded TDLs
  - Export sample masters and vouchers to discover UDF tags
  - Map UDF index numbers to names (when TDL is loaded)
  - Build a "Tally Profile" for this stockist

Phase 2: Adaptive Fetch
  - FETCH standard fields always
  - Detect UDF tags in response dynamically
  - Store UDFs in a key-value extension table (not hardcoded columns)

Phase 3: Adaptive Push
  - Start with minimal required fields
  - If import fails with validation errors, retry with additional fields
  - Log all unknown validation requirements for manual resolution
```

---

## 4. DEEP DIVE: XML DIVERSITY & HANDLING

### 4.1 The Five Request Types

| Type | Header Config | Purpose | Response |
|---|---|---|---|
| **Export Data** | `TALLYREQUEST=Export, TYPE=Data, ID=<ReportName>` | Pull a TDL report (Daybook, Stock Summary, Trial Balance, etc.) | Full report XML with all data |
| **Export Object** | `TALLYREQUEST=Export, TYPE=Object, SUBTYPE=<ObjectType>, ID=<ObjectName>` | Pull a single object (one ledger, one stock item) | Single object XML |
| **Export Collection** | `TALLYREQUEST=Export, TYPE=Collection, ID=<CollectionName>` | Pull a set of objects (all ledgers, all stock items) | Array of objects |
| **Import** | `TALLYREQUEST=Import, TYPE=Data, ID=<AllMasters or Vouchers>` | Push masters or vouchers into Tally | Success/failure counts |
| **Execute** | `TALLYREQUEST=Execute, TYPE=TDLAction, ID=<ActionName>` | Trigger an action (sync, custom actions) | Action result |

### 4.2 Critical XML Parsing Patterns

#### Quantity strings with embedded units

```xml
<OPENINGBALANCE>100 Strip</OPENINGBALANCE>
<ACTUALQTY>50 pcs</ACTUALQTY>
<BILLEDQTY>2 Box of 12 pcs</BILLEDQTY>
```

Parser must handle: `"100 Strip"` → `{value: 100, unit: "Strip"}`. For compound units like `"2 Box of 12 pcs"`, Tally includes the compound expression. Parse the leading number.

#### Amount signs (Tally's debit-negative convention)

```xml
<OPENINGVALUE>-1200000.00</OPENINGVALUE>  <!-- Stock: negative = debit = asset value -->
<AMOUNT>-11800.00</AMOUNT>                 <!-- Voucher: negative = debit -->
<CLOSINGBALANCE>50000.00 Cr</CLOSINGBALANCE> <!-- Report: may include Dr/Cr suffix -->
```

Convention: In voucher entries, debit is negative, credit is positive. In reports, amounts may have " Dr" or " Cr" suffix.

#### Date format

Always `YYYYMMDD` for import, but responses may include `DD-Mon-YYYY` in some report contexts. Normalize everything to `YYYY-MM-DD` in SQLite/PostgreSQL.

#### Boolean values

```xml
<ISBATCHENABLED>Yes</ISBATCHENABLED>  <!-- Not true/false, but Yes/No -->
<HASMFGDATE>No</HASMFGDATE>
```

Always `Yes` / `No` strings.

#### LIST type fields (arrays)

```xml
<GSTDETAILS.LIST>           <!-- Repeating element = array -->
  <APPLICABLEFROM>20240401</APPLICABLEFROM>
  <HSNCODE>30049099</HSNCODE>
  <TAXABILITY>Taxable</TAXABILITY>
  <STATEWISEDETAILS.LIST>   <!-- Nested array -->
    <STATENAME>Gujarat</STATENAME>
    <RATEDETAILS.LIST>
      <GSTRATE>18</GSTRATE>
    </RATEDETAILS.LIST>
  </STATEWISEDETAILS.LIST>
</GSTDETAILS.LIST>
```

LIST fields can nest arbitrarily deep. The parser must handle recursive structures.

#### Empty/missing tags vs explicit empty

```xml
<HSNCODE/>              <!-- Empty self-closing tag = empty string -->
<HSNCODE></HSNCODE>     <!-- Same as above -->
<!-- Tag absent entirely = field not set / not applicable -->
```

#### UDF namespace

```xml
<TALLYMESSAGE xmlns:UDF="TallyUDF">
  <!-- UDF fields use this namespace -->
  <MYUDF.LIST TYPE="String" Index="30">...</MYUDF.LIST>
</TALLYMESSAGE>
```

### 4.3 Inline TDL in Requests (the power feature)

You can embed TDL code directly in the XML request. This means the connector doesn't need the stockist to install any TDL file — the connector sends the TDL definition WITH the request:

```xml
<ENVELOPE>
  <HEADER><VERSION>1</VERSION>
  <TALLYREQUEST>Export</TALLYREQUEST>
  <TYPE>Collection</TYPE>
  <ID>MyCustomStockExport</ID></HEADER>
  <BODY><DESC>
    <STATICVARIABLES>
      <SVCURRENTCOMPANY>##COMPANY##</SVCURRENTCOMPANY>
    </STATICVARIABLES>
    <TDL><TDLMESSAGE>
      <COLLECTION NAME="MyCustomStockExport" ISMODIFY="No">
        <TYPE>StockItem</TYPE>
        <NATIVEMETHOD>Name, Parent, BaseUnits, GUID, MasterId, AlterId</NATIVEMETHOD>
        <NATIVEMETHOD>OpeningBalance, OpeningValue, OpeningRate</NATIVEMETHOD>
        <NATIVEMETHOD>ClosingBalance, ClosingValue, ClosingRate</NATIVEMETHOD>
        <NATIVEMETHOD>GSTDetails.List</NATIVEMETHOD>
        <NATIVEMETHOD>BatchAllocations.List</NATIVEMETHOD>
        <NATIVEMETHOD>StandardCost, StandardSellingPrice</NATIVEMETHOD>
        <NATIVEMETHOD>ReorderLevel, MinimumOrderQuantity</NATIVEMETHOD>
        <NATIVEMETHOD>HasMfgDate, MaintainInBatches</NATIVEMETHOD>
        <NATIVEMETHOD>Category, Alias, PartNumber</NATIVEMETHOD>
        <NATIVEMETHOD>Description, Narration</NATIVEMETHOD>
        <!-- Can also FETCH UDFs if you know their names -->
      </COLLECTION>
    </TDLMESSAGE></TDL>
  </DESC></BODY>
</ENVELOPE>
```

This is extremely powerful: FETCH/NATIVEMETHOD lets you specify exactly which fields to pull, reducing response size. You can also add FILTER attributes to the collection for server-side filtering:

```xml
<COLLECTION NAME="RecentlyModifiedStock" ISMODIFY="No">
  <TYPE>StockItem</TYPE>
  <NATIVEMETHOD>Name, AlterId, GUID</NATIVEMETHOD>
  <FILTER>RecentlyModified</FILTER>
</COLLECTION>
<SYSTEM TYPE="Formulae" NAME="RecentlyModified">
  $$FilterGreater:$AlterId:##LAST_ALTER_ID##
</SYSTEM>
```

This is how you implement efficient incremental sync at the Tally level — filter by AlterID on the server side, so only changed objects are transmitted.

### 4.4 Batch Import Rules

From real-world experience (tally-database-loader, TDL Integration blog, API2Books):

- **Max ~50 vouchers per single TALLYMESSAGE**: Beyond this, some Tally instances return "Unknown Request"
- **Max ~5000 collection objects per response**: Larger collections may freeze Tally
- **Day-by-day batching for vouchers**: Set `SVFROMDATE` and `SVTODATE` to the same day for large companies
- **Masters first, then vouchers**: Dependent masters (groups, ledgers, stock items) must exist before importing vouchers that reference them
- **One master type per request**: Don't mix ledger creation with stock item creation in the same TALLYMESSAGE

---

## 5. REFINED DATA MODELING

### 5.1 SQLite Schema (Local Cache) — Key Changes from v1

#### UDF Extension Table (dynamic, no schema changes needed per stockist)

```sql
-- Captures ALL UDFs dynamically, regardless of TDL presence
CREATE TABLE ext_udf_values (
    object_type     TEXT NOT NULL,   -- 'stock_item', 'voucher', 'ledger'
    object_guid     TEXT NOT NULL,   -- FK to parent object
    udf_name        TEXT NOT NULL,   -- named if TDL loaded, else 'UDF_STRING_30'
    udf_index       INTEGER,         -- numeric index (survives TDL loss)
    udf_type        TEXT,            -- String, Amount, Date, Number, Logical
    udf_value       TEXT,            -- stored as text, parsed by consumer
    PRIMARY KEY (object_type, object_guid, udf_index)
);
CREATE INDEX idx_udf_object ON ext_udf_values(object_type, object_guid);
```

#### Tally Profile Table (one-time discovery metadata)

```sql
CREATE TABLE _tally_profile (
    company_guid        TEXT PRIMARY KEY,
    tally_version       TEXT,        -- "TallyPrime 7.0" vs "Tally.ERP 9"
    is_json_supported   BOOLEAN,     -- True if TallyPrime 7.0+
    is_multi_godown     BOOLEAN,
    is_batch_enabled    BOOLEAN,
    is_order_enabled    BOOLEAN,
    is_bom_enabled      BOOLEAN,
    is_cost_tracking    BOOLEAN,
    loaded_tdl_files    TEXT,        -- JSON array of loaded TDL/TCP file names
    discovered_udfs     TEXT,        -- JSON: [{name, index, type, object}]
    custom_voucher_types TEXT,       -- JSON: [{name, parent}]
    financial_year_from DATE,
    financial_year_to   DATE,
    books_from          DATE,
    first_voucher_date  DATE,
    last_voucher_date   DATE,
    last_profiled_at    TIMESTAMP
);
```

#### Order Tracking (for write-back lifecycle)

```sql
CREATE TABLE write_orders (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    central_order_id    TEXT UNIQUE NOT NULL,  -- UUID from central system
    tally_voucher_guid  TEXT,                   -- NULL until confirmed
    tally_master_id     INTEGER,                -- NULL until confirmed
    tally_voucher_number TEXT,
    party_ledger        TEXT NOT NULL,
    order_date          DATE NOT NULL,
    total_amount        DECIMAL NOT NULL,
    status              TEXT DEFAULT 'pending',  -- pending/pushed/confirmed/failed/cancelled
    push_xml            TEXT,                    -- the actual XML sent (for debugging)
    response_xml        TEXT,                    -- Tally's response
    error_message       TEXT,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    pushed_at           TIMESTAMP,
    confirmed_at        TIMESTAMP,
    retry_count         INTEGER DEFAULT 0
);

CREATE TABLE write_order_items (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id            INTEGER REFERENCES write_orders(id),
    stock_item_name     TEXT NOT NULL,
    quantity            DECIMAL NOT NULL,
    unit                TEXT NOT NULL,
    rate                DECIMAL NOT NULL,
    amount              DECIMAL NOT NULL,
    godown              TEXT,
    batch_name          TEXT,
    due_date            DATE
);
```

### 5.2 PostgreSQL Schema (Central) — Refined Multi-Tenant

#### Enum Types

```sql
CREATE TYPE voucher_category AS ENUM (
    'accounting', 'inventory', 'order'
);

CREATE TYPE sync_status AS ENUM (
    'synced', 'pending_push', 'push_failed', 'conflict'
);

CREATE TYPE order_status AS ENUM (
    'draft', 'confirmed', 'pushed_to_tally', 'tally_confirmed',
    'partially_fulfilled', 'fulfilled', 'cancelled', 'failed'
);
```

#### Tenant-Aware Stock Item (with pharma-specific fields)

```sql
CREATE TABLE stock_items (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id),
    tally_guid          TEXT NOT NULL,
    tally_alter_id      INTEGER,
    name                TEXT NOT NULL,
    alias               TEXT,
    part_number         TEXT,
    stock_group         TEXT,
    stock_category      TEXT,
    base_unit           TEXT,
    alternate_unit      TEXT,
    conversion_factor   DECIMAL,
    hsn_code            TEXT,
    gst_rate            DECIMAL,
    gst_type_of_supply  TEXT,  -- Goods / Services
    standard_cost       DECIMAL,
    standard_selling_price DECIMAL,
    reorder_level       DECIMAL,
    reorder_quantity    DECIMAL,
    minimum_order_qty   DECIMAL,
    costing_method      TEXT,
    is_batch_enabled    BOOLEAN DEFAULT false,
    has_expiry_tracking BOOLEAN DEFAULT false,

    -- Pharma-specific (from UDFs, mapped during onboarding)
    drug_schedule       TEXT,   -- H, H1, X, OTC
    storage_condition   TEXT,   -- Below 25°C, Refrigerate, etc.
    manufacturer        TEXT,
    drug_license_required BOOLEAN,

    synced_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(tenant_id, tally_guid)
);
CREATE INDEX idx_stock_items_tenant ON stock_items(tenant_id);
CREATE INDEX idx_stock_items_name ON stock_items(tenant_id, name);
CREATE INDEX idx_stock_items_hsn ON stock_items(tenant_id, hsn_code);
```

#### Stock Position (computed from Tally reports, NOT from vouchers)

```sql
CREATE TABLE stock_positions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id),
    stock_item_id       UUID NOT NULL REFERENCES stock_items(id),
    godown              TEXT NOT NULL DEFAULT 'Main Location',
    closing_qty         DECIMAL NOT NULL,
    closing_value       DECIMAL NOT NULL,
    closing_rate        DECIMAL,
    -- Order commitments (from outstanding reports)
    sales_order_pending_qty  DECIMAL DEFAULT 0,
    purchase_order_pending_qty DECIMAL DEFAULT 0,
    -- Derived: available = closing - sales_order_pending
    available_qty       DECIMAL GENERATED ALWAYS AS
        (closing_qty - COALESCE(sales_order_pending_qty, 0)) STORED,
    as_of_date          DATE NOT NULL,
    synced_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(tenant_id, stock_item_id, godown, as_of_date)
);
CREATE INDEX idx_stock_pos_tenant ON stock_positions(tenant_id, as_of_date);
```

#### Batch/Expiry Tracking (pharma-critical)

```sql
CREATE TABLE stock_batches (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id),
    stock_item_id       UUID NOT NULL REFERENCES stock_items(id),
    batch_name          TEXT NOT NULL,
    godown              TEXT NOT NULL DEFAULT 'Main Location',
    mfg_date            DATE,
    expiry_date         DATE,
    closing_qty         DECIMAL NOT NULL,
    closing_value       DECIMAL,
    synced_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(tenant_id, stock_item_id, batch_name, godown)
);
CREATE INDEX idx_batches_expiry ON stock_batches(tenant_id, expiry_date);
CREATE INDEX idx_batches_item ON stock_batches(tenant_id, stock_item_id);
```

#### Field Orders (from sales fleet, write-back to Tally)

```sql
CREATE TABLE field_orders (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id),
    order_number        TEXT NOT NULL,
    party_id            UUID REFERENCES parties(id),
    party_ledger_name   TEXT NOT NULL,  -- exact Tally ledger name
    salesman_id         UUID,
    territory           TEXT,
    order_date          DATE NOT NULL,
    due_date            DATE,
    total_amount        DECIMAL NOT NULL,
    gst_amount          DECIMAL,
    status              order_status NOT NULL DEFAULT 'draft',
    tally_voucher_guid  TEXT,
    tally_master_id     INTEGER,
    tally_voucher_number TEXT,
    tally_push_error    TEXT,
    notes               TEXT,
    created_at          TIMESTAMPTZ DEFAULT now(),
    pushed_at           TIMESTAMPTZ,
    fulfilled_at        TIMESTAMPTZ,
    UNIQUE(tenant_id, order_number)
);

CREATE TABLE field_order_items (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id            UUID NOT NULL REFERENCES field_orders(id) ON DELETE CASCADE,
    stock_item_id       UUID REFERENCES stock_items(id),
    stock_item_name     TEXT NOT NULL,  -- exact Tally stock item name
    quantity            DECIMAL NOT NULL,
    unit                TEXT NOT NULL,
    rate                DECIMAL NOT NULL,
    amount              DECIMAL NOT NULL,
    gst_rate            DECIMAL,
    gst_amount          DECIMAL,
    godown              TEXT DEFAULT 'Main Location',
    due_date            DATE,
    fulfilled_qty       DECIMAL DEFAULT 0,
    sort_order          INTEGER DEFAULT 0
);
CREATE INDEX idx_field_orders_tenant ON field_orders(tenant_id, status);
CREATE INDEX idx_field_orders_party ON field_orders(tenant_id, party_id);
```

#### UDF Store (central, flexible)

```sql
CREATE TABLE udf_definitions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id),
    object_type         TEXT NOT NULL,  -- stock_item, voucher, ledger
    udf_name            TEXT NOT NULL,
    udf_index           INTEGER NOT NULL,
    udf_data_type       TEXT NOT NULL,  -- String, Amount, Date, Number, Logical
    display_label       TEXT,           -- Human-friendly label
    is_pharma_mapped    BOOLEAN DEFAULT false,  -- mapped to a typed column
    mapped_column       TEXT,           -- e.g., 'drug_schedule'
    UNIQUE(tenant_id, object_type, udf_index)
);

CREATE TABLE udf_values (
    id                  BIGSERIAL PRIMARY KEY,
    tenant_id           UUID NOT NULL,
    object_type         TEXT NOT NULL,
    object_id           UUID NOT NULL,  -- FK to relevant table
    udf_definition_id   UUID REFERENCES udf_definitions(id),
    value_text          TEXT,
    value_numeric       DECIMAL,
    value_date          DATE,
    value_boolean       BOOLEAN
);
CREATE INDEX idx_udf_values_object ON udf_values(tenant_id, object_type, object_id);
```

---

## 6. REFINED CONNECTOR SYNC ENGINE

### 6.1 Sync Phases (ordered)

```
1. PROFILE   — Discover Tally version, features, TDLs, UDFs, company dates
2. MASTERS   — Pull all master collections (Stock Items, Godowns, Ledgers, etc.)
3. VOUCHERS  — Pull transactions (date-batched, batched by volume)
4. REPORTS   — Pull computed reports (Stock Summary, Batch Summary, Outstanding)
5. PUSH      — Push queued write-backs (Sales Orders, new Ledgers)
6. VERIFY    — Compare central DB positions with Tally-reported positions
```

### 6.2 Company Discovery (Multi-Company Handling)

```xml
<!-- Step 1: List all companies loaded in Tally -->
<ENVELOPE><HEADER><VERSION>1</VERSION>
<TALLYREQUEST>Export</TALLYREQUEST>
<TYPE>Collection</TYPE><ID>CompanyList</ID></HEADER>
<BODY><DESC><TDL><TDLMESSAGE>
<COLLECTION NAME="CompanyList" ISMODIFY="No">
  <TYPE>Company</TYPE>
  <NATIVEMETHOD>Name, GUID, StartingFrom, BooksFrom</NATIVEMETHOD>
  <NATIVEMETHOD>MaintainBatchWiseDetails, MaintainMultipleGodowns</NATIVEMETHOD>
  <NATIVEMETHOD>UseTrackingNumbers, HasBillOfMaterials</NATIVEMETHOD>
</COLLECTION>
</TDLMESSAGE></TDL></DESC></BODY></ENVELOPE>
```

If a stockist has multiple companies (e.g., per-state GSTIN), the connector:
1. Lists all companies
2. Matches by GSTIN or name prefix against the tenant configuration
3. Sets `SVCURRENTCOMPANY` per request to target each company
4. Stores company_guid as a dimension in all tables

### 6.3 Configuration (Refined)

```toml
[tally]
host = "localhost"
port = 9000
# If blank, connector discovers and syncs ALL loaded companies
# If specified, only this company is synced
company = ""

[sync]
historical_depth = "current_plus_previous"
master_interval_seconds = 300
voucher_interval_seconds = 60
report_interval_seconds = 600
voucher_batch_size = 50          # per TALLYMESSAGE for import
voucher_export_batch = "daily"   # daily | monthly | single
max_collection_size = 5000       # max objects per export request
full_reconcile_interval = "24h"  # full sync for drift detection

[writeback]
enabled = true
auto_create_ledgers = true
voucher_number_prefix = "FIELD/"
max_retry = 5
retry_backoff_seconds = [5, 30, 120, 600, 3600]

[cache]
sqlite_path = "./tally-cache.db"
retain_days = 730                 # 2 years of local history

[central]
api_url = "https://api.example.com"
api_key_env = "TALLY_CONNECTOR_API_KEY"
tenant_id = "stockist-001"
push_interval_seconds = 15
compression = true               # gzip payloads

[discovery]
profile_on_start = true
detect_udfs = true
detect_custom_voucher_types = true
```

---

## 7. REVISED IMPLEMENTATION PHASES

### Phase 1: Foundation + Write-Back (Week 1-3)

**This phase must deliver a working read+write loop.**

- Go project scaffold, Windows cross-compile, Tally HTTP client
- Company discovery and profile detection
- XML request builder (all 5 request types)
- XML response parser with: quantity parsing, amount sign handling, date normalization, boolean conversion, LIST recursion, UDF detection
- Core master sync: StockItem, Godown, Ledger (Sundry Debtors + Sundry Creditors), StockGroup, Unit, VoucherType
- Sales Order import (write-back): XML builder, response handler, error handling
- Party ledger auto-creation
- SQLite schema + upsert engine with AlterID tracking
- Central API push client (push stock items + parties)

**Exit criteria**: Can pull stock catalog from Tally, display in a test API, accept a JSON order, push it to Tally as a Sales Order, and confirm creation.

### Phase 2: Full Inventory Depth (Week 4-5)

- Complete master sync: StockCategory, Currency, BOM, PriceList, CostCentre
- Full voucher extraction with all sub-tables (accounting, inventory, batch, bill, bank, cost centre)
- Date-range batching for voucher export
- Incremental sync via AlterID (with full-sync fallback)
- Order voucher flag handling (filter from stock/account computations)
- UDF discovery and flexible storage
- TDL profile detection

### Phase 3: Reports + Computed Data (Week 5-6)

- Stock Summary report extraction (Tally-computed stock positions)
- Batch Summary with expiry dates (pharma-critical)
- Godown Summary (multi-location visibility)
- Sales Order Outstanding (fulfilment tracking)
- Purchase Order Outstanding (supply chain visibility)
- Reorder Status (procurement triggers)
- Ageing Analysis (medical shops credit assessment)

### Phase 4: Hardening + Multi-Company (Week 7-8)

- Multi-company iteration
- Windows service installer
- Health check HTTP endpoint
- Config hot-reload
- Full reconciliation scheduler (catch AlterID drift)
- Write-back lifecycle (alter, cancel orders)
- Error alerting (webhook/email)
- Compression and bandwidth optimization
- Retry queue with dead-letter handling

---

## 8. REFINED RISK REGISTER

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Stockist has old Tally.ERP 9, not TallyPrime | High | No JSON support, slight XML format differences | Version detection in profile phase. Both formats supported. |
| TDL customizations break standard XML templates | Medium | Write-back fails | Adaptive push with error inspection + retry |
| UDFs are critical for business but unnamed (TDL not loaded) | Medium | Lose field semantics | Store by index, allow manual mapping in onboarding UI |
| Tally freezes during large export | High | Blocks stockist's data entry | Aggressive batching (50/request import, daily export), off-hours scheduling |
| Sales guy creates order for stock item that doesn't exist in Tally | Medium | Write-back fails | Pre-validation against cached stock items. Only show available items in sales app. |
| Party ledger name mismatch (typo, different format) | High | Write-back fails | Fuzzy match against cached ledgers. Auto-create if no match and auto_create_ledgers=true. |
| GST calculation mismatch between app and Tally | Medium | Voucher totals don't match | Option 1: Let Tally compute GST (omit tax lines, not always possible). Option 2: Pull GST rates from stock item master and compute identically. |
| Stock position in central DB drifts from Tally | Medium | Sales guy sees wrong stock levels | Periodic Stock Summary report sync overrides computed positions. Central DB stores Tally-reported position as source of truth. |
| Network failure between connector and central API | Medium | Orders don't sync | Local SQLite push queue with automatic retry. Orders still in Tally regardless. |
| Concurrent modification: order pushed while stockist editing in Tally | Low | Voucher number conflict | Use unique prefix for field orders. Let Tally auto-number within type. |
| Financial year transition: company split mid-usage | Low | Connector loses track of company | Profile re-discovery on startup. Alert on company GUID change. |

---

## 9. OPEN QUESTIONS (REDUCED)

1. **TallyPrime version**: Can we mandate TallyPrime 7.0+ for JSON support, or must we support ERP 9? (Affects complexity significantly)
2. **Multi-company**: Does the stockist run multiple companies per-state in the same Tally instance?
3. **TDL plugin willingness**: Can we ship a small TDL for on-save notifications (push-based rather than poll-based change detection)? This would dramatically reduce polling overhead and improve real-time sync.
4. **Tally Gold vs Silver**: Multi-user (Gold) needed if the connector is a concurrent user. If Silver (single-user), the connector competes with the human operator.
5. **Stockist IT maturity**: Can they manage a Windows service install, or do we need a zero-config installer with tray icon?
