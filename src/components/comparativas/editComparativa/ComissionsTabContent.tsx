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
  const isComercial = userData.role === "2";

  const getComissionText = (comission: number) => {
    if (comission === 0 && comparativa.status !== "pending")
      return "No hay ahorro";
    return formatComission(comission);
  };
  return (
    <div
      className={`grid ${
        isComercial ? "grid-cols-1" : "grid-cols-2"
      } justify-center gap-6`}
    >
      {!isComercial && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-primary-800">
              Comisión {userData.organization.name}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {comparativa.plan.includes("fijo") && (
                <div className="flex justify-between">
                  <span className="text-primary-800">Precio Fijo:</span>
                  <span className="font-semibold text-primary-900">
                    {getComissionText(comparativa.comision.fijo)}
                  </span>
                </div>
              )}
              {comparativa.plan.includes("indexado") && (
                <div className="flex justify-between">
                  <span className="text-primary-800">Precio Indexado:</span>
                  <span className="font-semibold text-primary-900">
                    {getComissionText(comparativa.comision.indexado)}
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg text-primary-800">
            Comisión {comparativa.user.name}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {comparativa.plan.includes("fijo") && (
              <div className="flex justify-between">
                <span className="text-primary-800">Precio Fijo:</span>
                <span className="font-semibold text-primary-900">
                  {getComissionText(comparativa.comision_sales_person.fijo)}
                </span>
              </div>
            )}
            {comparativa.plan.includes("indexado") && (
              <div className="flex justify-between">
                <span className="text-primary-800">Precio Indexado:</span>
                <span className="font-semibold text-primary-900">
                  {getComissionText(comparativa.comision_sales_person.indexado)}
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
