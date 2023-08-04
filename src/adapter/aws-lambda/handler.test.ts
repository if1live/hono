import { isContentTypeBinary, isContentCompressed } from './handler'

describe('isContentTypeBinary', () => {
  it('Should determine whether it is binary', () => {
    expect(isContentTypeBinary('image/png')).toBe(true)
    expect(isContentTypeBinary('font/woff2')).toBe(true)
    expect(isContentTypeBinary('text/plain')).toBe(false)
    expect(isContentTypeBinary('text/plain; charset=UTF-8')).toBe(false)
    expect(isContentTypeBinary('text/css')).toBe(false)
    expect(isContentTypeBinary('text/javascript')).toBe(false)
    expect(isContentTypeBinary('application/json')).toBe(false)
    expect(isContentTypeBinary('application/ld+json')).toBe(false)
    expect(isContentTypeBinary('application/json; charset=UTF-8')).toBe(false)
  })
})

describe('isContentCompressed', () => {
  it('Should determine whether it is compressed', () => {
    expect(isContentCompressed('gzip')).toBe(true)
    expect(isContentCompressed('compress')).toBe(true)
    expect(isContentCompressed('deflate')).toBe(true)
    expect(isContentCompressed('br')).toBe(true)
    expect(isContentCompressed('deflate, gzip')).toBe(true)
    expect(isContentCompressed('')).toBe(false)
    expect(isContentCompressed('unknown')).toBe(false)
  })
})
