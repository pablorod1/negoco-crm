/**
 * Mover en Documentación va en tres pasos porque Storage no sabe mover y los
 * bytes no deben pasar por el servidor (una carpeta grande agotaría la función):
 *
 *   1. plan   (servidor): valida y dice qué objeto va a qué ruta.
 *   2. copia  (navegador): descarga y sube cada objeto con el SDK de Firebase.
 *   3. commit (servidor): reescribe las filas en una transacción.
 *
 * El navegador borra el origen sólo después del commit.
 */
export type MoveRequest =
  | {
      kind: "files";
      file_ids: string[];
      /** "/" para la raíz. */
      destination_folder: string;
    }
  | {
      kind: "folder";
      folder_path: string;
      /** Nuevo padre ("/" para la raíz); por defecto el actual. */
      destination_parent?: string;
      /** Nuevo nombre; por defecto el actual. */
      new_name?: string;
    };

export interface MovePlanItem {
  id: string;
  name: string;
  source_folder: string;
  target_folder: string;
  /** Ruta del objeto en Storage. */
  source_path: string;
  destination_path: string;
  /** El objeto ya está en `destination_path`: sólo hay que corregir la BD. */
  in_place: boolean;
  has_preview: boolean;
}

export interface MoveStoragePrefix {
  source_prefix: string;
  destination_prefix: string;
}

export interface MovePlan {
  target_folder: string;
  items: MovePlanItem[];
  /**
   * Al mover una carpeta, prefijos de Storage que deben quedar vacíos: los
   * objetos sin fila en la BD también se copian para que la carpeta antigua
   * desaparezca del listado.
   */
  storage_prefixes: MoveStoragePrefix[];
}

export interface MoveCommitUpdate {
  id: string;
  download_url: string;
}

export interface MoveProgress {
  done: number;
  total: number;
  current?: string;
}
