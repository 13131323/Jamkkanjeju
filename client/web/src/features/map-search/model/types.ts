export type SearchResultPlace = {
  id: number;
  name: string;
  categoryLabel: string;
  distanceLabel: string;
  representativeImageUrl: string | null;
};

export type SearchResponse = {
  recommended: SearchResultPlace[];
  mission: SearchResultPlace[];
};
