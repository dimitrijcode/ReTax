# Fixtures

Demo data for `RETAX_MODE=fixture` (the default).

| File | Role |
| --- | --- |
| `calendar.json` | Calendar event **Laptop kaufen** (12.09.2026) |
| `gmail.json` | Matching mail with a PDF invoice attachment |
| `invoice.json` | Extracted invoice fields (vendor, date, number, net/vat/gross) |
| `laptop-invoice.pdf` | Generated invoice PDF (`pnpm fixtures:pdf`) |

The web orchestrator and `@retax/mcp-server` fixture tools read these files directly. No Google or Anthropic keys are required.
