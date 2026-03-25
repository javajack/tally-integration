---
title: Common TDL Addons
description: A catalog of popular Indian-market TDL addons, the UDFs they create, and how they affect the XML your connector receives.
---

Almost every Tally installation in the Indian market has at least one third-party TDL addon. Here's what you'll actually encounter.

## Addon Catalog

| Category | Common Names | UDFs Created | XML Impact |
|---|---|---|---|
| Medical Billing | TDLStore Medical, Antraweb Pharma | DrugSchedule, PackOf, CompanyBrand, PatientName, DoctorName, DLNumber | Stock Item + Voucher get extra LIST tags |
| E-commerce | eCom2Tally, Unicommerce, Amazon-to-Tally | OrderID, MarketplaceName, AWB, ChannelName | Voucher UDFs; may add custom voucher types |
| Barcode/QR | TallyBarcode, ScanTally | BarcodeValue, EANCode | Stock Item gets barcode UDF |
| Salesman/DSR | Various custom | SalesmanName, Route, Territory, BeatName | Voucher + Ledger get salesman UDFs |
| Approval Workflow | Antraweb Approval, TallyVault | ApprovalStatus, ApprovedBy, ApprovalDate | Voucher workflow UDFs; may restrict creation |
| IMEI/Serial | TDLStore IMEI, Custom | IMEINumber (aggregate) | Complex nested UDFs in inventory allocations |
| Discount Mgmt | Custom per distributor | DiscountType, DiscountPct, SchemeCode | Voucher line items get discount UDFs |
| Transport | E-Way Bill (built-in), Custom | VehicleNo, TransporterID, EWayBillNo | Voucher transport UDFs |

## Medical Billing (Pharma)

This is the most common addon category for our target users. A medical billing TDL typically adds:

**On Stock Item:**
- `DrugSchedule` -- H, H1, X, OTC classification
- `PackOf` -- "Strip of 10", "Bottle of 100ml"
- `CompanyBrand` -- "Cipla", "Sun Pharma"
- `StorageTemp` -- "Room Temp", "Cold Storage"
- `Manufacturer` -- manufacturer name

**On Voucher:**
- `PatientName` -- required for Schedule H drugs
- `DoctorName` -- prescribing doctor
- `DLNumber` -- Drug License number (on company master)

```xml
<!-- Stock Item with medical billing TDL -->
<STOCKITEM NAME="Dolo 650 Tab">
  <DRUGSCHEDULE.LIST Index="30">
    <DRUGSCHEDULE>H</DRUGSCHEDULE>
  </DRUGSCHEDULE.LIST>
  <MANUFACTURER.LIST Index="31">
    <MANUFACTURER>Micro Labs</MANUFACTURER>
  </MANUFACTURER.LIST>
  <STORAGETEMP.LIST Index="32">
    <STORAGETEMP>Room Temp</STORAGETEMP>
  </STORAGETEMP.LIST>
</STOCKITEM>
```

## E-commerce Integration

E-commerce TDLs bridge marketplace orders with Tally accounting. They often create **custom voucher types** like "Amazon Sale" or "Flipkart Return."

**On Voucher:**
- `OrderID` -- marketplace order reference
- `MarketplaceName` -- "Amazon", "Flipkart"
- `AWB` -- airway bill / tracking number
- `ChannelName` -- sales channel identifier

:::tip
E-commerce TDLs sometimes create entirely new voucher types rather than just adding UDFs to standard Sales vouchers. Your connector must check the `PARENT` type to understand what these custom types actually *are*.
:::

## Barcode / QR Code

Barcode TDLs are lightweight but widespread:

**On Stock Item:**
- `BarcodeValue` -- the barcode string
- `EANCode` -- EAN-13 code

These are straightforward string UDFs. The main connector concern is indexing them for product lookup.

## Salesman / DSR Tracking

Distributors track sales performance per salesman in one of two ways. The TDL approach adds UDFs directly:

**On Voucher:**
- `SalesmanName` -- assigned salesman
- `BeatName` -- delivery beat/route

**On Ledger (Party):**
- `Territory` -- geographic territory
- `Route` -- delivery route code

:::caution
Some distributors track salesmen via **Cost Centres** instead of UDFs. Your connector must check both patterns. See the [research notes on the "Salesman as Cost Centre" pattern](/tally-integartion/edge-cases/data-integrity/).
:::

## IMEI / Serial Number Tracking

This is the most complex addon pattern. IMEI tracking adds an **aggregate UDF** on voucher inventory lines -- meaning each line item can have *multiple* serial numbers:

```xml
<ALLINVENTORYENTRIES.LIST>
  <STOCKITEMNAME>
    Samsung Galaxy A54
  </STOCKITEMNAME>
  <ACTUALQTY>3 Nos</ACTUALQTY>
  <IMEINUMBER.LIST Index="30">
    <IMEINUMBER>
      353456789012345
    </IMEINUMBER>
    <IMEINUMBER>
      353456789012346
    </IMEINUMBER>
    <IMEINUMBER>
      353456789012347
    </IMEINUMBER>
  </IMEINUMBER.LIST>
</ALLINVENTORYENTRIES.LIST>
```

## Detecting Addon Category

You can often guess the addon category from the `.tcp` filename:

| Filename Contains | Likely Category |
|---|---|
| `medical`, `pharma` | Pharma Billing |
| `barcode` | Barcode Tracking |
| `ecom`, `amazon`, `flipkart` | E-commerce |
| `salesman`, `dsr` | Salesman Tracking |
| `approval` | Workflow |
| `imei`, `serial` | Serial Tracking |
| `discount` | Discount Management |
| `eway`, `transport` | Logistics |

:::tip
Filename detection is a heuristic. Always confirm by running the [UDF Discovery Algorithm](/tally-integartion/tdl-custom-fields/udf-discovery/) to see what actually appears in the XML.
:::
