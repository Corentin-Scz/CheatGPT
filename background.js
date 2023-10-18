const uid = () => {
    const generateNumber = limit => (Math.random() * limit) | 0;
    
    const generateX = () => generateNumber(16).toString(16);
    
    const generateXes = count => Array.from({ length: count }, generateX).join('');

    const generateconstant = () => ((generateNumber(16) & 0x3) | 0x8).toString(16);

    return [
        generateXes(8),
        generateXes(4),
        '4' + generateXes(3),
        generateconstant() + generateXes(3),
        generateXes(12)
    ].join('-');
};

const getToken = async () => {
    const resp = await fetch("https://chat.openai.com/api/auth/session");
    if (resp.status === 403) throw 'CLOUDFLARE';
    
    const data = await resp.json();
    if (!data.accessToken) throw 'ERROR';
    
    return data.accessToken;
};

const getResponse = async (question) => {
    const accessToken = await getToken();
    const res = await fetch("https://chat.openai.com/backend-api/conversation", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
            action: "next",
            messages: [{
                id: uid(),
                role: "user",
                content: { content_type: "text", parts: [question] }
            }],
            model: "text-davinci-002-render",
            parent_message_id: uid()
        })
    });

    return res.body;
};

chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "logText",
        title: "Processing",
        contexts: ["selection"]
    });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
    const regex1 = /\{(.*?)finished_successfully(.*?)is_complete": true/g;
    const regex2 = /"parts": \["(.*?)"\]/;

    if (info.menuItemId !== "logText") return;

    chrome.tabs.sendMessage(tab.id, { action: "getSelectedText" }, async (response) => {
        if (chrome.runtime.lastError) {
            console.error(chrome.runtime.lastError);
            return;
        }

        const question = `Using your knowledge, respond with only the correct answer, without any additional explanation. Rewrite the correct answer in the same way as the proposition. If several answers are correct, only answer the correct answers in a row : ${response}`;

        try {
            const answer = await getResponse(question);
            const resRead = answer.getReader();
            let responseData = '';
            
            while (true) {
                const { done, value } = await resRead.read();
                if (done) break;
                if (value) responseData += new TextDecoder().decode(value);
            }

            const matches1 = [...responseData.matchAll(regex1)];
            const match2 = matches1[0][1].match(regex2);

            console.log("Réponse de ChatGPT:", JSON.parse('"' + match2[1] + '"'));
            chrome.tabs.sendMessage(tab.id, { action: "processData", data: JSON.parse('"' + match2[1] + '"') });

        } catch (e) {
            console.error("Erreur lors de la récupération de la réponse de ChatGPT:", e);
        }
    });
});
