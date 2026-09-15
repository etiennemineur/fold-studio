import { FoldData, FaceTreeNode, buildFaceTree } from "./foldEngine";

function edgeKey(v1: number, v2: number): string {
  return `${Math.min(v1, v2)}-${Math.max(v1, v2)}`;
}

export interface DoubleScoringResult {
  foldData: FoldData;
  doubledToBaseMap: Map<number, number>;
}

/**
 * Applies double scoring to a fold pattern if the material thickness exceeds the threshold.
 * It splits existing fold lines into two parallel lines separated by the material thickness,
 * introducing a flat "channel" face between them to accommodate the material volume.
 *
 * @param foldData The original FOLD data structure
 * @param materialThickness The thickness of the material (in mm)
 * @param threshold The minimum thickness to trigger double scoring (defaults to 0.5)
 * @returns The transformed FOLD data and the mapping to base edges
 * 
 * Professional standards for material thickness compensation:
 * - Below 0.5mm: no compensation needed (paper/thin card)
 * - 0.5mm to 1.0mm: light double scoring for medium cardstock
 * - Above 1.0mm: full double scoring for thick corrugated
 */
export function applyDoubleScoring(
  foldData: FoldData,
  materialThickness: number,
  threshold: number = 0.5
): DoubleScoringResult {
  if (materialThickness < threshold) {
    const identityMap = new Map<number, number>();
    for (let i = 0; i < foldData.edgesVertices.length; i++) {
      identityMap.set(i, i);
    }
    return { foldData, doubledToBaseMap: identityMap };
  }

  // Step 1: Deep copy vertices and faces
  const newVertices: [number, number, number?][] = foldData.verticesCoords.map((v) =>
    v.length > 2 ? [v[0], v[1], v[2]] : [v[0], v[1]]
  );
  const newFaces: number[][] = foldData.facesVertices.map((f) => [...f]);

  // Record original edges for lookups
  const origEdgeMap = new Map<string, { assignment: "M" | "V" | "B" | "F" | "P"; angle: number; baseIndex: number }>();
  for (let i = 0; i < foldData.edgesVertices.length; i++) {
    const [v1, v2] = foldData.edgesVertices[i];
    origEdgeMap.set(edgeKey(v1, v2), {
      assignment: foldData.edgesAssignment[i],
      angle: foldData.edgesFoldAngle[i],
      baseIndex: i,
    });
  }

  // Step 2: Build face tree from original data
  const tree = buildFaceTree(foldData);

  // Step 3 & 4: Collect hinges in BFS order and build subtree map
  const subtreeMap = new Map<number, Set<number>>();

  function computeSubtree(node: FaceTreeNode): Set<number> {
    const set = new Set<number>();
    set.add(node.faceIndex);
    for (const child of node.children) {
      const childSet = computeSubtree(child);
      for (const f of childSet) set.add(f);
    }
    subtreeMap.set(node.faceIndex, set);
    return set;
  }

  if (tree.length > 0) {
    computeSubtree(tree[0]);
  }

  interface HingeTask {
    parentIdx: number;
    childNode: FaceTreeNode;
  }

  const queue: HingeTask[] = [];
  if (tree.length > 0) {
    for (const child of tree[0].children) {
      queue.push({ parentIdx: tree[0].faceIndex, childNode: child });
    }
  }

  const hingeTasks: HingeTask[] = [];
  let head = 0;
  while (head < queue.length) {
    const curr = queue[head++];
    hingeTasks.push(curr);
    for (const child of curr.childNode.children) {
      queue.push({ parentIdx: curr.childNode.faceIndex, childNode: child });
    }
  }

  const channelFaces: number[][] = [];
  const edgeOverrides = new Map<string, { assignment: "M" | "V" | "B" | "F" | "P"; angle: number; baseEdgeIdx: number }>();

  // Step 5: Process each hinge in BFS order
  for (const task of hingeTasks) {
    const { parentIdx, childNode } = task;
    const childIdx = childNode.faceIndex;

    const origH1 = childNode.hingeEdge![0];
    const origH2 = childNode.hingeEdge![1];
    const origEdgeInfo = origEdgeMap.get(edgeKey(origH1, origH2));

    if (!origEdgeInfo) continue;
    if (origEdgeInfo.assignment !== "M" && origEdgeInfo.assignment !== "V") continue;

    // Dynamically find current hinge in the mutated faces to account for previous vertex replacements
    const pFace = newFaces[parentIdx];
    const cFace = newFaces[childIdx];
    const shared = pFace.filter((v) => cFace.includes(v));

    let h1 = origH1;
    let h2 = origH2;

    if (shared.length === 2) {
      h1 = shared[0];
      h2 = shared[1];
      const idx1 = pFace.indexOf(h1);
      const idx2 = pFace.indexOf(h2);
      const L = pFace.length;
      if (pFace[(idx1 + 1) % L] === h2) {
        // Directed order is h1 -> h2
      } else if (pFace[(idx2 + 1) % L] === h1) {
        // Directed order is h2 -> h1
        h1 = shared[1];
        h2 = shared[0];
      } else {
        h1 = origH1;
        h2 = origH2;
      }
    }

    // a. Get current positions
    const h1_pos = newVertices[h1];
    const h2_pos = newVertices[h2];

    // b. Compute edge direction
    const dx = h2_pos[0] - h1_pos[0];
    const dy = h2_pos[1] - h1_pos[1];
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const ux = dx / len;
    const uy = dy / len;

    // c. Compute two perpendicular candidates
    const perp1 = [-uy, ux];
    const perp2 = [uy, -ux];

    // d. Pick the perpendicular pointing toward the child face centroid
    const midX = (h1_pos[0] + h2_pos[0]) / 2;
    const midY = (h1_pos[1] + h2_pos[1]) / 2;

    let cx = 0;
    let cy = 0;
    for (const v of cFace) {
      cx += newVertices[v][0];
      cy += newVertices[v][1];
    }
    cx /= cFace.length;
    cy /= cFace.length;

    const vecX = cx - midX;
    const vecY = cy - midY;

    const dot1 = perp1[0] * vecX + perp1[1] * vecY;
    const perp = dot1 > 0 ? perp1 : perp2;

    // e. Compute offset
    const offsetX = perp[0] * materialThickness;
    const offsetY = perp[1] * materialThickness;

    // f. Create new vertices
    const h1New = newVertices.length;
    newVertices.push([h1_pos[0] + offsetX, h1_pos[1] + offsetY, h1_pos[2]]);
    const h2New = newVertices.length;
    newVertices.push([h2_pos[0] + offsetX, h2_pos[1] + offsetY, h2_pos[2]]);

    // g. Collect subtree vertices
    const subtree = subtreeMap.get(childIdx)!;
    const subtreeVerts = new Set<number>();
    for (const fIdx of subtree) {
      for (const v of newFaces[fIdx]) {
        if (v !== h1 && v !== h2) {
          subtreeVerts.add(v);
        }
      }
    }

    // h. Shift subtree vertex positions
    for (const v of subtreeVerts) {
      const oldV = newVertices[v];
      newVertices[v] = [oldV[0] + offsetX, oldV[1] + offsetY, oldV[2]];
    }

    // i. Replace occurrences in C's subtree
    for (const fIdx of subtree) {
      newFaces[fIdx] = newFaces[fIdx].map((v) => (v === h1 ? h1New : v === h2 ? h2New : v));
    }

    // j. Create channel face
    channelFaces.push([h2, h1, h1New, h2New]);

        // k. Record edge overrides
    // The rebuilt edge map normalises vertex order to [min,max]. When the parent
    // face's CCW traversal direction (h1→h2) is the REVERSE of [min,max]
    // (i.e. h1 > h2), buildFaceTree will negate the stored angle. Pre-negate
    // the parent-side half-angle so both halves produce the same directed fold.
    const halfAngle = origEdgeInfo.angle / 2;
    const parentSideAngle = h1 > h2 ? -halfAngle : halfAngle;
    const baseIdx = origEdgeInfo.baseIndex;
    edgeOverrides.set(edgeKey(h1, h2), { assignment: origEdgeInfo.assignment, angle: parentSideAngle, baseEdgeIdx: baseIdx });
    edgeOverrides.set(edgeKey(h1New, h2New), {
      assignment: origEdgeInfo.assignment,
      angle: halfAngle,
      baseEdgeIdx: baseIdx,
    });
    edgeOverrides.set(edgeKey(h1, h1New), { assignment: "F", angle: 0, baseEdgeIdx: -1 });
    edgeOverrides.set(edgeKey(h2, h2New), { assignment: "F", angle: 0, baseEdgeIdx: -1 });
  }

  // Step 6: Combine faces
  const finalFaces = [...newFaces, ...channelFaces];

  // Step 7: Rebuild edge map
  const newEdgesMap = new Map<string, { count: number; vertices: [number, number] }>();

  for (let i = 0; i < finalFaces.length; i++) {
    const face = finalFaces[i];
    for (let j = 0; j < face.length; j++) {
      const v1 = face[j];
      const v2 = face[(j + 1) % face.length];
      const key = edgeKey(v1, v2);
      if (!newEdgesMap.has(key)) {
                        newEdgesMap.set(key, { count: 1, vertices: [Math.min(v1, v2), Math.max(v1, v2)] });
      } else {
        newEdgesMap.get(key)!.count++;
      }
    }
  }

  const finalEdgesVertices: [number, number][] = [];
  const finalEdgesAssignment: ("M" | "V" | "B" | "F" | "P")[] = [];
  const finalEdgesFoldAngle: number[] = [];
  const doubledToBaseMap = new Map<number, number>();

  for (const [key, info] of newEdgesMap.entries()) {
    const displayIdx = finalEdgesVertices.length;
    finalEdgesVertices.push(info.vertices);
    const override = edgeOverrides.get(key);

    if (override) {
      finalEdgesAssignment.push(override.assignment);
      finalEdgesFoldAngle.push(override.angle);
      if (override.baseEdgeIdx >= 0) {
        doubledToBaseMap.set(displayIdx, override.baseEdgeIdx);
      }
    } else {
      if (info.count === 1) {
        finalEdgesAssignment.push("B");
        finalEdgesFoldAngle.push(0);
      } else {
        const origInfo = origEdgeMap.get(key);
        if (origInfo) {
          finalEdgesAssignment.push(origInfo.assignment);
          finalEdgesFoldAngle.push(origInfo.angle);
          doubledToBaseMap.set(displayIdx, origInfo.baseIndex);
        } else {
          finalEdgesAssignment.push("F");
          finalEdgesFoldAngle.push(0);
        }
      }
    }
  }

  // Step 8: Return mutated FoldData
  return {
    foldData: {
      verticesCoords: newVertices,
      edgesVertices: finalEdgesVertices,
      edgesAssignment: finalEdgesAssignment,
      edgesFoldAngle: finalEdgesFoldAngle,
      facesVertices: finalFaces,
    },
    doubledToBaseMap,
  };
}