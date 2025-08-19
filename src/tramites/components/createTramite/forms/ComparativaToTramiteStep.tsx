import FormWrapper from "../FormWrapper";
import { SelectComponent } from "../InputComponent";
import { User } from "@/core/types";
import ButtonGroupComponent from "@/core/components/ButtonGroupComponent";
import { ScrollArea } from "@/core/components/ui/scroll-area";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/core/components/ui/card";
import { getStatusBadge } from "@/core/hooks/use-status-badge";
import {
  formatComission,
  formatFileSize,
  formatUUID,
} from "@/core/utils/format";
import { ComparativaVM, ComparativaStatus } from "@/comparativas/types";

interface Props {
  comparativa: ComparativaVM;
  onSubmit: () => void;
  onCancel: () => void;
  plan: "fijo" | "indexado" | undefined;
  setPlan: React.Dispatch<
    React.SetStateAction<"fijo" | "indexado" | undefined>
  >;
  userData: User;
}

export default function ComparativaToTramiteStep({
  comparativa,
  onSubmit,
  onCancel,
  setPlan,
  plan,
  userData,
}: Props) {
  const isComercial = userData.role === "2";
  const handleChange = (value: string) => {
    setPlan(value as "fijo" | "indexado");
  };

  const checkFijoEmpty = () => {
    return (
      comparativa.comision.fijo === 0 &&
      comparativa.comision_sales_person.fijo === 0
    );
  };

  const checkIndexadoEmpty = () => {
    return (
      comparativa.comision.indexado === 0 &&
      comparativa.comision_sales_person.indexado === 0
    );
  };

  const handleSubmit = () => {
    onSubmit();
  };
  return (
    <FormWrapper>
      <div>
        <div className="flex items-center justify-between w-full">
          <h2 className="text-xl font-semibold text-primary-800">
            Comparativa {formatUUID(comparativa.id)} • {comparativa.client}
          </h2>
        </div>
      </div>
      <div className="space-y-4">
        <div className="flex justify-center items-center max-w-44 w-full px-4">
          <SelectComponent
            name="plan"
            isRequired
            label="Plan"
            selectedKey={plan as string}
            onChange={handleChange}
            items={
              checkFijoEmpty()
                ? ["indexado"]
                : checkIndexadoEmpty()
                  ? ["fijo"]
                  : ["fijo", "indexado"]
            }
          />
        </div>
        <ScrollArea className="h-full w-full  max-h-[calc(100vh-500px)]">
          <div className="space-y-6 pb-6 px-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-primary-800 text-lg">
                    Información de la comparativa - #
                    {formatUUID(comparativa.id)}
                  </CardTitle>
                  {getStatusBadge(
                    comparativa.status as ComparativaStatus,
                    "comparativa"
                  )}
                </div>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium">Comercial</p>
                  <p className="text-sm text-muted-foreground">
                    {comparativa.user.name}
                  </p>
                </div>
                {!isComercial && (
                  <div>
                    <p className="text-sm font-medium">Comision</p>
                    <p className="text-sm text-muted-foreground">
                      {plan && comparativa.comision[plan] > 0
                        ? formatComission(comparativa.comision[plan])
                        : "---"}
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium">Servicio</p>
                  <p className="text-sm text-muted-foreground">
                    {comparativa.service}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium">
                    Comision {!isComercial ? "Comercial" : ""}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {plan && comparativa.comision_sales_person[plan] > 0
                      ? formatComission(comparativa.comision_sales_person[plan])
                      : "---"}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-primary-800 text-lg">
                  Documents ({comparativa.files.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {comparativa.files.map((doc, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-2 border rounded-lg"
                    >
                      <span className="text-sm">{doc.filename}</span>
                      <span className="text-sm text-muted-foreground">
                        {formatFileSize(Number(doc.size))}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            {comparativa.notes.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg text-primary-800">
                    Notas ({comparativa.notes.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {comparativa.notes.map((note, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-2 border rounded-lg"
                      >
                        <span className="text-sm">{note}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </ScrollArea>
      </div>
      <ButtonGroupComponent onSubmit={handleSubmit} onCancel={onCancel} />
    </FormWrapper>
  );
}
