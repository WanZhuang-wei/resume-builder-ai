import { describe, it, expect } from 'vitest'
import { groupProfileEntries } from '../consolidate-v2.js'

describe('groupProfileEntries', () => {
  it('should group projects with the same or contained name', () => {
    const entries = [
      { name: '智能简历生成助手', description: 'A' },
      { name: '智能简历生成助手', description: 'B' },
      { name: '图像识别系统', description: 'C' },
    ]

    const groups = groupProfileEntries(entries, 'projects')
    expect(groups.length).toBe(2)
    expect(groups[0].length).toBe(2)
    expect(groups[1].length).toBe(1)
  })

  it('should group work experiences by company name', () => {
    const entries = [
      { company: '某科技公司', position: '前端工程师' },
      { company: '某科技公司', position: '高级前端工程师' },
      { company: '另一家公司', position: '后端工程师' },
    ]

    const groups = groupProfileEntries(entries, 'workExperiences')
    expect(groups.length).toBe(2)
    expect(groups[0].length).toBe(2)
  })

  it('should group skills by name', () => {
    const entries = [
      { name: 'Python' },
      { name: 'python' },
      { name: 'Vue.js' },
    ]

    const groups = groupProfileEntries(entries, 'skills')
    expect(groups.length).toBe(2)
    expect(groups[0].length).toBe(2)
  })

  it('should keep clearly different entries separate', () => {
    const entries = [
      { name: '电商平台', description: 'A' },
      { name: '医疗影像系统', description: 'B' },
    ]

    const groups = groupProfileEntries(entries, 'projects')
    expect(groups.length).toBe(2)
    expect(groups[0].length).toBe(1)
    expect(groups[1].length).toBe(1)
  })
})


import { sanitizeMergedEntry } from '../consolidate-v2.js'

describe('sanitizeMergedEntry', () => {
  it('should unwrap array entry returned by AI', () => {
    const out = sanitizeMergedEntry([{ name: '\u667a\u80fd\u7b80\u5386\u52a9\u624b', description: 'A' }])
    expect(out).not.toBeNull()
    expect(Array.isArray(out)).toBe(false)
    expect(out.name).toBe('\u667a\u80fd\u7b80\u5386\u52a9\u624b')
  })

  it('should remove _source and keep plain fields', () => {
    const out = sanitizeMergedEntry({ name: 'A', _source: 'doc:1', tags: ['a', 'b'] })
    expect(out._source).toBeUndefined()
    expect(out.tags).toEqual(['a', 'b'])
  })

  it('should return null for invalid values', () => {
    expect(sanitizeMergedEntry(null)).toBeNull()
    expect(sanitizeMergedEntry('x')).toBeNull()
    expect(sanitizeMergedEntry([])).toBeNull()
  })
})
