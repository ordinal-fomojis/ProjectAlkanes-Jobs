import { describe, expect, it } from 'vitest'
import z from 'zod'
import { parse } from '../../src/utils/parse.js'

describe('parse utility', () => {
  it('should successfully parse valid data according to schema', () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
    })
    
    const validData = { name: 'John', age: 30 }
    
    expect(parse(schema, validData)).toEqual(validData)
  })

  it('should throw an error for invalid data', () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
    })
    
    const invalidData = { name: 'John', age: '30' }
    
    expect(() => parse(schema, invalidData)).toThrow(/^Invalid input: expected number, received string at "age"$/)
  })

  it('should simplify union error messages by picking the simplest error', () => {
    const schema1 = z.array(z.object({ age: z.number() }))
    const schema2 = z.array(z.object({ age: z.string() }))
    
    const unionSchema = z.union([schema1, schema2])
    
    // Error is about the age field being a string instead of a number,
    // rather than about it being a number instead of a string
    const data1 = Array.from({ length: 1000 }, (_, i) => (i === 15 ? { age: i.toString() } : { age: i }))
    expect(() => parse(unionSchema, data1)).toThrow(/^Invalid input: expected number, received string at "\[15\].age"$/)

    // Now it is the other way around, the error is about the string instead of the number
    const data2 = Array.from({ length: 1000 }, (_, i) => (i === 15 ? { age: i } : { age: i.toString() }))
    expect(() => parse(unionSchema, data2)).toThrow(/^Invalid input: expected string, received number at "\[15\].age"$/)
  })
})
