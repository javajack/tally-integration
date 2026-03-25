---
title: Size Tokens Reference
description: Complete reference for garment size tokens -- letter sizes, numeric waist/chest, kids sizes, Indian traditional, and footwear -- with regex patterns and sort order tables.
---

Size tokens are the building blocks of garment variant detection. When your connector parses "Polo Tee Blue **M**" or "Formal Trouser Black **32**", it needs to recognize that last token as a size. This chapter is your comprehensive reference.

## Letter Sizes

The most common sizing system for casual and ready-made garments:

| Token | Full Name | Sort Order |
|-------|-----------|-----------|
| XS | Extra Small | 1 |
| S | Small | 2 |
| M | Medium | 3 |
| L | Large | 4 |
| XL | Extra Large | 5 |
| XXL | Extra Extra Large | 6 |
| XXXL | 3X Large | 7 |
| 2XL | 2X Large | 6 |
| 3XL | 3X Large | 7 |
| 4XL | 4X Large | 8 |
| 5XL | 5X Large | 9 |
| FS | Free Size | 10 |
| Free Size | Free Size | 10 |
| One Size | One Size | 10 |

**Regex pattern**:
```
/\b(XS|S|M|L|XL|XXL|XXXL|
  [2-5]XL|FS|FREE\s*SIZE|
  ONE\s*SIZE|ONESIZE)\b/i
```

:::caution
Single-letter `S`, `M`, `L` can be ambiguous. `L` might be part of a word ("Long Sleeve **L**"). Always check that the token is standalone (preceded and followed by a separator or string boundary).
:::

## Numeric Sizes: Waist (Trousers, Jeans)

| Token | Garment Type | Sort Order |
|-------|-------------|-----------|
| 28 | Trousers, Jeans | 1 |
| 29 | Jeans | 2 |
| 30 | Trousers, Jeans | 3 |
| 31 | Jeans | 4 |
| 32 | Trousers, Jeans | 5 |
| 33 | Jeans | 6 |
| 34 | Trousers, Jeans | 7 |
| 36 | Trousers, Jeans | 8 |
| 38 | Trousers | 9 |
| 40 | Trousers | 10 |

**Regex pattern**:
```
/\b(2[6-9]|3[0-9]|40)\b/
```

## Numeric Sizes: Chest (Shirts, Formal)

| Token | Notes | Sort Order |
|-------|-------|-----------|
| 38 | Slim fit start | 1 |
| 39 | Regular | 2 |
| 40 | Common | 3 |
| 42 | Common | 4 |
| 44 | Large | 5 |
| 46 | XL | 6 |
| 48 | XXL | 7 |

**Regex pattern** (same range as waist for higher values):
```
/\b(3[8-9]|4[0-9])\b/
```

:::tip
How do you tell waist 38 from chest 38? Context from the Stock Group hierarchy. If the parent group is "Trousers" or "Jeans", it's waist. If "Shirts" or "Formal", it's chest. The numeric value overlaps, but the garment type disambiguates.
:::

## Kids' Sizes

### Age-Range Format

| Token | Age | Sort Order |
|-------|-----|-----------|
| 1-2Y | 1-2 years | 1 |
| 2-3Y | 2-3 years | 2 |
| 3-4Y | 3-4 years | 3 |
| 4-5Y | 4-5 years | 4 |
| 6-8Y | 6-8 years | 5 |
| 8-10Y | 8-10 years | 6 |
| 10-12Y | 10-12 years | 7 |
| 12-14Y | 12-14 years | 8 |

**Regex pattern**:
```
/\b(\d{1,2}-\d{1,2}\s*Y)\b/i
```

### Garment Measurement (Kids)

| Token | Notes | Sort Order |
|-------|-------|-----------|
| 16 | Smallest kids | 1 |
| 18 | | 2 |
| 20 | | 3 |
| 22 | | 4 |
| 24 | | 5 |
| 26 | | 6 |
| 28 | Largest kids / small adult | 7 |

These overlap with adult waist sizes. Context (Kids Stock Group) is essential.

## Indian Traditional Sizes

For sarees, lehengas, dupattas, and fabric:

### By Length (Meters)

| Token | Usage | Sort Order |
|-------|-------|-----------|
| 5.5m | Standard saree | 1 |
| 6m | Standard saree with blouse | 2 |
| 6.25m | Premium saree | 3 |
| 2.5m | Dupatta | 1 |
| 3m | Long dupatta | 2 |

### By Type

| Token | Meaning |
|-------|---------|
| Running | Continuous length, sold by meter |
| Cut Piece | Pre-cut to specific length |
| Thaan | Full bolt (40-100 meters) |

**Regex for meters**:
```
/\b(\d+(?:\.\d+)?)\s*m(?:tr|eter)?s?\b/i
```

## Footwear Sizes

### Indian/UK System

| Token | System | Sort Order |
|-------|--------|-----------|
| IND 6 / UK 6 | Indian or UK | 1 |
| IND 7 / UK 7 | | 2 |
| IND 8 / UK 8 | | 3 |
| IND 9 / UK 9 | | 4 |
| IND 10 / UK 10 | | 5 |
| IND 11 / UK 11 | | 6 |
| IND 12 / UK 12 | | 7 |

Sometimes sizes appear as just numbers: `6`, `7`, `8`, `9`, `10`. Context (footwear Stock Group) is required.

**Regex pattern**:
```
/\b(?:IND|UK)\s*(\d{1,2})\b/i
```

## Sort Order Reference

For display purposes, sizes must be ordered logically, not alphabetically. Here's the master sort table:

```sql
-- Letter sizes
('XS', 1), ('S', 2), ('M', 3),
('L', 4), ('XL', 5), ('XXL', 6),
('XXXL', 7), ('2XL', 6), ('3XL', 7),
('4XL', 8), ('5XL', 9),
('FS', 10), ('FREE SIZE', 10),

-- Numeric waist
('28', 1), ('29', 2), ('30', 3),
('31', 4), ('32', 5), ('33', 6),
('34', 7), ('36', 8), ('38', 9),
('40', 10),

-- Numeric chest
('38', 1), ('39', 2), ('40', 3),
('42', 4), ('44', 5), ('46', 6),
('48', 7),

-- Kids age
('1-2Y', 1), ('2-3Y', 2), ('3-4Y', 3),
('4-5Y', 4), ('6-8Y', 5), ('8-10Y', 6),
('10-12Y', 7), ('12-14Y', 8)
```

:::tip
Store both the raw token and its category (letter, numeric_waist, numeric_chest, kids, etc.) in your database. The sort order only makes sense within a category -- you wouldn't sort `M` and `32` together.
:::

## Normalization Rules

Apply these before matching against dictionaries:

1. **Uppercase**: Normalize to uppercase for matching
2. **Trim whitespace**: Remove leading/trailing spaces
3. **Collapse spaces**: "FREE  SIZE" becomes "FREE SIZE"
4. **Map aliases**: "FREESIZE" and "FREE SIZE" and "FS" all map to the same value
5. **Handle 2XL/XXL equivalence**: `2XL` = `XXL`, `3XL` = `XXXL`
