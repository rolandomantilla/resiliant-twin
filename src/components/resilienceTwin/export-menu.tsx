import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ScenarioComparison } from "@/hooks/useResilienceTwin";
import {
  buildFacilityGeoJson,
  buildRouteGeoJson,
  buildScenarioManifest,
  buildShipmentCsv,
  downloadText,
} from "@/lib/resilienceTwin/exports";
import type { MergedShipmentRow } from "@/lib/resilienceTwin/mergeShipmentRows";
import type { FacilityRow } from "@/lib/resilienceTwin/types";

interface ExportMenuProps {
  rows: MergedShipmentRow[];
  facilities: FacilityRow[];
  comparison: ScenarioComparison | null;
}

export function ExportMenu({ rows, facilities, comparison }: ExportMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <Button variant="outline" size="sm">
          <Download className="mr-1.5 h-3.5 w-3.5" /> Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onSelect={() =>
            downloadText("shipments.csv", buildShipmentCsv(rows), "text/csv")
          }
        >
          Shipment CSV
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() =>
            downloadText(
              "facilities.geojson",
              JSON.stringify(buildFacilityGeoJson(facilities), null, 2),
              "application/geo+json",
            )
          }
        >
          Facility-point GeoJSON
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={!comparison}
          onSelect={() =>
            comparison &&
            downloadText(
              "shipment-routes.geojson",
              JSON.stringify(buildRouteGeoJson(comparison.revised), null, 2),
              "application/geo+json",
            )
          }
        >
          Shipment-route GeoJSON
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={!comparison}
          onSelect={() =>
            comparison &&
            downloadText(
              "scenario-manifest.json",
              JSON.stringify(buildScenarioManifest(comparison), null, 2),
              "application/json",
            )
          }
        >
          Scenario manifest
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
