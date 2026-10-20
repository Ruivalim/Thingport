import type React from "react";
import type { TFunction } from "i18next";
import type { NavigateFunction } from "react-router-dom";
import CollectionsIcon from "@mui/icons-material/Collections";
import ViewInArIcon from "@mui/icons-material/ViewInAr";
import PersonIcon from "@mui/icons-material/Person";
import FolderIcon from "@mui/icons-material/Folder";
import VisibilityIcon from "@mui/icons-material/Visibility";
import PrintIcon from "@mui/icons-material/Print";
import { dashboardApi, type DashboardSummary } from "../../api/dashboard";
import type { DashboardWidgetChoices, DashboardWidgetId } from "../../api/settings";
import CountCard from "./CountCard";
import ModelListCard from "./ModelListCard";
import AuthorListCard from "./AuthorListCard";
import ProviderListCard from "./ProviderListCard";
import RecentlyAddedCard from "./RecentlyAddedCard";
import ClockCard from "./ClockCard";
import WeatherCard from "./WeatherCard";
import FeaturedModelCard from "./FeaturedModelCard";
import ActivityHeatmapCard from "./ActivityHeatmapCard";
import type { DashboardSkeleton } from "./DashboardCardSkeleton";
import type { PanelSketchKind } from "./PanelSketch";

type WidgetContext = {
  summary: DashboardSummary;
  t: TFunction;
  navigate: NavigateFunction;
  onUnauthorized?: () => void;
};

export type DashboardWidget = {
  id: DashboardWidgetId;
  /** The widget's name in the settings dialog. */
  labelKey: string;
  /** Which of the three columns it sits in on a wide screen. */
  column: 0 | 1 | 2;
  /** Shown until the user switches it off. An optional widget can start hidden instead. */
  defaultEnabled: boolean;
  /** Its drawing in the settings dialog's Panels picker. */
  sketch: PanelSketchKind;
  /** Its placeholder while the summary loads. A widget without one fetches its own data, renders
   *  straight away, and mustn't read `summary`. */
  skeleton?: DashboardSkeleton;
  render: (ctx: WidgetContext) => React.ReactNode;
};

