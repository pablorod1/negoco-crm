"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BadgeCheck,
  Check,
  Crown,
  Rocket,
  User,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { useUser } from "@/lib/contexts/UserContext";
import { InputComponent } from "../tramites/createTramite/InputComponent";
import { showCustomToast } from "./CustomToast";
import LoadingStateModal from "./LoadingStateModal";

const subscriptionPlans = [
  {
    id: "starter",
    name: "Starter",
    price: "95€",
    period: "/mes",
    icon: User,
    color: "bg-blue-500",
    features: [
      "Acceso a trámites y liquidaciones",
      "Acceso a documentación",
      "Acceso a colaboradores",
      "Notificaciones por email",
      "Soporte por email",
      "2 usuarios",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: "195€",
    period: "/mes",
    icon: BadgeCheck,
    color: "bg-purple-500",
    popular: true,
    features: [
      "Todo en Starter",
      "Acceso a comparativas",
      "Integración para jefes de equipo",
      "Soporte por email y Whatsapp",
      "10 usuarios",
    ],
  },
  {
    id: "elite",
    name: "Élite",
    price: "295€",
    period: "/mes",
    icon: Crown,
    color: "bg-gold-500",
    features: [
      "Todo en Pro",
      "Logo de la empresa",
      "Colores coorporativos",
      "Notificaciones por email personalizadas",
      "Soporte prioritario",
      "Usuarios ilimitados",
    ],
  },
];

export default function UpgradePlanDialog() {
  const { getPlan, userData } = useUser();
  const [open, setOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(getPlan());
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    company: "",
  });
  const [loading, setLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const onOpen = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!userData) return;
    e.preventDefault();
    e.stopPropagation();
    setOpen(true);
    // Reset form data when opening the dialog
    setFormData({
      name: userData.name,
      email: userData.email,
      company: userData.organization.name,
    });
  };
  const onClose = () => setOpen(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setFormData((prev) => ({ ...prev, [id]: value }));
  };

  const checkPlanChanged = () => {
    if (selectedPlan === getPlan()) {
      showCustomToast({
        title: "Plan no cambiado",
        message: "Ya estás suscrito a este plan.",
        icon: Rocket,
        iconSize: 24,
        iconColor: "var(--warning-color)",
      });
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    setLoading(true);
    if (!checkPlanChanged()) {
      setLoading(false);
      setIsSubmitted(true);
      setIsSuccess(false);
      return;
    }
    try {
      const response = await fetch(`/api/send-email/upgrade-plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: {
            old: getPlan(),
            new: selectedPlan,
          },
          user: {
            name: formData.name,
            email: formData.email,
            company: formData.company,
          },
        }),
      });

      const { success, error } = await response.json();

      if (!success) {
        showCustomToast({
          title: "Error al enviar la solicitud",
          message: error || "Por favor, inténtalo de nuevo más tarde.",
          icon: Rocket,
          iconSize: 24,
          iconColor: "var(--danger-color)",
        });
        setLoading(false);
        return;
      }

      setIsSubmitted(true);
      setIsSuccess(true);
    } catch (error) {
      console.error("Error al enviar la solicitud de mejora de plan:", error);
      setLoading(false);
      showCustomToast({
        title: "Error al enviar la solicitud",
        message: "Por favor, inténtalo de nuevo más tarde.",
        icon: Rocket,
        iconSize: 24,
        iconColor: "var(--danger-color)",
      });
    } finally {
      setLoading(false);
    }
  };

  const selectedPlanDetails = subscriptionPlans.find(
    (plan) => plan.id === selectedPlan
  );

  return (
    <Dialog open={open}>
      <DialogTrigger asChild>
        <Button
          size="lg"
          onClick={onOpen}
          className="inline-flex items-center rounded-full bg-primary/10 px-4 py-2 text-xs font-medium text-primary hover:bg-primary/20 transition-colors shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none"
        >
          <Rocket className="w-4 h-4 mr-1" />
          <span>Mejora tu suscripción</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        {loading && (
          <LoadingStateModal
            title="Cargando..."
            description="Por favor, espera mientras se procesa tu solicitud."
          />
        )}
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-center text-primary-800">
            Mejora tu Plan de CRM
          </DialogTitle>
          <DialogDescription className="text-center text-gray-600">
            Elige el plan perfecto para hacer crecer tu negocio y gestionar
            mejor tus clientes
          </DialogDescription>
        </DialogHeader>

        {!isSubmitted ? (
          <div className="space-y-6 py-4">
            {/* Selector de Plan */}
            <div className="space-y-3">
              <Label htmlFor="plan" className="text-base font-semibold">
                Selecciona tu plan
              </Label>
              <Select
                value={selectedPlan as string}
                onValueChange={setSelectedPlan}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Elige un plan de suscripción" />
                </SelectTrigger>
                <SelectContent>
                  {subscriptionPlans.map((plan) => (
                    <SelectItem key={plan.id} value={plan.id}>
                      <div className="flex items-center gap-2">
                        <plan.icon className="h-4 w-4" />
                        <span>{plan.name}</span>
                        <span className="font-semibold">
                          {plan.price}
                          {plan.period}
                        </span>
                        {plan.popular && (
                          <Badge variant="pending" className="ml-2">
                            Popular
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Detalles del Plan Seleccionado */}
            {selectedPlanDetails && (
              <Card className="border-2 border-blue-200 bg-blue-50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className={`p-2 rounded-full ${selectedPlanDetails.color} text-white`}
                    >
                      <selectedPlanDetails.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">
                        {selectedPlanDetails.name}
                      </h3>
                      <p className="text-2xl font-bold text-blue-600">
                        {selectedPlanDetails.price}
                        <span className="text-sm font-normal text-gray-600">
                          {selectedPlanDetails.period}
                        </span>
                      </p>
                    </div>
                    {selectedPlanDetails.popular && (
                      <Badge variant={"pending"} className="ml-auto ">
                        Más Popular
                      </Badge>
                    )}
                  </div>
                  <div className="space-y-2">
                    {selectedPlanDetails.features.map((feature, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-600" />
                        <span className="text-sm">{feature}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Formulario de Datos */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <InputComponent
                  name="name"
                  type="text"
                  label="Nombre completo *"
                  placeholder="Tu nombre completo"
                  value={formData.name || ""}
                  onChange={handleInputChange}
                />
              </div>
              <div className="space-y-2">
                <InputComponent
                  name="email"
                  type="email"
                  label="Correo electrónico *"
                  placeholder="Tu correo electrónico"
                  value={formData.email || ""}
                  onChange={handleInputChange}
                />
              </div>
              <div className="space-y-2">
                <InputComponent
                  name="company"
                  type="text"
                  label="Empresa *"
                  placeholder="Nombre de tu empresa"
                  value={formData.company || ""}
                  onChange={handleInputChange}
                />
              </div>
            </div>

            {/* Información adicional */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">
                <strong>Nota:</strong> Se notificará al equipo de dirección
                sobre la mejora de tu plan. Asegúrate de que la información
                proporcionada sea correcta y completa. Una vez que se procese tu
                solicitud, se actualizará tu plan y recibirás un correo
                electrónico de confirmación.
              </p>
            </div>
          </div>
        ) : isSubmitted && !isSuccess ? (
          <div className="text-center space-y-6 py-8">
            <div className="flex justify-center">
              <div className="rounded-full bg-amber-100 p-4">
                <AlertCircle className="h-12 w-12 text-amber-600" />
              </div>
            </div>
            <div className="space-y-3">
              <h2 className="text-2xl font-bold text-gray-900">
                Plan No Cambiado
              </h2>
              <p className="text-gray-600 max-w-md mx-auto leading-relaxed">
                Has seleccionado el mismo plan al que ya estás suscrito. Para
                mejorar tu suscripción, por favor selecciona un plan diferente.
              </p>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mx-4">
              <p className="text-sm text-amber-800">
                <strong>Sugerencia:</strong> Revisa los planes disponibles y
                selecciona uno con más funcionalidades para continuar con la
                mejora.
              </p>
            </div>
            <Button
              onClick={() => {
                setIsSubmitted(false);
                setIsSuccess(false);
              }}
              className="bg-amber-600 hover:bg-amber-700 px-8 py-2"
              size="lg"
            >
              Seleccionar Otro Plan
            </Button>
          </div>
        ) : (
          isSuccess && (
            <div className="text-center space-y-6 py-8">
              <div className="flex justify-center">
                <div className="rounded-full bg-success-100 p-4">
                  <CheckCircle className="h-12 w-12 text-success-600" />
                </div>
              </div>
              <div className="space-y-3">
                <h2 className="text-2xl font-bold text-success-800">
                  Solicitud Recibida
                </h2>
                <p className="text-gray-600 max-w-md mx-auto leading-relaxed">
                  Estamos procesando tu solicitud de mejora de plan.
                  Contactaremos contigo lo antes posible para confirmar los
                  detalles y activar tu nueva suscripción.
                </p>
              </div>
              <div className="bg-success-50 border border-success-200 rounded-lg p-4 mx-4">
                <p className="text-sm text-success-800">
                  <strong>Próximos pasos:</strong> Recibirás un correo de
                  confirmación y nuestro equipo se pondrá en contacto contigo en
                  las próximas 24-48 horas.
                </p>
              </div>
              <Button onClick={onClose} size="lg">
                Entendido
              </Button>
            </div>
          )
        )}

        {!isSubmitted && (
          <DialogFooter className="flex gap-2">
            <Button variant="destructive" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={
                !selectedPlan ||
                !formData.name ||
                !formData.email ||
                !formData.company
              }
            >
              Confirmar Mejora
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
