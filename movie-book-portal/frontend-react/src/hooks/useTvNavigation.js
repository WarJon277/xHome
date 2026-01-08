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
                const activeContainer = active.closest('.sidebar') || active.closest('.main-content') || active.closest('main') || active.closest('nav');

                const candidates = focusable.map(el => {
                    if (el === active) return null;

                    const rect = el.getBoundingClientRect();
                    const margin = 20; // Reduced margin for more precise check

                    let isCandidate = false;
                    switch (e.key) {
                        case 'ArrowRight':
                            isCandidate = rect.left >= currentRect.right - margin;
                            break;
                        case 'ArrowLeft':
                            isCandidate = rect.right <= currentRect.left + margin;
                            break;
                        case 'ArrowDown':
                            isCandidate = rect.top >= currentRect.bottom - margin;
                            break;
                        case 'ArrowUp':
                            isCandidate = rect.bottom <= currentRect.top + margin;
                            break;
                    }

                    if (!isCandidate) return null;

                    const rectCenter = {
                        x: rect.left + rect.width / 2,
                        y: rect.top + rect.height / 2
                    };

                    // Calculate distance
                    let dist = Math.hypot(rectCenter.x - currentCenter.x, rectCenter.y - currentCenter.y);

                    // PENALTY: If candidate is in a different major container, add massive distance penalty
                    const elContainer = el.closest('.sidebar') || el.closest('.main-content') || el.closest('main') || el.closest('nav');
                    if (activeContainer && elContainer && activeContainer !== elContainer) {
                        dist += 2000; // Large penalty for jumping between sidebar and main
                    }

                    // PREFERENCE: Elements that are more "aligned" in the direction of movement get a bonus
                    const dx = Math.abs(rectCenter.x - currentCenter.x);
                    const dy = Math.abs(rectCenter.y - currentCenter.y);
                    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                        dist += dx * 2; // Penalize horizontal offset when moving vertically
                    } else {
                        dist += dy * 2; // Penalize vertical offset when moving horizontally
                    }

                    return { el, dist };
                }).filter(Boolean);

                if (candidates.length > 0) {
                    // Find closest candidate by distance (with penalties applied)
                    candidates.sort((a, b) => a.dist - b.dist);
                    const closest = candidates[0].el;

                    if (closest) {
                        e.preventDefault();
                        closest.focus();

                        const scrollOptions = {
                            behavior: 'smooth',
                            block: 'nearest',
                            inline: 'nearest'
                        };
                        closest.scrollIntoView(scrollOptions);
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
