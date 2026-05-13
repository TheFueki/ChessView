import React from 'react';

import purpleBadge from '@/assets/badges/purple.svg';
import blackBadge from '@/assets/badges/black.svg';
import goldBadge from '@/assets/badges/gold.svg';
import pinkBadge from '@/assets/badges/pink.svg';
import blueBadge from '@/assets/badges/blue.svg';

interface BadgeProps {
  rank?: number | null;
  username?: string;
  size?: number;
}

interface BadgeItem {
  src: string;
  label: string;
  glow: string;
  id: string; 
}

export const VerificationBadge = ({ rank, username, size = 20 }: BadgeProps) => {
  const name = username?.toLowerCase();

  const getAllBadges = (): BadgeItem[] => {
    const badges: BadgeItem[] = [];
    const owners = ['cat', 'anek', 'ventie', 'venti'];
    const admins = ['solo'];

    if (owners.includes(name || '')) {
      badges.push({
        id: 'owner',
        src: purpleBadge,
        label: 'Verified Owner',
        glow: 'rgba(139, 92, 246, 0.5)'
      });
    }

    if (admins.includes(name || '')) {
      badges.push({
        id: 'admin',
        src: blackBadge,
        label: 'System Administrator',
        glow: 'rgba(239, 68, 68, 0.5)'
      });
    }

    if (rank) {
      if (rank === 1) {
        badges.push({ id: 'rank1', src: goldBadge, label: 'World Champion', glow: 'rgba(251, 191, 36, 0.5)' });
      } else if (rank <= 3) {
        badges.push({ id: 'rank3', src: pinkBadge, label: 'Top 3 Player', glow: 'rgba(229, 231, 235, 0.5)' });
      } else if (rank <= 100) {
        badges.push({ id: 'rank100', src: blueBadge, label: 'Top 100 Global', glow: 'rgba(59, 130, 246, 0.5)' });
      }
    }

    return badges;
  };

  const activeBadges = getAllBadges();
  if (activeBadges.length === 0) return null;

  return (
    <div className="badges-group" style={{ display: 'inline-flex', gap: '4px', alignItems: 'center' }}>
      {activeBadges.map((badge) => (
        <div 
          key={badge.id}
          className="custom-badge-container"
          title={badge.label}
          style={{ 
            width: size, 
            height: size,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            '--glow-color': badge.glow 
          } as React.CSSProperties}
        >
          <img 
            src={badge.src} 
            alt={badge.label}
            className="badge-img"
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        </div>
      ))}
    </div>
  );
};