import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Skeleton from "@mui/material/Skeleton";
import Typography from "@mui/material/Typography";
import type { Theme } from "@mui/material/styles";
import CheckIcon from "@mui/icons-material/Check";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import ViewInArOutlinedIcon from "@mui/icons-material/ViewInArOutlined";
import type { BrowsableProvider, ProviderCollection } from "../../api/providerCollections";

// Each provider's own accent, so a tile reads as theirs.
export const PROVIDER_ACCENTS: Record<BrowsableProvider, string> = {
  makerworld: "#00AE42",
  printables: "#FA6831",
  thingiverse: "#5575FE",
  myminifactory: "#00C4A6",
  // Snapmaker's own blue: its mark is black, which a dark theme would lose.
  snapmaker: "#2563EB",
  // Anycubic's blue, for the same reason: MakerOnline's own mark is black and white.
  makeronline: "#1F7AE0",
};

type Props = {
  provider: BrowsableProvider;
  collection: ProviderCollection;
  selected: boolean;
  onSelect: () => void;
};

const sunken = (theme: Theme) => (theme.palette.mode === "dark" ? "rgba(255, 255, 255, 0.06)" : "#f4f4f4");

/** A model image, or an empty slot when the collection has fewer. */
function Thumb({ src, sx }: { src: string | undefined; sx?: object }) {
  const base = { display: "block", width: "100%", bgcolor: sunken, ...sx };
  return src ? (
    <Box component="img" src={src} alt="" loading="lazy" sx={{ ...base, objectFit: "cover" }} />
  ) : (
    <Box sx={base} />
  );
}

function ModelCount({ count, provider }: { count: number; provider: BrowsableProvider }) {
  const { t } = useTranslation("models");
  // Each site's own word for what it holds.
  const noun = provider === "thingiverse" ? "things" : provider === "myminifactory" ? "objects" : "models";
  return <>{t(`collections.sync.browse.${noun}`, { count })}</>;
}

/** MakerWorld: a 2x2 mosaic, "+N" over the last tile, the deck edges below. */
function MakerWorldTile({ collection }: { collection: ProviderCollection }) {
  const more = collection.model_count - 4;
  return (
    <Box
      sx={{
        borderRadius: "12px",
        border: 1,
        borderColor: "divider",
        bgcolor: "background.paper",
        overflow: "hidden",
        boxShadow: (theme) =>
          `0 6px 0 -2px ${theme.palette.mode === "dark" ? "#3a3a3a" : "#ebebeb"}, 0 11px 0 -5px ${theme.palette.mode === "dark" ? "#2e2e2e" : "#f2f2f2"}`,
        mb: "11px",
      }}
    >
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gridTemplateRows: "1fr 1fr",
          gap: "2px",
          aspectRatio: "4 / 3",
        }}
      >
        {[0, 1, 2, 3].map((i) => (
          <Box key={i} sx={{ position: "relative", minHeight: 0, overflow: "hidden" }}>
            <Thumb src={collection.thumbnails[i]} sx={{ width: "100%", height: "100%" }} />
            {i === 3 && more > 0 && (
              <Box
                sx={{
                  position: "absolute",
                  inset: 0,
                  display: "grid",
                  placeItems: "center",
                  bgcolor: "rgba(0, 0, 0, 0.45)",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: "1.25rem",
                }}
              >
                +{more}
              </Box>
            )}
          </Box>
        ))}
      </Box>
      <Box sx={{ px: 1.5, py: 1.25 }}>
        <Typography noWrap sx={{ fontWeight: 700, fontSize: "0.875rem" }}>
          {collection.name}
        </Typography>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 0.5,
            mt: 0.25,
            color: "text.secondary",
            fontSize: "0.75rem",
          }}
        >
          <ViewInArOutlinedIcon sx={{ fontSize: 14 }} />
          <ModelCount count={collection.model_count} provider="makerworld" />
          {collection.private && <LockOutlinedIcon sx={{ fontSize: 14, ml: "auto" }} />}
        </Box>
      </Box>
    </Box>
  );
}

