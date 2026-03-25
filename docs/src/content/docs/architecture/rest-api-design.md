---
title: REST API Design
description: The 12 REST API endpoints that power the sales fleet app — covering stock queries, party management, order creation, write-back confirmation, and health monitoring.
---

The central API serves one primary consumer: the sales fleet app. A salesman visiting a medical shop needs to check stock, look up the party, place an order, and move on. Every endpoint is designed for that workflow.

## Base URL

```
https://api.example.com/api/v1
```

All requests require an `Authorization: Bearer <token>` header. The `tenant_id` is derived from the token.

## Endpoint Reference

| # | Endpoint | Method | Description |
|---|----------|--------|-------------|
| 1 | `/stock-items` | GET | List stock items with filtering and search |
| 2 | `/stock-items/:id/batches` | GET | Batch details for a stock item |
| 3 | `/stock-items/:id/availability` | GET | Stock availability by godown |
| 4 | `/godowns` | GET | List all godowns/locations |
| 5 | `/parties` | GET | List parties with outstanding and order history |
| 6 | `/orders` | POST | Create a new field order |
| 7 | `/orders` | GET | List orders with filters |
| 8 | `/orders/:id/confirm` | POST | Confirm and push order to Tally |
| 9 | `/expiry-alerts` | GET | Items expiring within N days |
| 10 | `/reorder-alerts` | GET | Items below reorder level |
| 11 | `/sync-status` | GET | Connector sync health |
| 12 | `/parties/:id/order-history` | GET | Order history for a party |

## Endpoint Details

### 1. List Stock Items

```
GET /stock-items
```

Search and filter the stock catalog. This is the salesman's product browser.

**Query parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `search` | string | Full-text search on name, alias, part_number |
| `category` | string | Filter by stock category |
| `group` | string | Filter by stock group |
| `godown` | string | Filter by godown availability |
| `in_stock` | bool | Only items with `available_qty > 0` |
| `page` | int | Page number (default: 1) |
| `limit` | int | Items per page (default: 50) |

**Response:**

```json
{
  "items": [
    {
      "id": "uuid",
      "name": "Paracetamol 500mg Strip/10",
      "stock_group": "Analgesics",
      "base_unit": "Strip",
      "hsn_code": "30049099",
      "gst_rate": 12.0,
      "selling_price": 50.00,
      "available_qty": 250,
      "drug_schedule": "OTC",
      "manufacturer": "Cipla"
    }
  ],
  "total": 1200,
  "page": 1
}
```

### 2. Stock Item Batches

```
GET /stock-items/:id/batches
```

Returns batch-level detail with expiry dates. Critical for pharma FIFO.

| Param | Type | Description |
|-------|------|-------------|
| `exclude_expired` | bool | Hide expired batches |
| `godown` | string | Filter by godown |

**Response:**

```json
{
  "item_name": "Paracetamol 500mg Strip/10",
  "batches": [
    {
      "batch_name": "B2026-001",
      "godown": "Main Location",
      "mfg_date": "2025-06-01",
      "expiry_date": "2027-05-31",
      "closing_qty": 150,
      "days_to_expiry": 432
    }
  ]
}
```

:::tip
The sales app should highlight batches expiring within 90 days in yellow and within 30 days in red. Help the salesman push near-expiry stock first.
:::

### 3. Stock Availability by Godown

```
GET /stock-items/:id/availability
```

Shows stock position across all godowns for a single item.

**Response:**

```json
{
  "item_name": "Paracetamol 500mg Strip/10",
  "godowns": [
    {
      "godown": "Main Location",
      "closing_qty": 200,
      "pending_orders": 50,
      "available_qty": 150
    },
    {
      "godown": "Counter Stock",
      "closing_qty": 50,
      "pending_orders": 0,
      "available_qty": 50
    }
  ],
  "total_available": 200
}
```

### 4. List Godowns

```
GET /godowns
```

Simple listing of all storage locations. Useful for order placement dropdowns.

**Response:**

```json
{
  "godowns": [
    {
      "id": "uuid",
      "name": "Main Location",
      "parent": null,
      "address": "Warehouse, GIDC"
    }
  ]
}
```

### 5. List Parties

```
GET /parties
```

List customers (Sundry Debtors) or suppliers (Sundry Creditors).

| Param | Type | Description |
|-------|------|-------------|
| `type` | string | `sundry_debtors` or `sundry_creditors` |
| `territory` | string | Filter by territory/group |
| `search` | string | Search by name, GSTIN |
| `has_outstanding` | bool | Only parties with balance |

**Response includes outstanding balance and last order date:**

