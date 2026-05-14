import { useCallback, useState } from 'react';
import {
  IllustrationRider,
  IllustrationTaxi,
  IllustrationShop,
} from './IllustrationPlaceholders';
import './OnboardingScreen.css';

const SLIDES = [
  {
    id: 'delivery',
    title: 'Fast Deliveries',
    subtitle: 'Send packages anywhere, anytime',
    illustration: <IllustrationRider />,
  },
  {
    id: 'ride',
    title: 'Book a Ride',
    subtitle: 'Affordable taxi and tuk-tuk rides',
    illustration: <IllustrationTaxi />,
  },
  {
    id: 'shop',
    title: 'Shop & Order',
    subtitle: 'Buy from local shops delivered to you',
    illustration: <IllustrationShop />,
  },
];

export default function OnboardingScreen({ onComplete }) {
  const [index, setIndex] = useState(0);
  const isLast = index === SLIDES.length - 1;
  const showSkip = !isLast;

  const goNext = useCallback(() => {
    if (isLast) onComplete();
    else setIndex((i) => i + 1);
  }, [isLast, onComplete]);

  const skip = useCallback(() => {
    onComplete();
  }, [onComplete]);

  return (
    <div className="onboarding">
      <div className="onboarding__top">
        {showSkip ? (
          <button
            type="button"
            className="onboarding__skip"
            onClick={skip}
          >
            Skip
          </button>
        ) : (
          <span className="onboarding__topSpacer" aria-hidden />
        )}
      </div>
      <div
        className="onboarding__content"
        key={SLIDES[index].id}
      >
        <div className="onboarding__illu">{SLIDES[index].illustration}</div>
        <h1 className="onboarding__title">{SLIDES[index].title}</h1>
        <p className="onboarding__subtitle">{SLIDES[index].subtitle}</p>
      </div>
      <div className="onboarding__footer">
        <div
          className="onboarding__dots"
          role="tablist"
          aria-label="Onboarding step"
        >
          {SLIDES.map((s, i) => (
            <span
              key={s.id}
              role="tab"
              aria-selected={i === index}
              className={
                i === index ? 'onboarding__dot onboarding__dot--active' : 'onboarding__dot'
              }
            />
          ))}
        </div>
        <button type="button" className="onboarding__next" onClick={goNext}>
          {isLast ? 'Get Started' : 'Next'}
        </button>
      </div>
    </div>
  );
}
