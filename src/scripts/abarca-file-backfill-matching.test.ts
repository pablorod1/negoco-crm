import { describe, expect, test } from "vitest";
import { matchStorageObject } from "./abarca-file-backfill-matching";

const file = {
  filename: "estudio_acme.pdf",
  size: 2048,
  extension: "PDF",
};

describe("matchStorageObject", () => {
  test("matches a unique nested object by filename, extension and size", () => {
    const candidate = {
      fullPath:
        "organization/comparativas/comparison/abarca/claim/estudio_acme.pdf",
      name: "estudio_acme.pdf",
      size: 2048,
    };

    expect(matchStorageObject(file, [candidate])).toEqual({
      kind: "matched",
      candidate,
    });
  });

  test("uses size to distinguish objects with the same filename", () => {
    const staleCandidate = {
      fullPath:
        "organization/comparativas/comparison/abarca/old/estudio_acme.pdf",
      name: "estudio_acme.pdf",
      size: 1024,
    };
    const candidate = {
      fullPath:
        "organization/comparativas/comparison/abarca/current/estudio_acme.pdf",
      name: "estudio_acme.pdf",
      size: 2048,
    };

    expect(
      matchStorageObject(file, [staleCandidate, candidate]),
    ).toEqual({ kind: "matched", candidate });
  });

  test("matches a logical filename that Firebase split into path segments", () => {
    const fileWithSlash = {
      filename: "estudio_GANA - 24 HORAS 5001/10000.pdf",
      size: 882508,
      extension: "pdf",
    };
    const candidate = {
      fullPath:
        "organization/comparativas/comparison/abarca/claim/estudio_GANA - 24 HORAS 5001/10000.pdf",
      name: "10000.pdf",
      size: 882508,
    };

    expect(matchStorageObject(fileWithSlash, [candidate])).toEqual({
      kind: "matched",
      candidate,
    });
  });

  test("reports duplicate exact matches as ambiguous", () => {
    const candidates = ["claim-1", "claim-2"].map((claim) => ({
      fullPath: `organization/comparativas/comparison/abarca/${claim}/estudio_acme.pdf`,
      name: "estudio_acme.pdf",
      size: 2048,
    }));

    expect(matchStorageObject(file, candidates)).toEqual({
      kind: "ambiguous",
      candidates,
    });
  });

  test("reports metadata mismatch when only the filename matches", () => {
    const candidates = [
      {
        fullPath:
          "organization/comparativas/comparison/abarca/claim/estudio_acme.pdf",
        name: "estudio_acme.pdf",
        size: 4096,
      },
    ];

    expect(matchStorageObject(file, candidates)).toEqual({
      kind: "metadata_mismatch",
      candidates,
    });
  });

  test("reports not found when no filename matches", () => {
    expect(
      matchStorageObject(file, [
        {
          fullPath:
            "organization/comparativas/comparison/abarca/claim/other.pdf",
          name: "other.pdf",
          size: 2048,
        },
      ]),
    ).toEqual({ kind: "not_found" });
  });
});
