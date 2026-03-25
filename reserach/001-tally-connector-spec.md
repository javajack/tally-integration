# TALLY CONNECTOR — Full Integration Specification

## VERSION: 0.1-DRAFT | DATE: 2026-03-25

---

## 1. EXECUTIVE CONTEXT

Build a local sidecar connector (Go/Rust) that sits on the same Windows machine as TallyPrime, extracts **all** inventory-relevant data via Tally's native interfaces, caches into local SQLite, and pushes upstream to a centralised Go/Rust API backed by RDS PostgreSQL.

**Use-case lens**: Medical supply distributor (stockist) in Gujarat powering a field sales fleet via the centralised database. But the connector itself is use-case agnostic — it must extract the complete inventory data layer from Tally so any downstream application can consume it.

**Invariant**: Technical integration correctness first. The connector must be a complete, faithful mirror of Tally's inventory data model.

---

## 2. HOW TALLY CAN BE INTEGRATED — ALL KNOWN INTERFACES

### 2.1 XML-over-HTTP (PRIMARY — recommended for connector)

| Aspect | Detail |
|--------|--------|
| Protocol | HTTP POST to `http://<tally-ip>:<port>` (default port 9000) |
| Request format | XML envelope: `<ENVELOPE><HEADER>...</HEADER><BODY>...</BODY></ENVELOPE>` |
| Response format | XML (UTF-8 default, UTF-16 for special chars like ₹, €) |
| Operations | Export (pull data), Import (push data), Execute (trigger actions) |
| Auth | None built-in — Tally trusts localhost. Network-level restriction only. |
| Prerequisite | TallyPrime running, HTTP server enabled in F1 > Settings > Advanced Config, at least one company loaded |
| Bidirectional | Yes — full read AND write capability |
| JSON support | TallyPrime 7.0+ supports native JSON format alongside XML (same HTTP endpoint) |

**Why this is the primary interface**: Direct programmatic access to every master, voucher, collection, and report in Tally. No TDL customisation needed for standard data. Supports both pull (export) and push (import). Battle-tested by the entire Tally integration ecosystem.

**Request types**:
- `TALLYREQUEST=Export, TYPE=Data` — Pull master/object data
- `TALLYREQUEST=Export, TYPE=Collection` — Pull collection data (lists of objects)
- `TALLYREQUEST=Export, TYPE=Function` — Evaluate TDL functions and return result
- `TALLYREQUEST=Import, TYPE=Data` — Push master/voucher data into Tally
- `TALLYREQUEST=Execute, TYPE=TDLAction` — Trigger an action (e.g., sync)

### 2.2 ODBC Interface

| Aspect | Detail |
|--------|--------|
| Driver | TallyODBC64_9000 (installed with TallyPrime) |
| SQL support | Built-in SQL processor, SELECT queries on collections |
| Available tables | Only collections explicitly exposed via `IsODBCTable` attribute |
| Default exposed | Ledger, StockItem, Voucher (basic subset) |
| Extending | Requires TDL to expose additional collections/methods |
| Direction | Read-only from external apps; Tally can also act as ODBC client to pull from external DBs |

**Verdict for our use-case**: Good for ad-hoc queries and BI tool connectivity (Power BI, Excel). NOT suitable as the primary connector interface because: (a) limited default table exposure, (b) extending requires TDL development, (c) read-only for external consumers, (d) no built-in change detection.

### 2.3 TDL (Tally Definition Language) Customisation

| Aspect | Detail |
|--------|--------|
| What it is | Tally's native scripting/extension language |
| Deployment | `.tdl` or `.tcp` files loaded into Tally's TDL directory |
| Capabilities | Custom reports, UI modifications, event hooks, new collections, auto-export triggers |
| Relevance | Can create custom ODBC tables, trigger exports on voucher save, add computed fields |

**Verdict**: Useful as an ENHANCEMENT layer on top of XML-over-HTTP. E.g., a TDL that auto-triggers an HTTP callback to our connector when a voucher is saved (push-based notification). Not the primary integration path.

### 2.4 File-based Import/Export

| Aspect | Detail |
|--------|--------|
| Formats | XML, JSON (7.0+), Excel (4.0+) |
| Mechanism | Tally reads from / writes to local filesystem |
| Trigger | Manual (Gateway > Import/Export) or TDL-automated |

**Verdict**: Fallback only. No real-time capability. Useful for initial bulk migration.

### 2.5 Tally.NET Sync (Native Branch Synchronisation)

| Aspect | Detail |
|--------|--------|
| Purpose | Multi-branch data sync between TallyPrime instances |
| Mechanism | Client-server via Tally.NET cloud or direct IP |
| Track changes | Uses CreationID (CID) and AlterationID (AID) internally |
| Relevance | Designed for Tally-to-Tally sync, not for external systems |

