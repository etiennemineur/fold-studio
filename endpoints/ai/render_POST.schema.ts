import { z } from "zod";

export const schema = z.object({
  canvasImageBase64: z.string(),
  prompt: z.string().optional(),
  shapeType: z.string(),
  width: z.number(),
  height: z.number(),
  depth: z.number(),
  exteriorColor: z.string(),
  interiorColor: z.string(),
  materialType: z.string(),
  referenceImageBase64: z.string().nullable().optional(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  imageBase64: string;
};

export const postAiRender = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/ai/render`, {
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
    throw new Error(errorObject.error);
  }
  return JSON.parse(await result.text()) as OutputType;
};