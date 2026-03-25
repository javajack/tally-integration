# TALLY CONNECTOR — Garment/Clothing Business Vertical Addendum

## VERSION: 0.5-GARMENTS | DATE: 2026-03-26

---

## 1. THE FUNDAMENTAL GARMENT PROBLEM IN TALLY

**Tally has NO native size-color matrix.** This is the single most important thing to understand. A shirt in 5 colours and 6 sizes is 30 SKUs. Tally treats each as a completely separate Stock Item, or uses workarounds involving Stock Groups + Stock Categories + Batches + Godowns in creative combinations. There is NO built-in "variant" concept like Shopify or an ERP system.

This means garment businesses in Tally use one of **four approaches**, and you WILL encounter all of them across different stockists:

### Approach 1: Flat SKU Explosion (most common for small retailers/wholesalers)

Every size-color combination is a separate Stock Item:

```
Stock Items:
  "Cotton Shirt Blue S"
  "Cotton Shirt Blue M"
  "Cotton Shirt Blue L"
  "Cotton Shirt Blue XL"
  "Cotton Shirt Red S"
  "Cotton Shirt Red M"
  ... (30 items for one design)
```

**Stock Group hierarchy encodes the parent design:**
```
Stock Groups:
├── Men's Wear
│   ├── Shirts
│   │   ├── Cotton Shirt Design-A     ← Design group
│   │   │   ├── Cotton Shirt Blue S   ← Stock Items (leaves)
│   │   │   ├── Cotton Shirt Blue M
│   │   │   └── ...
│   │   └── Linen Shirt Design-B
│   └── Trousers
├── Women's Wear
└── Kids' Wear
```

**Connector implication**: The "design" or "style" is encoded as a Stock Group, not a Stock Item attribute. To reconstruct the size-color matrix, you must: group Stock Items by their parent Stock Group, then parse size and color tokens from the item name.

### Approach 2: Stock Category for Cross-Cutting Dimension

Stock Group = Product Type. Stock Category = another dimension (color family, price range, or season):

```
Stock Groups:             Stock Categories:
├── Shirts               ├── Summer 2025
├── Trousers             ├── Winter 2025
├── Kurtas               ├── Festive Collection
└── Jeans                └── Clearance

An item belongs to BOTH a group AND a category:
  "Blue Denim Jeans 32" → Group: Jeans, Category: Winter 2025
```

This is Tally's recommended approach per the TallyHelp docs, where items priced at ₹500 and ₹900 span across Cotton and Synthetic groups. For garments, it's often Season + Product Type.

### Approach 3: Batch as Size-Color Carrier (used by garment TDL addons)

The ITEM is the design/style. Size and color are encoded in the BATCH NAME:

```
Stock Item: "Cotton Shirt Design-A"  (single item, not 30)
Batches:
  "Blue-S", "Blue-M", "Blue-L", "Blue-XL"
  "Red-S", "Red-M", "Red-L", "Red-XL"
  "White-S", "White-M", "White-L", "White-XL"
```

Each batch has its own quantity, so you track per size-color. This is the approach used by TDLStore's "Garment Billing" TDL and TallyPlanet's "Garment Module".

**Critical for connector**: When this approach is used, the `trn_batch` table becomes the SIZE-COLOR-QUANTITY matrix. The `batch_name` field encodes size+color. You must parse it:

```
BATCH NAME PATTERNS:
  "Blue-S"                    → {color: "Blue", size: "S"}
  "RED/M"                     → {color: "RED", size: "M"}
  "BLU S"                     → {color: "BLU", size: "S"}
  "32-Black"                  → {size: "32", color: "Black"}
  "L-WHT"                     → {size: "L", color: "WHT"}
  "BLUE_S_MRP450"             → {color: "BLUE", size: "S", mrp: 450}
  "B-S"                       → ambiguous (B=Blue? Black? Brown?)
```

### Approach 4: UDF-Based Variants (garment TDL customizations)

The garment TDL adds UDFs to the Stock Item or to the Voucher Inventory Entry:

```xml
<!-- UDFs on Stock Item -->
<COLOUR.LIST TYPE="String" Index="30">
  <COLOUR>Blue</COLOUR>
</COLOUR.LIST>
<SIZE.LIST TYPE="String" Index="31">
  <SIZE>M</SIZE>
</SIZE.LIST>
<DESIGNNO.LIST TYPE="String" Index="32">
  <DESIGNNO>DSN-2025-042</DESIGNNO>
</DESIGNNO.LIST>

<!-- OR UDFs on Voucher Inventory Entry (size-wise billing) -->
<!-- Garment billing TDLs add columns for each size directly in the invoice -->
<!-- Size quantities appear as aggregate UDFs on the inventory allocation -->
```

