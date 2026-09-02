import { describe, expect, it } from 'vitest'

/**
 * T-M0-01 — proves the test harness itself runs.
 * The first failing test of the project: without a working toolchain, nothing else can be red.
 */
describe('T-M0-01 toolchain', () => {
  it('runs tests', () => {
    expect(1 + 1).toBe(2)
  })

  it('has strict TypeScript available', () => {
    const value: string = 'worldwar'
    expect(value).toHaveLength(8)
  })
})
