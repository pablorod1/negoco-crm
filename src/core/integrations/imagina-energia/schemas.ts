import { z } from "zod";

export const ImaginaAsyncAcceptedSchema = z
  .object({
    message: z.string().optional(),
    request_id: z.union([z.string(), z.number()]),
    referencia_externa: z.string().optional().nullable(),
  })
  .passthrough();

export const ImaginaTarifaSchema = z
  .object({
    id_tarifa_precios: z.number(),
    alias_externo: z.string().nullable().optional(),
    nombre: z.string().nullable().optional(),
    descripcion: z.string().nullable().optional(),
    codigo_atr: z.string().nullable().optional(),
    tipo_tarifa_precio: z.enum(["indexado", "fijo"]).nullable().optional(),
    precio_potencia_boe: z.enum(["S", "N"]).nullable().optional(),
    precio_excedentes: z.string().nullable().optional(),
  })
  .catchall(z.unknown());

export const ImaginaTarifasResponseSchema = z
  .object({
    content: z.array(ImaginaTarifaSchema),
    request_id: z.union([z.string(), z.number()]),
  })
  .passthrough();

export const ImaginaContractInfoSchema = z
  .object({
    id: z.union([z.string(), z.number()]),
    codigo: z.string().nullable().optional(),
    alias_externo: z.string().nullable().optional(),
    estado: z
      .object({
        id: z.number().nullable().optional(),
        estado: z.string().nullable().optional(),
        descripcion: z.string().nullable().optional(),
      })
      .passthrough()
      .nullable()
      .optional(),
    subestado: z
      .object({
        id: z.number().nullable().optional(),
        id_estado: z.number().nullable().optional(),
        subestado: z.string().nullable().optional(),
        descripcion: z.string().nullable().optional(),
      })
      .passthrough()
      .nullable()
      .optional(),
  })
  .catchall(z.unknown());

export const ImaginaContractListResponseSchema = z
  .object({
    request_id: z.union([z.string(), z.number()]),
    pagina: z.number(),
    num_contratos: z.number(),
    contratos: z.array(ImaginaContractInfoSchema),
  })
  .passthrough();

export const ImaginaContractDetailResponseSchema = z
  .object({
    request_id: z.union([z.string(), z.number()]).optional(),
    contrato: ImaginaContractInfoSchema,
  })
  .passthrough();

export const ImaginaCreditResultSchema = z
  .object({
    status_code: z.number().optional().nullable(),
    result_operation: z.string().optional().nullable(),
    result_code: z.number().optional().nullable(),
    raw: z.unknown().optional(),
  })
  .passthrough();

export const ImaginaContratoResultSchema = z
  .object({
    result_operation: z.string().optional().nullable(),
    content: ImaginaContractInfoSchema.optional().nullable(),
  })
  .passthrough();

export const ImaginaFirmaResultSchema = z
  .object({
    result_code: z.number().optional().nullable(),
    result_operation: z.string().optional().nullable(),
    status: z.string().optional().nullable(),
    message: z.string().optional().nullable(),
    circuito_id: z.union([z.string(), z.number()]).optional().nullable(),
  })
  .passthrough();

export const ImaginaContractCallbackSchema = z
  .object({
    request_id: z.union([z.string(), z.number()]),
    referencia_externa: z.string().optional().nullable(),
    credit_result: ImaginaCreditResultSchema.optional().nullable(),
    contrato_result: ImaginaContratoResultSchema.optional().nullable(),
    firma_result: ImaginaFirmaResultSchema.optional().nullable(),
    error: z.unknown().optional(),
    _callback_signature: z.unknown().optional(),
  })
  .passthrough();

export const ImaginaScoringCallbackSchema = z
  .object({
    request_id: z.union([z.string(), z.number()]),
    referencia_externa: z.string().optional().nullable(),
    result: z
      .object({
        amount: z.number().optional().nullable(),
        codigo: z.number().optional().nullable(),
        texto: z.string().optional().nullable(),
        error: z.string().optional().nullable(),
        raw: z.unknown().optional(),
      })
      .passthrough()
      .optional(),
    error: z.unknown().optional(),
    _callback_signature: z.unknown().optional(),
  })
  .passthrough();

export const ImaginaContractChangeWebhookSchema = z
  .object({
    tabla: z.string().optional(),
    tipo_evento: z.string().optional(),
    timestamp: z.string().optional(),
    contrato: z
      .object({
        id: z.union([z.string(), z.number()]).optional(),
        codigo: z.string().optional(),
      })
      .passthrough()
      .optional(),
    cambios: z
      .array(
        z
          .object({
            campo: z.string().optional(),
            campo_tecnico: z.string().optional(),
            valor_anterior: z.unknown().optional(),
            valor_nuevo: z.unknown().optional(),
            descripcion_anterior: z.string().optional().nullable(),
            descripcion_nueva: z.string().optional().nullable(),
          })
          .passthrough(),
      )
      .optional(),
    _metadata: z
      .object({
        notification_id: z.union([z.string(), z.number()]).optional(),
        attempt_number: z.union([z.string(), z.number()]).optional(),
      })
      .passthrough()
      .optional(),
    _callback_signature: z.unknown().optional(),
  })
  .passthrough();

export const ImaginaSignatureSendSchema = z.object({
  contrato_id: z.number(),
  canal_envio: z.enum(["sms", "email", "email_otp"]),
  direcciones_firma: z.string().min(1),
  referencia_externa: z.string().optional(),
});

export const ImaginaSignatureResendSchema = z.object({
  circuito_id: z.string().min(1),
  mode: z.enum(["ds", "os", "ud"]).optional().default("ds"),
  referencia_externa: z.string().optional(),
});

export const ImaginaScoringRequestSchema = z
  .object({
    product: z.enum(["luz", "gas"]).default("luz"),
    mode: z.enum(["sips", "no_sips"]).default("sips"),
    tramite_id: z.string().optional(),
    contract_id: z.string().optional(),
    company_name: z.string().optional(),
    identificador: z.string().min(1),
    tipo_identificador: z.string().min(1),
    tipo_persona: z.string().optional(),
    autonomo: z.boolean().optional(),
    postal_code: z.string().optional(),
    town: z.string().optional(),
    address: z.string().optional(),
    province: z.string().optional(),
    cups: z.string().optional(),
    cae: z.number().optional(),
    amount: z.number().optional(),
    tarifa_json: z.unknown().optional(),
    referencia_externa: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.mode === "no_sips") {
      if (value.cups) {
        ctx.addIssue({
          code: "custom",
          path: ["cups"],
          message: "cups is not allowed for no-SIPS scoring",
        });
      }
      if (value.cae !== undefined) {
        ctx.addIssue({
          code: "custom",
          path: ["cae"],
          message: "cae is not allowed for no-SIPS scoring",
        });
      }
      if (value.amount === undefined || value.amount <= 0) {
        ctx.addIssue({
          code: "custom",
          path: ["amount"],
          message: "amount must be greater than 0 for no-SIPS scoring",
        });
      }
    }
  });

export type ImaginaTarifa = z.infer<typeof ImaginaTarifaSchema>;
export type ImaginaContractInfo = z.infer<typeof ImaginaContractInfoSchema>;
export type ImaginaContractCallback = z.infer<
  typeof ImaginaContractCallbackSchema
>;
export type ImaginaScoringCallback = z.infer<
  typeof ImaginaScoringCallbackSchema
>;
export type ImaginaContractChangeWebhook = z.infer<
  typeof ImaginaContractChangeWebhookSchema
>;
export type ImaginaScoringRequest = z.infer<typeof ImaginaScoringRequestSchema>;