The TDLStore garment TDL specifically adds "Size Wise new columns" in Sales/Purchase vouchers — these are aggregate UDFs with individual size quantities (S, M, L, XL, XXL, etc.) as separate fields within the voucher line.

---

## 2. GARMENT-SPECIFIC NAMING CONVENTIONS

### 2.1 Stock Item Names

```
PATTERN 1 — DESIGN + COLOR + SIZE (flat SKU):
  "Polo T-Shirt Blue M"
  "POLO T-SHIRT BLU M"
  "PT-BLU-M"                      ← Ultra-abbreviated
  "Polo Tee | Blue | Medium"      ← Pipe-separated
  "DSN042-BLU-M"                  ← Design number prefix

PATTERN 2 — BRAND + DESIGN + ATTRIBUTES:
  "Allen Solly Formal Shirt White 40"    ← Brand + type + color + size (chest inches)
  "Levi's 511 Slim 32x32 Indigo"        ← Brand + cut + waist×length + color
  "FabIndia Kurta Cotton Blue L"

PATTERN 3 — DESIGN NUMBER ONLY:
  "DSN-042"                       ← Just design number, everything else in UDFs
  "Style# 2025-A042"             ← Style number
  "Art. 55832"                    ← Article number (common in wholesale)

PATTERN 4 — WITH FABRIC/MATERIAL:
  "Cotton Shirt Design-A Blue M"
  "Polyester Blend Trouser Black 32"
  "Silk Saree Banarasi Red"
  "Denim Jacket Washed Blue L"

PATTERN 5 — WITH LOT/BUNDLE:
  "Lot-25 Printed Kurti Assorted"     ← Assorted = mixed colors/sizes
  "Bundle-100 T-Shirt Mixed L"       ← Bundle of 100 pieces
```

### 2.2 Size Tokens (Indian garment market)

```
STANDARD LETTER SIZES:
  XS, S, M, L, XL, XXL, XXXL, 2XL, 3XL, 4XL, 5XL
  Also: FS (Free Size), ONESIZE, FREE

NUMERIC SIZES (CHEST/WAIST INCHES):
  Shirts: 38, 39, 40, 42, 44, 46, 48
  Trousers: 28, 30, 32, 34, 36, 38, 40
  Jeans: 28, 29, 30, 31, 32, 33, 34, 36

KIDS' SIZES:
  1-2Y, 2-3Y, 3-4Y, 4-5Y, 6-8Y, 8-10Y, 10-12Y, 12-14Y
  Also: "0", "1", "2" ... "16" (age-based)
  Also: 16, 18, 20, 22, 24, 26, 28 (garment measurement)

INDIAN TRADITIONAL (sarees, lehengas):
  By meters: "5.5m", "6m", "6.25m"
  By type: "Running", "Cut Piece", "Thaan" (full bolt)

FOOTWEAR:
  IND 6, IND 7, IND 8, IND 9, IND 10
  UK 6, UK 7, UK 8 ... UK 12
  Sometimes just: 6, 7, 8, 9, 10
```

**Size token regex for extraction from item names**:
```
/\b(XS|S|M|L|XL|XXL|XXXL|[2-5]XL|FS|FREE\s*SIZE|ONESIZE)\b/i
/\b(2[6-9]|3[0-9]|4[0-9])\b/    ← numeric 26-49 (chest/waist)
/\b(\d{1,2}-\d{1,2}Y)\b/          ← kids age range
```

### 2.3 Color Tokens

```
FULL NAMES:
  Black, White, Blue, Red, Navy, Green, Grey, Pink, Yellow,
  Maroon, Beige, Brown, Cream, Orange, Purple, Wine, Teal,
  Olive, Khaki, Rust, Peach, Coral, Mint, Lavender, Mustard

COMMON ABBREVIATIONS:
  BLK, WHT, BLU, RED, NVY, GRN, GRY, PNK, YLW,
  MRN, BGE, BRN, CRM, ORG, PUR, WNE, TL, OLV, KHK

FABRIC-SPECIFIC (denim/jeans):
  "Indigo", "Dark Wash", "Light Wash", "Stone Wash", "Raw", "Acid Wash"
  "Rinsed", "Faded", "Distressed"

PATTERN/PRINT:
  "Striped Blue", "Check Red", "Printed Floral", "Solid Navy"
  "Plaid", "Paisley", "Abstract", "Geometric"

MULTI-COLOR:
  "Blue/White", "Black & Red", "Multicolor", "Assorted"
```

### 2.4 Stock Group Hierarchy (typical garment wholesaler)

