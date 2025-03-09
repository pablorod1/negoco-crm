import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatComission } from "@/lib/core/format";
import { ComparativaVM, User } from "@/lib/core/types";

interface CommissionsTabContentProps {
  comparativa: ComparativaVM;
  userData: User;
}

export const CommissionsTabContent = ({
  comparativa,
  userData,
}: CommissionsTabContentProps) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg text-[var(--primary-color-800)]">
            Comisión {userData.organization.name}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {comparativa.plan.includes("fijo") && (
              <div className="flex justify-between">
                <span className="text-[var(--primary-color-800)]">
                  Precio Fijo:
                </span>
                <span className="font-semibold text-[var(--primary-color-950)]">
                  {formatComission(comparativa.comision.fijo)}
                </span>
              </div>
            )}
            {comparativa.plan.includes("indexado") && (
              <div className="flex justify-between">
                <span className="text-[var(--primary-color-800)]">
                  Precio Indexado:
                </span>
                <span className="font-semibold text-[var(--primary-color-950)]">
                  {formatComission(comparativa.comision.indexado)}
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg text-[var(--primary-color-800)]">
            Comisión {comparativa.user.name}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {comparativa.plan.includes("fijo") && (
              <div className="flex justify-between">
                <span className="text-[var(--primary-color-800)]">
                  Precio Fijo:
                </span>
                <span className="font-semibold text-[var(--primary-color-950)]">
                  {formatComission(comparativa.comision_sales_person.fijo)}
                </span>
              </div>
            )}
            {comparativa.plan.includes("indexado") && (
              <div className="flex justify-between">
                <span className="text-[var(--primary-color-800)]">
                  Precio Indexado:
                </span>
                <span className="font-semibold text-[var(--primary-color-950)]">
                  {formatComission(comparativa.comision_sales_person.indexado)}
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
