document.addEventListener('DOMContentLoaded', () => {
    const supportGearBtn = document.getElementById('support-gear-btn');
    const supportModal = document.getElementById('support-modal');
    const closeButton = document.querySelector('.support-modal .close-button');

    if (supportGearBtn && supportModal && closeButton) {
        supportGearBtn.addEventListener('click', () => {
            supportModal.classList.add('show');
        });
        closeButton.addEventListener('click', () => {
            supportModal.classList.remove('show');
        });
        supportModal.addEventListener('click', (event) => {
            if (event.target === supportModal) {
                supportModal.classList.remove('show');
            }
        });
    }
});
