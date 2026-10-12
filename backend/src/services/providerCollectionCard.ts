/** A provider's collection as the sync dialog's Browse tab shows it. */
export type ProviderCollectionCard = {
  id: string;
  name: string;
  /** The collection's page, which a sync follows (see parseSyncSource). */
  url: string;
  modelCount: number;
  /** A few model images, in the provider's own order. */
  thumbnails: string[];
  private: boolean;
  /** The owner's handle or username, when the provider says. */
  owner: string | null;
};
