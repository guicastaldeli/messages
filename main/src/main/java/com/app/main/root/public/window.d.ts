import { TimeUpdater } from './time-updater.js';

declare global {
    interface Window {
        timeUpdater: TimeUpdater;
    }
}