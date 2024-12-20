import { Guild, User, GuildMember } from 'discord.js';
import { Song, metaHandler } from './MetaHandler';
import { EventEmitter } from 'events';
import { playbackHandler } from './PlaybackHandler';

export interface QueuedSong {
    song: Song;
    requestedBy: {
        id: string;
        username: string;
    };
}

export class QueueHandler extends EventEmitter {
    private queues: Map<string, QueuedSong[]>;

    constructor() {
        super();
        this.queues = new Map<string, QueuedSong[]>();
    }

    public clearQueue(guild: Guild): void {
        this.queues.set(guild.id, []);
        this.emit('queueUpdate', guild);
    }

    public async addLinkToQueue(guild: Guild, link: string, requestedBy: User): Promise<{ metadata: Song | null, downloadPromise: Promise<boolean> }> {
        const result = await metaHandler.getSongMetadata(link);
        if (!result.metadata) {
            throw new Error('Could not fetch song metadata');
        }
        
        if (!this.queues.has(guild.id)) {
            this.queues.set(guild.id, []);
        }
        
        const queue = this.queues.get(guild.id);
        this.queues.get(guild.id)?.push({
            song: result.metadata,
            requestedBy: {
                id: requestedBy.id,
                username: requestedBy.username
            }
        });
        this.emit('queueUpdate', guild);
        
        // Start playback if this is the only song in queue
        if (queue && queue.length <= 1) {
            try {
                const member = await guild.members.fetch(requestedBy.id);
                await playbackHandler.startPlayback(guild, member);
            } catch (error) {
                console.error('Error starting playback:', error);
            }
        }
        
        return { metadata: result.metadata, downloadPromise: result.downloadPromise };
    }

    public getCurrentQueueItem(guild: Guild): QueuedSong | null {
        const queue = this.queues.get(guild.id);
        if (!queue || queue.length === 0) {
            return null;
        }
        return queue[0];
    }

    public getNextQueueItem(guild: Guild): QueuedSong | null {
        const queue = this.queues.get(guild.id);
        if (!queue || queue.length === 0) {
            return null;
        }

        // Remove the current song
        queue.shift();
        
        this.emit('queueUpdate', guild);
        
        // Return the new first item (or null if queue is now empty)
        return queue.length > 0 ? queue[0] : null;

    }

    public clearQueueExceptCurrent(guild: Guild): void {
        const queue = this.queues.get(guild.id);
        if (!queue || queue.length === 0) {
            return;
        }
        
        // Keep only the first song (current playing)
        const currentSong = queue[0];
        this.queues.set(guild.id, [currentSong]);
        this.emit('queueUpdate', guild);
    }

    public shuffleQueue(guild: Guild): void {
        const queue = this.queues.get(guild.id);
        if (!queue || queue.length <= 1) {
            return;
        }

        // Keep the first song, shuffle the rest
        const currentSong = queue[0];
        const remainingSongs = queue.slice(1);

        // Fisher-Yates shuffle algorithm
        for (let i = remainingSongs.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [remainingSongs[i], remainingSongs[j]] = [remainingSongs[j], remainingSongs[i]];
        }

        // Reconstruct queue with current song at the start
        this.queues.set(guild.id, [currentSong, ...remainingSongs]);
        this.emit('queueUpdate', guild);
    }

    public moveSong(guild: Guild, fromIndex: number, toIndex: number): boolean {
        const queue = this.queues.get(guild.id);
        if (!queue || queue.length === 0) {
            return false;
        }

        // Check if indices are valid
        if (fromIndex < 0 || fromIndex >= queue.length || 
            toIndex < 0 || toIndex >= queue.length ||
            fromIndex === toIndex) {
            return false;
        }

        // Remove the song from its current position and insert it at the new position
        const [song] = queue.splice(fromIndex, 1);
        queue.splice(toIndex, 0, song);
        this.emit('queueUpdate', guild);
        return true;
    }

    public removeSong(guild: Guild, index: number): QueuedSong | null {
        const queue = this.queues.get(guild.id);
        if (!queue || queue.length === 0) {
            return null;
        }

        // Check if index is valid
        if (index < 0 || index >= queue.length) {
            return null;
        }

        // Remove and return the song
        const [removedSong] = queue.splice(index, 1);
        this.emit('queueUpdate', guild);
        return removedSong;
    }

    public getQueue(guild: Guild): QueuedSong[] {
        return this.queues.get(guild.id) || [];
    }
}

// Create a singleton instance
export const queueHandler = new QueueHandler();
