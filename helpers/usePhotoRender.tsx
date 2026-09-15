import { useMutation } from "@tanstack/react-query";
import {
  postAiRender,
  InputType,
  OutputType,
} from "../endpoints/ai/render_POST.schema";

export const usePhotoRender = () => {
  return useMutation<OutputType, Error, InputType>({
    mutationFn: (data) => postAiRender(data),
  });
};