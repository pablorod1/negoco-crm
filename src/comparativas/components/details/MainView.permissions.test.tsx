import type React from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import MainView from "./MainView";
import CompletarEstudioModal from "../editComparativa/CompletarEstudioModal";

vi.mock("@/comercializadoras/hooks/useEnergySupplierById", () => ({
  useEnergySupplierById: () => ({ supplier: null, loading: false }),
}));
vi.mock("@/comercializadoras/hooks/useActiveEnergySuppliers", () => ({
  useActiveEnergySuppliers: () => ({
    activeSuppliers: [],
    loading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));
vi.mock("@/core/hooks/use-user-company-commissions", () => ({
  useUserCompanyCommissions: () => ({ commissions: [], loading: false }),
}));
vi.mock("@/core/view-transitions/useGenieEffect", () => ({
  useSidebarSlideNavigation: () => () => {},
}));
vi.mock("next-view-transitions", () => ({
  Link: ({
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props}>{children}</a>
  ),
  useTransitionRouter: () => ({ push: () => {} }),
}));
vi.mock("@/core/contexts/UserContext", () => ({
  useUser: () => ({
    userData: { id: "u1", role: "admin", organization: { id: "o1" } },
    loading: false,
    refreshUserData: () => Promise.resolve(),
    getPlan: () => null,
    showReauthModal: false,
    setShowReauthModal: () => {},
  }),
}));
vi.mock("@/comparativas/components/details/AbarcaPanel", () => ({
  AbarcaPanel: () => <button type="button">Estudio con IA</button>,
}));

const baseComparativa = {
  id: "comparison-1",
  client: "ACME",
  service: "Luz",
  plan: ["fijo"],
  comision: { fijo: 0, indexado: 0 },
  comision_sales_person: { fijo: 0, indexado: 0 },
  notes: [],
  user: { id: "", name: "Ana", email: "ana@example.com", role: "2" },
  creation_date: "2026-01-01",
  status: "pending",
  tramite_id: undefined,
  files: [],
  organization: { id: "organization-1", abarca_user_id: null },
};

function renderMainView({
  role,
  status,
  complete,
  review,
  aiStudiesUserId = 42,
  hasAbarcaUserId = aiStudiesUserId !== null,
  aiStudyData,
  isSubcomercial = false,
  onUpdate = () => {},
  pendingResult = false,
  studyResult,
}: {
  role: string;
  status:
    | "pending"
    | "processing"
    | "awaiting_review"
    | "completed"
    | "rejected";
  complete: boolean;
  review: boolean;
  aiStudiesUserId?: number | null;
  hasAbarcaUserId?: boolean;
  aiStudyData?: Record<string, unknown>;
  isSubcomercial?: boolean;
  onUpdate?: () => void;
  pendingResult?: boolean;
  studyResult?: React.ComponentProps<typeof MainView>["studyResult"];
}) {
  render(
    <MainView
      comparativa={{
        ...baseComparativa,
        status,
        has_pending_study_result: pendingResult,
        ...(aiStudyData ? { abarca_estudio: aiStudyData } : {}),
      } as never}
      userData={
        {
          id: "viewer-1",
          role,
          permissions: {
            "comparisons.study.complete": complete,
            "comparisons.study.review": review,
          },
          has_abarca_user_id: hasAbarcaUserId,
          organization: {
            id: "organization-1",
            abarca_user_id: aiStudiesUserId,
          },
        } as never
      }
      onUpdate={onUpdate}
      isSubcomercial={isSubcomercial}
      isEditable
      isComercialEditable={false}
      isProcessed={false}
      studyResult={studyResult}
    />,
  );
}

function expectPendingActions({
  ai,
  manual,
  reject,
}: {
  ai: boolean;
  manual: boolean;
  reject: boolean;
}) {
  const aiButton = screen.queryByRole("button", { name: "Estudio con IA" });
  const manualButton = screen.queryByRole("button", {
    name: "Estudio manual",
  });
  const rejectButton = screen.queryByRole("button", { name: "Rechazar" });

  if (ai) {
    expect(aiButton).toBeInTheDocument();
  } else {
    expect(aiButton).not.toBeInTheDocument();
  }

  if (manual) {
    expect(manualButton).toBeInTheDocument();
  } else {
    expect(manualButton).not.toBeInTheDocument();
  }

  if (reject) {
    expect(rejectButton).toBeInTheDocument();
  } else {
    expect(rejectButton).not.toBeInTheDocument();
  }
}

describe("MainView study permissions", () => {
  const resultAction = () => ({
    canReview: true, loading: false, submitting: false, open: false,
    error: null, review: vi.fn(), startWatching: vi.fn(), panelOpen: false,
    setPanelOpen: vi.fn(),
  });

  test.each([
    { role: "1", complete: false, review: true },
    { role: "2", complete: true, review: false },
  ])("places result review inside actions for authorized role $role", ({ role, complete, review }) => {
    const controller = resultAction();
    renderMainView({ role, status: "awaiting_review", complete, review, pendingResult: true, studyResult: controller });
    const actions = screen.getByRole("region", { name: "Acciones" });
    const button = within(actions).getByRole("button", { name: "Revisar resultado del estudio" });
    expect(screen.getAllByRole("button", { name: "Revisar resultado del estudio" })).toHaveLength(1);
    expect(button).toHaveClass("w-full");
    fireEvent.click(button);
    expect(controller.review).toHaveBeenCalledOnce();
    expect(screen.queryByText(/en la parte superior de la ficha/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Asignar Comercializadora y Comisiones" })).not.toBeInTheDocument();
  });

  test("keeps result review disabled until the server confirms availability", () => {
    renderMainView({ role: "1", status: "awaiting_review", complete: true, review: true, pendingResult: true, studyResult: { ...resultAction(), canReview: false } });
    expect(screen.getByRole("button", { name: "Revisar resultado del estudio" })).toBeDisabled();
  });

  test("does not show result actions without effective permissions", () => {
    renderMainView({ role: "2", status: "awaiting_review", complete: false, review: false, pendingResult: true, studyResult: resultAction() });
    expect(screen.queryByRole("button", { name: "Revisar resultado del estudio" })).not.toBeInTheDocument();
  });

  test("shows background errors with the actions instead of above navigation", () => {
    renderMainView({ role: "1", status: "awaiting_review", complete: true, review: true, pendingResult: true, studyResult: { ...resultAction(), error: "No se pudo comprobar el estudio." } });
    const actions = screen.getByRole("region", { name: "Acciones" });
    expect(within(actions).getByRole("status")).toHaveTextContent("No se pudo comprobar el estudio.");
  });

  test.each([
    {
      label: "AI tenant with complete permission",
      aiStudiesUserId: 42,
      complete: true,
      expectedAi: true,
      expectedActions: true,
    },
    {
      label: "non-AI tenant with complete permission",
      aiStudiesUserId: null,
      complete: true,
      expectedAi: false,
      expectedActions: true,
    },
    {
      label: "AI tenant without complete permission",
      aiStudiesUserId: 42,
      complete: false,
      expectedAi: false,
      expectedActions: false,
    },
    {
      label: "non-AI tenant without complete permission",
      aiStudiesUserId: null,
      complete: false,
      expectedAi: false,
      expectedActions: false,
    },
  ])("$label", ({ aiStudiesUserId, complete, expectedAi, expectedActions }) => {
    renderMainView({
      role: "2",
      status: "pending",
      complete,
      review: false,
      aiStudiesUserId,
    });

    expectPendingActions({
      ai: expectedAi,
      manual: expectedActions,
      reject: expectedActions,
    });

    if (expectedActions) {
      expect(
        screen.queryByText("No hay acciones disponibles"),
      ).not.toBeInTheDocument();
    } else {
      expect(
        screen.getByText("No hay acciones disponibles"),
      ).toBeInTheDocument();
      expect(
        screen.getByText("No tienes permiso para completar este estudio."),
      ).toBeInTheDocument();
    }
  });

  test("commercial override can complete manually and reject", () => {
    renderMainView({
      role: "2",
      status: "pending",
      complete: true,
      review: false,
      aiStudiesUserId: null,
    });

    const manualButton = screen.getByRole("button", {
      name: "Estudio manual",
    });
    expect(
      screen.getByRole("button", { name: "Rechazar" }),
    ).toBeInTheDocument();

    fireEvent.click(manualButton);
    expect(
      screen.getByLabelText(
        "Selecciona la comercializadora que ganó la comparativa",
      ),
    ).toHaveAttribute("id", "supplier-select");
  });

  test("role 2 sees AI studies with an individual identity and no organization identity", () => {
    renderMainView({
      role: "2",
      status: "pending",
      complete: true,
      review: false,
      hasAbarcaUserId: true,
      aiStudiesUserId: null,
    });

    expectPendingActions({ ai: true, manual: true, reject: true });
  });

  test("role 2 without an individual identity hides only AI despite an organization identity", () => {
    renderMainView({
      role: "2",
      status: "pending",
      complete: true,
      review: false,
      hasAbarcaUserId: false,
      aiStudiesUserId: 42,
    });

    expectPendingActions({ ai: false, manual: true, reject: true });
  });

  test("an AI identity does not grant visibility when complete permission is denied", () => {
    renderMainView({
      role: "2",
      status: "pending",
      complete: false,
      review: false,
      hasAbarcaUserId: true,
      aiStudiesUserId: 42,
    });

    expectPendingActions({ ai: false, manual: false, reject: false });
  });

  test.each([
    {
      role: "admin",
      hasAbarcaUserId: true,
      aiStudiesUserId: null,
      expectedAi: false,
    },
    {
      role: "admin",
      hasAbarcaUserId: false,
      aiStudiesUserId: 42,
      expectedAi: true,
    },
    {
      role: "1",
      hasAbarcaUserId: true,
      aiStudiesUserId: null,
      expectedAi: false,
    },
    {
      role: "1",
      hasAbarcaUserId: false,
      aiStudiesUserId: 42,
      expectedAi: true,
    },
  ])(
    "role $role uses only the organization AI identity when visibility is $expectedAi",
    ({ role, hasAbarcaUserId, aiStudiesUserId, expectedAi }) => {
      renderMainView({
        role,
        status: "pending",
        complete: true,
        review: false,
        hasAbarcaUserId,
        aiStudiesUserId,
      });

      expectPendingActions({
        ai: expectedAi,
        manual: true,
        reject: true,
      });
    },
  );

  test("processing exposes the same study actions as pending", () => {
    renderMainView({
      role: "2",
      status: "processing",
      complete: true,
      review: false,
      aiStudiesUserId: 42,
    });

    expectPendingActions({ ai: true, manual: true, reject: true });
  });

  test.each(["admin", "1"])(
    "role %s can mark a pending comparison as processing",
    (role) => {
      renderMainView({
        role,
        status: "pending",
        complete: false,
        review: false,
      });

      expect(
        screen.getByRole("button", { name: "Marcar como Procesando" }),
      ).toBeInTheDocument();
    },
  );

  test("marks a pending comparison as processing from MainView", async () => {
    const onUpdate = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });
    vi.stubGlobal("fetch", fetchMock);

    try {
      renderMainView({
        role: "admin",
        status: "pending",
        complete: false,
        review: false,
        onUpdate,
      });

      fireEvent.click(
        screen.getByRole("button", { name: "Marcar como Procesando" }),
      );

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(
          "/api/v2/comparisons/comparison-1/status",
          expect.objectContaining({
            method: "PATCH",
            body: JSON.stringify({ status: "processing" }),
          }),
        );
        expect(onUpdate).toHaveBeenCalledTimes(1);
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  test("commercial users cannot mark a pending comparison as processing", () => {
    renderMainView({
      role: "2",
      status: "pending",
      complete: true,
      review: false,
    });

    expect(
      screen.queryByRole("button", { name: "Marcar como Procesando" }),
    ).not.toBeInTheDocument();
  });

  test("explicit complete denial leaves only the processing action for backoffice", () => {
    renderMainView({
      role: "1",
      status: "pending",
      complete: false,
      review: true,
    });

    expectPendingActions({ ai: false, manual: false, reject: false });
    expect(
      screen.getByRole("button", { name: "Marcar como Procesando" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("No hay acciones disponibles"),
    ).not.toBeInTheDocument();
  });

  test("manual modal independently enforces its explicit complete permission", () => {
    render(
      <CompletarEstudioModal
        comparativa={baseComparativa as never}
        onUpdate={() => {}}
        userData={
          {
            role: "admin",
            organization: { id: "organization-1" },
          } as never
        }
        canCompleteStudies={false}
      />,
    );

    expectPendingActions({ ai: false, manual: false, reject: false });
  });

  test("Dirección keeps pending actions when its permission map contains false", () => {
    renderMainView({
      role: "admin",
      status: "pending",
      complete: false,
      review: false,
    });

    expectPendingActions({ ai: true, manual: true, reject: true });
  });

  test("review permission opens an in-flight AI study after capability removal", () => {
    renderMainView({
      role: "2",
      status: "awaiting_review",
      complete: false,
      review: true,
      aiStudiesUserId: null,
    });

    expect(screen.getByText("Estudio con IA recibido")).toBeInTheDocument();
    const reviewButton = screen.getByRole("button", {
      name: "Asignar Comercializadora y Comisiones",
    });
    fireEvent.click(reviewButton);

    expect(
      screen.getByRole("heading", {
        name: "Revisión de estudio · ACME",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "El estudio con IA se ha recibido correctamente. Asigna la comercializadora ganadora y las comisiones para completar la comparativa.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(
        "Selecciona la comercializadora que ganó la comparativa",
      ),
    ).toHaveAttribute("id", "supplier-select-ai-review");
    expect(screen.queryByText("Estudio en revisión")).not.toBeInTheDocument();
  });

  test("labels the received comparator data as an AI study", () => {
    renderMainView({
      role: "2",
      status: "rejected",
      complete: false,
      review: false,
      aiStudyData: {},
    });

    expect(screen.getByText("Datos del estudio con IA")).toBeVisible();
    expect(screen.queryByText("Estudio Negoco Cloud IA")).not.toBeInTheDocument();
  });

  test("review denial keeps the waiting state regardless of complete permission", () => {
    renderMainView({
      role: "1",
      status: "awaiting_review",
      complete: true,
      review: false,
    });

    expect(screen.getByText("Estudio en revisión")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: "Asignar Comercializadora y Comisiones",
      }),
    ).not.toBeInTheDocument();
  });

  test.each([
    { role: "admin", label: "Dirección" },
    { role: "1", label: "Backoffice" },
  ])("$label sees only the status update action when rejected", ({ role }) => {
    renderMainView({
      role,
      status: "rejected",
      complete: false,
      review: false,
    });

    expect(screen.getByText("Actualizar Estado")).toBeInTheDocument();
    expect(
      screen.queryByText("No hay acciones disponibles"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Comparativa rechazada")).not.toBeInTheDocument();
  });

  test("commercial sees only the no-actions fallback when rejected", () => {
    renderMainView({
      role: "2",
      status: "rejected",
      complete: false,
      review: false,
    });

    expect(screen.queryByText("Actualizar Estado")).not.toBeInTheDocument();
    expect(screen.getByText("No hay acciones disponibles")).toBeInTheDocument();
    expect(screen.getByText("Comparativa rechazada")).toBeInTheDocument();
  });
});

describe("MainView commercial summary permissions", () => {
  test.each([
    { role: "admin", status: "pending", isSubcomercial: false },
    { role: "1", status: "awaiting_review", isSubcomercial: false },
    { role: "2", status: "completed", isSubcomercial: false },
    { role: "2", status: "pending", isSubcomercial: true },
    { role: "3", status: "rejected", isSubcomercial: false },
  ] as const)(
    "shows readable plans to role $role while status is $status",
    ({ role, status, isSubcomercial }) => {
      renderMainView({
        role,
        status,
        complete: false,
        review: false,
        isSubcomercial,
      });

      const plans = screen.getByRole("region", {
        name: "Planes de la comparativa",
      });
      expect(within(plans).getByText("Fijo")).toBeVisible();
    },
  );

  test.each([
    { role: "admin", status: "completed", canEdit: true },
    { role: "1", status: "completed", canEdit: true },
    { role: "2", status: "completed", canEdit: false },
    { role: "3", status: "completed", canEdit: false },
    { role: "Admin", status: "completed", canEdit: false },
    { role: "admin", status: "pending", canEdit: false },
    { role: "1", status: "awaiting_review", canEdit: false },
  ] as const)(
    "role $role with status $status has plan and commission editing=$canEdit",
    ({ role, status, canEdit }) => {
      renderMainView({
        role,
        status,
        complete: false,
        review: false,
      });

      const planEditButton = screen.queryByRole("button", {
        name: "Editar planes",
      });
      const commissionEditButton = screen.queryByRole("button", {
        name: "Editar",
      });

      if (canEdit) {
        expect(planEditButton).toBeVisible();
        expect(commissionEditButton).toBeVisible();
      } else {
        expect(planEditButton).not.toBeInTheDocument();
        expect(commissionEditButton).not.toBeInTheDocument();
      }
    },
  );

  test("commission fields follow the refreshed comparison plan", () => {
    const userData = {
      id: "viewer-1",
      role: "admin",
      permissions: {},
      organization: {
        id: "organization-1",
        name: "Negoco",
        abarca_user_id: null,
      },
    };
    const mainViewProps = {
      userData: userData as never,
      onUpdate: vi.fn(),
      isSubcomercial: false,
      isEditable: true,
      isComercialEditable: false,
      isProcessed: false,
    };
    const { rerender } = render(
      <MainView
        {...mainViewProps}
        comparativa={{
          ...baseComparativa,
          status: "completed",
          plan: ["fijo"],
        } as never}
      />,
    );

    expect(
      within(screen.getByText("Negoco").parentElement as HTMLElement).getByText(
        "Fijo:",
      ),
    ).toBeVisible();

    rerender(
      <MainView
        {...mainViewProps}
        comparativa={{
          ...baseComparativa,
          status: "completed",
          plan: ["indexado"],
        } as never}
      />,
    );

    const organizationCommissions = within(
      screen.getByText("Negoco").parentElement as HTMLElement,
    );
    expect(organizationCommissions.getByText("Indexado:")).toBeVisible();
    expect(organizationCommissions.queryByText("Fijo:")).not.toBeInTheDocument();
  });
});

describe("CompletarEstudioModal AI review guards", () => {
  function renderAiReviewModal({
    status,
    canReviewStudies,
  }: {
    status: "pending" | "awaiting_review";
    canReviewStudies: boolean;
  }) {
    render(
      <CompletarEstudioModal
        comparativa={{ ...baseComparativa, status } as never}
        onUpdate={() => {}}
        userData={
          {
            role: "2",
            organization: { id: "organization-1" },
          } as never
        }
        mode="ai_review"
        canCompleteStudies={false}
        canReviewStudies={canReviewStudies}
      />,
    );
  }

  test("returns null for awaiting review without review permission", () => {
    renderAiReviewModal({
      status: "awaiting_review",
      canReviewStudies: false,
    });

    expect(
      screen.queryByRole("button", {
        name: "Asignar Comercializadora y Comisiones",
      }),
    ).not.toBeInTheDocument();
  });

  test("renders the review CTA for awaiting review with permission", () => {
    renderAiReviewModal({
      status: "awaiting_review",
      canReviewStudies: true,
    });

    expect(
      screen.getByRole("button", {
        name: "Asignar Comercializadora y Comisiones",
      }),
    ).toBeInTheDocument();
  });

  test("returns null for an incompatible status despite review permission", () => {
    renderAiReviewModal({
      status: "pending",
      canReviewStudies: true,
    });

    expect(
      screen.queryByRole("button", {
        name: "Asignar Comercializadora y Comisiones",
      }),
    ).not.toBeInTheDocument();
  });
});
