import { AWDPipe, Installation, MonitoringRecord } from '../types.ts';

// Empty initial data — all data is loaded from MongoDB Atlas via /api/init
// These arrays serve as empty fallbacks when the backend is not reachable

export const INITIAL_PIPES: AWDPipe[] = [];

export const INITIAL_INSTALLATIONS: Installation[] = [];

export const INITIAL_MONITORING: MonitoringRecord[] = [];
