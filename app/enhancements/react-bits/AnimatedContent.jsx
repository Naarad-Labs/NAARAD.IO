/* Adapted from React Bits AnimatedContent, David Haz, MIT + Commons Clause.
 * Pinned source and complete license: docs/third-party/react-bits.md.
 * Narrowed to the transform/opacity once-only path. Native IntersectionObserver
 * replaces ScrollTrigger; visible content and reduced motion are always settled.
 */
import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';

export default function AnimatedContent({
  children, distance = 12, direction = 'vertical', reverse = false,
  duration = 0.22, ease = 'power2.out', initialOpacity = 0,
  animateOpacity = true, scale = 1, threshold = 0.08, delay = 0,
  onStart, onComplete, className = '', style, ...props
}) {
  const ref = useRef(null);
  const callbacksRef = useRef({ onStart, onComplete });
  callbacksRef.current = { onStart, onComplete };

  useEffect(() => {
    const el = ref.current;
    if (!el || !('IntersectionObserver' in window)) return undefined;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)');
    // Unlike upstream's hidden wrapper, render visibly. Only an element that
    // remains below the fold when the effect runs may receive a starting state.
    if (reduce.matches || el.getBoundingClientRect().top < innerHeight) return undefined;
    let observer;
    const ctx = gsap.context(() => {
      const targets = [el];
      const axis = direction === 'horizontal' ? 'x' : 'y';
      const sign = reverse ? -1 : 1;
      const from = { [axis]: distance * sign, scale, opacity: animateOpacity ? initialOpacity : 1 };
      const to = { [axis]: 0, scale: 1, opacity: 1, duration, ease };
      const tl = gsap.timeline({
        paused: true,
        onStart: () => callbacksRef.current.onStart?.(),
        onComplete: () => {
          callbacksRef.current.onComplete?.();
          gsap.set(targets, { clearProps: 'transform,opacity' });
        },
      });
      tl.fromTo(targets, from, to, Math.max(delay, 0));
      observer = new IntersectionObserver((entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        tl.play();
      }, { threshold, rootMargin: '0px 0px -4% 0px' });
      observer.observe(el);
    }, el);
    const settle = () => { observer?.disconnect(); ctx.revert(); };
    reduce.addEventListener('change', settle);
    return () => { reduce.removeEventListener('change', settle); settle(); };
  }, [distance, direction, reverse, duration, ease, initialOpacity, animateOpacity, scale, threshold, delay]);

  return <span ref={ref} className={className} style={{ display: 'block', ...style }} {...props}>{children}</span>;
}
