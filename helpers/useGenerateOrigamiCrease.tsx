import { useMutation } from "@tanstack/react-query";
import { postOrigamiCrease, InputType } from "../endpoints/ai/origami-crease_POST.schema";

export const useGenerateOrigamiCrease = () => {
  return useMutation({
    mutationFn: (data: InputType) => postOrigamiCrease(data),
  });
};