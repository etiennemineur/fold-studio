export type OutputType = {
  success: boolean;
};

export const postAuthLogout = async (
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/auth/logout`, {
    method: "POST",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!result.ok) {
   const errorObject = JSON.parse(await result.text()) as { error: string };
    throw new Error(errorObject.error || "Failed to logout");
  }

  return JSON.parse(await result.text()) as OutputType;
};