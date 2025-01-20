import { Point } from "sprotty-protocol";
import { Graph } from "../gropiusModel.js";
import _Elk, { ElkNode } from "elkjs";
import { Math2D } from "../line/math.js";

const Elk = _Elk as unknown as typeof _Elk.default;

const NODE_SIZE = 200;
const NODE_PADDING = 100;
const INTERFACE_DIST = 220;

const STRESS_OPTIONS = {
    "elk.algorithm": "stress",
    "elk.stress.desiredEdgeLength": `${NODE_SIZE + NODE_PADDING}`
};

const LAYERED_OPTIONS = {
    "elk.algorithm": "layered",
    "spacing.baseValue": `${NODE_PADDING}`,
    "nodePlacement.strategy": "SIMPLE",
    "spacing.edgeNode": `${NODE_PADDING}`
};

export class LayoutEngine {
    private elk = new Elk();

    private graph: ElkNode;
    private interfaceComponentLookup: Map<string, string> = new Map();

    constructor(originalGraph: Graph) {
        let edgeIdCounter = 0;
        this.graph = {
            id: "root",
            children: originalGraph.components
                .flatMap((component) => [component, ...component.interfaces])
                .map((node) => ({
                    id: node.id,
                    width: NODE_SIZE,
                    height: NODE_SIZE
                })),
            edges: [
                ...originalGraph.relations.map((relation) => ({
                    id: `edge${edgeIdCounter++}`,
                    sources: [relation.start],
                    targets: [relation.end]
                })),
                ...originalGraph.components.flatMap((component) =>
                    component.interfaces.map((inter) => ({
                        id: `edge${edgeIdCounter++}`,
                        sources: [component.id],
                        targets: [inter.id]
                    }))
                )
            ]
        };
        for (const component of originalGraph.components) {
            for (const inter of component.interfaces) {
                this.interfaceComponentLookup.set(inter.id, component.id);
            }
        }
    }

    async layout(): Promise<Map<string, Point>> {
        const stressRes = await this.elk.layout(this.graph, {
            layoutOptions: STRESS_OPTIONS
        });
        const stressCoordinates = this.extractCoordinates(stressRes);
        const idealAngle = this.calculateOptimalRotation(stressRes, stressCoordinates);
        this.rotateGraph(stressRes, -idealAngle);
        const rotatedStressCoordinates = this.extractCoordinates(stressRes);
        this.alignEdges(stressRes, rotatedStressCoordinates);
        const layeredRes = await this.elk.layout(stressRes, {
            layoutOptions: LAYERED_OPTIONS
        });
        const finalStressRes = await this.elk.layout(layeredRes, {
            layoutOptions: {
                ...STRESS_OPTIONS,
                interactive: "true"
            }
        });
        const finalStressCoordinates = this.extractCoordinates(finalStressRes);
        const idealAngle2 = this.calculateOptimalRotation(finalStressRes, finalStressCoordinates);
        this.rotateGraph(finalStressRes, -idealAngle2);
        if (this.isTallArea(finalStressRes)) {
            this.rotateGraph(finalStressRes, Math.PI / 2);
        }
        const finalCoordinates = this.extractCoordinates(finalStressRes);
        return this.computeFinalPositions(finalCoordinates);
    }

    private extractCoordinates(graph: ElkNode): Map<string, Point> {
        const result = new Map<string, Point>();
        for (const node of graph.children ?? []) {
            result.set(node.id, {
                x: node.x ?? 0,
                y: node.y ?? 0
            });
        }
        return result;
    }

    private alignEdges(graph: ElkNode, coordinates: Map<string, Point>): void {
        for (const edge of graph.edges ?? []) {
            const angle = Math2D.angle(
                Math2D.sub(coordinates.get(edge.targets[0])!, coordinates.get(edge.sources[0])!)
            );
            if (Math.abs(angle) > Math.PI / 2) {
                const tmp = edge.sources;
                edge.sources = edge.targets;
                edge.targets = tmp;
            }
        }
    }

    private calculateOptimalRotation(graph: ElkNode, coordinates: Map<string, Point>): number {
        const edges = graph.edges ?? [];
        if (edges.length == 0) {
            return 0;
        }
        const scores = edges.map((edge) => {
            const source = coordinates.get(edge.sources[0])!;
            const target = coordinates.get(edge.targets[0])!;
            let score = 0;
            for (const otherEdge of edges) {
                const otherSource = coordinates.get(otherEdge.sources[0])!;
                const otherTarget = coordinates.get(otherEdge.targets[0])!;
                const angleBetween = Math2D.angleBetween(
                    Math2D.sub(target, source),
                    Math2D.sub(otherTarget, otherSource)
                );
                const angle = angleBetween > Math.PI / 2 ? Math.PI - angleBetween : angleBetween;
                score += Math.sqrt(angle);
            }
            return score;
        });
        let minScore = Number.MAX_VALUE;
        let minIndex = -1;
        for (let i = 0; i < scores.length; i++) {
            if (scores[i] < minScore) {
                minScore = scores[i];
                minIndex = i;
            }
        }
        const source = coordinates.get(edges[minIndex].sources[0])!;
        const target = coordinates.get(edges[minIndex].targets[0])!;
        const angle = Math2D.angle(Math2D.sub(target, source));
        return angle;
    }

    /**
     * Rotates the graph by the given angle
     * Modifies the graph itself
     *
     * @param graph the graph to rotate
     * @param angle the angle to rotate by
     */
    private rotateGraph(graph: ElkNode, angle: number) {
        for (const node of graph.children ?? []) {
            const rotated = Math2D.rotate({ x: node.x ?? 0, y: node.y ?? 0 }, angle);
            node.x = rotated.x;
            node.y = rotated.y;
        }
    }

    private isTallArea(graph: ElkNode): boolean {
        if (graph.children == undefined) {
            return false;
        }
        let minX = Number.MAX_VALUE;
        let maxX = Number.MIN_VALUE;
        let minY = Number.MAX_VALUE;
        let maxY = Number.MIN_VALUE;
        for (const node of graph.children) {
            minX = Math.min(minX, node.x ?? 0);
            maxX = Math.max(maxX, node.x ?? 0);
            minY = Math.min(minY, node.y ?? 0);
            maxY = Math.max(maxY, node.y ?? 0);
        }
        return maxY - minY > maxX - minX;
    }

    private computeFinalPositions(coordinates: Map<string, Point>): Map<string, Point> {
        const result = new Map<string, Point>();
        for (const [id, pos] of coordinates) {
            const componentId = this.interfaceComponentLookup.get(id);
            if (componentId != undefined) {
                const componentPos = coordinates.get(componentId)!;
                result.set(id, Math2D.scaleTo(Math2D.sub(pos, componentPos), INTERFACE_DIST));
            } else {
                result.set(id, pos);
            }
        }
        return result;
    }
}
