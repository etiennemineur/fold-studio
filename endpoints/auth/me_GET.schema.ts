export type OutputType = {
  user: {
    id: number;
    email: string;
    displayName: string;
    role: string;
  };
};

export const getAuthMe = async (init?: RequestInit): Promise<OutputType> => {
  const result = await fetch(`/_api/auth/me`, {
    method: "GET",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!result.ok) {
    const errorObject = JSON.parse(await result.text()) as { error: string };
    throw new Error(errorObject.error || "Not authenticated");
  }

  return JSON.parse(await result.text()) as OutputType;
};