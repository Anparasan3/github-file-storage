declare module "bun:test" {
  // Minimal type declarations for Bun's test API
  export function describe(name: string, fn: () => void): void;
  export function it(name: string, fn: () => void | Promise<void>): void;
  export function expect(actual: any): any;
  export function beforeEach(fn: () => void | Promise<void>): void;
  export const vi: any;
}
