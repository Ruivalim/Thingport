import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import AiConnectionSection from "./AiConnectionSection";
import AiCategorizationSection from "./AiCategorizationSection";

type Props = {
  onUnauthorized?: () => void;
};

export default function AiPage({ onUnauthorized }: Props) {
  return (
    <Stack spacing={4} divider={<Divider />}>
      <AiConnectionSection onUnauthorized={onUnauthorized} />
      <AiCategorizationSection onUnauthorized={onUnauthorized} />
    </Stack>
  );
}
