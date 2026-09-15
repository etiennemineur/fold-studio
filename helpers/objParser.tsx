export interface ParsedMesh {
  vertices: [number, number, number][];
  faces: number[][];
  normals?: [number, number, number][];
}

/**
 * Parses a standard Wavefront OBJ file string into structured mesh data.
 * Supports arbitrary polygonal faces and relative (negative) vertex indices.
 */
export function objParser(objText: string): ParsedMesh {
  const vertices: [number, number, number][] = [];
  const normals: [number, number, number][] = [];
  const faces: number[][] = [];
  
  const lines = objText.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('#')) continue;
    
    const parts = line.split(/\s+/);
    const type = parts[0];
    
    if (type === 'v' && parts.length >= 4) {
      vertices.push([parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3])]);
    } else if (type === 'vn' && parts.length >= 4) {
      normals.push([parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3])]);
    } else if (type === 'f') {
      const face: number[] = [];
      for (let j = 1; j < parts.length; j++) {
        const vPart = parts[j].split('/')[0];
        if (vPart) {
          let vIdx = parseInt(vPart, 10);
          if (vIdx < 0) {
            // Negative indices are relative to the end of the current vertex list
            vIdx = vertices.length + vIdx;
          } else {
            // OBJ indices are 1-based, converting to 0-based
            vIdx -= 1;
          }
          face.push(vIdx);
        }
      }
      if (face.length >= 3) {
        faces.push(face);
      }
    }
  }
  
  // Normalize to 100mm bounding box
  if (vertices.length > 0) {
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

    for (const v of vertices) {
      if (v[0] < minX) minX = v[0];
      if (v[1] < minY) minY = v[1];
      if (v[2] < minZ) minZ = v[2];
      if (v[0] > maxX) maxX = v[0];
      if (v[1] > maxY) maxY = v[1];
      if (v[2] > maxZ) maxZ = v[2];
    }

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const centerZ = (minZ + maxZ) / 2;

    const extentX = maxX - minX;
    const extentY = maxY - minY;
    const extentZ = maxZ - minZ;

    const maxExtent = Math.max(extentX, extentY, extentZ);

    if (maxExtent > 0) {
      for (let i = 0; i < vertices.length; i++) {
        vertices[i][0] = ((vertices[i][0] - centerX) / maxExtent) * 100;
        vertices[i][1] = ((vertices[i][1] - centerY) / maxExtent) * 100;
        vertices[i][2] = ((vertices[i][2] - centerZ) / maxExtent) * 100;
      }
    }
  }

  return {
    vertices,
    faces,
    ...(normals.length > 0 ? { normals } : {})
  };
}