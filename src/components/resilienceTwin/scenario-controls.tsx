import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { BASEMAPS, POLICIES } from "@/lib/resilienceTwin/constants";
import type {
  BasemapName,
  PolicyName,
  ScenarioSettings,
} from "@/lib/resilienceTwin/types";

const BASEMAP_LABELS: Record<BasemapName, string> = {
  streets: "Streets",
  satellite: "Satellite",
  topographic: "Topographic",
  gray: "Light gray",
};

interface ScenarioControlsProps {
  settings: ScenarioSettings;
  onUpdate: (patch: Partial<ScenarioSettings>) => void;
  onReset: () => void;
}

export function ScenarioControls({
  settings,
  onUpdate,
  onReset,
}: ScenarioControlsProps) {
  return (
    <div className="flex flex-wrap items-end gap-4 rounded-lg border border-border bg-card p-3">
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Preference</Label>
        <Select
          value={settings.policy}
          onValueChange={(v) => onUpdate({ policy: v as PolicyName })}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {POLICIES.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Basemap</Label>
        <Select
          value={settings.basemap}
          onValueChange={(v) => onUpdate({ basemap: v as BasemapName })}
        >
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BASEMAPS.map((b) => (
              <SelectItem key={b} value={b}>
                {BASEMAP_LABELS[b]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">
          Diesel price (USD/gal)
        </Label>
        <Input
          type="number"
          step="0.01"
          min={0.5}
          max={12}
          value={settings.dieselPrice}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (Number.isFinite(v)) onUpdate({ dieselPrice: v });
          }}
          className="w-28"
        />
      </div>

      <div className="flex items-center gap-2">
        <Switch
          id="toggle-normal-overlay"
          checked={settings.showNormalOverlay}
          onCheckedChange={(v) => onUpdate({ showNormalOverlay: Boolean(v) })}
        />
        <Label
          htmlFor="toggle-normal-overlay"
          className="cursor-pointer text-xs font-normal"
        >
          Show normal routes
        </Label>
      </div>

      <Button variant="ghost" size="sm" className="ml-auto" onClick={onReset}>
        <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Reset to normal
      </Button>
    </div>
  );
}
