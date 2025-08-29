import { TimeUpdater } from './time-updater';

declare global {
    interface Window {
        timeUpdater: TimeUpdater;
    }
}