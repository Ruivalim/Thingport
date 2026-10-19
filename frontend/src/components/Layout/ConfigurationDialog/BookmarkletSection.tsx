import { useTranslation } from "react-i18next";
import BookmarkletButton from "../../BookmarkletButton";
import HelpTip from "../../HelpTip";
import { SectionLabel } from "./parts";

/** A link to drag to the bookmarks bar: clicked on a model's page, it opens the import dialog here with that page's link. */
export default function BookmarkletSection() {
  const { t } = useTranslation("app");
  return (
    <div>
      <SectionLabel>
        {t("bookmarklet.heading")}
        <HelpTip text={t("bookmarklet.help")} />
      </SectionLabel>
      <BookmarkletButton />
    </div>
  );
}
