---
title: Sales Order XML Template
description: The complete XML template for creating a Sales Order in Tally via HTTP POST, with a line-by-line walkthrough of every element.
---

This is the XML you'll POST to Tally to create a Sales Order. We'll walk through every tag, explain what it does, and give you a copy-pasteable example at the end.

## The Envelope

Every Tally XML request starts with an envelope. Think of it as the shipping label on the package.

```xml
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Import</TALLYREQUEST>
    <TYPE>Data</TYPE>
    <ID>Vouchers</ID>
  </HEADER>
```

| Tag | Value | Why |
|---|---|---|
| `VERSION` | `1` | Always 1 |
| `TALLYREQUEST` | `Import` | We're pushing data in |
| `TYPE` | `Data` | It's transaction data |
| `ID` | `Vouchers` | We're importing vouchers |

## The Body and Company Target

```xml
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVCURRENTCOMPANY>
          Stockist Pharma Pvt Ltd
        </SVCURRENTCOMPANY>
      </STATICVARIABLES>
    </DESC>
```

:::caution
`SVCURRENTCOMPANY` must match the **exact** company name loaded in Tally. Case matters. Spaces matter. Get this wrong and the entire request silently fails.
:::

## The Voucher Header

```xml
    <DATA>
      <TALLYMESSAGE xmlns:UDF="TallyUDF">
        <VOUCHER VCHTYPE="Sales Order"
                 ACTION="Create"
                 OBJVIEW="Invoice Voucher View">
```

The `VOUCHER` element has three critical attributes:

| Attribute | Value | Notes |
|---|---|---|
| `VCHTYPE` | `Sales Order` | Must match voucher type name |
| `ACTION` | `Create` | New voucher |
| `OBJVIEW` | `Invoice Voucher View` | Tells Tally this has inventory lines |

### Core Fields

```xml
          <DATE>20260325</DATE>
          <VOUCHERTYPENAME>
            Sales Order
          </VOUCHERTYPENAME>
          <VOUCHERNUMBER>
            SO/FIELD/0042
          </VOUCHERNUMBER>
          <REFERENCE>
            SO/FIELD/0042
          </REFERENCE>
          <PARTYLEDGERNAME>
            Raj Medical Store - Ahmedabad
          </PARTYLEDGERNAME>
          <PERSISTEDVIEW>
            Invoice Voucher View
          </PERSISTEDVIEW>
          <NARRATION>
            Field order by Amit K.
            Territory: Ahmedabad-West
          </NARRATION>
```

- **DATE**: Format is `YYYYMMDD`. No dashes, no slashes.
- **VOUCHERTYPENAME**: Must match exactly. If the stockist uses a custom type like "Field Sales Order", use that instead.
- **VOUCHERNUMBER**: Your unique reference. Use a prefix to avoid collisions (see [Voucher Numbering](/tally-integartion/write-back/voucher-numbering/)).
- **PARTYLEDGERNAME**: The customer's ledger name. Must exist in Tally. Case-sensitive.
- **NARRATION**: Free text. Great for audit trails.

## Accounting Entries

A Sales Order needs balanced accounting entries even though it's just an order (no actual accounting impact). Tally requires them for its internal validation.

### Party Side (Debit)

```xml
          <ALLLEDGERENTRIES.LIST>
            <LEDGERNAME>
              Raj Medical Store - Ahmedabad
            </LEDGERNAME>
            <ISDEEMEDPOSITIVE>
              Yes
            </ISDEEMEDPOSITIVE>
            <AMOUNT>-11800.00</AMOUNT>
          </ALLLEDGERENTRIES.LIST>
```

:::tip
In Tally's world, **debit amounts are negative**. Yes, it's backwards from what you'd expect. The party owes us money (debit), so the amount is `-11800.00`.
:::

### Sales Side (Credit)

```xml
          <ALLLEDGERENTRIES.LIST>
            <LEDGERNAME>
              Sales Account
            </LEDGERNAME>
            <ISDEEMEDPOSITIVE>
              No
            </ISDEEMEDPOSITIVE>
            <AMOUNT>10000.00</AMOUNT>
          </ALLLEDGERENTRIES.LIST>
```

Credit amounts are positive. The sales ledger gets credited with the pre-tax amount.

### Tax Ledger (Credit)

```xml
          <ALLLEDGERENTRIES.LIST>
            <LEDGERNAME>
              Output IGST 18%
            </LEDGERNAME>
            <ISDEEMEDPOSITIVE>
              No
            </ISDEEMEDPOSITIVE>
            <AMOUNT>1800.00</AMOUNT>
          </ALLLEDGERENTRIES.LIST>
```

:::caution
The tax ledger name must exist in Tally. Common names: `Output IGST 18%`, `Output CGST 9%`, `Output SGST 9%`. Check what the stockist actually uses -- they vary wildly.
:::

### The Balance Rule

```
Party (Dr)  = -11,800.00
Sales (Cr)  = +10,000.00
Tax (Cr)    = + 1,800.00
             -----------
Total        =      0.00  <-- MUST be zero
```

If this doesn't balance to the **paisa**, Tally rejects the voucher with "Voucher totals do not match!" See [Round-Off Handling](/tally-integartion/write-back/round-off-handling/) for dealing with rounding differences.

## Inventory Entries

Each line item in the order gets an inventory entry.

```xml
          <ALLINVENTORYENTRIES.LIST>
            <STOCKITEMNAME>
              Paracetamol 500mg Strip/10
            </STOCKITEMNAME>
            <ISDEEMEDPOSITIVE>
              No
            </ISDEEMEDPOSITIVE>
            <RATE>50.00/Strip</RATE>
            <ACTUALQTY>100 Strip</ACTUALQTY>
            <BILLEDQTY>100 Strip</BILLEDQTY>
            <AMOUNT>5000.00</AMOUNT>
```

