let useMultipleProposals = false;

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
            "Accept": "text/event-stream",
            "Accept-Encoding": "gzip, deflate, br",
            "Accept-Language": "en-US",
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            "Dnt": 1,
            "Origin": "https://chat.openai.com",
            "Referer": "https://chat.openai.com/?model=text-davinci-002-render-sha",
            "Sec-Ch-Ua": 'Chromium";v="118", "Google Chrome";v="118", "Not=A?Brand";v="99"',
            "Sec-Ch-Ua-Mobile": "?0",
            "Sec-Ch-Ua-Platform": '"Windows"',
            "Sec-Fetch-Dest": "empty",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Site": "same-origin",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36",
        },
        body: JSON.stringify({
            action: "next",
            arkose_token: null,
            conversation_mode: { kind: "primary_assistant"},
            force_paragen: false,
            force_rate_limit: false,
            history_and_training_disabled: false,
            messages: [{
                author: { role: "user"},
                content: { content_type: "text", parts: [question] },
                id: uid(),
                metadata: {},
            }],
            model: "text-davinci-002-render-sha",
            parent_message_id: uid(),
            timezone_offset_min: 360,
        })
    });

    return res.body;
};

chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "logText",
        title: "Processing                                                           Ctrl+M",
        contexts: ["selection"]
    });
});

chrome.storage.local.get(['useMultipleProposals'], function(result) {
    if (result.useMultipleProposals !== undefined) {
        useMultipleProposals = result.useMultipleProposals;
    }
});

chrome.storage.onChanged.addListener(function(changes, namespace) {
    for (let key in changes) {
        if (key === 'useMultipleProposals') {
            let storageChange = changes[key];
            console.log('useMultipleProposals have been updated : '+ (storageChange.newValue ? "enabled" : "disabled"));
        }
    }
});

//Shortcut part
chrome.commands.onCommand.addListener((command) => {
  if (command === "launch_script") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (chrome.runtime.lastError) {
        console.error(`Error finding active tab: ${chrome.runtime.lastError}`);
        return;
      }

    const activeTab = tabs[0];
    const regex1 = /\{(.*?)finished_successfully(.*?)is_complete": true/g;
    const regex2 = /"parts": \["(.*?)"\]/;

    chrome.tabs.sendMessage(activeTab.id, { action: "getSelectedText" }, async (response) => {
        if (chrome.runtime.lastError) {
            console.error(chrome.runtime.lastError);
            return;
        }
        
        chrome.storage.local.get(['useMultipleProposals'], async (result) => {
            let question;
            const useMultiProps = result.useMultipleProposals;

            if (useMultiProps === false) {
                question = `Using your knowledge, respond with only the correct answer, without any additional explanation. Rewrite the correct answer in the same way as the proposition. Select only one correct answer because there is only one correct answer : ${response}`;
            } else if (useMultiProps === true) {
                question = `Using your knowledge, respond with only the corrects answers, without any additional explanation. Rewrite the corrects answers in the same way as the proposition. There are several corrects answers : ${response}`;
            }

            try {
                const answer = await getResponse(question);
                const resRead = answer.getReader();
                let responseData = '';
            
                while (true) {
                    const { done, value } = await resRead.read();
                    if (done) break;
                    if (value) responseData += new TextDecoder().decode(value);
                }

                console.log(responseData);
                const matches1 = [...responseData.matchAll(regex1)];
                const match2 = matches1[0][1].match(regex2);

                console.log("Response from ChatGPT: ", JSON.parse('"' + match2[1] + '"'));
                chrome.tabs.sendMessage(activeTab.id, { action: "processData", data: JSON.parse('"' + match2[1] + '"') });

            } catch (e) {
                console.error("Error retrieving response from ChatGPT: ", e);
            }
        });
      });
    });
  }
});



//Context menu part
chrome.contextMenus.onClicked.addListener((info, tab) => {
    const regex1 = /\{(.*?)finished_successfully(.*?)is_complete": true/g;
    const regex2 = /"parts": \["(.*?)"\]/;

    if (info.menuItemId !== "logText") return;

    chrome.tabs.sendMessage(tab.id, { action: "getSelectedText" }, async (response) => {
        if (chrome.runtime.lastError) {
            console.error(chrome.runtime.lastError);
            return;
        }

        chrome.storage.local.get(['useMultipleProposals'], async (result) => {
            let question;
            const useMultiProps = result.useMultipleProposals;

            if (useMultiProps === false) {
                question = `Using your knowledge, respond with only the correct answer, without any additional explanation. Rewrite the correct answer in the same way as the proposition. Select only one correct answer because there is only one correct answer : ${response}`;
            } else if (useMultiProps === true) {
                question = `Using your knowledge, respond with only the corrects answers, without any additional explanation. Rewrite the corrects answers in the same way as the proposition. There are several corrects answers : ${response}`;
            }

            try {
                const answer = await getResponse(question);
                const resRead = answer.getReader();
                let responseData = '';
            
                while (true) {
                    const { done, value } = await resRead.read();
                    if (done) break;
                    if (value) responseData += new TextDecoder().decode(value);
                }

                console.log(responseData);
                const matches1 = [...responseData.matchAll(regex1)];
                const match2 = matches1[0][1].match(regex2);

                console.log("Response from ChatGPT: ", JSON.parse('"' + match2[1] + '"'));
                chrome.tabs.sendMessage(tab.id, { action: "processData", data: JSON.parse('"' + match2[1] + '"') });

            } catch (e) {
                console.error("Error retrieving response from ChatGPT: ", e);
            }
        });
    });
});