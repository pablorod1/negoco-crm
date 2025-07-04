import validator from "validator";

export const isEmailWellFormed = (email: string) => validator.isEmail(email);

export const isPhoneNumberWellFormed = (phoneNumber: string) =>
  validator.isMobilePhone(phoneNumber, "es-ES");

export const isStringValueInformed = (field: string): boolean => field !== "";

export const isValueNotNullOrUndefined = <T>(value: T): boolean =>
  value !== null && value !== undefined;

export const isIBANWellFormed = (iban: string) => validator.isIBAN(iban);

function isValidNIE(nie: string) {
  // Asegurarse de que el NIE es una cadena y está en mayúsculas
  if (!nie || typeof nie !== "string") return false;
  nie = nie.toUpperCase();

  // Verificar el formato básico del NIE
  const nieRegex = /^[XYZ]\d{7}[A-Z]$/;
  if (!nieRegex.test(nie)) return false;

  // Sustituir la letra inicial por un dígito para validar como un DNI
  const letraInicial = nie[0];
  let numero = nie.slice(1, -1); // Tomar los 7 dígitos
  switch (letraInicial) {
    case "X":
      numero = "0" + numero;
      break;
    case "Y":
      numero = "1" + numero;
      break;
    case "Z":
      numero = "2" + numero;
      break;
    default:
      return false;
  }

  // Calcular la letra de control
  const letras = "TRWAGMYFPDXBNJZSQVHLCKE";
  const letraCorrecta = letras[parseInt(numero, 10) % 23];

  // Comparar la letra final del NIE con la calculada
  return nie.endsWith(letraCorrecta);
}

function isValidCIF(cif: string): boolean {
  // Asegurarse de que el CIF tiene una longitud de 9 caracteres
  if (!/^[A-Z]\d{7}[A-Z0-9]$/.test(cif)) {
    return false;
  }

  const letrasValidas = "ABCDEFGHJKLMNPQRSUVW";
  const letraInicial = cif[0];
  const numeros = cif.substring(1, 8);
  const control = cif[8];

  // Verificar que la letra inicial es válida
  if (!letrasValidas.includes(letraInicial)) {
    return false;
  }

  // Cálculo del dígito de control
  let sumaPar = 0;
  let sumaImpar = 0;

  for (let i = 0; i < numeros.length; i++) {
    const digito = parseInt(numeros[i], 10);
    if (i % 2 === 0) {
      // Índices impares en lógica humana (pares en código)
      const producto = digito * 2;
      sumaImpar += producto > 9 ? producto - 9 : producto;
    } else {
      sumaPar += digito;
    }
  }

  const sumaTotal = sumaPar + sumaImpar;
  const resto = sumaTotal % 10;
  const digitoControlCalculado = resto === 0 ? 0 : 10 - resto;

  // Validar el dígito o letra de control
  if (/[A-Z]/.test(control)) {
    const letrasControl = "JABCDEFGHI";
    return letrasControl[digitoControlCalculado] === control;
  } else if (/\d/.test(control)) {
    return parseInt(control, 10) === digitoControlCalculado;
  }

  return false;
}

export const isDocumetNumberWellFormed = (
  documentType: string,
  documentNumber: string
) => {
  if (documentType === "DNI") {
    return validator.isIdentityCard(documentNumber, "ES");
  } else if (documentType === "NIE") {
    return isValidNIE(documentNumber);
  } else if (documentType === "Otro" || documentType === "Pasaporte") {
    return true;
  } else if (documentType === "CIF") {
    return isValidCIF(documentNumber);
  }
  return false;
};

export const isPostalCodeWellFormed = (postalCode: string) =>
  validator.isPostalCode(postalCode, "ES");

export const isCUPSWellFormed = (cups: string) =>
  cups.length === 20 && validator.isAlphanumeric(cups);
