import { describe, expect, it } from 'vitest'
import { assignLabelBands, type LabelBox, type TextAnchor } from '../src/ui/components/Chart'

/**
 * `assignLabelBands` is the fix for a real, user-reported bug: with only two
 * vertical bands and index-distance collision checks, three chart markers
 * landing close together (a common case — retiring right as Social Security
 * starts, with the plan failing shortly after) could still overlap, because
 * the third marker collided with both existing bands and landed on top of
 * whichever one it happened to check.
 *
 * These tests work in plain pixel space, no DOM or rendering involved — the
 * same estimated character width the component itself uses.
 */

const CHAR_WIDTH_PX = 5.5

const box = (key: string, x: number, text: string, anchor: TextAnchor = 'middle'): LabelBox => ({
  key,
  x,
  anchor,
  text,
})

/** True if two label boxes' rendered text would visually overlap, computed
 *  independently of the algorithm under test — this is what "correct" means. */
function overlaps(a: LabelBox, b: LabelBox): boolean {
  const span = (box: LabelBox): [number, number] => {
    const w = box.text.length * CHAR_WIDTH_PX
    if (box.anchor === 'start') return [box.x, box.x + w]
    if (box.anchor === 'end') return [box.x - w, box.x]
    return [box.x - w / 2, box.x + w / 2]
  }
  const [al, ar] = span(a)
  const [bl, br] = span(b)
  return al < br && bl < ar
}

describe('assignLabelBands', () => {
  it('puts two far-apart labels on the same band', () => {
    const boxes = [box('a', 50, 'Retire (age 65)'), box('b', 550, 'Money runs out (age 91)')]
    const bands = assignLabelBands(boxes)
    expect(bands.get('a')).toBe(0)
    expect(bands.get('b')).toBe(0)
  })

  it('separates two overlapping labels onto different bands', () => {
    const boxes = [box('a', 300, 'Retire (age 65)'), box('b', 310, 'Social Security starts (age 67)')]
    const bands = assignLabelBands(boxes)
    expect(bands.get('a')).not.toBe(bands.get('b'))
  })

  it('gives three mutually-overlapping labels three distinct bands', () => {
    // The exact shape of the reported bug: retire, SS, and depletion all
    // landing within a couple of chart-years of each other.
    const boxes = [
      box('retire', 300, 'Retire (age 65)'),
      box('ss', 305, 'Social Security starts (age 65)'),
      box('depleted', 310, 'Money runs out (age 66)'),
    ]
    const bands = assignLabelBands(boxes)
    const values = [...bands.values()]
    expect(new Set(values).size).toBe(3) // all three distinct
  })

  it('never produces an assignment where two same-band labels actually overlap', () => {
    // A denser sweep than any real chart would produce, as a general
    // correctness check rather than one specific scenario.
    const boxes: LabelBox[] = Array.from({ length: 8 }, (_, i) =>
      box(`m${i}`, 100 + i * 15, `Marker ${i} (age ${60 + i})`, i % 2 === 0 ? 'middle' : 'start'),
    )
    const bands = assignLabelBands(boxes)

    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i]!
        const b = boxes[j]!
        if (bands.get(a.key) === bands.get(b.key)) {
          expect(overlaps(a, b), `${a.key} and ${b.key} share band ${bands.get(a.key)}`).toBe(false)
        }
      }
    }
  })

  it('reuses an earlier band once there is room, rather than growing forever', () => {
    // Two overlap (forced to different bands), then a third far away from
    // both should be able to reuse band 0 instead of needing a third band.
    const boxes = [
      box('a', 300, 'Retire (age 65)'),
      box('b', 305, 'Social Security starts (age 65)'),
      box('c', 550, 'Money runs out (age 91)'),
    ]
    const bands = assignLabelBands(boxes)
    expect(bands.get('c')).toBe(0)
  })

  it('handles a single label trivially', () => {
    const bands = assignLabelBands([box('only', 300, 'Retire (age 65)')])
    expect(bands.get('only')).toBe(0)
  })

  it('handles no labels', () => {
    expect(assignLabelBands([]).size).toBe(0)
  })

  it('accounts for anchor when computing overlap, not just x position', () => {
    // 100px apart, anchored away from each other ('end' text extends left,
    // 'start' text extends right) — comfortably non-overlapping, so they
    // share a band. The point: overlap depends on which way the text
    // actually extends, not just how close the two anchor points are.
    const boxes = [
      box('left', 250, 'Retire (age 65)', 'end'),
      box('right', 350, 'Money runs out (age 91)', 'start'),
    ]
    const bands = assignLabelBands(boxes)
    expect(bands.get('left')).toBe(bands.get('right'))
  })

  it('separates two labels anchored toward each other at the same gap that let anchored-away labels share a band', () => {
    // Same 100px gap as above, but both 'middle'-anchored so their text
    // extends toward the centerpoint between them — with wide enough text,
    // that's enough to collide even at a gap that was fine facing outward.
    const boxes = [
      box('left', 250, 'Social Security starts (age 65)', 'middle'),
      box('right', 350, 'Money runs out (age 91)', 'middle'),
    ]
    const bands = assignLabelBands(boxes)
    expect(bands.get('left')).not.toBe(bands.get('right'))
  })
})
