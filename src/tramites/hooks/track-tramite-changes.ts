/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  ClientDB,
  ContractDB,
  EditTramiteFormData,
  SignerDB,
  TramiteDB,
} from "@/tramites/types";

export interface UpdatedFields {
  tramite?: Partial<TramiteDB>;
  client?: Partial<ClientDB>;
  signer?: Partial<SignerDB>;
  contracts?: Partial<ContractDB>[];
}

function trackChanges(
  original: EditTramiteFormData,
  updated: EditTramiteFormData
): UpdatedFields {
  const changes: UpdatedFields = {};

  // Track tramite changes
  const tramiteChanges = Object.entries(updated.tramite).reduce(
    (acc, [key, value]) => {
      if (value !== original.tramite[key as keyof TramiteDB]) {
        acc[key as keyof TramiteDB] = value as any;
      }
      return acc;
    },
    {} as Partial<TramiteDB>
  );

  if (Object.keys(tramiteChanges).length) changes.tramite = tramiteChanges;

  // Track client changes
  const clientChanges = Object.entries(updated.client).reduce(
    (acc, [key, value]) => {
      if (key === "coordinates") return acc; // ignore coordinates
      if (
        value !== original.client[key as keyof Omit<ClientDB, "coordinates">]
      ) {
        acc[key as keyof Omit<ClientDB, "coordinates">] = value as string;
      }
      return acc;
    },
    {} as Partial<ClientDB>
  );

  if (Object.keys(clientChanges).length) changes.client = clientChanges;

  // Track signer changes if exists
  if (updated.signer) {
    const signerChanges = Object.entries(updated.signer).reduce(
      (acc, [key, value]) => {
        if (value !== original.signer?.[key as keyof SignerDB]) {
          acc[key as keyof SignerDB] = value as any;
        }
        return acc;
      },
      {} as Partial<SignerDB>
    );

    if (Object.keys(signerChanges).length) changes.signer = signerChanges;
  }

  // Track contract changes
  const contractChanges = updated.contracts
    .map((contract, index) => {
      const originalContract = original.contracts[index];
      return Object.entries(contract).reduce((acc, [key, value]) => {
        if (value !== originalContract[key as keyof ContractDB]) {
          acc[key as keyof ContractDB] = value as any;
        }
        return acc;
      }, {} as Partial<ContractDB>);
    })
    .filter((changes) => Object.keys(changes).length > 0);

  if (contractChanges.length) changes.contracts = contractChanges;

  return changes;
}
