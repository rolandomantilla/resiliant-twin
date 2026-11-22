import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_protected/user-guide")({
  component: UserGuidePage,
});

const QUICK_START = [
  "Open the Dispatch Dashboard. If it says “No demo data loaded”, click Load demo data.",
  "Look at the KPI cards and the map — this is the normal plan with no disruptions.",
  "In the Scenario Assistant (left sidebar), type: Close Highway 60 in East LA and reroute.",
  "Watch the KPIs, map, and tables update together. Purple lines are rerouted trips; the red line is the closure.",
  "Ask: Which shipments need a revised ETA? Then open Exceptions & Recovery to see proposed slots.",
  "Open Outreach, pick a warehouse, and click Send delay email (demo).",
  "Type: Reopen the road and recalculate to return to normal.",
];

const SAMPLE_COMMANDS = [
  [
    "Close Highway 60 in East LA and reroute",
    "Closes the modeled corridor and recalculates",
  ],
  [
    "Keep that closure, prioritize lowest cost, and set diesel to $6.50 per gallon",
    "Changes preference and fuel price, keeps the closure",
  ],
  [
    "Switch to satellite and show the normal routes for comparison",
    "Changes the basemap and adds the normal-route overlay",
  ],
  [
    "Which shipments need a revised ETA?",
    "Lists late and unassigned shipments with proposed times",
  ],
  ["Add a 90 minute highway slowdown", "Adds delay without closing the road"],
  ["Reopen the road and recalculate", "Returns to normal conditions"],
] as const;

const MAP_LEGEND = [
  ["Orange line", "Recommended loaded route"],
  ["Purple line", "Trip rerouted around a disruption"],
  ["Dashed blue line", "Empty truck repositioning"],
  ["Red line", "Simulated road closure (amber dashed = slowdown)"],
  ["Dotted grey line", "Normal route, shown for comparison"],
  ["Dark diamond", "Port"],
  ["Coloured square", "Warehouse (each has its own colour)"],
  ["Dark circle", "Truck — simulated position along its route"],
] as const;

const WORKFLOW = [
  [
    "Load data",
    "Ports, warehouses, trucks, drivers, shipments, receiving slots, and the road network are loaded from the demo dataset.",
  ],
  [
    "Plan normal day",
    "The engine assigns trucks to shipments with no disruptions. This becomes the baseline for every comparison.",
  ],
  [
    "Describe a disruption",
    "You type into the Scenario Assistant or change the controls bar (closure, slowdown, preference, diesel price).",
  ],
  [
    "Recalculate",
    "The engine reroutes around closed or slow roads, reassigns trucks, and recomputes ETAs, cost, and CO₂.",
  ],
  [
    "Review impact",
    "KPI cards, the map, and the Shipment Plan update together and show the change versus the baseline.",
  ],
  [
    "Recover",
    "Unscheduled shipments move to Exceptions & Recovery with the next feasible receiving slot.",
  ],
  [
    "Notify & export",
    "Send demo delay notices from Outreach and download CSV / GeoJSON / manifest files.",
  ],
] as const;

const ARCHITECTURE = [
  [
    "Screens",
    "Dispatch Dashboard (KPIs, map, tables, assistant), Data Feed & Replay, and this guide.",
  ],
  [
    "Scenario Assistant",
    "Uses the Bolt AI model only to understand your request and pick settings. If AI is unavailable it falls back to built-in pattern matching (Demo mode). Replies are written from the computed results, so shipment IDs, costs, and ETAs are never invented.",
  ],
  [
    "Routing & scheduling engine",
    "Runs the scenario on a simplified road model (9 junctions, 13 road segments), assigns trucks within driver-hour and warehouse-capacity limits, and finds recovery slots.",
  ],
  [
    "Map",
    "ArcGIS map with public Esri basemaps. Route lines follow real streets (OSRM); timing and closures come from the simplified road model.",
  ],
  [
    "Database",
    "Stores facilities, fleet, drivers, shipments, slots, road network, telemetry and disruption events, live truck/road state, outreach notices, and chat history.",
  ],
  [
    "Data Feed & Replay",
    "Replays sample truck telemetry and road events, validates each one, and updates live state — newest reading always wins.",
  ],
] as const;

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-base font-semibold tracking-tight">{title}</h2>
      <div className="space-y-2 text-sm text-muted-foreground">{children}</div>
    </section>
  );
}

