(async function loadTheme() {
    try {
        const response = await fetch('/admin/theme');
        if (response.ok) {
            const theme = await response.json();
            const root = document.documentElement;
            // Apply settings to :root
            for (const [key, value] of Object.entries(theme)) {
                root.style.setProperty(key, value);
            }
        }
    } catch (error) {
        console.error("Failed to load theme:", error);
    }
})();
