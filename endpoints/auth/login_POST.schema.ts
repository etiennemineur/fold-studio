import { z } from "zod";
import { UserRoleArrayValues } from "../../helpers/schema";

export const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1, "Password is required"),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  success: boolean;
  user: {
    id: number;
    email: string;
    displayName: string;
    role: string;
  };
};

export const postAuthLogin = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/auth/login`, {
    method: "POST",
    body: JSON.stringify(validatedInput),
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!result.ok) {
    const errorObject = JSON.parse(await result.text()) as { error: string };
    throw new Error(errorObject.error || "Failed to login");
  }

  return JSON.parse(await result.text()) as OutputType;
};