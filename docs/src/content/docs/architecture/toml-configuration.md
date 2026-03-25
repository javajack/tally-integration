---
title: TOML Configuration Reference
description: Complete reference for the connector's config.toml file — covering Tally connection settings, sync intervals, write-back options, cache management, central API configuration, and auto-discovery.
---

The connector reads its configuration from a `config.toml` file. By default it looks for this file in the same directory as the binary. You can override the path with the `--config` flag.

## Full Example Config

Here's a complete, annotated configuration file. Copy this as your starting point.

```toml
# =============================================
# Tally Connector Configuration
# =============================================

# --- Tally Connection ---
[tally]
# TallyPrime HTTP server address
host = "localhost"
# Default Tally port (check F1 > Settings)
port = 9000
# Connection timeout for each HTTP request
timeout = "30s"
# If blank, connector discovers and syncs
# ALL loaded companies. If set, only this
# company is synced.
company = ""

# --- Sync Engine ---
[sync]
# How often to poll master data (seconds)
master_interval_seconds = 300
# How often to poll voucher data (seconds)
voucher_interval_seconds = 60
# How often to pull computed reports
report_interval_seconds = 600
# Max vouchers per HTTP export request
# WARNING: >5000 can freeze Tally
voucher_batch_size = 5000
# How to batch voucher exports
# Options: "daily" | "monthly" | "single"
date_batch_mode = "daily"
# Historical depth for initial sync
# Options:
#   "current_fy"
#   "current_plus_previous"
#   "all"
#   "custom"
historical_depth = "current_plus_previous"
# Only used if historical_depth = "custom"
custom_from_date = "2024-04-01"
# Run a full reconciliation this often
# to catch AlterID drift and deletions
full_reconcile_interval = "24h"
# Run full sync on connector startup
full_sync_on_start = true
# Max objects per collection export
max_collection_size = 5000
# How many days of data to retain locally
retain_days = 730

# --- Write-Back (Orders to Tally) ---
[writeback]
# Enable pushing orders back to Tally
enabled = true
# Auto-create party ledgers under
# Sundry Debtors if they don't exist
auto_create_ledgers = true
# Prefix for field-generated voucher numbers
# Uses format: FIELD/{timestamp}
voucher_number_prefix = "FIELD/"
# Max retry attempts for failed pushes
max_retry = 5
# Backoff schedule in seconds
retry_backoff_seconds = [5, 30, 120, 600, 3600]
# Max vouchers per import TALLYMESSAGE
batch_size = 50

# --- Local Cache ---
[cache]
# Path to the SQLite database file
db_path = "./tally-cache.db"
# Max database file size (approximate)
# Connector warns when approaching this
max_size = "2GB"

# --- Central API ---
[central]
# URL of the central API server
api_url = "https://api.example.com"
# API key (prefer env var for security)
# Set TALLY_CONNECTOR_API_KEY env var
# or specify directly here
api_key = ""
# Environment variable name for API key
api_key_env = "TALLY_CONNECTOR_API_KEY"
# Tenant identifier for this stockist
tenant_id = "stockist-001"
# How often to drain the push queue
push_interval_seconds = 15
# Compress payloads with gzip
compression = true
# Max retries for central API calls
max_retries = 5

# --- Discovery & Profiling ---
[discovery]
# Profile Tally on startup (version,
# features, TDLs, UDFs)
profile_on_start = true
# Auto-detect loaded companies
auto_detect = true
# Match companies by GSTIN to filter
# which ones to sync
gstin_match = ""
# Detect UDFs from sample exports
detect_udfs = true
# Detect custom voucher types
detect_custom_voucher_types = true

# --- Logging ---
[logging]
# Log level: debug, info, warn, error
level = "info"
# Log file path
file = "./tally-connector.log"
# Max log file size before rotation
max_size = "100MB"
# Number of rotated log files to keep
max_backups = 5
```

## Section Reference

### [tally]

