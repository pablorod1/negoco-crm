import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import type { User } from "@/core/types";
import { StudyResultController } from "./StudyResultController";

const mocks = vi.hoisted(() => ({ review: vi.fn() }));
vi.mock("@/comparativas/hooks/useStudyResult", () => ({
  useStudyResult: () => ({ canReview: true, open: false, error: null, review: mocks.review }),
}));
vi.mock("./StudyResultDialog", () => ({ StudyResultDialog: () => <div data-testid="persistent-dialog" /> }));

test("keeps the persistent dialog but delegates the only review action to the ficha", () => {
  const user = { id: "admin", role: "admin", permissions: {} } as User;
  render(<StudyResultController comparisonId="cmp" comparisonStatus="awaiting_review" user={user} onRefresh={vi.fn()}>
    {(controller) => <section aria-label="Acciones"><button onClick={controller.review}>Revisar resultado del estudio</button></section>}
  </StudyResultController>);
  expect(screen.getAllByRole("button", { name: "Revisar resultado del estudio" })).toHaveLength(1);
  fireEvent.click(within(screen.getByRole("region", { name: "Acciones" })).getByRole("button"));
  expect(mocks.review).toHaveBeenCalledOnce();
  expect(screen.getByTestId("persistent-dialog")).toBeInTheDocument();
});
