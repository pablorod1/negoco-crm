import { uploadAvatar } from "@/lib/firebase/data/uploadFiles";
import { tursoClient } from "../../client";
import { User } from "@/lib/core/types";

export const addSuperToUser = async (
  user_id: string,
  super_id: string
): Promise<{
  success: boolean;
  error?: string;
}> => {
  try {
    const response = await tursoClient.execute({
      sql: `UPDATE user SET super_id = ? WHERE id = ?`,
      args: [super_id, user_id],
    });

    if (response.rowsAffected === 0) {
      return {
        success: false,
        error: "No se ha encontrado el usuario",
      };
    }

    return {
      success: true,
    };
  } catch (error) {
    console.error(error);
    return {
      success: false,
      error: "Error actualizando el usuario",
    };
  }
};

export const updateAvatarUser = async (
  user_id: string,
  image: File
): Promise<{
  success: boolean;
  error?: string;
}> => {
  try {
    const { downloadURL } = await uploadAvatar(image, user_id);

    if (!downloadURL) {
      return {
        success: false,
        error: "Error subiendo la imagen",
      };
    }

    const response = await tursoClient.execute({
      sql: `UPDATE user SET image = ? WHERE id = ?`,
      args: [downloadURL, user_id],
    });

    if (response.rowsAffected === 0) {
      return {
        success: false,
        error: "No se ha encontrado el usuario",
      };
    }

    return {
      success: true,
    };
  } catch (error) {
    console.error(error);
    return {
      success: false,
      error: "Error subiendo la imagen",
    };
  }
};

export const updateShouldResetPassword = async (userData: User) => {
  try {
    if (!userData.should_reset_password) {
      return;
    }

    const response = await tursoClient.execute({
      sql: `UPDATE user SET should_reset_password = 0 WHERE id = ?`,
      args: [userData.id],
    });

    if (response.rowsAffected === 0) {
      return {
        success: false,
        error: "No se ha encontrado el usuario",
      };
    }

    return {
      success: true,
    };
  } catch (error) {
    console.error(error);
  }
};