function UserGuidePage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8 p-1 pb-12">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">User Guide</h1>
        <p className="text-sm text-muted-foreground">
          How to run disruption scenarios, read the dispatch plan, and notify
          customers. All data in this app is synthetic demo data.
        </p>
      </header>

      <Section title="Quick start (5 minutes)">
        <ol className="list-decimal space-y-1.5 pl-5">
          {QUICK_START.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </Section>

      <Section title="How it works — workflow">
        <ol className="space-y-2">
          {WORKFLOW.map(([step, detail], i) => (
            <li key={step} className="flex gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                {i + 1}
              </span>
              <p>
                <span className="font-medium text-foreground">{step}</span> —{" "}
                {detail}
              </p>
            </li>
          ))}
        </ol>
      </Section>

      <Section title="Architecture">
        <p>
          Everything runs from one computed scenario, so every screen always
          shows the same result.
        </p>
        <div className="rounded-lg border border-border bg-muted/30 p-3 text-center text-xs text-foreground">
          You (assistant or controls) → Settings → Routing &amp; scheduling
          engine ← Database
          <br />↓<br />
          KPI cards · Map · Shipment Plan · Exceptions · Outreach · Exports
        </div>
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-left text-sm">
            <tbody className="divide-y divide-border">
              {ARCHITECTURE.map(([part, role]) => (
                <tr key={part}>
                  <td className="w-44 px-3 py-2 align-top font-medium text-foreground">
                    {part}
                  </td>
                  <td className="px-3 py-2">{role}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="The Scenario Assistant">
        <p>
          The assistant in the left sidebar is the main way to change the
          scenario. Describe what happened in plain language; it works out the
          settings, runs the simulation, and explains the results using real
          shipment IDs from the run. Settings you don't mention stay as they
          are, so you can build on a scenario step by step.
        </p>
        <p>
          The badge at the top shows whether it is{" "}
          <Badge variant="default" className="text-[11px]">
            Connected to Bolt
          </Badge>{" "}
          or in{" "}
          <Badge variant="secondary" className="text-[11px]">
            Demo mode
          </Badge>{" "}
          (built-in pattern matching, no AI). Use the trash icon to clear the
          chat — your current scenario is kept.
        </p>
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 text-xs text-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Try typing</th>
                <th className="px-3 py-2 font-medium">What happens</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {SAMPLE_COMMANDS.map(([cmd, effect]) => (
                <tr key={cmd}>
                  <td className="px-3 py-2 font-medium text-foreground">
                    “{cmd}”
                  </td>
                  <td className="px-3 py-2">{effect}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          If the assistant can't match a road, it will ask for the highway
          segment, direction, or nearby interchange. Supported highways: 10, 57,
          60, 605 and 710.
        </p>
      </Section>

      <Section title="Controls bar">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <span className="font-medium text-foreground">Preference</span> —
            Balanced, Lowest cost, Lowest CO₂, or Reliability first. Changes how
            trucks are assigned.
          </li>
          <li>
            <span className="font-medium text-foreground">Basemap</span> —
            Streets, Satellite, Topographic, or Light gray.
          </li>
          <li>
            <span className="font-medium text-foreground">Diesel price</span> —
            USD per gallon (reference $4.10). Recalculates trip costs using each
            truck's fuel economy.
          </li>
          <li>
            <span className="font-medium text-foreground">
              Show normal routes
            </span>{" "}
            — overlays the undisrupted routes for comparison.
          </li>
          <li>
            <span className="font-medium text-foreground">Reset to normal</span>{" "}
            — clears all disruptions and settings.
          </li>
        </ul>
      </Section>

      <Section title="Reading the KPI cards">
        <p>
          Five cards show scheduled shipments, critical shipments served, trucks
          making more than one trip, modeled trip cost, and estimated CO₂. The
          line under each value compares the current scenario with the normal
          baseline — for example <em>+2 shipments</em> or <em>−$340</em>. Cost
          and CO₂ cover scheduled trips only; unassigned shipments have no cost
          estimate.
        </p>
      </Section>

      <Section title="The map">
        <div className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
          {MAP_LEGEND.map(([symbol, meaning]) => (
            <p key={symbol}>
              <span className="font-medium text-foreground">{symbol}</span> —{" "}
              {meaning}
            </p>
          ))}
        </div>
        <p>
          Use the Warehouses and Trucks checkboxes to hide markers. Scroll over
          the map to zoom; scroll beside it to move down the page. Click any
          line or marker for details.
        </p>
        <p>
          Routes are drawn on real streets (OSRM driving profile, no truck size
          or weight limits). Timing, cost, and closures come from a simplified
          road model, so a named highway is a labeled <em>proxy</em> for a
          modeled corridor — not live traffic.
        </p>
      </Section>

      <Section title="Shipment tables">
        <Accordion>
          <AccordionItem value="plan">
            <AccordionTrigger>Shipment Plan</AccordionTrigger>
            <AccordionContent className="space-y-2 text-sm text-muted-foreground">
              Every shipment with its origin, receiving stop, assigned truck,
              original receiving window, status, modeled impact, next action,
              revised ETA, and receiving slot. The original window is the
              confirmed appointment; revised ETAs are simulated and marked{" "}
              <em>simulated, not confirmed</em>. Times are shown as minutes
              after the dispatch start (for example T+135m).
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="exceptions">
            <AccordionTrigger>Exceptions &amp; Recovery</AccordionTrigger>
            <AccordionContent className="space-y-2 text-sm text-muted-foreground">
              Shipments that could not be scheduled. The app searches for the
              next feasible receiving slot after the original appointment, using
              remaining trucks, drivers, and warehouse capacity. A proposed slot
              shows arrival time, receiving time, and slot ID, and is labeled{" "}
              <em>Awaiting warehouse confirmation</em>. If nothing fits, it says{" "}
              <em>No feasible option</em> — escalate to a dispatch supervisor.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="outreach">
            <AccordionTrigger>Outreach</AccordionTrigger>
            <AccordionContent className="space-y-2 text-sm text-muted-foreground">
              Pick a warehouse to see its customer contacts and affected
              shipments. <em>Send delay email (demo)</em> writes the notice to
              the demo outbox only — no real email is sent — and marks those
              shipments as contacted. The same notice can't be sent twice; a new
              one is allowed once the impact or ETA changes.{" "}
              <em>Download notice</em> saves it as a text file.
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </Section>

      <Section title="Exports">
        <p>
          The <span className="font-medium text-foreground">Export</span> button
          (top right of the dashboard) downloads a shipment CSV, facility points
          as GeoJSON, shipment routes as GeoJSON, and a scenario manifest with
          the active settings and summary metrics.
        </p>
      </Section>

      <Section title="Data Feed & Replay">
        <p>
          The{" "}
          <Link
            to="/data-feed"
            className="font-medium text-primary underline-offset-2 hover:underline"
          >
            Data Feed &amp; Replay
          </Link>{" "}
          page replays sample truck telemetry and road-disruption events.
          Invalid IDs, bad timestamps, and negative delays are rejected with a
          reason; duplicates and older events never overwrite the newest
          reading. <em>Reset demo data</em> reloads the 40 sample shipments and
          clears the event log, outbox, and chat.
        </p>
      </Section>

      <Section title="Good to know">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Results are advisory — confirm appointments, routes, and driver
            hours before acting.
          </li>
          <li>
            Driver hours are a simplified budget, not legal hours-of-service
            checks.
          </li>
          <li>Cost and CO₂ figures use illustrative rates.</li>
          <li>
            The sidebar can be resized by dragging its right edge (double-click
            to reset).
          </li>
        </ul>
      </Section>
    </div>
  );
}
