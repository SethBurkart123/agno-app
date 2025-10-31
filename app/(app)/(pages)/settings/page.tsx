"use client";

import React, { useEffect } from 'react';
import { usePageTitle } from '@/contexts/page-title-context';
import SettingsSidebar from './SettingsSidebar';
import ProvidersPanel from './providers/ProvidersPanel';

export default function SettingsPage() {
  const { setTitle } = usePageTitle();

  useEffect(() => {
    setTitle('Settings');
  }, [setTitle]);

  return (
    <div className="flex w-full h-full">
      <SettingsSidebar activeTab="providers" />
      <main className="flex-1 overflow-y-auto">
        <div className="container max-w-4xl px-4 mx-auto">
          <ProvidersPanel />
        </div>
      </main>
    </div>
  );
}

