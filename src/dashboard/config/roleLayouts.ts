import { User } from "@/core/types";

export type DashboardComponent =
  | "YearlyTramitesBarChart"
  | "PersonalTramitesChart"
  | "TeamTramitesBarChart"
  | "ComparativasRatio"
  | "ComparativasResume"
  | "RenewableTramitesCalendar"
  | "ObjetivosCard";

export type HeroMetric =
  | "clients"
  | "activeTramites"
  | "comparativas"
  | "totalConsumption"
  | "totalBalance";

export interface LayoutSection {
  components: DashboardComponent[];
  layout: string;
  focus: string;
}

export interface RoleLayoutConfig {
  hero: {
    metrics: HeroMetric[];
    priority: string;
  };
  primary: LayoutSection;
  secondary: LayoutSection;
  tertiary?: LayoutSection;
}

export const AdminLayoutConfig: RoleLayoutConfig = {
  hero: {
    metrics: [
      "totalBalance",
      "clients",
      "activeTramites",
      "comparativas",
      "totalConsumption",
    ],
    priority: "strategic-overview",
  },
  primary: {
    components: ["YearlyTramitesBarChart", "TeamTramitesBarChart"],
    layout: "lg:grid-cols-2 gap-4",
    focus: "company-performance",
  },
  secondary: {
    components: ["ComparativasRatio", "ObjetivosCard", "PersonalTramitesChart"],
    layout: "lg:grid-cols-3 gap-4",
    focus: "management-tools",
  },
  tertiary: {
    components: ["ComparativasResume", "RenewableTramitesCalendar"],
    layout: "lg:grid-cols-2 gap-4",
    focus: "operational-details",
  },
};

export const BackofficeLayoutConfig: RoleLayoutConfig = {
  hero: {
    metrics: ["activeTramites", "comparativas", "clients", "totalConsumption"],
    priority: "operational-efficiency",
  },
  primary: {
    components: ["ComparativasRatio", "RenewableTramitesCalendar"],
    layout: "lg:grid-cols-2 gap-4",
    focus: "daily-operations",
  },
  secondary: {
    components: ["ComparativasResume", "PersonalTramitesChart"],
    layout: "lg:grid-cols-2 gap-4",
    focus: "work-management",
  },
};

export const ComercialLayoutConfig: RoleLayoutConfig = {
  hero: {
    metrics: ["totalBalance", "activeTramites", "clients", "comparativas"],
    priority: "sales-performance",
  },
  primary: {
    components: ["PersonalTramitesChart", "ObjetivosCard"],
    layout: "lg:grid-cols-2 gap-4",
    focus: "personal-performance",
  },
  secondary: {
    components: ["ComparativasRatio", "RenewableTramitesCalendar"],
    layout: "lg:grid-cols-2 gap-4",
    focus: "opportunity-management",
  },
};

export const ComercialWithTeamLayoutConfig: RoleLayoutConfig = {
  hero: {
    metrics: ["totalBalance", "activeTramites", "clients", "comparativas"],
    priority: "sales-performance",
  },
  primary: {
    components: ["PersonalTramitesChart", "ObjetivosCard"],
    layout: "lg:grid-cols-2 gap-4",
    focus: "personal-performance",
  },
  secondary: {
    components: ["TeamTramitesBarChart", "ComparativasRatio"],
    layout: "lg:grid-cols-2 gap-4",
    focus: "team-management",
  },
  tertiary: {
    components: ["ComparativasResume", "RenewableTramitesCalendar"],
    layout: "lg:grid-cols-2 gap-4",
    focus: "advanced-tools",
  },
};

export const SubcomercialLayoutConfig: RoleLayoutConfig = {
  hero: {
    metrics: ["totalBalance", "activeTramites", "clients", "totalConsumption"],
    priority: "individual-performance",
  },
  primary: {
    components: ["PersonalTramitesChart", "ObjetivosCard"],
    layout: "lg:grid-cols-2 gap-4",
    focus: "personal-goals",
  },
  secondary: {
    components: ["ComparativasRatio", "RenewableTramitesCalendar"],
    layout: "lg:grid-cols-2 gap-4",
    focus: "opportunity-planning",
  },
};

export const getRoleLayoutConfig = (
  userData: User,
  hasSubComerciales: boolean = false
): RoleLayoutConfig => {
  const isSubcomercial = userData.role === "2" && userData.super_id !== null;

  switch (true) {
    case userData.role === "admin":
      return AdminLayoutConfig;
    case userData.role === "1":
      return BackofficeLayoutConfig;
    case userData.role === "2" && !isSubcomercial && hasSubComerciales:
      return ComercialWithTeamLayoutConfig;
    case userData.role === "2" && !isSubcomercial:
      return ComercialLayoutConfig;
    case isSubcomercial:
      return SubcomercialLayoutConfig;
    default:
      return ComercialLayoutConfig;
  }
};
