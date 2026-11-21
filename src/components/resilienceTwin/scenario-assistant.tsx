import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  Check,
  Loader2,
  Mail,
  MapPin,
  Send,
  Sparkles,
  Trash2,
} from "lucide-react";
import { NoticeDraftsDialog } from "@/components/resilienceTwin/notice-drafts-dialog";
import type { RiskHighlight } from "@/components/resilienceTwin/scenario-map";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PromptSuggestion } from "@/components/ui/prompt-suggestion";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useConnectors, useExecuteModel } from "@/hooks/useConnectors";
import {
  useClearScenarioMessages,
  useFleet,
  usePostScenarioMessage,
  useRunScenario,
  useScenarioMessages,
  type ScenarioComparison,
} from "@/hooks/useResilienceTwin";
import {
  BREAKDOWN_QUERY_PATTERN,
  composeBreakdownAnswer,
  composePortAnswer,
  composeReplacementText,
  formatMinutes,
  suggestReplacements,
  type ReplacementSuggestion,
  type RiskAnalysis,
  type RiskAnswer,
  parseBreakdownQuery,
  parsePortQuery,
  PORT_QUERY_PATTERN,
  composeEtaAnswer,
  composeScenarioReply,
  ETA_QUERY_PATTERN,
} from "@/lib/resilienceTwin/assistantReplies";
import {
  demoModeExtract,
  interpretScenarioRequest,
  sanitizeAiUpdates,
} from "@/lib/resilienceTwin/scenarioParser";
import type { ShipmentMasterRow } from "@/lib/resilienceTwin/mergeShipmentRows";
import type {
  FacilityRow,
  RoadSegmentRow,
  ScenarioSettings,
} from "@/lib/resilienceTwin/types";

const AI_CONNECTOR_NAME = "Bolt_instruct_v2";

const SAMPLE_COMMANDS = [
  "Close Highway 60 in East LA and reroute",
  "Keep that closure, prioritize lowest cost, and set diesel to $6.50 per gallon",
  "Switch to satellite and show the normal routes for comparison",
  "Which shipments need a revised ETA?",
  "Truck 3 broke down and will take 3 hours to fix — which shipments are in danger?",
  "Port of Long Beach has a 4 hour delay",
  "Port of LA is closed, move everything to Long Beach",
  "Close Highway 60 in East LA and close the Port of Long Beach, move everything to LA",
  "Reopen the road and recalculate",
];

const ROAD_CHANGE_PATTERN =
  /\b(?:highway|freeway|hwy|interstate|i-\d+|sr-?\d+|route \d+|road|reopen)\b/i;

const SYSTEM_PROMPT = `You extract scenario-change settings for a synthetic Southern California logistics simulator. Respond with ONLY a minified JSON object, no prose, matching exactly this shape:
{"scenario": one of ["Normal conditions","Highway slowdown","Road closure","Delayed pickup","Wildfire-related slowdown","Flood-related slowdown"] or null, "severity": integer minutes 0-240 or null, "policy": one of ["Balanced","Lowest cost","Lowest CO2","Reliability first"] or null, "basemap": one of ["streets","satellite","topographic","gray"] or null, "dieselPrice": number USD per gallon or null, "showNormalOverlay": boolean or null}
Use null for any setting the user did not ask to change — never guess. Never invent roads, traffic conditions, or geography beyond what the user said.`;

interface ScenarioAssistantProps {
  settings: ScenarioSettings;
  result: ScenarioComparison | null;
  roadSegments: RoadSegmentRow[];
  facilities: FacilityRow[];
  master: ShipmentMasterRow[];
  onHighlight: (highlight: RiskHighlight | null) => void;
  onApply: (settings: ScenarioSettings, result: ScenarioComparison) => void;
  databaseEnabled: boolean;
}

