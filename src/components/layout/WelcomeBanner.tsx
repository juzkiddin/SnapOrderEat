
"use client";

import { WELCOME_MESSAGE_VISIBLE_HEIGHT } from '@/lib/dataValues';

interface WelcomeBannerProps {
  showWelcomeMessage: boolean;
}

export default function WelcomeBanner({ showWelcomeMessage }: WelcomeBannerProps) {
  return (
    <div
      className={`transition-all duration-700 ease-in-out ${
        showWelcomeMessage
          ? `opacity-100 ${WELCOME_MESSAGE_VISIBLE_HEIGHT} mb-4`
          : 'opacity-0 h-0 overflow-hidden mb-0'
      }`}
    >
      <section className={`text-center ${showWelcomeMessage ? 'py-3' : 'py-0'}`}>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
          Welcome to <span className="text-primary">The Tasty Spoon</span>
        </h1>
      </section>
    </div>
  );
}