```
PRIMARY GROUPS:
├── Men's Wear
│   ├── Formal Shirts
│   ├── Casual Shirts
│   ├── T-Shirts
│   ├── Formal Trousers
│   ├── Jeans
│   ├── Kurtas
│   └── Innerwear
├── Women's Wear
│   ├── Sarees
│   ├── Kurtis / Kurtas
│   ├── Lehengas
│   ├── Tops & Tunics
│   ├── Salwar Suits
│   └── Western Wear
├── Kids' Wear
│   ├── Boys
│   └── Girls
├── Accessories
│   ├── Belts
│   ├── Ties
│   └── Scarves
├── Fabrics / Piece Goods     ← Raw material for manufacturers
│   ├── Cotton Fabric
│   ├── Polyester Fabric
│   └── Silk Fabric
└── Packing Materials
    ├── Poly Bags
    ├── Cartons
    └── Tags & Labels
```

**Some wholesalers organize by BRAND instead**:
```
├── Allen Solly
├── Peter England
├── Van Heusen
├── Raymond
├── Levi's
├── Local / Unbranded
└── ...
```

**Some organize by SEASON/COLLECTION**:
```
├── Summer 2025
├── Winter 2025
├── Festive Diwali 2025
├── Wedding Collection
├── Clearance / Dead Stock
└── ...
```

### 2.5 Unit of Measure Patterns

```
SIMPLE UNITS:
  Pcs, Nos, Nos., pcs, nos     ← Pieces (most common for readymade)
  Mtr, mtr, Meter, Mtrs        ← Meters (for fabric/cloth)
  Kg, kg                        ← Kilograms (for hosiery, yarn)
  Pairs                         ← Footwear, socks
  Sets                          ← Suit sets (kurta + pyjama)
  Dozen, Dz, Dzn               ← Wholesale (12 pieces)

COMPOUND UNITS:
  "Bundle of 6 Pcs"            ← Wholesale bundle
  "Box of 10 Pcs"
  "Thaan of 40 Mtr"            ← Fabric bolt (thaan = bolt in Hindi)
  "Bale of 50 Pcs"             ← Bale (common in textile trade)
  "Carton of 100 Pcs"
  "Dozen of 12 Pcs"
  "Score of 20 Pcs"            ← Score (20 pieces, used in some markets)

SPECIAL:
  "Running Meter" / "RMtr"     ← Fabric sold by continuous length
  "Square Meter" / "SqM"       ← Some technical fabrics
```

### 2.6 Godown/Location Patterns

```
FOR WHOLESALE:
  "Showroom", "Warehouse", "Godown No.1", "Godown No.2"
  "Gandhi Nagar Warehouse"     ← Delhi textile hub
  "Surat Godown"               ← Gujarat textile hub
  "In Transit - Delhi"
  "In Transit - Surat"

FOR MANUFACTURER:
  "Raw Material Store"
  "Cutting Section"
  "Stitching Floor"
  "Finishing / QC"
  "Packed Goods"
  "Dispatch Area"
  "Rejected / Defective"
  "Job Work - External"

FOR RETAILER:
  "Shop Floor", "Back Store", "Window Display"
  "Branch - Ahmedabad"
  "Branch - Surat"
  "Alteration Pending"
  "Customer Returns"
```

---

## 3. GARMENT-SPECIFIC EDGE CASES

### 3.1 The Size Matrix Reconstruction Problem

Given flat SKU items, you need to reconstruct the size-color matrix for the sales app. The algorithm:

```
INPUT: Stock items under a common parent group
  "Polo T-Shirt Blue S"     qty: 50
  "Polo T-Shirt Blue M"     qty: 75
  "Polo T-Shirt Blue L"     qty: 40
  "Polo T-Shirt Red S"      qty: 30
  "Polo T-Shirt Red M"      qty: 60
  "Polo T-Shirt Red L"      qty: 25

STEP 1: Identify the "base design name" by stripping size and color tokens
  "Polo T-Shirt" (strip "Blue", "Red", "S", "M", "L")

STEP 2: Extract size and color for each item
  → {item: "...Blue S", color: "Blue", size: "S", qty: 50}
  → {item: "...Blue M", color: "Blue", size: "M", qty: 75}
  ...

STEP 3: Build matrix
  OUTPUT:
  {
    design: "Polo T-Shirt",
    group: "T-Shirts",
    matrix: {
      "Blue":  {"S": 50, "M": 75, "L": 40},
      "Red":   {"S": 30, "M": 60, "L": 25}
    },
    total: 280
  }
```

**The problem**: Name parsing is UNRELIABLE. `"Blue"` could be part of the design name (`"Blue Mountain Shirt"`) not a color. `"L"` could be part of a word (`"Long Sleeve Shirt L"` — is L = Large or part of "Long"?).