**Verdict**: Not directly usable, but the CID/AID mechanism is instructive — Tally does maintain internal change tracking that we can leverage via XML API.

### 2.6 Third-party Platforms

| Platform | Approach | Notes |
|----------|----------|-------|
| CData ODBC/JDBC drivers | Commercial driver wrapping Tally's native interfaces | Expensive, adds dependency |
| tally-database-loader (OSS) | Node.js, XML-over-HTTP → SQL Server/PostgreSQL/MySQL/BigQuery | Best reference implementation — 500+ stars |
| TallyConnector (C#, OSS) | C# library abstracting XML construction/parsing | Good reference for XML request templates |
| tally-integration (Python, PyPI) | Python client for XML API with TDL extensions | Experimental TDL-based deep integration |
| API2Books | Commercial SaaS, TDL plugin + cloud relay | Managed GET/POST API, subscription-based |
| Suvit / AI Accountant | Commercial, AlterID-based incremental sync | Targets CA/accounting firms |

---

## 3. RECOMMENDED ARCHITECTURE

```
┌────────────────────────────────────────────────────────┐
│  STOCKIST'S WINDOWS MACHINE                            │
│                                                        │
│  ┌──────────┐    HTTP/XML     ┌───────────────────┐   │
│  │TallyPrime├───────────────►│ Tally Connector    │   │
│  │ :9000    │◄───────────────┤ (Go binary)        │   │
│  │          │                │                     │   │
│  │ Company  │                │ ┌─────────────────┐ │   │
│  │ loaded   │                │ │ SQLite cache    │ │   │
│  └──────────┘                │ │ (local mirror)  │ │   │
│                              │ └────────┬────────┘ │   │
│                              └──────────┼──────────┘   │
└─────────────────────────────────────────┼──────────────┘
                                          │ HTTPS
                                          ▼
                              ┌────────────────────────┐
                              │ CENTRAL API SERVER     │
                              │ (Go/Rust + RDS PG)     │
                              │                        │
                              │ ┌────────────────────┐ │
                              │ │ PostgreSQL (RDS)   │ │
                              │ │ - multi-tenant     │ │
                              │ │ - all companies    │ │
                              │ └────────────────────┘ │
                              │                        │
                              │ REST API / gRPC        │
                              └───────────┬────────────┘
                                          │
                              ┌───────────┴────────────┐
                              │ DOWNSTREAM CONSUMERS   │
                              │ - Sales fleet app      │
                              │ - CRM / order mgmt     │
                              │ - Reporting dashboards  │
                              │ - Inventory alerts      │
                              └────────────────────────┘
```

### 3.1 Why Go for the local connector

- Single static binary — no runtime dependencies on the Windows machine
- Excellent HTTP client for talking to Tally's XML API
- Built-in SQLite via `modernc.org/sqlite` (pure Go, no CGO)
- Cross-compiles to Windows from Linux/Mac CI
- Small footprint, runs as Windows service or tray app
- You already know Go well from the directory scanner tool

### 3.2 Why SQLite as local cache

- Zero-config, file-based — lives next to the connector binary
- Acts as a resilient buffer if upstream API is unreachable
- Enables incremental diff computation locally
- Allows the connector to serve local queries even when offline
- Familiar from the CA document parsing work

---

## 4. TALLY DATA MODEL — COMPLETE INVENTORY LAYER

### 4.1 Master Data (relatively static, changes infrequently)

#### 4.1.1 Company
```
mst_company
├── guid                    VARCHAR(64) PK
├── name                    TEXT
├── formal_name             TEXT
├── address                 TEXT
├── state                   TEXT
├── pincode                 TEXT
├── phone                   TEXT
├── email                   TEXT
├── gstin                   TEXT
├── pan                     TEXT
├── financial_year_from     DATE
├── financial_year_to       DATE
├── books_from              DATE
├── currency_name           TEXT
├── is_inventory_on         BOOLEAN
├── is_multi_godown         BOOLEAN
├── is_batch_enabled        BOOLEAN
├── is_bill_of_materials    BOOLEAN
├── is_cost_tracking        BOOLEAN
├── is_order_enabled        BOOLEAN
├── alter_id                INTEGER        -- change detection
└── master_id               INTEGER
```

#### 4.1.2 Stock Group
```
mst_stock_group
├── guid                    VARCHAR(64) PK
├── name                    TEXT
├── parent                  TEXT           -- hierarchy
├── narration               TEXT
├── alter_id                INTEGER
└── master_id               INTEGER
```

#### 4.1.3 Stock Category
```
mst_stock_category
├── guid                    VARCHAR(64) PK
├── name                    TEXT
├── parent                  TEXT           -- hierarchy
├── alter_id                INTEGER
└── master_id               INTEGER
```

#### 4.1.4 Stock Item (CRITICAL — the core inventory master)
```
mst_stock_item
├── guid                    VARCHAR(64) PK
├── name                    TEXT
├── alias                   TEXT
├── part_number             TEXT
├── parent                  TEXT           -- stock group
├── category                TEXT           -- stock category
├── base_units              TEXT           -- UoM (pcs, kg, box, etc.)
├── additional_units        TEXT           -- alternate UoM
├── conversion              DECIMAL        -- alternate unit conversion factor
├── opening_balance_qty     DECIMAL
├── opening_balance_rate    DECIMAL
├── opening_balance_value   DECIMAL
├── closing_balance_qty     DECIMAL        -- computed
├── closing_balance_value   DECIMAL        -- computed
├── standard_cost           DECIMAL
├── standard_selling_price  DECIMAL
├── costing_method          TEXT           -- FIFO/LIFO/Avg/etc.
├── market_valuation_method TEXT
├── is_batch_enabled        BOOLEAN
├── has_mfg_date            BOOLEAN
├── has_expiry_date         BOOLEAN
├── reorder_level           DECIMAL
├── reorder_quantity        DECIMAL
├── minimum_order_qty       DECIMAL
├── gst_type_of_supply      TEXT           -- Goods / Services
├── gst_hsn_code            TEXT
├── gst_taxability          TEXT
├── gst_igst_rate           DECIMAL
├── gst_cgst_rate           DECIMAL
├── gst_sgst_rate           DECIMAL
├── gst_cess_rate           DECIMAL
├── description             TEXT
├── narration               TEXT
├── alter_id                INTEGER
├── master_id               INTEGER
├── _synced_at              TIMESTAMP      -- connector metadata
└── _upstream_pushed        BOOLEAN        -- connector metadata
```

**Medical supply specifics**: HSN codes for pharma products, batch/expiry tracking (mandatory for medicines), reorder levels for critical supplies.

#### 4.1.5 Stock Item Standard Price (price list / price levels)
```
mst_stock_item_standard_price
├── item_name               TEXT FK
├── date                    DATE
├── rate                    DECIMAL
└── price_level             TEXT           -- MRP, Wholesale, Distributor, etc.
```

#### 4.1.6 Stock Item BOM (Bill of Materials)
```
mst_stock_item_bom
├── parent_item             TEXT FK        -- finished good
├── component_item          TEXT FK        -- raw material
├── component_quantity      DECIMAL
├── component_unit          TEXT
├── component_rate          DECIMAL
└── component_value         DECIMAL
```

#### 4.1.7 Godown / Location
```
mst_godown
├── guid                    VARCHAR(64) PK
├── name                    TEXT
├── parent                  TEXT           -- hierarchy (region > warehouse > rack)
├── address                 TEXT
├── has_sub_locations       BOOLEAN
├── alter_id                INTEGER
└── master_id               INTEGER
```

#### 4.1.8 Unit of Measure
```
mst_unit
├── guid                    VARCHAR(64) PK
├── name                    TEXT           -- pcs, kg, box, strip, bottle, etc.
├── formal_name             TEXT
├── is_simple_unit          BOOLEAN
├── base_unit               TEXT           -- for compound units
├── additional_unit         TEXT
├── conversion              DECIMAL
├── alter_id                INTEGER
└── master_id               INTEGER
```

#### 4.1.9 Ledger (accounting masters relevant to inventory)
```
mst_ledger
├── guid                    VARCHAR(64) PK
├── name                    TEXT
├── parent                  TEXT           -- group name
├── primary_group           TEXT           -- Sundry Debtors, Sundry Creditors, etc.
├── opening_balance         DECIMAL
├── closing_balance         DECIMAL
├── gstin                   TEXT
├── state                   TEXT
├── pan                     TEXT
├── address                 TEXT
├── pincode                 TEXT
├── phone                   TEXT
├── email                   TEXT
├── credit_period           INTEGER        -- days
├── credit_limit            DECIMAL
├── bill_credit_period      INTEGER
├── is_revenue              BOOLEAN
├── alter_id                INTEGER
└── master_id               INTEGER
```

**Why ledgers matter for inventory connector**: Party ledgers (Sundry Debtors = customers/medical shops, Sundry Creditors = pharma companies/suppliers) are essential for order management. The medical shop CRM is essentially the Sundry Debtors ledger enriched.

#### 4.1.10 Voucher Type
```
mst_voucher_type
├── guid                    VARCHAR(64) PK
├── name                    TEXT
├── parent                  TEXT           -- base type
├── numbering_method        TEXT
├── is_active               BOOLEAN
├── alter_id                INTEGER
└── master_id               INTEGER
```

#### 4.1.11 Currency
```
mst_currency
├── guid                    VARCHAR(64) PK
├── name                    TEXT
├── formal_name             TEXT
├── symbol                  TEXT
├── decimal_places          INTEGER
├── alter_id                INTEGER
└── master_id               INTEGER
```

### 4.2 Transaction Data (vouchers — high volume, changes frequently)

#### 4.2.1 Voucher Header
```
trn_voucher
├── guid                    VARCHAR(64) PK
├── date                    DATE
├── voucher_type            TEXT           -- Sales, Purchase, Receipt Note, etc.
├── voucher_number          TEXT
├── reference_number        TEXT
├── reference_date          DATE
├── narration               TEXT
├── party_name              TEXT           -- ledger name of counterparty
├── place_of_supply         TEXT           -- GST: state
├── gstin                   TEXT
├── is_invoice              BOOLEAN
├── is_accounting_voucher   BOOLEAN
├── is_inventory_voucher    BOOLEAN
├── is_order_voucher        BOOLEAN        -- CRITICAL: filter out for real stock impact
├── is_cancelled            BOOLEAN
├── is_optional             BOOLEAN
├── entered_by              TEXT
├── altered_by              TEXT
├── altered_on              TIMESTAMP
├── master_id               INTEGER
├── alter_id                INTEGER
├── _synced_at              TIMESTAMP
└── _upstream_pushed        BOOLEAN
```

**CRITICAL INVARIANT**: `is_order_voucher = 1` means Purchase Order / Sales Order — these do NOT affect stock or accounts. Must ALWAYS filter `is_order_voucher = 0` when computing stock levels or financial impacts.

#### 4.2.2 Voucher Accounting Entries
```
trn_accounting
├── guid                    VARCHAR(64) FK → trn_voucher
├── ledger                  TEXT
├── amount                  DECIMAL        -- credit positive, debit negative
├── amount_forex            DECIMAL
├── currency                TEXT
├── cost_centre             TEXT
└── bill_allocations        TEXT           -- JSON array of bill refs
```

#### 4.2.3 Voucher Inventory Entries (CRITICAL)
```
trn_inventory
├── guid                    VARCHAR(64) FK → trn_voucher
├── item                    TEXT           -- stock item name
├── quantity                DECIMAL        -- positive = inward, negative = outward
├── rate                    DECIMAL
├── amount                  DECIMAL
├── actual_quantity          DECIMAL        -- if different from billed qty
├── billed_quantity          DECIMAL
├── godown                  TEXT           -- storage location
├── tracking_number         TEXT           -- delivery/receipt note reference
├── order_number            TEXT           -- linked order reference
├── order_due_date          DATE
└── additional_allocations  TEXT           -- JSON: cost centres, etc.
```

#### 4.2.4 Voucher Batch Allocations
```
trn_batch
├── guid                    VARCHAR(64) FK → trn_voucher
├── item                    TEXT
├── batch_name              TEXT
├── godown                  TEXT
├── quantity                DECIMAL
├── rate                    DECIMAL
├── amount                  DECIMAL
├── mfg_date                DATE
├── expiry_date             DATE
└── tracking_number         TEXT
```

**Medical supply critical**: Batch tracking with expiry dates is MANDATORY for pharmaceutical distribution. This table is essential for FIFO enforcement, expiry alerts, and regulatory compliance.

#### 4.2.5 Voucher Bill Allocations
```
trn_bill
├── guid                    VARCHAR(64) FK → trn_voucher
├── ledger                  TEXT
├── bill_type               TEXT           -- New Ref / Agst Ref / On Account
├── bill_name               TEXT
├── bill_amount             DECIMAL
├── bill_due_date           DATE
└── bill_credit_period      INTEGER
```

#### 4.2.6 Voucher Cost Centre Allocations
```
trn_cost_centre
├── guid                    VARCHAR(64) FK → trn_voucher
├── ledger                  TEXT
├── cost_category           TEXT
├── cost_centre             TEXT
└── amount                  DECIMAL
```

#### 4.2.7 Voucher Bank Allocations
```
trn_bank
├── guid                    VARCHAR(64) FK → trn_voucher
├── ledger                  TEXT
├── transaction_type        TEXT
├── instrument_number       TEXT
├── instrument_date         DATE
├── bank_name               TEXT
├── amount                  DECIMAL
└── status                  TEXT
```

### 4.3 Inventory Voucher Types (complete enumeration)

| Voucher Type | Impact | Description |
|---|---|---|
| **Purchase** | Stock IN + Accounts | Goods received with invoice |
| **Sales** | Stock OUT + Accounts | Goods sold with invoice |
| **Purchase Order** | ORDER ONLY (no stock/accounts) | Commitment to buy |
| **Sales Order** | ORDER ONLY (no stock/accounts) | Commitment to sell |
| **Receipt Note (GRN)** | Stock IN only | Goods received, pending invoice |
| **Delivery Note** | Stock OUT only | Goods dispatched, pending invoice |
| **Stock Journal** | Stock IN/OUT (transfer) | Inter-godown transfer, manufacturing |
| **Manufacturing Journal** | Stock IN (finished) / OUT (raw) | BOM-based production |
| **Physical Stock** | Stock adjustment | Reconciliation with physical count |
| **Rejections In** | Stock IN (return from customer) | Sales return |
| **Rejections Out** | Stock OUT (return to supplier) | Purchase return |
| **Debit Note** | Accounts + optional Stock | Purchase return with accounting |
| **Credit Note** | Accounts + optional Stock | Sales return with accounting |
| **Material Out** | Stock OUT | Job work outward |
| **Material In** | Stock IN | Job work inward |

### 4.4 Computed/Derived Data (Reports to extract)

These are NOT stored as transactions but computed by Tally's reporting engine. The connector should extract these via report-type XML requests:

| Report | Data | Use |
|---|---|---|
| **Stock Summary** | Current stock position per item per godown | Real-time inventory visibility |
| **Stock Ageing Analysis** | Age-wise breakup of closing stock | Expiry management for pharma |
| **Reorder Status** | Items below reorder level | Procurement triggers |
| **Godown Summary** | Stock position per godown | Warehouse management |
| **Batch Summary** | Stock per batch with expiry dates | FIFO enforcement, expiry alerts |
| **Movement Analysis** | Item-wise inward/outward over period | Demand forecasting |
| **Sales Order Outstanding** | Pending sales orders | Fulfilment tracking |
| **Purchase Order Outstanding** | Pending purchase orders | Supply chain tracking |
| **Bills Receivable/Payable** | Outstanding customer/supplier bills | Collection/payment management |

---

## 5. XML REQUEST TEMPLATES — KEY PATTERNS

### 5.1 Export All Stock Items (Collection-based)

```xml
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>StockItemCollection</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
        <SVCURRENTCOMPANY>##CompanyName##</SVCURRENTCOMPANY>
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="StockItemCollection" ISMODIFY="No">
            <TYPE>StockItem</TYPE>
            <FETCH>Name, Parent, Category, BaseUnits, OpeningBalance,
                   OpeningValue, ClosingBalance, ClosingValue,
                   MasterId, AlterId, GUID,
                   GSTDetails.List, BatchAllocations.List,
                   StandardCost, StandardSellingPrice,
                   ReorderLevel, MinimumOrderQty,
                   HasMfgDate, MaintainInBatches</FETCH>
          </COLLECTION>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>
```

### 5.2 Export Vouchers with Inventory Details (Date-range filtered)

```xml
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Data</TYPE>
    <ID>Daybook</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVCURRENTCOMPANY>##CompanyName##</SVCURRENTCOMPANY>
        <SVFROMDATE>##YYYYMMDD##</SVFROMDATE>
        <SVTODATE>##YYYYMMDD##</SVTODATE>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
      </STATICVARIABLES>
    </DESC>
  </BODY>
</ENVELOPE>
```

### 5.3 Export Stock Summary Report

```xml
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Data</TYPE>
    <ID>Stock Summary</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVCURRENTCOMPANY>##CompanyName##</SVCURRENTCOMPANY>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
        <SVFROMDATE>##YYYYMMDD##</SVFROMDATE>
        <SVTODATE>##YYYYMMDD##</SVTODATE>
      </STATICVARIABLES>
    </DESC>
  </BODY>
</ENVELOPE>
```

### 5.4 Import a Sales Voucher (write-back from central system)

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
        <SVCURRENTCOMPANY>##CompanyName##</SVCURRENTCOMPANY>
      </STATICVARIABLES>
    </DESC>
    <DATA>
      <TALLYMESSAGE>
        <VOUCHER VCHTYPE="Sales" ACTION="Create">
          <DATE>20260325</DATE>
          <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
          <PARTYLEDGERNAME>Medical Shop ABC</PARTYLEDGERNAME>
          <PERSISTEDVIEW>Invoice Voucher View</PERSISTEDVIEW>
          <ALLLEDGERENTRIES.LIST>
            <LEDGERNAME>Medical Shop ABC</LEDGERNAME>
            <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
            <AMOUNT>-11800.00</AMOUNT>
          </ALLLEDGERENTRIES.LIST>
          <ALLLEDGERENTRIES.LIST>
            <LEDGERNAME>Sales Account</LEDGERNAME>
            <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
            <AMOUNT>10000.00</AMOUNT>
          </ALLLEDGERENTRIES.LIST>
          <ALLINVENTORYENTRIES.LIST>
            <STOCKITEMNAME>Paracetamol 500mg Strip</STOCKITEMNAME>
            <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
            <RATE>10.00/Strip</RATE>
            <ACTUALQTY>100 Strip</ACTUALQTY>
            <BILLEDQTY>100 Strip</BILLEDQTY>
            <AMOUNT>10000.00</AMOUNT>
            <BATCHALLOCATIONS.LIST>
              <GODOWNNAME>Main Location</GODOWNNAME>
              <BATCHNAME>BATCH-2026-001</BATCHNAME>
              <AMOUNT>10000.00</AMOUNT>
              <ACTUALQTY>100 Strip</ACTUALQTY>
              <BILLEDQTY>100 Strip</BILLEDQTY>
            </BATCHALLOCATIONS.LIST>
          </ALLINVENTORYENTRIES.LIST>
        </VOUCHER>
      </TALLYMESSAGE>
    </DATA>
  </BODY>
</ENVELOPE>
```

---

## 6. CHANGE DETECTION & INCREMENTAL SYNC

### 6.1 Tally's Internal Change Tracking

Every master and voucher in Tally has:
- **MasterID**: Monotonically increasing, assigned on creation. Never changes.
- **AlterID**: Monotonically increasing across ALL objects in the company. Incremented on every create/alter/delete of ANY object.
- **GUID**: Globally unique identifier per object.

The **AlterID** is the key to incremental sync:
- On each sync cycle, record the `LastAlterID` seen
- Next cycle, request only objects where `AlterID > LastAlterID`
- This catches creates, updates, and (via tombstone detection) deletes

### 6.2 Sync Strategy

```
FULL SYNC (first run or recovery):
  1. Pull ALL masters (stock items, godowns, ledgers, units, etc.)
  2. Pull ALL vouchers (batched by date range to avoid Tally RAM issues)
  3. Store everything in SQLite with alter_id
  4. Record max(alter_id) as watermark

INCREMENTAL SYNC (subsequent runs):
  1. Query Tally for current max AlterID across all collections
  2. If unchanged from watermark → no changes, skip
  3. If changed → pull objects where AlterID > watermark
  4. Upsert into SQLite
  5. Detect deletions: compare master_ids in SQLite vs Tally's current set
  6. Update watermark
  7. Push deltas to central API

POLLING INTERVAL:
  - Configurable: default 5 minutes for masters, 1 minute for vouchers
  - tally-database-loader warns: batches >5000 vouchers per HTTP request can freeze Tally
  - Use day-by-day batching for large transaction volumes
```

### 6.3 Known Gotchas (from tally-database-loader learnings)

1. **Tally freezes on large exports**: Batch voucher extraction (5000 max per request, or day-by-day)
2. **Tally must be running and company loaded**: Connector must detect and retry
3. **Multi-company**: Need to iterate companies — each is a separate data universe
4. **Incremental sync instability**: The tally-database-loader project notes incremental sync is "not stable" — full sync is the safe default, with incremental as optimisation
5. **Windows-only**: Tally is a Windows desktop app. Connector runs on same machine.
6. **Tally restart resets nothing**: AlterIDs persist across restarts — they're stored in the data file
7. **Date format**: All dates in Tally XML are YYYYMMDD format
8. **Quantities have units embedded**: `"100 pcs"` not `100` — need parsing
9. **Amounts for stock**: Opening/closing values use negative for debit convention

---

## 7. LOCAL SQLITE SCHEMA DESIGN

### 7.1 Metadata Tables

```sql
CREATE TABLE _sync_state (
    company_guid    TEXT PRIMARY KEY,
    company_name    TEXT NOT NULL,
    last_master_alter_id  INTEGER DEFAULT 0,
    last_voucher_alter_id INTEGER DEFAULT 0,
    last_full_sync  TIMESTAMP,
    last_incr_sync  TIMESTAMP,
    last_push_to_central TIMESTAMP,
    tally_host      TEXT DEFAULT 'localhost',
    tally_port      INTEGER DEFAULT 9000
);

CREATE TABLE _sync_log (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    company_guid    TEXT,
    sync_type       TEXT,      -- full / incremental / push
    entity_type     TEXT,      -- masters / vouchers / report
    records_pulled  INTEGER,
    records_pushed  INTEGER,
    duration_ms     INTEGER,
    status          TEXT,      -- success / error
    error_message   TEXT
);

CREATE TABLE _push_queue (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type     TEXT,      -- mst_stock_item / trn_voucher / etc.
    entity_guid     TEXT,
    operation       TEXT,      -- upsert / delete
    payload_json    TEXT,      -- serialised row
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    pushed_at       TIMESTAMP,
    push_status     TEXT,      -- pending / success / error
    retry_count     INTEGER DEFAULT 0,
    error_message   TEXT
);
```

### 7.2 Indexes

```sql
-- Change detection
CREATE INDEX idx_stock_item_alter_id ON mst_stock_item(alter_id);
CREATE INDEX idx_voucher_alter_id ON trn_voucher(alter_id);
CREATE INDEX idx_voucher_date ON trn_voucher(date);
CREATE INDEX idx_voucher_type ON trn_voucher(voucher_type);

-- Inventory lookups
CREATE INDEX idx_inventory_item ON trn_inventory(item);
CREATE INDEX idx_inventory_godown ON trn_inventory(godown);
CREATE INDEX idx_batch_item ON trn_batch(item);
CREATE INDEX idx_batch_expiry ON trn_batch(expiry_date);

-- Push queue
CREATE INDEX idx_push_queue_status ON _push_queue(push_status);
```

---

## 8. CONNECTOR BINARY — GO MODULE STRUCTURE

```
tally-connector/
├── cmd/
│   └── tally-connector/
│       └── main.go               -- entry point, CLI flags, Windows service
├── internal/
│   ├── tally/
│   │   ├── client.go             -- HTTP client for Tally XML API
│   │   ├── xml_builder.go        -- construct XML request envelopes
│   │   ├── xml_parser.go         -- parse XML responses into Go structs
│   │   ├── collections.go        -- collection-specific fetch logic
│   │   └── types.go              -- Go structs mirroring Tally objects
│   ├── cache/
│   │   ├── sqlite.go             -- SQLite operations
│   │   ├── schema.go             -- DDL and migrations
│   │   └── upsert.go             -- smart upsert with change detection
│   ├── sync/
│   │   ├── engine.go             -- orchestrates full/incremental sync
│   │   ├── masters.go            -- master data sync logic
│   │   ├── vouchers.go           -- voucher sync with batching
│   │   ├── reports.go            -- computed report extraction
│   │   └── change_detect.go      -- AlterID-based delta detection
│   ├── push/
│   │   ├── client.go             -- HTTP client for central API
│   │   ├── queue.go              -- push queue management
│   │   └── retry.go              -- exponential backoff retry
│   └── config/
│       └── config.go             -- YAML/TOML config loading
├── configs/
│   └── default.toml              -- default configuration
├── scripts/
│   └── install-service.ps1       -- Windows service installer
└── go.mod
```

### 8.1 Configuration

```toml
[tally]
host = "localhost"
port = 9000
company = ""                       # blank = active company

[sync]
master_interval_seconds = 300      # 5 min
voucher_interval_seconds = 60      # 1 min
report_interval_seconds = 900      # 15 min
voucher_batch_size = 5000          # max per HTTP request
date_batch_mode = "daily"          # daily | monthly | all
full_sync_on_start = true

[cache]
sqlite_path = "./tally-cache.db"

[central]
api_url = "https://api.example.com"
api_key = "..."
tenant_id = "stockist-001"
push_interval_seconds = 30
max_retries = 5

[logging]
level = "info"
file = "./tally-connector.log"
```

---

## 9. CENTRAL API — POSTGRESQL SCHEMA SKETCH

### 9.1 Multi-tenancy

Each Tally company maps to a `tenant_id`. The central PostgreSQL uses schema-per-tenant or `tenant_id` column strategy.

```sql
-- Tenant registry
CREATE TABLE tenants (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,
    tally_company   TEXT,
    tally_guid      TEXT UNIQUE,
    region          TEXT,              -- "Gujarat-Ahmedabad", "Gujarat-Surat"
    status          TEXT DEFAULT 'active',
    created_at      TIMESTAMPTZ DEFAULT now()
);

-- All master/transaction tables include:
--   tenant_id UUID REFERENCES tenants(id)
--   tally_guid TEXT                    -- original GUID from Tally
--   tally_alter_id INTEGER             -- for debugging sync issues
--   synced_at TIMESTAMPTZ              -- when connector last pushed this
--   UNIQUE(tenant_id, tally_guid)      -- compound uniqueness
```

### 9.2 API Endpoints (for sales fleet app)

```
GET  /api/v1/stock-items?godown=&category=&search=
GET  /api/v1/stock-items/:id/batches?exclude_expired=true
GET  /api/v1/stock-items/:id/availability
GET  /api/v1/stock-summary?godown=&as_of=
GET  /api/v1/godowns
GET  /api/v1/parties?type=sundry_debtors&territory=
GET  /api/v1/parties/:id/outstanding
GET  /api/v1/parties/:id/order-history
POST /api/v1/orders                       -- sales order from field
GET  /api/v1/orders?status=&party=
GET  /api/v1/orders/:id
POST /api/v1/orders/:id/confirm           -- push to Tally as Sales Order
GET  /api/v1/expiry-alerts?days_ahead=30
GET  /api/v1/reorder-alerts
GET  /api/v1/sync-status                  -- health of connector sync
```

---

## 10. WHAT INDUSTRY DOES TODAY — LANDSCAPE SUMMARY

### 10.1 OSS Reference: tally-database-loader

The gold standard open-source reference. Key design decisions:
- Node.js based, configurable YAML-driven field mapping
- Full sync (default) and experimental incremental sync
- Supports PostgreSQL, MySQL, SQL Server, BigQuery, CSV, JSON, Azure Data Lake
- Voucher batching (5000 per request) to prevent Tally freeze
- Company auto-detection or explicit config
- Ping-based change monitoring (polls Tally every N minutes)
- Database schema: 7 master tables + 7 transaction tables

### 10.2 Commercial Players

| Player | Model | Notes |
|---|---|---|
| **API2Books** | TDL plugin + SaaS relay | JSON-based GET/POST, subscription per-company |
| **CData** | ODBC/JDBC/ADO.NET drivers | Enterprise pricing, SQL-based access |
| **Suvit** | Cloud accounting automation | Auto-sync with Tally, targets CAs |
| **AI Accountant** | AlterID-based sync + AI classification | SOC 2, CA firm focused |
| **EasyReports** | Database connector + Power BI | Background sync to SQL Server |
| **New Access Technologies** | Custom integration services | Bangalore-based, project-based pricing |

### 10.3 Common Patterns Across All

1. **XML-over-HTTP is universal** — every serious integration uses this as the primary interface
2. **AlterID for change detection** — the only reliable mechanism
3. **Batching is essential** — large exports crash Tally
4. **TDL plugins optional but helpful** — for push notifications, custom collections, enhanced ODBC tables
5. **Full sync as fallback** — incremental is optimisation, not the source of truth
6. **Tally must be running** — no offline extraction possible (data files are proprietary binary)
7. **Multi-company iteration** — connector must handle multiple companies in one Tally instance
8. **JSON is the future** — TallyPrime 7.0+ native JSON, but XML still required for backward compat

---

## 11. RISK REGISTER

| Risk | Impact | Mitigation |
|---|---|---|
| Tally not running when connector polls | Missed sync window | Retry with backoff, alert, queue locally |
| Large company data freezes Tally | Data entry blocked during sync | Off-hours sync, aggressive batching, day-by-day mode |
| AlterID-based incremental misses deletes | Stale data in central DB | Periodic full reconciliation (daily/weekly) |
| Network outage to central API | Data not available to field | Push queue with local persistence, eventual consistency |
| Tally version differences (ERP 9 vs Prime) | XML response format variations | Version detection, format adapters |
| Multi-company GUID collisions | Data corruption | Compound key: (tenant_id, tally_guid) |
| Medical batch/expiry data missing | Regulatory risk | Validate batch completeness, alert on missing expiry dates |
| Concurrent Tally data entry during sync | Inconsistent snapshot | Accept eventual consistency, rely on AlterID ordering |

---

## 12. IMPLEMENTATION PHASES

### Phase 1: Foundation (Week 1-2)
- Go project scaffold with Windows cross-compilation
- Tally HTTP client with connection test
- XML request builder for 3 core collections: StockItem, Godown, Ledger
- XML response parser
- SQLite schema creation and basic upsert

### Phase 2: Complete Masters (Week 3)
- All master collections: StockGroup, StockCategory, Unit, VoucherType, Currency, BOM, PriceList
- AlterID watermark tracking
- Full sync cycle for masters

### Phase 3: Vouchers (Week 4-5)
- Voucher extraction with date-range batching
- Parse all sub-tables: accounting, inventory, batch, bill, cost centre, bank
- Incremental sync via AlterID
- Handle the order-voucher flag correctly

### Phase 4: Reports (Week 5-6)
- Stock Summary extraction
- Batch Summary with expiry dates
- Reorder Status
- Outstanding Orders (Sales/Purchase)

### Phase 5: Central Push (Week 6-7)
- Push queue implementation
- Central API client with retry logic
- Compressed JSON payload
- Sync status reporting

### Phase 6: Hardening (Week 8)
- Windows service installer
- Health check endpoint (local HTTP for monitoring)
- Configuration hot-reload
- Error alerting (webhook/email)
- Full sync reconciliation scheduler

---

## 13. OPEN QUESTIONS

1. **TallyPrime version target**: Are stockists on TallyPrime (latest) or still Tally.ERP 9? Affects JSON support and XML response formats.
2. **Write-back scope**: Does the sales fleet need to push Sales Orders BACK into Tally? If yes, the connector needs import capability (Phase 2 extension).
3. **Multi-company**: Does a single stockist run multiple companies in Tally (e.g., per-state GST registration)?
4. **TDL plugin appetite**: Will stockists accept loading a custom TDL for push notifications / enhanced ODBC? Or must the connector be purely external?
5. **Tally Gold vs Silver**: Multi-user (Gold) vs single-user (Silver) affects whether the connector competes for Tally's single-user lock.
6. **Historical data depth**: How far back should the initial full sync go? Full financial year? Multiple years?
