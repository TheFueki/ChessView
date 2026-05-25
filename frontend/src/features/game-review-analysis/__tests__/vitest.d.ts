declare module "vitest" {
  interface Matchers {
    toBe: (expected: unknown) => void;
    toEqual: (expected: unknown) => void;
    toHaveLength: (expected: number) => void;
    toContain: (expected: string) => void;
    toMatchObject: (expected: unknown) => void;
    toBeLessThan: (expected: number) => void;
  }

  interface Expect {
    (actual: unknown): Matchers;
    any: (constructor: unknown) => unknown;
  }

  export const describe: (name: string, fn: () => void) => void;
  export const it: (name: string, fn: () => void | Promise<void>) => void;
  export const expect: Expect;
}