**Better approach**: Use the Stock Group as the design boundary. All items UNDER the same leaf-level Stock Group are variants of the same design. Then parse size/color as the DIFFERENTIATING suffix between items in the same group.

```
ITEMS IN GROUP "Polo T-Shirt Design-A":
  "Polo T-Shirt Design-A Blue S"
  "Polo T-Shirt Design-A Blue M"
  ...
  Common prefix = "Polo T-Shirt Design-A "
  Differentiating suffixes = ["Blue S", "Blue M", "Red S", ...]
  Split each suffix on space: [color_token, size_token]
```

### 3.2 The "Assorted" and "Mixed" Problem

Garment wholesale frequently deals in assorted lots:

```
"T-Shirt Assorted Colors L"     ← Multiple colors, single size
"T-Shirt Mixed Sizes Blue"      ← Single color, multiple sizes
"Kurti Assorted"                 ← Mixed everything
"Lot-42 Mixed Items"             ← Entire mixed lot purchased as one
```

"Assorted" means the seller doesn't track individual variants — it's a bulk lot. This breaks the size-color matrix completely. The connector must handle these as non-matrix items that can't be broken down.

### 3.3 The Fabric "Running Meter" Problem

Textile traders (cloth merchants) sell fabric by the running meter, not pieces. A single "thaan" (bolt) might be 40 meters. When they sell 5 meters to one customer and 3 meters to another, the remaining 32 meters stays as one item.

**In Tally this looks like**:
```xml
<STOCKITEM NAME="Cotton Cambric White 58inch">
  <BASEUNITS>Mtr</BASEUNITS>
  <OPENINGBALANCE>500 Mtr</OPENINGBALANCE>
  <!-- No size/color variants — it's bulk fabric -->
</STOCKITEM>
```

Fabric items have width (48 inch, 54 inch, 58 inch, 60 inch) encoded in the name, not as a size variant. Width is fixed for a fabric type.

### 3.4 The "MRP vs Wholesale Price vs Retailer Price" Problem

Garment businesses maintain multiple price levels:

```
PRICE LEVELS IN TALLY:
  MRP (Maximum Retail Price)       ← Printed on tag, legally mandated
  Wholesale Price                   ← For bulk buyers (50%–60% of MRP)
  Retailer Price                    ← For shop owners (55%–70% of MRP)
  Super Stockist Price              ← For large distributors
  Export Price                      ← Different calculation entirely
  Clearance / Sale Price            ← Discounted for old stock
```

These are configured in Tally as "Price Levels" under Stock Item masters. Each party ledger can be assigned a default price level. In XML:

```xml
<STOCKITEM NAME="Polo T-Shirt Blue M">
  <STANDARDCOST>250.00</STANDARDCOST>
  <STANDARDSELLINGPRICE>599.00</STANDARDSELLINGPRICE>
  <!-- Price levels appear in PRICELEVEL.LIST -->
  <PRICELEVEL.LIST>
    <NAME>MRP</NAME>
    <PRICELEVEL>
      <DATE>20250401</DATE>
      <RATE>599.00/Pcs</RATE>
    </PRICELEVEL>
  </PRICELEVEL.LIST>
  <PRICELEVEL.LIST>
    <NAME>Wholesale</NAME>
    <PRICELEVEL>
      <DATE>20250401</DATE>
      <RATE>350.00/Pcs</RATE>
    </PRICELEVEL>
  </PRICELEVEL.LIST>
  <PRICELEVEL.LIST>
    <NAME>Retailer</NAME>
    <PRICELEVEL>
      <DATE>20250401</DATE>
      <RATE>420.00/Pcs</RATE>
    </PRICELEVEL>
  </PRICELEVEL.LIST>
</STOCKITEM>
```

**Connector must**: Extract ALL price levels, store them, and let the sales app apply the correct price based on the party's assigned level.

### 3.5 The "Broker/Agent" Problem

Indian garment wholesale heavily uses brokers (dalal/agent). The broker brings buyer to seller and earns commission (typically 2-5%). In Tally:

- Broker is often tracked as a Cost Centre or as a UDF on the voucher
- Some businesses create a separate "Broker Commission" ledger under Indirect Expenses
- Broker commission TDLs are common addons
- The broker is NOT the party on the invoice — the buyer is. But the broker needs to be tracked for commission calculation.

