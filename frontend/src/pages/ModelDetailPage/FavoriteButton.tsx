import Tooltip from "@mui/material/Tooltip";
import type { Print } from "../../api/prints";
import StarToggle from "../../components/StarToggle";
import { useFavoriteToggle } from "../../hooks/useFavoriteToggle";

type Props = {
  print: Print;
  onUpdated: (print: Print) => void;
  onUnauthorized?: () => void;
};

export default function FavoriteButton({ print, onUpdated, onUnauthorized }: Props) {
  const { isFavorite, toggle, label } = useFavoriteToggle(print, { onUpdated, onUnauthorized });

  return (
    <Tooltip title={label}>
      <span>
        <StarToggle active={isFavorite} onClick={toggle} ariaLabel={label} size={26} />
      </span>
    </Tooltip>
  );
}
