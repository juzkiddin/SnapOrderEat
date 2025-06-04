
"use client";

import { WELCOME_MESSAGE_VISIBLE_HEIGHT } from '@/lib/dataValues';

interface WelcomeBannerProps {
  showWelcomeMessage: boolean;
}

export default function WelcomeBanner({ showWelcomeMessage }: WelcomeBannerProps) {
  return (
    <div
      // Reverted to animate height and opacity
      className={`${showWelcomeMessage ? WELCOME_MESSAGE_VISIBLE_HEIGHT : 'h-0'} mb-4 transition-all duration-700 ease-in-out ${
        showWelcomeMessage ? 'opacity-100' : 'opacity-0'
      } overflow-hidden`}
      aria-hidden={!showWelcomeMessage}
    >
      <section className="text-center py-3">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
          Welcome to <span className="text-primary">The Tasty Spoon</span>
        </h1>
      </section>
    </div>
  );
}
