import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import type { User } from "@/core/types";
import { StudyResultController } from "./StudyResultController";

const mocks = vi.hoisted(() => ({ review: vi.fn(), useStudyResult: vi.fn() }));
vi.mock("@/comparativas/hooks/useStudyResult", () => ({
  useStudyResult: (options: unknown) => mocks.useStudyResult(options),
}));
vi.mock("./StudyResultDialog", () => ({
  StudyResultDialog: ({ isSubcomercial }: { isSubcomercial: boolean }) => (
    <div
      data-testid="persistent-dialog"
      data-subcommercial={String(isSubcomercial)}
    />
  ),
}));

test("keeps the persistent dialog but delegates the only review action to the ficha", () => {
  mocks.useStudyResult.mockReturnValue({
    canReview: true,
    open: false,
    error: null,
    review: mocks.review,
  });
  const user = { id: "admin", role: "admin", permissions: {} } as User;
  render(
    <StudyResultController
      comparisonId="cmp"
      comparisonStatus="awaiting_review"
      user={user}
      onRefresh={vi.fn()}
    >
      {(controller) => (
        <section aria-label="Acciones">
          <button onClick={controller.review}>
            Revisar resultado del estudio
          </button>
        </section>
      )}
    </StudyResultController>,
  );
  expect(
    screen.getAllByRole("button", { name: "Revisar resultado del estudio" }),
  ).toHaveLength(1);
  fireEvent.click(
    within(screen.getByRole("region", { name: "Acciones" })).getByRole(
      "button",
    ),
  );
  expect(mocks.review).toHaveBeenCalledOnce();
  expect(screen.getByTestId("persistent-dialog")).toBeInTheDocument();
});

test("disables study data and marks the dialog for subcommercial users", () => {
  mocks.useStudyResult.mockReturnValue({
    canReview: false,
    open: false,
    error: null,
    review: mocks.review,
  });
  const user = {
    id: "sales",
    role: "2",
    super_id: "manager-1",
    permissions: {
      "comparisons.study.complete": true,
      "comparisons.study.review": true,
    },
  } as User;

  render(
    <StudyResultController
      comparisonId="cmp"
      comparisonStatus="awaiting_review"
      user={user}
      onRefresh={vi.fn()}
    >
      {() => null}
    </StudyResultController>,
  );

  expect(mocks.useStudyResult).toHaveBeenCalledWith(
    expect.objectContaining({ enabled: false }),
  );
  expect(screen.getByTestId("persistent-dialog")).toHaveAttribute(
    "data-subcommercial",
    "true",
  );
});
