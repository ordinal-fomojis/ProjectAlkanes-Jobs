import z, { ZodError } from "zod"
import { fromZodError } from "zod-validation-error"

export class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

export function parse<Output, Input>(schema: z.ZodType<Output, Input>, obj: unknown) {
  const result = schema.safeParse(obj)
  if (!result.success) {
    // If the schema was a union, it is likely that the object was close to one of the union types, 
    // and the other is wildly different. In this case, the error message will be ridiculously long, because one of the
    // schemas will be wrong all over the place. To simplify, we will only select the simplest error out of the unions.
    const issue = result.error.issues[0]
    if (issue != null && result.error.issues.length === 1 && issue.code === 'invalid_union' && issue.errors.length > 0) {
      const error = issue.errors.reduce((a, b) => a.length < b.length ? a : b)
      throw new ValidationError(fromZodError(new ZodError(error), { prefix: null }).message)
    }

    throw new ValidationError(fromZodError(result.error, { prefix: null }).message)
  }
  return result.data
}
