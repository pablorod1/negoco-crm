import AvatarComponent from "@/components/core/AvatarComponent";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { formatDateTime } from "@/lib/core/format";
import { FotovoltaicaVM } from "@/lib/core/types";
import { Separator } from "@/components/ui/separator";
import { UserIcon } from "lucide-react";
import { Label } from "@radix-ui/react-label";

interface Props {
  fotovoltaica: FotovoltaicaVM;
}
export default function FotovoltaicaSalesPersonDetailsTab({
  fotovoltaica,
}: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserIcon className="h-5 w-5" />
          Usuario Asignado
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <AvatarComponent userData={fotovoltaica.user} />
          <div>
            <p className="font-semibold">{fotovoltaica.user.name}</p>
            <p className="text-sm text-muted-foreground">
              {fotovoltaica.user.email}
            </p>
          </div>
        </div>
        {fotovoltaica.updated_by && fotovoltaica.updated_at ? (
          <>
            <Separator />
            <div>
              <Label className="text-sm font-medium text-muted-foreground">
                Última actualización - {formatDateTime(fotovoltaica.updated_at)}
              </Label>
              <div className="flex items-center gap-3 mt-2">
                <AvatarComponent userData={fotovoltaica.updated_by} />
                <div>
                  <p className="font-medium">{fotovoltaica.updated_by.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {fotovoltaica.updated_by.email}
                  </p>
                </div>
              </div>
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
