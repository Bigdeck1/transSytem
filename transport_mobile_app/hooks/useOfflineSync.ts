import { useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';

export interface QueuedAction {
  id: string;
  table: string;
  type: 'insert' | 'update';
  payload: any;
  matchKey?: string;
  matchValue?: any;
  timestamp: string;
}

const QUEUE_STORAGE_KEY = 'jrr_offline_sync_queue';

export function useOfflineSync() {
  // Enqueue an action when offline
  const enqueueAction = useCallback(async (action: Omit<QueuedAction, 'id' | 'timestamp'>) => {
    try {
      const queueStr = await AsyncStorage.getItem(QUEUE_STORAGE_KEY);
      const queue: QueuedAction[] = queueStr ? JSON.parse(queueStr) : [];
      
      const newAction: QueuedAction = {
        ...action,
        id: `offline_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        timestamp: new Date().toISOString(),
      };

      queue.push(newAction);
      await AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
      console.log('[OfflineSync] Action enqueued:', newAction.table, newAction.type);
    } catch (err) {
      console.warn('[OfflineSync] Failed to enqueue action:', err);
    }
  }, []);

  // Flush queued actions to Supabase
  const flushQueue = useCallback(async () => {
    try {
      const queueStr = await AsyncStorage.getItem(QUEUE_STORAGE_KEY);
      if (!queueStr) return;

      const queue: QueuedAction[] = JSON.parse(queueStr);
      if (queue.length === 0) return;

      console.log(`[OfflineSync] Attempting to sync ${queue.length} offline actions...`);
      const remaining: QueuedAction[] = [];

      for (const action of queue) {
        try {
          if (action.type === 'insert') {
            const { error } = await supabase.from(action.table).insert([action.payload]);
            if (error) throw error;
          } else if (action.type === 'update' && action.matchKey && action.matchValue) {
            const { error } = await supabase
              .from(action.table)
              .update(action.payload)
              .eq(action.matchKey, action.matchValue);
            if (error) throw error;
          }
          console.log('[OfflineSync] Synced action:', action.id, action.table);
        } catch (err) {
          console.warn('[OfflineSync] Action sync failed, retaining in queue:', action.id, err);
          remaining.push(action);
        }
      }

      await AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(remaining));
    } catch (err) {
      console.warn('[OfflineSync] Flush queue error:', err);
    }
  }, []);

  useEffect(() => {
    // Attempt initial flush on mount
    flushQueue();

    // Periodic sync attempt every 30 seconds
    const interval = setInterval(flushQueue, 30000);
    return () => clearInterval(interval);
  }, [flushQueue]);

  return { enqueueAction, flushQueue };
}
