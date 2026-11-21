import {
  useIsMutating,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { DEFAULT_SCENARIO_SETTINGS } from "@/lib/resilienceTwin/types";
import type {
  ScenarioResult,
  ScenarioSettings,
} from "@/lib/resilienceTwin/types";
import {
  listEventLog,
  listLiveState,
  replayFeed,
  replaySeedFeed,
  resetDemoData,
} from "@/services/db/feedService";
import {
  listOutreachNotices,
  listShipmentsMaster,
  sendOutreachNotice,
} from "@/services/db/outreachService";
import {
  clearScenarioMessages,
  listScenarioMessages,
  postScenarioMessage,
} from "@/services/db/scenarioChatService";
import {
  listFacilities,
  listFleet,
  listRoadSegments,
  runScenario,
} from "@/services/db/simulationService";

import {
  listTruckSwaps,
  saveTruckSwaps,
  undoTruckSwaps,
} from "@/services/db/truckSwapService";

const STORAGE_KEY = "resiliencetwin:scenario-settings";

export function useFacilities(enabled: boolean) {
  return useQuery({
    queryKey: ["rt", "facilities"],
    queryFn: () => listFacilities(),
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

export function useRoadSegments(enabled: boolean) {
  return useQuery({
    queryKey: ["rt", "roadSegments"],
    queryFn: () => listRoadSegments(),
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

export function useShipmentsMaster(enabled: boolean) {
  return useQuery({
    queryKey: ["rt", "shipmentsMaster"],
    queryFn: () => listShipmentsMaster(),
    enabled,
  });
}

export function useScenarioMessages(enabled: boolean) {
  return useQuery({
    queryKey: ["rt", "messages"],
    queryFn: () => listScenarioMessages(),
    enabled,
  });
}

export function usePostScenarioMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      role: "user" | "assistant";
      content: string;
      settingsJson?: string | null;
    }) => postScenarioMessage({ data: input }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["rt", "messages"] }),
  });
}

export function useClearScenarioMessages() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => clearScenarioMessages(),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["rt", "messages"] }),
  });
}

const RUN_SCENARIO_KEY = ["rt", "runScenario"];

/** True while any scenario run (dashboard controls or assistant) is in flight. */
export function useIsScenarioRunning() {
  return useIsMutating({ mutationKey: RUN_SCENARIO_KEY }) > 0;
}

export function useRunScenario() {
  return useMutation({
    mutationKey: RUN_SCENARIO_KEY,
    mutationFn: (settings: ScenarioSettings) => runScenario({ data: settings }),
  });
}

export function useEventLog(enabled: boolean) {
  return useQuery({
    queryKey: ["rt", "eventLog"],
    queryFn: () => listEventLog(),
    enabled,
  });
}

export function useLiveState(enabled: boolean) {
  return useQuery({
    queryKey: ["rt", "liveState"],
    queryFn: () => listLiveState(),
    enabled,
  });
}

export function useReplaySeedFeed() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (kind: "iot" | "disruption") =>
      replaySeedFeed({ data: { kind } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rt", "eventLog"] });
      queryClient.invalidateQueries({ queryKey: ["rt", "liveState"] });
    },
  });
}

export function useResetDemoData() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => resetDemoData(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["rt"] }),
  });
}

export function useReplayEvents() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      kind: "iot" | "disruption";
      events: Record<string, unknown>[];
    }) => replayFeed({ data: input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rt", "eventLog"] });
      queryClient.invalidateQueries({ queryKey: ["rt", "liveState"] });
    },
  });
}

export function useTruckSwaps(enabled: boolean) {
  return useQuery({
    queryKey: ["rt", "truckSwaps"],
    queryFn: () => listTruckSwaps(),
    enabled,
  });
}

export function useSaveTruckSwaps() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof saveTruckSwaps>[0]["data"]) =>
      saveTruckSwaps({ data: input }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["rt", "truckSwaps"] }),
  });
}

export function useUndoTruckSwaps() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (shipmentIds: string[] | "all") =>
      undoTruckSwaps({ data: { shipmentIds } }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["rt", "truckSwaps"] }),
  });
}

export function useFleet(enabled: boolean) {
  return useQuery({
    queryKey: ["rt", "fleet"],
    queryFn: () => listFleet(),
    enabled,
  });
}

export function useOutreachNotices(enabled: boolean) {
  return useQuery({
    queryKey: ["rt", "notices"],
    queryFn: () => listOutreachNotices(),
    enabled,
  });
}

export function useSendOutreachNotice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      stopId: string;
      shipmentIds: string[];
      impactSummary: string;
      etaSummary: Record<
        string,
        { revisedEtaMin: number | null; status: string }
      >;
    }) => sendOutreachNotice({ data: input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rt", "notices"] });
      queryClient.invalidateQueries({ queryKey: ["rt", "shipmentsMaster"] });
    },
  });
}

/** Scenario settings persisted locally so a refresh doesn't lose the demo's state. */
export function useScenarioSettingsState() {
  const [settings, setSettings] = useState<ScenarioSettings>(
    DEFAULT_SCENARIO_SETTINGS,
  );
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw)
        setSettings({ ...DEFAULT_SCENARIO_SETTINGS, ...JSON.parse(raw) });
    } catch {
      // ignore corrupt local state
    }
  }, []);
  const update = useCallback((next: ScenarioSettings) => {
    setSettings(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // storage unavailable — settings still work for this session
    }
  }, []);
  return [settings, update] as const;
}

export interface ScenarioComparison {
  baseline: ScenarioResult;
  revised: ScenarioResult;
}