/** In page order. A new widget is one entry here, plus its id in DashboardWidgetId and the backend. */
export const DASHBOARD_WIDGETS: DashboardWidget[] = [
  {
    id: "collectionCount",
    labelKey: "dashboard.collectionCount.label",
    column: 0,
    defaultEnabled: true,
    sketch: "count",
    skeleton: { kind: "count" },
    render: ({ summary, t, navigate }) => (
      <CountCard
        icon={<CollectionsIcon sx={{ fontSize: 32 }} />}
        count={summary.collection_count}
        label={t("dashboard.collectionCount.label")}
        onClick={() => navigate("/models/collections")}
      />
    ),
  },
  {
    id: "modelCount",
    labelKey: "dashboard.modelCount.label",
    column: 0,
    defaultEnabled: true,
    sketch: "count",
    skeleton: { kind: "count" },
    render: ({ summary, t, navigate }) => (
      <CountCard
        icon={<ViewInArIcon sx={{ fontSize: 32 }} />}
        count={summary.model_count}
        label={t("dashboard.modelCount.label")}
        onClick={() => navigate("/models")}
      />
    ),
  },
  {
    id: "authorCount",
    labelKey: "dashboard.authorCount.label",
    column: 0,
    defaultEnabled: true,
    sketch: "count",
    skeleton: { kind: "count" },
    render: ({ summary, t }) => (
      <CountCard
        icon={<PersonIcon sx={{ fontSize: 32 }} />}
        count={summary.author_count}
        label={t("dashboard.authorCount.label")}
      />
    ),
  },
  {
    id: "categoryCount",
    labelKey: "dashboard.categoryCount.label",
    column: 0,
    defaultEnabled: true,
    sketch: "count",
    skeleton: { kind: "count" },
    render: ({ summary, t, navigate }) => (
      <CountCard
        icon={<FolderIcon sx={{ fontSize: 32 }} />}
        count={summary.category_count}
        label={t("dashboard.categoryCount.label")}
        onClick={() => navigate("/models")}
      />
    ),
  },
  {
    id: "featuredModel",
    labelKey: "dashboard.featuredModel.title",
    column: 1,
    defaultEnabled: false,
    sketch: "featured",
    render: ({ onUnauthorized }) => <FeaturedModelCard onUnauthorized={onUnauthorized} />,
  },
  {
    id: "activityHeatmap",
    labelKey: "dashboard.activityHeatmap.title",
    column: 1,
    defaultEnabled: false,
    sketch: "heatmap",
    render: ({ onUnauthorized }) => <ActivityHeatmapCard onUnauthorized={onUnauthorized} />,
  },
  {
    id: "topViewed",
    labelKey: "dashboard.topViewed.title",
    column: 1,
    defaultEnabled: true,
    sketch: "models",
    skeleton: { kind: "list", rows: 3, footer: true },
    render: ({ summary, t }) => (
      <ModelListCard
        icon={<VisibilityIcon />}
        title={t("dashboard.topViewed.title")}
        models={summary.top_viewed}
        valueOf={(m) => m.view_count}
        valueLabel={(count) => t("dashboard.viewCount", { count })}
        emptyText={t("dashboard.topViewed.empty")}
        seeMoreLabel={t("dashboard.seeMore")}
        fetchMore={dashboardApi.getTopViewed}
      />
    ),
  },
  {
    id: "topPrinted",
    labelKey: "dashboard.topPrinted.title",
    column: 1,
    defaultEnabled: true,
    sketch: "models",
    skeleton: { kind: "list", rows: 3, footer: true },
    render: ({ summary, t }) => (
      <ModelListCard
        icon={<PrintIcon />}
        title={t("dashboard.topPrinted.title")}
        models={summary.top_printed}
        valueOf={(m) => m.print_count}
        valueLabel={(count) => t("dashboard.printCount", { count })}
        emptyText={t("dashboard.topPrinted.empty")}
        seeMoreLabel={t("dashboard.seeMore")}
        fetchMore={dashboardApi.getTopPrinted}
      />
    ),
  },
  {
    id: "recentlyAdded",
    labelKey: "dashboard.recentlyAdded.title",
    column: 1,
    defaultEnabled: true,
    sketch: "models",
    skeleton: { kind: "list", rows: 3 },
    render: ({ summary }) => <RecentlyAddedCard models={summary.recently_added} />,
  },
  // The clock, weather, featured model and activity heatmap are optional extras, off until the user switches them on.
  // Clock and weather sit together at the top of the right column, as panels rather than count boxes.
  {
    id: "clock",
    labelKey: "dashboard.clock.label",
    column: 2,
    defaultEnabled: false,
    sketch: "clock",
    render: () => <ClockCard />,
  },
  {
    id: "weather",
    labelKey: "dashboard.weather.label",
    column: 2,
    defaultEnabled: false,
    sketch: "weather",
    render: () => <WeatherCard />,
  },
  {
    id: "topAuthors",
    labelKey: "dashboard.topAuthors.title",
    column: 2,
    defaultEnabled: true,
    sketch: "authors",
    skeleton: { kind: "list", rows: 5, footer: true },
    render: ({ summary }) => <AuthorListCard authors={summary.top_authors} />,
  },
  {
    id: "topProviders",
    labelKey: "dashboard.topProviders.title",
    column: 2,
    defaultEnabled: true,
    sketch: "providers",
    skeleton: { kind: "list", rows: 4, avatar: false },
    render: ({ summary }) => <ProviderListCard providers={summary.top_providers} />,
  },
];

export function isWidgetEnabled(widget: DashboardWidget, choices: DashboardWidgetChoices): boolean {
  return choices[widget.id] ?? widget.defaultEnabled;
}
