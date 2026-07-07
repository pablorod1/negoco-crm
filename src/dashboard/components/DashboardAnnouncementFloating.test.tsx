import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import DashboardAnnouncementFloating from "./DashboardAnnouncementFloating";

const mocks = vi.hoisted(() => ({
  userData: { id: "admin1", role: "admin", name: "Admin" },
}));

vi.mock("@/core/contexts/UserContext", () => ({
  useUser: () => ({ userData: mocks.userData }),
}));

vi.mock("@/dashboard-announcements/components/DashboardAnnouncementConfigPanel", () => ({
  default: () => <div data-testid="dashboard-announcement-config" />,
}));

const activeAnnouncement = {
  id: "ann1",
  title: "Aviso diario",
  message: "Revisar operaciones pendientes",
  variant: "warning",
  cta_label: null,
  cta_url: null,
  is_active: true,
  created_by: "admin1",
  created_at: "2026-06-16T08:00:00.000Z",
  updated_at: "2026-06-16T08:00:00.000Z",
  deactivated_at: null,
};

const mockActiveFetch = () =>
  vi.fn().mockResolvedValue({
    json: async () => ({ success: true, data: activeAnnouncement }),
  });

beforeEach(() => {
  vi.stubGlobal("fetch", mockActiveFetch());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("DashboardAnnouncementFloating", () => {
  test("collapses to an icon badge", async () => {
    render(<DashboardAnnouncementFloating />);

    expect(await screen.findByText("Aviso diario")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Colapsar cartel"));

    expect(screen.queryByText("Aviso diario")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Mostrar cartel")).toBeInTheDocument();
  });

  test("shows edit button for management users", async () => {
    render(<DashboardAnnouncementFloating />);

    expect(await screen.findByText("Aviso diario")).toBeInTheDocument();
    expect(screen.getByLabelText("Editar cartel")).toBeInTheDocument();
  });

  test("does not persist collapse across remounts", async () => {
    const firstRender = render(<DashboardAnnouncementFloating />);
    expect(await screen.findByText("Aviso diario")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Colapsar cartel"));
    expect(screen.queryByText("Aviso diario")).not.toBeInTheDocument();

    firstRender.unmount();
    render(<DashboardAnnouncementFloating />);

    expect(await screen.findByText("Aviso diario")).toBeInTheDocument();
  });

  test("hides edit button for non-management users", async () => {
    mocks.userData = { id: "user1", role: "2", name: "Comercial" };

    render(<DashboardAnnouncementFloating />);

    expect(await screen.findByText("Aviso diario")).toBeInTheDocument();
    expect(screen.queryByLabelText("Editar cartel")).not.toBeInTheDocument();
  });
});