In XML, broker tracking appears as either:
```xml
<!-- As Cost Centre allocation -->
<COSTCENTREALLOCATIONS.LIST>
  <NAME>Broker - Ramesh Shah</NAME>
  <AMOUNT>-50000.00</AMOUNT>
</COSTCENTREALLOCATIONS.LIST>

<!-- OR as UDF -->
<BROKERNAME.LIST TYPE="String" Index="35">
  <BROKERNAME>Ramesh Shah</BROKERNAME>
</BROKERNAME.LIST>
<BROKERCOMMISSIONPCT.LIST TYPE="Number" Index="36">
  <BROKERCOMMISSIONPCT>3</BROKERCOMMISSIONPCT>
</BROKERCOMMISSIONPCT.LIST>
```

### 3.6 The "Return/Exchange" Complexity

Garment returns are far more complex than pharma returns:

- **Size exchange**: Customer returns M, wants L instead. Two voucher lines: Return (Credit Note) for M + Sale for L.
- **Color exchange**: Similar pattern.
- **Defective return**: Goods move to "Defective" godown. May be sent back to manufacturer.
- **Season-end returns**: Unsold stock returned to manufacturer/distributor (large volumes).
- **Partial returns**: From a bundle of 100, 15 pieces returned (mixed sizes/colors).

Tally handles returns via Credit Note (Sales Return) and Debit Note (Purchase Return). But the SIZE of the returned item must match the original sale — garment businesses often get this wrong, creating phantom inventory in wrong sizes.

### 3.7 GST Rates for Garments (India-specific)

```
HSN 6101-6117 (Knitted/crocheted apparel):
  Sale price ≤ ₹1000: GST 5%
  Sale price > ₹1000: GST 12%

HSN 6201-6217 (Woven apparel):
  Sale price ≤ ₹1000: GST 5%
  Sale price > ₹1000: GST 12%

HSN 5007-5212 (Fabrics):
  GST 5% (most fabrics)

HSN 5001-5003 (Raw silk, silk yarn):
  GST 5%

HSN 5201-5203 (Raw cotton):
  GST 5%

HSN 6301-6310 (Home textiles - blankets, curtains):
  Sale price ≤ ₹1000: GST 5%
  Sale price > ₹1000: GST 12%

Footwear:
  Sale price ≤ ₹1000: GST 5%
  Sale price > ₹1000: GST 18%
```

**CRITICAL**: GST rate depends on SALE PRICE, not item category. The SAME shirt at ₹999 is 5% GST, but at ₹1001 is 12% GST. This means GST rate is set PER TRANSACTION, not per item master. The stock item may have a default rate, but the actual rate changes based on the selling price in each invoice.

**Connector implication for write-back**: When pushing a Sales Order, compute GST based on the actual line-item rate, not the default from the stock item master.

### 3.8 The "Piece vs Set vs Pair" Unit Confusion

```
"Suit Set" = Kurta + Pyjama (2 pieces sold as 1 unit)
"3-Piece Suit" = Blazer + Vest + Trouser (3 pieces as 1 unit)
"Pair" = 2 items (socks, shoes)
"Piece" = 1 item

When a "Suit Set" is purchased as 1 Set and sold as separate Kurta + Pyjama:
  Purchase: 1 Set @ ₹800 → Stock Item "Kurta Pyjama Set" +1
  Sale (Kurta only): Cannot sell partial set without Stock Journal first
  Stock Journal: 1 Set → 1 Kurta + 1 Pyjama (BOM/manufacturing journal)
```

This set-splitting pattern is common and creates complex inventory movements that the connector must trace.

---

## 4. GARMENT TDL ADDONS — WHAT THEY ADD TO XML

### 4.1 TDLStore Garment Billing TDL

Adds size-wise columns to Sales/Purchase vouchers. In XML, this appears as aggregate UDFs on inventory entries:

```xml
<ALLINVENTORYENTRIES.LIST>
  <STOCKITEMNAME>Polo T-Shirt Blue</STOCKITEMNAME>
  <!-- Standard fields -->
  <ACTUALQTY>50 Pcs</ACTUALQTY>
  <RATE>350.00/Pcs</RATE>
  <AMOUNT>17500.00</AMOUNT>
  
  <!-- Garment TDL adds these UDFs (size-wise breakup) -->
  <SIZEQTY_S.LIST TYPE="Number" Index="40">
    <SIZEQTY_S>5</SIZEQTY_S>
  </SIZEQTY_S.LIST>
  <SIZEQTY_M.LIST TYPE="Number" Index="41">
    <SIZEQTY_M>15</SIZEQTY_M>
  </SIZEQTY_M.LIST>
  <SIZEQTY_L.LIST TYPE="Number" Index="42">
    <SIZEQTY_L>20</SIZEQTY_L>
  </SIZEQTY_L.LIST>
  <SIZEQTY_XL.LIST TYPE="Number" Index="43">
    <SIZEQTY_XL>10</SIZEQTY_XL>
  </SIZEQTY_XL.LIST>
  <!-- Total ACTUALQTY = 5+15+20+10 = 50 -->
</ALLINVENTORYENTRIES.LIST>
```

