
"use client";

import { WELCOME_MESSAGE_VISIBLE_HEIGHT } from '@/lib/dataValues';

interface WelcomeBannerProps {
  showWelcomeMessage: boolean;
}

export default function WelcomeBanner({ showWelcomeMessage }: WelcomeBannerProps) {
  return (
    <div
      // Apply height and margin consistently. Transition only opacity.
      // WELCOME_MESSAGE_VISIBLE_HEIGHT already includes 'h-[...]'
      className={`${WELCOME_MESSAGE_VISIBLE_HEIGHT} mb-4 transition-opacity duration-700 ease-in-out ${
        showWelcomeMessage ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
      // Add aria-hidden when not visible for accessibility
      aria-hidden={!showWelcomeMessage}
    >
      {/* Inner content can be simplified as its visibility is controlled by parent's opacity */}
      <section className="text-center py-3">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
          Welcome to <span className="text-primary">The Tasty Spoon</span>
        </h1>
      </section>
    </div>
  );
}
