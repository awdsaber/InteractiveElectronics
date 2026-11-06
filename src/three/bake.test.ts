import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { bakeGroup } from './bake'
import { G } from './geometry'
import { inkMaterial } from './materials'

describe('bakeGroup', () => {
  it('merges opaque untextured meshes (instances expanded) into one vertex-coloured draw', () => {
    const root = new THREE.Group()
    const a = new THREE.Mesh(G.box(), inkMaterial({ color: '#ff0000' }))
    const b = new THREE.Mesh(G.cyl(8), inkMaterial({ color: '#00ff00' }))
    b.position.set(1, 0, 0)
    const inst = new THREE.InstancedMesh(G.box(), inkMaterial({ color: '#0000ff' }), 3)
    for (let i = 0; i < 3; i++) inst.setMatrixAt(i, new THREE.Matrix4().makeTranslation(i, 1, 0))
    const glass = new THREE.Mesh(G.box(), inkMaterial({ color: '#ffffff', opacity: 0.5 }))
    const spinning = new THREE.Group()
    spinning.userData.noBake = true
    spinning.add(new THREE.Mesh(G.box(), inkMaterial({ color: '#123456' })))
    root.add(a, b, inst, glass, spinning)

    const r = bakeGroup(root)
    expect(r.fills).toHaveLength(1)
    expect(r.merged).toBe(3)
    expect(a.visible).toBe(false)
    expect(glass.visible).toBe(true)
    expect(spinning.children[0].visible).toBe(true)
    const pos = r.fills[0].geometry.getAttribute('position').count
    const expected =
      G.box().toNonIndexed().getAttribute('position').count * 4 + G.cyl(8).toNonIndexed().getAttribute('position').count
    expect(pos).toBe(expected)
    expect(r.fills[0].geometry.getAttribute('color')).toBeDefined()

    r.restore()
    r.dispose()
    expect(a.visible).toBe(true)
  })
})