/** Printables: its list row, boxed, with the three square thumbnails along the top. */
function PrintablesTile({ collection }: { collection: ProviderCollection }) {
  return (
    <Box
      sx={{
        borderRadius: "4px",
        border: 1,
        borderColor: "divider",
        borderTop: `3px solid ${PROVIDER_ACCENTS.printables}`,
        bgcolor: "background.paper",
        p: 1.25,
      }}
    >
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "4px" }}>
        {[0, 1, 2].map((i) => (
          <Thumb key={i} src={collection.thumbnails[i]} sx={{ aspectRatio: "1 / 1" }} />
        ))}
      </Box>
      <Typography noWrap sx={{ fontWeight: 700, fontSize: "0.875rem", mt: 1 }}>
        {collection.name}
      </Typography>
      <Box sx={{ display: "flex", alignItems: "center", fontSize: "0.8rem", color: "text.secondary" }}>
        <ModelCount count={collection.model_count} provider="printables" />
        {collection.private && <LockOutlinedIcon sx={{ fontSize: 14, ml: "auto" }} />}
      </Box>
    </Box>
  );
}

// Thingiverse's card: rings of lighter blue around the bottom, where the models stack up.
const RINGS = [
  { size: 200, color: "#718BFE" },
  { size: 170, color: "#9DAFFF" },
  { size: 130, color: "#BDC9FF" },
  { size: 80, color: "#EAEEFF" },
];

function ThingiverseTile({ collection }: { collection: ProviderCollection }) {
  const stack = collection.thumbnails.slice(0, 3);
  return (
    <Box
      sx={{
        position: "relative",
        overflow: "hidden",
        borderRadius: "8px",
        bgcolor: PROVIDER_ACCENTS.thingiverse,
        aspectRatio: "4 / 3",
        color: "#fff",
        textAlign: "center",
      }}
    >
      {RINGS.map(({ size, color }) => (
        <Box
          key={size}
          sx={{
            position: "absolute",
            left: "50%",
            top: "62%",
            width: `${size}%`,
            aspectRatio: "1.4 / 1",
            transform: "translateX(-50%)",
            borderRadius: "100%",
            bgcolor: color,
          }}
        />
      ))}
      <Box sx={{ position: "relative", px: 1.5, pt: 1.5 }}>
        <Typography noWrap sx={{ fontWeight: 600, fontSize: "1rem", lineHeight: 1.3, color: "#fff" }}>
          {collection.name}
        </Typography>
        <Typography sx={{ fontSize: "0.8rem", color: "#fff" }}>
          <ModelCount count={collection.model_count} provider="thingiverse" />
        </Typography>
      </Box>
      {stack.map((src, i) => (
        // The first model in front, the others peeking out above it.
        <Box
          key={src}
          sx={{
            position: "absolute",
            left: "50%",
            bottom: `${-38 + (stack.length - 1 - i) * 7}%`,
            width: `${78 - (stack.length - 1 - i) * 8}%`,
            transform: "translateX(-50%)",
            zIndex: stack.length - i,
            borderRadius: "8px",
            overflow: "hidden",
            border: "1px solid rgba(255, 255, 255, 0.9)",
            aspectRatio: "4 / 3",
          }}
        >
          <Thumb src={src} sx={{ width: "100%", height: "100%" }} />
        </Box>
      ))}
    </Box>
  );
}

// MyMiniFactory's card: name and count, then the cover model large, then a row of three more.
function MyMiniFactoryTile({ collection }: { collection: ProviderCollection }) {
  const [cover, ...rest] = collection.thumbnails;
  return (
    <Box
      sx={{
        borderRadius: "4px",
        border: 1,
        borderColor: "divider",
        borderBottom: `3px solid ${PROVIDER_ACCENTS.myminifactory}`,
        bgcolor: "background.paper",
        p: 1.25,
      }}
    >
      <Typography noWrap sx={{ fontWeight: 700, fontSize: "0.875rem" }}>
        {collection.name}
      </Typography>
      <Box sx={{ display: "flex", alignItems: "center", fontSize: "0.8rem", color: "text.secondary" }}>
        <ModelCount count={collection.model_count} provider="myminifactory" />
        {collection.private && <LockOutlinedIcon sx={{ fontSize: 14, ml: "auto" }} />}
      </Box>
      <Thumb src={cover} sx={{ aspectRatio: "16 / 9", mt: 1, borderRadius: "2px" }} />
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "4px", mt: "4px" }}>
        {[0, 1, 2].map((i) => (
          <Thumb key={i} src={rest[i]} sx={{ aspectRatio: "1 / 1", borderRadius: "2px" }} />
        ))}
      </Box>
    </Box>
  );
}

