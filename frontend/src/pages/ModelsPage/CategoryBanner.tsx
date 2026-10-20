import { useTranslation } from "react-i18next";
import { type Category } from "../../api/categories";
import InfoBanner from "../../components/InfoBanner";
import { translateCategoryDisplay } from "../../utils/translateCategoryDisplay";

type Props = {
  category: Category;
};

/** Shown above the grid when the category has meta text. Nothing without a title. */
export default function CategoryBanner({ category }: Props) {
  const { i18n } = useTranslation();
  const display = translateCategoryDisplay(category, i18n);
  if (!display.metaTitle) return null;
  return <InfoBanner title={display.metaTitle} description={display.metaDescription} />;
}
