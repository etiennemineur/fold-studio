import { schema, OutputType } from "./origami-crease_POST.schema";
import OpenAI from "openai";
import { buildOrigamiSystemPrompt } from "../../helpers/origamiAIPrompt";
import { FoldData } from "../../helpers/foldEngine";

export async function handle(request: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not set.");
    }

    const json = JSON.parse(await request.text());
    const data = schema.parse(json);

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const systemPrompt = buildOrigamiSystemPrompt(data.paperWidth, data.paperHeight);

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: data.prompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 4000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from AI.");
    }

    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch (err) {
      throw new Error("Invalid JSON from AI.");
    }

    const description = parsed.description || "Generated origami pattern.";
    const foldData = parsed.foldData as FoldData | undefined;

    if (!foldData) {
      return new Response(
        JSON.stringify({
          foldData: null,
          description,
          error: "Missing foldData in AI response."
        } satisfies OutputType)
      );
    }

    // Validation
    const { verticesCoords, edgesVertices, edgesAssignment, facesVertices } = foldData;

    if (!Array.isArray(verticesCoords) || !Array.isArray(edgesVertices) || !Array.isArray(edgesAssignment) || !Array.isArray(facesVertices)) {
       return new Response(
        JSON.stringify({
          foldData: null,
          description,
          error: "Invalid foldData structure: missing or invalid arrays."
        } satisfies OutputType)
      );
    }

    const minX = -data.paperWidth / 2 - 0.5;
    const maxX = data.paperWidth / 2 + 0.5;
    const minY = -data.paperHeight / 2 - 0.5;
    const maxY = data.paperHeight / 2 + 0.5;

    for (const v of verticesCoords) {
      if (!Array.isArray(v) || v.length < 2) {
        return new Response(
          JSON.stringify({ foldData: null, description, error: "Invalid vertex coordinates format." } satisfies OutputType)
        );
      }
      if (v[0] < minX || v[0] > maxX || v[1] < minY || v[1] > maxY) {
        return new Response(
          JSON.stringify({ foldData: null, description, error: `Vertex out of bounds: [${v[0]}, ${v[1]}]` } satisfies OutputType)
        );
      }
    }

    const numVertices = verticesCoords.length;

    for (const e of edgesVertices) {
      if (!Array.isArray(e) || e.length !== 2 || e[0] < 0 || e[0] >= numVertices || e[1] < 0 || e[1] >= numVertices) {
        return new Response(
          JSON.stringify({ foldData: null, description, error: "Invalid edge indices referencing out-of-bound vertices." } satisfies OutputType)
        );
      }
    }

    for (const a of edgesAssignment) {
      if (a !== 'M' && a !== 'V' && a !== 'B' && a !== 'F') {
        return new Response(
          JSON.stringify({ foldData: null, description, error: `Invalid edge assignment type: ${a}` } satisfies OutputType)
        );
      }
    }

    for (const f of facesVertices) {
      if (!Array.isArray(f)) {
         return new Response(
          JSON.stringify({ foldData: null, description, error: "Invalid face array format." } satisfies OutputType)
        );
      }
      for (const idx of f) {
        if (idx < 0 || idx >= numVertices) {
          return new Response(
            JSON.stringify({ foldData: null, description, error: "Invalid face vertex indices referencing out-of-bound vertices." } satisfies OutputType)
          );
        }
      }
    }

    return new Response(
      JSON.stringify({
        foldData,
        description
      } satisfies OutputType)
    );

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || "Failed to generate origami crease." }),
      { status: 400 }
    );
  }
}