**Detection**: Look for UDFs with names matching `/SIZE.*QTY/i` or `/QTY.*[SMLX]/i` patterns on inventory entries.

### 4.2 TallyPlanet Garment Module

Adds size-wise stock tracking via batch mechanism. Each size becomes a batch:
```xml
<BATCHALLOCATIONS.LIST>
  <BATCHNAME>S</BATCHNAME>
  <GODOWNNAME>Showroom</GODOWNNAME>
  <ACTUALQTY>5 Pcs</ACTUALQTY>
</BATCHALLOCATIONS.LIST>
<BATCHALLOCATIONS.LIST>
  <BATCHNAME>M</BATCHNAME>
  <GODOWNNAME>Showroom</GODOWNNAME>
  <ACTUALQTY>15 Pcs</ACTUALQTY>
</BATCHALLOCATIONS.LIST>
```

Also adds custom Stock Summary report showing all sizes in columnar format.

### 4.3 Antraweb Textile ERP

Heavy customization for manufacturing — adds:
- Process-wise godowns (Cutting, Stitching, Finishing)
- Lot/Bale tracking via batches
- Yarn count and fabric width UDFs on Stock Items
- Quality grade UDF (A, B, C grade / First quality, Second quality)
- Piece-wise inventory within bales (SKU Management)

### 4.4 Common UDFs Across Garment TDLs

| UDF | Object | Data Type | Typical Values |
|---|---|---|---|
| DesignNo / StyleNo / ArticleNo | Stock Item | String | "DSN-042", "Art. 55832" |
| Colour / Color | Stock Item | String | "Blue", "Navy", "BLU" |
| Size | Stock Item | String | "M", "40", "L" |
| Fabric / Material | Stock Item | String | "Cotton", "Polyester Blend" |
| Brand | Stock Item | String | "Allen Solly", "Local" |
| Season / Collection | Stock Item | String | "Summer 2025", "Festive" |
| QualityGrade | Stock Item | String | "A", "B", "Export Reject" |
| Width (for fabric) | Stock Item | String | "58 inch", "60 inch" |
| GSM (grams per sq meter) | Stock Item | Number | 180, 200, 250 |
| BrokerName | Voucher | String | "Ramesh Shah" |
| BrokerPct | Voucher | Number | 2, 3, 5 |
| TransportName | Voucher | String | "Maruti Transport" |
| BaleNo / BundleNo | Voucher Inv Entry | String | "BALE-001" |
| ChallanNo | Voucher | String | "CH/2025/042" |
| OrderRef | Voucher | String | "ORD-2025-001" |

---

## 5. GARMENT-SPECIFIC DATA MODEL ADDITIONS

### 5.1 Product Matrix (Central PostgreSQL)

```sql
-- Reconstructed from Tally's flat SKU or batch-based variants
CREATE TABLE product_designs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    design_number   TEXT,           -- DSN-042, Art. 55832
    design_name     TEXT NOT NULL,  -- "Polo T-Shirt"
    stock_group     TEXT,           -- Tally Stock Group (the design-level group)
    category        TEXT,           -- Season / Collection
    fabric          TEXT,
    brand           TEXT,
    hsn_code        TEXT,
    base_gst_rate   DECIMAL,        -- Default; actual depends on selling price
    image_url       TEXT,
    synced_at       TIMESTAMPTZ DEFAULT now(),
    UNIQUE(tenant_id, design_number)
);

CREATE TABLE product_variants (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    design_id       UUID NOT NULL REFERENCES product_designs(id),
    tenant_id       UUID NOT NULL,
    tally_stock_item_guid TEXT,     -- NULL if batch-based (not separate stock item)
    tally_stock_item_name TEXT NOT NULL, -- Exact name in Tally
    color           TEXT,
    size            TEXT,
    size_order      INTEGER,        -- For display ordering: S=1, M=2, L=3...
    mrp             DECIMAL,
    wholesale_price DECIMAL,
    retailer_price  DECIMAL,
    barcode         TEXT,
    is_active       BOOLEAN DEFAULT true,
    synced_at       TIMESTAMPTZ DEFAULT now(),
    UNIQUE(tenant_id, tally_stock_item_name)
);
CREATE INDEX idx_variants_design ON product_variants(design_id);
CREATE INDEX idx_variants_color_size ON product_variants(tenant_id, color, size);

-- Size-color availability matrix (from Tally stock position)
CREATE TABLE variant_stock (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    variant_id      UUID NOT NULL REFERENCES product_variants(id),
    tenant_id       UUID NOT NULL,
    godown          TEXT DEFAULT 'Main Location',
    quantity        DECIMAL NOT NULL,
    as_of_date      DATE NOT NULL,
    synced_at       TIMESTAMPTZ DEFAULT now(),
    UNIQUE(variant_id, godown, as_of_date)
);

-- Size ordering reference
CREATE TABLE size_sort_order (
    size_token      TEXT PRIMARY KEY,
    sort_order      INTEGER NOT NULL,
    size_category   TEXT  -- "letter", "numeric_chest", "numeric_waist", "kids", "fabric"
);
INSERT INTO size_sort_order VALUES
  ('XS', 1, 'letter'), ('S', 2, 'letter'), ('M', 3, 'letter'),
  ('L', 4, 'letter'), ('XL', 5, 'letter'), ('XXL', 6, 'letter'),
  ('XXXL', 7, 'letter'), ('2XL', 6, 'letter'), ('3XL', 7, 'letter'),
  ('FS', 10, 'letter'), ('FREE SIZE', 10, 'letter'),
  ('26', 1, 'numeric_waist'), ('28', 2, 'numeric_waist'), ('30', 3, 'numeric_waist'),
  ('32', 4, 'numeric_waist'), ('34', 5, 'numeric_waist'), ('36', 6, 'numeric_waist'),
  ('38', 7, 'numeric_waist'), ('40', 8, 'numeric_waist'),
  ('1-2Y', 1, 'kids'), ('2-3Y', 2, 'kids'), ('3-4Y', 3, 'kids'),
  ('4-5Y', 4, 'kids'), ('6-8Y', 5, 'kids'), ('8-10Y', 6, 'kids');
```

