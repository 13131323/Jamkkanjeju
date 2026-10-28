'use client';

import { useState } from 'react';
import { MapView } from '@widgets/map';
import { NavMenuModal } from '@widgets/nav-menu';

export function MapPage() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <>
      <MapView isMenuOpen={isMenuOpen} onOpenMenu={() => setIsMenuOpen(true)} />
      {isMenuOpen && <NavMenuModal onClose={() => setIsMenuOpen(false)} />}
    </>
  );
}