// Snapmaker Space's model card: the newest model large, a row of three more, then name and count.
function SnapmakerTile({ collection }: { collection: ProviderCollection }) {
  const [cover, ...rest] = collection.thumbnails;
  return (
    <Box
      sx={{
        borderRadius: "12px",
        border: 1,
        borderColor: "divider",
        bgcolor: "background.paper",
        overflow: "hidden",
      }}
    >
      <Thumb src={cover} sx={{ aspectRatio: "4 / 3" }} />
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "2px", mt: "2px" }}>
        {[0, 1, 2].map((i) => (
          <Thumb key={i} src={rest[i]} sx={{ aspectRatio: "1 / 1" }} />
        ))}
      </Box>
      <Box sx={{ px: 1.25, py: 1 }}>
        <Typography noWrap sx={{ fontWeight: 600, fontSize: "0.875rem" }}>
          {collection.name}
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", fontSize: "0.8rem", color: "text.secondary" }}>
          <ModelCount count={collection.model_count} provider="snapmaker" />
          {collection.private && <LockOutlinedIcon sx={{ fontSize: 14, ml: "auto" }} />}
        </Box>
      </Box>
    </Box>
  );
}

// MakerOnline's collection card: four covers in a square grid, then name and count.
function MakeronlineTile({ collection }: { collection: ProviderCollection }) {
  return (
    <Box
      sx={{
        borderRadius: "12px",
        border: 1,
        borderColor: "divider",
        bgcolor: "background.paper",
        overflow: "hidden",
      }}
    >
      <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px" }}>
        {[0, 1, 2, 3].map((i) => (
          <Thumb key={i} src={collection.thumbnails[i]} sx={{ aspectRatio: "1 / 1" }} />
        ))}
      </Box>
      <Box sx={{ px: 1.25, py: 1 }}>
        <Typography noWrap sx={{ fontWeight: 600, fontSize: "0.875rem" }}>
          {collection.name}
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", fontSize: "0.8rem", color: "text.secondary" }}>
          <ModelCount count={collection.model_count} provider="makeronline" />
          {collection.private && <LockOutlinedIcon sx={{ fontSize: 14, ml: "auto" }} />}
        </Box>
      </Box>
    </Box>
  );
}

const TILES: Record<BrowsableProvider, (props: { collection: ProviderCollection }) => JSX.Element> = {
  makerworld: MakerWorldTile,
  printables: PrintablesTile,
  thingiverse: ThingiverseTile,
  myminifactory: MyMiniFactoryTile,
  snapmaker: SnapmakerTile,
  makeronline: MakeronlineTile,
};

/** The name to show: a user's likes, and Snapmaker's likes and bookmarks, come named in English by the instance. */
function displayName(provider: BrowsableProvider, collection: ProviderCollection, t: (key: string) => string): string {
  if (collection.likes) return t("collections.sync.browse.likes");
  if (provider === "snapmaker" && collection.id.startsWith("likes-")) return t("collections.sync.browse.likes");
  if (provider === "snapmaker" && collection.id.startsWith("bookmarks-")) return t("collections.sync.browse.bookmarks");
  if (provider === "makeronline" && collection.id === "likes") return t("collections.sync.browse.likes");
  return collection.name;
}

/** A provider's collection to pick, drawn in that provider's colours and manner. One already synced
 *  with another Thingport collection can't be picked, and says with which. */
export default function ProviderCollectionTile({ provider, collection: given, selected, onSelect }: Props) {
  const { t } = useTranslation("models");
  const Tile = TILES[provider];
  const collection = { ...given, name: displayName(provider, given, t) };
  const taken = collection.synced !== null;
  return (
    <Box>
      <ButtonBase
        onClick={onSelect}
        disabled={taken}
        aria-pressed={selected}
        sx={{
          position: "relative",
          display: "block",
          width: "100%",
          textAlign: "left",
          borderRadius: "12px",
          opacity: taken ? 0.5 : 1,
          outline: selected ? `2px solid ${PROVIDER_ACCENTS[provider]}` : "2px solid transparent",
          outlineOffset: 3,
          transition: "outline-color 150ms, transform 150ms",
          "&:hover": taken ? undefined : { transform: "translateY(-2px)" },
          "&:focus-visible": { outline: `2px solid ${PROVIDER_ACCENTS[provider]}` },
        }}
      >
        <Tile collection={collection} />
        {selected && (
          <Box
            sx={{
              position: "absolute",
              top: -6,
              right: -6,
              zIndex: 5,
              width: 22,
              height: 22,
              borderRadius: "50%",
              display: "grid",
              placeItems: "center",
              bgcolor: PROVIDER_ACCENTS[provider],
              color: "#fff",
              boxShadow: 1,
            }}
          >
            <CheckIcon sx={{ fontSize: 15 }} />
          </Box>
        )}
      </ButtonBase>
      {taken && (
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
          {t("collections.sync.browse.takenBy", { name: collection.synced!.collection_name })}
        </Typography>
      )}
    </Box>
  );
}

