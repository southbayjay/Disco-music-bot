import { Message } from 'discord.js';
import { queueHandler } from '../handlers/QueueHandler';

export default {
    name: 'shuffle',
    description: 'Shuffle the songs in the queue (except the currently playing song)',
    execute: async (message: Message) => {
        if (!message.guild) {
            await message.reply('This command can only be used in a server!');
            return;
        }

        try {
            queueHandler.shuffleQueue(message.guild);
            await message.reply('Queue has been shuffled!');
        } catch (error) {
            if (error instanceof Error) {
                await message.reply(error.message);
            }
        }
    }
}
