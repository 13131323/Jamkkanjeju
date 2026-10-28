'use client';

import { useState } from 'react';

export type PlaceFilter = 'all' | 'treasure' | 'coop';

export function useFilterState() {
  const [filter, setFilter] = useState<PlaceFilter>('all');
  return { filter, setFilter };
}
