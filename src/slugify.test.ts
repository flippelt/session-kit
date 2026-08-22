import { describe, expect, it } from 'vitest'
import { slugify } from './slugify.js'

describe('slugify', () => {
  it('lowercases and replaces non-alphanumerics', () => {
    expect(slugify('Mestre Corvo')).toBe('mestre-corvo')
  })

  it('strips diacritics via NFD', () => {
    expect(slugify('São João')).toBe('sao-joao')
  })

  it('collapses runs of separators', () => {
    expect(slugify('A  Grande--Fenda')).toBe('a-grande-fenda')
  })
})
