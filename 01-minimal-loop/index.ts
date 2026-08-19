import Anthropic from "@anthropic-ai/sdk";
import type { ContentBlock, Message, MessageParam } from "@anthropic-ai/sdk/resources";

const client = new Anthropic();

// const msg: Message = await client.messages.create({
//   model: "claude-haiku-4-5",
//   max_tokens: 1024,
//   messages: [{
//     role: "user",
//     content: "hello, Claude"
//   }],
// });
// console.log(msg);

// for (const block of msg.content) {
//   if (block.type === "text") {
//     console.log(block.text);
//   }
// }

const runAgent = async (userMsg: string) => {
  const messages: MessageParam[] = [{ role: "user", content: userMsg }]


  while (true) {

    const response: Message = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1024,
      messages: messages,
    });

    messages.push({ role: "assistant", content: response.content })

    if (response.stop_reason != 'tool_use') return response.stop_reason;




  }
}

