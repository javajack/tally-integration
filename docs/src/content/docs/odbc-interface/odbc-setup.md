---
title: ODBC Setup
description: How to enable and configure ODBC access in Tally. Connect from Excel, Python, or any ODBC-compatible client.
---

Tally exposes an ODBC interface that lets you query its data using SQL-like syntax. It's not the primary integration method (the XML/JSON HTTP API is), but it's incredibly useful for quick queries, Excel reports, and data validation.

## Enabling ODBC in Tally

### Step 1: Open Tally Configuration

```
Gateway of Tally
  > F1 (Help / Settings)
    > Settings
      > Connectivity
```

Or in TallyPrime:

```
Gateway of Tally
  > F1 (Help)
    > Settings
      > Connectivity
        > Enable ODBC Server: Yes
```

### Step 2: Set the Port

The default ODBC port is **9000** (same as the HTTP server on older versions) or a separate port like **9001**. Configure it to avoid conflicts:

```
ODBC Server Port: 9001
```

:::caution
In some Tally versions, the ODBC server and HTTP server share the same port. In others, they're separate. If you're already using port 9000 for the HTTP API, set ODBC to a different port.
:::

### Step 3: Restart Tally

ODBC settings take effect after a restart. Close and reopen Tally with a company loaded.

### Step 4: Verify

You should see a message in Tally's status bar or info panel indicating the ODBC server is active.

## Connecting from Excel

Excel's Microsoft Query feature can connect directly to Tally's ODBC interface. This is the most common use case -- stockists and CAs love pulling data into Excel.

### Setup Steps

1. **Open Excel** > Data tab > Get Data > From Other Sources > From Microsoft Query

2. **Choose Data Source**: Select "Tally ODBC" (if the driver is registered) or create a new DSN:
   - Driver: Tally ODBC Driver
   - Server: `localhost`
   - Port: `9001`

3. **Select Tables**: You'll see Tally's available collections (Ledger, StockItem, Voucher, etc.)

4. **Write Query**: Use Tally's SQL syntax (see [SQL Queries](/tally-integartion/odbc-interface/sql-queries/))

5. **Import**: Data flows into your Excel sheet

:::tip
For recurring reports, save the query in Excel. It will refresh from Tally each time you open the workbook (or on demand). Great for daily stock position reports that the stockist can email to their team.
:::

## Connecting from Python

Python's `pyodbc` library works with Tally's ODBC interface. This is useful for scripting, data validation, and quick ad-hoc analysis.

### Install pyodbc

```bash
pip install pyodbc
```

### Connection String

```python
import pyodbc

conn = pyodbc.connect(
    "Driver={Tally ODBC Driver};"
    "Server=localhost;"
    "Port=9001;"
)

cursor = conn.cursor()
cursor.execute(
    "SELECT $Name, $ClosingBalance "
    "FROM Ledger"
)

for row in cursor.fetchall():
    print(row.Name, row.ClosingBalance)

conn.close()
```

### On Linux (via unixODBC)

If your connector runs on Linux and connects to a remote Tally (on Windows), you'll need:

1. **unixODBC** installed
2. The Tally ODBC driver (Windows-only, so you'd need a bridge like FreeTDS or an ODBC-HTTP proxy)

:::caution
Tally's ODBC driver is Windows-only. For Linux/Mac, you're better off using the HTTP API (XML or JSON). ODBC is mainly useful when you're on the same Windows machine as Tally.
:::

## Connecting from Any ODBC Client

Any application that supports ODBC can connect to Tally:

| Client | Connection Method |
|---|---|
| Excel | Microsoft Query / Power Query |
| Python | pyodbc |
| .NET / C# | System.Data.Odbc |
| Java | JDBC-ODBC Bridge |
| Power BI | ODBC data source |
| LibreOffice | Base (ODBC connector) |
| DBeaver | Generic ODBC driver |

### Generic DSN Configuration

Create a System DSN (Windows):

```
1. Open ODBC Data Source Administrator
   (Start > search "ODBC")

2. System DSN tab > Add

3. Select "Tally ODBC Driver"

4. Configure:
   - Data Source Name: TallyODBC
   - Server: localhost
   - Port: 9001
   - Company: (leave blank for default)

5. Test Connection > OK
```

## Port Configuration Best Practices

| Service | Suggested Port | Notes |
|---|---|---|
| Tally HTTP API | 9000 | Primary integration channel |
| Tally ODBC | 9001 | Ad-hoc queries and Excel |

Keep these ports consistent across all stockist installations. Document them in your onboarding checklist.

## Firewall Considerations

If connecting from a remote machine (not localhost):

- Tally must be configured to accept remote connections
- Windows Firewall must allow inbound on the ODBC port
- Network firewall must allow the traffic

For security, we recommend keeping ODBC on localhost only and using the HTTP API for remote connections.

## Troubleshooting

| Problem | Cause | Fix |
|---|---|---|
| Connection refused | ODBC not enabled | Check Tally settings |
| No tables visible | No company loaded | Open a company in Tally |
| Query returns empty | Wrong company context | Specify company in DSN |
| Driver not found | Not installed | Check Tally installation |

## Next Steps

- [SQL Queries](/tally-integartion/odbc-interface/sql-queries/) -- learn Tally's SQL dialect with the `$` prefix
- [Limitations](/tally-integartion/odbc-interface/limitations/) -- what ODBC can't do (and when to use the HTTP API instead)
