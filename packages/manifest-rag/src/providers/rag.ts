import type { IAgentRuntime, Memory, Provider, State } from "@elizaos/core-plugin-v1";

const ragProvider: Provider = {
    get: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
        //console.log('ragProvider msg', message)
        // recentMessage
        //console.log('ragProvider state', state.value)

        // could add an LLM phase to generate keywords for search

        let text = ''
        if (message.content.text) {
          //const url = 'https://staging.mee.fun/api/knowledge_query'
          const url = 'https://pendium.ai/api/knowledge_query'
          const apiKey = 'b62bb972-f23a-406d-a8cc-757800edb8cf'

          const response = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": apiKey,
            },
            body: JSON.stringify({
              query: message.content.text,
              // e3d265ef-cb4f-02ef-bc41-e131c993c438 for MeeMee
              agent_id: runtime.agentId,
            }),
          });

          const data = await response.json();
          //console.log('data', data)
          //results[
          //  { id, score, metadata: {
          // id, url, text, summary, description, keywords
          //}}
          //]
          if (data.results) {
            //console.log('data.results', data.results)
            text += 'Additional maybe related knowlege:\n<<<\n'
            for(const r of data.results) {
              text += 'Document ' + r.id + ':\n'
              const md = r.metadata
              text += 'URL: ' + md.url + ':\n'
              text += 'Summary: ' + md.summary + ':\n'
              text += 'Text: ' + md.text + '\n\n'
            }
            text += '>>>\n'
          } else {
            console.warn('no results', data)
          }
          //console.log('out text', text)
        }

        return text
    },
};
export { ragProvider };