| Field | Format | Example |
|---|---|---|
| `STOCKITEMNAME` | Exact Tally name | `Paracetamol 500mg Strip/10` |
| `RATE` | `{price}/{unit}` | `50.00/Strip` |
| `ACTUALQTY` | `{qty} {unit}` | `100 Strip` |
| `BILLEDQTY` | Same as ACTUALQTY | `100 Strip` |
| `AMOUNT` | Decimal | `5000.00` |

### Accounting Allocation (per item)

Each inventory entry needs an accounting allocation linking it to a sales ledger:

```xml
            <ACCOUNTINGALLOCATIONS.LIST>
              <LEDGERNAME>
                Sales Account
              </LEDGERNAME>
              <AMOUNT>5000.00</AMOUNT>
            </ACCOUNTINGALLOCATIONS.LIST>
```

### Batch Allocation

If the company has batches enabled (most pharma stockists do), you need batch allocations:

```xml
            <BATCHALLOCATIONS.LIST>
              <GODOWNNAME>
                Main Location
              </GODOWNNAME>
              <DESTINATIONGODOWNNAME>
                Main Location
              </DESTINATIONGODOWNNAME>
              <BATCHNAME>
                Primary Batch
              </BATCHNAME>
              <ORDERDUEDATE>
                20260401
              </ORDERDUEDATE>
              <AMOUNT>5000.00</AMOUNT>
              <ACTUALQTY>
                100 Strip
              </ACTUALQTY>
              <BILLEDQTY>
                100 Strip
              </BILLEDQTY>
            </BATCHALLOCATIONS.LIST>
          </ALLINVENTORYENTRIES.LIST>
```

:::tip
For Sales Orders, you can use `Primary Batch` as the batch name if you don't know the actual batch yet. The warehouse will assign the real batch when creating the Delivery Note.
:::

## Complete Copy-Pasteable Example

Here's the full XML for a two-line-item Sales Order:

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
    <SVCURRENTCOMPANY>
      Stockist Pharma Pvt Ltd
    </SVCURRENTCOMPANY>
   </STATICVARIABLES>
  </DESC>
  <DATA>
   <TALLYMESSAGE xmlns:UDF="TallyUDF">
    <VOUCHER VCHTYPE="Sales Order"
             ACTION="Create"
             OBJVIEW="Invoice Voucher View">
     <DATE>20260325</DATE>
     <VOUCHERTYPENAME>
       Sales Order
     </VOUCHERTYPENAME>
     <VOUCHERNUMBER>
       SO/FIELD/0042
     </VOUCHERNUMBER>
     <REFERENCE>SO/FIELD/0042</REFERENCE>
     <PARTYLEDGERNAME>
       Raj Medical Store - Ahmedabad
     </PARTYLEDGERNAME>
     <PERSISTEDVIEW>
       Invoice Voucher View
     </PERSISTEDVIEW>
     <NARRATION>
       Field order by Amit K.
     </NARRATION>

     <!-- Party (Dr) -->
     <ALLLEDGERENTRIES.LIST>
      <LEDGERNAME>
        Raj Medical Store - Ahmedabad
      </LEDGERNAME>
      <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
      <AMOUNT>-11800.00</AMOUNT>
     </ALLLEDGERENTRIES.LIST>

     <!-- Sales (Cr) -->
     <ALLLEDGERENTRIES.LIST>
      <LEDGERNAME>Sales Account</LEDGERNAME>
      <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
      <AMOUNT>10000.00</AMOUNT>
     </ALLLEDGERENTRIES.LIST>

     <!-- Tax (Cr) -->
     <ALLLEDGERENTRIES.LIST>
      <LEDGERNAME>
        Output IGST 18%
      </LEDGERNAME>
      <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
      <AMOUNT>1800.00</AMOUNT>
     </ALLLEDGERENTRIES.LIST>

     <!-- Item 1: Paracetamol -->
     <ALLINVENTORYENTRIES.LIST>
      <STOCKITEMNAME>
        Paracetamol 500mg Strip/10
      </STOCKITEMNAME>
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
       <DESTINATIONGODOWNNAME>
         Main Location
       </DESTINATIONGODOWNNAME>
       <BATCHNAME>Primary Batch</BATCHNAME>
       <ORDERDUEDATE>20260401</ORDERDUEDATE>
       <AMOUNT>5000.00</AMOUNT>
       <ACTUALQTY>100 Strip</ACTUALQTY>
       <BILLEDQTY>100 Strip</BILLEDQTY>
      </BATCHALLOCATIONS.LIST>
     </ALLINVENTORYENTRIES.LIST>

     <!-- Item 2: Amoxicillin -->
     <ALLINVENTORYENTRIES.LIST>
      <STOCKITEMNAME>
        Amoxicillin 250mg Cap/10
      </STOCKITEMNAME>
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
       <DESTINATIONGODOWNNAME>
         Main Location
       </DESTINATIONGODOWNNAME>
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

:::danger
Before using this template, replace **every** name (company, party, stock items, ledgers, godown) with the exact names from the target Tally instance. A single character mismatch and the import fails silently or with a cryptic error.
:::

## Next Steps

- [Voucher Lifecycle](/tally-integartion/write-back/voucher-lifecycle/) -- how to alter, cancel, and delete vouchers after creation
- [Pre-Validation](/tally-integartion/write-back/pre-validation/) -- the checklist to run before every push
- [Import Response](/tally-integartion/write-back/import-response/) -- parsing Tally's response to confirm success
