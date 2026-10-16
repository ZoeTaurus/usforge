// Builds the 3D model for one bolted-on piece, already in place on the car.
// Regular parts sit in their cell, pointing away from the surface they're
// bolted to. Loose body sections (a nose, a door...) keep their real size
// and are turned in quarter-turns around the vertical axis.
import * as THREE from 'three';
import { PART_TYPES } from './parts.js';
import { createSectionModel } from './carModel.js';
import { cellCenter, isSectionPiece, SECTION_ANCHOR } from './build.js';

const UP = new THREE.Vector3(0, 1, 0);

export function makePieceModel({ type, i, j, k, normal, rot = 0 }) {
  const c = cellCenter(i, j, k);
  const g = new THREE.Group();
  g.position.set(c.x, c.y, c.z);
  if (isSectionPiece(type)) {
    const inner = createSectionModel(type);
    const a = cellCenter(...SECTION_ANCHOR[type]);
    inner.position.set(-a.x, -a.y, -a.z); // anchor cell at the origin
    g.add(inner);
    g.rotation.y = rot * Math.PI / 2;
  } else {
    g.quaternion.setFromUnitVectors(UP, new THREE.Vector3(...normal));
    PART_TYPES[type].build(g);
  }
  return g;
}
