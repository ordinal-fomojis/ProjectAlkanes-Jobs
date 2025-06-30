import { join } from "path"

export const dataPath = (...path: string[]) => join('tests/test-utils/mock-data', ...path)
