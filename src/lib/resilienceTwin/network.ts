import { FACILITY_NODE_MAP } from "./constants";
import type { PathResult, RoadNodeRow, RoadSegmentRow } from "./types";

interface Edge {
  to: string;
  segment: RoadSegmentRow;
}

/** Bidirectional shortest-path search over the bundled synthetic road graph. */
export class SyntheticRoadNetwork {
  private nodes = new Map<string, RoadNodeRow>();
  private segments = new Map<string, RoadSegmentRow>();
  private edges = new Map<string, Edge[]>();
  private facilityNodes: Record<string, string>;

  constructor(roadNodes: RoadNodeRow[], roadSegments: RoadSegmentRow[]) {
    for (const n of roadNodes) this.nodes.set(n.nodeId, n);
    this.facilityNodes = FACILITY_NODE_MAP;
    for (const seg of roadSegments) {
      this.segments.set(seg.segmentId, seg);
      if (!seg.freightAllowed) continue;
      for (const [from, to] of [
        [seg.fromNodeId, seg.toNodeId],
        [seg.toNodeId, seg.fromNodeId],
      ]) {
        if (!this.edges.has(from)) this.edges.set(from, []);
        this.edges.get(from)!.push({ to, segment: seg });
      }
    }
  }

  getSegment(id: string) {
    return this.segments.get(id);
  }

  /** Shortest time path between two facilities; blocked segments are removed. */
  path(
    originFacilityId: string,
    destinationFacilityId: string,
    blocked: Set<string>,
    slowdownSegmentId: string | null,
    slowdownMin: number,
  ): PathResult | null {
    const start = this.facilityNodes[originFacilityId];
    const end = this.facilityNodes[destinationFacilityId];
    if (!start || !end) {
      throw new Error(
        `Facility lacks a synthetic road graph connector: ${originFacilityId} or ${destinationFacilityId}`,
      );
    }
    if (start === end) {
      const n = this.nodes.get(start)!;
      return {
        miles: 0,
        minutes: 0,
        segments: [],
        coords: [[n.lon, n.lat]],
        delayedMinutes: 0,
      };
    }

    const best = new Map<string, number>([[start, 0]]);
    const prevSegment = new Map<string, string>();
    const prevNode = new Map<string, string>();
    const queue: Array<{ node: string; score: number }> = [
      { node: start, score: 0 },
    ];
    const visited = new Set<string>();

    while (queue.length > 0) {
      queue.sort((a, b) => a.score - b.score);
      const current = queue.shift()!;
      if (visited.has(current.node)) continue;
      visited.add(current.node);
      if (current.node === end) break;
      for (const edge of this.edges.get(current.node) ?? []) {
        if (blocked.has(edge.segment.segmentId)) continue;
        const edgeMinutes =
          edge.segment.nominalMin +
          (edge.segment.segmentId === slowdownSegmentId ? slowdownMin : 0);
        const value = current.score + edgeMinutes;
        if (value < (best.get(edge.to) ?? Number.POSITIVE_INFINITY) - 1e-8) {
          best.set(edge.to, value);
          prevSegment.set(edge.to, edge.segment.segmentId);
          prevNode.set(edge.to, current.node);
          queue.push({ node: edge.to, score: value });
        }
      }
    }

    if (!best.has(end)) return null;

    // Walk back the chain of segments from end to start.
    const chain: string[] = [];
    const nodeChain: string[] = [end];
    let cur = end;
    while (cur !== start) {
      const segId = prevSegment.get(cur);
      const prev = prevNode.get(cur);
      if (!segId || !prev) return null;
      chain.unshift(segId);
      cur = prev;
      nodeChain.unshift(cur);
    }

    const miles = chain.reduce(
      (sum, id) => sum + this.segments.get(id)!.nominalMiles,
      0,
    );
    const delayed =
      chain.filter((id) => id === slowdownSegmentId).length * slowdownMin;
    const minutes =
      chain.reduce((sum, id) => sum + this.segments.get(id)!.nominalMin, 0) +
      delayed;
    const coords: [number, number][] = nodeChain.map((id) => {
      const n = this.nodes.get(id)!;
      return [n.lon, n.lat];
    });
    return {
      miles: round2(miles),
      minutes,
      segments: chain,
      coords,
      delayedMinutes: delayed,
    };
  }
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