/** A tile's shape while the provider's collections load, in that provider's manner. */
export function ProviderCollectionTileSkeleton({ provider }: { provider: BrowsableProvider }) {
  const lines = (
    <>
      <Skeleton variant="text" sx={{ fontSize: "0.875rem", width: "70%" }} />
      <Skeleton variant="text" sx={{ fontSize: "0.75rem", width: "40%" }} />
    </>
  );
  if (provider === "makerworld") {
    return (
      <Box aria-hidden sx={{ borderRadius: "12px", border: 1, borderColor: "divider", overflow: "hidden", mb: "11px" }}>
        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px", aspectRatio: "4 / 3" }}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} variant="rectangular" sx={{ width: "100%", height: "100%" }} />
          ))}
        </Box>
        <Box sx={{ px: 1.5, py: 1.25 }}>{lines}</Box>
      </Box>
    );
  }
  if (provider === "printables") {
    return (
      <Box
        aria-hidden
        sx={{
          borderRadius: "4px",
          border: 1,
          borderColor: "divider",
          borderTop: `3px solid ${PROVIDER_ACCENTS.printables}`,
          p: 1.25,
        }}
      >
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "4px", mb: 1 }}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} variant="rectangular" sx={{ width: "100%", height: "auto", aspectRatio: "1 / 1" }} />
          ))}
        </Box>
        {lines}
      </Box>
    );
  }
  if (provider === "makeronline") {
    return (
      <Box aria-hidden sx={{ borderRadius: "12px", border: 1, borderColor: "divider", overflow: "hidden" }}>
        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px" }}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} variant="rectangular" sx={{ width: "100%", height: "auto", aspectRatio: "1 / 1" }} />
          ))}
        </Box>
        <Box sx={{ px: 1.25, py: 1 }}>{lines}</Box>
      </Box>
    );
  }
  if (provider === "snapmaker") {
    return (
      <Box aria-hidden sx={{ borderRadius: "12px", border: 1, borderColor: "divider", overflow: "hidden" }}>
        <Skeleton variant="rectangular" sx={{ width: "100%", height: "auto", aspectRatio: "4 / 3" }} />
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "2px", mt: "2px" }}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} variant="rectangular" sx={{ width: "100%", height: "auto", aspectRatio: "1 / 1" }} />
          ))}
        </Box>
        <Box sx={{ px: 1.25, py: 1 }}>{lines}</Box>
      </Box>
    );
  }
  if (provider === "myminifactory") {
    return (
      <Box
        aria-hidden
        sx={{
          borderRadius: "4px",
          border: 1,
          borderColor: "divider",
          borderBottom: `3px solid ${PROVIDER_ACCENTS.myminifactory}`,
          p: 1.25,
        }}
      >
        {lines}
        <Skeleton variant="rectangular" sx={{ width: "100%", height: "auto", aspectRatio: "16 / 9", mt: 1 }} />
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "4px", mt: "4px" }}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} variant="rectangular" sx={{ width: "100%", height: "auto", aspectRatio: "1 / 1" }} />
          ))}
        </Box>
      </Box>
    );
  }
  return (
    <Box
      aria-hidden
      sx={{
        borderRadius: "8px",
        aspectRatio: "4 / 3",
        bgcolor: PROVIDER_ACCENTS.thingiverse,
        opacity: 0.35,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        pt: 1.5,
      }}
    >
      <Skeleton variant="text" sx={{ fontSize: "1rem", width: "60%", bgcolor: "rgba(255, 255, 255, 0.5)" }} />
      <Skeleton variant="text" sx={{ fontSize: "0.8rem", width: "30%", bgcolor: "rgba(255, 255, 255, 0.5)" }} />
    </Box>
  );
}
