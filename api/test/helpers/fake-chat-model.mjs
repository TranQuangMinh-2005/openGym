import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { AIMessage } from '@langchain/core/messages';

export class FakeChatModel extends BaseChatModel {
  constructor(queues = {}, shared) {
    super({});
    this.queues = queues;
    this.calls = shared ?? [];
  }
  _llmType() { return 'scripted-fake'; }
  bindTools(tools, options) {
    const copy = new FakeChatModel(this.queues, this.calls);
    copy.boundTools = tools;
    copy.options = options;
    return copy;
  }
  next(messages, safety = false) {
    const first = messages.find(m => (m.getType?.() ?? m.role) === 'system');
    const agent = safety ? 'safety' :
      String(first?.content).match(/\[agent:([^\]]+)\]/)?.[1];
    this.calls.push({ agent, tools: this.boundTools ?? [], messages });
    const item = this.queues[agent]?.shift();
    if (!item) throw Error('Exhausted fake model queue: ' + agent);
    if (item.throw) throw Error(item.throw);
    return item;
  }
  withStructuredOutput(schema, options) {
    if (options?.method && options.method !== 'functionCalling') {
      throw Error('Unsupported structured output method');
    }
    return { invoke: async messages => {
      const item = this.next(messages, true);
      return schema.parse(item.args ?? item);
    } };
  }
  async _generate(messages) {
    const item = this.next(messages);
    const message = item.tool
      ? new AIMessage({ content: '', tool_calls: [{
        id: 'fake-' + this.calls.length, name: item.tool, args: item.args
      }] })
      : new AIMessage(item.text ?? '');
    return { generations: [{ text: String(message.content), message }] };
  }
}
