'use client';

import React, { useState } from 'react';
import { HelpCircle } from 'lucide-react';
import { PageHelpModal } from './PageHelpModal';

interface PageHelpButtonProps {
  title: string;
  content: React.ReactNode;
  className?: string;
}

export const PageHelpButton: React.FC<PageHelpButtonProps> = ({
  title,
  content,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={`inline-flex items-center justify-center w-5 h-5 transition-colors ${className || 'text-gray-400 hover:text-blue-600'}`}
        title="ヘルプを表示"
        aria-label="ヘルプを表示"
      >
        <HelpCircle className="w-5 h-5" />
      </button>
      <PageHelpModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title={title}
        content={content}
      />
    </>
  );
};

