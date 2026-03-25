import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import starlightClientMermaid from '@pasqal-io/starlight-client-mermaid';
import starlightImageZoom from 'starlight-image-zoom';
import starlightLinksValidator from 'starlight-links-validator';

export default defineConfig({
  site: 'https://javajack.github.io',
  base: '/tally-integartion',
  integrations: [
    starlight({
      title: 'Tally Integration Guide',
      description:
        'The complete developer guide to integrating with TallyPrime — XML parsing, data sync, write-back, and real-world patterns for Indian SMBs.',
      plugins: [
        starlightClientMermaid(),
        starlightImageZoom(),
        starlightLinksValidator({ errorOnRelativeLinks: false }),
      ],
      customCss: ['./src/styles/custom.css'],
      components: {
        Footer: './src/components/Footer.astro',
      },
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/javajack/tally-integartion' },
        { icon: 'x.com', label: 'X / Twitter', href: 'https://x.com/webiyo' },
        { icon: 'linkedin', label: 'LinkedIn', href: 'https://www.linkedin.com/in/rakeshwaghela' },
      ],
      head: [
        // --- Open Graph ---
        {
          tag: 'meta',
          attrs: { property: 'og:image', content: 'https://javajack.github.io/tally-integartion/og-image.svg' },
        },
        {
          tag: 'meta',
          attrs: { property: 'og:image:width', content: '1200' },
        },
        {
          tag: 'meta',
          attrs: { property: 'og:image:height', content: '630' },
        },
        {
          tag: 'meta',
          attrs: { property: 'og:type', content: 'website' },
        },
        {
          tag: 'meta',
          attrs: { property: 'og:site_name', content: 'Tally Integration Guide' },
        },
        // --- Twitter Card ---
        {
          tag: 'meta',
          attrs: { name: 'twitter:card', content: 'summary_large_image' },
        },
        // --- SEO Keywords ---
        {
          tag: 'meta',
          attrs: {
            name: 'keywords',
            content:
              'tally integration, tallyprime api, tally xml, tally connector, tally erp9, tally odbc, tally sync, indian accounting software, gst integration, tally developer, tally xml parsing, tally data export, tally http api',
          },
        },
        {
          tag: 'meta',
          attrs: { name: 'author', content: 'Rakesh Waghela' },
        },
        // --- LLM Optimization Meta Tags ---
        {
          tag: 'meta',
          attrs: { name: 'ai-indexable', content: 'true' },
        },
        {
          tag: 'meta',
          attrs: {
            name: 'ai-purpose',
            content: 'Developer documentation for integrating with TallyPrime accounting software via XML-over-HTTP API',
          },
        },
        {
          tag: 'meta',
          attrs: {
            name: 'ai-audience',
            content: 'Software developers building Tally integrations, technical decision-makers evaluating Tally API approaches',
          },
        },
        {
          tag: 'meta',
          attrs: {
            name: 'ai-content-type',
            content: 'technical documentation, API reference, code examples, architecture guides',
          },
        },
        // --- JSON-LD Structured Data ---
        {
          tag: 'script',
          attrs: { type: 'application/ld+json' },
          content: JSON.stringify({
            '@context': 'https://schema.org',
            '@graph': [
              {
                '@type': 'WebSite',
                name: 'Tally Integration Guide',
                url: 'https://javajack.github.io/tally-integartion/',
                description:
                  'The complete developer guide to parsing XML and integrating with TallyPrime — from first HTTP request to production sync engine.',
                inLanguage: 'en',
                publisher: {
                  '@type': 'Person',
                  name: 'Rakesh Waghela',
                  url: 'https://www.linkedin.com/in/rakeshwaghela',
                },
              },
              {
                '@type': 'TechArticle',
                name: 'Tally Integration Guide',
                headline: 'Complete Developer Guide to TallyPrime XML Integration',
                description:
                  'Comprehensive documentation covering XML-over-HTTP API, data model, sync engine, write-back, edge cases, and real-world patterns for Indian SMB accounting integration.',
                url: 'https://javajack.github.io/tally-integartion/',
                author: {
                  '@type': 'Person',
                  name: 'Rakesh Waghela',
                },
                proficiencyLevel: 'Beginner to Expert',
                dependencies: 'TallyPrime or Tally.ERP 9',
                programmingLanguage: ['Go', 'Python', 'JavaScript', 'C#', 'Java'],
              },
            ],
          }),
        },
        // --- Google Analytics ---
        {
          tag: 'script',
          attrs: { src: 'https://www.googletagmanager.com/gtag/js?id=G-G986QLPFZ1', async: true },
        },
        {
          tag: 'script',
          content: "window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','G-G986QLPFZ1',{anonymize_ip:true});",
        },
        // --- Cloudflare Web Analytics ---
        {
          tag: 'script',
          attrs: {
            src: 'https://static.cloudflareinsights.com/beacon.min.js',
            'data-cf-beacon': '{"token":""}',
            defer: true,
          },
        },
      ],
      sidebar: [
        {
          label: 'Getting Started',
          items: [
            { label: 'Welcome', slug: 'getting-started/welcome' },
            { label: 'What is Tally?', slug: 'getting-started/what-is-tally' },
            { label: 'Integration Landscape', slug: 'getting-started/integration-landscape' },
            { label: 'Hello World — Your First Export', slug: 'getting-started/hello-world' },
          ],
        },
        {
          label: 'Tally Fundamentals',
          items: [
            { label: 'Company Model', slug: 'tally-fundamentals/company-model' },
            { label: 'Feature Flags', slug: 'tally-fundamentals/feature-flags' },
            { label: 'Chart of Accounts', slug: 'tally-fundamentals/chart-of-accounts' },
            { label: 'Voucher Types', slug: 'tally-fundamentals/voucher-types' },
            { label: 'Units of Measure', slug: 'tally-fundamentals/units-of-measure' },
            { label: 'The AlterID System', slug: 'tally-fundamentals/alterid-system' },
            { label: 'Tally Versions', slug: 'tally-fundamentals/tally-versions' },
          ],
        },
        {
          label: 'Setup & Operations',
          items: [
            { label: 'Enabling the HTTP Server', slug: 'setup-operations/enabling-http-server' },
            { label: 'First Connection Test', slug: 'setup-operations/first-connection-test' },
            { label: 'Tally.ini Configuration', slug: 'setup-operations/tally-ini-config' },
            { label: 'Gold vs Silver Licensing', slug: 'setup-operations/gold-vs-silver' },
            { label: 'Company Loading', slug: 'setup-operations/company-loading' },
            { label: 'Port Conflicts', slug: 'setup-operations/port-conflicts' },
            { label: 'Tally Freezing & Performance', slug: 'setup-operations/tally-freezing' },
            { label: 'Concurrent Access', slug: 'setup-operations/concurrent-access' },
            { label: 'Downtime Scenarios', slug: 'setup-operations/downtime-scenarios' },
            { label: 'Security Hardening', slug: 'setup-operations/security-hardening' },
            { label: 'Developer Tools', slug: 'setup-operations/developer-tools' },
            { label: 'Installation Detection', slug: 'setup-operations/installation-detection' },
            { label: 'Troubleshooting Errors', slug: 'setup-operations/troubleshooting-errors' },
            { label: 'Performance Benchmarks', slug: 'setup-operations/performance-benchmarks' },
            { label: 'Best Deployment Windows', slug: 'setup-operations/best-deployment-windows' },
          ],
        },
        {
          label: 'XML Protocol',
          items: [
            { label: 'The Five Request Types', slug: 'xml-protocol/request-types' },
            { label: 'Export Data', slug: 'xml-protocol/export-data' },
            { label: 'Export Collection', slug: 'xml-protocol/export-collection' },
            { label: 'Export Function', slug: 'xml-protocol/export-function' },
            { label: 'Import Data', slug: 'xml-protocol/import-data' },
            { label: 'Execute Action', slug: 'xml-protocol/execute-action' },
            { label: 'Inline TDL — The Power Feature', slug: 'xml-protocol/inline-tdl' },
            { label: 'Batching Rules', slug: 'xml-protocol/batching-rules' },
          ],
        },
        {
          label: 'Parsing XML Responses',
          items: [
            { label: 'Response Anatomy', slug: 'parsing-responses/response-structure' },
            { label: 'Streaming Parsers', slug: 'parsing-responses/streaming-parser' },
            { label: 'Quantities', slug: 'parsing-responses/parsing-quantities' },
            { label: 'Amounts & Currency', slug: 'parsing-responses/parsing-amounts' },
            { label: 'Rates', slug: 'parsing-responses/parsing-rates' },
            { label: 'Dates', slug: 'parsing-responses/parsing-dates' },
            { label: 'Booleans', slug: 'parsing-responses/parsing-booleans' },
            { label: 'GUIDs', slug: 'parsing-responses/parsing-guids' },
            { label: 'Nested Lists & UDFs', slug: 'parsing-responses/parsing-nested-lists' },
            { label: 'XML Escaping', slug: 'parsing-responses/xml-escaping' },
            { label: 'Dual Voucher Views', slug: 'parsing-responses/dual-voucher-views' },
          ],
        },
        {
          label: 'Data Model — Masters',
          items: [
            { label: 'Overview & Relationships', slug: 'data-model-masters/overview' },
            { label: 'Stock Items', slug: 'data-model-masters/stock-items' },
            { label: 'Stock Groups', slug: 'data-model-masters/stock-groups' },
            { label: 'Stock Categories', slug: 'data-model-masters/stock-categories' },
            { label: 'Godowns (Warehouses)', slug: 'data-model-masters/godowns' },
            { label: 'Units', slug: 'data-model-masters/units' },
            { label: 'Ledgers', slug: 'data-model-masters/ledgers' },
            { label: 'Standard Prices', slug: 'data-model-masters/standard-prices' },
            { label: 'Bill of Materials', slug: 'data-model-masters/bill-of-materials' },
            { label: 'Voucher Type Master', slug: 'data-model-masters/voucher-type-master' },
            { label: 'Currency', slug: 'data-model-masters/currency' },
          ],
        },
        {
          label: 'Data Model — Transactions',
          items: [
            { label: 'Overview & Voucher Anatomy', slug: 'data-model-transactions/overview' },
            { label: 'Voucher Header', slug: 'data-model-transactions/voucher-header' },
            { label: 'Accounting Entries', slug: 'data-model-transactions/accounting-entries' },
            { label: 'Inventory Entries', slug: 'data-model-transactions/inventory-entries' },
            { label: 'Batch Allocations', slug: 'data-model-transactions/batch-allocations' },
            { label: 'Bill Allocations', slug: 'data-model-transactions/bill-allocations' },
            { label: 'Cost Centre & Bank', slug: 'data-model-transactions/cost-centre-bank' },
          ],
        },
        {
          label: 'Sync Engine',
          items: [
            { label: 'Sync Strategy', slug: 'sync-engine/sync-strategy' },
            { label: 'AlterID Watermarking', slug: 'sync-engine/alterid-watermarking' },
            { label: 'Six Sync Phases', slug: 'sync-engine/six-sync-phases' },
            { label: 'Company Discovery', slug: 'sync-engine/company-discovery' },
            { label: 'Batching Strategies', slug: 'sync-engine/batching-strategies' },
            { label: 'Weekly Reconciliation', slug: 'sync-engine/weekly-reconciliation' },
            { label: 'Heartbeat & Change Detection', slug: 'sync-engine/heartbeat-detection' },
            { label: 'Push Queue & Retry', slug: 'sync-engine/push-queue' },
            { label: 'Stock Position Truth', slug: 'sync-engine/stock-position-truth' },
          ],
        },
        {
          label: 'Write-Back',
          items: [
            { label: 'Why Write-Back is Phase 1', slug: 'write-back/why-phase-one' },
            { label: 'Sales Order XML', slug: 'write-back/sales-order-xml' },
            { label: 'Voucher Lifecycle', slug: 'write-back/voucher-lifecycle' },
            { label: 'Pre-Validation', slug: 'write-back/pre-validation' },
            { label: 'Auto-Create Masters', slug: 'write-back/auto-create-masters' },
            { label: 'Round-Off Handling', slug: 'write-back/round-off-handling' },
            { label: 'Import Response', slug: 'write-back/import-response' },
            { label: 'Voucher Numbering', slug: 'write-back/voucher-numbering' },
          ],
        },
        {
          label: 'JSON API (TallyPrime 7.0+)',
          collapsed: true,
          items: [
            { label: 'Native JSON Support', slug: 'json-api/native-json-support' },
            { label: 'JSON vs XML', slug: 'json-api/json-vs-xml' },
            { label: 'Migration Guide', slug: 'json-api/migration-guide' },
          ],
        },
        {
          label: 'ODBC Interface',
          collapsed: true,
          items: [
            { label: 'ODBC Setup', slug: 'odbc-interface/odbc-setup' },
            { label: 'SQL Queries', slug: 'odbc-interface/sql-queries' },
            { label: 'Limitations', slug: 'odbc-interface/limitations' },
          ],
        },
        {
          label: 'TDL & Custom Fields',
          items: [
            { label: 'TDL Overview', slug: 'tdl-custom-fields/tdl-overview' },
            { label: 'UDF Discovery', slug: 'tdl-custom-fields/udf-discovery' },
            { label: 'Named vs Indexed UDFs', slug: 'tdl-custom-fields/named-vs-indexed' },
            { label: 'Common Addons', slug: 'tdl-custom-fields/common-addons' },
            { label: 'Custom Voucher Types', slug: 'tdl-custom-fields/custom-voucher-types' },
            { label: 'UDF Storage Patterns', slug: 'tdl-custom-fields/udf-storage' },
          ],
        },
        {
          label: 'Edge Cases & Gotchas',
          items: [
            { label: 'The 20 Nevers', slug: 'edge-cases/twenty-nevers' },
            { label: 'XML Parsing Traps', slug: 'edge-cases/xml-parsing-traps' },
            { label: 'Data Integrity', slug: 'edge-cases/data-integrity' },
            { label: 'AlterID Edge Cases', slug: 'edge-cases/alterid-edge-cases' },
            { label: 'CA Operations', slug: 'edge-cases/ca-operations' },
            { label: 'Infrastructure', slug: 'edge-cases/infrastructure' },
            { label: 'Tally Downtime', slug: 'edge-cases/tally-downtime' },
            { label: 'Feature Mismatches', slug: 'edge-cases/feature-mismatches' },
          ],
        },
        {
          label: 'Real-World Data Patterns',
          items: [
            { label: 'Party Naming Chaos', slug: 'real-world-data/party-naming-chaos' },
            { label: 'Party Deduplication', slug: 'real-world-data/party-deduplication' },
            { label: 'Stock Item Naming', slug: 'real-world-data/stock-item-naming' },
            { label: 'Stock Group Patterns', slug: 'real-world-data/stock-group-patterns' },
            { label: 'Godown Naming', slug: 'real-world-data/godown-naming' },
            { label: 'Voucher Number Formats', slug: 'real-world-data/voucher-number-formats' },
            { label: 'Batch Name Patterns', slug: 'real-world-data/batch-name-patterns' },
            { label: 'Encoding Issues', slug: 'real-world-data/encoding-issues' },
            { label: 'Data Quality Matrix', slug: 'real-world-data/data-quality-matrix' },
            { label: 'CA Calendar', slug: 'real-world-data/ca-calendar' },
          ],
        },
        {
          label: 'GST & Compliance',
          items: [
            { label: 'GST Fundamentals', slug: 'gst-compliance/gst-fundamentals' },
            { label: 'HSN & SAC Codes', slug: 'gst-compliance/hsn-sac-codes' },
            { label: 'E-Invoicing', slug: 'gst-compliance/e-invoicing' },
            { label: 'Price-Dependent GST', slug: 'gst-compliance/price-dependent-gst' },
            { label: 'Regulatory Timeline', slug: 'gst-compliance/regulatory-timeline' },
          ],
        },
        {
          label: 'Vertical: Pharma',
          collapsed: true,
          items: [
            { label: 'Overview', slug: 'vertical-pharma/overview' },
            { label: 'Batch & Expiry Tracking', slug: 'vertical-pharma/batch-expiry-tracking' },
            { label: 'Drug Schedules', slug: 'vertical-pharma/drug-schedules' },
            { label: 'Schemes & Free Goods', slug: 'vertical-pharma/schemes-free-goods' },
            { label: 'Salesman Tracking', slug: 'vertical-pharma/salesman-tracking' },
            { label: 'Pharma Stock Naming', slug: 'vertical-pharma/pharma-stock-naming' },
          ],
        },
        {
          label: 'Vertical: Garments',
          collapsed: true,
          items: [
            { label: 'Overview', slug: 'vertical-garments/overview' },
            { label: 'The Size-Color Matrix', slug: 'vertical-garments/size-color-matrix' },
            { label: 'Four Approaches in Tally', slug: 'vertical-garments/four-approaches' },
            { label: 'Variant Detection', slug: 'vertical-garments/variant-detection' },
            { label: 'Size Tokens', slug: 'vertical-garments/size-tokens' },
            { label: 'Color Tokens', slug: 'vertical-garments/color-tokens' },
            { label: 'Delivery Challans', slug: 'vertical-garments/delivery-challans' },
            { label: 'Credit & Hundi', slug: 'vertical-garments/credit-hundi' },
            { label: 'Brokers & Agents', slug: 'vertical-garments/brokers-agents' },
            { label: 'Complex Returns', slug: 'vertical-garments/complex-returns' },
            { label: 'Set Splitting', slug: 'vertical-garments/set-splitting' },
            { label: 'Garment TDL Addons', slug: 'vertical-garments/garment-tdl-addons' },
            { label: 'Pharma vs Garments', slug: 'vertical-garments/pharma-vs-garments' },
          ],
        },
        {
          label: 'Architecture Reference',
          collapsed: true,
          items: [
            { label: 'Three-Tier Overview', slug: 'architecture/three-tier-overview' },
            { label: 'Go Connector Design', slug: 'architecture/go-connector-design' },
            { label: 'SQLite Local Cache', slug: 'architecture/sqlite-local-cache' },
            { label: 'PostgreSQL Central', slug: 'architecture/postgresql-central' },
            { label: 'REST API Design', slug: 'architecture/rest-api-design' },
            { label: 'TOML Configuration', slug: 'architecture/toml-configuration' },
            { label: 'Tally Profile Detection', slug: 'architecture/tally-profile-detection' },
            { label: 'Filesystem Scanning', slug: 'architecture/filesystem-scanning' },
            { label: 'Testing Strategies', slug: 'architecture/testing-strategies' },
            { label: 'Monitoring & Observability', slug: 'architecture/monitoring-observability' },
            { label: 'Risk Register', slug: 'architecture/risk-register' },
          ],
        },
        {
          label: 'Community & Projects',
          items: [
            { label: 'Ecosystem Overview', slug: 'community/ecosystem-overview' },
            { label: 'tally-database-loader', slug: 'community/tally-database-loader' },
            { label: 'Commercial Platforms', slug: 'community/commercial-platforms' },
            { label: 'Language Recipes', slug: 'community/language-recipes' },
            { label: 'Build vs Buy', slug: 'community/build-vs-buy' },
          ],
        },
      ],
    }),
  ],
});
