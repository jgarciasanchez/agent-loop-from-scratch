import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const msg = await client.messages.create({
  model: "claude-sonnet-5",
  max_tokens: 1024,
  messages: [{
    role: "user",
    content: "hello, Claude"
  }],
});
for (const block of msg.content) {
  if (block.type === "text") {
    console.log(block.text);

  }
}