Controls how the connector talks to TallyPrime.

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `host` | string | `"localhost"` | Tally HTTP server host |
| `port` | int | `9000` | Tally HTTP server port |
| `timeout` | duration | `"30s"` | Per-request timeout |
| `company` | string | `""` | Target company (blank = all) |

:::tip
You can find Tally's port in TallyPrime under F1 (Help) > Settings > Advanced Configuration > Port. The default is 9000 but stockists sometimes change it.
:::

### [sync]

Controls the polling engine and data depth.

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `master_interval_seconds` | int | `300` | Master data poll interval |
| `voucher_interval_seconds` | int | `60` | Voucher poll interval |
| `report_interval_seconds` | int | `600` | Report extraction interval |
| `voucher_batch_size` | int | `5000` | Max vouchers per request |
| `date_batch_mode` | string | `"daily"` | Export batching strategy |
| `historical_depth` | string | `"current_plus_previous"` | How far back to sync |
| `full_reconcile_interval` | duration | `"24h"` | Full-sync frequency |

:::caution
Setting `voucher_batch_size` above 5000 risks freezing Tally. The operator will be unable to use Tally until the export completes. Stick with the default or lower.
:::

### [writeback]

Controls how field orders are pushed back into Tally.

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `enabled` | bool | `true` | Enable write-back |
| `auto_create_ledgers` | bool | `true` | Auto-create missing party ledgers |
| `voucher_number_prefix` | string | `"FIELD/"` | Prefix for generated voucher numbers |
| `max_retry` | int | `5` | Max push attempts |
| `retry_backoff_seconds` | int[] | `[5,30,120,600,3600]` | Backoff schedule |
| `batch_size` | int | `50` | Vouchers per TALLYMESSAGE |

### [cache]

Local SQLite configuration.

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `db_path` | string | `"./tally-cache.db"` | SQLite file path |
| `max_size` | string | `"2GB"` | Size warning threshold |

### [central]

Connection to the central API server.

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `api_url` | string | required | Central API base URL |
| `api_key` | string | `""` | API key (direct) |
| `api_key_env` | string | `"TALLY_CONNECTOR_API_KEY"` | Env var for API key |
| `tenant_id` | string | required | This stockist's tenant ID |
| `push_interval_seconds` | int | `15` | Push queue drain interval |
| `compression` | bool | `true` | Gzip payloads |

:::danger
Never commit `api_key` directly in a config file that's checked into version control. Use the `api_key_env` approach and set the environment variable on the machine.
:::

### [discovery]

First-connect profiling and auto-detection.

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `profile_on_start` | bool | `true` | Run Tally profiling on startup |
| `auto_detect` | bool | `true` | Auto-detect loaded companies |
| `gstin_match` | string | `""` | Filter companies by GSTIN |
| `detect_udfs` | bool | `true` | Discover UDFs from sample exports |

## Environment Variable Overrides

Any config key can be overridden via environment variable using the pattern `TALLY_CONNECTOR_<SECTION>_<KEY>`:

```bash
set TALLY_CONNECTOR_TALLY_PORT=9001
set TALLY_CONNECTOR_CENTRAL_API_URL=https://staging.example.com
set TALLY_CONNECTOR_SYNC_HISTORICAL_DEPTH=all
```

Environment variables take precedence over the TOML file.

## Minimal Config for Quick Start

If you just want to get running fast:

```toml
[tally]
port = 9000

[central]
api_url = "https://api.example.com"
tenant_id = "my-stockist"

[cache]
db_path = "./tally-cache.db"
```

Everything else uses sensible defaults. Set the `TALLY_CONNECTOR_API_KEY` environment variable and you're off.

## Config Validation

On startup, the connector validates the config and exits with a clear error if something's wrong:

```
ERROR: [central] api_url is required
ERROR: [central] tenant_id is required
ERROR: [tally] port must be between 1 and 65535
```

:::tip
Run `tally-connector.exe --validate` to check your config without starting the sync engine. Useful during setup.
:::
