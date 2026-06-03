declare module "bun:test" {
  export const describe: typeof import("@jest/globals").describe;
  export const test: typeof import("@jest/globals").test;
  export const expect: typeof import("@jest/globals").expect;
  export const beforeEach: typeof import("@jest/globals").beforeEach;
  export const afterEach: typeof import("@jest/globals").afterEach;
  export const beforeAll: typeof import("@jest/globals").beforeAll;
  export const afterAll: typeof import("@jest/globals").afterAll;
  export const mock: typeof import("@jest/globals").jest & {
    module: (moduleName: string, factory: () => unknown) => void;
  };
}
