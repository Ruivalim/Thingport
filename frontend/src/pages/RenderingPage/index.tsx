import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import type { PreviewMode } from "../../api/settings";
import PreviewsSection from "./PreviewsSection";
import SimplifySection from "./SimplifySection";

type Props = {
  onUnauthorized?: () => void;
  onPreviewModeChanged?: (mode: PreviewMode) => void;
};

/** Administration > Rendering: instance-wide settings for how model previews are made -- when
 *  they're generated (PreviewsSection) and whether heavy models are simplified for them
 *  (SimplifySection). */
export default function RenderingPage({ onUnauthorized, onPreviewModeChanged }: Props) {
  return (
    <Stack spacing={4} divider={<Divider />}>
      <PreviewsSection onUnauthorized={onUnauthorized} onSaved={onPreviewModeChanged} />
      <SimplifySection onUnauthorized={onUnauthorized} />
    </Stack>
  );
}
