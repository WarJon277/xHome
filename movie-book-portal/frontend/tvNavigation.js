// Spatial Navigation for TV
export function initTvNavigation() {
    document.addEventListener('keydown', (e) => {
        // Only handle if arrow keys
        if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;

        // Prevent default scrolling for arrows if we are handling focus
        // e.preventDefault(); // Optional: might block normal scrolling if focus handling fails

        const focusable = Array.from(document.querySelectorAll('button, a, input, select, textarea, .card, .nav-item'));
        const active = document.activeElement;

        if (!active || active === document.body) {
            // Focus first item
            focusable[0]?.focus();
            e.preventDefault();
            return;
        }

        const activeRect = active.getBoundingClientRect();
        const activeCenter = {
            x: activeRect.left + activeRect.width / 2,
            y: activeRect.top + activeRect.height / 2
        };

        const candidates = focusable.filter(el =>
            el !== active &&
            el.offsetParent !== null && // Visible
            !el.disabled &&
            isCandidate(activeRect, el.getBoundingClientRect(), e.key)
        );

        if (candidates.length > 0) {
            // Find closest
            let closest = null;
            let minDist = Infinity;

            candidates.forEach(el => {
                const rect = el.getBoundingClientRect();
                const center = {
                    x: rect.left + rect.width / 2,
                    y: rect.top + rect.height / 2
                };
                const dist = Math.hypot(center.x - activeCenter.x, center.y - activeCenter.y);
                if (dist < minDist) {
                    minDist = dist;
                    closest = el;
                }
            });

            if (closest) {
                closest.focus();
                e.preventDefault();
                closest.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    });

    // Make cards focusable
    const observer = new MutationObserver(() => {
        document.querySelectorAll('.card').forEach(card => {
            if (!card.hasAttribute('tabindex')) {
                card.setAttribute('tabindex', '0');
            }
            // Add Enter key handler to click
            card.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    // Try to find the image inside which has the click handler, or just click the card if it has one
                    const img = card.querySelector('img');
                    if (img) img.click();
                    else card.click();
                }
            });
        });
    });

    observer.observe(document.body, { childList: true, subtree: true });
}

function isCandidate(current, candidate, direction) {
    const margin = 20; // error margin
    switch (direction) {
        case 'ArrowRight':
            return candidate.left >= current.right - margin;
        case 'ArrowLeft':
            return candidate.right <= current.left + margin;
        case 'ArrowDown':
            return candidate.top >= current.bottom - margin;
        case 'ArrowUp':
            return candidate.bottom <= current.top + margin;
    }
    return false;
}