export function ScenarioAssistant({
  settings,
  result,
  roadSegments,
  facilities,
  master,
  onHighlight,
  onApply,
  databaseEnabled,
}: ScenarioAssistantProps) {
  const { data: messages } = useScenarioMessages(databaseEnabled);
  const postMessage = usePostScenarioMessage();
  const clearMessages = useClearScenarioMessages();
  const runScenario = useRunScenario();
  const executeModel = useExecuteModel();
  const { data: connectors, isLoading: connectorsLoading } = useConnectors({
    type: "source",
    per_page: 100,
  });
  const [input, setInput] = useState("");
  const [forceDemoMode, setForceDemoMode] = useState(false);
  const [pending, setPending] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const { data: fleet } = useFleet(databaseEnabled);
  const [lastRisk, setLastRisk] = useState<{
    analysis: RiskAnalysis;
    suggestions: ReplacementSuggestion[];
  } | null>(null);
  const [draftsOpen, setDraftsOpen] = useState(false);
  const [appliedSwaps, setAppliedSwaps] = useState<Set<string>>(new Set());

  // Swaps edit the current plan in place; they last until the plan is
  // recalculated, since the scheduling engine itself doesn't know about them.
  async function applySwaps(swaps: ReplacementSuggestion[]) {
    if (!result || !lastRisk) return;
    const { analysis } = lastRisk;
    const bySwap = new Map(swaps.map((s) => [s.shipmentId, s]));
    const revised = {
      ...result.revised,
      shipments: result.revised.shipments.map((p) => {
        const s = bySwap.get(p.shipmentId);
        if (!s?.truckId || s.receivingMin === null) return p;
        return {
          ...p,
          truckId: s.truckId,
          driverId: s.driverId,
          originId: analysis.pickupOverride[p.shipmentId] ?? p.originId,
          arrivalMin: s.receivingMin,
          receivingMin: s.receivingMin,
          completeMin: s.receivingMin + 30,
          notes: [
            ...p.notes,
            `Reassigned from ${p.truckId} to ${s.truckId} (${analysis.title}).`,
          ],
        };
      }),
    };
    revised.metrics = {
      ...revised.metrics,
      trucksUsed: new Set(
        revised.shipments.filter((p) => p.truckId).map((p) => p.truckId),
      ).size,
    };
    onApply(settings, { ...result, revised });

    const nextApplied = new Set(appliedSwaps);
    for (const s of swaps) nextApplied.add(s.shipmentId);
    setAppliedSwaps(nextApplied);

    // Drop shipments that are now on time from the map highlight.
    const levels = Object.fromEntries(
      analysis.items
        .filter((i) => i.level !== "ok")
        .filter((i) => {
          const s = lastRisk.suggestions.find(
            (x) => x.shipmentId === i.shipmentId,
          );
          return !(nextApplied.has(i.shipmentId) && s?.meetsWindow);
        })
        .map((i) => [i.shipmentId, i.level as "miss" | "tight"]),
    );
    onHighlight(
      Object.keys(levels).length ? { title: analysis.title, levels } : null,
    );

    const summary = swaps
      .map(
        (s) =>
          `${s.shipmentId} → ${s.truckId} (arrives ${formatMinutes(s.receivingMin)}${s.meetsWindow ? ", on time" : ", still late"})`,
      )
      .join("; ");
    if (databaseEnabled)
      await postMessage.mutateAsync({
        role: "assistant",
        content: `Applied to the plan: ${summary}. These swaps stay in place until the plan is recalculated (changing the scenario or asking for a new one rebuilds it).`,
      });
  }
  const scrollRef = useRef<HTMLDivElement>(null);

  // The platform returns JSON:API records — the display name lives under
  // `attributes.name`, not at the top level.
  const connector = useMemo(() => {
    const list = (connectors as { data?: unknown } | undefined)?.data;
    if (!Array.isArray(list)) return undefined;
    const match = list.find((c: { attributes?: { name?: string } }) => {
      return c?.attributes?.name === AI_CONNECTOR_NAME;
    }) as { id: string | number } | undefined;
    return match ? { id: match.id } : undefined;
  }, [connectors]);
  const useDemoMode = forceDemoMode || !connector;

  const roadNameBySegment = useMemo(
    () =>
      Object.fromEntries(roadSegments.map((s) => [s.segmentId, s.roadName])),
    [roadSegments],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: scrolls on new messages/pending state, not on their contents
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, pending]);

  async function resolveAiUpdates(prompt: string, recentRequests: string[]) {
    if (useDemoMode || !connector) return undefined;
    try {
      const response = await executeModel.mutateAsync({
        connectorId: connector.id,
        messages: [
          {
            role: "user",
            content: JSON.stringify({
              request: prompt,
              active_settings: settings,
              recent_requests: recentRequests,
            }),
          },
        ],
        instructions: SYSTEM_PROMPT,
      } as never);
      const text = extractModelText(response);
      const json = JSON.parse(extractJsonSubstring(text));
      return sanitizeAiUpdates(json);
    } catch {
      return undefined; // falls back to demo-mode regex extraction below
    }
  }

  async function handleSend(promptOverride?: string) {
    const prompt = (promptOverride ?? input).trim();
    if (!prompt || pending) return;
    setInput("");
    setLocalError(null);
    setPending(true);
    try {
      if (databaseEnabled)
        await postMessage.mutateAsync({ role: "user", content: prompt });

      const recentRequests = (messages ?? [])
        .filter((m) => m.role === "user")
        .slice(-5)
        .map((m) => m.content);

      const breakdown = BREAKDOWN_QUERY_PATTERN.test(prompt)
        ? parseBreakdownQuery(prompt)
        : null;
      const isPortQuery = !breakdown && PORT_QUERY_PATTERN.test(prompt);
      const isRiskQuery = Boolean(breakdown) || isPortQuery;
      // "Close Highway 60 and the Port of LA" → apply the road change first,
      // then answer the port/truck question on the recomputed plan.
      const alsoChangesRoad = isRiskQuery && ROAD_CHANGE_PATTERN.test(prompt);
      const answerRisk = (current: ScenarioComparison) => {
        const answer: RiskAnswer = breakdown
          ? composeBreakdownAnswer(current.revised, breakdown)
          : composePortAnswer(
              current.revised,
              parsePortQuery(prompt, facilities),
              facilities,
            );
        if (!answer.analysis) {
          setLastRisk(null);
          onHighlight(null);
          return answer.text;
        }
        const teuByShipment = Object.fromEntries(
          master.map((m) => [m.id, m.containerTeu ?? 1]),
        );
        const suggestions = suggestReplacements(
          current.revised,
          answer.analysis,
          fleet ?? [],
          facilities,
          teuByShipment,
        );
        const levels = Object.fromEntries(
          answer.analysis.items
            .filter((i) => i.level !== "ok")
            .map((i) => [i.shipmentId, i.level as "miss" | "tight"]),
        );
        setLastRisk({ analysis: answer.analysis, suggestions });
        setAppliedSwaps(new Set());
        onHighlight(
          Object.keys(levels).length
            ? { title: answer.analysis.title, levels }
            : null,
        );
        return (
          answer.text + composeReplacementText(suggestions, answer.analysis)
        );
      };

      if (isRiskQuery && !alsoChangesRoad) {
        let current = result;
        if (!current) {
          current = await runScenario.mutateAsync(settings);
          onApply(settings, current);
        }
        const reply = answerRisk(current);
        if (databaseEnabled)
          await postMessage.mutateAsync({ role: "assistant", content: reply });
        return;
      }

      if (ETA_QUERY_PATTERN.test(prompt)) {
        let current = result;
        if (!current) {
          current = await runScenario.mutateAsync(settings);
          onApply(settings, current);
        }
        const reply = composeEtaAnswer(current.revised);
        if (databaseEnabled)
          await postMessage.mutateAsync({ role: "assistant", content: reply });
        return;
      }

      const aiUpdates = await resolveAiUpdates(prompt, recentRequests);
      const usedFallback = !useDemoMode && aiUpdates === undefined;
      const demoUpdates =
        useDemoMode || usedFallback ? demoModeExtract(prompt) : undefined;
      const parsed = interpretScenarioRequest(
        prompt,
        settings,
        aiUpdates ?? demoUpdates,
      );

      if (parsed.clarification || !parsed.settings) {
        if (databaseEnabled)
          await postMessage.mutateAsync({
            role: "assistant",
            content: parsed.clarification!,
          });
        return;
      }

      const comparison = await runScenario.mutateAsync(parsed.settings);
      onApply(parsed.settings, comparison);
      let reply = composeScenarioReply(comparison, roadNameBySegment);
      if (alsoChangesRoad) reply += ` Then: ${answerRisk(comparison)}`;
      if (usedFallback)
        reply +=
          " (Parsed with built-in pattern matching — the connected model's response could not be used.)";
      if (databaseEnabled) {
        await postMessage.mutateAsync({
          role: "assistant",
          content: reply,
          settingsJson: JSON.stringify(parsed.settings),
        });
      }
    } catch (err) {
      setLocalError(
        err instanceof Error
          ? err.message
          : "Something went wrong running that scenario.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex h-full flex-col rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Scenario Assistant</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            title="Clear chat history"
            aria-label="Clear chat history"
            disabled={pending || clearMessages.isPending || !messages?.length}
            onClick={() => {
              if (
                window.confirm(
                  "Clear the assistant's chat history? Your current scenario settings stay as they are.",
                )
              ) {
                clearMessages.mutate();
              }
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Switch
            id="toggle-demo-mode"
            checked={useDemoMode}
            onCheckedChange={(v) => setForceDemoMode(Boolean(v))}
            disabled={!connector}
          />
          <Label
            htmlFor="toggle-demo-mode"
            className="cursor-pointer font-normal"
          >
            Demo mode
          </Label>
        </div>
      </div>
      <div className="border-b border-border px-3 py-2">
        <Badge
          variant={useDemoMode ? "secondary" : "default"}
          className="text-xs font-normal"
        >
          {useDemoMode
            ? connector
              ? "Demo mode — pattern matching, AI connector available but off"
              : connectorsLoading
                ? "Connecting to Bolt…"
                : `Demo mode — "${AI_CONNECTOR_NAME}" connector not found`
            : `Connected to Bolt (${AI_CONNECTOR_NAME})`}
        </Badge>
      </div>
      <div
        ref={scrollRef}
        className="flex-1 space-y-3 overflow-y-auto px-3 py-3"
      >
        {(!messages || messages.length === 0) && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Describe a scenario change, ask a question about the current run,
              or try a sample command:
            </p>
            <div className="flex flex-wrap gap-2">
              {SAMPLE_COMMANDS.map((cmd) => (
                <PromptSuggestion key={cmd} onClick={() => handleSend(cmd)}>
                  {cmd}
                </PromptSuggestion>
              ))}
            </div>
          </div>
        )}
        {messages?.map((m) => (
          <div
            key={m.id}
            className={
              m.role === "user"
                ? "ml-auto max-w-[85%] rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground"
                : "mr-auto max-w-[85%] rounded-lg bg-muted px-3 py-2 text-sm"
            }
          >
            {m.content}
          </div>
        ))}
        {lastRisk &&
          lastRisk.analysis.items.some((i) => i.level !== "ok") &&
          !pending && (
            <div className="mr-auto flex w-full max-w-[85%] flex-col gap-2">
              {result && lastRisk.suggestions.some((s) => s.truckId) && (
                <div className="space-y-1.5 rounded-lg border border-border p-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium">
                      Suggested truck swaps
                    </span>
                    {lastRisk.suggestions.filter(
                      (s) => s.truckId && !appliedSwaps.has(s.shipmentId),
                    ).length > 1 && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() =>
                          applySwaps(
                            lastRisk.suggestions.filter(
                              (s) =>
                                s.truckId && !appliedSwaps.has(s.shipmentId),
                            ),
                          )
                        }
                      >
                        Apply all
                      </Button>
                    )}
                  </div>
                  {lastRisk.suggestions
                    .filter((s) => s.truckId)
                    .map((s) => (
                      <div
                        key={s.shipmentId}
                        className="flex items-center justify-between gap-2 text-xs"
                      >
                        <span>
                          {s.shipmentId} → {s.truckId} · arrives{" "}
                          {formatMinutes(s.receivingMin)}{" "}
                          <span
                            className={
                              s.meetsWindow
                                ? "text-muted-foreground"
                                : "text-destructive"
                            }
                          >
                            {s.meetsWindow ? "on time" : "still late"}
                          </span>
                        </span>
                        {appliedSwaps.has(s.shipmentId) ? (
                          <span className="inline-flex items-center gap-1 text-muted-foreground">
                            <Check className="h-3.5 w-3.5" /> Applied
                          </span>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs"
                            onClick={() => applySwaps([s])}
                          >
                            Apply
                          </Button>
                        )}
                      </div>
                    ))}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setDraftsOpen(true)}
                >
                  <Mail className="h-3.5 w-3.5" /> Draft customer notices
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    const levels = Object.fromEntries(
                      lastRisk.analysis.items
                        .filter((i) => i.level !== "ok")
                        .map((i) => [
                          i.shipmentId,
                          i.level as "miss" | "tight",
                        ]),
                    );
                    onHighlight({ title: lastRisk.analysis.title, levels });
                  }}
                >
                  <MapPin className="h-3.5 w-3.5" /> Show on map
                </Button>
              </div>
            </div>
          )}
        {pending && (
          <div className="mr-auto flex max-w-[85%] items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Running the
            scenario…
          </div>
        )}
        {localError && <p className="text-sm text-destructive">{localError}</p>}
      </div>
      <form
        className="flex items-end gap-2 border-t border-border p-3"
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
      >
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder='e.g. "Close Highway 60 in East LA and reroute"'
          className="min-h-10 resize-none"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
        />
        <Button type="submit" size="icon" disabled={pending || !input.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
      <NoticeDraftsDialog
        open={draftsOpen}
        onOpenChange={setDraftsOpen}
        analysis={lastRisk?.analysis ?? null}
        suggestions={lastRisk?.suggestions ?? []}
        master={master}
        facilities={facilities}
      />
      <div className="flex items-center gap-1.5 border-t border-border px-3 py-1.5 text-xs text-muted-foreground">
        <Sparkles className="h-3 w-3" />
        Active: {settings.scenario} · {settings.policy} · $
        {settings.dieselPrice.toFixed(2)}/gal · {settings.basemap}
        {settings.closureSegment ? ` · closure ${settings.closureSegment}` : ""}
      </div>
    </div>
  );
}

function extractModelText(response: unknown): string {
  const data = (response as any)?.data;
  const first = Array.isArray(data) ? data[0] : data;
  const candidates = [
    first?.choices?.[0]?.message?.content,
    first?.choices?.[0]?.delta?.content,
    first?.content,
    first?.message?.content,
    typeof first === "string" ? first : undefined,
    typeof response === "string" ? response : undefined,
  ];
  const text = candidates.find((c) => typeof c === "string" && c.length > 0);
  if (!text) throw new Error("No model text returned");
  return text;
}

function extractJsonSubstring(text: string): string {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start)
    throw new Error("No JSON object found in model output");
  return text.slice(start, end + 1);
}
