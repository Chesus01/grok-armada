import { Page, Section, Text, Metrics, Table, Properties, Grid, Status } from "grok/canvas";

// Grok Armada trading dashboard template.
// To build or refresh: run `node dashboard.js` in ~/armada-<tier>/scripts and paste its "data" object
// in place of the placeholder below (keep `const DATA = ` and the semicolon). Nothing else changes.
const DATA = /*__DATA__*/ {"updated":"","tier":"","status":"not run yet","lastRun":"","lastError":"","equity":0,"startEquity":0,"totalPnl":0,"dayPct":0,"realizedPnl":0,"unrealizedPnl":0,"volume":0,"volToday":0,"volGoal":0,"fees":0,"points":null,"tradesToday":0,"lossStreak":0,"limits":{},"markets":[],"regime":null,"top":[],"open":[],"history":[],"events":[]} as any;

const usd = (v: number): string => (v < 0 ? "-$" : "$") + Math.abs(v || 0).toFixed(2);
const tone = (v: number): "success" | "danger" | undefined => (v > 0 ? "success" : v < 0 ? "danger" : undefined);

export default function App() {
  const L = DATA.limits || {};
  const goal = DATA.volGoal || 0;
  return (
    <Page title={`Grok Armada ${DATA.tier ? DATA.tier[0].toUpperCase() + DATA.tier.slice(1) : ""} Dashboard`} width="wide" summary={`Equity, P&L, volume, open positions and trade log. Updated ${DATA.updated}.`}>
      <Section heading="Account">
        <Text>{`Total P&L ${usd(DATA.totalPnl)} since start (${usd(DATA.startEquity)}); today ${DATA.dayPct.toFixed(2)}%.`}</Text>
        <Metrics
          metrics={[
            { value: usd(DATA.equity), label: "Equity" },
            { value: usd(DATA.totalPnl), label: "Total P&L", tone: tone(DATA.totalPnl) },
            { value: DATA.dayPct.toFixed(2) + "%", label: "Today", tone: tone(DATA.dayPct) },
            { value: usd(DATA.realizedPnl), label: "Realized", tone: tone(DATA.realizedPnl) },
            { value: usd(DATA.unrealizedPnl), label: "Unrealized", tone: tone(DATA.unrealizedPnl) },
            { value: usd(DATA.volume), label: "Total volume" },
            { value: "$" + DATA.fees.toFixed(3), label: "Fees paid" },
            { value: DATA.points == null ? "—" : String(DATA.points), label: "Points", detail: "Credited weekly" },
          ]}
        />
      </Section>
      <Grid columns={2}>
        <Section heading="Bot status">
          <Properties
            items={[
              { label: "State", value: <Status tone={DATA.status === "running" ? "success" : "danger"}>{DATA.status}</Status> },
              { label: "Last run", value: DATA.lastRun || "—" },
              { label: "Last error", value: DATA.lastError || "None" },
              { label: "Trades today", value: `${DATA.tradesToday} of ${L.maxTradesDay ?? "—"}` },
              { label: "Loss streak", value: `${DATA.lossStreak} (stops at ${L.maxLossStreak ?? "—"})` },
            ]}
          />
        </Section>
        <Section heading="Today's volume">
          <Properties
            items={[
              { label: "Volume", value: goal ? `${usd(DATA.volToday)} of ${usd(goal)} (${Math.round((DATA.volToday / goal) * 100)}%)` : usd(DATA.volToday) },
              { label: "Goal met", value: goal ? <Status tone={DATA.volToday >= goal ? "success" : "warning"}>{DATA.volToday >= goal ? "yes" : "not yet"}</Status> : "No daily goal on this tier" },
              { label: "Markets", value: `${DATA.markets.length} active` },
            ]}
          />
        </Section>
      </Grid>
      <Section heading="Open positions">
        {DATA.open.length ? (
          <Table
            columns={["Market", "Side", "Size", "Lev", "Entry", "Mark", "TP", "SL", "P&L", "P&L %"]}
            rows={DATA.open.map((p: any) => [p.asset, p.side, usd(p.size), p.lev + "x", String(p.entry), String(p.mark), String(p.tp || "—"), String(p.sl || "—"), { text: usd(p.pnl), tone: tone(p.pnl) }, { text: p.pnlPct.toFixed(2) + "%", tone: tone(p.pnlPct) }])}
          />
        ) : (
          <Text>No open positions.</Text>
        )}
      </Section>
      <Section heading="Trade history">
        <Table
          columns={["Opened", "Market", "Side", "Status", "Size", "Entry", "P&L", "Closed"]}
          rows={DATA.history.map((t: any) => [t.time, t.asset, t.side, t.status, usd(t.size), String(t.entry), { text: usd(t.pnl), tone: tone(t.pnl) }, t.closed || "—"])}
        />
      </Section>
      <Section heading="Activity log">
        <Table columns={["Time (ET)", "Event", "Detail"]} rows={DATA.events.map((e: any) => [e.time, e.what, e.detail])} />
      </Section>
      <Section heading="Safety limits">
        <Properties
          items={[
            { label: "Leverage", value: `${L.lev ?? "—"} (pre-IPO markets max 4x)` },
            { label: "Exits", value: `Take-profit +${L.tpPct ?? "—"}% / stop −${L.slPct ?? "—"}% of margin, on the exchange` },
            { label: "Daily halt", value: `${L.dailyHaltPct ?? "—"}% on the day` },
            { label: "Kill switch", value: `−${L.killPct ?? "—"}% from start or ${L.maxLossStreak ?? "—"} losses in a row` },
            { label: "Max positions", value: String(L.maxSlots ?? "—") },
          ]}
        />
      </Section>
      <Text>{"Not financial advice. Perps can lose money fast; only trade what you can afford to lose. Trade on Imperial: imperial.trade/i/chesus (referral code chesus)."}</Text>
    </Page>
  );
}
