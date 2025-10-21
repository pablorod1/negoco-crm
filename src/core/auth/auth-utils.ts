import bcrypt from "bcryptjs";

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(12);
  return await bcrypt.hash(password, salt);
}

export async function verifyPassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  console.log(password, hashedPassword);
  console.log("Compare: ", await bcrypt.compare(password, hashedPassword));
  return await bcrypt.compare(password, hashedPassword);
}
