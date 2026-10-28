'use client';

import { useState } from 'react';

export type PlaceFilter = 'all' | 'treasure' | 'coop' | 'coupon';

export function useFilterState() {
  const [filter, setFilter] = useState<PlaceFilter>('all');
  return { filter, setFilter };
}
