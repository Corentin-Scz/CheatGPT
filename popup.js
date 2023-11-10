document.addEventListener('DOMContentLoaded', function() {
    const switchElement = document.getElementById('switchProposals');

    chrome.storage.local.get(['useMultipleProposals'], function(result) {
        if (result.useMultipleProposals !== undefined) {
            switchElement.checked = result.useMultipleProposals;
        }
    });

    switchElement.addEventListener('change', function() {
        const isMultiple = this.checked;
        chrome.storage.local.set({ useMultipleProposals: isMultiple });
    });
});
