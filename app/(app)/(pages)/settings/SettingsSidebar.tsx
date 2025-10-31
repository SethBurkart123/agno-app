"use client";

import React from 'react';
import { Boxes, Settings, Cog } from 'lucide-react';

type TabKey = 'providers';

interface SettingsSidebarProps {
  activeTab: TabKey;
  onChangeTab?: (key: TabKey) => void;
}

const SIDEBAR_ITEMS = [
  {
    icon: <Settings size={16} />,
    label: 'General',
    active: 'general',
  },
  {
    icon: <Boxes size={16} />,
    label: 'Providers',
    active: 'providers',
  },
  {
    icon: <Cog size={16} />,
    label: 'Appearance',
    active: 'appearance',
  }
];

export default function SettingsSidebar({ activeTab }: SettingsSidebarProps) {
  return (
    <aside className="w-60">
      <nav className="px-2 space-y-1">
        {SIDEBAR_ITEMS.map((item) => (
          <SidebarItem
            key={item.active}
            icon={item.icon}
            label={item.label}
            active={activeTab === item.active}
          />
        ))}
      </nav>
    </aside>
  );
}

function SidebarItem({ icon, label, active }: { icon: React.ReactNode; label: string; active?: boolean }) {
  return (
    <div
      className={`px-4 py-2.5 text-sm flex items-center gap-2 cursor-default select-none rounded-lg ${
        active
          ? 'text-foreground bg-muted/60'
          : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
      }`}
    >
      <span className="text-muted-foreground">{icon}</span>
      <span>{label}</span>
    </div>
  );
}

