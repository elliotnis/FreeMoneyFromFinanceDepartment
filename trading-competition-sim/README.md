# Trading Competition Simulation (Standalone)

This is a standalone side project, independent of the sign-up system.

## Run

From the repo root:

```bash
cd trading-competition-sim
python -m http.server 4173
```

Open `http://localhost:4173` in your browser.

For Docker Compose hosting:

- Host URL: `http://localhost:4173` (override with `TRADING_SIM_PORT` in repo `.env`).

If the main frontend is already running, the simulation is also available at:

- Docker frontend: `http://localhost:8080/trading-sim/`
- Vite dev frontend: `http://localhost:5173/trading-sim/`

## Features

- Email-code login (demo OTP stored locally).
- Market dashboard with multiple stocks and current prices by year.
- Year-based trading: orders can be placed only in the active simulation year at its opening.
- Buy shares by **amount** and **year**.
- Position table with unrealized PnL.
- Portfolio summary and PnL line chart.
- News dashboard that updates by simulation year.