```json
{
  "parties": [
    {
      "id": "uuid",
      "name": "Raj Medical Store",
      "group": "Ahmedabad Parties",
      "gstin": "24ABCDE1234F1Z5",
      "outstanding": 45000.00,
      "credit_limit": 100000.00,
      "last_order_date": "2026-03-20",
      "phone": "+91-9876543210"
    }
  ]
}
```

### 6. Create Order

```
POST /orders
```

The salesman places a new order. This is the write path.

**Request body:**

```json
{
  "party_ledger_name": "Raj Medical Store",
  "order_date": "2026-03-26",
  "due_date": "2026-04-02",
  "notes": "Urgent: flu season stock",
  "items": [
    {
      "stock_item_name": "Paracetamol 500mg Strip/10",
      "quantity": 100,
      "unit": "Strip",
      "rate": 50.00,
      "godown": "Main Location"
    }
  ]
}
```

:::caution
Stock item names must match Tally exactly. The app should use autocomplete from the cached stock items list, never free-text entry. Tally is case-sensitive.
:::

**Response:**

```json
{
  "id": "uuid",
  "order_number": "FIELD/20260326/001",
  "status": "draft",
  "total_amount": 5900.00,
  "gst_amount": 900.00
}
```

### 7. List Orders

```
GET /orders
```

| Param | Type | Description |
|-------|------|-------------|
| `status` | string | Filter by order status |
| `party` | string | Filter by party name/ID |
| `from` | date | Order date range start |
| `to` | date | Order date range end |

### 8. Confirm Order (Push to Tally)

```
POST /orders/:id/confirm
```

Transitions the order from `draft` to `confirmed`. The connector picks it up and pushes it to Tally as a Sales Order voucher.

**Response:**

```json
{
  "id": "uuid",
  "status": "confirmed",
  "message": "Order queued for Tally push"
}
```

Once the connector successfully pushes to Tally:

```json
{
  "id": "uuid",
  "status": "tally_confirmed",
  "tally_voucher_number": "SO/FIELD/0042",
  "tally_master_id": 12345
}
```

:::danger
If the order push fails (e.g., party ledger doesn't exist, stock item mismatch), the status becomes `failed` with the error from Tally in `tally_push_error`. The connector will auto-create missing party ledgers if `auto_create_ledgers = true` in the config.
:::

### 9. Expiry Alerts

```
GET /expiry-alerts
```

| Param | Type | Description |
|-------|------|-------------|
| `days_ahead` | int | Alert window (default: 30) |
| `godown` | string | Filter by godown |

**Response:**

```json
{
  "alerts": [
    {
      "item_name": "Amoxicillin 250mg Cap/10",
      "batch_name": "B2025-044",
      "expiry_date": "2026-04-15",
      "days_remaining": 20,
      "closing_qty": 75,
      "godown": "Main Location"
    }
  ]
}
```

### 10. Reorder Alerts

```
GET /reorder-alerts
```

Items where `available_qty` has fallen below the `reorder_level` set in Tally.

**Response:**

```json
{
  "alerts": [
    {
      "item_name": "Cetirizine 10mg Tab/10",
      "available_qty": 20,
      "reorder_level": 100,
      "reorder_quantity": 500,
      "last_purchase_date": "2026-02-15"
    }
  ]
}
```

### 11. Sync Health Status

```
GET /sync-status
```

Shows whether the connector is healthy and data is fresh.

**Response:**

```json
{
  "connector_status": "online",
  "tally_reachable": true,
  "last_master_sync": "2026-03-26T10:30:00Z",
  "last_voucher_sync": "2026-03-26T10:31:00Z",
  "last_report_sync": "2026-03-26T10:25:00Z",
  "push_queue_depth": 0,
  "sync_lag_seconds": 45,
  "tally_version": "TallyPrime:Release 7.0"
}
```

:::tip
If `sync_lag_seconds` exceeds 1800 (30 minutes), the sales app should show a "data may be stale" warning to the user. If `tally_reachable` is false, show "Tally is offline — showing cached data."
:::

### 12. Party Order History

```
GET /parties/:id/order-history
```

All orders placed for a specific party, across time.

| Param | Type | Description |
|-------|------|-------------|
| `from` | date | Start date |
| `to` | date | End date |
| `status` | string | Filter by order status |

## Error Responses

All endpoints return consistent error shapes:

```json
{
  "error": {
    "code": "ITEM_NOT_FOUND",
    "message": "Stock item not found",
    "details": {}
  }
}
```

| HTTP Status | When |
|-------------|------|
| 400 | Validation error (bad params, missing fields) |
| 401 | Missing or invalid auth token |
| 404 | Resource not found |
| 409 | Conflict (duplicate order number) |
| 503 | Tally unreachable, data stale |

## Rate Limiting

The API applies per-tenant rate limits:

| Tier | Requests/min |
|------|-------------|
| Read endpoints | 300 |
| Write endpoints | 60 |
| Bulk exports | 10 |
