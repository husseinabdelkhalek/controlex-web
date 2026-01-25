// public/js/support-fab.js - New file for Floating Action Button
document.addEventListener('DOMContentLoaded', () => {
    const fabButton = document.querySelector('.support-fab .main-btn');
    const fabContainer = document.querySelector('.support-fab');
    const fabMenu = document.querySelector('.support-fab-menu');

    if (fabButton && fabContainer && fabMenu) {
        fabButton.addEventListener('click', (e) => {
            e.stopPropagation();
            const isActive = fabContainer.classList.toggle('active');
            fabMenu.style.display = isActive ? 'flex' : 'none';
        });

        // Close if click outside
        document.addEventListener('click', (event) => {
            if (!fabContainer.contains(event.target) && fabContainer.classList.contains('active')) {
                fabContainer.classList.remove('active');
                fabMenu.style.display = 'none';
            }
        });
    }
    // Always hide menu on load
    if (fabMenu) fabMenu.style.display = 'none';
});