### 5.2 Variant Detection Algorithm

```
FOR EACH STOCK GROUP that has child Stock Items:
  1. Collect all item names under the group
  2. Find the longest common prefix among all names
     e.g., ["Polo Tee Blue S", "Polo Tee Blue M", "Polo Tee Red S"]
     → common prefix = "Polo Tee "
  3. Extract suffixes: ["Blue S", "Blue M", "Red S"]
  4. Attempt to parse each suffix into (color, size) or (size, color):
     - Check last token against size dictionary
     - Check first token against color dictionary
     - Handle reversed order (some businesses put size first)
  5. If successful for >80% of items → this group IS a variant family
  6. Build the design entity from common prefix + group metadata
  7. Build variant entities from each item + parsed color + size

FALLBACK: If suffix parsing fails (too ambiguous):
  - Check if items use batch-based variants (Approach 3)
  - Check if items have color/size UDFs (Approach 4)
  - If neither: treat as flat items, no matrix reconstruction
```

---

## 6. GARMENT-SPECIFIC OPERATIONAL PATTERNS

### 6.1 Seasonal Inventory Cycle

```
TIMELINE FOR A GARMENT WHOLESALER:

Jan-Feb:   Purchase Spring/Summer collection from manufacturers
           → Heavy Purchase Orders, Receipt Notes
Mar-May:   Sell Spring/Summer to retailers
           → Peak Sales Orders, Delivery Notes, Sales Invoices
Jun-Jul:   Purchase Monsoon/Rainy + Early Winter stock
           → Stock Journals (clearance of unsold summer to "Clearance" godown)
Aug-Oct:   Sell Festive/Diwali/Wedding season stock
           → PEAK SEASON. Highest transaction volume.
           → Multiple orders per day per retailer
Nov-Dec:   Sell Winter collection
           → Returns of festive stock start
Jan-Mar:   Year-end clearance sales
           → Heavy Credit Notes (returns from retailers)
           → Stock written off (dead stock)
           → CA visits for closing/audit
```

**Connector implication**: October-November has 3-5x normal transaction volume. Batch sizes must be tuned for peak. The sync engine must handle burst patterns gracefully.

### 6.2 The "Challan" (Delivery Challan) Pattern

Garment wholesalers heavily use "Challan" — goods sent to retailers on approval/consignment without immediate invoicing. In Tally:

- Delivery Note with `Tracking Number` = Challan number
- No accounting impact (only inventory movement)
- Retailer keeps goods for 15-30 days
- If sold, retailer confirms → Wholesaler raises Sales Invoice against the Delivery Note
- If unsold, goods returned → Receipt Note (goods inward)

This creates a pattern where goods are OUT of the warehouse but NOT sold. The Delivery Note is an "in-transit" or "on-consignment" state. Your stock summary must track this:

```
Available stock = Closing stock - Goods on delivery challans (not yet invoiced)
```

### 6.3 The "Credit Sale" and "Hundi" Problem

