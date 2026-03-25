---
title: Voucher Numbering
description: How to number connector-generated vouchers to avoid collisions with manual entries. Prefix strategies, auto vs manual numbering, and best practices.
---

Tally's voucher numbering is surprisingly flexible -- and surprisingly easy to break. When your connector pushes Sales Orders into Tally, the numbers need to coexist peacefully with vouchers entered manually by the stockist's team.

## The Collision Problem

Imagine this:
1. The Tally operator creates Sales Order number `001` manually
2. Your connector pushes Sales Order number `001` from the field app
3. Tally either rejects the duplicate or creates two vouchers with the same number

Neither outcome is good.

## The Solution: Unique Prefixes

Use a distinct prefix for connector-generated vouchers that no human would type manually.

### Recommended Prefix Patterns

| Pattern | Example | Best For |
|---|---|---|
| `FIELD/{UUID}` | `FIELD/a1b2c3d4` | Maximum uniqueness |
| `API/{timestamp}` | `API/20260325143022` | Chronological ordering |
| `APP-{sequential}` | `APP-0042` | Human-readable sequence |

### FIELD/{UUID} -- Maximum Uniqueness

```xml
<VOUCHERNUMBER>
  FIELD/a1b2c3d4-e5f6-7890
</VOUCHERNUMBER>
```

**Pros**: Globally unique. Zero collision risk. Works across multiple connectors pushing to the same Tally instance.

**Cons**: Not human-friendly. The warehouse manager sees `FIELD/a1b2c3d4-e5f6-7890` on their screen and sighs.

### API/{timestamp} -- Chronological

```xml
<VOUCHERNUMBER>
  API/20260325-143022
</VOUCHERNUMBER>
```

**Pros**: Sortable by time. Easy to debug ("this order came in at 2:30 PM"). Unlikely to collide (millisecond precision helps).

**Cons**: Two orders at the exact same second could collide. Add milliseconds or a sequence suffix to be safe.

### APP-{sequential} -- Human-Readable

```xml
<VOUCHERNUMBER>
  APP-0042
</VOUCHERNUMBER>
```

**Pros**: Clean, readable, warehouse-friendly. Easy to reference in phone conversations ("Order APP-0042").

**Cons**: You need a reliable sequence generator. If two connectors share a Tally instance, sequences can collide.

:::tip
Our recommendation: Use `FIELD/{short-UUID}` for production. It balances uniqueness with readability. A short UUID like `FIELD/a1b2c3d4` is unique enough and not too ugly.
:::

## Tally's Numbering Configuration

Tally voucher types can be configured for **automatic** or **manual** numbering.

### Automatic Numbering

Tally assigns the next sequential number based on its internal counter. If you omit `VOUCHERNUMBER` from your XML, Tally auto-assigns.

```xml
<!-- Let Tally assign the number -->
<VOUCHER VCHTYPE="Sales Order"
         ACTION="Create">
  <!-- VOUCHERNUMBER omitted -->
  <DATE>20260325</DATE>
  <!-- rest of voucher -->
</VOUCHER>
```

**When to use**: If the stockist doesn't care about prefix-based tracking and just wants sequential numbers.

**Risk**: You won't know the voucher number until you query for it after creation. The response only gives you `LASTVCHID`, not the number.

### Manual Numbering

You provide the number. Tally accepts whatever you send (unless "Prevent Duplicates" is enabled in the voucher type settings).

```xml
<VOUCHERNUMBER>
  FIELD/a1b2c3d4
</VOUCHERNUMBER>
```

**When to use**: When you need to track orders by your own reference numbers. This is the recommended approach for connector-generated vouchers.

## Configuring in Tally

The voucher numbering mode is set per voucher type:

```
Gateway of Tally
  > Alter > Voucher Types
    > Sales Order
      > Method of Voucher Numbering:
        - Automatic
        - Manual
        - Automatic (Manual Override)
```

:::caution
If the stockist's voucher type is set to "Automatic" and you include a `VOUCHERNUMBER`, Tally may ignore your number and assign its own. Check the voucher type configuration during setup.
:::

The safest option is **"Automatic (Manual Override)"** -- Tally provides a default sequence, but your connector can override it with a custom number.

## The Reference Field

In addition to `VOUCHERNUMBER`, Tally has a `REFERENCE` field. This is a free-text field that doesn't need to be unique.

```xml
<VOUCHERNUMBER>
  FIELD/a1b2c3d4
</VOUCHERNUMBER>
<REFERENCE>
  ORD-2026-0042
</REFERENCE>
```

Use `REFERENCE` to store your app's internal order ID. This way:
- `VOUCHERNUMBER` is Tally's identifier
- `REFERENCE` is your system's identifier
- You can search by either one

## Best Practices

### 1. Configure prefix in settings

```toml
[writeback]
voucher_number_prefix = "FIELD/"
```

Don't hardcode it. Different stockists may want different prefixes (especially if multiple apps push to the same Tally).

### 2. Store the mapping

After creation, store both numbers:

```sql
INSERT INTO write_orders (
  central_order_id,
  tally_voucher_number,
  tally_master_id
) VALUES (
  'ORD-2026-0042',
  'FIELD/a1b2c3d4',
  12345
);
```

### 3. Handle "Duplicate Voucher Number" errors

If Tally rejects with a duplicate error:
1. Generate a new number (append timestamp or random suffix)
2. Retry with the new number
3. Log the collision for investigation

### 4. Keep numbers short

Tally displays voucher numbers in reports and screens with limited width. A 50-character UUID will get truncated. Aim for under 20 characters total.

```
Good:  FIELD/a1b2c3d4        (16 chars)
OK:    API/20260325-1430      (18 chars)
Bad:   FIELD/a1b2c3d4-e5f6-7890-abcd-ef01  (38 chars)
```

### 5. Use the same prefix for the REFERENCE field

```xml
<VOUCHERNUMBER>FIELD/a1b2c3d4</VOUCHERNUMBER>
<REFERENCE>FIELD/a1b2c3d4</REFERENCE>
```

This makes it easy to search in Tally using either field.

## Custom Voucher Types

Some stockists create a custom voucher type like "Field Sales Order" (a child of "Sales Order") specifically for connector-generated orders. This gives them:

- Separate numbering series
- Easy filtering in reports
- Clear distinction between manual and app-generated orders

If the stockist wants this, your connector just needs to use the custom type name:

```xml
<VOUCHER VCHTYPE="Field Sales Order"
         ACTION="Create">
  <VOUCHERTYPENAME>
    Field Sales Order
  </VOUCHERTYPENAME>
  <!-- rest of voucher -->
</VOUCHER>
```

The custom type inherits all Sales Order behavior. The only difference is the name and numbering.
