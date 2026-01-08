// TV Remote Navigation Hook
// Handles arrow keys, Enter, Back button for TV remotes

import { useEffect } from 'react';

export function useTvNavigation(enabled = true) {
    useEffect(() => {
        if (!enabled) return;

        const handleKeyDown = (e) => {
            // Get currently focused element
            const active = document.activeElement;

            // Don't interfere with inputs, textareas, or video elements
            if (active && (
                active.tagName === 'INPUT' ||
                active.tagName === 'TEXTAREA' ||
                active.tagName === 'VIDEO'
            )) {
                return;
            }

            // Handle Enter key on focusable elements
            if (e.key === 'Enter') {
                if (active && active.hasAttribute('data-tv-clickable')) {
                    e.preventDefault();
                    active.click();
                }
            }

            // Handle Back button (Escape or Backspace on TV remotes)
            if (e.key === 'Escape' || e.key === 'Backspace') {
                // Let components handle their own back logic
                // This is just for ensuring the key is recognized
            }

            // Arrow keys for navigation
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                // Find all focusable elements
                const focusable = Array.from(document.querySelectorAll(
                    'button:not(:disabled), a[href], [tabindex]:not([tabindex="-1"]), .tv-focusable'
                )).filter(el => {
                    // Filter out hidden elements
                    return el.offsetParent !== null &&
                        window.getComputedStyle(el).visibility !== 'hidden';
                });

                if (focusable.length === 0) return;

                // If nothing is focused, focus first element
                if (!active || !focusable.includes(active)) {
                    focusable[0]?.focus();
                    e.preventDefault();
                    return;
                }

                const currentIndex = focusable.indexOf(active);
                const currentRect = active.getBoundingClientRect();
                const currentCenter = {
                    x: currentRect.left + currentRect.width / 2,
                    y: currentRect.top + currentRect.height / 2
                };

                // Find candidates in the direction of movement
                const candidates = focusable.filter((el, idx) => {
                    if (idx === currentIndex) return false;

                    const rect = el.getBoundingClientRect();
                    const margin = 50; // Tolerance for alignment

                    switch (e.key) {
                        case 'ArrowRight':
                            return rect.left >= currentRect.right - margin;
                        case 'ArrowLeft':
                            return rect.right <= currentRect.left + margin;
                        case 'ArrowDown':
                            return rect.top >= currentRect.bottom - margin;
                        case 'ArrowUp':
                            return rect.bottom <= currentRect.top + margin;
                        default:
                            return false;
                    }
                });

                if (candidates.length > 0) {
                    // Find closest candidate
                    let closest = candidates[0];
                    let minDist = Infinity;

                    candidates.forEach(el => {
                        const rect = el.getBoundingClientRect();
                        const center = {
                            x: rect.left + rect.width / 2,
                            y: rect.top + rect.height / 2
                        };
                        const dist = Math.hypot(
                            center.x - currentCenter.x,
                            center.y - currentCenter.y
                        );
                        if (dist < minDist) {
                            minDist = dist;
                            closest = el;
                        }
                    });

                    if (closest) {
                        e.preventDefault();
                        closest.focus();
                        closest.scrollIntoView({
                            behavior: 'smooth',
                            block: 'center',
                            inline: 'center'
                        });
                    }
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [enabled]);
}

// Helper to make elements TV-focusable
export function makeTvFocusable(element) {
    if (element && !element.hasAttribute('tabindex')) {
        element.setAttribute('tabindex', '0');
        element.setAttribute('data-tv-clickable', 'true');
    }
}