Garment wholesale runs almost entirely on credit:
- 30-60-90 day credit terms are standard
- Many transactions use "Hundi" (trade bill/promissory note) — a post-dated payment instrument
- "Udhar" (credit) relationships are based on trust, not formal contracts
- Credit limits are loosely enforced

In Tally, this appears as:
- Every sales voucher has bill-wise allocation with credit period
- `trn_bill` table shows outstanding bills and due dates
- Ageing analysis is critical (30/60/90/120+ days buckets)
- Many parties have large outstanding balances

**For the sales app**: Before placing a new order, check the party's outstanding balance and overdue status from the central DB. Warn the salesman if the retailer has exceeded credit limits or has overdue bills.

---

## 7. GARMENT CONNECTOR DIFFERENCES FROM PHARMA

| Dimension | Pharma | Garments |
|---|---|---|
| **SKU explosion** | Moderate (drug × strength × form) | Massive (design × color × size) |
| **Batch tracking** | Mandatory (regulatory) | Optional but common (for size or lot tracking) |
| **Expiry dates** | Critical (drug expiry) | Not applicable (fashion obsolescence is different) |
| **MRP** | Fixed per batch | Fixed per item (legally required on tag) |
| **GST rate** | Fixed per HSN | VARIES BY SELLING PRICE (≤₹1000 = 5%, >₹1000 = 12%) |
| **Seasonality** | Mild (monsoon illnesses) | Extreme (fashion seasons + festivals) |
| **Returns** | Low-moderate | High (size/color mismatch, unsold stock) |
| **Credit terms** | 15-30 days | 30-90 days |
| **Broker/Agent** | Rare | Very common |
| **Consignment/Challan** | Rare | Very common |
| **Price levels** | 1-2 (MRP, PTR) | 4-6 (MRP, Wholesale, Retailer, Super Stockist, Export, Clearance) |
| **Key reports** | Batch expiry, drug schedule | Size-color matrix, slow-moving stock, season-wise P&L |
| **Variant tracking** | By batch (batch = MRP + expiry) | By item name or batch (batch = size or color) |
| **Typical items count** | 2,000-10,000 | 10,000-100,000+ (with size-color variants) |
| **Transaction volume** | Steady | Highly seasonal (3-5x at peak) |

---

## 8. GARMENT-SPECIFIC CONNECTOR REQUIREMENTS

### 8.1 Additional Sync Targets

Beyond the base connector spec:
- **Price Level data**: Extract ALL price levels per stock item (not just StandardCost/StandardSellingPrice)
- **Stock Category data**: Critical for season/collection tracking
- **Broker/Agent tracking**: Extract from Cost Centres or UDFs
- **Delivery Notes outstanding**: For consignment/challan tracking
- **Credit ageing by party**: For sales app credit-check before ordering

### 8.2 Size-Color Matrix API (for sales app)

```
GET /api/v1/designs?category=&brand=&season=
GET /api/v1/designs/:id/matrix          ← Returns full size-color availability
GET /api/v1/designs/:id/matrix?godown=  ← Per-location availability

Response:
{
  "design": "Polo T-Shirt Design-A",
  "brand": "Local",
  "hsn": "6105",
  "colors": ["Blue", "Red", "White"],
  "sizes": ["S", "M", "L", "XL"],
  "matrix": {
    "Blue":  {"S": 50, "M": 75, "L": 40, "XL": 20},
    "Red":   {"S": 30, "M": 60, "L": 25, "XL": 15},
    "White": {"S": 0,  "M": 45, "L": 35, "XL": 10}
  },
  "prices": {
    "MRP": 599, "Wholesale": 350, "Retailer": 420
  }
}
```

### 8.3 Write-Back Considerations

When pushing a Sales Order from the garment sales app:

**If Approach 1 (flat SKU)**: Each size-color in the order is a separate inventory entry line in the voucher. A single order for "Polo T-Shirt" in 3 colors × 4 sizes = 12 inventory lines. Each references the exact Tally Stock Item name.

**If Approach 3 (batch-based)**: Single inventory entry for the design, with multiple batch allocation lines (one per size/color).

**GST calculation**: Must check if item price ≤ ₹1000 → 5%, or > ₹1000 → 12%. The connector cannot use a fixed GST rate from the stock item master — it must compute per transaction line based on the actual selling rate.

### 8.4 The "Garment Invoice" Format

Garment invoices are distinctly different from pharma invoices:
- Size-wise quantity columns (S | M | L | XL | Total)
- Rate per piece (not per strip/bottle)
- Discount per design (trade discount 5-20%)
- Broker name on invoice
- Challan reference if against Delivery Note
- Bale/Bundle number for dispatch

This affects the XML structure when pushing — the Sales Order needs to include all size breakdown for the garment invoice TDL to print correctly.
