import { z } from "zod";
import type { FoldData } from "../../helpers/foldEngine";

export const schema = z.object({
  prompt: z.string().min(1, "Prompt cannot be empty").max(500, "Prompt is too long"),
  paperWidth: z.number().min(10, "Paper width must be at least 10mm").max(500, "Paper width must be at most 500mm"),
  paperHeight: z.number().min(10, "Paper height must be at least 10mm").max(500, "Paper height must be at most 500mm"),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  foldData: FoldData | null;
  description: string;
  error?: string;
};

export const postOrigamiCrease = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/ai/origami-crease`, {
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