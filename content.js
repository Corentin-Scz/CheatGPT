function getSelectedText() {
    return window.getSelection().toString();
}

function getSelectedRange() {
    const selection = window.getSelection();
    if (selection.rangeCount === 0) return null;
    return selection.getRangeAt(0);
}

function normalizeData(data) {
    const regex = /^((a|b|c|d|e|f|g|h|i|j|k|l|m|n|o|p|q|r|s|t|u|v|w|x|y|z){1,2}|[0-9]+)[.|\)]\s+/i;
    const lines = data.split('\n');
    return lines.map(line => line.replace(regex, '')).filter(Boolean);
}


chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "getSelectedText") {
        const selectedText = getSelectedText();
        sendResponse(selectedText);
    }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "processData") {
        const rawData = message.data;
        const normalizedLines = normalizeData(rawData);
        const range = getSelectedRange();

        if (!range) return;  // No selected text, exit early.

        const contextNode = range.commonAncestorContainer;

        normalizedLines.forEach(data => {
            const xpathResult = document.evaluate(
                `./descendant::text()[contains(., '${data}') and not(contains(., '${data}.'))]`,
                contextNode,
                null,
                XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
                null
            );

            for (let i = 0; i < xpathResult.snapshotLength; i++) {
                let node = xpathResult.snapshotItem(i);
                node.nodeValue += ".";
            }
        });
    }
});
