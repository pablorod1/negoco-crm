import { describe, expect, test } from "vitest";
import { canUseNegocoStudies } from "./access";

const WITH_MODULE = { negoco_studies: true };
const WITHOUT_MODULE = { negoco_studies: false };

describe("canUseNegocoStudies", () => {
  test("admin and backoffice can use it by default when the module is active", () => {
    for (const role of ["admin", "1"]) {
      expect(
        canUseNegocoStudies({
          modules: WITH_MODULE,
          role,
          isSubcomercial: false,
          permissions: undefined,
        }),
      ).toBe(true);
    }
  });

  test("nobody can use it without the module, not even admin", () => {
    expect(
      canUseNegocoStudies({
        modules: WITHOUT_MODULE,
        role: "admin",
        isSubcomercial: false,
        permissions: undefined,
      }),
    ).toBe(false);
    expect(
      canUseNegocoStudies({
        modules: undefined,
        role: "admin",
        isSubcomercial: false,
        permissions: undefined,
      }),
    ).toBe(false);
  });

  test("a comercial needs both permissions granted explicitly", () => {
    const base = { modules: WITH_MODULE, role: "2", isSubcomercial: false };
    expect(canUseNegocoStudies({ ...base, permissions: undefined })).toBe(false);
    expect(
      canUseNegocoStudies({
        ...base,
        permissions: { "comparisons.study.negoco": true },
      }),
    ).toBe(false);
    expect(
      canUseNegocoStudies({
        ...base,
        permissions: {
          "comparisons.study.complete": true,
          "comparisons.study.negoco": true,
        },
      }),
    ).toBe(true);
  });

  test("a subcomercial never can, whatever the permissions say", () => {
    expect(
      canUseNegocoStudies({
        modules: WITH_MODULE,
        role: "2",
        isSubcomercial: true,
        permissions: {
          "comparisons.study.complete": true,
          "comparisons.study.negoco": true,
        },
      }),
    ).toBe(false);
  });

  test("backoffice loses it when the permission is turned off", () => {
    expect(
      canUseNegocoStudies({
        modules: WITH_MODULE,
        role: "1",
        isSubcomercial: false,
        permissions: { "comparisons.study.negoco": false },
      }),
    ).toBe(false);
  });
});
